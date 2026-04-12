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

// ---------------------------------------------------------------------------
// Instanciation des services (module-level — persistés tant que le SW est actif)
// ---------------------------------------------------------------------------

const cryptoService = new CryptoService();
const storageService = new StorageService(cryptoService);
const quotaManager = new QuotaManager(storageService);
const messageRouter = new MessageRouter(quotaManager);
const scoreCalculator = new ScoreCalculator(storageService);

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
  return cryptoService.importKey(material as ArrayBuffer);
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
  messageRouter.registerHandler('M7', createM7Handler(storageService, cryptoKey));

  // Handler M9 — enregistrement du score de force au submit
  messageRouter.registerHandler('M9', createM9Handler(storageService, cryptoKey));

  // Handler M17 — données sensibles presse-papiers (critique — bypass quota automatique)
  messageRouter.registerHandler('M17', createM17Handler(storageService, cryptoKey));

  // Handler EXPORT — export données RGPD Art. 20 (cryptoKey requis pour déchiffrer les events)
  messageRouter.registerHandler('EXPORT', createExportHandler(storageService, cryptoKey));
}

/**
 * Initialise l'extension au premier lancement (chrome.runtime.onInstalled).
 *
 * Actions :
 * 1. Générer et persister le sel d'installation (D-SEC-001)
 * 2. Générer et persister la clé AES-256-GCM (D-SEC-004)
 * 3. Créer la configuration par défaut
 * 4. Initialiser la base IndexedDB
 * 5. Configurer les alarmes planifiées
 * 6. Enregistrer les handlers de modules
 * 7. Ouvrir la page d'onboarding
 */
async function onFirstInstall(): Promise<void> {
  // Génération du sel d'installation unique (D-SEC-001)
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const installationSalt = Array.from(saltBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Génération de la clé de chiffrement AES-256-GCM
  const cryptoKey = await cryptoService.generateKey();
  const keyMaterial = await cryptoService.exportKey(cryptoKey);

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
    encryption_key_material: keyMaterial,
    config: defaultConfig,
    quota_state: {
      date: new Date().toISOString().split('T')[0],
      count: 0,
    },
    m2_session_domains: [],
  } as Partial<ChromeStorageSchema>);

  // Initialisation de la base IndexedDB
  await storageService.initDB();

  // Enregistrement des handlers de modules
  registerModuleHandlers(cryptoKey);

  // Configuration des alarmes planifiées
  alarmManager.setupAlarms();

  // Ouverture de la page d'onboarding dans un nouvel onglet (ADR-008 — via browser adapter)
  await browser.tabs.create({ url: browser.runtime.getURL('pages/onboarding/onboarding.html') });
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

// Enregistrement initial des handlers (premier réveil du SW au chargement de la page)
// Nécessaire car onStartup n'est appelé qu'au démarrage du navigateur, pas au réveil du SW
void (async () => {
  await storageService.initDB();
  const cryptoKey = await loadCryptoKey();
  if (cryptoKey) registerModuleHandlers(cryptoKey);
})();
