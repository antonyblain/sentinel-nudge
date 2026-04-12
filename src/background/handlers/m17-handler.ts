/**
 * @file background/handlers/m17-handler.ts
 * @description Handler service worker pour le module M17 (données sensibles presse-papiers).
 *
 * Reçoit les notifications de détection de données sensibles envoyées par paste-detector.ts.
 * M17 est un module critique (CRITICAL_MODULES) : bypass quota automatique par MessageRouter.
 *
 * Algorithme principal (action 'sensitive_data_detected') :
 * 1. Validation du payload (type valide parmi credit_card/iban/api_key)
 * 2. M17 est critique → le quota est géré par MessageRouter (bypass automatique)
 * 3. Enregistrement de l'événement avec le type (jamais la valeur)
 * 4. Réponse 'show' pour afficher le toast
 *
 * Action 'toast_action' (retour du content script après interaction utilisateur) :
 * - 'clipboard_cleared'      : presse-papiers vidé avec succès
 * - 'acknowledged'           : utilisateur a pris connaissance
 * - 'learn_more'             : ouvre la page d'explication M17
 * - 'clipboard_clear_failed' : échec de la nullification (permissions refusées)
 *
 * Sécurité (D-SEC-002) :
 * - Aucune valeur sensible n'est stockée — uniquement le type
 * - Le payload ne contient jamais le contenu du presse-papiers
 *
 * Référence : SFD §2.7 (M17), DAT §9.4 (D-SEC-002), §6.2 (flux M17)
 */

import { browser } from '@/shared/browser/browser-adapter';
import { StorageService } from '@/background/storage-service';
import type { NudgeMessage, NudgeResponse } from '@/shared/types/messages';
import type { ModuleHandler } from '@/background/message-router';

/** Types de données sensibles reconnus */
const VALID_DATA_TYPES = new Set(['credit_card', 'iban', 'api_key']);

/** Actions valides renvoyées par le toast M17 */
const VALID_TOAST_ACTIONS = new Set([
  'clipboard_cleared',
  'acknowledged',
  'learn_more',
  'clipboard_clear_failed',
]);

/** Payload attendu pour l'action 'sensitive_data_detected' */
interface M17DetectionPayload {
  /** Type primaire de donnée détectée */
  type: 'credit_card' | 'iban' | 'api_key';
  /** Tous les types détectés (peut contenir plusieurs types) */
  all_types?: string[];
}

/**
 * Traite la détection de données sensibles (action 'sensitive_data_detected').
 *
 * Le handler décide d'afficher le toast en fonction du quota (géré en amont
 * par MessageRouter — M17 est critique donc toujours autorisé).
 *
 * @param storageService - Service de stockage IndexedDB
 * @param payload        - Payload validé (type de donnée)
 * @param cryptoKey      - Clé AES-256-GCM pour le chiffrement des événements
 * @returns Réponse NudgeResponse avec action 'show' ou 'skip'
 */
async function handleSensitiveDataDetected(
  storageService: StorageService,
  payload: M17DetectionPayload,
  cryptoKey: CryptoKey,
): Promise<NudgeResponse> {
  const { type, all_types } = payload;

  try {
    // Enregistrement de l'événement de détection pour M3
    // Seul le type est stocké — jamais la valeur (D-SEC-002)
    await storageService.logEvent(
      'M17',
      {
        action: 'detected',
        module_data: {
          data_type: type,
          all_types: all_types ?? [type],
          nudge_shown: true,
        },
      },
      cryptoKey,
    );

    return {
      success: true,
      action: 'show',
      data: { data_type: type },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error(`[M17Handler] Erreur sensitive_data_detected: ${message}`);
    return { success: false, action: 'error', reason: 'internal_error' };
  }
}

/**
 * Traite les actions utilisateur sur le toast M17.
 *
 * @param storageService - Service de stockage IndexedDB
 * @param payload        - Payload avec l'action et le type de donnée
 * @param cryptoKey      - Clé AES-256-GCM
 * @returns Réponse NudgeResponse
 */
async function handleToastAction(
  storageService: StorageService,
  payload: Record<string, unknown>,
  cryptoKey: CryptoKey,
): Promise<NudgeResponse> {
  const user_action = payload['user_action'];
  const data_type = payload['data_type'];

  if (typeof user_action !== 'string' || !VALID_TOAST_ACTIONS.has(user_action)) {
    return { success: false, action: 'skip', reason: 'invalid_toast_action' };
  }

  try {
    // Enregistrement de l'action utilisateur pour M3
    await storageService.logEvent(
      'M17',
      {
        action: user_action,
        module_data: {
          data_type: typeof data_type === 'string' ? data_type : 'unknown',
          nudge_shown: true,
        },
      },
      cryptoKey,
    );

    // Ouverture de la page d'explication si "learn_more"
    if (user_action === 'learn_more') {
      await browser.tabs.create({
        url: browser.runtime.getURL('pages/static/donnees-sensibles-presse-papiers.html'),
      });
    }

    return { success: true, action: 'skip' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error(`[M17Handler] Erreur toast_action: ${message}`);
    return { success: false, action: 'error', reason: 'internal_error' };
  }
}

/**
 * Handler M17 pour le Service Worker.
 *
 * Dispatche les messages selon leur action :
 * - 'sensitive_data_detected' : enregistrement + instruction d'affichage toast
 * - 'toast_action'            : traitement de l'interaction utilisateur
 *
 * @param storageService - Service de stockage IndexedDB
 * @param cryptoKey      - Clé AES-256-GCM pour le chiffrement
 * @returns Handler conforme à l'interface ModuleHandler
 */
export function createM17Handler(
  storageService: StorageService,
  cryptoKey: CryptoKey,
): ModuleHandler {
  return async (
    msg: NudgeMessage,
    _sender: chrome.runtime.MessageSender,
  ): Promise<NudgeResponse> => {
    // Action 'toast_action' (retour UI après interaction utilisateur)
    if (msg.action === 'toast_action') {
      return handleToastAction(storageService, msg.payload, cryptoKey);
    }

    // Action principale : 'sensitive_data_detected'
    if (msg.action !== 'sensitive_data_detected') {
      return { success: false, action: 'skip', reason: 'unknown_action' };
    }

    // Validation du payload
    const payload = msg.payload as Partial<M17DetectionPayload>;
    const type = payload.type;

    if (typeof type !== 'string' || !VALID_DATA_TYPES.has(type)) {
      return { success: false, action: 'skip', reason: 'invalid_data_type' };
    }

    return handleSensitiveDataDetected(
      storageService,
      {
        type: type as 'credit_card' | 'iban' | 'api_key',
        all_types: Array.isArray(payload.all_types) ? payload.all_types : [type],
      },
      cryptoKey,
    );
  };
}

// Exports pour les tests
export { VALID_DATA_TYPES, VALID_TOAST_ACTIONS };
