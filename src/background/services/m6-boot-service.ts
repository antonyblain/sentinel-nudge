/**
 * @file background/services/m6-boot-service.ts
 * @description Service de boot M6 — contrôle d'intégrité de la date d'installation (spaced repetition).
 *
 * Implémente ADR-001 SW-BOOT-CONTRACT (R-BOOT-01 à R-BOOT-04) pour le module M6
 * — Option A arbitrée en T-058 (initBoot complet).
 *
 * Séquence de boot en 4 étapes :
 *   1. Lire   — charger m6_install_date depuis chrome.storage.local
 *   2. Valider — vérifier que la valeur est un timestamp valide (nombre > 0)
 *   3. Régénérer — si invalide/absent : régénérer à Date.now() + émettre incident
 *   4. Logger  — mettre à jour diagnostics.m6 + vérifier pending_m6_quiz (TTL)
 *
 * Renommage m6_quiz_deferred → pending_m6_quiz (R-CLI-01 de ADR-002) :
 * La clé `m6_quiz_deferred` est renommée en `pending_m6_quiz` pour conformité
 * à la convention `pending_<module>_<action>` de ADR-002 R-CLI-01.
 * Le payload est désormais structuré JSON-strict avec `expires_at` (R-CLI-03).
 * La clé ancienne `m6_quiz_deferred` est nettoyée au boot si présente (migration one-shot).
 *
 * Conformité R-CLI-07 :
 * Aucun texte de question ne transite via ce service — seuls les IDs abstraits
 * (question_ids: string[]) sont manipulés. Le payload pending_m6_quiz ne stocke
 * jamais le texte des questions.
 *
 * Note sur m6_install_date absent/corrompu :
 * La réinitialisation à Date.now() entraîne une perte de l'historique de spaced
 * repetition (les intervalles repartent de zéro depuis la date de détection).
 * Ce comportement est conservatif (pas de date fictive passée) — l'alternative
 * (reconstruire depuis les quiz_sessions IDB) est d'une complexité disproportionnée
 * par rapport au bénéfice (incident rare, impact limité à la fréquence des quiz).
 *
 * Invariants :
 * - INV-M6-01 : diagnostics.m6.last_boot_ts mis à jour à chaque boot
 * - INV-M6-02 : install_date > 0 après boot (réinitialisé à Date.now() si absent/corrompu)
 *
 * Référence : ADR-001 (SW-BOOT-CONTRACT), ADR-002 (R-CLI-01 à R-CLI-07), TACHE-088
 */

import { browser } from '@/shared/browser/browser-adapter';
import { createLogger, Logger } from '@/shared/utils/logger';
import type { IncidentService } from '@/background/services/incident-service';
import type { M6Diagnostics } from '@/shared/types/diagnostics';
import {
  DIAGNOSTICS_M6_KEY,
  M6_INSTALL_DATE_STORAGE_KEY,
  PENDING_M6_QUIZ_KEY,
  M6_DIAGNOSTICS_DEFAULT,
} from '@/shared/types/diagnostics';

/** Logger scopé M6BootService — mitigation R-M7-08 / TACHE-083 */
const logger = createLogger('M6BootService');

/**
 * Clé ancienne de l'intent quiz reporté — nettoyée au boot si présente (migration one-shot).
 * Ne pas exporter : usage interne uniquement (migration à sens unique).
 */
const M6_DEFERRED_KEY_LEGACY = 'm6_quiz_deferred';

/**
 * Valide qu'une valeur est un timestamp d'installation valide.
 *
 * Critères :
 * - Doit être un nombre (typeof number)
 * - Doit être > 0 (timestamp epoch positif)
 * - Doit être un entier fini
 * - Ne doit pas être dans le futur (tolérance : +5 min pour les drifts d'horloge)
 *
 * @param value - Valeur à valider (provenant de chrome.storage.local)
 * @returns true si la valeur est un timestamp d'installation valide
 */
function isValidInstallDate(value: unknown): value is number {
  if (typeof value !== 'number') return false;
  if (!isFinite(value) || !Number.isInteger(value)) return false;
  if (value <= 0) return false;
  // Tolérance future de 5 minutes (drift d'horloge système)
  const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
  if (value > Date.now() + FUTURE_TOLERANCE_MS) return false;
  return true;
}

/**
 * Lit diagnostics.m6 depuis chrome.storage.local.
 *
 * Retourne la valeur par défaut si absente ou corrompue — ne lève jamais d'exception.
 *
 * @returns M6Diagnostics courant ou valeur par défaut
 */
