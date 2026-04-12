/**
 * @file background/handlers/m6-handler.ts
 * @description Handler service worker pour le module M6 (mini-quiz phishing).
 *
 * Gère le calendrier de spaced repetition, la sélection adaptative des questions,
 * et la persistance des sessions quiz.
 *
 * Algorithme spaced repetition (SFD §2.4.3) :
 *   base_intervals = [0, 7, 21, 42, 70] jours depuis l'installation
 *   after_initial  = 30 jours (mensuel après les 5 premières sessions)
 *   Si score < 50% → réduire l'intervalle de 30%
 *   Si score = 100% → augmenter l'intervalle de 20%
 *
 * Sélection adaptative (SFD §2.4.3) :
 * 1. Filtrer par locale
 * 2. Filtrer par difficulté selon profil
 * 3. Prioriser les catégories échouées
 * 4. Exclure les questions vues dans les 3 dernières sessions
 * 5. Sélectionner 3 questions (2 phishing + 1 légitime)
 *
 * Cas limite : corpus recyclé si tout a été vu (vue > 90 jours → réintégration).
 *
 * Référence : SFD §2.4 (M6), DAT §6.2 (alarme spaced repetition)
 */

import { StorageService } from '@/background/storage-service';
import { browser } from '@/shared/browser/browser-adapter';
import type { NudgeMessage, NudgeResponse } from '@/shared/types/messages';
import type { ModuleHandler } from '@/background/message-router';

/** Intervalles de base pour la spaced repetition (jours depuis installation) */
export const BASE_INTERVALS_DAYS = [0, 7, 21, 42, 70];

/** Intervalle mensuel après les 5 premières sessions (jours) */
export const AFTER_INITIAL_INTERVAL_DAYS = 30;

/** Réduction d'intervalle si score < 50% (-30%) */
export const INTERVAL_REDUCE_FACTOR = 0.7;

/** Augmentation d'intervalle si score = 100% (+20%) */
export const INTERVAL_INCREASE_FACTOR = 1.2;

/** Seuil de score faible pour réduire l'intervalle */
export const LOW_SCORE_THRESHOLD = 50;

/** Durée d'exclusion des questions vues (3 dernières sessions) */
const RECENT_SESSIONS_EXCLUDE = 3;

/** Durée de recyclage des questions vues (90 jours en ms) */

/** Clé chrome.storage.local pour la date de prochaine session quiz */
const M6_NEXT_QUIZ_DATE_KEY = 'm6_next_quiz_date';

/** Clé chrome.storage.local pour la date d'installation (référence spaced repetition) */
const M6_INSTALL_DATE_KEY = 'm6_install_date';

/** Clé chrome.storage.local pour l'état du quiz reporté (plus tard) */
const M6_DEFERRED_KEY = 'm6_quiz_deferred';

/** Structure d'une question du corpus embarqué */
export interface CorpusQuestion {
  id: string;
  category: string;
  difficulty: string;
  locale: string;
  type: string;
  is_phishing: boolean;
  indicators: string[];
  explanation: string;
  correct_index: number;
  // Champs bilingues
  question_fr?: string;
  options_fr?: string[];
  question_en?: string;
  options_en?: string[];
  content: Record<string, unknown>;
}

/** Données persistées d'une session quiz (chiffrées dans QuizSession.value) */
export interface QuizSessionData {
  score_pct: number;
  question_ids: string[];
  categories_failed: string[];
  completed: boolean;
  answers_given: number;
  timestamp: string;
}

/**
 * Lit la date de prochaine session quiz depuis chrome.storage.local.
 *
 * @returns Timestamp en ms ou null si jamais planifié
 */
async function getNextQuizDate(): Promise<number | null> {
  try {
    const result = await browser.storage.local.get([M6_NEXT_QUIZ_DATE_KEY]);
    const ts = result[M6_NEXT_QUIZ_DATE_KEY];
    return typeof ts === 'number' ? ts : null;
  } catch {
    return null;
  }
}

/**
 * Lit ou initialise la date d'installation (référence spaced repetition).
 *
 * @returns Timestamp en ms de la date d'installation
 */
async function getOrInitInstallDate(): Promise<number> {
  try {
    const result = await browser.storage.local.get([M6_INSTALL_DATE_KEY]);
    const ts = result[M6_INSTALL_DATE_KEY];
    if (typeof ts === 'number') return ts;

    // Première fois — initialiser avec maintenant
    const now = Date.now();
    await browser.storage.local.set({ [M6_INSTALL_DATE_KEY]: now });
    return now;
  } catch {
    return Date.now();
  }
}

