/**
 * @file tests/unit/modules/m6.test.ts
 * @description Tests unitaires du module M6 — mini-quiz phishing.
 *
 * Couvre :
 * - calculateNextQuizDate : spaced repetition (intervals, ajustements score)
 * - selectAdaptiveQuestions : filtrage locale, profil, exclusion sessions récentes
 * - getDifficultiesForProfile : mapping profil → difficultés
 * - formatQuestionForLocale : formatage bilingue
 * - handleCheckQuiz / handleQuizCompleted / handleToastAction
 * - Cas limites : corpus vide, pool épuisé, recyclage
 * - initBootM6 : boot happy path, install_date corrompu, migration pending_m6_quiz (TACHE-088)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateNextQuizDate,
  selectAdaptiveQuestions,
  getDifficultiesForProfile,
  formatQuestionForLocale,
  createM6Handler,
  BASE_INTERVALS_DAYS,
  AFTER_INITIAL_INTERVAL_DAYS,
  INTERVAL_REDUCE_FACTOR,
  INTERVAL_INCREASE_FACTOR,
  LOW_SCORE_THRESHOLD,
  type CorpusQuestion,
} from '@/background/handlers/m6-handler';
import { initBootM6, readM6Diagnostics } from '@/background/services/m6-boot-service';
import type { StorageService } from '@/background/storage-service';
import type { NudgeMessage } from '@/shared/types/messages';
import type { IncidentService } from '@/background/services/incident-service';
import { PENDING_M6_QUIZ_KEY, PENDING_M6_QUIZ_TTL_MS } from '@/shared/types/diagnostics';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockLocalStorage: Record<string, unknown> = {};

global.chrome = {
  storage: {
    local: {
      get: vi.fn((keys: string[], callback: (r: Record<string, unknown>) => void) => {
        const result: Record<string, unknown> = {};
        for (const k of keys) {
          if (mockLocalStorage[k] !== undefined) result[k] = mockLocalStorage[k];
        }
        callback(result);
      }),
      set: vi.fn((items: Record<string, unknown>, callback?: () => void) => {
        Object.assign(mockLocalStorage, items);
        callback?.();
      }),
      remove: vi.fn((keys: string | string[], callback?: () => void) => {
        const ks = Array.isArray(keys) ? keys : [keys];
        ks.forEach((k) => delete mockLocalStorage[k]);
        callback?.();
      }),
    },
  },
  tabs: {
    query: vi.fn().mockResolvedValue([{ id: 42, active: true }]),
    sendMessage: vi.fn().mockResolvedValue({}),
  },
  runtime: {
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
    lastError: undefined,
  },
} as unknown as typeof chrome;

// Mock global fetch pour charger le corpus
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({
    questions: buildMockCorpus(),
  }),
}) as typeof fetch;

/** Crée un mock minimal de StorageService */
function createMockStorageService(overrides: Partial<StorageService> = {}): StorageService {
  return {
    logEvent: vi.fn().mockResolvedValue(1),
    getEvents: vi.fn().mockResolvedValue([]),
    getConfig: vi.fn().mockResolvedValue({
      modules: { M6: true },
      quota_limit: 3,
      profile: 'beginner',
      onboarding_complete: true,
      language: 'fr',
    }),
    getRecentQuizSessions: vi.fn().mockResolvedValue([]),
    getQuizSessionCount: vi.fn().mockResolvedValue(0),
    ...overrides,
  } as unknown as StorageService;
}

/** Construit un NudgeMessage M6 */
function buildM6Message(action: string, payload: Record<string, unknown> = {}): NudgeMessage {
  return { module: 'M6', action, payload, timestamp: Date.now() };
}

const mockSender = {} as chrome.runtime.MessageSender;

