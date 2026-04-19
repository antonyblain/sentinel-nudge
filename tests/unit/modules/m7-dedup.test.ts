/**
 * @file tests/unit/modules/m7-dedup.test.ts
 * @description Tests unitaires de la déduplication M7 (INV-UC03-04).
 *
 * Vérifie :
 * - TC-UC03-DEDUP-01 : 2 messages identiques dans la fenêtre 2s → 2e retourne
 *   action:'skip', reason:'deduplicated' ; addPasswordHash appelé 1 seule fois
 * - TC-UC03-DEDUP-02 : 2 messages identiques séparés de 3s → les 2 sont traités
 * - TC-UC03-DEDUP-03 : 2 messages de hash différent mais même domain → les 2 sont traités
 *
 * Référence : mini-DAT TACHE-070 §INV-UC03-04
 *
 * T-189 : mock inline remplacé par createMockChromeStorage() (wrapper JSON-strict P-018).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createM7Handler, recentSubmits } from '@/background/handlers/m7-handler';
import type { StorageService } from '@/background/storage-service';
import type { NudgeMessage } from '@/shared/types/messages';
import type { HeartbeatService } from '@/background/services/heartbeat-service';
import type { IncidentService } from '@/background/services/incident-service';
import { createMockChromeStorage } from '../../helpers/mock-chrome-storage';

// ---------------------------------------------------------------------------
// Mock chrome.storage.local — wrapper JSON-strict T-189 / P-018
// ---------------------------------------------------------------------------

const { storage, reset: resetStorage } = createMockChromeStorage();

global.chrome = {
  storage: {
    local: storage,
  },
  tabs: {
    create: vi.fn().mockResolvedValue({}),
  },
  runtime: {
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
  },
} as unknown as typeof chrome;

/** Hash valide (64 chars hex) */
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const DOMAIN_HASH_1 = '1'.repeat(64);

function buildM7Message(
  payload: Record<string, unknown>,
  action = 'password_submitted',
): NudgeMessage {
  return { module: 'M7', action, payload, timestamp: Date.now() };
}

function createMockStorage(): Partial<StorageService> {
  return {
    addPasswordHash: vi.fn().mockResolvedValue(undefined),
    getPasswordHashesByTag: vi.fn().mockResolvedValue([]),
    isWhitelisted: vi.fn().mockResolvedValue(false),
    logEvent: vi.fn().mockResolvedValue(42),
  };
}

function createFakeKey(): CryptoKey {
  return {} as CryptoKey;
}

function createMockServices(): {
  heartbeat: Partial<HeartbeatService>;
  incident: Partial<IncidentService>;
} {
  return {
    heartbeat: { onDetection: vi.fn().mockResolvedValue(undefined) },
    incident: { log: vi.fn().mockResolvedValue(undefined) },
  };
}

describe('M7 déduplication — INV-UC03-04', () => {
  beforeEach(() => {
    // Reset de la Map module-level entre chaque test pour l'isolation
    recentSubmits.clear();
    resetStorage();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // TC-UC03-DEDUP-01 : 2 messages identiques dans la fenêtre 2s
  // → 2e retourne action:'skip', reason:'deduplicated' ; addPasswordHash appelé 1x
  // --------------------------------------------------------------------------
  it('TC-UC03-DEDUP-01 : doublon dans la fenêtre 2s → skip deduplicated, addPasswordHash 1x', async () => {
    const mockStorage = createMockStorage();
    const services = createMockServices();
    const handler = createM7Handler(
      mockStorage as StorageService,
      createFakeKey(),
      services.heartbeat as HeartbeatService,
      services.incident as IncidentService,
    );

    const msg = buildM7Message({ hash: HASH_A, domain_hash: DOMAIN_HASH_1 });

    // 1er appel — traitement normal (no_reuse car storage vide)
    const resp1 = await handler(msg, {} as chrome.runtime.MessageSender);
    expect(resp1.success).toBe(true);
    expect(resp1.action).toBe('skip');
    expect(resp1.reason).toBe('no_reuse');

    // 2e appel identique dans la fenêtre 2s (< 1ms après)
    const msg2 = buildM7Message({ hash: HASH_A, domain_hash: DOMAIN_HASH_1 });
    const resp2 = await handler(msg2, {} as chrome.runtime.MessageSender);
    expect(resp2.success).toBe(true);
    expect(resp2.action).toBe('skip');
    expect(resp2.reason).toBe('deduplicated');

    // addPasswordHash n'a été appelé qu'une seule fois (le 2e est droppé avant)
    expect(mockStorage.addPasswordHash).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------------------------------
  // TC-UC03-DEDUP-02 : 2 messages identiques séparés de 3s → les 2 traités
  // --------------------------------------------------------------------------
  it('TC-UC03-DEDUP-02 : doublon séparé de 3s → fenêtre expirée → les 2 traités', async () => {
    const mockStorage = createMockStorage();
    const services = createMockServices();
    const handler = createM7Handler(
      mockStorage as StorageService,
      createFakeKey(),
      services.heartbeat as HeartbeatService,
      services.incident as IncidentService,
    );

    // 1er message
    const resp1 = await handler(
      buildM7Message({ hash: HASH_A, domain_hash: DOMAIN_HASH_1 }),
      {} as chrome.runtime.MessageSender,
    );
    expect(resp1.reason).toBe('no_reuse');

    // Avancer de 3s (fenêtre de 2s expirée)
    vi.advanceTimersByTime(3_000);

    // 2e message identique — fenêtre expirée → traité à nouveau (no_reuse)
    const resp2 = await handler(
      buildM7Message({ hash: HASH_A, domain_hash: DOMAIN_HASH_1 }),
      {} as chrome.runtime.MessageSender,
    );
    expect(resp2.reason).toBe('no_reuse');

    // addPasswordHash appelé 2 fois (les 2 messages sont traités)
    expect(mockStorage.addPasswordHash).toHaveBeenCalledTimes(2);
  });

  // --------------------------------------------------------------------------
  // TC-UC03-DEDUP-03 : 2 messages de hash différent, même domain → les 2 traités
  // --------------------------------------------------------------------------
  it('TC-UC03-DEDUP-03 : hash différents même domain → les 2 traités', async () => {
    const mockStorage = createMockStorage();
    const services = createMockServices();
    const handler = createM7Handler(
      mockStorage as StorageService,
      createFakeKey(),
      services.heartbeat as HeartbeatService,
      services.incident as IncidentService,
    );

    // 1er message — HASH_A
    const resp1 = await handler(
      buildM7Message({ hash: HASH_A, domain_hash: DOMAIN_HASH_1 }),
      {} as chrome.runtime.MessageSender,
    );
    expect(resp1.reason).toBe('no_reuse');

    // 2e message — HASH_B (différent) même domain
    const resp2 = await handler(
      buildM7Message({ hash: HASH_B, domain_hash: DOMAIN_HASH_1 }),
      {} as chrome.runtime.MessageSender,
    );
    // Pas un doublon (clé différente)
    expect(resp2.reason).toBe('no_reuse');

    // Les 2 ont appelé addPasswordHash
    expect(mockStorage.addPasswordHash).toHaveBeenCalledTimes(2);
  });
});
