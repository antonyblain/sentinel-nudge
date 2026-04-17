/**
 * @file background/services/m5-boot-service.ts
 * @description Service de boot M5 — contrôle d'intégrité du compteur de snoozes navigateur.
 *
 * Implémente ADR-001 SW-BOOT-CONTRACT (R-BOOT-01 à R-BOOT-04) pour le module M5
 * — Option A arbitrée en T-058 (initBoot complet).
 *
 * Séquence de boot en 3 étapes :
 *   1. Lire   — charger m5_snooze_count depuis chrome.storage.local
 *   2. Valider — vérifier que la valeur est un nombre >= 0
 *   3. Logger  — mettre à jour diagnostics.m5 + émettre incident si corrompu
 *
 * Pattern pending_m5_update_reminder (R-CLI-01 à R-CLI-07 de ADR-002) :
 * Le pending intent M5 est stocké sous la clé `pending_m5_update_reminder` avec
 * un payload JSON-strict incluant `expires_at` (R-CLI-03, TTL 30 minutes).
 * Ce pattern remplace tout stockage ad-hoc de timestamp brut pour les nudges M5
 * non encore présentés.
 *
 * Invariants :
 * - INV-M5-01 : diagnostics.m5.last_boot_ts mis à jour à chaque boot
 * - INV-M5-02 : snooze_count >= 0 après boot (réinitialisation à 0 si corrompu)
 *
 * Référence : ADR-001 (SW-BOOT-CONTRACT), ADR-002 (R-CLI-01 à R-CLI-07), TACHE-087
 */

import { browser } from '@/shared/browser/browser-adapter';
import { createLogger, Logger } from '@/shared/utils/logger';
import type { IncidentService } from '@/background/services/incident-service';
import type { M5Diagnostics } from '@/shared/types/diagnostics';
import {
  DIAGNOSTICS_M5_KEY,
  M5_SNOOZE_COUNT_STORAGE_KEY,
  M5_DIAGNOSTICS_DEFAULT,
} from '@/shared/types/diagnostics';

/** Logger scopé M5BootService — mitigation R-M7-08 / TACHE-083 */
const logger = createLogger('M5BootService');

/**
 * Valide qu'une valeur est un compteur de snoozes valide.
 *
 * Critères :
 * - Doit être un nombre (typeof number)
 * - Doit être >= 0
 * - Doit être un entier fini
 *
 * @param value - Valeur à valider (provenant de chrome.storage.local)
 * @returns true si la valeur est un compteur de snoozes valide
 */
function isValidSnoozeCount(value: unknown): value is number {
  return typeof value === 'number' && isFinite(value) && value >= 0 && Number.isInteger(value);
}

/**
 * Lit diagnostics.m5 depuis chrome.storage.local.
 *
 * Retourne la valeur par défaut si absente ou corrompue — ne lève jamais d'exception.
 *
 * @returns M5Diagnostics courant ou valeur par défaut
 */
async function readDiagnostics(): Promise<M5Diagnostics> {
  try {
    const result = await browser.storage.local.get([DIAGNOSTICS_M5_KEY]);
    const stored = result[DIAGNOSTICS_M5_KEY];

    if (!stored || typeof stored !== 'object') {
      return { ...M5_DIAGNOSTICS_DEFAULT };
    }

    const raw = stored as Record<string, unknown>;

    // Validation des champs obligatoires — reset si corrompu
    if (
      typeof raw['ready'] !== 'boolean' ||
      typeof raw['last_boot_ts'] !== 'number' ||
      typeof raw['snooze_count'] !== 'number'
    ) {
      return { ...M5_DIAGNOSTICS_DEFAULT };
    }

    const diag: M5Diagnostics = {
      ready: raw['ready'] as boolean,
      last_boot_ts: raw['last_boot_ts'] as number,
      snooze_count: raw['snooze_count'] as number,
    };

    // Champ last_incident optionnel
    const lastIncident = raw['last_incident'];
    if (lastIncident && typeof lastIncident === 'object') {
      const inc = lastIncident as Record<string, unknown>;
      if (
        typeof inc['type'] === 'string' &&
        typeof inc['severity'] === 'string' &&
        typeof inc['ts'] === 'number'
      ) {
        const incType = inc['type'] as string;
        if (incType === 'm5_snooze_corrupted' || incType === 'update_check_failed') {
          diag.last_incident = {
            type: incType,
            severity: inc['severity'] as 'info' | 'warn' | 'error',
            ts: inc['ts'] as number,
          };
        }
      }
    }

    return diag;
  } catch {
    return { ...M5_DIAGNOSTICS_DEFAULT };
  }
}

/**
 * Persiste diagnostics.m5 dans chrome.storage.local.
 *
 * Sérialisation JSON-strict : M5Diagnostics ne contient que des types
 * primitifs JSON-compatibles (boolean, number, string) — conforme P-018.
 *
 * @param diagnostics - Objet M5Diagnostics à persister
 */
async function writeDiagnostics(diagnostics: M5Diagnostics): Promise<void> {
  await browser.storage.local.set({ [DIAGNOSTICS_M5_KEY]: diagnostics });
}

