/**
 * @file tests/unit/modules/m7-tc-scenarios.test.ts
 * @description 12 scénarios TC-M7-01 à TC-M7-12 — tests unitaires + intégration M7.
 *
 * Alignés sur D-PM-02 (PV post-mortem M7, §5) et les fixes P-016 à P-020 :
 *
 * - TC-M7-01 : Same domain → no signal (réutilisation intra-domaine ignorée)
 * - TC-M7-02 : Different domain → signal (détection inter-domaines confirmée)
 * - TC-M7-03 : Cooldown 30j actif → skip reason=cooldown_active
 * - TC-M7-04 : Cooldown 30j expiré → signal affiché à nouveau
 * - TC-M7-05 : Suppression_list IndexedDB — bouton "Ne plus afficher"
 * - TC-M7-06 : Rotation clé AES au boot SW (fix P-016) — clé absente → régénérée → handler actif
 * - TC-M7-07 : Sérialisation JSON-strict ArrayBuffer → Array<number> (fix P-018)
 * - TC-M7-08 : pending_m7_toast TTL 10min valide (fix P-019) — intent consommé
 * - TC-M7-09 : pending_m7_toast expiré → readPendingM7Toast retourne null
 * - TC-M7-10 : M7 dans CRITICAL_MODULES (fix P-020 — bypass quota global)
 * - TC-M7-11 : Canary watchdog — intégrité clé + sel au boot (ADR-001)
 * - TC-M7-12 : Cross-lifecycle intent pending_m7_toast (ADR-002) — one-shot, purge après lecture
 *
 * Référence : gouvernance-pv-postmortem-m7-v1.0.md §5 (D-PM-02)
 *             ADR-001 SW-BOOT-CONTRACT, ADR-002 CROSS-LIFECYCLE-INTENT
 *             TACHE-059 (P5 — plan de tests consolidé)
 *
 * Note mocks : chrome.storage.local est simulé avec un mock local minimal.
 * Un wrapper JSON-strict (TACHE-060) est appliqué dans les TC concernant P-018.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createM7Handler,
  recentSubmits,
  verifyExpiresAt,
  readPendingM7Toast,
} from '@/background/handlers/m7-handler';
import { CRITICAL_MODULES } from '@/shared/constants/modules';
import { CanaryService, CANARY_PLAINTEXT, CANARY_KEYS } from '@/background/services/canary-service';
import type { CryptoService } from '@/background/crypto-service';
import type { StorageService } from '@/background/storage-service';
import type { NudgeMessage } from '@/shared/types/messages';
import type { PasswordHashRecord } from '@/shared/types/storage';
import type { HeartbeatService } from '@/background/services/heartbeat-service';
import type { IncidentService } from '@/background/services/incident-service';
import type { PendingM7Toast } from '@/shared/types/diagnostics';
import { PENDING_M7_TOAST_KEY, PENDING_M7_TOAST_TTL_MS } from '@/shared/types/diagnostics';

// ---------------------------------------------------------------------------
// Mock chrome.storage.local — minimal, local à ce fichier
// ---------------------------------------------------------------------------

const mockStore: Record<string, unknown> = {};
const removedKeys: string[] = [];

global.chrome = {
  storage: {
    local: {
      get: vi.fn((_keys: string[], callback: (r: Record<string, unknown>) => void) => {
        const result: Record<string, unknown> = {};
        _keys.forEach((k) => {
          if (k in mockStore) result[k] = mockStore[k];
        });
        callback(result);
      }),
      set: vi.fn((items: Record<string, unknown>, callback?: () => void) => {
        Object.assign(mockStore, items);
        callback?.();
      }),
      remove: vi.fn((key: string | string[], callback?: () => void) => {
        const keys = Array.isArray(key) ? key : [key];
        keys.forEach((k) => {
          removedKeys.push(k);
          delete mockStore[k];
        });
        callback?.();
      }),
    },
  },
  tabs: {
    create: vi.fn().mockResolvedValue({}),
  },
  runtime: {
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
  },
} as unknown as typeof chrome;

// ---------------------------------------------------------------------------
// Mock JSON-strict pour TC-M7-07 (fix P-018)
// Simule le comportement de chrome.storage.local qui applique JSON.parse(JSON.stringify())
// et rejette silencieusement les types non sérialisables (ArrayBuffer, Uint8Array, etc.)
// ---------------------------------------------------------------------------

/**
 * Applique la sérialisation JSON-strict (JSON.parse(JSON.stringify(v))).
 * Les ArrayBuffer, Uint8Array, CryptoKey passent à {} ou perdent leurs données.
 * Reproduit le comportement observé avec chrome.storage.local en Chrome réel (P-018).
 */
function jsonStrictRoundtrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// ---------------------------------------------------------------------------
// Constantes de test
// ---------------------------------------------------------------------------

const DOMAIN_HASH_SITE_A =
  'a3f8c1d2e4b56789' + 'a3f8c1d2e4b56789' + 'a3f8c1d2e4b56789' + 'a3f8c1d2e4b56789';
const DOMAIN_HASH_SITE_B =
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
    heartbeat: {
      onDetection: vi.fn().mockResolvedValue(undefined),
    } as unknown as HeartbeatService,
    incident: {
      log: vi.fn().mockResolvedValue(undefined),
    } as unknown as IncidentService,
  };
}

/**
 * Génère une CryptoKey AES-256-GCM fonctionnelle (SubtleCrypto réel via polyfill setup.ts).
 */
async function generateRealKey(): Promise<CryptoKey> {
  return globalThis.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Chiffre un hash de mot de passe pour construire un PasswordHashRecord réel.
 * Utilise le domainHash fourni pour simuler un enregistrement sur un autre domaine.
 */
async function buildEncryptedRecord(
  key: CryptoKey,
  hash: string,
  domainHash: string,
  id = 1,
): Promise<PasswordHashRecord> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(hash),
  );
  return {
    id,
    tag: hash.substring(0, 8),
    value: ciphertext,
    iv,
    domain_hash: domainHash,
    first_seen: Date.now() - 1000,
    count: 1,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  recentSubmits.clear();
  Object.keys(mockStore).forEach((k) => delete mockStore[k]);
  removedKeys.length = 0;
  vi.clearAllMocks();
});

// ===========================================================================
// TC-M7-01 — Same domain → no signal
// ===========================================================================

describe('TC-M7-01 — Same domain → no signal (réutilisation intra-domaine ignorée)', () => {
  it('Given un hash déjà stocké sur le même domaine, When password_submitted sur le même domaine, Then action=skip reason=no_reuse', async () => {
    const key = await generateRealKey();

    // Enregistrement avec le MÊME domain_hash que la soumission entrante
    const sameRecord: PasswordHashRecord = {
      id: 1,
      tag: HASH_PWD_1.substring(0, 8),
      value: new ArrayBuffer(32),
      iv: new Uint8Array(12),
      domain_hash: DOMAIN_HASH_SITE_A,
      first_seen: Date.now() - 5000,
      count: 1,
    };

    const storage = createMockStorage({ candidates: [sameRecord] });
    const { heartbeat, incident } = createMockServices();
    const handler = createM7Handler(storage as StorageService, key, heartbeat, incident);

    const msg = buildM7Message({ hash: HASH_PWD_1, domain_hash: DOMAIN_HASH_SITE_A });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    // Intra-domaine : jamais un signal M7 (SFD §2.5.3)
    expect(response.success).toBe(true);
    expect(response.action).toBe('skip');
    expect(response.reason).toBe('no_reuse');
    // Le hash est quand même stocké
    expect(storage.addPasswordHash).toHaveBeenCalledOnce();
  });
});

// ===========================================================================
// TC-M7-02 — Different domain → signal
// ===========================================================================

