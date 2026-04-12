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
 * Référence : SFD §2.6 (M9), §2.2 (M3 composante force mdp), DAT §6.2
 */

import { StorageService } from '@/background/storage-service';
import type { NudgeMessage, NudgeResponse } from '@/shared/types/messages';
import type { ModuleHandler } from '@/background/message-router';

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
 * @param storageService - Service de stockage IndexedDB
 * @param cryptoKey      - Clé AES-256-GCM pour le chiffrement IndexedDB
 * @returns Handler conforme à l'interface ModuleHandler
 */
export function createM9Handler(
  storageService: StorageService,
  cryptoKey: CryptoKey,
): ModuleHandler {
  return async (
    msg: NudgeMessage,
    _sender: chrome.runtime.MessageSender,
  ): Promise<NudgeResponse> => {
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      console.error(`[M9Handler] Échec logEvent: ${message}`);
      return {
        success: false,
        action: 'error',
        reason: 'storage_error',
      };
    }

    return {
      success: true,
      action: 'skip', // M9 ne déclenche pas d'affichage côté SW
    };
  };
}
