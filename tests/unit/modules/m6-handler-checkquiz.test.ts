/**
 * @file tests/unit/modules/m6-handler-checkquiz.test.ts
 * @description Tests unitaires handleCheckQuiz M6 — spaced repetition et logique de date.
 *
 * TACHE-021 — Test handleCheckQuiz (date dépassée, quiz disponible).
 *
 * Couvre :
 * - Date de quiz dépassée → action='show' (quiz déclenché)
 * - Date de quiz pas encore atteinte → action='skip' reason='not_scheduled_yet'
 * - Quiz jamais planifié (m6_next_quiz_date absent) → quiz immédiat
 * - pending_m6_quiz présent et valide → quiz déclenché malgré date future
 * - pending_m6_quiz présent mais périmé → skip (purge défensive)
 * - pending_m6_quiz malformé → skip
 * - calculateNextQuizDate : intervalles [0,7,21,42,70] + mensuel après 5 sessions
 * - Score < 50% → prochaine date × 0.7 (intervalle réduit)
 * - Score 100% → prochaine date × 1.2 (intervalle augmenté)
 * - Corruption m6_install_date → fallback Date.now() + pas de reject
 * - Corpus vide → action='skip' reason='corpus_unavailable'
 * - Aucun onglet actif → action='skip' reason='no_active_tab'
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createM6Handler,
  calculateNextQuizDate,
  BASE_INTERVALS_DAYS,
  AFTER_INITIAL_INTERVAL_DAYS,
  INTERVAL_REDUCE_FACTOR,
  INTERVAL_INCREASE_FACTOR,
  LOW_SCORE_THRESHOLD,
  getNextQuizDate,
  getOrInitInstallDate,
  M6_NEXT_QUIZ_DATE_KEY,
  M6_INSTALL_DATE_KEY,
  type CorpusQuestion,
} from '@/background/handlers/m6-handler';
import type { StorageService } from '@/background/storage-service';
import type { NudgeMessage } from '@/shared/types/messages';
import { PENDING_M6_QUIZ_KEY, PENDING_M6_QUIZ_TTL_MS } from '@/shared/types/diagnostics';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockLocalStorage: Record<string, unknown> = {};

// Onglet actif simulé (modifiable par test)
let mockActiveTabs: chrome.tabs.Tab[] = [{ id: 42, active: true, index: 0 } as chrome.tabs.Tab];

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
    // Callback-style conforme au browser-adapter : chrome.tabs.query(queryInfo, callback)
    query: vi.fn((_queryInfo: object, callback: (tabs: chrome.tabs.Tab[]) => void) => {
      callback(mockActiveTabs);
    }),
    // Callback-style conforme au browser-adapter : chrome.tabs.sendMessage(id, msg, callback)
    sendMessage: vi.fn(
      (_tabId: number, _message: unknown, callback: (response: unknown) => void) => {
        callback({});
      },
    ),
  },
  runtime: {
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
    lastError: undefined,
  },
} as unknown as typeof chrome;

// Mock global fetch pour charger le corpus
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ questions: buildMockCorpus() }),
}) as typeof fetch;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Construit un corpus de test minimal FR (5 questions : 4 phishing + 1 légitime) */
function buildMockCorpus(): CorpusQuestion[] {
  return [
    {
      id: 'q-001',
      category: 'urgency',
      difficulty: 'basic',
      locale: 'fr',
      type: 'email',
      is_phishing: true,
      indicators: ['urgence'],
      explanation: 'Explication 1',
      correct_index: 1,
      question_fr: 'Cet email est-il du phishing ?',
      options_fr: ['Oui', 'Non'],
      content: {},
    },
    {
      id: 'q-002',
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
      id: 'q-003',
      category: 'gain',
      difficulty: 'intermediate',
      locale: 'fr',
      type: 'email',
      is_phishing: true,
      indicators: ['gain'],
      explanation: 'Explication 3',
      correct_index: 1,
      question_fr: 'Ce message promet un gain — phishing ?',
      options_fr: ['Oui', 'Non'],
      content: {},
    },
    {
      id: 'q-004',
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
      id: 'q-005',
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

/** Réinitialise le storage et les mocks entre les tests */
function resetAll(): void {
  Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]);
  mockActiveTabs = [{ id: 42, active: true, index: 0 } as chrome.tabs.Tab];
  vi.clearAllMocks();

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
  (global.chrome.tabs.query as ReturnType<typeof vi.fn>).mockImplementation(
    (_queryInfo: object, callback: (tabs: chrome.tabs.Tab[]) => void) => {
      callback(mockActiveTabs);
    },
  );
  (global.chrome.tabs.sendMessage as ReturnType<typeof vi.fn>).mockImplementation(
    (_tabId: number, _message: unknown, callback: (response: unknown) => void) => {
      callback({});
    },
  );
  (global.chrome.runtime.getURL as ReturnType<typeof vi.fn>).mockImplementation(
    (path: string) => `chrome-extension://test-id/${path}`,
  );

  // Corpus accessible par défaut
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    json: async () => ({ questions: buildMockCorpus() }),
  });
}

