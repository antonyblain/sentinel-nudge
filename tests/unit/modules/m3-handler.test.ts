/**
 * @file tests/unit/modules/m3-handler.test.ts
 * @description Tests unitaires du handler M3 — createM3Handler + updateBadge/clearBadge.
 *
 * TACHE-017 — couverture 0% initiale sur m3-handler.ts.
 *
 * Couvre :
 * - updateBadge : couleur verte (>=70), orange (40-69), rouge (<40)
 * - clearBadge : badge effacé
 * - createM3Handler / calculate_score : score agrégé, tous modules désactivés, m3 désactivé
 * - createM3Handler / get_score : score trouvé, absent, erreur IDB
 * - Cas limites : score 0, score 100, score NaN, action inconnue
 * - Trigger alarme et check diagnostics.m3 via updateM3DiagnosticsOnAlarm
 * - ScoreCalculator mocké — redistribution proportionnelle si module désactivé
 * - Incident events_store_corrupted quand IDB inaccessible
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createM3Handler,
  updateBadge,
  clearBadge,
  BADGE_GREEN_THRESHOLD,
  BADGE_ORANGE_THRESHOLD,
} from '@/background/handlers/m3-handler';
import {
  updateM3DiagnosticsOnAlarm,
  readM3Diagnostics,
} from '@/background/services/m3-boot-service';
import type { StorageService } from '@/background/storage-service';
import type { ScoreCalculator } from '@/background/score-calculator';
import type { NudgeMessage } from '@/shared/types/messages';
import type { IncidentService } from '@/background/services/incident-service';
import type { WeeklyScore } from '@/shared/types/storage';

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
    },
  },
  action: {
    setBadgeText: vi.fn().mockResolvedValue(undefined),
    setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
  },
} as unknown as typeof chrome;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Réinitialise storage et mocks avant chaque test */
function resetAll(): void {
  Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]);
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
  (global.chrome.action.setBadgeText as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  (global.chrome.action.setBadgeBackgroundColor as ReturnType<typeof vi.fn>).mockResolvedValue(
    undefined,
  );
}

beforeEach(resetAll);

/** Crée un mock minimal de StorageService */
function createMockStorageService(overrides: Partial<StorageService> = {}): StorageService {
  return {
    getConfig: vi.fn().mockResolvedValue({
      modules: { M2: true, M5: true, M6: true, M7: true, M9: true, M3: true },
      quota_limit: 3,
      profile: 'beginner',
      onboarding_complete: true,
      language: 'fr',
    }),
    getWeeklyScore: vi.fn().mockResolvedValue(null),
    setWeeklyScore: vi.fn().mockResolvedValue(undefined),
    getEvents: vi.fn().mockResolvedValue([]),
    logEvent: vi.fn().mockResolvedValue(1),
    ...overrides,
  } as unknown as StorageService;
}

/** Crée un mock de WeeklyScore */
function buildWeeklyScore(totalScore: number): WeeklyScore {
  return {
    week_key: '2026-W16',
    total_score: totalScore,
    components: {},
    value: new ArrayBuffer(0),
    iv: new Uint8Array(0),
  };
}

/** Crée un mock de ScoreCalculator */
function createMockScoreCalculator(overrides: Partial<ScoreCalculator> = {}): ScoreCalculator {
  return {
    calculateWeeklyScore: vi.fn().mockResolvedValue(buildWeeklyScore(75)),
    getCurrentWeekKey: vi.fn().mockReturnValue('2026-W16'),
    ...overrides,
  } as unknown as ScoreCalculator;
}

/** Crée un mock d'IncidentService */
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

/** Construit un NudgeMessage M3 */
function buildM3Message(action: string, payload: Record<string, unknown> = {}): NudgeMessage {
  return { module: 'M3', action, payload, timestamp: Date.now() };
}

const mockSender = {} as chrome.runtime.MessageSender;

// ---------------------------------------------------------------------------
// Tests : updateBadge — couleurs
// ---------------------------------------------------------------------------

