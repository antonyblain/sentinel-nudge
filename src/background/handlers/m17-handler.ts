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
 * 4. Écriture de pending_m17_toast (cross-lifecycle — ADR-002 R-CLI-01 à 07)
 * 5. Réponse 'show' pour afficher le toast
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
 * Exception ADR-001 (Option B arbitrée — TACHE-089) :
 * M17 n'implémente PAS initBootM17() complet. Ce handler est critique mais ne
 * dispose d'aucun état propre à valider/régénérer au boot SW. Par conséquent :
 * - Aucun appel à initBoot() depuis le SW boot IIFE.
 * - Les diagnostics sont mis à jour à chaque action handler (à la demande).
 * - Les incidents m17_handler_error sont loggés sur erreur.
 * Rationale : pas de storage métier critique en bootup pour M17.
 * Référence : ADR-001 SW-BOOT-CONTRACT section Exceptions.
 *
 * Rétro-compatibilité (service-worker.ts) :
 * incidentService est optionnel — si absent, les diagnostics ne sont pas mis à jour.
 * Le paramètre sera rendu obligatoire lorsque service-worker.ts sera mis à jour
 * (hors périmètre TACHE-089 — T-093 en parallèle).
 *
 * Référence : SFD §2.7 (M17), DAT §9.4 (D-SEC-002), §6.2 (flux M17)
 *             ADR-002 (R-CLI-01 à 07 — pending_m17_toast)
 *             TACHE-089 (diagnostics.m17, Option B)
 *             TACHE-090 (pending_m17_toast cross-lifecycle)
 */

import { browser } from '@/shared/browser/browser-adapter';
import { StorageService } from '@/background/storage-service';
import { createLogger, Logger } from '@/shared/utils/logger';
import type { NudgeMessage, NudgeResponse } from '@/shared/types/messages';
import type { ModuleHandler } from '@/background/message-router';
import type { IncidentService } from '@/background/services/incident-service';
import type { PendingM17DataType } from '@/shared/types/diagnostics';
import {
  updateM17DiagnosticsOnAction,
  readM17Diagnostics,
  writePendingM17Toast,
} from '@/background/services/m17-boot-service';

/** Logger scopé M17Handler — mitigation R-M7-08 / TACHE-083 */
const logger = createLogger('M17Handler');

/**
 * Mapping des types M17 du protocole de détection vers l'enum strict PendingM17DataType.
 *
 * Le protocole content script utilise 'credit_card', 'iban', 'api_key'.
 * pending_m17_toast utilise l'enum court 'cb', 'iban', 'ssn' (R-CLI-07).
 * 'api_key' n'est pas mappé vers pending_m17_toast (pas de toast cross-lifecycle
 * pour les clés API — le toast direct suffit).
 */
const DETECTION_TYPE_TO_PENDING: Record<string, PendingM17DataType | undefined> = {
  credit_card: 'cb',
  iban: 'iban',
  // api_key : pas de pending toast cross-lifecycle (toast direct suffisant)
  api_key: undefined,
  ssn: 'ssn',
};

/** Types de données sensibles reconnus par le protocole content script */
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
 * Exception ADR-001 (Option B — TACHE-089) :
 * Ce handler est read-only sur les events IDB — pas d'initBoot() au boot SW.
 * Rationale : pas de storage métier critique en bootup pour M17.
 * Les diagnostics m17 sont mis à jour à chaque action via updateM17DiagnosticsOnAction().
 *
 * @param storageService  - Service de stockage IndexedDB
 * @param payload         - Payload validé (type de donnée)
 * @param cryptoKey       - Clé AES-256-GCM pour le chiffrement des événements
 * @param incidentService - Service d'incidents partagé (optionnel — TACHE-089)
 * @param tabId           - Identifiant de l'onglet source (optionnel, R-CLI-06)
 * @returns Réponse NudgeResponse avec action 'show' ou 'skip'
 */
