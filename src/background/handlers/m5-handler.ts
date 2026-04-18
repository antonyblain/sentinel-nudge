/**
 * @file background/handlers/m5-handler.ts
 * @description Handler service worker pour le module M5 (rappel mise à jour navigateur).
 *
 * Orchestre la vérification périodique de mise à jour navigateur via
 * chrome.runtime.requestUpdateCheck() et gère la logique de déclenchement du toast.
 *
 * Algorithme principal (action 'check_update') :
 * 1. Appel à chrome.runtime.requestUpdateCheck()
 * 2. Si 'no_update' : marquer navigateur à jour (M3 composante MAJ = 20/20)
 * 3. Si 'throttled' : programmer une alarme de réessai dans 1h
 * 4. Si 'update_available' :
 *    a. Vérifier délai de grâce (48h depuis dernier nudge M5)
 *    b. Vérifier plein écran + formulaire actif (via l'onglet actif)
 *    c. Vérifier quota journalier
 *    d. Afficher le toast M5 avec le snoozeCount courant
 *
 * Action 'toast_action' (retour du content script après interaction) :
 * - 'update_now'  : ouvre chrome://settings/help, remet snoozeCount à 0
 * - 'remind_4h'  : programme une alarme dans 4h, incrémente snoozeCount
 * - 'why'        : ouvre la page d'explication M5
 * - 'closed'     : enregistre l'événement, remet snoozeCount à 0
 *
 * Contrainte anti-snooze infini (SFD §2.3.4 CA-M5-06) :
 * Après 3 reports consécutifs, le toast M5 ne propose plus le bouton "Me rappeler".
 * Le snoozeCount est persisté dans chrome.storage.local et remis à 0 après toute
 * action non-snooze.
 *
 * Référence : SFD §2.3 (M5), DAT §6.2 (alarmes), §9.4 (D-SEC-003)
 */

import { StorageService } from '@/background/storage-service';
import { browser } from '@/shared/browser/browser-adapter';
import type { NudgeMessage, NudgeResponse } from '@/shared/types/messages';
import type { ModuleHandler } from '@/background/message-router';
import { createLogger } from '@/shared/utils/logger';
import { classifyError } from '@/shared/utils/classify-error';

/** Logger scopé M5Handler — mitigation R-M7-08 / TACHE-104 */
const logger = createLogger('M5Handler');

/** Délai de grâce entre deux nudges M5 (48h en ms) */
const NUDGE_GRACE_PERIOD_MS = 48 * 60 * 60 * 1000;

/** Délai de réessai après throttling (1h en minutes) */
const THROTTLE_RETRY_MINUTES = 60;

/** Délai de snooze (4h en minutes) */
const SNOOZE_DELAY_MINUTES = 4 * 60;

/** Nombre maximum de reports consécutifs autorisés (SFD CA-M5-06) */
const MAX_SNOOZE_COUNT = 3;

/** Clé chrome.storage.local pour la date du dernier nudge M5 */
const M5_LAST_NUDGE_KEY = 'm5_last_nudge_date';

/** Clé chrome.storage.local pour le compteur de snoozes consécutifs */
const M5_SNOOZE_COUNT_KEY = 'm5_snooze_count';

/** Clé chrome.storage.local pour l'état de mise à jour navigateur (pour M3) */
export const M5_UP_TO_DATE_KEY = 'm5_is_up_to_date';

/** Nom de l'alarme de réessai après throttling */
const M5_RETRY_ALARM = 'm5_retry_throttled';

/** Nom de l'alarme de snooze 4h */
const M5_SNOOZE_ALARM = 'm5_snooze';

/**
 * Lit la date du dernier nudge M5 depuis chrome.storage.local.
 *
 * @returns Timestamp du dernier nudge ou 0 si jamais affiché
 */
async function getLastNudgeDate(): Promise<number> {
  try {
    const result = await browser.storage.local.get([M5_LAST_NUDGE_KEY]);
    const ts = result[M5_LAST_NUDGE_KEY];
    return typeof ts === 'number' ? ts : 0;
  } catch {
    return 0;
  }
}

/**
 * Lit le nombre de reports consécutifs depuis chrome.storage.local.
 *
 * @returns Nombre de snoozés consécutifs (0 si aucun)
 */
async function getSnoozeCount(): Promise<number> {
  try {
    const result = await browser.storage.local.get([M5_SNOOZE_COUNT_KEY]);
    const count = result[M5_SNOOZE_COUNT_KEY];
    return typeof count === 'number' ? count : 0;
  } catch {
    return 0;
  }
}

