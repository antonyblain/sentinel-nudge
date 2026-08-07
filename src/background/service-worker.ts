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
 * Solution : flag `installation_in_progress` (timestamp ms) dans chrome.storage.local posé
 * au début de onFirstInstall(), levé en finally. L'IIFE skip si le flag est présent et récent.
 * Fallback safety : flag > 60s (orphelin après crash) → log warn `install_flag_stale` + nettoyage.
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
import { initBootM2 } from './services/m2-boot-service';
import { initBootM5 } from './services/m5-boot-service';
import { initBootM6 } from './services/m6-boot-service';
import { createLogger, Logger } from '@/shared/utils/logger';

// ---------------------------------------------------------------------------
// Instanciation des services (module-level — persistés tant que le SW est actif)
// ---------------------------------------------------------------------------

const cryptoService = new CryptoService();
const storageService = new StorageService(cryptoService);
const quotaManager = new QuotaManager(storageService);

// Services TACHE-061 : Heartbeat M7, Canary hash, Registre d'incidents
const heartbeatService = new HeartbeatService();
const canaryService = new CanaryService(cryptoService);
// IncidentService instancié AVANT MessageRouter (T-103) : permet l'injection au constructeur
// et expose un buffer memoire pré-init pour ne pas perdre les incidents du boot (ARB-061-02)
const incidentService = new IncidentService();

// T-103 : incidentService passé au constructeur — élimine la fenêtre boot ~100ms
// durant laquelle un incident rate_limit_exceeded aurait été silencieusement perdu.
const messageRouter = new MessageRouter(quotaManager, incidentService);
const scoreCalculator = new ScoreCalculator(storageService);

/** Logger scopé ServiceWorker — mitigation R-M7-08 / TACHE-083 */
const swLogger = createLogger('ServiceWorker');

// ---------------------------------------------------------------------------
// Constantes — Purge pending_* (TACHE-093 / ADR-002)
// ---------------------------------------------------------------------------

/**
 * TTL legacy pour `pending_m7_toast` (shape `{ timestamp }` sans `expires_at`).
 *
 * M7 stocke `{ domain_hash, timestamp }` au lieu de `{ expires_at }` (E-CLI-01 dans ADR-002).
 * Ce TTL de 10 minutes correspond au seuil appliqué côté consommateur dans password-detector.ts
 * (ligne : `Date.now() - pending.timestamp < 600_000`). La migration vers `expires_at` est
 * suivie par TACHE-091.
 *
 * Référence : ADR-002 §Exceptions (E-CLI-01), TACHE-091
 */
const PENDING_M7_LEGACY_TTL_MS = 10 * 60 * 1_000; // 10 minutes

/**
 * TTL du flag  (TACHE-079 / R-M7-09).
 *
 * Si le flag est présent depuis plus de 60 secondes, onFirstInstall() a probablement
 * crashé avant son finally → flag orphelin. L'IIFE le considère comme stale et procède
 * au boot normal, en loggant un warn .
 *
 * Valeur : 60 secondes — largement supérieure au temps d'exécution nominal de
 * onFirstInstall() (~2-5s), inférieure à tout délai de session utilisateur.
 */