/**
 * Séquence de boot M5 conforme ADR-001 SW-BOOT-CONTRACT (Option A).
 *
 * Exécute les 3 étapes obligatoires (R-BOOT-01) :
 *   1. Lire m5_snooze_count depuis chrome.storage.local
 *   2. Valider (nombre >= 0, entier fini)
 *   3. Logger l'incident et mettre à jour diagnostics.m5 (R-BOOT-04)
 *
 * Comportement par type d'entrée :
 * - snooze_count absent     → diagnostics.m5 ready=true, snooze_count=0, pas d'incident
 * - snooze_count valide     → diagnostics.m5 ready=true, snooze_count=valeur lue
 * - snooze_count corrompu   → incident m5_snooze_corrupted (error) + réinit à 0 + ready=false
 *
 * Erreurs non bloquantes : une exception dans cette fonction ne doit pas empêcher
 * la suite du boot SW. Elle est loguée et diagnostics.m5.ready reste false.
 *
 * @param incidentService - Service d'incidents partagé (initialisé avant l'appel)
 * @returns M5Diagnostics après boot (pour usage optionnel par l'appelant)
 */
export async function initBootM5(incidentService: IncidentService): Promise<M5Diagnostics> {
  // Timestamp de début de boot — INV-M5-01 : mis à jour même en cas d'échec
  const bootTs = Date.now();

  // État initial conservatif (ready=false) persisté immédiatement (ADR-001 §Étape 1 / R-BOOT-03)
  const currentDiag = await readDiagnostics();
  const bootingDiag: M5Diagnostics = {
    ...currentDiag,
    ready: false,
    last_boot_ts: bootTs,
  };
  await writeDiagnostics(bootingDiag);

  try {
    // ---------------------------------------------------------------------------
    // Étape 1 — Lire m5_snooze_count depuis chrome.storage.local
    // ---------------------------------------------------------------------------
    const result = await browser.storage.local.get([M5_SNOOZE_COUNT_STORAGE_KEY]);
    const storedSnoozeCount = result[M5_SNOOZE_COUNT_STORAGE_KEY];

    // ---------------------------------------------------------------------------
    // Étape 2 — Valider la valeur
    // ---------------------------------------------------------------------------
    const isAbsent = storedSnoozeCount === undefined || storedSnoozeCount === null;

    if (isAbsent) {
      // Absent = premier boot ou storage purgé : initialiser à 0, pas d'incident
      await browser.storage.local.set({ [M5_SNOOZE_COUNT_STORAGE_KEY]: 0 });

      const finalDiag: M5Diagnostics = {
        ready: true,
        last_boot_ts: bootTs,
        snooze_count: 0,
      };
      await writeDiagnostics(finalDiag);

      logger.info('M5BootService: m5_snooze_count absent — initialisé à 0', {});

      return finalDiag;
    }

    if (isValidSnoozeCount(storedSnoozeCount)) {
      // Happy path : snooze_count valide
      const finalDiag: M5Diagnostics = {
        ready: true,
        last_boot_ts: bootTs,
        snooze_count: storedSnoozeCount,
      };
      await writeDiagnostics(finalDiag);

      logger.info('M5BootService: m5_snooze_count valide', {
        snooze_count: storedSnoozeCount,
      });

      return finalDiag;
    }

    // ---------------------------------------------------------------------------
    // Étape 3 — Valeur invalide → incident + réinitialisation
    // ---------------------------------------------------------------------------

    // R-BOOT-02 : log incident AVANT d'écraser (traçabilité forensique)
    await incidentService.log('m5_snooze_corrupted', 'error', {
      type: 'm5_snooze_corrupted',
      stored_type: typeof storedSnoozeCount,
    });

    logger.error('M5BootService: m5_snooze_count corrompu — réinitialisation à 0', {
      stored_type: typeof storedSnoozeCount,
    });

    // Réinitialisation à 0 (R-BOOT-02 : après log)
    await browser.storage.local.set({ [M5_SNOOZE_COUNT_STORAGE_KEY]: 0 });

    const incidentTs = Date.now();
    const finalDiag: M5Diagnostics = {
      ready: false,
      last_boot_ts: bootTs,
      snooze_count: 0,
      last_incident: {
        type: 'm5_snooze_corrupted',
        severity: 'error',
        ts: incidentTs,
      },
    };
    await writeDiagnostics(finalDiag);

    return finalDiag;
  } catch (err: unknown) {
    // Exception non récupérée : marquer le module comme non prêt
    logger.error('M5BootService: erreur inattendue durant initBootM5', {
      error_name: Logger.errorName(err),
    });

    const failDiag: M5Diagnostics = {
      ready: false,
      last_boot_ts: bootTs,
      snooze_count: 0,
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

/**
 * Lit diagnostics.m5 depuis chrome.storage.local.
 *
 * Point d'accès public pour les consommateurs (popup, tests, TACHE-062).
 * Ne lève jamais d'exception — retourne la valeur par défaut si absente.
 *
 * @returns M5Diagnostics courant ou valeur par défaut
 */
export async function readM5Diagnostics(): Promise<M5Diagnostics> {
  return readDiagnostics();
}
