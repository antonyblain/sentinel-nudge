/**
 * @file background/services/m3-boot-service.ts
 * @description Service de diagnostics M3 — score cyber-hygiène hebdomadaire.
 *
 * Exception ADR-001 (Option B arbitrée en T-058) :
 * M3 n'implémente PAS initBootM3() complet. Le handler M3 est read-only sur les
 * events IDB — il ne dispose d'aucun état propre à valider/régénérer au boot SW.
 * L'alarme lundi 09h déclenche le calcul du score via AlarmDispatcher.onM3Weekly().
 *
 * Ce service expose :
 * - readM3Diagnostics() : lecture publique de diagnostics.m3
 * - updateM3DiagnosticsOnAlarm() : mise à jour au déclenchement de l'alarme score,
 *   avec check IDB accessible (incident events_store_corrupted si inaccessible).
 *
 * Le check IDB est effectué au déclenchement de l'alarme (pas au boot SW) car
 * c'est le seul moment où M3 accède à IDB (lecture des events pour calcul du score).
 * Un incident events_store_corrupted (severity=error) est émis si IDB est inaccessible.
 *
 * Référence :
 * - ADR-001 SW-BOOT-CONTRACT — section Exceptions (Option B M3)
 * - TACHE-086 (diagnostics.m3, check IDB au déclenchement alarme)
 * - TACHE-058 (arbitrage Option B pour M3)
 */

import { browser } from '@/shared/browser/browser-adapter';
import { createLogger, Logger } from '@/shared/utils/logger';
import type { IncidentService } from '@/background/services/incident-service';
import type { M3Diagnostics } from '@/shared/types/diagnostics';
import { DIAGNOSTICS_M3_KEY, M3_DIAGNOSTICS_DEFAULT } from '@/shared/types/diagnostics';

/** Logger scopé M3BootService — mitigation R-M7-08 / TACHE-083 */
const logger = createLogger('M3BootService');

/**
 * Lit diagnostics.m3 depuis chrome.storage.local.
 *
 * Retourne la valeur par défaut si absente ou corrompue — ne lève jamais d'exception.
 *
 * @returns M3Diagnostics courant ou valeur par défaut
 */
async function readDiagnostics(): Promise<M3Diagnostics> {
  try {
    const result = await browser.storage.local.get([DIAGNOSTICS_M3_KEY]);
    const stored = result[DIAGNOSTICS_M3_KEY];

    if (!stored || typeof stored !== 'object') {
      return { ...M3_DIAGNOSTICS_DEFAULT };
    }

    const raw = stored as Record<string, unknown>;

    // Validation des champs obligatoires — reset si corrompu
    if (typeof raw['ready'] !== 'boolean' || typeof raw['last_boot'] !== 'number') {
      return { ...M3_DIAGNOSTICS_DEFAULT };
    }

    const diag: M3Diagnostics = {
      ready: raw['ready'] as boolean,
      last_boot: raw['last_boot'] as number,
    };

    // Champ last_incident optionnel
    const lastIncident = raw['last_incident'];
    if (lastIncident && typeof lastIncident === 'object') {
      const inc = lastIncident as Record<string, unknown>;
      if (
        inc['type'] === 'events_store_corrupted' &&
        typeof inc['severity'] === 'string' &&
        typeof inc['ts'] === 'number'
      ) {
        diag.last_incident = {
          type: 'events_store_corrupted',
          severity: inc['severity'] as 'info' | 'warn' | 'error',
          ts: inc['ts'] as number,
        };
      }
    }

    return diag;
  } catch {
    return { ...M3_DIAGNOSTICS_DEFAULT };
  }
}

/**
 * Persiste diagnostics.m3 dans chrome.storage.local.
 *
 * Sérialisation JSON-strict : M3Diagnostics ne contient que des types
 * primitifs JSON-compatibles (boolean, number, string) — conforme P-018.
 *
 * @param diagnostics - Objet M3Diagnostics à persister
 */
async function writeDiagnostics(diagnostics: M3Diagnostics): Promise<void> {
  await browser.storage.local.set({ [DIAGNOSTICS_M3_KEY]: diagnostics });
}

/**
 * Lit diagnostics.m3 depuis chrome.storage.local.
 *
 * Point d'accès public pour les consommateurs (popup, tests, TACHE-062).
 * Ne lève jamais d'exception — retourne la valeur par défaut si absente.
 *
 * @returns M3Diagnostics courant ou valeur par défaut
 */
export async function readM3Diagnostics(): Promise<M3Diagnostics> {
  return readDiagnostics();
}

/**
 * Met à jour diagnostics.m3 au déclenchement de l'alarme score M3.
 *
 * Exception ADR-001 (R-ADR-01) :
 * Ce n'est PAS un initBoot complet. M3 n'a pas d'état propre à initialiser
 * au boot SW (le handler est read-only sur les events IDB).
 * Cette fonction est appelée UNIQUEMENT au déclenchement de AlarmDispatcher.onM3Weekly(),
 * juste avant le calcul du score, pour :
 * 1. Marquer ready=false (état conservatif — R-BOOT-03 adapté au contexte alarme)
 * 2. Vérifier l'accessibilité IDB via une transaction légère
 * 3. Si IDB inaccessible → émettre incident events_store_corrupted (error) via incidentService
 * 4. Mettre à jour diagnostics.m3 (ready=true si IDB OK, ready=false si KO)
 *
 * Non bloquant : une exception dans cette fonction ne doit pas empêcher
 * le calcul du score (le handler M3 gère ses propres erreurs).
 *
 * @param incidentService - Service d'incidents partagé (initialisé avant l'appel)
 * @param idbAccessible   - true si IDB a répondu correctement (fourni par le handler M3)
 * @param idbErrorName    - Nom de l'erreur IDB si inaccessible (R-M7-08 : uniquement le nom)
 * @returns M3Diagnostics après mise à jour
 */
export async function updateM3DiagnosticsOnAlarm(
  incidentService: IncidentService,
  idbAccessible: boolean,
  idbErrorName?: string,
): Promise<M3Diagnostics> {
  const alarmTs = Date.now();

  try {
    if (!idbAccessible) {
      // IDB inaccessible au déclenchement de l'alarme score
      const errName = idbErrorName ?? 'UnknownError';

      await incidentService.log('events_store_corrupted', 'error', {
        type: 'events_store_corrupted',
        error_name: errName,
      });

      logger.error('M3BootService: IDB inaccessible au déclenchement alarme score', {
        error_name: errName,
      });

      const failDiag: M3Diagnostics = {
        ready: false,
        last_boot: alarmTs,
        last_incident: {
          type: 'events_store_corrupted',
          severity: 'error',
          ts: alarmTs,
        },
      };
      await writeDiagnostics(failDiag);
      return failDiag;
    }

    // IDB accessible — diagnostics.m3 nominal
    const okDiag: M3Diagnostics = {
      ready: true,
      last_boot: alarmTs,
    };
    await writeDiagnostics(okDiag);

    logger.info('M3BootService: diagnostics.m3 mis à jour (alarme score)', {
      last_boot: alarmTs,
    });

    return okDiag;
  } catch (err: unknown) {
    logger.error('M3BootService: erreur inattendue dans updateM3DiagnosticsOnAlarm', {
      error_name: Logger.errorName(err),
    });

    const failDiag: M3Diagnostics = {
      ready: false,
      last_boot: alarmTs,
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