/**
 * Met à jour le compteur de snoozes et le timestamp du dernier nudge.
 *
 * @param snoozeCount - Nouveau compteur de snoozés consécutifs
 */
async function setSnoozeCount(snoozeCount: number): Promise<void> {
  await browser.storage.local.set({
    [M5_SNOOZE_COUNT_KEY]: snoozeCount,
    [M5_LAST_NUDGE_KEY]: Date.now(),
  });
}

/**
 * Remet le compteur de snoozes à 0 (après update_now ou closed).
 */
async function resetSnoozeCount(): Promise<void> {
  await browser.storage.local.set({
    [M5_SNOOZE_COUNT_KEY]: 0,
  });
}

/**
 * Marque l'état de mise à jour dans chrome.storage.local pour M3.
 *
 * @param isUpToDate - true si le navigateur est à jour
 */
async function setUpToDateState(isUpToDate: boolean): Promise<void> {
  await browser.storage.local.set({ [M5_UP_TO_DATE_KEY]: isUpToDate });
}

/**
 * Vérifie si l'onglet actif est en plein écran ou si un formulaire est actif.
 * Retourne false par défaut (fail-safe) si la requête échoue.
 *
 * @param tabId - ID de l'onglet actif
 * @returns { fullscreen, form_active }
 */
async function checkTabContext(
  tabId: number,
): Promise<{ fullscreen: boolean; form_active: boolean }> {
  try {
    const response = (await browser.tabs.sendMessage(tabId, {
      module: 'M5',
      action: 'check_context',
      payload: {},
      timestamp: Date.now(),
    })) as { fullscreen?: boolean; form_active?: boolean } | null;

    if (response && typeof response === 'object') {
      return {
        fullscreen: response.fullscreen === true,
        form_active: response.form_active === true,
      };
    }
  } catch {
    // Onglet non disponible ou content script non injecté — fail-safe
  }
  return { fullscreen: false, form_active: false };
}

/**
 * Traite la vérification de mise à jour navigateur.
 *
 * @param storageService - Service de stockage
 * @param cryptoKey      - Clé AES-256-GCM
 * @returns Réponse NudgeResponse
 */
async function handleCheckUpdate(
  storageService: StorageService,
  cryptoKey: CryptoKey,
): Promise<NudgeResponse> {
  try {
    // Vérification API Chrome (D-SEC-003 : pas de version embarquée)
    let updateStatus: string;
    try {
      const result = await browser.runtime.requestUpdateCheck();
      updateStatus = result.status;
    } catch {
      // API non disponible (navigateur modifié) — dégradation gracieuse (SFD §2.3.4)
      // TACHE-104 / R-M7-08 : logger.warn remplace console.warn direct (INV-SEC-02 étendu)
      logger.warn('requestUpdateCheck() non disponible — M5 désactivé', {
        hint: 'api_unavailable',
      });
      await setUpToDateState(false);
      return { success: true, action: 'skip', reason: 'api_unavailable' };
    }

    if (updateStatus === 'no_update') {
      // Navigateur à jour — marquer pour M3
      await setUpToDateState(true);
      await storageService.logEvent(
        'M5',
        { action: 'no_update', module_data: { status: 'up_to_date' } },
        cryptoKey,
      );
      return { success: true, action: 'skip', reason: 'no_update' };
    }

    if (updateStatus === 'throttled') {
      // Trop de requêtes — réessayer dans 1h (SFD §2.3.4 CA-M5-05)
      await browser.alarms.create(M5_RETRY_ALARM, { delayInMinutes: THROTTLE_RETRY_MINUTES });
      return { success: true, action: 'skip', reason: 'throttled' };
    }

    // Mise à jour disponible
    await setUpToDateState(false);

    // Vérifier le délai de grâce 48h
    const lastNudge = await getLastNudgeDate();
    if (Date.now() - lastNudge < NUDGE_GRACE_PERIOD_MS) {
      return { success: true, action: 'skip', reason: 'grace_period' };
    }

    // Récupérer l'onglet actif et vérifier le contexte
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    if (!activeTab?.id) {
      return { success: true, action: 'skip', reason: 'no_active_tab' };
    }

    const context = await checkTabContext(activeTab.id);
    if (context.fullscreen || context.form_active) {
      // Reporter — sera retenté à la prochaine alarme périodique
      return { success: true, action: 'skip', reason: 'deferred_context' };
    }

    // Récupérer le snoozeCount courant
    const snoozeCount = await getSnoozeCount();

    // Enregistrer la date du nudge et mettre à jour le timestamp
    await setSnoozeCount(snoozeCount); // met à jour last_nudge_date

    // Envoyer le message au content script pour afficher le toast
    await browser.tabs.sendMessage(activeTab.id, {
      module: 'M5',
      action: 'show_update_toast',
      payload: { snooze_count: snoozeCount },
      timestamp: Date.now(),
    });

    // Enregistrer l'événement pour M3
    await storageService.logEvent(
      'M5',
      {
        action: 'shown',
        module_data: { status: 'update_available', snooze_count: snoozeCount },
      },
      cryptoKey,
    );

    return { success: true, action: 'show' };
  } catch (err: unknown) {
    // TACHE-104 / R-M7-08 : classifyError remplace err.message (INV-SEC-02 étendu)
    logger.error('erreur_check_update', { error_code: classifyError(err) });
    return { success: false, action: 'error', reason: 'internal_error' };
  }
}

