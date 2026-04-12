/**
 * @file tests/unit/modules/m2.test.ts
 * @description Tests unitaires du module M2 — saisie en contexte risqué.
 *
 * Couvre :
 * - analyzeRisks : détection HTTP, HSTS, Levenshtein, exclusions localhost
 * - createM2Handler : validation payload, whitelist, session dedup, signaux insuffisants
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeRisks } from '@/content-scripts/detectors/risk-analyzer';
import { createM2Handler } from '@/background/handlers/m2-handler';
import type { StorageService } from '@/background/storage-service';
import type { NudgeMessage } from '@/shared/types/messages';

// ---------------------------------------------------------------------------
// Setup : mock de chrome.storage.local pour la déduplication de session
// Le browser-adapter wrappant chrome.storage.local avec des callbacks,
// le mock doit respecter la signature callback(result) de l'API Chrome.
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
  tabs: {
    create: vi.fn().mockResolvedValue({}),
  },
  runtime: {
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
    lastError: undefined,
  },
} as unknown as typeof chrome;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Hash de domaine valide (64 chars hex) */
const DOMAIN_HASH_VALID = 'a'.repeat(64);
const DOMAIN_HASH_OTHER = 'b'.repeat(64);

/** Construit un NudgeMessage M2 */
function buildM2Message(payload: Record<string, unknown>, action = 'risk_detected'): NudgeMessage {
  return {
    module: 'M2',
    action,
    payload,
    timestamp: Date.now(),
  };
}

/** Crée un mock de StorageService pour les tests M2 */
function createMockStorage(options: { isWhitelisted?: boolean }): Partial<StorageService> {
  return {
    isWhitelisted: vi.fn().mockResolvedValue(options.isWhitelisted ?? false),
    addToWhitelist: vi.fn().mockResolvedValue(undefined),
    logEvent: vi.fn().mockResolvedValue(1),
  };
}

/** Crée une CryptoKey factice */
function createFakeKey(): CryptoKey {
  return {} as CryptoKey;
}

// ---------------------------------------------------------------------------
// Tests : analyzeRisks
// ---------------------------------------------------------------------------

