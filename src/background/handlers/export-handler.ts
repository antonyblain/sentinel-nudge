/**
 * @file background/handlers/export-handler.ts
 * @description Handler EXPORT pour le service worker — export des données RGPD Art. 20.
 *
 * Expose cinq actions dispatchées par le MessageRouter (module 'EXPORT') :
 *
 * - `get_all_events`        — Tous les événements de nudge déchiffrés (90 derniers jours)
 * - `get_all_quiz_sessions` — Toutes les sessions quiz brutes (champs en clair exportables)
 * - `get_whitelist`         — Toutes les entrées whitelist (domain_hash, module, added_at)
 * - `get_all_whitelist_entries` — Alias T-042 : entrées whitelist IDB pour la fusion portabilité
 *                                 (la fusion avec chrome.storage.local est effectuée côté options.ts)
 * - `get_password_hash_meta`    — Métadonnées agrégées des hashes mots de passe (count, oldest, newest)
 *                                 Les hashes eux-mêmes ne sont JAMAIS exportés (NC-DPO-01).
 *
 * Sécurité :
 * - Les erreurs techniques ne sont pas exposées au client (raison générique 'internal_error').
 * - Les hashes de mots de passe ne transitent jamais dans la réponse (NC-DPO-01).
 *
 * Référence : DAT §8.3 (Droit à la portabilité), SFD §3.4 (Section Données), TACHE-013, T-042
 */

import type { StorageService } from '../storage-service';
import type { NudgeMessage, NudgeResponse } from '@/shared/types/messages';
import type { ModuleHandler } from '@/background/message-router';

/**
 * Factory du handler EXPORT pour le Service Worker.
 *
 * Reçoit la clé de chiffrement pour déchiffrer les événements à la volée,
 * conformément à la politique de non-persistance des données en clair (D-SEC-004).
 *
 * @param storage   - Service de stockage IndexedDB
 * @param cryptoKey - Clé AES-256-GCM active (pour déchiffrement des events)
 * @returns Handler conforme à l'interface ModuleHandler
 */
export function createExportHandler(storage: StorageService, cryptoKey: CryptoKey): ModuleHandler {
  return async (
    msg: NudgeMessage,
    _sender: chrome.runtime.MessageSender,
  ): Promise<NudgeResponse> => {
    switch (msg.action) {
      case 'get_all_events': {
        try {
          // Tous les événements depuis l'origine (since = 0) pour tous les modules
          const events = await storage.getEvents(null, 0, cryptoKey);
          return {
            success: true,
            action: 'show',
            data: { events },
          };
        } catch {
          return {
            success: false,
            action: 'error',
            reason: 'internal_error',
          };
        }
      }

      case 'get_all_quiz_sessions': {
        try {
          const sessions = await storage.getAllQuizSessions();
          return {
            success: true,
            action: 'show',
            data: { sessions },
          };
        } catch {
          return {
            success: false,
            action: 'error',
            reason: 'internal_error',
          };
        }
      }

      case 'get_whitelist': {
        try {
          const whitelist = await storage.getAllWhitelist();
          return {
            success: true,
            action: 'show',
            data: { whitelist },
          };
        } catch {
          return {
            success: false,
            action: 'error',
            reason: 'internal_error',
          };
        }
      }

      // T-042 : alias dédié pour la fusion whitelist (Art. 20 RGPD — portabilité).
      // Retourne les entrées IDB uniquement ; la fusion avec chrome.storage.local['m2_whitelist']
      // est effectuée côté options.ts dans handleExport() (accès direct à chrome.storage.local).
      case 'get_all_whitelist_entries': {
        try {
          const whitelist = await storage.getAllWhitelist();
          return {
            success: true,
            action: 'show',
            data: { whitelist },
          };
        } catch {
          return {
            success: false,
            action: 'error',
            reason: 'internal_error',
          };
        }
      }

      case 'get_password_hash_meta': {
        // NC-DPO-01 : seules les métadonnées agrégées sont retournées — jamais les hashes
        try {
          const meta = await storage.getPasswordHashMeta();
          return {
            success: true,
            action: 'show',
            data: {
              count: meta.count,
              oldest: meta.oldest,
              newest: meta.newest,
            },
          };
        } catch {
          return {
            success: false,
            action: 'error',
            reason: 'internal_error',
          };
        }
      }

      default:
        return {
          success: false,
          action: 'error',
          reason: `unknown_export_action:${msg.action}`,
        };
    }
  };
}
