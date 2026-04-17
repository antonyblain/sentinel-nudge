/**
 * @file background/service-worker.ts
 * @description Entry point du Service Worker Sentinel Nudge (Chrome MV3).
 *
 * Ce fichier est le point d'entrée déclaré dans manifest.json :
 *   "background": { "service_worker": "background/service-worker.js", "type": "module" }
 *
 * Responsabilités :
 * - Instancier les services (CryptoService, StorageService, QuotaManager, AlarmManager, MessageRouter)
 * - Enregistrer les listeners chrome.runtime (onInstalled, onStartup, onMessage)
 * - Enregistrer les listeners chrome.alarms.onAlarm
 * - Orchestrer le cycle de vie du Service Worker éphémère (MV3)
 *
 * Contrainte critique (RT-001) :
 * Le Service Worker est tué après ~30s d'inactivité. Toute donnée d'état
 * doit être persistée avant la fin de chaque opération.
 *
 * Référence : DAT §3.1 (Composants MV3), §6.2 (Flux de données)
 *
 * Race condition premier install (TACHE-079 / R-M7-09) :
 * Au premier install, onInstalled(reason='install') et l'IIFE module-level
 * s'exécutent en concurrence. Sans garde, l'IIFE voit la clé absente et
 * régénère une deuxième clé — deux incidents fantômes boot_fail + key_regenerated.
 * Solution : flag `installation_in_progress` dans chrome.storage.local posé
 * au début de onFirstInstall(), levé en finally. L'IIFE skip si le flag est présent.
 */

import { browser } from '@/shared/browser/browser-adapter';
import { CryptoService } from './crypto-service';
import { StorageService } from './storage-service';
import { QuotaManager } from './quota-manager';
import { AlarmManager, ALARM_NAMES } from './alarm-manager';
import { MessageRouter } from './message-router';
import { ScoreCalculator } from './score-calculator';
import { createExportHandler } from './handlers/export-handler';
import { createM2Handler } from './handlers/m2-handler';
import { createM3Handler } from './handlers/m3-handler';
import { createM5Handler } from './handlers/m5-handler';
import { createM6Handler } from './handlers/m6-handler';
import { createM17Handler } from './handlers/m17-handler';
import { createM7Handler } from './handlers/m7-handler';
import { createM9Handler } from './handlers/m9-handler';
import type { AlarmDispatcher } from './alarm-manager';
import type { ChromeStorageSchema } from '@/shared/types/storage';
import { MODULE_IDS } from '@/shared/constants/modules';
import { QUOTA_DEFAULT } from '@/shared/constants/quota';
import { HeartbeatService } from './services/heartbeat-service';
import { CanaryService } from './services/canary-service';
import { IncidentService } from './services/incident-service';
import { createLogger, Logger } from '@/shared/utils/logger';

// ---------------------------------------------------------------------------
// Instanciation des services (module-level — persistés tant que le SW est actif)
// ---------------------------------------------------------------------------

const cryptoService = new CryptoService();
const storageService = new StorageService(cryptoService);
const quotaManager = new QuotaManager(storageService);
const messageRouter = new MessageRouter(quotaManager);
const scoreCalculator = new ScoreCalculator(storageService);

// Services TACHE-061 : Heartbeat M7, Canary hash, Registre d'incidents
const heartbeatService = new HeartbeatService();
const canaryService = new CanaryService(cryptoService);
// IncidentService est instancie apres storageService.initDB() (ARB-061-01)
// et expose un buffer memoire pré-init pour ne pas perdre les incidents du boot (ARB-061-02)
const incidentService = new IncidentService();

/** Logger scopé ServiceWorker — mitigation R-M7-08 / TACHE-083 */
const swLogger = createLogger('ServiceWorker');

// ---------------------------------------------------------------------------
// Dispatcher d'alarmes
// ---------------------------------------------------------------------------

/**
 * Implémentation du dispatcher d'alarmes.
 * Chaque méthode correspond à une alarme définie dans AlarmManager.
 */
