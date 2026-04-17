/**
 * @file background/services/m2-boot-service.ts
 * @description Service de boot M2 — contrôle d'intégrité de la whitelist typosquatting.
 *
 * Implémente ADR-001 SW-BOOT-CONTRACT (R-BOOT-01 à R-BOOT-04) pour le module M2.
 * Séquence de boot en 4 étapes :
 *   1. Lire  — charger whitelist_m2 depuis chrome.storage.local
 *   2. Valider — vérifier la shape (array de strings non vides)
 *   3. Régénérer — si invalide/absent : régénérer depuis typosquatting-targets.json
 *   4. Logger — mettre à jour diagnostics.m2 + émettre incident via IncidentService
 *
 * La "whitelist M2" dans ce contexte est la liste des domaines cibles de typosquatting
 * (ex: 'paypal.com', 'google.com') utilisée par risk-analyzer pour la distance Levenshtein.
 * Elle est mise en cache dans chrome.storage.local (clé `whitelist_m2`) pour permettre :
 * - La vérification d'intégrité au boot (R-ADR-01 : amnésie silencieuse)
 * - Une future mise à jour dynamique sans rebuild de l'extension
 *
 * Invariants :
 * - INV-M2-01 : diagnostics.m2.ready === true implique whitelist_size > 0
 * - INV-M2-02 : diagnostics.m2.last_boot_ts mis à jour à chaque boot
 *
 * Référence : ADR-001 (SW-BOOT-CONTRACT), R-ADR-01 (RISQUES.md), TACHE-085
 */

import { browser } from '@/shared/browser/browser-adapter';
import { createLogger, Logger } from '@/shared/utils/logger';
import type { IncidentService } from '@/background/services/incident-service';
import type { M2Diagnostics } from '@/shared/types/diagnostics';
import {
  DIAGNOSTICS_M2_KEY,
  WHITELIST_M2_STORAGE_KEY,
  M2_DIAGNOSTICS_DEFAULT,
} from '@/shared/types/diagnostics';
import typosquattingData from '@/assets/data/typosquatting-targets.json';

/** Logger scopé M2BootService — mitigation R-M7-08 / TACHE-083 */
const logger = createLogger('M2BootService');

/**
 * Valide qu'une valeur inconnue est un tableau de strings non vides.
 *
 * Critères de validité (shape de la whitelist M2) :
 * - Doit être un tableau (Array.isArray)
 * - Doit contenir au moins un élément
 * - Chaque élément doit être une string non vide
 *
 * @param value - Valeur à valider (provenant de chrome.storage.local)
 * @returns true si la valeur est une whitelist M2 valide
 */
function isValidWhitelist(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return false;
  return value.every((entry) => typeof entry === 'string' && entry.length > 0);
}

/**
 * Charge la liste de domaines par défaut depuis le JSON embarqué.
 *
 * Source : src/assets/data/typosquatting-targets.json (champ "targets").
 * En cas d'erreur (structure inattendue), retourne un tableau vide.
 *
 * @returns Tableau de domaines cibles (ex: ['paypal.com', 'google.com'])
 */
function loadDefaultTargets(): string[] {
  try {
    const data = typosquattingData as { targets?: unknown };
    if (Array.isArray(data.targets) && data.targets.length > 0) {
      return data.targets as string[];
    }
    logger.warn('M2BootService: typosquatting-targets.json vide ou structure inattendue');
    return [];
  } catch (err) {
    logger.error('M2BootService: erreur chargement typosquatting-targets.json', {
      error_name: Logger.errorName(err),
    });
    return [];
  }
}

/**
 * Lit diagnostics.m2 depuis chrome.storage.local.
 *
 * Retourne la valeur par défaut si absente ou corrompue — ne lève jamais d'exception.
 *
 * @returns M2Diagnostics courant ou valeur par défaut
 */