async function readDiagnostics(): Promise<M6Diagnostics> {
  try {
    const result = await browser.storage.local.get([DIAGNOSTICS_M6_KEY]);
    const stored = result[DIAGNOSTICS_M6_KEY];

    if (!stored || typeof stored !== 'object') {
      return { ...M6_DIAGNOSTICS_DEFAULT };
    }

    const raw = stored as Record<string, unknown>;

    // Validation des champs obligatoires — reset si corrompu
    if (
      typeof raw['ready'] !== 'boolean' ||
      typeof raw['last_boot_ts'] !== 'number' ||
      typeof raw['install_date'] !== 'number'
    ) {
      return { ...M6_DIAGNOSTICS_DEFAULT };
    }

    const diag: M6Diagnostics = {
      ready: raw['ready'] as boolean,
      last_boot_ts: raw['last_boot_ts'] as number,
      install_date: raw['install_date'] as number,
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
        if (incType === 'm6_install_date_corrupted' || incType === 'quiz_deferred_stale') {
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
    return { ...M6_DIAGNOSTICS_DEFAULT };
  }
}

/**
 * Persiste diagnostics.m6 dans chrome.storage.local.
 *
 * Sérialisation JSON-strict : M6Diagnostics ne contient que des types
 * primitifs JSON-compatibles (boolean, number, string) — conforme P-018.
 *
 * @param diagnostics - Objet M6Diagnostics à persister
 */
async function writeDiagnostics(diagnostics: M6Diagnostics): Promise<void> {
  await browser.storage.local.set({ [DIAGNOSTICS_M6_KEY]: diagnostics });
}

/**
 * Nettoie la clé legacy `m6_quiz_deferred` si présente (migration one-shot).
 *
 * Cette migration est transparente et best-effort : si elle échoue, ce n'est pas bloquant.
 * La clé legacy sera nettoyée au prochain boot. Le handler M6 utilise désormais
 * `pending_m6_quiz` (R-CLI-01) — la clé legacy n'est plus jamais écrite.
 */
async function migrateLegacyDeferredKey(): Promise<void> {
  try {
    const result = await browser.storage.local.get([M6_DEFERRED_KEY_LEGACY]);
    if (result[M6_DEFERRED_KEY_LEGACY] !== undefined) {
      await browser.storage.local.remove(M6_DEFERRED_KEY_LEGACY);
      logger.info('M6BootService: clé legacy m6_quiz_deferred supprimée (migration one-shot)', {});
    }
  } catch {
    // Migration best-effort — pas de propagation
  }
}

/**
 * Vérifie si un pending_m6_quiz est présent et s'il a dépassé son expires_at.
 * Émet un incident quiz_deferred_stale (warn) si périmé et supprime la clé.
 *
 * Conformité R-CLI-05 (consommation one-shot) et R-CLI-07 (pas de texte de question).
 *
 * @param incidentService - Service d'incidents partagé
 */
async function checkPendingM6QuizTTL(incidentService: IncidentService): Promise<void> {
  try {
    const result = await browser.storage.local.get([PENDING_M6_QUIZ_KEY]);
    const pending = result[PENDING_M6_QUIZ_KEY];

    if (!pending || typeof pending !== 'object') {
      // Absent ou malformé — rien à faire
      return;
    }

    const raw = pending as Record<string, unknown>;
    const expiresAt = raw['expires_at'];

    if (typeof expiresAt !== 'number') {
      // Structure invalide (R-CLI-02 non respectée) — purge défensive
      await browser.storage.local.remove(PENDING_M6_QUIZ_KEY);
      logger.warn('M6BootService: pending_m6_quiz sans expires_at — supprimé', {});
      return;
    }

    const now = Date.now();
    if (expiresAt < now) {
      const overdueMs = now - expiresAt;

      // Incident quiz_deferred_stale (warn) — R-CLI-07 : pas de question_ids dans le contexte
      await incidentService.log('quiz_deferred_stale', 'warn', {
        type: 'quiz_deferred_stale',
        overdue_ms: overdueMs,
      });

      logger.warn('M6BootService: pending_m6_quiz périmé — supprimé', {
        overdue_ms: overdueMs,
      });

      // Purge one-shot de l'intent périmé (R-CLI-05 adapté)
      await browser.storage.local.remove(PENDING_M6_QUIZ_KEY);
    }
  } catch {
    // Best-effort — pas de propagation
  }
}

/**
 * Séquence de boot M6 conforme ADR-001 SW-BOOT-CONTRACT (Option A).
 *
 * Exécute les 4 étapes obligatoires (R-BOOT-01) :
 *   1. Lire m6_install_date depuis chrome.storage.local
 *   2. Valider (timestamp positif, entier fini, non futur)
 *   3. Régénérer depuis Date.now() si invalide/absent (R-BOOT-02) + incident
 *   4. Logger l'incident et mettre à jour diagnostics.m6 (R-BOOT-04)
 *
 * Actions additionnelles au boot :
 * - Nettoyage de la clé legacy `m6_quiz_deferred` (migration one-shot)
 * - Vérification TTL du pending_m6_quiz (R-CLI-03) + incident quiz_deferred_stale si périmé
 *
 * Comportement par type d'entrée :
 * - install_date absent     → régénération à Date.now() + incident m6_install_date_corrupted (error)
 * - install_date invalide   → incident m6_install_date_corrupted (error) + régénération
 * - install_date valide     → diagnostics.m6 ready=true, pas d'incident
 *
 * Erreurs non bloquantes : une exception dans cette fonction ne doit pas empêcher
 * la suite du boot SW. Elle est loguée et diagnostics.m6.ready reste false.
 *
 * @param incidentService - Service d'incidents partagé (initialisé avant l'appel)
 * @returns M6Diagnostics après boot (pour usage optionnel par l'appelant)
 */
export async function initBootM6(incidentService: IncidentService): Promise<M6Diagnostics> {
  // Timestamp de début de boot — INV-M6-01 : mis à jour même en cas d'échec
  const bootTs = Date.now();

  // État initial conservatif (ready=false) persisté immédiatement (ADR-001 §Étape 1 / R-BOOT-03)
  const currentDiag = await readDiagnostics();
  const bootingDiag: M6Diagnostics = {
    ...currentDiag,
    ready: false,
    last_boot_ts: bootTs,
  };
  await writeDiagnostics(bootingDiag);

  try {
    // Migration one-shot : nettoyer la clé legacy m6_quiz_deferred si présente
    await migrateLegacyDeferredKey();

    // ---------------------------------------------------------------------------
    // Étape 1 — Lire m6_install_date depuis chrome.storage.local
    // ---------------------------------------------------------------------------
    const result = await browser.storage.local.get([M6_INSTALL_DATE_STORAGE_KEY]);
    const storedInstallDate = result[M6_INSTALL_DATE_STORAGE_KEY];

    // ---------------------------------------------------------------------------
    // Étape 2 — Valider la valeur
    // ---------------------------------------------------------------------------
    const isAbsent = storedInstallDate === undefined || storedInstallDate === null;

    if (!isAbsent && isValidInstallDate(storedInstallDate)) {
      // Happy path : install_date valide
      // Vérifier le TTL du pending_m6_quiz (R-CLI-03)
      await checkPendingM6QuizTTL(incidentService);

      const finalDiag: M6Diagnostics = {
        ready: true,
        last_boot_ts: bootTs,
        install_date: storedInstallDate,
      };
      await writeDiagnostics(finalDiag);

      logger.info('M6BootService: m6_install_date valide', {
        install_date: storedInstallDate,
      });

      return finalDiag;
    }

    // ---------------------------------------------------------------------------
    // Étape 3 — Valeur invalide ou absente → régénération
    // ---------------------------------------------------------------------------

    const corruptionReason: 'absent' | 'invalid_type' = isAbsent ? 'absent' : 'invalid_type';

    // R-BOOT-02 : log incident AVANT d'écraser (traçabilité forensique)
    await incidentService.log('m6_install_date_corrupted', 'error', {
      type: 'm6_install_date_corrupted',
      reason: corruptionReason,
    });

    logger.error('M6BootService: m6_install_date absent ou corrompu — régénération à Date.now()', {
      reason: corruptionReason,
    });

    // Régénération conservatrice : Date.now() (pas de date fictive passée)
    // Impact : perte de l'historique spaced repetition (intervalles repartent de zéro)
    // Cf. JSDoc de ce fichier pour la justification de ce choix.
    const newInstallDate = Date.now();
    await browser.storage.local.set({ [M6_INSTALL_DATE_STORAGE_KEY]: newInstallDate });

    // Vérifier le TTL du pending_m6_quiz même en cas de corruption install_date
    await checkPendingM6QuizTTL(incidentService);

    // ---------------------------------------------------------------------------
    // Étape 4 — Mettre à jour diagnostics.m6
    // ---------------------------------------------------------------------------
    const incidentTs = Date.now();

    const finalDiag: M6Diagnostics = {
      ready: false,
      last_boot_ts: bootTs,
      install_date: newInstallDate,
      last_incident: {
        type: 'm6_install_date_corrupted',
        severity: 'error',
        ts: incidentTs,
      },
    };
    await writeDiagnostics(finalDiag);

    return finalDiag;
  } catch (err: unknown) {
    // Exception non récupérée : marquer le module comme non prêt
    logger.error('M6BootService: erreur inattendue durant initBootM6', {
      error_name: Logger.errorName(err),
    });

    const failDiag: M6Diagnostics = {
      ready: false,
      last_boot_ts: bootTs,
      install_date: 0,
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
 * Lit diagnostics.m6 depuis chrome.storage.local.
 *
 * Point d'accès public pour les consommateurs (popup, tests, TACHE-062).
 * Ne lève jamais d'exception — retourne la valeur par défaut si absente.
 *
 * @returns M6Diagnostics courant ou valeur par défaut
 */
export async function readM6Diagnostics(): Promise<M6Diagnostics> {
  return readDiagnostics();
}