const alarmDispatcher: AlarmDispatcher = {
  /**
   * Calcul du score hebdomadaire M3 (alarme lundi 09h).
   */
  async onM3Weekly(): Promise<void> {
    const cryptoKey = await loadCryptoKey();
    if (!cryptoKey) return;

    await storageService.initDB();
    const config = await storageService.getConfig();
    const enabledModules = config?.modules as Partial<Record<string, boolean>> | undefined;
    await scoreCalculator.calculateWeeklyScore(cryptoKey, enabledModules);
  },

  /**
   * Vérification de mise à jour navigateur M5 (alarme toutes les 48h).
   * Délègue au handler M5 via le message interne 'check_update'.
   */
  async onM5Update(): Promise<void> {
    const cryptoKey = await loadCryptoKey();
    if (!cryptoKey) return;

    await storageService.initDB();
    // Déclencher la vérification via le handler M5
    const handler = messageRouter.getHandler('M5');
    if (handler) {
      await handler(
        { module: 'M5', action: 'check_update', payload: {}, timestamp: Date.now() },
        {} as chrome.runtime.MessageSender,
      );
    }
  },

  /**
   * Vérification de la date de quiz M6 (spaced repetition).
   * Délègue au handler M6 via le message interne 'check_quiz'.
   */
  async onM6Quiz(): Promise<void> {
    const cryptoKey = await loadCryptoKey();
    if (!cryptoKey) return;

    await storageService.initDB();
    // Déclencher la vérification via le handler M6
    const handler = messageRouter.getHandler('M6');
    if (handler) {
      await handler(
        { module: 'M6', action: 'check_quiz', payload: {}, timestamp: Date.now() },
        {} as chrome.runtime.MessageSender,
      );
    }
  },

  /**
   * Purge des données expirées (alarme quotidienne 02h00).
   */
  async onPurgeDaily(): Promise<void> {
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    await storageService.initDB();
    await storageService.purgeExpired(ninetyDaysAgo);
  },
};

const alarmManager = new AlarmManager(alarmDispatcher);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Charge la clé de chiffrement depuis chrome.storage.local.
 *
 * @returns CryptoKey importée ou null si le matériau n'est pas encore généré
 */
async function loadCryptoKey(): Promise<CryptoKey | null> {
  const result = await browser.storage.local.get(['encryption_key_material']);
  const material = result['encryption_key_material'];
  if (!material) return null;

  // chrome.storage.local NE supporte PAS ArrayBuffer en JSON. La cle doit
  // etre stockee en tant que Array<number> (32 octets pour AES-256).
  // Cette fonction gere les 2 formats :
  //  - Array<number> : nouveau format (JSON-safe)
  //  - ArrayBuffer : ancien format (pre-fix P-016 etendu, ne devrait plus exister)
  let buffer: ArrayBuffer;
  if (Array.isArray(material)) {
    if (material.length !== 32) return null;
    buffer = new Uint8Array(material).buffer;
  } else if (material instanceof ArrayBuffer) {
    buffer = material;
  } else {
    // Format inconnu (objet vide apres serialization JSON ratee) -> regeneration
    return null;
  }

  try {
    return await cryptoService.importKey(buffer);
  } catch {
    return null;
  }
}

/**
 * Enregistre les handlers de tous les modules dans le MessageRouter.
 *
 * Cette fonction est appelée au démarrage du SW et après chaque réveil,
 * car les handlers sont perdus quand le SW est tué.
 * Nécessite la clé de chiffrement pour les opérations cryptographiques.
 *
 * @param cryptoKey - Clé AES-256-GCM chargée depuis chrome.storage.local
 */
function registerModuleHandlers(cryptoKey: CryptoKey): void {
  // Handler M2 — saisie en contexte risqué (critique — bypass quota automatique)
  messageRouter.registerHandler('M2', createM2Handler(storageService, cryptoKey));

  // Handler M3 — score cyber-hygiène hebdomadaire
  messageRouter.registerHandler('M3', createM3Handler(storageService, scoreCalculator, cryptoKey));

  // Handler M5 — vérification mise à jour navigateur
  messageRouter.registerHandler('M5', createM5Handler(storageService, cryptoKey));

  // Handler M6 — quiz phishing (spaced repetition)
  messageRouter.registerHandler('M6', createM6Handler(storageService, cryptoKey));

  // Handler M7 — détection réutilisation mot de passe
  messageRouter.registerHandler(
    'M7',
    createM7Handler(storageService, cryptoKey, heartbeatService, incidentService),
  );

  // Handler M9 — enregistrement du score de force au submit
  messageRouter.registerHandler('M9', createM9Handler(storageService, cryptoKey));

  // Handler M17 — données sensibles presse-papiers (critique — bypass quota automatique)
  messageRouter.registerHandler('M17', createM17Handler(storageService, cryptoKey));

  // Handler EXPORT — export données RGPD Art. 20 (cryptoKey requis pour déchiffrer les events)
  messageRouter.registerHandler('EXPORT', createExportHandler(storageService, cryptoKey));
}

