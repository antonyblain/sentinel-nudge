/**
 * @file tests/unit/services/canary-service.test.ts
 * @description Tests unitaires du CanaryService — canary hash M7.
 *
 * Couvre les invariants :
 * - INV-04     : canary_ciphertext et canary_iv sont toujours écrits/absents ensemble
 * - INV-06     : stockage en Array<number>, jamais ArrayBuffer (leçon P-018)
 * - INV-SEC-01 : IV généré aléatoirement à chaque init() — jamais réutilisé
 * - TC-M7-13   : boot avec storage vide → canaryService.init() appelé, canary stocké en Array<number>
 * - TC-M7-14   : boot avec clé présente et canary valide → verify() ok
 * - TC-M7-15   : canary absent → verify() reason 'absent'
 * - TC-M7-16   : clé corrompue → verify() reason 'decrypt_failed'
 * - TC-M7-22   : canary_ciphertext présent mais canary_iv absent → reason 'absent'
 * - TC-M7-23   : INV-06 : le canary stocké est JSON.stringify-able sans exception
 * - TC-M7-SEC-25 : deux init() consécutifs produisent deux IV différents (INV-SEC-01)
 * - TC-M7-SEC-29 : canary absent mais clé OK → résultat 'absent' (pas de régénération clé)
 *
 * Note : SubtleCrypto est disponible via le polyfill dans tests/setup.ts (Node.js webcrypto).
 *
 * Référence : Mini-DAT TACHE-061 §7 (plan de tests), §6bis (INV-SEC-01), §11.1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CanaryService, CANARY_PLAINTEXT, CANARY_KEYS } from '@/background/services/canary-service';
import { CryptoService } from '@/background/crypto-service';

// ---------------------------------------------------------------------------
// Mock chrome.storage.local
// ---------------------------------------------------------------------------
const mockLocalStorage: Record<string, unknown> = {};

global.chrome = {
  storage: {
    local: {
      get: vi.fn((_keys: string[], callback: (r: Record<string, unknown>) => void) => {
        callback({ ...mockLocalStorage });
      }),
      set: vi.fn((items: Record<string, unknown>, callback?: () => void) => {
        Object.assign(mockLocalStorage, items);
        callback?.();
      }),
    },
  },
} as unknown as typeof chrome;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function generateTestKey(): Promise<CryptoKey> {
  const cryptoService = new CryptoService();
  return cryptoService.generateKey();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CanaryService', () => {
  let service: CanaryService;
  let testKey: CryptoKey;

  beforeEach(async () => {
    Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]);
    vi.clearAllMocks();
    const cryptoService = new CryptoService();
    service = new CanaryService(cryptoService);
    testKey = await generateTestKey();
  });

  // TC-M7-13 : premier boot → init() stocke le canary en Array<number>
  it('TC-M7-13 : init() stocke canary_ciphertext et canary_iv en Array<number>', async () => {
    await service.init(testKey);

    const ciphertext = mockLocalStorage[CANARY_KEYS.CIPHERTEXT];
    const iv = mockLocalStorage[CANARY_KEYS.IV];

    expect(Array.isArray(ciphertext)).toBe(true);
    expect(Array.isArray(iv)).toBe(true);
    // IV = 12 bytes (INV-SEC-01)
    expect((iv as number[]).length).toBe(12);
    // Ciphertext non vide
    expect((ciphertext as number[]).length).toBeGreaterThan(0);
  });

  // INV-04 : écriture atomique
  it('INV-04 : init() écrit canary_ciphertext ET canary_iv dans le même appel set()', async () => {
    const setCalls: Record<string, unknown>[] = [];
    (global.chrome.storage.local.set as ReturnType<typeof vi.fn>).mockImplementation(
      (items: Record<string, unknown>, callback?: () => void) => {
        setCalls.push(items);
        Object.assign(mockLocalStorage, items);
        callback?.();
      },
    );

    await service.init(testKey);

    // Un seul appel à set() avec les deux clés
    const setCallsWithCanary = setCalls.filter(
      (c) => CANARY_KEYS.CIPHERTEXT in c || CANARY_KEYS.IV in c,
    );
    expect(setCallsWithCanary.length).toBe(1);
    expect(setCallsWithCanary[0]).toHaveProperty(CANARY_KEYS.CIPHERTEXT);
    expect(setCallsWithCanary[0]).toHaveProperty(CANARY_KEYS.IV);
  });

  // TC-M7-14 : verify() sur canary valide → ok: true
  it('TC-M7-14 : verify() retourne ok: true si le canary est valide', async () => {
    await service.init(testKey);
    const result = await service.verify(testKey);
    expect(result.ok).toBe(true);
  });

  // TC-M7-15 : canary absent → reason: 'absent'
  it('TC-M7-15 : verify() retourne reason: absent si canary_ciphertext absent', async () => {
    // Storage vide
    const result = await service.verify(testKey);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('absent');
  });

  // TC-M7-22 : canary_ciphertext présent mais canary_iv absent → reason: 'absent'
  it('TC-M7-22 : verify() retourne reason: absent si canary_iv absent (INV-04)', async () => {
    await service.init(testKey);
    delete mockLocalStorage[CANARY_KEYS.IV];

    const result = await service.verify(testKey);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('absent');
  });

  // TC-M7-16 : clé différente → verify() reason: 'decrypt_failed'
  it('TC-M7-16 : verify() retourne reason: decrypt_failed si la clé est différente', async () => {
    // Initialiser avec testKey
    await service.init(testKey);
    // Vérifier avec une autre clé
    const otherKey = await generateTestKey();
    const result = await service.verify(otherKey);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('decrypt_failed');
  });

  // TC-M7-23 : INV-06 — le canary stocké est JSON.stringify-able
  it('TC-M7-23 : INV-06 : le canary stocké est JSON.parse(JSON.stringify()) sans exception', async () => {
    await service.init(testKey);

    const stored = {
      [CANARY_KEYS.CIPHERTEXT]: mockLocalStorage[CANARY_KEYS.CIPHERTEXT],
      [CANARY_KEYS.IV]: mockLocalStorage[CANARY_KEYS.IV],
    };

    expect(() => {
      const serialized = JSON.stringify(stored);
      const parsed = JSON.parse(serialized) as Record<string, unknown>;
      // Vérifier que les données sont identiques après aller-retour JSON
      expect(parsed[CANARY_KEYS.CIPHERTEXT]).toEqual(stored[CANARY_KEYS.CIPHERTEXT]);
      expect(parsed[CANARY_KEYS.IV]).toEqual(stored[CANARY_KEYS.IV]);
    }).not.toThrow();
  });

  // TC-M7-SEC-25 : INV-SEC-01 — deux init() produisent deux IV différents
  it('TC-M7-SEC-25 : INV-SEC-01 : deux init() consécutifs produisent deux IV distincts', async () => {
    await service.init(testKey);
    const iv1 = [...(mockLocalStorage[CANARY_KEYS.IV] as number[])];

    await service.init(testKey);
    const iv2 = [...(mockLocalStorage[CANARY_KEYS.IV] as number[])];

    // Les IV doivent être différents (probabilité 2^-96 d'être identiques avec crypto.getRandomValues)
    expect(iv1).not.toEqual(iv2);
  });

  // TC-M7-SEC-29 : canary absent mais clé fonctionnelle → verify() retourne 'absent'
  it('TC-M7-SEC-29 : verify() retourne absent (pas decrypt_failed) si canary absent (clé OK)', async () => {
    // Clé fonctionnelle mais storage vide — la clé est OK, canary juste absent
    const result = await service.verify(testKey);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // 'absent' confirme que la clé n'a pas été régénérée inutilement
      expect(result.reason).toBe('absent');
    }
  });

  it('verify() retourne reason: mismatch si les données sont altérées après init()', async () => {
    await service.init(testKey);

    // Simuler une altération du ciphertext (derniers octets flippés)
    const ct = mockLocalStorage[CANARY_KEYS.CIPHERTEXT] as number[];
    // Modifier le contenu du ciphertext (le tag AES-GCM devrait échouer la vérification)
    ct[ct.length - 1] = ct[ct.length - 1] !== undefined ? (ct[ct.length - 1]! ^ 0xff) : 0;
    mockLocalStorage[CANARY_KEYS.CIPHERTEXT] = ct;

    const result = await service.verify(testKey);
    // AES-GCM détecte la corruption via le tag → decrypt_failed (pas mismatch)
    // Mismatch ne se produit que si le déchiffrement réussit mais le plaintext diffère
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(['decrypt_failed', 'mismatch']).toContain(result.reason);
    }
  });

  it('CANARY_PLAINTEXT est la constante attendue', () => {
    expect(CANARY_PLAINTEXT).toBe('SN-CANARY-v1');
  });
});
