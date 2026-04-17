/**
 * @file background/handlers/m9-handler.ts
 * @description Handler service worker pour le module M9 (indicateur de force mot de passe).
 *
 * Reçoit les évaluations de force de mot de passe envoyées par le content script au submit.
 * Stocke le niveau de force dans IndexedDB (store `events`) pour alimenter le score M3.
 *
 * Données stockées :
 * - Le score de force (0-4) — JAMAIS le mot de passe en clair
 * - Le type de saisie (password / passphrase)
 * - L'horodatage
 *
 * Exception ADR-001 (Option B arbitrée — TACHE-089) :
 * M9 n'implémente PAS initBootM9() complet. Ce handler est read-only sur les
 * events IDB (écriture unique au submit). Il ne dispose d'aucun état propre à
 * valider/régénérer au boot SW. Par conséquent :
 * - Aucun appel à initBoot() n'est effectué depuis le SW boot IIFE.
 * - Les diagnostics sont mis à jour à chaque action handler (à la demande).
 * - Les incidents m9_handler_error sont loggés sur erreur de logEvent.
 * Rationale : pas de storage métier critique en bootup pour M9.
 * Référence : ADR-001 SW-BOOT-CONTRACT section Exceptions.
 *
 * Rétro-compatibilité (service-worker.ts) :
 * incidentService est optionnel — si absent, les diagnostics ne sont pas mis à jour.
 * Le paramètre sera rendu obligatoire lorsque service-worker.ts sera mis à jour
 * (hors périmètre TACHE-089 — T-093 en parallèle).
 *
 * Référence : SFD §2.6 (M9), §2.2 (M3 composante force mdp), DAT §6.2
 *             TACHE-089 (diagnostics.m9, Option B)
 */

import { StorageService } from '@/background/storage-service';
import { createLogger, Logger } from '@/shared/utils/logger';
import type { NudgeMessage, NudgeResponse } from '@/shared/types/messages';
import type { ModuleHandler } from '@/background/message-router';
import type { IncidentService } from '@/background/services/incident-service';
import {
  updateM9DiagnosticsOnAction,
  readM9Diagnostics,
} from '@/background/services/m9-boot-service';

/** Logger scopé M9Handler — mitigation R-M7-08 / TACHE-083 */
const logger = createLogger('M9Handler');

/** Payload attendu du content script M9 */
interface M9SubmitPayload {
  /** Score zxcvbn (0-4) */
  score: number;
  /** Type de saisie détecté */
  type: 'password' | 'passphrase';
}

/**
 * Handler M9 pour le Service Worker.
 *
 * Enregistre l'évaluation de force reçue au submit dans le store `events`.
 * Cette donnée est utilisée par ScoreCalculator (M3) pour calculer la composante
 * "Force mots de passe" (0-15 points).
 *
 * Exception ADR-001 (Option B — TACHE-089) :
 * Ce handler est read-only sur les events IDB — pas d'initBoot() au boot SW.
 * Rationale : pas de storage métier critique en bootup pour M9.
 * Les diagnostics m9 sont mis à jour à chaque action via updateM9DiagnosticsOnAction()
 * lorsque incidentService est fourni. Un incident m9_handler_error (severity=error)
 * est émis si logEvent échoue.
 *
 * @param storageService  - Service de stockage IndexedDB
 * @param cryptoKey       - Clé AES-256-GCM pour le chiffrement IndexedDB
 * @param incidentService - Service d'incidents partagé (optionnel — TACHE-089)
 *                          Si absent, les diagnostics.m9 ne sont pas mis à jour.
 * @returns Handler conforme à l'interface ModuleHandler
 */
export function createM9Handler(
  storageService: StorageService,
  cryptoKey: CryptoKey,
  incidentService?: IncidentService,
): ModuleHandler {
  return async (
    msg: NudgeMessage,
    _sender: chrome.runtime.MessageSender,
  ): Promise<NudgeResponse> => {
    // Log diagnostic : tout message M9 recu (R-M7-08 / TACHE-083 — tab_id uniquement)
    logger.info('message recu', { action: msg.action, tab_id: _sender.tab?.id });

    // Validation du payload
    const payload = msg.payload as Partial<M9SubmitPayload>;
    const score = payload.score;
    const type = payload.type;

    // Vérifications de type
    if (typeof score !== 'number' || score < 0 || score > 4) {
      return {
        success: false,
        action: 'skip',
        reason: 'invalid_payload_score',
      };
    }
    if (type !== 'password' && type !== 'passphrase') {
      return {
        success: false,
        action: 'skip',
        reason: 'invalid_payload_type',
      };
    }

    // Enregistrement dans le store events pour M3
    // Pas de domain_hash ici — M9 ne stocke pas de donnée liée au domaine (privacy)
    try {
      await storageService.logEvent(
        'M9',
        {
          module_data: {
            strength_score: score,
            input_type: type,
            // Comptabilisé comme "fort" si score >= 3 (SFD §2.2.3)
            is_strong: score >= 3,
          },
        },
        cryptoKey,
      );

      // Mise à jour diagnostics.m9 — action réussie (Option B, à la demande)
      // Non bloquant. Conditionnel si incidentService fourni.
      if (incidentService) {
        void updateM9DiagnosticsOnAction(incidentService, true);
      }

      return {
        success: true,
        action: 'skip', // M9 ne déclenche pas d'affichage côté SW
      };
    } catch (err: unknown) {
      // R-M7-08 / TACHE-083 : ne pas logger err.message — utiliser Error.name uniquement
      const errName = Logger.errorName(err);
      logger.error('logEvent failed', { error_name: errName });

      // Mise à jour diagnostics.m9 + incident m9_handler_error (TACHE-089)
      // Conditionnel si incidentService fourni.
      if (incidentService) {
        void updateM9DiagnosticsOnAction(incidentService, false, errName);
      }

      return {
        success: false,
        action: 'error',
        reason: 'storage_error',
      };
    }
  };
}

// Exports pour les tests
export { readM9Diagnostics };
