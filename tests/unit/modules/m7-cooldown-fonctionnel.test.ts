/**
 * @file tests/unit/modules/m7-cooldown-fonctionnel.test.ts
 * @description Tests unitaires cooldown 30j M7 fonctionnel — TACHE-022.
 *
 * Couvre :
 * - 1er signalement sur un domaine → nudge affiché (action='show')
 * - 2e signalement dans les 30j → skip reason='cooldown_active'
 * - 31e jour → cooldown expiré → nudge affiché à nouveau (action='show')
 * - Interaction suppression_list IndexedDB (bouton "Ne plus afficher")
 * - Domaine dans suppression_list → skip reason='domain_suppressed'
 * - CRITICAL_MODULES bypass quota — M7 dans CRITICAL_MODULES
 * - Pas de nudge si hash non réutilisé inter-domaines
 * - Réutilisation confirmée mais domaine supprimé → pas de nudge
 * - Deux domaines différents : cooldown indépendant par domaine_hash
 *
 * Référence : SFD §2.5.3 (cooldown 30j, suppression_list), TACHE-057 (CRITICAL_MODULES)
 *
 * T-189 : mock inline remplacé par createMockChromeStorage() (wrapper JSON-strict P-018).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createM7Handler, recentSubmits } from '@/background/handlers/m7-handler';
import { CRITICAL_MODULES } from '@/shared/constants/modules';
import type { StorageService } from '@/background/storage-service';
import type { NudgeMessage } from '@/shared/types/messages';
import type { PasswordHashRecord } from '@/shared/types/storage';
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

// ---------------------------------------------------------------------------
// Constantes de test
// ---------------------------------------------------------------------------

/** Hashes valides 64 chars hex — représentant un vrai domain_hash salé */
const DOMAIN_HASH_EXAMPLE =
  'a3f8c1d2e4b56789' + 'a3f8c1d2e4b56789' + 'a3f8c1d2e4b56789' + 'a3f8c1d2e4b56789';
const DOMAIN_HASH_OTHER =
  'b4e9d0c3f5a67890' + 'b4e9d0c3f5a67890' + 'b4e9d0c3f5a67890' + 'b4e9d0c3f5a67890';
const HASH_PWD_1 = 'c'.repeat(64);
const HASH_PWD_2 = 'd'.repeat(64);

const NUDGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const M7_LAST_NUDGE_KEY = 'm7_last_nudge_by_domain';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildM7Message(
  payload: Record<string, unknown>,
  action = 'password_submitted',
): NudgeMessage {
  return { module: 'M7', action, payload, timestamp: Date.now() };
}

function buildHashRecord(hash: string, domainHash: string, id = 1): PasswordHashRecord {
  return {
    id,
    tag: hash.substring(0, 8),
    value: new ArrayBuffer(32), // Ciphertext factice — passé au mock StorageService, pas à chrome.storage
    iv: new Uint8Array(12),
    domain_hash: domainHash,
    first_seen: Date.now() - 1000,
    count: 1,
  };
}

function createMockStorage(
  options: {
    candidates?: PasswordHashRecord[];
    isSuppressed?: boolean;
  } = {},
): Partial<StorageService> {
  return {
    addPasswordHash: vi.fn().mockResolvedValue(undefined),
    getPasswordHashesByTag: vi.fn().mockResolvedValue(options.candidates ?? []),
    isWhitelisted: vi.fn().mockResolvedValue(options.isSuppressed ?? false),
    addToWhitelist: vi.fn().mockResolvedValue(undefined),
    logEvent: vi.fn().mockResolvedValue(42),
  };
}

function createMockServices(): {
  heartbeat: HeartbeatService;
  incident: IncidentService;
} {
  return {
    heartbeat: { onDetection: vi.fn().mockResolvedValue(undefined) } as unknown as HeartbeatService,
    incident: { log: vi.fn().mockResolvedValue(undefined) } as unknown as IncidentService,
  };
}