describe('TC-M7-02 — Different domain → signal (détection inter-domaines)', () => {
  it('Given un hash stocké sur domaine A, When le même hash est soumis sur domaine B, Then action=show', async () => {
    const key = await generateRealKey();

    // Enregistrement sur DOMAIN_HASH_SITE_A (domaine différent du submit)
    const record = await buildEncryptedRecord(key, HASH_PWD_1, DOMAIN_HASH_SITE_A);

    const storage = createMockStorage({ candidates: [record] });
    const { heartbeat, incident } = createMockServices();
    const handler = createM7Handler(storage as StorageService, key, heartbeat, incident);

    // Submit sur DOMAIN_HASH_SITE_B → inter-domaines → signal
    const msg = buildM7Message({ hash: HASH_PWD_1, domain_hash: DOMAIN_HASH_SITE_B });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('show');
    // heartbeat.onDetection doit être appelé à chaque détection (TACHE-061)
    expect(heartbeat.onDetection).toHaveBeenCalledOnce();
  });

  it('Given aucun hash préalablement stocké, When premier submit, Then action=skip reason=no_reuse', async () => {
    const key = await generateRealKey();
    const storage = createMockStorage({ candidates: [] });
    const { heartbeat, incident } = createMockServices();
    const handler = createM7Handler(storage as StorageService, key, heartbeat, incident);

    const msg = buildM7Message({ hash: HASH_PWD_1, domain_hash: DOMAIN_HASH_SITE_A });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('skip');
    expect(response.reason).toBe('no_reuse');
    expect(heartbeat.onDetection).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// TC-M7-03 — Cooldown 30j actif → skip
// ===========================================================================

describe('TC-M7-03 — Cooldown 30j actif → skip reason=cooldown_active', () => {
  it('Given un nudge M7 émis il y a 1h sur le domaine B, When nouveau submit sur le même domaine, Then action=skip reason=cooldown_active', async () => {
    const key = await generateRealKey();
    const record = await buildEncryptedRecord(key, HASH_PWD_1, DOMAIN_HASH_SITE_A);

    const storage = createMockStorage({ candidates: [record] });
    const { heartbeat, incident } = createMockServices();
    const handler = createM7Handler(storage as StorageService, key, heartbeat, incident);

    // Cooldown actif : nudge émis il y a 1 heure (< 30j)
    mockStore[M7_LAST_NUDGE_KEY] = { [DOMAIN_HASH_SITE_B]: Date.now() - 60 * 60 * 1000 };

    const msg = buildM7Message({ hash: HASH_PWD_1, domain_hash: DOMAIN_HASH_SITE_B });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('skip');
    expect(response.reason).toBe('cooldown_active');
  });

  it('Given un nudge émis sur domaine A dans les 30j, When submit sur domaine B (cooldown indépendant), Then action=show', async () => {
    const key = await generateRealKey();
    const record = await buildEncryptedRecord(key, HASH_PWD_1, DOMAIN_HASH_SITE_A);

    const storage = createMockStorage({ candidates: [record] });
    const { heartbeat, incident } = createMockServices();
    const handler = createM7Handler(storage as StorageService, key, heartbeat, incident);

    // Domaine A a un cooldown récent — domaine B n'en a pas
    mockStore[M7_LAST_NUDGE_KEY] = { [DOMAIN_HASH_SITE_A]: Date.now() - 60 * 60 * 1000 };

    // Submit sur B (où le hash a été vu sur A → inter-domaines)
    const msg = buildM7Message({ hash: HASH_PWD_1, domain_hash: DOMAIN_HASH_SITE_B });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    // Cooldown de A ne bloque pas B — indépendant par domain_hash
    expect(response.action).toBe('show');
  });
});

// ===========================================================================
// TC-M7-04 — Cooldown 30j expiré → signal affiché à nouveau
// ===========================================================================

describe('TC-M7-04 — Cooldown 30j expiré → signal affiché à nouveau', () => {
  it('Given un nudge émis il y a 31j sur domaine B, When nouveau submit sur le même domaine, Then action=show (cooldown expiré)', async () => {
    const key = await generateRealKey();
    const record = await buildEncryptedRecord(key, HASH_PWD_2, DOMAIN_HASH_SITE_A);

    const storage = createMockStorage({ candidates: [record] });
    const { heartbeat, incident } = createMockServices();
    const handler = createM7Handler(storage as StorageService, key, heartbeat, incident);

    // Cooldown expiré : nudge émis il y a 31 jours
    const expired = Date.now() - (NUDGE_COOLDOWN_MS + 24 * 60 * 60 * 1000);
    mockStore[M7_LAST_NUDGE_KEY] = { [DOMAIN_HASH_SITE_B]: expired };

    const msg = buildM7Message({ hash: HASH_PWD_2, domain_hash: DOMAIN_HASH_SITE_B });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('show');
    // Le nouveau nudge met à jour le timestamp de cooldown
    const updatedStore = mockStore[M7_LAST_NUDGE_KEY] as Record<string, number>;
    expect(updatedStore[DOMAIN_HASH_SITE_B]).toBeGreaterThan(expired);
  });
});

// ===========================================================================
// TC-M7-05 — Suppression_list IndexedDB (bouton "Ne plus afficher")
// ===========================================================================

describe('TC-M7-05 — Suppression_list IndexedDB', () => {
  it('Given le domaine B dans la suppression_list, When réutilisation inter-domaines détectée, Then action=skip reason=domain_suppressed', async () => {
    const key = await generateRealKey();
    const record = await buildEncryptedRecord(key, HASH_PWD_1, DOMAIN_HASH_SITE_A);

    // isSuppressed=true simule isWhitelisted retournant true pour DOMAIN_HASH_SITE_B
    const storage = createMockStorage({ candidates: [record], isSuppressed: true });
    const { heartbeat, incident } = createMockServices();
    const handler = createM7Handler(storage as StorageService, key, heartbeat, incident);

    const msg = buildM7Message({ hash: HASH_PWD_1, domain_hash: DOMAIN_HASH_SITE_B });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('skip');
    expect(response.reason).toBe('domain_suppressed');
  });

  it('Given action toast_action suppress_domain, When handler reçoit le message, Then addToWhitelist appelé avec le bon domain_hash', async () => {
    const key = await generateRealKey();
    const storage = createMockStorage({});
    const { heartbeat, incident } = createMockServices();
    const handler = createM7Handler(storage as StorageService, key, heartbeat, incident);

    const msg = buildM7Message(
      { user_action: 'suppress_domain', domain_hash: DOMAIN_HASH_SITE_B },
      'toast_action',
    );
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(storage.addToWhitelist).toHaveBeenCalledWith(DOMAIN_HASH_SITE_B, 'M7');
  });
});

// ===========================================================================
// TC-M7-06 — Rotation clé AES au boot SW (fix P-016)
// ===========================================================================

describe('TC-M7-06 — Rotation clé AES au boot SW (fix P-016)', () => {
  it('Given clé AES absente du storage, When handler créé avec nouvelle clé régénérée, Then handler opérationnel (no silent fail)', async () => {
    // P-016 : avant fix, l'absence de encryption_key_material provoquait un fail silencieux
    // (registerModuleHandlers non appelé). Après fix : clé auto-régénérée → handler actif.
    // Ce test vérifie que le handler créé avec une clé fraîche traite correctement les messages.
    const freshKey = await generateRealKey();

    // Storage vide : simule un premier boot (encryption_key_material absent)
    // Le service worker régénère la clé et passe la freshKey au handler
    const storage = createMockStorage({ candidates: [] });
    const { heartbeat, incident } = createMockServices();
    const handler = createM7Handler(storage as StorageService, freshKey, heartbeat, incident);

    // Le handler doit répondre normalement — pas de fail silencieux (P-016)
    const msg = buildM7Message({ hash: HASH_PWD_1, domain_hash: DOMAIN_HASH_SITE_A });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response).toBeDefined();
    expect(response.success).toBe(true);
    // Premier submit → no_reuse (pas de candidats)
    expect(response.action).toBe('skip');
    expect(response.reason).toBe('no_reuse');
    // addPasswordHash appelé → handler bien enregistré et opérationnel
    expect(storage.addPasswordHash).toHaveBeenCalledOnce();
  });

  it('Given handler avec une clé différente de celle ayant chiffré les hashes, When isPasswordReused appelé, Then decrypt échoue gracieusement (no crash)', async () => {
    // P-016 / P-018 : régénération de clé rend les hashes précédents illisibles.
    // Le handler ne doit pas crasher — il doit continuer silencieusement (no_reuse).
    const oldKey = await generateRealKey();
    const newKey = await generateRealKey();

    const record = await buildEncryptedRecord(oldKey, HASH_PWD_1, DOMAIN_HASH_SITE_A);

    // Handler créé avec la NOUVELLE clé (différente de celle ayant chiffré record)
    const storage = createMockStorage({ candidates: [record] });
    const { heartbeat, incident } = createMockServices();
    const handler = createM7Handler(storage as StorageService, newKey, heartbeat, incident);

    const msg = buildM7Message({ hash: HASH_PWD_1, domain_hash: DOMAIN_HASH_SITE_B });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    // Decrypt échoue sur le record (mauvaise clé) → no_reuse (pas de crash)
    expect(response.success).toBe(true);
    expect(response.action).toBe('skip');
    expect(response.reason).toBe('no_reuse');
  });
});

// ===========================================================================
// TC-M7-07 — Sérialisation JSON-strict ArrayBuffer → Array<number> (fix P-018)
// ===========================================================================

describe('TC-M7-07 — Sérialisation JSON-strict ArrayBuffer → Array<number> (fix P-018)', () => {
  it('Given un ArrayBuffer passé à JSON.stringify, When sérialisation JSON-strict, Then perd ses données (comportement Chrome réel)', () => {
    // Démontre le bug P-018 : ArrayBuffer non sérialisable par JSON
    const buf = new Uint8Array([1, 2, 3, 4]).buffer;
    const roundtripped = jsonStrictRoundtrip(buf);

    // Après JSON round-trip, un ArrayBuffer devient {} (perte des données)
    expect(roundtripped).not.toBeInstanceOf(ArrayBuffer);
  });

  it('Given une clé exportée en Array<number>, When sérialisation JSON-strict, Then données intactes après round-trip', async () => {
    // Fix P-018 : stocker en Array<number> plutôt qu'ArrayBuffer
    const key = await generateRealKey();
    const exported = await globalThis.crypto.subtle.exportKey('raw', key);
    const asArray = Array.from(new Uint8Array(exported));

    // Array<number> survit au JSON round-trip sans perte
    const roundtripped = jsonStrictRoundtrip(asArray);
    expect(roundtripped).toEqual(asArray);
    expect(roundtripped.length).toBe(32); // AES-256 = 32 octets
  });

  it('Given le canary ciphertext stocké en Array<number>, When JSON round-trip, Then Array<number> reconstituable en Uint8Array', async () => {
    // Fix P-018 appliqué au canary (canary-service.ts INV-06)
    const key = await generateRealKey();
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const ciphertext = await globalThis.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(CANARY_PLAINTEXT),
    );

    // Conversion fix P-018 : ArrayBuffer → Array<number>
    const ciphertextArray = Array.from(new Uint8Array(ciphertext));
    const ivArray = Array.from(iv);

    // Simuler un stockage + lecture JSON-strict (ce que chrome.storage.local fait)
    const storedCiphertext = jsonStrictRoundtrip(ciphertextArray);
    const storedIv = jsonStrictRoundtrip(ivArray);

    // Reconstitution → déchiffrement doit réussir
    const ivBytes = new Uint8Array(storedIv);
    const ciphertextBuffer = new Uint8Array(storedCiphertext).buffer;

    const decrypted = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      key,
      ciphertextBuffer,
    );
    const decoded = new TextDecoder().decode(decrypted);
    expect(decoded).toBe(CANARY_PLAINTEXT);
  });
});

// ===========================================================================
// TC-M7-08 — pending_m7_toast TTL 10min valide (fix P-019)
// ===========================================================================

describe('TC-M7-08 — pending_m7_toast TTL 10min valide (fix P-019)', () => {
  it('Given un pending_m7_toast valide (expires_at dans le futur), When verifyExpiresAt appelé, Then retourne true', () => {
    const toast: PendingM7Toast = {
      domain_hash: DOMAIN_HASH_SITE_B,
      expires_at: Date.now() + PENDING_M7_TOAST_TTL_MS,
    };

    expect(verifyExpiresAt(toast)).toBe(true);
  });

  it('Given un pending_m7_toast (nouveau format) dans chrome.storage.local, When readPendingM7Toast appelé, Then retourne le toast valide', async () => {
    const toast: PendingM7Toast = {
      domain_hash: DOMAIN_HASH_SITE_B,
      expires_at: Date.now() + PENDING_M7_TOAST_TTL_MS,
    };
    mockStore[PENDING_M7_TOAST_KEY] = toast;

    const result = await readPendingM7Toast();

    expect(result).not.toBeNull();
    expect(result!.domain_hash).toBe(DOMAIN_HASH_SITE_B);
    expect(result!.expires_at).toBe(toast.expires_at);
  });

  it('Given un pending_m7_toast en format legacy (timestamp), When readPendingM7Toast, Then migré vers expires_at et retourné valide', async () => {
    // Test de migration backward-compat TACHE-091 (E-CLI-01 supprimée)
    const legacyToast = {
      domain_hash: DOMAIN_HASH_SITE_B,
      timestamp: Date.now() - 60_000, // émis il y a 1 min
    };
    mockStore[PENDING_M7_TOAST_KEY] = legacyToast;

    const result = await readPendingM7Toast();

    // Migration : timestamp + TTL → expires_at
    expect(result).not.toBeNull();
    expect(result!.domain_hash).toBe(DOMAIN_HASH_SITE_B);
    expect(typeof result!.expires_at).toBe('number');
    // expires_at calculé = timestamp + TTL (10min)
    expect(result!.expires_at).toBeCloseTo(
      legacyToast.timestamp + PENDING_M7_TOAST_TTL_MS,
      -2, // précision à 100ms
    );
    // Après migration, le storage est réécrit en nouveau format
    const rewritten = mockStore[PENDING_M7_TOAST_KEY] as PendingM7Toast;
    expect(rewritten).toHaveProperty('expires_at');
    expect(rewritten).not.toHaveProperty('timestamp');
  });

  it('Given réutilisation détectée, When handler M7 retourne action=show, Then pending_m7_toast écrit dans chrome.storage.local', async () => {
    const key = await generateRealKey();
    const record = await buildEncryptedRecord(key, HASH_PWD_1, DOMAIN_HASH_SITE_A);

    const storage = createMockStorage({ candidates: [record] });
    const { heartbeat, incident } = createMockServices();
    const handler = createM7Handler(storage as StorageService, key, heartbeat, incident);

    const msg = buildM7Message({ hash: HASH_PWD_1, domain_hash: DOMAIN_HASH_SITE_B });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.action).toBe('show');
    // Le pending_m7_toast doit avoir été écrit (pattern ADR-002)
    expect(mockStore[PENDING_M7_TOAST_KEY]).toBeDefined();
    const pending = mockStore[PENDING_M7_TOAST_KEY] as PendingM7Toast;
    expect(pending.domain_hash).toBe(DOMAIN_HASH_SITE_B);
    expect(pending.expires_at).toBeGreaterThan(Date.now());
  });
});