/** Construit un corpus de test minimal (5 questions FR, mix phishing/légitime) */
function buildMockCorpus(): CorpusQuestion[] {
  return [
    {
      id: 'test-001',
      category: 'urgency',
      difficulty: 'basic',
      locale: 'fr',
      type: 'email',
      is_phishing: true,
      indicators: ['urgence'],
      explanation: 'Explication 1',
      correct_index: 1,
      question_fr: 'Cet email est-il légitime ?',
      options_fr: ['Oui', 'Non'],
      content: {},
    },
    {
      id: 'test-002',
      category: 'authority',
      difficulty: 'basic',
      locale: 'fr',
      type: 'email',
      is_phishing: true,
      indicators: ['usurpation'],
      explanation: 'Explication 2',
      correct_index: 1,
      question_fr: 'Cet email est-il légitime ?',
      options_fr: ['Oui', 'Non'],
      content: {},
    },
    {
      id: 'test-003',
      category: 'gain',
      difficulty: 'intermediate',
      locale: 'fr',
      type: 'email',
      is_phishing: true,
      indicators: ['gain'],
      explanation: 'Explication 3',
      correct_index: 1,
      question_fr: 'Cet email est-il légitime ?',
      options_fr: ['Oui', 'Non'],
      content: {},
    },
    {
      id: 'test-004',
      category: 'authority',
      difficulty: 'basic',
      locale: 'fr',
      type: 'email',
      is_phishing: false,
      indicators: [],
      explanation: 'Légitime car...',
      correct_index: 0,
      question_fr: 'Cette notification est-elle légitime ?',
      options_fr: ['Oui', 'Non'],
      content: {},
    },
    {
      id: 'test-005',
      category: 'urgency',
      difficulty: 'expert',
      locale: 'fr',
      type: 'webpage',
      is_phishing: true,
      indicators: ['https_trompe'],
      explanation: 'Explication 5',
      correct_index: 1,
      question_fr: 'Ce site est-il légitime ?',
      options_fr: ['Oui', 'Non'],
      content: {},
    },
  ];
}

// ---------------------------------------------------------------------------
// Helpers initBootM6
// ---------------------------------------------------------------------------

/**
 * Crée un mock d'IncidentService pour les tests initBootM6.
 */
function createMockIncidentService(): {
  service: Partial<IncidentService>;
  incidents: Array<{ type: string; severity: string }>;
} {
  const incidents: Array<{ type: string; severity: string }> = [];
  const service: Partial<IncidentService> = {
    log: vi.fn(async (type, severity) => {
      incidents.push({ type, severity });
    }),
  };
  return { service, incidents };
}

// ---------------------------------------------------------------------------
// Réinitialisation avant chaque test
// ---------------------------------------------------------------------------

beforeEach(() => {
  Object.keys(mockLocalStorage).forEach((k) => {
    delete mockLocalStorage[k];
  });
  vi.clearAllMocks();
  // Réinitialiser les implémentations chrome.storage.local
  (global.chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
    (keys: string[], callback: (r: Record<string, unknown>) => void) => {
      const result: Record<string, unknown> = {};
      for (const k of keys) {
        if (mockLocalStorage[k] !== undefined) result[k] = mockLocalStorage[k];
      }
      callback(result);
    },
  );
  (global.chrome.storage.local.set as ReturnType<typeof vi.fn>).mockImplementation(
    (items: Record<string, unknown>, callback?: () => void) => {
      Object.assign(mockLocalStorage, items);
      callback?.();
    },
  );
  (global.chrome.storage.local.remove as ReturnType<typeof vi.fn>).mockImplementation(
    (keys: string | string[], callback?: () => void) => {
      const ks = Array.isArray(keys) ? keys : [keys];
      ks.forEach((k) => delete mockLocalStorage[k]);
      callback?.();
    },
  );
});

// ---------------------------------------------------------------------------
// Tests spaced repetition
// ---------------------------------------------------------------------------

