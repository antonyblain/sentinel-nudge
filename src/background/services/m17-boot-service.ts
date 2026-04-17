/**
 * @file background/services/m17-boot-service.ts
 * @description Service de diagnostics M17 — données sensibles presse-papiers.
 *
 * Exception ADR-001 (Option B arbitrée — TACHE-089) :
 * M17 n'implémente PAS initBootM17() complet. Le handler M17 est critique (bypass quota)
 * mais ne dispose d'aucun état propre à valider/régénérer au boot SW.
 *
 * Rationale :
 * - Le seul storage métier M17 est le store events IDB (géré par M3) et
 *   pending_m17_toast (éphémère, TTL 5 min).
 * - pending_m17_toast avec expires_at dépassé est naturellement ignoré par le
 *   content script — aucun nettoyage actif requis au boot SW.
 * - Aligner M17 sur Option B minimise le temps de boot SW.
 *
 * Ce service expose :
 * - readM17Diagnostics()              : lecture publique de diagnostics.m17
 * - updateM17DiagnosticsOnAction()    : mise à jour à chaque appel du handler M17,
 *   avec enregistrement d'incident m17_handler_error si une exception est levée.
 * - writePendingM17Toast()            : écriture du pending intent M17 (R-CLI-01 à 07)
 * - readPendingM17Toast()             : lecture + vérification TTL du pending intent M17
 * - consumePendingM17Toast()          : lecture + suppression atomique (R-CLI-04)
 *
 * Référence :
 * - ADR-001 SW-BOOT-CONTRACT — section Exceptions (Option B M17)
 * - ADR-002 (pending intents cross-lifecycle, R-CLI-01 à 07)
 * - TACHE-089 (diagnostics.m17, incidents m17_handler_error)
 * - TACHE-090 (pending_m17_toast, TTL 5 min, data_type enum strict)
 */

import { browser } from '@/shared/browser/browser-adapter';
import { createLogger, Logger } from '@/shared/utils/logger';
import type { IncidentService } from '@/background/services/incident-service';
import type {
  M17Diagnostics,
  PendingM17Toast,
  PendingM17DataType,
} from '@/shared/types/diagnostics';
import {
  DIAGNOSTICS_M17_KEY,
  M17_DIAGNOSTICS_DEFAULT,
  PENDING_M17_TOAST_KEY,
  PENDING_M17_TOAST_TTL_MS,
} from '@/shared/types/diagnostics';

/** Logger scopé M17BootService — mitigation R-M7-08 / TACHE-083 */
const logger = createLogger('M17BootService');

/** Enum des data_type valides pour pending_m17_toast (R-CLI-07) */
const VALID_M17_DATA_TYPES: ReadonlySet<PendingM17DataType> = new Set(['cb', 'iban', 'ssn']);

// ---------------------------------------------------------------------------
// Diagnostics M17
// ---------------------------------------------------------------------------

/**
 * Lit diagnostics.m17 depuis chrome.storage.local.
 *
 * Retourne la valeur par défaut si absente ou corrompue — ne lève jamais d'exception.
 *
 * @returns M17Diagnostics courant ou valeur par défaut
 */
async function readDiagnostics(): Promise<M17Diagnostics> {
  try {
    const result = await browser.storage.local.get([DIAGNOSTICS_M17_KEY]);
    const stored = result[DIAGNOSTICS_M17_KEY];

    if (!stored || typeof stored !== 'object') {
      return { ...M17_DIAGNOSTICS_DEFAULT };
    }

    const raw = stored as Record<string, unknown>;

    // Validation des champs obligatoires — reset si corrompu
    if (typeof raw['ready'] !== 'boolean' || typeof raw['last_action_ts'] !== 'number') {
      return { ...M17_DIAGNOSTICS_DEFAULT };
    }

    const diag: M17Diagnostics = {
      ready: raw['ready'] as boolean,
      last_action_ts: raw['last_action_ts'] as number,
    };

    // Champ last_incident optionnel
    const lastIncident = raw['last_incident'];
    if (lastIncident && typeof lastIncident === 'object') {
      const inc = lastIncident as Record<string, unknown>;
      if (
        inc['type'] === 'm17_handler_error' &&
        typeof inc['severity'] === 'string' &&
        typeof inc['ts'] === 'number'
      ) {
        diag.last_incident = {
          type: 'm17_handler_error',
          severity: inc['severity'] as 'info' | 'warn' | 'error',
          ts: inc['ts'] as number,
        };
      }
    }

    return diag;
  } catch {
    return { ...M17_DIAGNOSTICS_DEFAULT };
  }
}

