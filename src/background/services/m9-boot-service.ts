/**
 * @file background/services/m9-boot-service.ts
 * @description Service de diagnostics M9 — indicateur de force mot de passe.
 *
 * Exception ADR-001 (Option B arbitrée — TACHE-089) :
 * M9 n'implémente PAS initBootM9() complet. Le handler M9 est read-only sur les
 * events IDB (écriture unique au submit) — il ne dispose d'aucun état propre à
 * valider/régénérer au boot SW.
 *
 * Rationale :
 * - Le seul storage métier M9 est le store events IDB, géré et vérifié par M3.
 * - Aucune donnée M9 dans chrome.storage.local ne requiert de vérification au boot.
 * - Aligner M9 sur Option B (même pattern que M3) minimise le temps de boot SW
 *   et évite d'introduire une dépendance circulaire (M9 → IDB → M3).
 *
 * Ce service expose :
 * - readM9Diagnostics()             : lecture publique de diagnostics.m9
 * - updateM9DiagnosticsOnAction()   : mise à jour à chaque appel du handler M9,
 *   avec enregistrement d'incident m9_handler_error si une exception est levée.
 *
 * Référence :
 * - ADR-001 SW-BOOT-CONTRACT — section Exceptions (Option B M9)
 * - TACHE-089 (diagnostics.m9, incidents m9_handler_error)
 */

import { browser } from '@/shared/browser/browser-adapter';
import { createLogger, Logger } from '@/shared/utils/logger';
import type { IncidentService } from '@/background/services/incident-service';
import type { M9Diagnostics } from '@/shared/types/diagnostics';
import { DIAGNOSTICS_M9_KEY, M9_DIAGNOSTICS_DEFAULT } from '@/shared/types/diagnostics';

/** Logger scopé M9BootService — mitigation R-M7-08 / TACHE-083 */
const logger = createLogger('M9BootService');

/**
 * Lit diagnostics.m9 depuis chrome.storage.local.
 *
 * Retourne la valeur par défaut si absente ou corrompue — ne lève jamais d'exception.
 *
 * @returns M9Diagnostics courant ou valeur par défaut
 */
async function readDiagnostics(): Promise<M9Diagnostics> {
  try {
    const result = await browser.storage.local.get([DIAGNOSTICS_M9_KEY]);
    const stored = result[DIAGNOSTICS_M9_KEY];

    if (!stored || typeof stored !== 'object') {
      return { ...M9_DIAGNOSTICS_DEFAULT };
    }

    const raw = stored as Record<string, unknown>;

    // Validation des champs obligatoires — reset si corrompu
    if (typeof raw['ready'] !== 'boolean' || typeof raw['last_action_ts'] !== 'number') {
      return { ...M9_DIAGNOSTICS_DEFAULT };
    }

    const diag: M9Diagnostics = {
      ready: raw['ready'] as boolean,
      last_action_ts: raw['last_action_ts'] as number,
    };

    // Champ last_incident optionnel
    const lastIncident = raw['last_incident'];
    if (lastIncident && typeof lastIncident === 'object') {
      const inc = lastIncident as Record<string, unknown>;
      if (
        inc['type'] === 'm9_handler_error' &&
        typeof inc['severity'] === 'string' &&
        typeof inc['ts'] === 'number'
      ) {
        diag.last_incident = {
          type: 'm9_handler_error',
          severity: inc['severity'] as 'info' | 'warn' | 'error',
          ts: inc['ts'] as number,
        };
      }
    }

    return diag;
  } catch {
    return { ...M9_DIAGNOSTICS_DEFAULT };
  }
}

/**
 * Persiste diagnostics.m9 dans chrome.storage.local.
 *
 * Sérialisation JSON-strict : M9Diagnostics ne contient que des types
 * primitifs JSON-compatibles (boolean, number, string) — conforme P-018.
 *
 * @param diagnostics - Objet M9Diagnostics à persister
 */
async function writeDiagnostics(diagnostics: M9Diagnostics): Promise<void> {
  await browser.storage.local.set({ [DIAGNOSTICS_M9_KEY]: diagnostics });
}

/**
 * Lit diagnostics.m9 depuis chrome.storage.local.
 *
 * Point d'accès public pour les consommateurs (popup, tests, TACHE-062).
 * Ne lève jamais d'exception — retourne la valeur par défaut si absente.
 *
 * @returns M9Diagnostics courant ou valeur par défaut
 */
export async function readM9Diagnostics(): Promise<M9Diagnostics> {
  return readDiagnostics();
}

/**
 * Met à jour diagnostics.m9 à chaque appel du handler M9.
 *
 * Exception ADR-001 (Option B) :
 * Ce n'est PAS un initBoot complet. M9 n'a pas d'état propre à initialiser
 * au boot SW (le handler est read-only sur les events IDB).
 * Cette fonction est appelée UNIQUEMENT lors de chaque appel au handler M9,
 * après la tentative de logEvent, pour :
 * 1. Mettre à jour last_action_ts (INV-M9-01)
 * 2. Si actionSucceeded=true → diagnostics ready=true
 * 3. Si actionSucceeded=false → émettre incident m9_handler_error (error) +
 *    diagnostics ready=false + last_incident mis à jour
 *
 * Non bloquant : une exception dans cette fonction ne doit pas empêcher
 * le handler M9 de retourner sa réponse.
 *
 * @param incidentService  - Service d'incidents partagé
 * @param actionSucceeded  - true si logEvent IDB a réussi, false si exception levée
 * @param errorName        - Nom de l'erreur si actionSucceeded=false (R-M7-08 : uniquement le nom)
 * @returns M9Diagnostics après mise à jour
 */
export async function updateM9DiagnosticsOnAction(
  incidentService: IncidentService,
  actionSucceeded: boolean,
  errorName?: string,
): Promise<M9Diagnostics> {
  const actionTs = Date.now();

  try {
    if (!actionSucceeded) {
      const errName = errorName ?? 'UnknownError';

      await incidentService.log('m9_handler_error', 'error', {
        type: 'm9_handler_error',
        error_name: errName,
      });

      logger.error('M9BootService: erreur handler M9 — logEvent IDB inaccessible', {
        error_name: errName,
      });

      const failDiag: M9Diagnostics = {
        ready: false,
        last_action_ts: actionTs,
        last_incident: {
          type: 'm9_handler_error',
          severity: 'error',
          ts: actionTs,
        },
      };
      await writeDiagnostics(failDiag);
      return failDiag;
    }

    // Action réussie — diagnostics.m9 nominal
    const okDiag: M9Diagnostics = {
      ready: true,
      last_action_ts: actionTs,
    };
    await writeDiagnostics(okDiag);

    logger.info('M9BootService: diagnostics.m9 mis à jour (action handler)', {
      last_action_ts: actionTs,
    });

    return okDiag;
  } catch (err: unknown) {
    logger.error('M9BootService: erreur inattendue dans updateM9DiagnosticsOnAction', {
      error_name: Logger.errorName(err),
    });

    const failDiag: M9Diagnostics = {
      ready: false,
      last_action_ts: actionTs,
    };
    // Tentative d'écriture best-effort — ne pas propager l'exception
    try {
      await writeDiagnostics(failDiag);
    } catch {
      // Ignorer l'erreur d'écriture — storage inaccessible
    }

    return failDiag;
  }
}