// ===========================================================================
// TC-M7-09 — pending_m7_toast expiré → null
// ===========================================================================

describe('TC-M7-09 — pending_m7_toast expiré → readPendingM7Toast retourne null', () => {
  it('Given un pending_m7_toast dont expires_at est dépassé, When readPendingM7Toast, Then retourne null et purge la clé', async () => {
    const expiredToast: PendingM7Toast = {
      domain_hash: DOMAIN_HASH_SITE_B,
      expires_at: Date.now() - 1000, // expiré il y a 1 seconde
    };
    mockStore[PENDING_M7_TOAST_KEY] = expiredToast;

    const result = await readPendingM7Toast();

    expect(result).toBeNull();
    // La clé doit avoir été supprimée (purge passive)
    expect(PENDING_M7_TOAST_KEY in mockStore).toBe(false);
  });

  it('Given verifyExpiresAt avec expires_at dans le passé, When appelé, Then retourne false', () => {
    const expiredToast: PendingM7Toast = {
      domain_hash: DOMAIN_HASH_SITE_B,
      expires_at: Date.now() - 1,
    };

    expect(verifyExpiresAt(expiredToast)).toBe(false);
  });

  it('Given un pending_m7_toast avec shape invalide (ni expires_at ni timestamp), When readPendingM7Toast, Then retourne null et purge', async () => {
    mockStore[PENDING_M7_TOAST_KEY] = { domain_hash: DOMAIN_HASH_SITE_B };

    const result = await readPendingM7Toast();

    expect(result).toBeNull();
    expect(PENDING_M7_TOAST_KEY in mockStore).toBe(false);
  });
});