/**
 * Persiste diagnostics.m17 dans chrome.storage.local.
 *
 * Sérialisation JSON-strict : M17Diagnostics ne contient que des types
 * primitifs JSON-compatibles (boolean, number, string) — conforme P-018.
 *
 * @param diagnostics - Objet M17Diagnostics à persister
 */
async function writeDiagnostics(diagnostics: M17Diagnostics): Promise<void> {
  await browser.storage.local.set({ [DIAGNOSTICS_M17_KEY]: diagnostics });
}

/**
 * Lit diagnostics.m17 depuis chrome.storage.local.
 *
 * Point d'accès public pour les consommateurs (popup, tests, TACHE-062).
 * Ne lève jamais d'exception — retourne la valeur par défaut si absente.
 *
 * @returns M17Diagnostics courant ou valeur par défaut
 */
export async function readM17Diagnostics(): Promise<M17Diagnostics> {
  return readDiagnostics();
}

/**
 * Met à jour diagnostics.m17 à chaque appel du handler M17.
 *
 * Exception ADR-001 (Option B) :
 * Ce n'est PAS un initBoot complet. M17 n'a pas d'état propre à initialiser
 * au boot SW. Cette fonction est appelée UNIQUEMENT lors de chaque appel au
 * handler M17, après la tentative d'action (logEvent ou storage write), pour :
 * 1. Mettre à jour last_action_ts (INV-M17-01)
 * 2. Si actionSucceeded=true → diagnostics ready=true
 * 3. Si actionSucceeded=false → émettre incident m17_handler_error (error) +
 *    diagnostics ready=false + last_incident mis à jour
 *
 * Non bloquant : une exception dans cette fonction ne doit pas empêcher
 * le handler M17 de retourner sa réponse.
 *
 * @param incidentService  - Service d'incidents partagé
 * @param actionSucceeded  - true si l'action handler a réussi, false si exception levée
 * @param codePath         - Fonction source de l'erreur (R-M7-08 : code_path structuré)
 * @param errorName        - Nom de l'erreur si actionSucceeded=false (R-M7-08)
 * @returns M17Diagnostics après mise à jour
 */