/**
 * Initialise les services post-clé après un premier install ou un réveil SW.
 *
 * Factorise les étapes post-écriture clé AES : flush buffer incidents, init canary,
 * boot success, enregistrement des handlers de modules.
 *
 * Appelé **uniquement depuis `onFirstInstall()`** après écriture de la clé AES dans
 * chrome.storage.local. L'IIFE boot sequence ne l'utilise PAS volontairement :
 * elle gère des chemins conditionnels (5a/5b) avec régénération de clé et CM-EOP1
 * qui rendent la factorisation non-triviale. Refactor IIFE hors scope TACHE-079
 * (QC A-01 corrigé 2026-04-17).
 *
 * @param cryptoKey - Clé AES-256-GCM fraîchement générée
 */
async function initializeServices(cryptoKey: CryptoKey): Promise<void> {
  // Flush du buffer pré-init (ARB-061-02) — incidents collectés avant initDB()
  await incidentService.initService(storageService.getDB());

  // Initialisation du canary hash (INV-06, CM-C1)
  // Au premier install : init depuis zéro
  // Aux boots suivants : ce chemin n'est appelé que si canary.verify() est ok
  await canaryService.init(cryptoKey);

  // Boot réussi — ready=true, canary_verified=true (INV-01)
  await heartbeatService.onBootSuccess();

  // Enregistrement des handlers de modules
  registerModuleHandlers(cryptoKey);
}

/**
 * Initialise l'extension au premier lancement (chrome.runtime.onInstalled).
 *
 * Actions :
 * 0. Poser le flag `installation_in_progress` pour que l'IIFE ne démarre pas en
 *    concurrence (TACHE-079 / R-M7-09 — ADR-001 R-BOOT-04)
 * 1. Générer et persister le sel d'installation (D-SEC-001)
 * 2. Générer et persister la clé AES-256-GCM (D-SEC-004)
 * 3. Créer la configuration par défaut
 * 4. Initialiser la base IndexedDB
 * 5. Configurer les alarmes planifiées
 * 6. Initialiser les services (canary + heartbeat + handlers via initializeServices)
 * 7. Ouvrir la page d'onboarding
 * 8. Lever le flag `installation_in_progress` (finally — garanti même en cas d'erreur)
 */