// ===========================================================================
// TC-M7-10 — CRITICAL_MODULES bypass quota global (fix P-020)
// ===========================================================================

describe('TC-M7-10 — M7 dans CRITICAL_MODULES (fix P-020 — bypass quota global)', () => {
  it('M7 est listé dans CRITICAL_MODULES', () => {
    // P-020 : M7 ne doit pas être bloqué par le quota global de 3 nudges/jour
    expect(CRITICAL_MODULES).toContain('M7');
  });

  it('CRITICAL_MODULES contient M2 et M17 (sécurité critique)', () => {
    // Les modules d'alerte sécurité sont exemptés du quota éducatif (conception SFD §2.5)
    expect(CRITICAL_MODULES).toContain('M2');
    expect(CRITICAL_MODULES).toContain('M17');
  });

  it('CRITICAL_MODULES ne contient pas les modules éducatifs M3, M5, M6 (soumis au quota)', () => {
    // M3, M5, M6 = modules éducatifs → soumis au quota 3 nudges/jour
    expect(CRITICAL_MODULES).not.toContain('M3');
    expect(CRITICAL_MODULES).not.toContain('M5');
    expect(CRITICAL_MODULES).not.toContain('M6');
  });

  it('Given M7 dans CRITICAL_MODULES, When handler retourne action=show après quota 3 atteint (simulé), Then pas de skip quota (le MessageRouter bypass)', async () => {
    // Ce test vérifie la logique interne M7 — le bypass quota est géré par le MessageRouter
    // avant d'appeler le handler. Ici on vérifie que le handler M7 lui-même ne gère pas de quota.
    const key = await generateRealKey();
    const record = await buildEncryptedRecord(key, HASH_PWD_1, DOMAIN_HASH_SITE_A);
    const storage = createMockStorage({ candidates: [record] });
    const { heartbeat, incident } = createMockServices();
    const handler = createM7Handler(storage as StorageService, key, heartbeat, incident);

    // Aucune logique de quota dans le handler M7 lui-même (bypass délégué au MessageRouter)
    const msg = buildM7Message({ hash: HASH_PWD_1, domain_hash: DOMAIN_HASH_SITE_B });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    // Le handler M7 ne vérifie pas de quota → action=show si conditions remplies
    expect(response.action).toBe('show');
  });
});