/**
 * Calcule la prochaine date de quiz selon l'algorithme de spaced repetition.
 *
 * @param sessionCount  - Nombre total de sessions effectuées
 * @param lastScorePct  - Score du dernier quiz (0-100)
 * @param installDate   - Timestamp de l'installation
 * @param lastQuizDate  - Timestamp du dernier quiz
 * @returns Timestamp de la prochaine session
 */
export function calculateNextQuizDate(
  sessionCount: number,
  lastScorePct: number,
  installDate: number,
  lastQuizDate: number,
): number {
  let baseIntervalDays: number;

  if (sessionCount < BASE_INTERVALS_DAYS.length) {
    // Premières sessions : intervalles prédéfinis depuis l'installation
    baseIntervalDays = BASE_INTERVALS_DAYS[sessionCount] ?? AFTER_INITIAL_INTERVAL_DAYS;
    const targetDate = installDate + baseIntervalDays * 24 * 60 * 60 * 1000;

    // Appliquer l'ajustement de score
    const adjustedDate = applyScoreAdjustment(lastQuizDate, targetDate, lastScorePct, installDate);
    return adjustedDate;
  }

  // Après les 5 premières sessions : mensuel depuis le dernier quiz
  const baseIntervalMs = AFTER_INITIAL_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
  let intervalMs = baseIntervalMs;

  // Ajustement selon le score
  if (lastScorePct < LOW_SCORE_THRESHOLD) {
    intervalMs = Math.round(intervalMs * INTERVAL_REDUCE_FACTOR);
  } else if (lastScorePct === 100) {
    intervalMs = Math.round(intervalMs * INTERVAL_INCREASE_FACTOR);
  }

  return lastQuizDate + intervalMs;
}

/**
 * Applique l'ajustement de score sur une date cible.
 *
 * @param lastQuizDate  - Timestamp du dernier quiz
 * @param targetDate    - Date cible calculée
 * @param lastScorePct  - Score du dernier quiz
 * @param installDate   - Timestamp d'installation (référence)
 * @returns Date ajustée
 */
function applyScoreAdjustment(
  lastQuizDate: number,
  targetDate: number,
  lastScorePct: number,
  installDate: number,
): number {
  if (lastQuizDate <= installDate) {
    // Aucun quiz précédent — pas d'ajustement
    return targetDate;
  }

  const intervalFromLast = targetDate - lastQuizDate;
  if (intervalFromLast <= 0) return targetDate;

  if (lastScorePct < LOW_SCORE_THRESHOLD) {
    return lastQuizDate + Math.round(intervalFromLast * INTERVAL_REDUCE_FACTOR);
  } else if (lastScorePct === 100) {
    return lastQuizDate + Math.round(intervalFromLast * INTERVAL_INCREASE_FACTOR);
  }

  return targetDate;
}

/**
 * Charge le corpus de questions depuis le fichier JSON embarqué.
 * Retourne un tableau vide si le corpus est inaccessible (dégradation gracieuse).
 *
 * @returns Liste des questions du corpus
 */