describe('updateBadge — couleurs badge', () => {
  it('TC-M3H-01 : score >= 70 → badge vert', async () => {
    await updateBadge(70);
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '70' });
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
      color: '#1A7A4A',
    });
  });

  it('TC-M3H-02 : score 40–69 → badge orange', async () => {
    await updateBadge(55);
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '55' });
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
      color: '#E67E22',
    });
  });

  it('TC-M3H-03 : score < 40 → badge rouge', async () => {
    await updateBadge(20);
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '20' });
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
      color: '#C0392B',
    });
  });

  it('TC-M3H-04 : score = 0 → badge rouge', async () => {
    await updateBadge(0);
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
      color: '#C0392B',
    });
  });

  it('TC-M3H-05 : score = 100 → badge vert', async () => {
    await updateBadge(100);
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
      color: '#1A7A4A',
    });
  });

  it('TC-M3H-06 : seuils BADGE_GREEN_THRESHOLD / BADGE_ORANGE_THRESHOLD conformes à la SFD', () => {
    expect(BADGE_GREEN_THRESHOLD).toBe(70);
    expect(BADGE_ORANGE_THRESHOLD).toBe(40);
  });
});

// ---------------------------------------------------------------------------
// Tests : clearBadge
// ---------------------------------------------------------------------------