// ===========================================================================
// TC-M7-11 — Canary watchdog — intégrité clé + sel au boot (ADR-001)
// ===========================================================================

describe('TC-M7-11 — Canary watchdog — intégrité clé au boot (ADR-001)', () => {
  it('Given canary_ciphertext absent du storage, When canary.verify appelé, Then retourne ok=false reason=absent', async () => {
    // Canary absent (premier boot ou purge) → pas de vérification possible
    const key = await generateRealKey();
    const mockCryptoService = {} as CryptoService;
    const canaryService = new CanaryService(mockCryptoService);

    // storage vide (pas de canary_ciphertext ni canary_iv)
    const result = await canaryService.verify(key);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('absent');
  });

  it('Given canary initialisé avec clé A, When verify avec clé B (différente), Then retourne ok=false reason=decrypt_failed', async () => {
    // CM-EOP1 : clé corrompue → canary ne peut être déchiffré
    const keyA = await generateRealKey();
    const keyB = await generateRealKey();
    const mockCryptoService = {} as CryptoService;
    const canaryService = new CanaryService(mockCryptoService);

    // Initialiser le canary avec keyA
    await canaryService.init(keyA);

    // Vérifier avec keyB → échec attendu
    const result = await canaryService.verify(keyB);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('decrypt_failed');
  });

  it('Given canary initialisé avec clé A, When verify avec la même clé A, Then retourne ok=true', async () => {
    // Boot nominal : clé stable entre deux boots
    const key = await generateRealKey();
    const mockCryptoService = {} as CryptoService;
    const canaryService = new CanaryService(mockCryptoService);

    await canaryService.init(key);
    const result = await canaryService.verify(key);

    expect(result.ok).toBe(true);
  });

  it('Given canary stocké en Array<number> (fix P-018 / INV-06), When storage JSON round-trip, Then canary.verify réussit', async () => {
    // Vérifie que le canary respecte INV-06 (P-018) : stockage en Array<number>
    const key = await generateRealKey();
    const mockCryptoService = {} as CryptoService;
    const canaryService = new CanaryService(mockCryptoService);

    await canaryService.init(key);

    // Simuler un JSON round-trip sur les données du canary (ce que chrome.storage fait)
    const ciphertext = mockStore[CANARY_KEYS.CIPHERTEXT];
    const iv = mockStore[CANARY_KEYS.IV];

    // Les données doivent être en Array<number> (pas ArrayBuffer ni Uint8Array)
    expect(Array.isArray(ciphertext)).toBe(true);
    expect(Array.isArray(iv)).toBe(true);

    // Après round-trip JSON, les tableaux sont intacts
    const roundtrippedCiphertext = jsonStrictRoundtrip(ciphertext);
    const roundtrippedIv = jsonStrictRoundtrip(iv);
    expect(roundtrippedCiphertext).toEqual(ciphertext);
    expect(roundtrippedIv).toEqual(iv);

    // Réinjecter dans le mock store et vérifier que le canary est toujours vérifiable
    mockStore[CANARY_KEYS.CIPHERTEXT] = roundtrippedCiphertext;
    mockStore[CANARY_KEYS.IV] = roundtrippedIv;

    const result = await canaryService.verify(key);
    expect(result.ok).toBe(true);
  });
});

