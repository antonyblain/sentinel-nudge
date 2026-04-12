/**
 * @file background/handlers/m3-handler.ts
 * @description Handler service worker pour le module M3 (score cyber-hygiène hebdomadaire).
 *
 * Déclenché par l'alarme 'm3_weekly' (lundi 09h) via AlarmDispatcher.onM3Weekly().
 *
 * Algorithme (action 'calculate_score') :
 * 1. Lire la configuration (modules actifs)
 * 2. Calculer le score via ScoreCalculator.calculateWeeklyScore()
 * 3. Mettre à jour le badge de l'extension (couleur + chiffre)
 * 4. Persister le score dans IndexedDB (déjà fait par ScoreCalculator)
 *
 * Couleur du badge (SFD §2.2) :
 * - Vert (#16A34A)  : score >= 70
 * - Orange (#D97706) : score 40-69
 * - Rouge (#DC2626)  : score < 40
 *
 * Cas limites (SFD §2.2.4) :
 * - Tous les modules désactivés : score = 0, message spécial
 * - IndexedDB corrompue : score "Données indisponibles"
 * - Première semaine : delta = 0, message "Votre premier score !"
 *
 * Référence : SFD §2.2 (M3), DAT §6.1 (ScoreCalculator), §6.2 (alarme lundi 09h)
 */

import { StorageService } from '@/background/storage-service';
import { ScoreCalculator } from '@/background/score-calculator';
import type { NudgeMessage, NudgeResponse } from '@/shared/types/messages';
import type { ModuleHandler } from '@/background/message-router';

/** Seuil de score pour badge vert */
const BADGE_GREEN_THRESHOLD = 70;

/** Seuil de score pour badge orange */
const BADGE_ORANGE_THRESHOLD = 40;

/** Couleur hex badge vert */
const BADGE_COLOR_GREEN = '#16A34A';

/** Couleur hex badge orange */
const BADGE_COLOR_ORANGE = '#D97706';

/** Couleur hex badge rouge */
const BADGE_COLOR_RED = '#DC2626';

/** Couleur hex badge bleu (notification avec chiffre) */
const BADGE_COLOR_BLUE = '#2563EB';

/**
 * Met à jour le badge de l'extension selon le score calculé.
 *
 * Couleur : vert (>=70), orange (40-69), rouge (<40).
 * Texte du badge : le score en chiffres (bleu si notification disponible).
 *
 * @param score - Score hebdomadaire calculé (0-100)
 */
async function updateBadge(score: number): Promise<void> {
  // Déterminer la couleur selon le score
  let color: string;
  if (score >= BADGE_GREEN_THRESHOLD) {
    color = BADGE_COLOR_GREEN;
  } else if (score >= BADGE_ORANGE_THRESHOLD) {
    color = BADGE_COLOR_ORANGE;
  } else {
    color = BADGE_COLOR_RED;
  }

  // Afficher le score et la couleur correspondante
  try {
    await chrome.action.setBadgeText({ text: String(score) });
    await chrome.action.setBadgeBackgroundColor({ color });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.warn(`[M3Handler] Impossible de mettre à jour le badge: ${message}`);
  }
}

/**
 * Efface le badge de l'extension.
 * Appelé si M3 est désactivé ou si le score est indisponible.
 */
async function clearBadge(): Promise<void> {
  try {
    await chrome.action.setBadgeText({ text: '' });
  } catch {
    // Ignore les erreurs de badge (peut survenir pendant les tests)
  }
}

/**
 * Met à jour le badge avec un indicateur de notification (bleu + chiffre).
 * Déclenché après le calcul du score pour signaler la disponibilité du rapport.
 *
 * @param score - Score calculé
 */
async function updateBadgeWithNotification(score: number): Promise<void> {
  try {
    await chrome.action.setBadgeText({ text: String(score) });
    await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_BLUE });
  } catch {
    // Ignore les erreurs de badge
  }
}

/**
 * Calcule le score et met à jour le badge de l'extension.
 *
 * @param storageService   - Service de stockage IndexedDB
 * @param scoreCalculator  - Calculateur de score M3
 * @param cryptoKey        - Clé AES-256-GCM
 * @returns Réponse NudgeResponse avec les données du score
 */