async function onFirstInstall(): Promise<void> {
  // Étape 0 — Flag anti-race (TACHE-079 / R-M7-09)
  // Posé avant toute opération async. L'IIFE module-level vérifie ce flag
  // et s'arrête immédiatement si présent, évitant la double génération de clé AES.
  await browser.storage.local.set({ installation_in_progress: true });

  try {
    // Génération du sel d'installation unique (D-SEC-001)
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const installationSalt = Array.from(saltBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Génération de la clé de chiffrement AES-256-GCM
    const cryptoKey = await cryptoService.generateKey();
    const keyMaterial = await cryptoService.exportKey(cryptoKey);

    // chrome.storage.local ne serialize pas un ArrayBuffer — on le convertit en
    // Array<number> pour stockage JSON-safe (32 octets AES-256). Cf. P-018.
    const keyMaterialArray = Array.from(new Uint8Array(keyMaterial));

    // Configuration par défaut — tous les modules activés sauf M7 (opt-in explicite)
    const defaultConfig: ChromeStorageSchema['config'] = {
      modules: Object.fromEntries(
        MODULE_IDS.map((id) => [id, id !== 'M7']), // M7 requiert consentement explicite (RGPD)
      ) as Record<(typeof MODULE_IDS)[number], boolean>,
      quota_limit: QUOTA_DEFAULT,
      profile: 'beginner',
      onboarding_complete: false,
      language: 'fr',
    };

    // Persistance dans chrome.storage.local
    await browser.storage.local.set({
      installation_salt: installationSalt,
      encryption_key_material: keyMaterialArray,
      config: defaultConfig,
      quota_state: {
        date: new Date().toISOString().split('T')[0],
        count: 0,
      },
      m2_session_domains: [],
    } as unknown as Partial<ChromeStorageSchema>);

    // Initialisation de la base IndexedDB
    await storageService.initDB();

    // Configuration des alarmes planifiées
    alarmManager.setupAlarms();

    // Initialisation des services post-clé (canary + heartbeat + handlers)
    // initializeServices() fait : incidentService.initService() + canaryService.init()
    // + heartbeatService.onBootSuccess() + registerModuleHandlers()
    await initializeServices(cryptoKey);

    // Ouverture de la page d'onboarding dans un nouvel onglet (ADR-008 — via browser adapter)
    await browser.tabs.create({ url: browser.runtime.getURL('pages/onboarding/onboarding.html') });
  } finally {
    // Étape 8 — Lever le flag quelle que soit l'issue (succès ou exception)
    // Garantit que l'IIFE pourra s'exécuter lors d'un éventuel réveil SW ultérieur.
    await browser.storage.local.remove('installation_in_progress');
  }
}

// ---------------------------------------------------------------------------
// Listeners Chrome
// ---------------------------------------------------------------------------

/**
 * Événement d'installation / mise à jour de l'extension.
 *
 * `reason === 'install'` → premier lancement
 * `reason === 'update'`  → mise à jour (migrations IDB futures)
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await onFirstInstall();
  } else if (details.reason === 'update') {
    await storageService.initDB();
    alarmManager.setupAlarms();
    // Réenregistrement des handlers après mise à jour
    const cryptoKey = await loadCryptoKey();
    if (cryptoKey) registerModuleHandlers(cryptoKey);
  }
});

/**
 * Événement de démarrage du navigateur.
 * Réinitialise les alarmes (elles peuvent avoir expiré pendant l'arrêt Chrome).
 * Réenregistre les handlers de modules (perdus quand le SW était tué).
 * Déclenche une vérification M5 au démarrage (SFD §2.3.1).
 */
chrome.runtime.onStartup.addListener(async () => {
  alarmManager.setupAlarms();
  void quotaManager.resetIfNewDay();

  // Réenregistrement des handlers après réveil du SW
  const cryptoKey = await loadCryptoKey();
  if (cryptoKey) {
    registerModuleHandlers(cryptoKey);
    await storageService.initDB();

    // Vérification M5 au démarrage (SFD §2.3.1)
    const m5Handler = messageRouter.getHandler('M5');
    if (m5Handler) {
      void m5Handler(
        { module: 'M5', action: 'check_update', payload: {}, timestamp: Date.now() },
        {} as chrome.runtime.MessageSender,
      );
    }
  }
});

/**
 * Listener unique des alarmes planifiées (B-002 — fusion des deux listeners).
 *
 * Gère dans un seul listener :
 * 1. L'initialisation de la base IndexedDB
 * 2. Le dispatch vers alarmManager.handleAlarm()
 * 3. La réinitialisation du quota journalier pour PURGE_DAILY
 */
browser.alarms.onAlarm.addListener(async (alarm: chrome.alarms.Alarm) => {
  // S'assurer que la base est initialisée avant de traiter les alarmes
  await storageService.initDB();
  await alarmManager.handleAlarm(alarm);

  // Réinitialisation du quota journalier lors de la purge quotidienne
  if (alarm.name === ALARM_NAMES.PURGE_DAILY) {
    await quotaManager.resetIfNewDay();
  }
});

// Activation du routeur de messages
messageRouter.listen();

// ---------------------------------------------------------------------------
// Content scripts — déclarés statiquement dans le manifest (content_scripts)
// ---------------------------------------------------------------------------
// Les content scripts (password-detector, paste-detector) sont injectés
// automatiquement par Chrome sur toutes les pages http/https via la
// déclaration content_scripts du manifest.json (run_at: document_idle).
//
// La désactivation module par module est gérée côté content script :
// chaque détecteur vérifie la config dans chrome.storage.local avant
// de s'activer. Pas d'injection dynamique via scripting.executeScript
// car celle-ci nécessite host_permissions ou une action utilisateur.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Boot sequence principale (module-level IIFE)
//
// Séquence (mini-DAT TACHE-061 §2.1 / §5.1) :
//   0. Vérifier `installation_in_progress` (TACHE-079) :
//      si présent → onFirstInstall() est en cours → skip (return early)
//   1. HeartbeatService.onBootStart()   — incrémente boot_count, last_boot_ts=now, ready=false
//   2. storageService.initDB()           — ouvre/migre la base IDB (v2 inclut m7_incidents)
//   3. incidentService.initService(db)  — flush du buffer pré-init (ARB-061-02)
//   4. loadCryptoKey()                  — charge la clé AES depuis chrome.storage.local
//   5a. Clé absente → log boot_fail + régénération (chemin P-016)
//   5b. Clé présente → canaryService.verify()
//        - ok → heartbeatService.onBootSuccess()
//        - absent → canaryService.init() + re-verify
//        - échec → CM-EOP1 (test sur password_hashes) → canary_reinit ou key_regenerated
//   6. registerModuleHandlers(cryptoKey)
// ---------------------------------------------------------------------------
void (async () => {
  // ---------------------------------------------------------------------------
  // Étape 0 — Garde anti-race premier install (TACHE-079 / R-M7-09)
  //
  // Au tout premier install, Chrome exécute l'IIFE module-level ET déclenche
  // onInstalled(reason='install') en quasi-simultané. Sans cette garde, l'IIFE
  // verrait la clé AES absente (pas encore écrite par onFirstInstall) et
  // régénèrerait une deuxième clé — produisant deux incidents fantômes
  // boot_fail + key_regenerated dans les 5 premières secondes.
  //
  // onFirstInstall() pose ce flag en premier, le lève en finally.
  // L'IIFE skip si le flag est présent : onFirstInstall() appellera
  // initializeServices() en fin de séquence, garantissant le boot complet.
  // ---------------------------------------------------------------------------
  const installCheck = await browser.storage.local.get(['installation_in_progress']);
  if (installCheck['installation_in_progress']) {
    // R-M7-08 / TACHE-083 : log structuré via logger (pas de console.info direct)
    swLogger.info('SW init: installation_in_progress — IIFE boot skipped (TACHE-079)');
    return;
  }

  const bootStart = performance.now();

  // Étape 1 — Heartbeat : début de boot (état conservatif, ready=false)
  const diagnostics = await heartbeatService.onBootStart();

  try {
    // Étape 2 — Initialisation de la base IndexedDB (migration v2 si besoin)
    await storageService.initDB();

    // Étape 3 — Flush du buffer pré-init (ARB-061-02)
    await incidentService.initService(storageService.getDB());
    // UC-03 / INV-UC03-05 : injecter le service d'incidents dans le routeur pour les incidents rate_limit_exceeded
    messageRouter.setIncidentService(incidentService);

    // Étape 4 — Chargement de la clé AES
    let cryptoKey = await loadCryptoKey();

    if (!cryptoKey) {
      // Étape 5a — Clé absente : log incident boot_fail + régénération automatique (P-016)
      await incidentService.log('boot_fail', 'error', {
        type: 'boot_fail',
        hint: 'key_absent',
        boot_count: diagnostics.boot_count,
      });

      // R-M7-08 / TACHE-083 : log structuré via logger (pas de console.warn direct)
      swLogger.warn(
        'SW init: encryption_key_material absent — régénération automatique (INV-SEC-03)',
        { boot_count: diagnostics.boot_count },
      );

      // INV-SEC-03 : logger key_regenerated AVANT d'écraser l'ancienne clé
      await incidentService.log('key_regenerated', 'error', {
        type: 'key_regenerated',
        trigger: 'boot_fail',
        previous_boot_count: diagnostics.boot_count,
        hashes_purged_count: await storageService.getPasswordHashCount(),
      });

      const newKey = await cryptoService.generateKey();
      const material = await cryptoService.exportKey(newKey);
      const materialArray = Array.from(new Uint8Array(material));
      await browser.storage.local.set({ encryption_key_material: materialArray });
      cryptoKey = newKey;

      // Re-initialiser le canary avec la nouvelle clé
      await canaryService.init(cryptoKey);
      await heartbeatService.onBootSuccess();
    } else {
      // Étape 5b — Clé présente : vérifier le canary
      const canaryResult = await canaryService.verify(cryptoKey);

      if (canaryResult.ok) {
        // Canary valide — boot nominal
        await heartbeatService.onBootSuccess();
      } else {
        // Canary invalide — appliquer CM-EOP1 (§11.5 mini-DAT)
        // Avant de régénérer la clé, tester si elle déchiffre une entrée password_hashes
        const hashCount = await storageService.getPasswordHashCount();
        let keyOk = false;

        if (hashCount > 0) {
          // CM-EOP1 : tenter de déchiffrer la plus ancienne entrée password_hashes
          // pour distinguer "clé OK + canary corrompu" de "clé KO"
          try {
            const db = storageService.getDB();
            keyOk = await new Promise<boolean>((resolve) => {
              const tx = db.transaction('password_hashes', 'readonly');
              const store = tx.objectStore('password_hashes');
              const idx = store.index('first_seen');
              const req = idx.openCursor(null, 'next');
              req.onsuccess = async () => {
                const cursor = req.result;
                if (!cursor) {
                  resolve(false);
                  return;
                }
                const rec = cursor.value as { value: ArrayBuffer; iv: Uint8Array };
                try {
                  await crypto.subtle.decrypt(
                    { name: 'AES-GCM', iv: rec.iv },
                    cryptoKey!,
                    rec.value,
                  );
                  resolve(true);
                } catch {
                  resolve(false);
                }
              };
              req.onerror = () => resolve(false);
            });
          } catch {
            keyOk = false;
          }
        }

        if (keyOk) {
          // CM-EOP1 : clé OK mais canary corrompu → re-init canary seulement (severity=warn)
          await incidentService.log('canary_reinit', 'warn', {
            type: 'canary_reinit',
            reason: canaryResult.reason,
          });
          await canaryService.init(cryptoKey);
          await heartbeatService.onBootSuccess();
        } else {
          // CM-EOP1 : clé KO ou store vide → régénération complète
          await incidentService.log('canary_failed', 'error', {
            type: 'canary_failed',
            reason: canaryResult.reason,
          });
          // INV-SEC-03 : log key_regenerated AVANT d'écraser l'ancienne clé
          await incidentService.log('key_regenerated', 'error', {
            type: 'key_regenerated',
            trigger: 'canary_failed',
            previous_boot_count: diagnostics.boot_count,
            hashes_purged_count: hashCount,
          });
          const newKey = await cryptoService.generateKey();
          const material = await cryptoService.exportKey(newKey);
          const materialArray = Array.from(new Uint8Array(material));
          await browser.storage.local.set({ encryption_key_material: materialArray });
          cryptoKey = newKey;
          await canaryService.init(cryptoKey);
          // Re-verify pour confirmer
          const reVerify = await canaryService.verify(cryptoKey);
          if (reVerify.ok) {
            await heartbeatService.onBootSuccess();
          } else {
            await heartbeatService.onBootFailure();
          }
        }
      }
    }

    // Étape 6 — Enregistrement des handlers de modules
    registerModuleHandlers(cryptoKey);

    const bootMs = Math.round(performance.now() - bootStart);
    // R-M7-08 / TACHE-083 : log structuré via logger (pas de console.info direct)
    swLogger.info('SW init: boot sequence complete', {
      modules: ['M2', 'M3', 'M5', 'M6', 'M7', 'M9', 'M17', 'EXPORT'],
      duration_ms: bootMs,
      boot_count: diagnostics.boot_count,
    });
  } catch (err: unknown) {
    // Catch global : log incident boot_fail sur toute exception non gérée du boot
    await incidentService.log('boot_fail', 'error', {
      type: 'boot_fail',
      hint: 'import_failed',
      boot_count: diagnostics.boot_count,
    });
    await heartbeatService.onBootFailure();
    // R-M7-08 / TACHE-083 : Logger.errorName — ne pas logger err.message
    swLogger.error('SW init: boot sequence failed', {
      boot_count: diagnostics.boot_count,
      error_name: Logger.errorName(err),
    });
    throw err;
  }
})();