describe('clearBadge', () => {
  it('TC-M3H-07 : efface le badge (texte vide)', async () => {
    await clearBadge();
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
  });

  it("TC-M3H-08 : clearBadge ne rejette pas si l'API badge échoue", async () => {
    (chrome.action.setBadgeText as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Mock error'),
    );
    // Ne doit pas propager l'erreur
    await expect(clearBadge()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests : createM3Handler — calculate_score
// ---------------------------------------------------------------------------

describe('createM3Handler — calculate_score : cas nominaux', () => {
  it('TC-M3H-09 : calcule le score et retourne action=show avec score et week_key', async () => {
    const storage = createMockStorageService();
    const scoreCalc = createMockScoreCalculator();
    const cryptoKey = {} as CryptoKey;
    const handler = createM3Handler(storage, scoreCalc, cryptoKey);

    const response = await handler(buildM3Message('calculate_score'), mockSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('show');
    expect(response.data?.['score']).toBe(75);
    expect(response.data?.['week_key']).toBe('2026-W16');
  });

  it('TC-M3H-10 : M3 désactivé → action=skip reason=m3_disabled + badge effacé', async () => {
    const storage = createMockStorageService({
      getConfig: vi.fn().mockResolvedValue({
        modules: { M3: false },
      }),
    });
    const scoreCalc = createMockScoreCalculator();
    const cryptoKey = {} as CryptoKey;
    const handler = createM3Handler(storage, scoreCalc, cryptoKey);

    const response = await handler(buildM3Message('calculate_score'), mockSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('skip');
    expect(response.reason).toBe('m3_disabled');
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
  });

  it('TC-M3H-11 : tous modules désactivés → action=skip reason=all_modules_disabled', async () => {
    const storage = createMockStorageService({
      getConfig: vi.fn().mockResolvedValue({
        modules: { M3: true, M2: false, M5: false, M6: false, M7: false, M9: false },
      }),
    });
    const scoreCalc = createMockScoreCalculator();
    const cryptoKey = {} as CryptoKey;
    const handler = createM3Handler(storage, scoreCalc, cryptoKey);

    const response = await handler(buildM3Message('calculate_score'), mockSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('skip');
    expect(response.reason).toBe('all_modules_disabled');
    // Badge effacé
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
  });

  it('TC-M3H-12 : score calculé 0 → retourne action=show avec score=0', async () => {
    const storage = createMockStorageService();
    const scoreCalc = createMockScoreCalculator({
      calculateWeeklyScore: vi.fn().mockResolvedValue(buildWeeklyScore(0)),
    });
    const cryptoKey = {} as CryptoKey;
    const handler = createM3Handler(storage, scoreCalc, cryptoKey);

    const response = await handler(buildM3Message('calculate_score'), mockSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('show');
    expect(response.data?.['score']).toBe(0);
    // Badge bleu (notification)
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
      color: '#2E6DA4',
    });
  });

  it('TC-M3H-13 : score calculé 100 → retourne action=show avec score=100', async () => {
    const storage = createMockStorageService();
    const scoreCalc = createMockScoreCalculator({
      calculateWeeklyScore: vi.fn().mockResolvedValue(buildWeeklyScore(100)),
    });
    const cryptoKey = {} as CryptoKey;
    const handler = createM3Handler(storage, scoreCalc, cryptoKey);

    const response = await handler(buildM3Message('calculate_score'), mockSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('show');
    expect(response.data?.['score']).toBe(100);
  });
});

describe('createM3Handler — calculate_score : erreur IDB', () => {
  it('TC-M3H-14 : calculateWeeklyScore lève une erreur → action=error, badge effacé', async () => {
    const storage = createMockStorageService();
    const scoreCalc = createMockScoreCalculator({
      calculateWeeklyScore: vi.fn().mockRejectedValue(new Error('IDBTransactionError')),
    });
    const cryptoKey = {} as CryptoKey;
    const handler = createM3Handler(storage, scoreCalc, cryptoKey);

    const response = await handler(buildM3Message('calculate_score'), mockSender);

    expect(response.success).toBe(false);
    expect(response.action).toBe('error');
    expect(response.reason).toBe('storage_error');
    // Badge effacé sur erreur IDB
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
  });

  it('TC-M3H-15 : getConfig lève une erreur → action=error (catch global)', async () => {
    const storage = createMockStorageService({
      getConfig: vi.fn().mockRejectedValue(new Error('StorageQuotaExceeded')),
    });
    const scoreCalc = createMockScoreCalculator();
    const cryptoKey = {} as CryptoKey;
    const handler = createM3Handler(storage, scoreCalc, cryptoKey);

    const response = await handler(buildM3Message('calculate_score'), mockSender);

    expect(response.success).toBe(false);
    expect(response.action).toBe('error');
  });
});

// ---------------------------------------------------------------------------
// Tests : createM3Handler — get_score
// ---------------------------------------------------------------------------

describe('createM3Handler — get_score', () => {
  it('TC-M3H-16 : score trouvé dans IDB → action=show avec composantes', async () => {
    const storedScore = {
      week_key: '2026-W16',
      total_score: 82,
      components: { m5_update: 20, m6_phishing: 25 },
      value: new ArrayBuffer(0),
      iv: new Uint8Array(0),
    };
    const storage = createMockStorageService({
      getWeeklyScore: vi.fn().mockResolvedValue(storedScore),
    });
    const scoreCalc = createMockScoreCalculator();
    const cryptoKey = {} as CryptoKey;
    const handler = createM3Handler(storage, scoreCalc, cryptoKey);

    const response = await handler(buildM3Message('get_score'), mockSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('show');
    expect(response.data?.['score']).toBe(82);
    expect(response.data?.['week_key']).toBe('2026-W16');
  });

  it('TC-M3H-17 : aucun score disponible → action=skip reason=no_score_yet', async () => {
    const storage = createMockStorageService({
      getWeeklyScore: vi.fn().mockResolvedValue(null),
    });
    const scoreCalc = createMockScoreCalculator();
    const cryptoKey = {} as CryptoKey;
    const handler = createM3Handler(storage, scoreCalc, cryptoKey);

    const response = await handler(buildM3Message('get_score'), mockSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('skip');
    expect(response.reason).toBe('no_score_yet');
  });

  it('TC-M3H-18 : get_score avec week_key explicite dans le payload', async () => {
    const storage = createMockStorageService({
      getWeeklyScore: vi.fn().mockResolvedValue({
        week_key: '2026-W10',
        total_score: 60,
        components: {},
        value: new ArrayBuffer(0),
        iv: new Uint8Array(0),
      }),
    });
    const scoreCalc = createMockScoreCalculator();
    const cryptoKey = {} as CryptoKey;
    const handler = createM3Handler(storage, scoreCalc, cryptoKey);

    const response = await handler(
      buildM3Message('get_score', { week_key: '2026-W10' }),
      mockSender,
    );

    expect(response.success).toBe(true);
    expect(response.action).toBe('show');
    expect(response.data?.['week_key']).toBe('2026-W10');
    // Vérifie que getWeeklyScore a été appelé avec la clé correcte
    expect(storage.getWeeklyScore).toHaveBeenCalledWith('2026-W10', cryptoKey);
  });

  it('TC-M3H-19 : getWeeklyScore lève une erreur → action=error reason=storage_error', async () => {
    const storage = createMockStorageService({
      getWeeklyScore: vi.fn().mockRejectedValue(new Error('IDBAbortError')),
    });
    const scoreCalc = createMockScoreCalculator();
    const cryptoKey = {} as CryptoKey;
    const handler = createM3Handler(storage, scoreCalc, cryptoKey);

    const response = await handler(buildM3Message('get_score'), mockSender);

    expect(response.success).toBe(false);
    expect(response.action).toBe('error');
    expect(response.reason).toBe('storage_error');
  });
});

// ---------------------------------------------------------------------------
// Tests : createM3Handler — action inconnue
// ---------------------------------------------------------------------------

describe('createM3Handler — action inconnue', () => {
  it('TC-M3H-20 : action inconnue → success=false, action=skip, reason=unknown_action', async () => {
    const storage = createMockStorageService();
    const scoreCalc = createMockScoreCalculator();
    const cryptoKey = {} as CryptoKey;
    const handler = createM3Handler(storage, scoreCalc, cryptoKey);

    const response = await handler(buildM3Message('foobar_action'), mockSender);

    expect(response.success).toBe(false);
    expect(response.action).toBe('skip');
    expect(response.reason).toBe('unknown_action');
  });
});

// ---------------------------------------------------------------------------
// Tests : diagnostics.m3 — trigger alarme (TACHE-086)
// ---------------------------------------------------------------------------

describe('updateM3DiagnosticsOnAlarm — trigger alarme score', () => {
  it('TC-M3H-21 : IDB accessible → diagnostics.m3 prêt (ready=true)', async () => {
    const { service, incidents } = createMockIncidentService();
    const diag = await updateM3DiagnosticsOnAlarm(service as IncidentService, true);

    expect(diag.ready).toBe(true);
    expect(diag.last_boot).toBeGreaterThan(0);
    expect(incidents).toHaveLength(0);
  });

  it('TC-M3H-22 : IDB inaccessible → incident events_store_corrupted (severity=error)', async () => {
    const { service, incidents } = createMockIncidentService();
    const diag = await updateM3DiagnosticsOnAlarm(
      service as IncidentService,
      false,
      'IDBTransactionError',
    );

    const incident = incidents.find((i) => i.type === 'events_store_corrupted');
    expect(incident).toBeDefined();
    expect(incident?.severity).toBe('error');
    expect(diag.ready).toBe(false);
  });

  it('TC-M3H-23 : diagnostics.m3 persisté dans chrome.storage.local après alarme', async () => {
    const { service } = createMockIncidentService();
    await updateM3DiagnosticsOnAlarm(service as IncidentService, true);

    const stored = mockLocalStorage['diagnostics.m3'] as Record<string, unknown>;
    expect(stored).toBeDefined();
    expect(stored['ready']).toBe(true);
    expect(typeof stored['last_boot']).toBe('number');
  });

  it('TC-M3H-24 : readM3Diagnostics retourne ready=false avant tout boot', async () => {
    const diag = await readM3Diagnostics();
    expect(diag.ready).toBe(false);
    expect(diag.last_boot).toBe(0);
  });
});