/**
 * Traite les actions utilisateur sur le toast M5.
 *
 * @param storageService - Service de stockage
 * @param payload        - Payload avec user_action et snooze_count
 * @param cryptoKey      - Clé AES-256-GCM
 * @returns Réponse NudgeResponse
 */
async function handleToastAction(
  storageService: StorageService,
  payload: Record<string, unknown>,
  cryptoKey: CryptoKey,
): Promise<NudgeResponse> {
  const userAction = payload['user_action'];
  const snoozeCount = typeof payload['snooze_count'] === 'number' ? payload['snooze_count'] : 0;

  if (typeof userAction !== 'string') {
    return { success: false, action: 'skip', reason: 'invalid_toast_payload' };
  }

  try {
    if (userAction === 'update_now') {
      // Ouvrir chrome://settings/help (SFD §2.3.1)
      await browser.tabs.create({ url: 'chrome://settings/help' });
      await resetSnoozeCount();
    } else if (userAction === 'remind_4h') {
      // Incrémenter le compteur de snoozés et programmer l'alarme
      const newSnoozeCount = Math.min(snoozeCount + 1, MAX_SNOOZE_COUNT);
      await browser.storage.local.set({ [M5_SNOOZE_COUNT_KEY]: newSnoozeCount });
      await browser.alarms.create(M5_SNOOZE_ALARM, { delayInMinutes: SNOOZE_DELAY_MINUTES });
    } else if (userAction === 'why') {
      // Ouvrir la page d'explication M5
      await browser.tabs.create({
        url: browser.runtime.getURL('pages/static/mise-a-jour-navigateur.html'),
      });
      // Pas de reset snoozeCount (l'utilisateur revient probablement)
    } else if (userAction === 'closed') {
      // Fermeture simple — remettre snoozeCount à 0 (fin du cycle de report)
      await resetSnoozeCount();
    }

    // Enregistrer l'événement dans IndexedDB pour M3
    await storageService.logEvent(
      'M5',
      {
        action: userAction,
        module_data: { snooze_count: snoozeCount },
      },
      cryptoKey,
    );

    return { success: true, action: 'skip' };
  } catch (err: unknown) {
    // TACHE-104 / R-M7-08 : classifyError remplace err.message (INV-SEC-02 étendu)
    logger.error('erreur_toast_action', { error_code: classifyError(err) });
    return { success: false, action: 'error', reason: 'internal_error' };
  }
}

/**
 * Factory du handler M5 pour le Service Worker.
 *
 * Dispatche les messages selon leur action :
 * - 'check_update'  : vérification de mise à jour + déclenchement toast si besoin
 * - 'toast_action'  : traitement de l'interaction utilisateur sur le toast
 *
 * @param storageService - Service de stockage IndexedDB
 * @param cryptoKey      - Clé AES-256-GCM pour le chiffrement
 * @returns Handler conforme à l'interface ModuleHandler
 */
export function createM5Handler(
  storageService: StorageService,
  cryptoKey: CryptoKey,
): ModuleHandler {
  return async (
    msg: NudgeMessage,
    _sender: chrome.runtime.MessageSender,
  ): Promise<NudgeResponse> => {
    if (msg.action === 'toast_action') {
      return handleToastAction(storageService, msg.payload, cryptoKey);
    }

    if (msg.action === 'check_update') {
      return handleCheckUpdate(storageService, cryptoKey);
    }

    return { success: false, action: 'skip', reason: 'unknown_action' };
  };
}

// Exports pour les tests
export {
  getLastNudgeDate,
  getSnoozeCount,
  setSnoozeCount,
  resetSnoozeCount,
  setUpToDateState,
  NUDGE_GRACE_PERIOD_MS,
  MAX_SNOOZE_COUNT,
  M5_LAST_NUDGE_KEY,
  M5_SNOOZE_COUNT_KEY,
};