beforeEach(resetAll);

// ---------------------------------------------------------------------------
// Tests : handleCheckQuiz — logique de date (TACHE-021)
// ---------------------------------------------------------------------------

describe('handleCheckQuiz — date de quiz dépassée → quiz déclenché', () => {
  it('TC-M6-CQ-01 : m6_next_quiz_date dans le passé → action=show', async () => {
    // Date du prochain quiz = il y a 1 heure
    mockLocalStorage[M6_NEXT_QUIZ_DATE_KEY] = Date.now() - 60 * 60 * 1000;

    const storage = createMockStorageService();
    const cryptoKey = {} as CryptoKey;
    const handler = createM6Handler(storage, cryptoKey);

    const response = await handler(buildM6Message('check_quiz'), mockSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('show');
  });

  it('TC-M6-CQ-02 : m6_next_quiz_date absent (jamais planifié) → quiz immédiat (action=show)', async () => {
    // Aucune date dans le storage → firstQuiz
    const storage = createMockStorageService();
    const cryptoKey = {} as CryptoKey;
    const handler = createM6Handler(storage, cryptoKey);

    const response = await handler(buildM6Message('check_quiz'), mockSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('show');
  });

  it('TC-M6-CQ-03 : m6_next_quiz_date=0 (valeur passée) → quiz déclenché', async () => {
    mockLocalStorage[M6_NEXT_QUIZ_DATE_KEY] = 0;

    const storage = createMockStorageService();
    const cryptoKey = {} as CryptoKey;
    const handler = createM6Handler(storage, cryptoKey);

    const response = await handler(buildM6Message('check_quiz'), mockSender);

    // 0 < now → condition (nextQuizDate !== null && now < nextQuizDate) est fausse → quiz
    expect(response.success).toBe(true);
    expect(response.action).toBe('show');
  });
});

describe('handleCheckQuiz — date pas encore atteinte → skip', () => {
  it('TC-M6-CQ-04 : m6_next_quiz_date dans le futur, pas de pending → skip reason=not_scheduled_yet', async () => {
    // Date du prochain quiz dans 7 jours
    mockLocalStorage[M6_NEXT_QUIZ_DATE_KEY] = Date.now() + 7 * 24 * 60 * 60 * 1000;

    const storage = createMockStorageService();
    const cryptoKey = {} as CryptoKey;
    const handler = createM6Handler(storage, cryptoKey);

    const response = await handler(buildM6Message('check_quiz'), mockSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('skip');
    expect(response.reason).toBe('not_scheduled_yet');
  });

  it('TC-M6-CQ-05 : pending_m6_quiz présent mais expires_at périmé → purge + skip', async () => {
    mockLocalStorage[M6_NEXT_QUIZ_DATE_KEY] = Date.now() + 24 * 60 * 60 * 1000;
    // Pending périmé (expires_at dans le passé)
    mockLocalStorage[PENDING_M6_QUIZ_KEY] = { expires_at: Date.now() - 1000 };

    const storage = createMockStorageService();
    const cryptoKey = {} as CryptoKey;
    const handler = createM6Handler(storage, cryptoKey);

    const response = await handler(buildM6Message('check_quiz'), mockSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('skip');
    expect(response.reason).toBe('not_scheduled_yet');
    // Pending périmé doit être purgé
    expect(mockLocalStorage[PENDING_M6_QUIZ_KEY]).toBeUndefined();
  });

  it('TC-M6-CQ-06 : pending_m6_quiz malformé (pas un objet) → skip', async () => {
    mockLocalStorage[M6_NEXT_QUIZ_DATE_KEY] = Date.now() + 24 * 60 * 60 * 1000;
    // Pending malformé
    mockLocalStorage[PENDING_M6_QUIZ_KEY] = 'invalid-string';

    const storage = createMockStorageService();
    const cryptoKey = {} as CryptoKey;
    const handler = createM6Handler(storage, cryptoKey);

    const response = await handler(buildM6Message('check_quiz'), mockSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('skip');
    expect(response.reason).toBe('not_scheduled_yet');
  });
});

// ---------------------------------------------------------------------------
// Tests : handleCheckQuiz — corpus et onglet
// ---------------------------------------------------------------------------

describe('handleCheckQuiz — corpus et onglet actif', () => {
  it('TC-M6-CQ-07 : corpus vide → action=skip reason=corpus_unavailable', async () => {
    // Date dépassée
    mockLocalStorage[M6_NEXT_QUIZ_DATE_KEY] = Date.now() - 1000;
    // Corpus vide
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

  it('TC-M6-CQ-08 : aucun onglet actif → action=skip reason=no_active_tab', async () => {
    // Date dépassée
    mockLocalStorage[M6_NEXT_QUIZ_DATE_KEY] = Date.now() - 1000;
    // Pas d'onglet actif
    mockActiveTabs = [];

    const storage = createMockStorageService();
    const cryptoKey = {} as CryptoKey;
    const handler = createM6Handler(storage, cryptoKey);

    const response = await handler(buildM6Message('check_quiz'), mockSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('skip');
    expect(response.reason).toBe('no_active_tab');
  });

  it('TC-M6-CQ-09 : quiz déclenché → sendMessage envoyé avec questions', async () => {
    // Date dépassée
    mockLocalStorage[M6_NEXT_QUIZ_DATE_KEY] = Date.now() - 1000;

    const storage = createMockStorageService();
    const cryptoKey = {} as CryptoKey;
    const handler = createM6Handler(storage, cryptoKey);

    await handler(buildM6Message('check_quiz'), mockSender);

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        module: 'M6',
        action: 'show_quiz_toast',
        payload: expect.objectContaining({ questions: expect.any(Array) }),
      }),
      expect.any(Function),
    );
  });

  it('TC-M6-CQ-10 : après déclenchement, pending_m6_quiz est purgé (R-CLI-05 one-shot)', async () => {
    mockLocalStorage[M6_NEXT_QUIZ_DATE_KEY] = Date.now() - 1000;
    // Pending présent avant le déclenchement
    mockLocalStorage[PENDING_M6_QUIZ_KEY] = { expires_at: Date.now() + PENDING_M6_QUIZ_TTL_MS };

    const storage = createMockStorageService();
    const cryptoKey = {} as CryptoKey;
    const handler = createM6Handler(storage, cryptoKey);

    await handler(buildM6Message('check_quiz'), mockSender);

    // Purge one-shot après affichage (R-CLI-05)
    expect(mockLocalStorage[PENDING_M6_QUIZ_KEY]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests : calculateNextQuizDate — intervalles [0, 7, 21, 42, 70] + mensuel
// ---------------------------------------------------------------------------

describe('calculateNextQuizDate — intervalles spaced repetition', () => {
  const installDate = new Date('2026-01-01T00:00:00Z').getTime();
  // Premier quiz = date d'install (session 0)
  const lastQuizDate = installDate;

  it('TC-M6-CQ-11 : session 0 → premier quiz immédiat (intervalle=0j depuis install)', () => {
    const next = calculateNextQuizDate(0, 80, installDate, lastQuizDate);
    expect(next).toBe(installDate); // 0 jours depuis install
  });

  it('TC-M6-CQ-12 : session 1 → quiz à J+7 depuis installation', () => {
    const next = calculateNextQuizDate(1, 80, installDate, lastQuizDate);
    const expected = installDate + 7 * 24 * 60 * 60 * 1000;
    expect(next).toBeCloseTo(expected, -3);
  });

  it('TC-M6-CQ-13 : session 2 → quiz à J+21 depuis installation', () => {
    const next = calculateNextQuizDate(2, 80, installDate, lastQuizDate);
    const expected = installDate + 21 * 24 * 60 * 60 * 1000;
    expect(next).toBeCloseTo(expected, -3);
  });

  it('TC-M6-CQ-14 : session 3 → quiz à J+42 depuis installation', () => {
    const next = calculateNextQuizDate(3, 80, installDate, lastQuizDate);
    const expected = installDate + 42 * 24 * 60 * 60 * 1000;
    expect(next).toBeCloseTo(expected, -3);
  });

  it('TC-M6-CQ-15 : session 4 → quiz à J+70 depuis installation', () => {
    const next = calculateNextQuizDate(4, 80, installDate, lastQuizDate);
    const expected = installDate + 70 * 24 * 60 * 60 * 1000;
    expect(next).toBeCloseTo(expected, -3);
  });

  it('TC-M6-CQ-16 : session 5+ → intervalle mensuel (30j) depuis le dernier quiz', () => {
    const recentLastQuiz = new Date('2026-03-01T00:00:00Z').getTime();
    const next = calculateNextQuizDate(5, 80, installDate, recentLastQuiz);
    const expected = recentLastQuiz + AFTER_INITIAL_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
    expect(next).toBe(expected);
  });

  it('TC-M6-CQ-17 : constantes BASE_INTERVALS_DAYS conformes à la SFD §2.4.3', () => {
    expect(BASE_INTERVALS_DAYS).toEqual([0, 7, 21, 42, 70]);
  });
});

describe('calculateNextQuizDate — ajustements de score', () => {
  const installDate = new Date('2026-01-01T00:00:00Z').getTime();
  const recentLastQuiz = new Date('2026-03-01T00:00:00Z').getTime();

  it('TC-M6-CQ-18 : score < 50% → intervalle réduit de 30% (×0.7)', () => {
    const next = calculateNextQuizDate(5, LOW_SCORE_THRESHOLD - 1, installDate, recentLastQuiz);
    const baseInterval = AFTER_INITIAL_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
    const expected = recentLastQuiz + Math.round(baseInterval * INTERVAL_REDUCE_FACTOR);
    expect(next).toBe(expected);
  });

  it('TC-M6-CQ-19 : score = 100% → intervalle augmenté de 20% (×1.2)', () => {
    const next = calculateNextQuizDate(5, 100, installDate, recentLastQuiz);
    const baseInterval = AFTER_INITIAL_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
    const expected = recentLastQuiz + Math.round(baseInterval * INTERVAL_INCREASE_FACTOR);
    expect(next).toBe(expected);
  });

  it('TC-M6-CQ-20 : score entre 50 et 99 → intervalle standard (pas de modification)', () => {
    const next = calculateNextQuizDate(5, 75, installDate, recentLastQuiz);
    const baseInterval = AFTER_INITIAL_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
    const expected = recentLastQuiz + baseInterval;
    expect(next).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Tests : getOrInitInstallDate — fallback corruption
// ---------------------------------------------------------------------------

describe('getOrInitInstallDate — fallback corruption m6_install_date', () => {
  it('TC-M6-CQ-21 : m6_install_date absent → initialise avec Date.now()', async () => {
    const before = Date.now();
    const result = await getOrInitInstallDate();
    const after = Date.now();

    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
    // Persisté dans le storage
    expect(typeof mockLocalStorage[M6_INSTALL_DATE_KEY]).toBe('number');
  });

  it('TC-M6-CQ-22 : m6_install_date valide → retourne la valeur existante', async () => {
    const validTs = Date.now() - 30 * 24 * 60 * 60 * 1000;
    mockLocalStorage[M6_INSTALL_DATE_KEY] = validTs;

    const result = await getOrInitInstallDate();
    expect(result).toBe(validTs);
  });
});

// ---------------------------------------------------------------------------
// Tests : getNextQuizDate
// ---------------------------------------------------------------------------

describe('getNextQuizDate', () => {
  it('TC-M6-CQ-23 : m6_next_quiz_date absent → retourne null', async () => {
    const result = await getNextQuizDate();
    expect(result).toBeNull();
  });

  it('TC-M6-CQ-24 : m6_next_quiz_date présent → retourne la valeur', async () => {
    const futureDate = Date.now() + 7 * 24 * 60 * 60 * 1000;
    mockLocalStorage[M6_NEXT_QUIZ_DATE_KEY] = futureDate;

    const result = await getNextQuizDate();
    expect(result).toBe(futureDate);
  });
});