/**
 * Crée une CryptoKey fonctionnelle via globalThis.crypto pour les tests de déchiffrement.
 * Nécessaire pour que isPasswordReused() puisse comparer les hashes déchiffrés.
 */
async function createRealKey(): Promise<CryptoKey> {
  return globalThis.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Chiffre un hash de mot de passe pour construire un PasswordHashRecord réel.
 */
async function encryptHash(key: CryptoKey, hash: string): Promise<PasswordHashRecord> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(hash),
  );
  return {
    id: 1,
    tag: hash.substring(0, 8),
    value: ciphertext,
    iv,
    domain_hash: DOMAIN_HASH_OTHER,
    first_seen: Date.now() - 1000,
    count: 1,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  recentSubmits.clear();
  resetStorage();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests CRITICAL_MODULES
// ---------------------------------------------------------------------------

describe('CRITICAL_MODULES — M7 bypass quota', () => {
  it('M7 est dans CRITICAL_MODULES (bypass quota automatique)', () => {
    expect(CRITICAL_MODULES).toContain('M7');
  });

  it('M2 et M17 sont également dans CRITICAL_MODULES', () => {
    expect(CRITICAL_MODULES).toContain('M2');
    expect(CRITICAL_MODULES).toContain('M17');
  });
});

// ---------------------------------------------------------------------------
// Tests cooldown 30j
// ---------------------------------------------------------------------------

describe('M7 cooldown 30j fonctionnel', () => {
  it('TC-M7-COOLDOWN-01 : 1er signalement sur un domaine → action=show', async () => {
    const key = await createRealKey();
    const record = await encryptHash(key, HASH_PWD_1);

    // Candidat avec domain_hash différent → réutilisation inter-domaines
    const mockStorage = createMockStorage({ candidates: [record] });
    const { heartbeat, incident } = createMockServices();
    const handler = createM7Handler(mockStorage as StorageService, key, heartbeat, incident);

    // Aucun nudge précédent → pas de cooldown actif
    const msg = buildM7Message({ hash: HASH_PWD_1, domain_hash: DOMAIN_HASH_EXAMPLE });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.action).toBe('show');
    expect(response.success).toBe(true);
  });

  it('TC-M7-COOLDOWN-02 : 2e signalement dans les 30j → skip reason=cooldown_active', async () => {
    const key = await createRealKey();
    const record = await encryptHash(key, HASH_PWD_1);

    const mockStorage = createMockStorage({ candidates: [record] });
    const { heartbeat, incident } = createMockServices();
    const handler = createM7Handler(mockStorage as StorageService, key, heartbeat, incident);

    // Simuler un nudge récent (il y a 1 heure — dans les 30j)
    const recentTs = Date.now() - 60 * 60 * 1000; // -1h
    await storage.set({ [M7_LAST_NUDGE_KEY]: { [DOMAIN_HASH_EXAMPLE]: recentTs } });

    // Dedup window : hash différent pour éviter déduplication
    const msg = buildM7Message({ hash: HASH_PWD_1, domain_hash: DOMAIN_HASH_EXAMPLE });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('skip');
    expect(response.reason).toBe('cooldown_active');
  });

  it('TC-M7-COOLDOWN-03 : nudge il y a 31j → cooldown expiré → action=show', async () => {
    const key = await createRealKey();
    const record = await encryptHash(key, HASH_PWD_2);

    const mockStorage = createMockStorage({ candidates: [record] });
    const { heartbeat, incident } = createMockServices();
    const handler = createM7Handler(mockStorage as StorageService, key, heartbeat, incident);

    // Nudge il y a 31 jours → cooldown expiré
    const expiredTs = Date.now() - (NUDGE_COOLDOWN_MS + 24 * 60 * 60 * 1000);
    await storage.set({ [M7_LAST_NUDGE_KEY]: { [DOMAIN_HASH_EXAMPLE]: expiredTs } });

    const msg = buildM7Message({ hash: HASH_PWD_2, domain_hash: DOMAIN_HASH_EXAMPLE });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.action).toBe('show');
    expect(response.success).toBe(true);
  });

  it('TC-M7-COOLDOWN-04 : cooldown indépendant par domain_hash (deux domaines)', async () => {
    const key = await createRealKey();
    // On a un hash du même mot de passe sur domain "other"
    const record = await encryptHash(key, HASH_PWD_1);

    const mockStorage = createMockStorage({ candidates: [record] });
    const { heartbeat, incident } = createMockServices();
    const handler = createM7Handler(mockStorage as StorageService, key, heartbeat, incident);

    // DOMAIN_HASH_EXAMPLE a un nudge récent, mais DOMAIN_HASH_OTHER n'en a pas
    const recentTs = Date.now() - 60 * 60 * 1000; // -1h
    await storage.set({ [M7_LAST_NUDGE_KEY]: { [DOMAIN_HASH_EXAMPLE]: recentTs } });

    // Test sur DOMAIN_HASH_OTHER (pas de cooldown) — mais domain_hash = other
    // Pour déclencher réutilisation : hash présent sur DOMAIN_HASH_EXAMPLE (≠ OTHER)
    const recordForOther: PasswordHashRecord = {
      ...record,
      domain_hash: DOMAIN_HASH_EXAMPLE, // hash stocké sous domain 1
    };
    (mockStorage.getPasswordHashesByTag as ReturnType<typeof vi.fn>).mockResolvedValue([
      recordForOther,
    ]);

    const msg = buildM7Message({ hash: HASH_PWD_1, domain_hash: DOMAIN_HASH_OTHER });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    // DOMAIN_HASH_OTHER n'a pas de cooldown → show
    expect(response.action).toBe('show');
  });
});

