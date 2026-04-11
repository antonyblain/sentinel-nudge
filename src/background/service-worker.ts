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
  async onM3Weekly(): Promise<void> {
    // Calcul du score hebdomadaire M3 — nécessite la clé de chiffrement
    const cryptoKey = await loadCryptoKey();
    if (!cryptoKey) return;
    await scoreCalculator.calculateWeeklyScore(cryptoKey);
  },

  async onM5Update(): Promise<void> {
    // Vérification mise à jour navigateur via API native Chrome (M5)
    const result = await browser.runtime.requestUpdateCheck();
    if (result.status === 'update_available') {
      // Injection du toast M5 dans l'onglet actif
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      if (activeTab?.id) {
        await browser.tabs.sendMessage(activeTab.id, {
          module: 'M5',
          action: 'show_update_toast',
          payload: {},
          timestamp: Date.now(),
        });
      }
    }
  },

  async onM6Quiz(): Promise<void> {
    // Déclenchement quiz M6 dans l'onglet actif
    // TODO(P4-M6) : vérifier les conditions de déclenchement (spaced repetition)
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    if (activeTab?.id) {
      await messageRouter.sendToTab(activeTab.id, {
        module: 'M6',
        action: 'trigger_quiz',
        payload: {},
        timestamp: Date.now(),
      });
    }
  },

  async onPurgeDaily(): Promise<void> {
    // Purge des données expirées (90 jours pour events)
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
 * Initialise l'extension au premier lancement (chrome.runtime.onInstalled).
 *
 * Actions :
 * 1. Générer et persister le sel d'installation (D-SEC-001)
 * 2. Générer et persister la clé AES-256-GCM (D-SEC-004)
 * 3. Créer la configuration par défaut
 * 4. Initialiser la base IndexedDB
 * 5. Configurer les alarmes planifiées
 * 6. Ouvrir la page d'onboarding
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
    ) as Record<typeof MODULE_IDS[number], boolean>,
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

  // Configuration des alarmes planifiées
  alarmManager.setupAlarms();

  // Ouverture de la page d'onboarding dans un nouvel onglet
  await chrome.tabs.create({ url: chrome.runtime.getURL('pages/onboarding/onboarding.html') });
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
    // TODO(P4-MIGRATION) : appliquer les migrations IndexedDB si version change
    await storageService.initDB();
    alarmManager.setupAlarms();
  }
});

/**
 * Événement de démarrage du navigateur.
 * Réinitialise les alarmes (elles peuvent avoir expiré pendant l'arrêt Chrome).
 */
chrome.runtime.onStartup.addListener(() => {
  alarmManager.setupAlarms();
  void quotaManager.resetIfNewDay();
});

/**
 * Listener des alarmes planifiées.
 */
browser.alarms.onAlarm.addListener(async (alarm: chrome.alarms.Alarm) => {
  // S'assurer que la base est initialisée avant de traiter les alarmes
  await storageService.initDB();
  await alarmManager.handleAlarm(alarm);
});

/**
 * Listener des alarmes de purge — cas spécial pour ALARM_NAMES.PURGE_DAILY.
 * La purge nécessite aussi la réinitialisation du quota journalier.
 */
browser.alarms.onAlarm.addListener(async (alarm: chrome.alarms.Alarm) => {
  if (alarm.name === ALARM_NAMES.PURGE_DAILY) {
    await quotaManager.resetIfNewDay();
  }
});

// Activation du routeur de messages
messageRouter.listen();