const INSTALL_FLAG_STALE_MS = 60 * 1_000; // 60 secondes

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
   *
   * Trois étapes :
   * 1. Purge IndexedDB (événements > 90 jours via storageService.purgeExpired)
   * 2. Purge chrome.storage.local des clés `pending_*` expirées (TACHE-093 / ADR-002)
   * 3. Purge m7_incidents expirés > 365 jours (T-159 R-074-02 / Art. 5.1.e RGPD)
   */
  async onPurgeDaily(): Promise<void> {
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    await storageService.initDB();
    await storageService.purgeExpired(ninetyDaysAgo);

    // Purge des intents cross-lifecycle expirés (ADR-002 §Conséquences négatives)
    // Empêche l'accumulation silencieuse de clés pending_* dans chrome.storage.local (~5 Mo quota).
    await purgePendingIntents();

    // T-159 R-074-02 : purge TTL absolue 365j du registre m7_incidents (Art. 5.1.e RGPD).
    // incidentService.db doit être initialisée — storageService.initDB() est appelé ci-dessus
    // et partage la même IDBDatabase via initService() au boot SW.
    await incidentService.purgeOldEntries(365);
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
 * Purge les clés `pending_*` expirées de chrome.storage.local (TACHE-093 / ADR-002).
 *
 * Algorithme :
 * 1. Lire toutes les entrées via `chrome.storage.local.get(null)` (snapshot complet)
 *    Note : BrowserAdapter.storage.local.get() ne supporte que string[] (ADR-008 v1).
 *    Cet appel direct à chrome.storage.local est justifié car `get(null)` est la seule
 *    API permettant de lire l'intégralité du storage sans connaitre les clés à l'avance.
 * 2. Filtrer les clés correspondant au préfixe `pending_`
 * 3. Pour chaque clé :
 *    - Shape canonique ADR-002 : `{ expires_at: number }` → supprimer si `expires_at < Date.now()`
 *    - Shape legacy M7 (E-CLI-01) : `{ timestamp: number }` → supprimer si `timestamp + 10 min < Date.now()`
 *    - Shape inconnue (ni `expires_at` ni `timestamp`) → conserver (fail-safe, évite la perte de données)
 * 4. Chaque suppression individuelle est protégée par un try/catch (incident `storage_purge_failed` severity=warn)
 *    afin de ne jamais interrompre la purge globale si une clé est corrompue.
 * 5. Log info structuré du nombre de clés scannées et purgées.
 *
 * Clés connues au moment de TACHE-093 :
 * - `pending_m7_toast`           — shape legacy `{ domain_hash, timestamp }` (E-CLI-01 / TACHE-091)
 * - `pending_m6_quiz`            — shape canonique `{ expires_at }` (ADR-002 R-CLI-03)
 * - `pending_m5_update_reminder` — shape canonique `{ expires_at }` (ADR-002 R-CLI-03)
 * - `pending_m17_toast`          — shape canonique `{ expires_at }` (ADR-002 R-CLI-03, livraison en cours)
 *
 * @returns Promesse résolue après la purge (jamais rejetée — fail-safe)
 */
async function purgePendingIntents(): Promise<void> {
  const now = Date.now();

  // Lecture de TOUTES les entrées de chrome.storage.local (snapshot complet).
  // chrome.storage.local.get(null) retourne l'intégralité du storage —
  // BrowserAdapter.storage.local.get() ne supporte que string[] (ADR-008 v1),
  // donc on appelle l'API Chrome directement avec un wrapper Promise.
  const allEntries = await new Promise<Record<string, unknown>>((resolve) => {
    chrome.storage.local.get(null, resolve);
  });

  // Filtrer uniquement les clés du préfixe `pending_`
  const pendingKeys = Object.keys(allEntries).filter((key) => key.startsWith('pending_'));

  let purgedCount = 0;

  for (const key of pendingKeys) {
    try {
      const entry = allEntries[key];

      // Valider que l'entrée est un objet non-null (les scalaires sont ignorés — fail-safe)
      if (typeof entry !== 'object' || entry === null) {
        continue;
      }

      const entryObj = entry as Record<string, unknown>;
      let shouldPurge = false;

      if (typeof entryObj['expires_at'] === 'number') {
        // Shape canonique ADR-002 R-CLI-03 : expires_at est une date absolue d'expiration
        shouldPurge = entryObj['expires_at'] < now;
      } else if (typeof entryObj['timestamp'] === 'number') {
        // Shape legacy M7 (E-CLI-01 / TACHE-091) : timestamp est la date d'émission,
        // TTL de 10 minutes aligné sur le seuil côté consommateur (password-detector.ts)
        shouldPurge = entryObj['timestamp'] + PENDING_M7_LEGACY_TTL_MS < now;
      }
      // Sinon : shape inconnue (ni expires_at ni timestamp) → conserver (fail-safe)

      if (shouldPurge) {
        // BrowserAdapter.remove attend string[] — on passe un tableau singleton
        await browser.storage.local.remove([key]);
        purgedCount++;
      }
    } catch (err: unknown) {
      // Incident individuel : ne jamais interrompre la purge globale (TACHE-093)
      // Severity=warn car la clé sera retentée lors de la prochaine purge quotidienne
      swLogger.warn('purgePendingIntents: erreur sur clé individuelle', {
        hint: 'storage_purge_failed',
        error_name: Logger.errorName(err),
      });
    }
  }

  swLogger.info('purgePendingIntents: purge terminée', {
    hint: 'storage_hygiene',
    scanned: pendingKeys.length,
    purged: purgedCount,
  });
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
 * boot success, boot M2 (initBootM2 — TACHE-085), boot M5 (initBootM5 — TACHE-087),
 * boot M6 (initBootM6 — TACHE-088), enregistrement des handlers de modules.
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

  // OBS-04 / TACHE-078 : injecter incidentService dans heartbeatService pour instrumenter heartbeat_write
  heartbeatService.setIncidentService(incidentService);

  // Initialisation du canary hash (INV-06, CM-C1)
  // Au premier install : init depuis zéro
  // Aux boots suivants : ce chemin n'est appelé que si canary.verify() est ok
  await canaryService.init(cryptoKey);

  // Boot réussi — ready=true, canary_verified=true (INV-01)
  await heartbeatService.onBootSuccess();

  // Boot M2 — ADR-001 R-BOOT-01/04 (TACHE-085) :
  // Vérification intégrité whitelist typosquatting + publication diagnostics.m2.
  // Non bloquant : une exception interne est capturée dans initBootM2().
  await initBootM2(incidentService);

  // Boot M5 — ADR-001 R-BOOT-01/04 (TACHE-087) :
  // Vérification intégrité m5_snooze_count + publication diagnostics.m5.
  // Non bloquant : une exception interne est capturée dans initBootM5().
  await initBootM5(incidentService);

  // Boot M6 — ADR-001 R-BOOT-01/04 (TACHE-088) :
  // Vérification intégrité m6_install_date + migration pending_m6_quiz + publication diagnostics.m6.
  // Non bloquant : une exception interne est capturée dans initBootM6().
  await initBootM6(incidentService);

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
 * 6. Initialiser les services (canary + heartbeat + initBootM2/M5/M6 + handlers via initializeServices)
 * 7. Ouvrir la page d'onboarding
 * 8. Lever le flag `installation_in_progress` (finally — garanti même en cas d'erreur)
 */
async function onFirstInstall(): Promise<void> {
  // Étape 0 — Flag anti-race (TACHE-079 / R-M7-09)
  // Posé avant toute opération async. L'IIFE module-level vérifie ce flag
  // et s'arrête immédiatement si présent, évitant la double génération de clé AES.
  // Stocker un timestamp (epoch ms) plutôt que true pour détecter les flags orphelins > 60s
  // (TACHE-079 fallback safety TC-03 / R-M7-09)
  await browser.storage.local.set({ installation_in_progress: Date.now() });

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

    // Initialisation des services post-clé (canary + heartbeat + initBootM2/M5/M6 + handlers)
    // initializeServices() fait : incidentService.initService() + canaryService.init()
    // + heartbeatService.onBootSuccess() + initBootM2() + initBootM5() + initBootM6()
    // + registerModuleHandlers()
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
// Séquence (mini-DAT TACHE-061 §2.1 / §5.1 — TACHE-085/086/087/088) :
//   0. Vérifier `installation_in_progress` (TACHE-079) :
//      si présent + récent → skip (onFirstInstall en cours)
//      si présent + stale (> 60s) → log warn install_flag_stale + nettoyer + continuer
//   1. HeartbeatService.onBootStart()   — incrémente boot_count, last_boot_ts=now, ready=false
//   2. storageService.initDB()           — ouvre/migre la base IDB (v2 inclut m7_incidents)
//   3. incidentService.initService(db)  — flush du buffer pré-init (ARB-061-02)
//   4. loadCryptoKey()                  — charge la clé AES depuis chrome.storage.local
//   5a. Clé absente → log boot_fail + régénération (chemin P-016)
//   5b. Clé présente → canaryService.verify()
//        - ok → heartbeatService.onBootSuccess()
//        - absent → canaryService.init() + re-verify
//        - échec → CM-EOP1 (test sur password_hashes) → canary_reinit ou key_regenerated
//   6a. initBootM2() — ADR-001 boot M2 : vérif whitelist + diagnostics.m2 (TACHE-085)
//   6b. initBootM5() — ADR-001 boot M5 : vérif snooze_count + diagnostics.m5 (TACHE-087)
//   6c. initBootM6() — ADR-001 boot M6 : vérif install_date + migration + diagnostics.m6 (TACHE-088)
//   6d. registerModuleHandlers(cryptoKey)
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
  const installFlagValue = installCheck['installation_in_progress'];
  if (installFlagValue) {
    // Fallback safety (TACHE-079 TC-03) : si le flag est un timestamp number
    // vieux de plus de INSTALL_FLAG_STALE_MS (60s), onFirstInstall() a crashé avant
    // son finally — flag orphelin. Procéder au boot normal avec log warn.
    const isTimestamp = typeof installFlagValue === 'number';
    const isStale =
      isTimestamp && Date.now() - (installFlagValue as number) > INSTALL_FLAG_STALE_MS;

    if (isStale) {
      // Flag orphelin : nettoyer et continuer le boot
      // R-M7-08 / TACHE-083 : log structuré via logger (pas de console.warn direct)
      swLogger.warn('SW init: install flag stale (> 60s) — flag nettoyé, boot normal (TACHE-079)', {
        hint: 'install_flag_stale',
        flag_age_ms: Date.now() - (installFlagValue as number),
      });
      await browser.storage.local.remove('installation_in_progress');
      // Pas de return : continuer le boot normalement
    } else {
      // Flag présent et récent : onFirstInstall() est en cours → skip
      // R-M7-08 / TACHE-083 : log structuré via logger (pas de console.info direct)
      swLogger.info('SW init: installation_in_progress — IIFE boot skipped (TACHE-079)', {
        hint: 'install_in_progress',
      });
      return;
    }
  }

  const bootStart = performance.now();

  // Étape 1 — Heartbeat : début de boot (état conservatif, ready=false)
  const diagnostics = await heartbeatService.onBootStart();

  try {
    // Étape 2 — Initialisation de la base IndexedDB (migration v2 si besoin)
    await storageService.initDB();

    // Étape 3 — Flush du buffer pré-init (ARB-061-02)
    await incidentService.initService(storageService.getDB());
    // T-103 : injection déjà effectuée au constructeur — setIncidentService supprimé.
    // OBS-04 / TACHE-078 : injecter incidentService dans heartbeatService pour instrumenter heartbeat_write
    heartbeatService.setIncidentService(incidentService);

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
      // OBS-04 / TACHE-078 : instrumentation storage_write_fail — site critique (clé AES absente)
      // Re-throw obligatoire : si la clé n'est pas persistée, le boot est compromis (INV-SEC-03).
      try {
        await browser.storage.local.set({ encryption_key_material: materialArray });
      } catch (writeErr: unknown) {
        await incidentService.log('storage_write_fail', 'error', {
          type: 'storage_write_fail',
          module: 'boot',
          site: 'encryption_key_boot',
          hint: (writeErr instanceof Error ? writeErr.message : String(writeErr)).slice(0, 100),
        });
        throw writeErr;
      }
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
        // T-080 : délégation à verifyKeyAgainstPasswordHashes() — logique extraite et testable
        // null = store vide → clé non vérifiable → chemin régénération
        const hashCount = await storageService.getPasswordHashCount();
        let keyOk = false;

        if (hashCount > 0) {
          try {
            const verifyResult = await storageService.verifyKeyAgainstPasswordHashes(cryptoKey!);
            keyOk = verifyResult === true;
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
          // OBS-04 / TACHE-078 : instrumentation storage_write_fail — site critique (canary_failed)
          // Re-throw obligatoire : si la clé n'est pas persistée, le boot est compromis (INV-SEC-03).
          try {
            await browser.storage.local.set({ encryption_key_material: materialArray });
          } catch (writeErr: unknown) {
            await incidentService.log('storage_write_fail', 'error', {
              type: 'storage_write_fail',
              module: 'boot',
              site: 'encryption_key_canary',
              hint: (writeErr instanceof Error ? writeErr.message : String(writeErr)).slice(0, 100),
            });
            throw writeErr;
          }
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

    // Étape 6a — Boot M2 : vérification intégrité whitelist + diagnostics.m2 (TACHE-085)
    // Non bloquant : initBootM2 capture ses propres exceptions (fail-safe).
    // Doit être exécuté après incidentService.initService() (étape 3) pour que
    // les incidents whitelist_corrupted / whitelist_regenerated soient persistés en IDB.
    await initBootM2(incidentService);

    // Étape 6b — Boot M5 : vérification intégrité m5_snooze_count + diagnostics.m5 (TACHE-087)
    // Non bloquant : initBootM5 capture ses propres exceptions (fail-safe).
    // Incidents possibles : m5_snooze_corrupted (error).
    await initBootM5(incidentService);

    // Étape 6c — Boot M6 : vérification intégrité m6_install_date + migration + diagnostics.m6 (TACHE-088)
    // Non bloquant : initBootM6 capture ses propres exceptions (fail-safe).
    // Incidents possibles : m6_install_date_corrupted (error), quiz_deferred_stale (warn).
    // Migration one-shot : suppression de la clé legacy m6_quiz_deferred.
    await initBootM6(incidentService);

    // Étape 6d — Enregistrement des handlers de modules
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
