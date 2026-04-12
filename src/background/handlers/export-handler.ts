/**
 * @file background/handlers/export-handler.ts
 * @description Handler pour l'export des données RGPD Art. 20.
 *
 * Récupère et déchiffre les données de chaque store IndexedDB
 * pour permettre l'export en JSON depuis la page Options.
 *
 * Les hashes de mots de passe ne sont PAS inclus en valeur —
 * seules les métadonnées (count, oldest, newest) sont retournées.
 *
 * Référence : DAT §8.3 (Droit à la portabilité), TACHE-013
 */

import type { StorageService } from '../storage-service';
import type { NudgeResponse } from '@/shared/types/messages';

/**
 * Crée le handler d'export des données.
 */
export function createExportHandler(storage: StorageService): {
  handleMessage: (action: string) => Promise<NudgeResponse>;
} {
  return {
    async handleMessage(action: string): Promise<NudgeResponse> {
      switch (action) {
        case 'get_all_events': {
          try {
            const events = await storage.getEvents(undefined, 10000);
            return { success: true, action: 'show', data: { events } };
          } catch {
            return { success: false, action: 'error', reason: 'Failed to get events' };
          }
        }

        case 'get_all_scores': {
          try {
            const scores = await storage.getAllWeeklyScores();
            return { success: true, action: 'show', data: { scores } };
          } catch {
            return { success: false, action: 'error', reason: 'Failed to get scores' };
          }
        }

        case 'get_all_quiz_sessions': {
          try {
            const sessions = await storage.getAllQuizSessions();
            return { success: true, action: 'show', data: { sessions } };
          } catch {
            return { success: false, action: 'error', reason: 'Failed to get quiz sessions' };
          }
        }

        case 'get_whitelist': {
          try {
            const whitelist = await storage.getAllWhitelist();
            return { success: true, action: 'show', data: { whitelist } };
          } catch {
            return { success: false, action: 'error', reason: 'Failed to get whitelist' };
          }
        }

        case 'get_password_hash_meta': {
          try {
            const count = await storage.getPasswordHashCount();
            return {
              success: true,
              action: 'show',
              data: { count, oldest: '', newest: '' },
            };
          } catch {
            return {
              success: false,
              action: 'error',
              reason: 'Failed to get password hash meta',
            };
          }
        }

        default:
          return { success: false, action: 'error', reason: `Unknown export action: ${action}` };
      }
    },
  };
}