async function handleCalculateScore(
  storageService: StorageService,
  scoreCalculator: ScoreCalculator,
  cryptoKey: CryptoKey,
): Promise<NudgeResponse> {
  try {
    // Lire la configuration pour identifier les modules actifs
    const config = await storageService.getConfig();
    const enabledModules = config?.modules as Partial<Record<string, boolean>> | undefined;

    // Vérifier que M3 lui-même est activé (SFD §2.2.4)
    if (enabledModules && enabledModules['M3'] === false) {
      await clearBadge();
      return { success: true, action: 'skip', reason: 'm3_disabled' };
    }

    // Calculer le score hebdomadaire
    const weeklyScore = await scoreCalculator.calculateWeeklyScore(cryptoKey, enabledModules);
    const score = weeklyScore.total_score;

    // Cas : tous modules désactivés (SFD §2.2.4)
    const allDisabled =
      enabledModules && ['M2', 'M5', 'M6', 'M7', 'M9'].every((m) => enabledModules[m] === false);

    if (allDisabled) {
      await clearBadge();
      return {
        success: true,
        action: 'skip',
        reason: 'all_modules_disabled',
      };
    }

    // Mettre à jour le badge avec notification (bleu + chiffre)
    await updateBadgeWithNotification(score);

    return {
      success: true,
      action: 'show',
      data: {
        score,
        week_key: weeklyScore.week_key,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error(`[M3Handler] Erreur calcul score: ${message}`);
    // IndexedDB corrompue — effacer le badge (SFD §2.2.4)
    await clearBadge();
    return { success: false, action: 'error', reason: 'storage_error' };
  }
}

/**
 * Traite la demande de lecture du score courant depuis la popup ou le dashboard.
 *
 * @param storageService - Service de stockage
 * @param cryptoKey      - Clé AES-256-GCM
 * @param weekKey        - Clé de la semaine demandée (optionnelle, courante par défaut)
 * @returns Réponse avec les données du score
 */
async function handleGetScore(
  storageService: StorageService,
  scoreCalculator: ScoreCalculator,
  cryptoKey: CryptoKey,
  weekKey?: string,
): Promise<NudgeResponse> {
  try {
    const targetWeekKey = weekKey ?? scoreCalculator.getCurrentWeekKey();
    const score = await storageService.getWeeklyScore(targetWeekKey, cryptoKey);

    if (!score) {
      return {
        success: true,
        action: 'skip',
        reason: 'no_score_yet',
        data: { week_key: targetWeekKey },
      };
    }

    // Mettre à jour le badge selon le score (non notification — juste affichage)
    await updateBadge(score.total_score);

    return {
      success: true,
      action: 'show',
      data: {
        score: score.total_score,
        week_key: score.week_key,
        components: score.components,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error(`[M3Handler] Erreur get_score: ${message}`);
    return { success: false, action: 'error', reason: 'storage_error' };
  }
}

/**
 * Factory du handler M3 pour le Service Worker.
 *
 * Dispatche les messages selon leur action :
 * - 'calculate_score' : calcul hebdomadaire déclenché par l'alarme lundi 09h
 * - 'get_score'       : lecture du score courant (popup, dashboard)
 *
 * @param storageService  - Service de stockage IndexedDB
 * @param scoreCalculator - Calculateur de score M3
 * @param cryptoKey       - Clé AES-256-GCM pour le chiffrement
 * @returns Handler conforme à l'interface ModuleHandler
 */
export function createM3Handler(
  storageService: StorageService,
  scoreCalculator: ScoreCalculator,
  cryptoKey: CryptoKey,
): ModuleHandler {
  return async (
    msg: NudgeMessage,
    _sender: chrome.runtime.MessageSender,
  ): Promise<NudgeResponse> => {
    if (msg.action === 'calculate_score') {
      return handleCalculateScore(storageService, scoreCalculator, cryptoKey);
    }

    if (msg.action === 'get_score') {
      const weekKey =
        typeof msg.payload['week_key'] === 'string' ? msg.payload['week_key'] : undefined;
      return handleGetScore(storageService, scoreCalculator, cryptoKey, weekKey);
    }

    return { success: false, action: 'skip', reason: 'unknown_action' };
  };
}

// Exports pour les tests
export { updateBadge, clearBadge, BADGE_GREEN_THRESHOLD, BADGE_ORANGE_THRESHOLD };