// ---------------------------------------------------------------------------
// Tests suppression_list
// ---------------------------------------------------------------------------

describe('M7 suppression_list (bouton "Ne plus afficher")', () => {
  it('TC-M7-SUPPRESS-01 : domaine dans suppression_list → skip reason=domain_suppressed', async () => {
    const key = await createRealKey();
    const record = await encryptHash(key, HASH_PWD_1);

    // Domaine dans suppression_list
    const mockStorage = createMockStorage({ candidates: [record], isSuppressed: true });
    const { heartbeat, incident } = createMockServices();
    const handler = createM7Handler(mockStorage as StorageService, key, heartbeat, incident);

    const msg = buildM7Message({ hash: HASH_PWD_1, domain_hash: DOMAIN_HASH_EXAMPLE });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('skip');
    expect(response.reason).toBe('domain_suppressed');
  });

  it('TC-M7-SUPPRESS-02 : action toast_action suppress_domain → addToWhitelist appelé', async () => {
    const key = await createRealKey();
    const mockStorage = createMockStorage({});
    const { heartbeat, incident } = createMockServices();
    const handler = createM7Handler(mockStorage as StorageService, key, heartbeat, incident);

    const msg = buildM7Message(
      { user_action: 'suppress_domain', domain_hash: DOMAIN_HASH_EXAMPLE },
      'toast_action',
    );
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(mockStorage.addToWhitelist).toHaveBeenCalledWith(DOMAIN_HASH_EXAMPLE, 'M7');
  });

  it('TC-M7-SUPPRESS-03 : pas de réutilisation inter-domaines → aucun nudge', async () => {
    const key = await createRealKey();
    // Candidats avec le même domain_hash que la soumission → intra-domaine ignoré
    const record = buildHashRecord(HASH_PWD_1, DOMAIN_HASH_EXAMPLE, 1);
    const mockStorage = createMockStorage({ candidates: [record] });
    const { heartbeat, incident } = createMockServices();
    const handler = createM7Handler(mockStorage as StorageService, key, heartbeat, incident);

    const msg = buildM7Message({ hash: HASH_PWD_1, domain_hash: DOMAIN_HASH_EXAMPLE });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    // Sans déchiffrement réel, getPasswordHashesByTag retourne le record mais
    // le decrypt échouera → pas de réutilisation confirmée
    expect(response.action).toBe('skip');
    expect(response.reason).toBe('no_reuse');
  });
});