describe('calculateNextQuizDate — spaced repetition', () => {
  const installDate = new Date('2026-01-01').getTime();
  const lastQuizDate = new Date('2026-01-01').getTime();

  it('session 0 : quiz immédiat (intervalle 0j)', () => {
    const next = calculateNextQuizDate(0, 80, installDate, lastQuizDate);
    expect(next).toBe(installDate); // base_intervals[0] = 0
  });

  it('session 1 : quiz après 7 jours depuis installation', () => {
    const next = calculateNextQuizDate(1, 80, installDate, lastQuizDate);
    const expected = installDate + 7 * 24 * 60 * 60 * 1000;
    expect(next).toBeCloseTo(expected, -3); // tolérance 1 seconde
  });

  it('session 5+ : intervalle mensuel depuis le dernier quiz', () => {
    const recentLastQuiz = new Date('2026-03-01').getTime();
    const next = calculateNextQuizDate(5, 80, installDate, recentLastQuiz);
    const expected = recentLastQuiz + AFTER_INITIAL_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
    expect(next).toBe(expected);
  });

  it('CA-M6-08 : score < 50% → intervalle réduit de 30%', () => {
    const recentLastQuiz = new Date('2026-03-01').getTime();
    const next = calculateNextQuizDate(5, 30, installDate, recentLastQuiz);
    const baseInterval = AFTER_INITIAL_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
    const expected = recentLastQuiz + Math.round(baseInterval * INTERVAL_REDUCE_FACTOR);
    expect(next).toBe(expected);
  });

  it('score = 100% → intervalle augmenté de 20%', () => {
    const recentLastQuiz = new Date('2026-03-01').getTime();
    const next = calculateNextQuizDate(5, 100, installDate, recentLastQuiz);
    const baseInterval = AFTER_INITIAL_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
    const expected = recentLastQuiz + Math.round(baseInterval * INTERVAL_INCREASE_FACTOR);
    expect(next).toBe(expected);
  });

  it('les constantes sont cohérentes avec la SFD', () => {
    expect(BASE_INTERVALS_DAYS).toEqual([0, 7, 21, 42, 70]);
    expect(AFTER_INITIAL_INTERVAL_DAYS).toBe(30);
    expect(INTERVAL_REDUCE_FACTOR).toBe(0.7);
    expect(INTERVAL_INCREASE_FACTOR).toBe(1.2);
    expect(LOW_SCORE_THRESHOLD).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Tests sélection adaptative
// ---------------------------------------------------------------------------

describe('selectAdaptiveQuestions', () => {
  const corpus = buildMockCorpus();

  it('sélectionne exactement 3 questions', () => {
    const selected = selectAdaptiveQuestions(corpus, 'fr', 'beginner', [], []);
    expect(selected).toHaveLength(3);
  });

  it('inclut au moins 1 question légitime (is_phishing=false)', () => {
    // Forcer beaucoup de tentatives pour que le ratio 2+1 soit respecté
    const results: boolean[] = [];
    for (let i = 0; i < 10; i++) {
      const selected = selectAdaptiveQuestions(corpus, 'fr', 'beginner', [], []);
      results.push(selected.some((q) => !q.is_phishing));
    }
    // Au moins la majorité des fois, il y a 1 légitime
    expect(results.filter(Boolean).length).toBeGreaterThan(5);
  });

  it('exclut les questions récentes (recentIds)', () => {
    const recentIds = ['test-001', 'test-002'];
    const selected = selectAdaptiveQuestions(corpus, 'fr', 'beginner', recentIds, []);
    const selectedIds = selected.map((q) => q.id);
    // Si le pool est suffisant, les questions récentes sont exclues
    // (ici 3 questions restantes : test-003, test-004, test-005)
    expect(selectedIds).not.toContain('test-001');
    expect(selectedIds).not.toContain('test-002');
  });

  it('CA-M6-07 : recycle si pool < 3 (toutes récemment vues)', () => {
    const recentIds = ['test-001', 'test-002', 'test-003', 'test-004', 'test-005'];
    const selected = selectAdaptiveQuestions(corpus, 'fr', 'beginner', recentIds, []);
    // Même si tout est "vu", on doit quand même sélectionner 3 questions
    expect(selected).toHaveLength(3);
  });

  it('filtre par locale : FR → uniquement questions FR', () => {
    const mixedCorpus: CorpusQuestion[] = [
      ...corpus,
      {
        ...corpus[0]!,
        id: 'en-001',
        locale: 'en',
        question_en: 'Is this legitimate?',
        options_en: ['Yes', 'No'],
      },
    ];
    const selected = selectAdaptiveQuestions(mixedCorpus, 'fr', 'beginner', [], []);
    expect(selected.every((q) => q.locale === 'fr')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests getDifficultiesForProfile
// ---------------------------------------------------------------------------

describe('getDifficultiesForProfile', () => {
  it('beginner : basic + intermediate', () => {
    expect(getDifficultiesForProfile('beginner')).toEqual(['basic', 'intermediate']);
  });

  it('intermediate : basic + intermediate + expert', () => {
    expect(getDifficultiesForProfile('intermediate')).toEqual(['basic', 'intermediate', 'expert']);
  });

  it('advanced : intermediate + expert', () => {
    expect(getDifficultiesForProfile('advanced')).toEqual(['intermediate', 'expert']);
  });

  it('profil inconnu → défaut beginner', () => {
    expect(getDifficultiesForProfile('unknown')).toEqual(['basic', 'intermediate']);
  });
});

// ---------------------------------------------------------------------------
// Tests formatQuestionForLocale
// ---------------------------------------------------------------------------

describe('formatQuestionForLocale', () => {
  const q: CorpusQuestion = {
    id: 'test-001',
    category: 'urgency',
    difficulty: 'basic',
    locale: 'fr',
    type: 'email',
    is_phishing: true,
    indicators: ['urgence'],
    explanation: 'Explication',
    correct_index: 1,
    question_fr: 'Question FR',
    options_fr: ['Oui', 'Non'],
    question_en: 'Question EN',
    options_en: ['Yes', 'No'],
    content: {},
  };

  it('retourne la question en français', () => {
    const formatted = formatQuestionForLocale(q, 'fr');
    expect(formatted.question).toBe('Question FR');
    expect(formatted.options).toEqual(['Oui', 'Non']);
  });

  it('retourne la question en anglais', () => {
    const formatted = formatQuestionForLocale(q, 'en');
    expect(formatted.question).toBe('Question EN');
    expect(formatted.options).toEqual(['Yes', 'No']);
  });

  it('retourne tous les champs requis', () => {
    const formatted = formatQuestionForLocale(q, 'fr');
    expect(formatted).toHaveProperty('id');
    expect(formatted).toHaveProperty('question');
    expect(formatted).toHaveProperty('options');
    expect(formatted).toHaveProperty('correct_index');
    expect(formatted).toHaveProperty('explanation');
    expect(formatted).toHaveProperty('is_phishing');
  });
});

// ---------------------------------------------------------------------------
// Tests handler M6
// ---------------------------------------------------------------------------

describe('M6Handler — toast_action : later', () => {
  it('marque le quiz comme reporté avec pending_m6_quiz (R-CLI-01) et expires_at (R-CLI-03)', async () => {
    // TACHE-088 : renommage m6_quiz_deferred → pending_m6_quiz (R-CLI-01 ADR-002)
    // Le payload est désormais { expires_at: number } (R-CLI-02/R-CLI-03)
    const storage = createMockStorageService();
    const cryptoKey = {} as CryptoKey;
    const handler = createM6Handler(storage, cryptoKey);

    const beforeTs = Date.now();
    await handler(buildM6Message('toast_action', { user_action: 'later' }), mockSender);

    // Vérifier la nouvelle clé (R-CLI-01)
    const pending = mockLocalStorage[PENDING_M6_QUIZ_KEY] as Record<string, unknown>;
    expect(pending).toBeDefined();
    // Payload JSON-strict avec expires_at (R-CLI-02 / R-CLI-03)
    expect(typeof pending['expires_at']).toBe('number');
    expect(pending['expires_at'] as number).toBeGreaterThan(beforeTs);
    // TTL 7 jours (PENDING_M6_QUIZ_TTL_MS)
    expect(pending['expires_at'] as number).toBeCloseTo(beforeTs + PENDING_M6_QUIZ_TTL_MS, -3);

    // L'ancienne clé ne doit plus être utilisée (migration R-CLI-01)
    expect(mockLocalStorage['m6_quiz_deferred']).toBeUndefined();
  });
});

describe('M6Handler — quiz_completed', () => {
  it("enregistre l'événement et calcule la prochaine date", async () => {
    const storage = createMockStorageService({
      getQuizSessionCount: vi.fn().mockResolvedValue(3),
    });
    const cryptoKey = {} as CryptoKey;
    const handler = createM6Handler(storage, cryptoKey);

    const response = await handler(
      buildM6Message('quiz_completed', {
        score_pct: 80,
        question_ids: ['test-001', 'test-002', 'test-003'],
        categories_failed: [],
        completed: true,
        answers_given: 3,
      }),
      mockSender,
    );

    expect(response.success).toBe(true);
    expect(storage.logEvent).toHaveBeenCalledWith(
      'M6',
      expect.objectContaining({ action: 'quiz_completed' }),
      cryptoKey,
    );
    // La prochaine date doit être stockée
    expect(mockLocalStorage['m6_next_quiz_date']).toBeGreaterThan(Date.now());
  });

  it('marque quiz incomplet si completed = false', async () => {
    const storage = createMockStorageService();
    const cryptoKey = {} as CryptoKey;
    const handler = createM6Handler(storage, cryptoKey);

    await handler(
      buildM6Message('quiz_completed', {
        score_pct: 33,
        question_ids: ['test-001'],
        categories_failed: ['urgency'],
        completed: false,
        answers_given: 1,
      }),
      mockSender,
    );

    expect(storage.logEvent).toHaveBeenCalledWith(
      'M6',
      expect.objectContaining({ action: 'quiz_incomplete' }),
      cryptoKey,
    );
    // Pas de prochaine date calculée si incomplet
    expect(mockLocalStorage['m6_next_quiz_date']).toBeUndefined();
  });
});

describe('M6Handler — check_quiz : corpus vide', () => {
  it('retourne skip corpus_unavailable si corpus inaccessible', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const storage = createMockStorageService();
    const cryptoKey = {} as CryptoKey;
    const handler = createM6Handler(storage, cryptoKey);

    const response = await handler(buildM6Message('check_quiz'), mockSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('skip');
    expect(response.reason).toBe('corpus_unavailable');
  });
});

describe('M6Handler — action inconnue', () => {
  it('retourne skip unknown_action', async () => {
    const storage = createMockStorageService();
    const cryptoKey = {} as CryptoKey;
    const handler = createM6Handler(storage, cryptoKey);

    const response = await handler(buildM6Message('unknown_action'), mockSender);

    expect(response.success).toBe(false);
    expect(response.action).toBe('skip');
    expect(response.reason).toBe('unknown_action');
  });
});

// ---------------------------------------------------------------------------
// Tests : initBootM6 — ADR-001 SW-BOOT-CONTRACT (TACHE-088)
// ---------------------------------------------------------------------------

describe('initBootM6 — boot happy path (install_date valide)', () => {
  it('TC-M6-BOOT-01 : install_date valide → ready=true, pas d\'incident', async () => {
    const validInstallDate = Date.now() - 30 * 24 * 60 * 60 * 1000; // il y a 30 jours
    mockLocalStorage['m6_install_date'] = validInstallDate;

    const { service, incidents } = createMockIncidentService();
    const diag = await initBootM6(service as IncidentService);

    expect(diag.ready).toBe(true);
    expect(diag.install_date).toBe(validInstallDate);
    expect(diag.last_boot_ts).toBeGreaterThan(0);
    expect(diag.last_incident).toBeUndefined();
    expect(incidents).toHaveLength(0);
  });

  it('TC-M6-BOOT-02 : diagnostics.m6 persisté avec ready=true', async () => {
    const validInstallDate = Date.now() - 7 * 24 * 60 * 60 * 1000;
    mockLocalStorage['m6_install_date'] = validInstallDate;

    const { service } = createMockIncidentService();
    await initBootM6(service as IncidentService);

    const stored = mockLocalStorage['diagnostics.m6'] as Record<string, unknown>;
    expect(stored).toBeDefined();
    expect(stored['ready']).toBe(true);
    expect(stored['install_date']).toBe(validInstallDate);
    expect(typeof stored['last_boot_ts']).toBe('number');
  });

  it('TC-M6-BOOT-03 : readM6Diagnostics retourne l\'état persisté après boot', async () => {
    const validInstallDate = Date.now() - 14 * 24 * 60 * 60 * 1000;
    mockLocalStorage['m6_install_date'] = validInstallDate;

    const { service } = createMockIncidentService();
    await initBootM6(service as IncidentService);

    const diag = await readM6Diagnostics();
    expect(diag.ready).toBe(true);
    expect(diag.install_date).toBe(validInstallDate);
  });
});

describe('initBootM6 — install_date absent', () => {
  it('TC-M6-BOOT-04 : install_date absent → incident m6_install_date_corrupted (error)', async () => {
    // Aucun install_date dans le storage

    const { service, incidents } = createMockIncidentService();
    const diag = await initBootM6(service as IncidentService);

    // Incident émis
    const corruptedIncident = incidents.find((i) => i.type === 'm6_install_date_corrupted');
    expect(corruptedIncident).toBeDefined();
    expect(corruptedIncident?.severity).toBe('error');

    // Régénération à Date.now() → install_date > 0
    expect(diag.install_date).toBeGreaterThan(0);
    expect(diag.ready).toBe(false); // ready=false car corruption détectée
  });

  it('TC-M6-BOOT-05 : install_date absent → régénération persist dans storage', async () => {
    const { service } = createMockIncidentService();
    await initBootM6(service as IncidentService);

    const stored = mockLocalStorage['m6_install_date'];
    expect(typeof stored).toBe('number');
    expect(stored as number).toBeGreaterThan(0);
  });

  it('TC-M6-BOOT-06 : diagnostics.m6.last_incident reflète la corruption', async () => {
    const { service } = createMockIncidentService();
    const diag = await initBootM6(service as IncidentService);

    expect(diag.last_incident).toBeDefined();
    expect(diag.last_incident?.type).toBe('m6_install_date_corrupted');
    expect(diag.last_incident?.severity).toBe('error');
    expect(diag.last_incident?.ts).toBeGreaterThan(0);
  });
});

describe('initBootM6 — install_date corrompu (type invalide)', () => {
  it('TC-M6-BOOT-07 : install_date = string → incident m6_install_date_corrupted', async () => {
    mockLocalStorage['m6_install_date'] = 'not-a-number';

    const { service, incidents } = createMockIncidentService();
    const diag = await initBootM6(service as IncidentService);

    const corruptedIncident = incidents.find((i) => i.type === 'm6_install_date_corrupted');
    expect(corruptedIncident).toBeDefined();
    expect(corruptedIncident?.severity).toBe('error');
    // Régénération
    expect(diag.install_date).toBeGreaterThan(0);
  });

  it('TC-M6-BOOT-08 : install_date = 0 → invalide → régénération', async () => {
    mockLocalStorage['m6_install_date'] = 0;

    const { service, incidents } = createMockIncidentService();
    const diag = await initBootM6(service as IncidentService);

    expect(incidents.some((i) => i.type === 'm6_install_date_corrupted')).toBe(true);
    expect(diag.install_date).toBeGreaterThan(0);
  });

  it('TC-M6-BOOT-09 : install_date dans le futur lointain → invalide → régénération', async () => {
    // Timestamp futur de 1 heure (dépassant la tolérance de 5 minutes)
    mockLocalStorage['m6_install_date'] = Date.now() + 60 * 60 * 1000;

    const { service, incidents } = createMockIncidentService();
    await initBootM6(service as IncidentService);

    expect(incidents.some((i) => i.type === 'm6_install_date_corrupted')).toBe(true);
  });
});

describe('initBootM6 — migration clé legacy m6_quiz_deferred', () => {
  it('TC-M6-BOOT-10 : clé legacy m6_quiz_deferred supprimée au boot (migration one-shot)', async () => {
    const validInstallDate = Date.now() - 7 * 24 * 60 * 60 * 1000;
    mockLocalStorage['m6_install_date'] = validInstallDate;
    // Simuler la présence de l'ancienne clé
    mockLocalStorage['m6_quiz_deferred'] = Date.now() + 86400000;

    const { service } = createMockIncidentService();
    await initBootM6(service as IncidentService);

    // La clé legacy doit avoir été supprimée
    expect(mockLocalStorage['m6_quiz_deferred']).toBeUndefined();
  });

  it('TC-M6-BOOT-11 : pending_m6_quiz non périmé conservé au boot', async () => {
    const validInstallDate = Date.now() - 7 * 24 * 60 * 60 * 1000;
    mockLocalStorage['m6_install_date'] = validInstallDate;
    // Pending intent valide (non périmé)
    const futureExpiry = Date.now() + PENDING_M6_QUIZ_TTL_MS;
    mockLocalStorage[PENDING_M6_QUIZ_KEY] = { expires_at: futureExpiry };

    const { service, incidents } = createMockIncidentService();
    await initBootM6(service as IncidentService);

    // Le pending intent non périmé doit être conservé
    expect(mockLocalStorage[PENDING_M6_QUIZ_KEY]).toBeDefined();
    // Aucun incident quiz_deferred_stale
    expect(incidents.some((i) => i.type === 'quiz_deferred_stale')).toBe(false);
  });

  it('TC-M6-BOOT-12 : pending_m6_quiz périmé → incident quiz_deferred_stale (warn) + suppression', async () => {
    const validInstallDate = Date.now() - 7 * 24 * 60 * 60 * 1000;
    mockLocalStorage['m6_install_date'] = validInstallDate;
    // Pending intent périmé (expires_at dans le passé)
    mockLocalStorage[PENDING_M6_QUIZ_KEY] = { expires_at: Date.now() - 1000 };

    const { service, incidents } = createMockIncidentService();
    await initBootM6(service as IncidentService);

    // Incident quiz_deferred_stale (warn)
    const staleIncident = incidents.find((i) => i.type === 'quiz_deferred_stale');
    expect(staleIncident).toBeDefined();
    expect(staleIncident?.severity).toBe('warn');

    // Clé supprimée (purge one-shot)
    expect(mockLocalStorage[PENDING_M6_QUIZ_KEY]).toBeUndefined();
  });
});

describe('initBootM6 — état initial conservatif', () => {
  it('TC-M6-BOOT-13 : diagnostics.m6 posé à ready=false au début du boot', async () => {
    const validInstallDate = Date.now() - 7 * 24 * 60 * 60 * 1000;
    mockLocalStorage['m6_install_date'] = validInstallDate;

    let conservativeStateObserved = false;
    let callCount = 0;
    (global.chrome.storage.local.set as ReturnType<typeof vi.fn>).mockImplementation(
      (items: Record<string, unknown>, callback?: () => void) => {
        callCount++;
        if (callCount === 1 && items['diagnostics.m6']) {
          const diag = items['diagnostics.m6'] as Record<string, unknown>;
          if (diag['ready'] === false) {
            conservativeStateObserved = true;
          }
        }
        Object.assign(mockLocalStorage, items);
        callback?.();
      },
    );

    const { service } = createMockIncidentService();
    await initBootM6(service as IncidentService);

    expect(conservativeStateObserved).toBe(true);
  });

  it('TC-M6-BOOT-14 : readM6Diagnostics retourne défaut si diagnostics.m6 absent', async () => {
    const diag = await readM6Diagnostics();

    expect(diag.ready).toBe(false);
    expect(diag.last_boot_ts).toBe(0);
    expect(diag.install_date).toBe(0);
  });
});