export async function updateM17DiagnosticsOnAction(
  incidentService: IncidentService,
  actionSucceeded: boolean,
  codePath: 'handleSensitiveDataDetected' | 'handleToastAction' = 'handleSensitiveDataDetected',
  errorName?: string,
): Promise<M17Diagnostics> {
  const actionTs = Date.now();

  try {
    if (!actionSucceeded) {
      const errName = errorName ?? 'UnknownError';

      await incidentService.log('m17_handler_error', 'error', {
        type: 'm17_handler_error',
        error_name: errName,
        code_path: codePath,
      });

      logger.error('M17BootService: erreur handler M17', {
        error_name: errName,
        code_path: codePath,
      });

      const failDiag: M17Diagnostics = {
        ready: false,
        last_action_ts: actionTs,
        last_incident: {
          type: 'm17_handler_error',
          severity: 'error',
          ts: actionTs,
        },
      };
      await writeDiagnostics(failDiag);
      return failDiag;
    }

    // Action réussie — diagnostics.m17 nominal
    const okDiag: M17Diagnostics = {
      ready: true,
      last_action_ts: actionTs,
    };
    await writeDiagnostics(okDiag);

    logger.info('M17BootService: diagnostics.m17 mis à jour (action handler)', {
      last_action_ts: actionTs,
      code_path: codePath,
    });

    return okDiag;
  } catch (err: unknown) {
    logger.error('M17BootService: erreur inattendue dans updateM17DiagnosticsOnAction', {
      error_name: Logger.errorName(err),
    });

    const failDiag: M17Diagnostics = {
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

// ---------------------------------------------------------------------------
// Pending M17 toast — ADR-002 R-CLI-01 à 07 (TACHE-090)
// ---------------------------------------------------------------------------

/**
 * Écrit un pending_m17_toast dans chrome.storage.local.
 *
 * Conforme ADR-002 R-CLI-01 à 07 :
 * - R-CLI-03 : expires_at calculé à partir de PENDING_M17_TOAST_TTL_MS
 * - R-CLI-07 : data_type est un enum strict — validation avant écriture
 * - R-002 : JAMAIS la valeur collée — uniquement le type (data_type)
 *
 * @param dataType - Type de donnée sensible détectée (enum strict PendingM17DataType)
 * @param tabId    - Identifiant de l'onglet source (optionnel — R-CLI-06)
 * @throws Ne lève jamais — les erreurs sont loguées et ignorées (non bloquant)
 */
export async function writePendingM17Toast(
  dataType: PendingM17DataType,
  tabId?: number,
): Promise<void> {
  // Validation défensive de l'enum (R-CLI-07) — guard pour les appels internes
  if (!VALID_M17_DATA_TYPES.has(dataType)) {
    logger.error('writePendingM17Toast: data_type invalide ignoré', { data_type: dataType });
    return;
  }

  const payload: PendingM17Toast = {
    data_type: dataType,
    expires_at: Date.now() + PENDING_M17_TOAST_TTL_MS,
    ...(tabId !== undefined ? { tab_id: tabId } : {}),
  };

  try {
    await browser.storage.local.set({ [PENDING_M17_TOAST_KEY]: payload });
    logger.info('writePendingM17Toast: pending_m17_toast écrit', {
      data_type: dataType,
      expires_at: payload.expires_at,
    });
  } catch (err: unknown) {
    // Non bloquant — le toast ne sera simplement pas affiché
    logger.error('writePendingM17Toast: erreur écriture storage', {
      error_name: Logger.errorName(err),
    });
  }
}

/**
 * Lit pending_m17_toast depuis chrome.storage.local avec vérification du TTL.
 *
 * Conforme ADR-002 R-CLI-03 (expires_at) et R-CLI-07 (data_type enum strict).
 * Supprime automatiquement l'entrée si le TTL est dépassé (purge passive).
 *
 * @returns PendingM17Toast valide, ou null si absent/expiré/corrompu
 */
export async function readPendingM17Toast(): Promise<PendingM17Toast | null> {
  try {
    const result = await browser.storage.local.get([PENDING_M17_TOAST_KEY]);
    const stored = result[PENDING_M17_TOAST_KEY];

    if (!stored || typeof stored !== 'object') {
      return null;
    }

    const raw = stored as Record<string, unknown>;

    // Validation de la shape (R-CLI-07 + R-CLI-03)
    if (
      typeof raw['data_type'] !== 'string' ||
      !VALID_M17_DATA_TYPES.has(raw['data_type'] as PendingM17DataType) ||
      typeof raw['expires_at'] !== 'number'
    ) {
      // Shape invalide : nettoyer silencieusement
      try {
        await browser.storage.local.remove(PENDING_M17_TOAST_KEY);
      } catch {
        // Ignorer l'erreur de suppression
      }
      return null;
    }

    const toast: PendingM17Toast = {
      data_type: raw['data_type'] as PendingM17DataType,
      expires_at: raw['expires_at'] as number,
      ...(typeof raw['tab_id'] === 'number' ? { tab_id: raw['tab_id'] } : {}),
    };

    // Vérification TTL — R-CLI-03
    if (Date.now() > toast.expires_at) {
      // Toast expiré : purge passive
      try {
        await browser.storage.local.remove(PENDING_M17_TOAST_KEY);
      } catch {
        // Ignorer l'erreur de suppression
      }
      logger.info('readPendingM17Toast: toast expiré supprimé', {
        expires_at: toast.expires_at,
        overdue_ms: Date.now() - toast.expires_at,
      });
      return null;
    }

    return toast;
  } catch (err: unknown) {
    logger.error('readPendingM17Toast: erreur lecture storage', {
      error_name: Logger.errorName(err),
    });
    return null;
  }
}

/**
 * Consomme pending_m17_toast : lecture + suppression atomique (R-CLI-04).
 *
 * La consommation = suppression garantit qu'un toast ne peut être affiché
 * qu'une seule fois (double consommation empêchée — R-ADR-04).
 *
 * Conforme ADR-002 R-CLI-04 : après lecture, la clé est immédiatement supprimée.
 * Si la suppression échoue, le toast est quand même retourné (best-effort).
 *
 * @returns PendingM17Toast valide consommé, ou null si absent/expiré/corrompu
 */
export async function consumePendingM17Toast(): Promise<PendingM17Toast | null> {
  const toast = await readPendingM17Toast();
  if (toast === null) {
    return null;
  }

  // R-CLI-04 : suppression immédiate après lecture (consommation atomique best-effort)
  try {
    await browser.storage.local.remove(PENDING_M17_TOAST_KEY);
    logger.info('consumePendingM17Toast: toast consommé et supprimé', {
      data_type: toast.data_type,
    });
  } catch (err: unknown) {
    // Non bloquant — le toast est retourné même si la suppression échoue
    logger.error('consumePendingM17Toast: erreur suppression storage', {
      error_name: Logger.errorName(err),
    });
  }

  return toast;
}

// Export pour les tests
export { VALID_M17_DATA_TYPES };