async function readDiagnostics(): Promise<M2Diagnostics> {
  try {
    const result = await browser.storage.local.get([DIAGNOSTICS_M2_KEY]);
    const stored = result[DIAGNOSTICS_M2_KEY];

    if (!stored || typeof stored !== 'object') {
      return { ...M2_DIAGNOSTICS_DEFAULT };
    }

    const raw = stored as Record<string, unknown>;

    // Validation des champs obligatoires — reset si corrompu
    if (
      typeof raw['ready'] !== 'boolean' ||
      typeof raw['last_boot_ts'] !== 'number' ||
      typeof raw['whitelist_size'] !== 'number'
    ) {
      return { ...M2_DIAGNOSTICS_DEFAULT };
    }

    const diag: M2Diagnostics = {
      ready: raw['ready'] as boolean,
      last_boot_ts: raw['last_boot_ts'] as number,
      whitelist_size: raw['whitelist_size'] as number,
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
        diag.last_incident = {
          type: inc['type'] as 'whitelist_corrupted' | 'whitelist_regenerated',
          severity: inc['severity'] as 'info' | 'warn' | 'error',
          ts: inc['ts'] as number,
        };
      }
    }

    return diag;
  } catch {
    return { ...M2_DIAGNOSTICS_DEFAULT };
  }
}

/**
 * Persiste diagnostics.m2 dans chrome.storage.local.
 *
 * Sérialisation JSON-strict : M2Diagnostics ne contient que des types
 * primitifs JSON-compatibles (boolean, number, string, null) — conforme P-018.
 *
 * @param diagnostics - Objet M2Diagnostics à persister
 */
async function writeDiagnostics(diagnostics: M2Diagnostics): Promise<void> {
  await browser.storage.local.set({ [DIAGNOSTICS_M2_KEY]: diagnostics });
}

/**
 * Séquence de boot M2 conforme ADR-001 SW-BOOT-CONTRACT.
 *
 * Exécute les 4 étapes obligatoires (R-BOOT-01) :
 *   1. Lire whitelist_m2 depuis chrome.storage.local
 *   2. Valider la shape (array de strings non vides, au moins 1 entrée)
 *   3. Régénérer depuis typosquatting-targets.json si invalide/absent (R-BOOT-02)
 *   4. Logger l'incident et mettre à jour diagnostics.m2 (R-BOOT-04)
 *
 * Comportement par type d'entrée :
 * - Whitelist absente       → régénération + incident whitelist_regenerated (warn)
 * - Whitelist shape invalide → incident whitelist_corrupted (error) + régénération + incident whitelist_regenerated (warn)
 * - Whitelist valide         → diagnostics.m2 ready=true, pas d'incident
 *
 * Erreurs non bloquantes : une exception dans cette fonction ne doit pas empêcher
 * la suite du boot SW. Elle est loguée et diagnostics.m2.ready reste false.
 *
 * @param incidentService - Service d'incidents partagé (initialisé avant l'appel)
 * @returns M2Diagnostics après boot (pour usage optionnel par l'appelant)
 */