async function handleSensitiveDataDetected(
  storageService: StorageService,
  payload: M17DetectionPayload,
  cryptoKey: CryptoKey,
  incidentService: IncidentService | undefined,
  tabId?: number,
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

    // Écriture du pending_m17_toast si data_type mappable (R-CLI-01 à 07 — TACHE-090)
    // api_key : pas de pending toast (toast direct via réponse 'show' suffit)
    const pendingDataType = DETECTION_TYPE_TO_PENDING[type];
    if (pendingDataType !== undefined) {
      // Non bloquant — une erreur d'écriture pending ne bloque pas la réponse
      void writePendingM17Toast(pendingDataType, tabId);
    }

    // Mise à jour diagnostics.m17 — action réussie (Option B, à la demande)
    if (incidentService) {
      void updateM17DiagnosticsOnAction(incidentService, true, 'handleSensitiveDataDetected');
    }

    return {
      success: true,
      action: 'show',
      data: { data_type: type },
    };
  } catch (err: unknown) {
    // R-M7-08 / TACHE-083 : ne pas logger err.message — utiliser Error.name uniquement
    const errName = Logger.errorName(err);
    logger.error('Erreur sensitive_data_detected', { error_name: errName });

    // Mise à jour diagnostics.m17 + incident m17_handler_error (TACHE-089)
    if (incidentService) {
      void updateM17DiagnosticsOnAction(
        incidentService,
        false,
        'handleSensitiveDataDetected',
        errName,
      );
    }

    return { success: false, action: 'error', reason: 'internal_error' };
  }
}

/**
 * Traite les actions utilisateur sur le toast M17.
 *
 * Exception ADR-001 (Option B — TACHE-089) :
 * Ce handler est read-only sur les events IDB — pas d'initBoot() au boot SW.
 * Les diagnostics m17 sont mis à jour à chaque action via updateM17DiagnosticsOnAction().
 *
 * @param storageService  - Service de stockage IndexedDB
 * @param payload         - Payload avec l'action et le type de donnée
 * @param cryptoKey       - Clé AES-256-GCM
 * @param incidentService - Service d'incidents partagé (optionnel — TACHE-089)
 * @returns Réponse NudgeResponse
 */
async function handleToastAction(
  storageService: StorageService,
  payload: Record<string, unknown>,
  cryptoKey: CryptoKey,
  incidentService: IncidentService | undefined,
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

    // Mise à jour diagnostics.m17 — action réussie
    if (incidentService) {
      void updateM17DiagnosticsOnAction(incidentService, true, 'handleToastAction');
    }

    return { success: true, action: 'skip' };
  } catch (err: unknown) {
    // R-M7-08 / TACHE-083 : ne pas logger err.message — utiliser Error.name uniquement
    const errName = Logger.errorName(err);
    logger.error('Erreur toast_action', { error_name: errName });

    // Mise à jour diagnostics.m17 + incident m17_handler_error (TACHE-089)
    if (incidentService) {
      void updateM17DiagnosticsOnAction(incidentService, false, 'handleToastAction', errName);
    }

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
 * Exception ADR-001 (Option B — TACHE-089) :
 * Ce handler est read-only sur les events IDB — pas d'initBoot() au boot SW.
 * Rationale : pas de storage métier critique en bootup pour M17.
 *
 * @param storageService  - Service de stockage IndexedDB
 * @param cryptoKey       - Clé AES-256-GCM pour le chiffrement
 * @param incidentService - Service d'incidents partagé (optionnel — TACHE-089)
 *                          Si absent, les diagnostics.m17 ne sont pas mis à jour.
 * @returns Handler conforme à l'interface ModuleHandler
 */
export function createM17Handler(
  storageService: StorageService,
  cryptoKey: CryptoKey,
  incidentService?: IncidentService,
): ModuleHandler {
  return async (
    msg: NudgeMessage,
    _sender: chrome.runtime.MessageSender,
  ): Promise<NudgeResponse> => {
    // Log diagnostic : tout message M17 recu (R-M7-08 / TACHE-083 — tab_id uniquement)
    logger.info('message recu', { action: msg.action, tab_id: _sender.tab?.id });

    // Action 'toast_action' (retour UI après interaction utilisateur)
    if (msg.action === 'toast_action') {
      return handleToastAction(storageService, msg.payload, cryptoKey, incidentService);
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
      incidentService,
      _sender.tab?.id,
    );
  };
}

// Exports pour les tests
export { VALID_DATA_TYPES, VALID_TOAST_ACTIONS, readM17Diagnostics };