async function loadCorpus(): Promise<CorpusQuestion[]> {
  try {
    const url = browser.runtime.getURL('assets/data/quiz-corpus.json');
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[M6Handler] Corpus inaccessible: HTTP ${response.status}`);
      return [];
    }
    const data = (await response.json()) as { questions?: CorpusQuestion[] };
    if (!Array.isArray(data.questions)) {
      console.error('[M6Handler] Format du corpus invalide');
      return [];
    }
    return data.questions;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error(`[M6Handler] Erreur chargement corpus: ${message}`);
    return [];
  }
}

/**
 * Sélectionne 3 questions adaptées au profil et à l'historique.
 *
 * Algorithme (SFD §2.4.3) :
 * 1. Filtrer par locale
 * 2. Filtrer par difficulté selon profil
 * 3. Exclure les questions vues dans les 3 dernières sessions
 * 4. Recycler les questions vues il y a > 90 jours si le pool est épuisé
 * 5. Prioriser les catégories échouées
 * 6. Sélectionner 2 phishing + 1 légitime
 *
 * @param corpus          - Toutes les questions du corpus
 * @param locale          - Langue préférée ('fr' ou 'en')
 * @param profile         - Profil utilisateur ('beginner', 'intermediate', 'advanced')
 * @param recentIds       - IDs des questions vues dans les 3 dernières sessions
 * @param failedCategories - Catégories échouées lors du dernier quiz
 * @returns Liste de 3 questions sélectionnées
 */
export function selectAdaptiveQuestions(
  corpus: CorpusQuestion[],
  locale: string,
  profile: string,
  recentIds: string[],
  failedCategories: string[],
): CorpusQuestion[] {
  // Étape 1 : Filtrer par locale
  let pool = corpus.filter((q) => q.locale === locale);
  if (pool.length === 0) {
    // Fallback sur l'autre locale si aucune question disponible
    pool = corpus;
  }

  // Étape 2 : Filtrer par difficulté selon profil
  const allowedDifficulties = getDifficultiesForProfile(profile);
  const byDifficulty = pool.filter((q) => allowedDifficulties.includes(q.difficulty));
  if (byDifficulty.length >= 3) {
    pool = byDifficulty;
  }

  // Étape 3 : Exclure les questions vues récemment (3 dernières sessions)
  const freshPool = pool.filter((q) => !recentIds.includes(q.id));

  // Étape 4 : Recyclage si pool épuisé (< 3 questions disponibles)
  // Préférer les questions non vues récemment (même si < 3) ; recycler seulement si pool totalement vide
  const workingPool = freshPool.length > 0 ? freshPool : pool;

  // Étape 5 : Séparer phishing et légitime
  const phishingQuestions = workingPool.filter((q) => q.is_phishing);
  const legitQuestions = workingPool.filter((q) => !q.is_phishing);

  // Prioriser les catégories échouées pour les questions phishing
  const failedPhishing = phishingQuestions.filter((q) => failedCategories.includes(q.category));
  const otherPhishing = phishingQuestions.filter((q) => !failedCategories.includes(q.category));

  // Construire le pool de phishing prioritaire
  const prioritizedPhishing = [...failedPhishing, ...otherPhishing];

  // Sélectionner 2 phishing + 1 légitime (mélanger pour éviter la prédictibilité)
  const selected2Phishing = shuffleArray(prioritizedPhishing).slice(0, 2);
  const selected1Legit = shuffleArray(legitQuestions).slice(0, 1);

  // Compléter si pas assez de questions d'un type
  let result = [...selected2Phishing, ...selected1Legit];

  // Cas dégradé : pas assez de questions par type — compléter depuis tout le pool
  if (result.length < 3) {
    const remaining = workingPool.filter((q) => !result.some((r) => r.id === q.id));
    result = [...result, ...shuffleArray(remaining).slice(0, 3 - result.length)];
  }

  // Mélanger le résultat final pour éviter la prévisibilité
  return shuffleArray(result).slice(0, 3);
}

/**
 * Retourne les difficultés autorisées selon le profil utilisateur.
 *
 * @param profile - Profil ('beginner', 'intermediate', 'advanced')
 * @returns Liste des difficultés autorisées
 */
export function getDifficultiesForProfile(profile: string): string[] {
  switch (profile) {
    case 'advanced':
      return ['intermediate', 'expert'];
    case 'intermediate':
      return ['basic', 'intermediate', 'expert'];
    case 'beginner':
    default:
      return ['basic', 'intermediate'];
  }
}

/**
 * Mélange un tableau de manière aléatoire (Fisher-Yates).
 *
 * @param array - Tableau à mélanger
 * @returns Nouveau tableau mélangé
 */
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    // Inversion sécurisée
    const temp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = temp;
  }
  return arr;
}

/**
 * Formate une question du corpus en objet envoyé au content script.
 *
 * @param q      - Question du corpus
 * @param locale - Locale de l'utilisateur
 * @returns Question formatée pour l'overlay M6
 */
export function formatQuestionForLocale(
  q: CorpusQuestion,
  locale: string,
): {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  is_phishing: boolean;
} {
  const isEn = locale === 'en' || q.locale === 'en';
  const question = isEn ? (q.question_en ?? q.question_fr ?? q.id) : (q.question_fr ?? q.id);
  const options = isEn ? (q.options_en ?? q.options_fr ?? []) : (q.options_fr ?? []);

  return {
    id: q.id,
    question,
    options,
    correct_index: q.correct_index,
    explanation: q.explanation,
    is_phishing: q.is_phishing,
  };
}

/**
 * Lit les IDs des questions des N dernières sessions quiz.
 *
 * @param storageService - Service de stockage
 * @param cryptoKey      - Clé de déchiffrement
 * @param n              - Nombre de sessions récentes à considérer
 * @returns Tableau d'IDs de questions récentes
 */
async function getRecentQuestionIds(
  storageService: StorageService,
  cryptoKey: CryptoKey,
  n: number,
): Promise<string[]> {
  try {
    const sessions = await storageService.getRecentQuizSessions(n, cryptoKey);
    const ids: string[] = [];
    sessions.forEach((session) => {
      if (Array.isArray(session.question_ids)) {
        ids.push(...(session.question_ids as string[]));
      }
    });
    return ids;
  } catch {
    return [];
  }
}

/**
 * Lit les catégories échouées de la dernière session quiz.
 *
 * @param storageService - Service de stockage
 * @param cryptoKey      - Clé de déchiffrement
 * @returns Tableau de catégories échouées
 */
async function getLastFailedCategories(
  storageService: StorageService,
  cryptoKey: CryptoKey,
): Promise<string[]> {
  try {
    const sessions = await storageService.getRecentQuizSessions(1, cryptoKey);
    if (sessions.length === 0) return [];
    const last = sessions[0];
    return Array.isArray(last?.['categories_failed'])
      ? (last['categories_failed'] as string[])
      : [];
  } catch {
    return [];
  }
}

/**
 * Vérifie si la date de quiz est atteinte et si le quiz est disponible.
 * Déclenche l'affichage du toast M6 si toutes les conditions sont remplies.
 *
 * @param storageService - Service de stockage
 * @param cryptoKey      - Clé AES-256-GCM
 * @returns Réponse NudgeResponse
 */
async function handleCheckQuiz(
  storageService: StorageService,
  cryptoKey: CryptoKey,
): Promise<NudgeResponse> {
  try {
    const nextQuizDate = await getNextQuizDate();
    const now = Date.now();

    // Si pas encore planifié ou date non atteinte : vérifier quiz reporté
    if (nextQuizDate !== null && now < nextQuizDate) {
      const result = await browser.storage.local.get([M6_DEFERRED_KEY]);
      if (!result[M6_DEFERRED_KEY]) {
        return { success: true, action: 'skip', reason: 'not_scheduled_yet' };
      }
    }

    // Charger le corpus
    const corpus = await loadCorpus();
    if (corpus.length === 0) {
      console.warn('[M6Handler] Corpus vide ou inaccessible — M6 désactivé');
      return { success: true, action: 'skip', reason: 'corpus_unavailable' };
    }

    // Lire la configuration
    const config = await storageService.getConfig();
    const locale = config?.language ?? 'fr';
    const profile = config?.profile ?? 'beginner';

    // Récupérer les questions récentes et catégories échouées
    const [recentIds, failedCategories] = await Promise.all([
      getRecentQuestionIds(storageService, cryptoKey, RECENT_SESSIONS_EXCLUDE),
      getLastFailedCategories(storageService, cryptoKey),
    ]);

    // Sélection adaptative des questions
    const selectedRaw = selectAdaptiveQuestions(
      corpus,
      locale,
      profile,
      recentIds,
      failedCategories,
    );

    if (selectedRaw.length === 0) {
      console.warn('[M6Handler] Aucune question disponible dans le corpus');
      return { success: true, action: 'skip', reason: 'no_questions_available' };
    }

    // Formater les questions pour le content script
    const questions = selectedRaw.map((q) => formatQuestionForLocale(q, locale));

    // Envoyer le toast au content script
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    if (!activeTab?.id) {
      return { success: true, action: 'skip', reason: 'no_active_tab' };
    }

    await browser.tabs.sendMessage(activeTab.id, {
      module: 'M6',
      action: 'show_quiz_toast',
      payload: { questions },
      timestamp: Date.now(),
    });

    // Effacer le flag de quiz reporté
    await browser.storage.local.remove(M6_DEFERRED_KEY as string);

    return { success: true, action: 'show' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error(`[M6Handler] Erreur check_quiz: ${message}`);
    return { success: false, action: 'error', reason: 'internal_error' };
  }
}

/**
 * Traite la fin d'un quiz (résultats envoyés par l'overlay).
 * Persiste la session et calcule la prochaine date.
 *
 * @param storageService - Service de stockage
 * @param payload        - Résultats du quiz
 * @param cryptoKey      - Clé AES-256-GCM
 * @returns Réponse NudgeResponse
 */
async function handleQuizCompleted(
  storageService: StorageService,
  payload: Record<string, unknown>,
  cryptoKey: CryptoKey,
): Promise<NudgeResponse> {
  try {
    const scorePct = typeof payload['score_pct'] === 'number' ? payload['score_pct'] : 0;
    const questionIds = Array.isArray(payload['question_ids'])
      ? (payload['question_ids'] as string[])
      : [];
    const categoriesFailed = Array.isArray(payload['categories_failed'])
      ? (payload['categories_failed'] as string[])
      : [];
    const completed = payload['completed'] === true;
    const answersGiven =
      typeof payload['answers_given'] === 'number' ? payload['answers_given'] : 0;

    const now = Date.now();

    // Persister la session quiz dans IndexedDB

    // Enregistrer la session via StorageService (avec chiffrement)
    await storageService.logEvent(
      'M6',
      {
        action: completed ? 'quiz_completed' : 'quiz_incomplete',
        module_data: {
          score_pct: scorePct,
          question_ids: questionIds,
          categories_failed: categoriesFailed,
          completed,
          answers_given: answersGiven,
          last_known_score_pct: scorePct,
        },
      },
      cryptoKey,
    );

    // Calculer la prochaine date de quiz (spaced repetition)
    if (completed) {
      const sessionCount = await storageService.getQuizSessionCount();
      const installDate = await getOrInitInstallDate();
      const nextDate = calculateNextQuizDate(sessionCount, scorePct, installDate, now);

      await browser.storage.local.set({ [M6_NEXT_QUIZ_DATE_KEY]: nextDate });

      console.info(
        `[M6Handler] Quiz complété: ${scorePct}% — Prochaine session: ${new Date(nextDate).toLocaleDateString()}`,
      );
    }

    return { success: true, action: 'skip' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error(`[M6Handler] Erreur quiz_completed: ${message}`);
    return { success: false, action: 'error', reason: 'internal_error' };
  }
}

/**
 * Traite les actions sur le toast M6 (start_quiz, later, closed).
 *
 * @param storageService - Service de stockage
 * @param payload        - Payload avec user_action
 * @param cryptoKey      - Clé AES-256-GCM
 * @returns Réponse NudgeResponse
 */
async function handleToastAction(
  storageService: StorageService,
  payload: Record<string, unknown>,
  cryptoKey: CryptoKey,
): Promise<NudgeResponse> {
  const userAction = payload['user_action'];
  if (typeof userAction !== 'string') {
    return { success: false, action: 'skip', reason: 'invalid_toast_payload' };
  }

  try {
    if (userAction === 'later' || userAction === 'closed') {
      // Marquer comme reporté — accessible depuis le dashboard pendant 7 jours
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
      await browser.storage.local.set({ [M6_DEFERRED_KEY]: expiresAt });
    }

    // Enregistrer l'événement
    await storageService.logEvent(
      'M6',
      { action: `toast_${userAction}`, module_data: {} },
      cryptoKey,
    );

    return { success: true, action: 'skip' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error(`[M6Handler] Erreur toast_action: ${message}`);
    return { success: false, action: 'error', reason: 'internal_error' };
  }
}

/**
 * Factory du handler M6 pour le Service Worker.
 *
 * Dispatche les messages selon leur action :
 * - 'check_quiz'      : vérification de la date + déclenchement toast si besoin
 * - 'quiz_completed'  : persistance des résultats + calcul prochaine date
 * - 'toast_action'    : traitement de l'action utilisateur sur le toast
 *
 * @param storageService - Service de stockage IndexedDB
 * @param cryptoKey      - Clé AES-256-GCM pour le chiffrement
 * @returns Handler conforme à l'interface ModuleHandler
 */
export function createM6Handler(
  storageService: StorageService,
  cryptoKey: CryptoKey,
): ModuleHandler {
  return async (
    msg: NudgeMessage,
    _sender: chrome.runtime.MessageSender,
  ): Promise<NudgeResponse> => {
    if (msg.action === 'check_quiz') {
      return handleCheckQuiz(storageService, cryptoKey);
    }

    if (msg.action === 'quiz_completed') {
      return handleQuizCompleted(storageService, msg.payload, cryptoKey);
    }

    if (msg.action === 'toast_action') {
      return handleToastAction(storageService, msg.payload, cryptoKey);
    }

    return { success: false, action: 'skip', reason: 'unknown_action' };
  };
}

// Exports pour les tests
export {
  getNextQuizDate,
  getOrInitInstallDate,
  loadCorpus,
  shuffleArray as _shuffleArray,
  M6_NEXT_QUIZ_DATE_KEY,
  M6_INSTALL_DATE_KEY,
};