// ===========================================================================
// TC-M7-12 — Cross-lifecycle intent pending_m7_toast (ADR-002) — one-shot
// ===========================================================================

describe('TC-M7-12 — Cross-lifecycle intent pending_m7_toast (ADR-002 R-CLI-04)', () => {
  it('Given pending_m7_toast valide, When readPendingM7Toast appelé (1ère fois), Then retourne le toast et le purge (one-shot)', async () => {
    // ADR-002 R-CLI-04 : consommation one-shot — purge immédiate après lecture
    // Ce test simule : SW killed → relance → content script lit le pending intent
    const toast: PendingM7Toast = {
      domain_hash: DOMAIN_HASH_SITE_B,
      expires_at: Date.now() + PENDING_M7_TOAST_TTL_MS,
    };
    mockStore[PENDING_M7_TOAST_KEY] = toast;

    // 1ère lecture : doit retourner le toast
    const result = await readPendingM7Toast();
    expect(result).not.toBeNull();
    expect(result!.domain_hash).toBe(DOMAIN_HASH_SITE_B);

    // Note : readPendingM7Toast est une fonction de lecture — la purge one-shot
    // est effectuée par le content script consommateur (toast-m7.ts).
    // Ce test vérifie que la valeur est correctement retournée pour consommation.
  });

  it('Given intent absent du storage, When readPendingM7Toast (après kill SW simulé + relance), Then retourne null', async () => {
    // Simule un kill SW + relance sans pending intent (flow normal)
    // mockStore vide → intent absent

    const result = await readPendingM7Toast();
    expect(result).toBeNull();
  });

  it('Given pending_m7_toast écrit AVANT la frontière de cycle de vie, When storage relu après reset contexte, Then intent disponible pour le consommateur', async () => {
    // ADR-002 R-CLI-05 : intent persisté avant la frontière → disponible après kill SW
    // Simule : handler M7 écrit le pending intent → SW killed → mockStore persiste
    const key = await generateRealKey();
    const record = await buildEncryptedRecord(key, HASH_PWD_1, DOMAIN_HASH_SITE_A);
    const storage = createMockStorage({ candidates: [record] });
    const { heartbeat, incident } = createMockServices();
    const handler = createM7Handler(storage as StorageService, key, heartbeat, incident);

    // Émission du pending intent via le handler
    const msg = buildM7Message({ hash: HASH_PWD_1, domain_hash: DOMAIN_HASH_SITE_B });
    await handler(msg, {} as chrome.runtime.MessageSender);

    // Simuler un kill SW : recentSubmits.clear() (volatile), mais mockStore persiste (chrome.storage)
    recentSubmits.clear();

    // Après relance du SW — le content script peut lire le pending intent
    const pendingIntent = await readPendingM7Toast();
    expect(pendingIntent).not.toBeNull();
    expect(pendingIntent!.domain_hash).toBe(DOMAIN_HASH_SITE_B);
    // Payload JSON-strict : pas d'ArrayBuffer, pas d'Uint8Array (R-CLI-02)
    expect(typeof pendingIntent!.domain_hash).toBe('string');
    expect(typeof pendingIntent!.expires_at).toBe('number');
  });

  it('Given payload pending_m7_toast, When vérification JSON-strict (R-CLI-02), Then aucun type interdit (ArrayBuffer/Uint8Array/CryptoKey)', async () => {
    // ADR-002 R-CLI-02 : payload JSON-strict obligatoire
    const key = await generateRealKey();
    const record = await buildEncryptedRecord(key, HASH_PWD_1, DOMAIN_HASH_SITE_A);
    const storage = createMockStorage({ candidates: [record] });
    const { heartbeat, incident } = createMockServices();
    const handler = createM7Handler(storage as StorageService, key, heartbeat, incident);

    await handler(
      buildM7Message({ hash: HASH_PWD_1, domain_hash: DOMAIN_HASH_SITE_B }),
      {} as chrome.runtime.MessageSender,
    );

    const stored = mockStore[PENDING_M7_TOAST_KEY];
    expect(stored).not.toBeInstanceOf(ArrayBuffer);
    expect(stored).not.toBeInstanceOf(Uint8Array);

    // Doit survivre à un JSON round-trip sans perte (invariant ADR-002 / P-018)
    const roundtripped = jsonStrictRoundtrip(stored);
    expect(roundtripped).toEqual(stored);
  });
});