export async function initBootM2(incidentService: IncidentService): Promise<M2Diagnostics> {
  // Timestamp de début de boot — INV-M2-02 : mis à jour même en cas d'échec
  const bootTs = Date.now();

  // État initial conservatif (ready=false) persisté immédiatement (ADR-001 §Étape 1)
  const currentDiag = await readDiagnostics();
  const bootingDiag: M2Diagnostics = {
    ...currentDiag,
    ready: false,
    last_boot_ts: bootTs,
  };
  await writeDiagnostics(bootingDiag);

  try {
    // ---------------------------------------------------------------------------
    // Étape 1 — Lire whitelist_m2 depuis chrome.storage.local
    // ---------------------------------------------------------------------------
    const result = await browser.storage.local.get([WHITELIST_M2_STORAGE_KEY]);
    const storedWhitelist = result[WHITELIST_M2_STORAGE_KEY];

    // ---------------------------------------------------------------------------
    // Étape 2 — Valider la shape
    // ---------------------------------------------------------------------------
    const isValid = isValidWhitelist(storedWhitelist);

    if (isValid) {
      // ---------------------------------------------------------------------------
      // Happy path : whitelist valide
      // ---------------------------------------------------------------------------
      const finalDiag: M2Diagnostics = {
        ready: true,
        last_boot_ts: bootTs,
        whitelist_size: (storedWhitelist as string[]).length,
      };
      await writeDiagnostics(finalDiag);

      logger.info('M2BootService: whitelist M2 valide', {
        whitelist_size: (storedWhitelist as string[]).length,
      });

      return finalDiag;
    }

    // ---------------------------------------------------------------------------
    // Étape 3 — Valeur invalide ou absente → régénération
    // ---------------------------------------------------------------------------

    // Déterminer le motif : absent ou shape invalide
    const isAbsent = storedWhitelist === undefined || storedWhitelist === null;
    const corruptionReason = isAbsent ? 'absent' : 'invalid_shape';
    const entryCount = Array.isArray(storedWhitelist) ? (storedWhitelist as unknown[]).length : 0;

    if (!isAbsent) {
      // R-BOOT-02 : log whitelist_corrupted AVANT d'écraser (traçabilité forensique)
      await incidentService.log('whitelist_corrupted', 'error', {
        type: 'whitelist_corrupted',
        reason: corruptionReason,
        entry_count: entryCount,
      });

      logger.error('M2BootService: whitelist M2 corrompue — régénération en cours', {
        reason: corruptionReason,
        entry_count: entryCount,
      });
    } else {
      logger.info('M2BootService: whitelist_m2 absente — génération initiale');
    }

    // Charger les valeurs par défaut depuis le JSON embarqué
    const defaultTargets = loadDefaultTargets();
    const previousSize = Array.isArray(storedWhitelist) ? (storedWhitelist as unknown[]).length : 0;

    // R-BOOT-02 : log whitelist_regenerated AVANT d'écrire (ADR-001 R-BOOT-02 / INV-SEC-03)
    await incidentService.log('whitelist_regenerated', 'warn', {
      type: 'whitelist_regenerated',
      previous_size: previousSize,
      new_size: defaultTargets.length,
    });

    // ---------------------------------------------------------------------------
    // Écriture de la whitelist régénérée dans chrome.storage.local
    // ---------------------------------------------------------------------------
    await browser.storage.local.set({ [WHITELIST_M2_STORAGE_KEY]: defaultTargets });

    logger.warn('M2BootService: whitelist M2 régénérée', {
      previous_size: previousSize,
      new_size: defaultTargets.length,
    });

    // ---------------------------------------------------------------------------
    // Étape 4 — Logger et mettre à jour diagnostics.m2
    // ---------------------------------------------------------------------------
    const incidentTs = Date.now();
    const incidentType = isAbsent ? 'whitelist_regenerated' : 'whitelist_corrupted';
    const incidentSeverity = isAbsent ? 'warn' : 'error';

    const finalDiag: M2Diagnostics = {
      ready: defaultTargets.length > 0,
      last_boot_ts: bootTs,
      whitelist_size: defaultTargets.length,
      last_incident: {
        type: incidentType,
        severity: incidentSeverity,
        ts: incidentTs,
      },
    };
    await writeDiagnostics(finalDiag);

    return finalDiag;
  } catch (err: unknown) {
    // Exception non récupérée : marquer le module comme non prêt
    logger.error('M2BootService: erreur inattendue durant initBootM2', {
      error_name: Logger.errorName(err),
    });

    const failDiag: M2Diagnostics = {
      ready: false,
      last_boot_ts: bootTs,
      whitelist_size: 0,
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
 * Lit diagnostics.m2 depuis chrome.storage.local.
 *
 * Point d'accès public pour les consommateurs (popup, tests, TACHE-062).
 * Ne lève jamais d'exception — retourne la valeur par défaut si absente.
 *
 * @returns M2Diagnostics courant ou valeur par défaut
 */
export async function readM2Diagnostics(): Promise<M2Diagnostics> {
  return readDiagnostics();
}