describe('analyzeRisks', () => {
  it('détecte le signal HTTP pour une URL en http://', () => {
    const result = analyzeRisks('http://example.com/login');
    expect(result.signals).toContain('http');
  });

  it('ne détecte pas le signal HTTP pour une URL en https://', () => {
    const result = analyzeRisks('https://example.com/login');
    expect(result.signals).not.toContain('http');
  });

  it('exclut localhost (SFD CA-M2-07)', () => {
    const result = analyzeRisks('http://localhost:8080/login');
    expect(result.signals).toHaveLength(0);
    expect(result.riskLevel).toBe(0);
  });

  it('exclut 127.0.0.1 (SFD CA-M2-07)', () => {
    const result = analyzeRisks('http://127.0.0.1:3000/login');
    expect(result.signals).toHaveLength(0);
    expect(result.riskLevel).toBe(0);
  });

  it('détecte le typosquatting pour paypa1.com (Levenshtein = 1)', () => {
    const result = analyzeRisks('https://paypa1.com/login');
    expect(result.signals).toContain('levenshtein');
  });

  it('détecte le typosquatting pour g00gle.com (Levenshtein = 2)', () => {
    const result = analyzeRisks('https://g00gle.com/search');
    expect(result.signals).toContain('levenshtein');
  });

  it('ne détecte pas de typosquatting pour un domaine très différent', () => {
    const result = analyzeRisks('https://xyz-sentinel-nudge-test-12345.com/');
    expect(result.signals).not.toContain('levenshtein');
  });

  it('ne détecte pas de typosquatting pour un domaine exact (distance = 0)', () => {
    const result = analyzeRisks('https://paypal.com/login');
    expect(result.signals).not.toContain('levenshtein');
  });

  it('retourne un résultat vide pour une URL invalide', () => {
    const result = analyzeRisks('not-a-valid-url');
    expect(result.signals).toHaveLength(0);
    expect(result.riskLevel).toBe(0);
  });

  it('retourne un riskLevel égal au nombre de signaux (max 4)', () => {
    const result = analyzeRisks('http://paypa1.com/login');
    expect(result.riskLevel).toBe(result.signals.length);
  });

  it('détecte HTTP + levenshtein pour une URL suspecte (≥ 2 signaux)', () => {
    // http:// → signal http, paypa1.com → levenshtein
    const result = analyzeRisks('http://paypa1.com/login');
    expect(result.signals).toContain('http');
    expect(result.signals).toContain('levenshtein');
    expect(result.riskLevel).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Tests : createM2Handler — validation du payload
// ---------------------------------------------------------------------------

describe('createM2Handler — validation du payload', () => {
  beforeEach(() => {
    // Vider la session de déduplication
    mockLocalStorage['m2_session_domains'] = [];
    vi.clearAllMocks();
    // Réinitialiser le mock avec la signature callback
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
  });

  it('rejette une action inconnue', async () => {
    const storage = createMockStorage({});
    const handler = createM2Handler(storage as StorageService, createFakeKey());
    const msg = buildM2Message(
      { signals: ['http', 'hsts_miss'], domain_hash: DOMAIN_HASH_VALID },
      'unknown_action',
    );
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(false);
    expect(response.reason).toBe('unknown_action');
  });

  it('rejette un domain_hash invalide (format incorrect)', async () => {
    const storage = createMockStorage({});
    const handler = createM2Handler(storage as StorageService, createFakeKey());
    const msg = buildM2Message({ signals: ['http', 'hsts_miss'], domain_hash: 'invalid-hash' });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(false);
    expect(response.reason).toBe('invalid_domain_hash');
  });

  it("rejette si signals n'est pas un tableau", async () => {
    const storage = createMockStorage({});
    const handler = createM2Handler(storage as StorageService, createFakeKey());
    const msg = buildM2Message({ signals: 'http', domain_hash: DOMAIN_HASH_VALID });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(false);
    expect(response.reason).toBe('invalid_signals');
  });
});

// ---------------------------------------------------------------------------
// Tests : createM2Handler — logique métier
// ---------------------------------------------------------------------------

describe('createM2Handler — logique métier', () => {
  beforeEach(() => {
    mockLocalStorage['m2_session_domains'] = [];
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
  });

  it('skip si moins de 2 signaux (SFD §2.1)', async () => {
    const storage = createMockStorage({});
    const handler = createM2Handler(storage as StorageService, createFakeKey());
    const msg = buildM2Message({
      signals: ['http'], // 1 seul signal
      domain_hash: DOMAIN_HASH_VALID,
    });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('skip');
    expect(response.reason).toBe('insufficient_signals');
  });

  it('skip si le domaine est en whitelist M2', async () => {
    const storage = createMockStorage({ isWhitelisted: true });
    const handler = createM2Handler(storage as StorageService, createFakeKey());
    const msg = buildM2Message({
      signals: ['http', 'hsts_miss'],
      domain_hash: DOMAIN_HASH_VALID,
    });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('skip');
    expect(response.reason).toBe('whitelisted');
  });

  it('skip si le domaine a déjà été nudgé dans cette session', async () => {
    mockLocalStorage['m2_session_domains'] = [DOMAIN_HASH_VALID];
    const storage = createMockStorage({});
    const handler = createM2Handler(storage as StorageService, createFakeKey());
    const msg = buildM2Message({
      signals: ['http', 'hsts_miss'],
      domain_hash: DOMAIN_HASH_VALID,
    });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('skip');
    expect(response.reason).toBe('session_duplicate');
  });

  it('retourne show quand toutes les conditions sont remplies', async () => {
    const storage = createMockStorage({});
    const handler = createM2Handler(storage as StorageService, createFakeKey());
    const msg = buildM2Message({
      signals: ['http', 'hsts_miss'],
      domain_hash: DOMAIN_HASH_VALID,
    });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('show');
    // Les signaux sont retournés dans data
    expect(response.data?.['signals']).toEqual(['http', 'hsts_miss']);
    expect(response.data?.['domain_hash']).toBe(DOMAIN_HASH_VALID);
  });

  it("enregistre le domaine en session après l'affichage", async () => {
    const storage = createMockStorage({});
    const handler = createM2Handler(storage as StorageService, createFakeKey());
    const msg = buildM2Message({
      signals: ['http', 'hsts_miss'],
      domain_hash: DOMAIN_HASH_VALID,
    });
    await handler(msg, {} as chrome.runtime.MessageSender);

    // La session doit contenir le domaine
    const session = mockLocalStorage['m2_session_domains'] as string[];
    expect(session).toContain(DOMAIN_HASH_VALID);
  });

  it("n'ajoute pas le domaine en session si skip (signaux insuffisants)", async () => {
    const storage = createMockStorage({});
    const handler = createM2Handler(storage as StorageService, createFakeKey());
    const msg = buildM2Message({
      signals: ['http'], // 1 signal → skip
      domain_hash: DOMAIN_HASH_VALID,
    });
    await handler(msg, {} as chrome.runtime.MessageSender);

    const session = (mockLocalStorage['m2_session_domains'] as string[]) ?? [];
    expect(session).not.toContain(DOMAIN_HASH_VALID);
  });

  it("logue l'événement pour M3 quand le nudge est affiché", async () => {
    const storage = createMockStorage({});
    const handler = createM2Handler(storage as StorageService, createFakeKey());
    const msg = buildM2Message({
      signals: ['http', 'hsts_miss'],
      domain_hash: DOMAIN_HASH_VALID,
    });
    await handler(msg, {} as chrome.runtime.MessageSender);

    expect(storage.logEvent).toHaveBeenCalledWith(
      'M2',
      expect.objectContaining({ action: 'shown', signals: ['http', 'hsts_miss'] }),
      expect.anything(),
    );
  });

  it('deux domaines différents dans la même session : les deux sont nudgés', async () => {
    const storage = createMockStorage({});
    const handler = createM2Handler(storage as StorageService, createFakeKey());

    // Premier domaine
    const msg1 = buildM2Message({
      signals: ['http', 'hsts_miss'],
      domain_hash: DOMAIN_HASH_VALID,
    });
    const resp1 = await handler(msg1, {} as chrome.runtime.MessageSender);
    expect(resp1.action).toBe('show');

    // Deuxième domaine différent
    const msg2 = buildM2Message({
      signals: ['http', 'levenshtein'],
      domain_hash: DOMAIN_HASH_OTHER,
    });
    const resp2 = await handler(msg2, {} as chrome.runtime.MessageSender);
    expect(resp2.action).toBe('show');
  });
});

// ---------------------------------------------------------------------------
// Tests : createM2Handler — action overlay_action
// ---------------------------------------------------------------------------

describe('createM2Handler — overlay_action', () => {
  beforeEach(() => {
    mockLocalStorage['m2_session_domains'] = [];
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
  });

  it('ajoute le domaine en whitelist quand user_action=trusted', async () => {
    const storage = createMockStorage({});
    const handler = createM2Handler(storage as StorageService, createFakeKey());
    const msg = buildM2Message(
      { user_action: 'trusted', domain_hash: DOMAIN_HASH_VALID, signals: ['http', 'hsts_miss'] },
      'overlay_action',
    );
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(storage.addToWhitelist).toHaveBeenCalledWith(DOMAIN_HASH_VALID, 'M2');
  });

  it("enregistre l'événement pour dismissed", async () => {
    const storage = createMockStorage({});
    const handler = createM2Handler(storage as StorageService, createFakeKey());
    const msg = buildM2Message(
      { user_action: 'dismissed', domain_hash: DOMAIN_HASH_VALID, signals: ['http', 'hsts_miss'] },
      'overlay_action',
    );
    await handler(msg, {} as chrome.runtime.MessageSender);

    expect(storage.logEvent).toHaveBeenCalledWith(
      'M2',
      expect.objectContaining({ action: 'dismissed' }),
      expect.anything(),
    );
  });

  it('rejette un payload sans user_action', async () => {
    const storage = createMockStorage({});
    const handler = createM2Handler(storage as StorageService, createFakeKey());
    const msg = buildM2Message({ domain_hash: DOMAIN_HASH_VALID }, 'overlay_action');
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(false);
    expect(response.reason).toBe('invalid_overlay_payload');
  });
});
