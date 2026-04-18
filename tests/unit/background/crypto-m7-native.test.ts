// @vitest-environment node
/**
 * @file tests/unit/background/crypto-m7-native.test.ts
 * @description Tests crypto M7 avec environnement Node.js natif — TACHE-024.
 *
 * Directive @vitest-environment node : SubtleCrypto natif Node.js (pas jsdom).
 * Garantit que les tests crypto fonctionnent en environnement SW réel (pas polyfill).
 *
 * Couvre :
 * - TC-CRYPTO-01 : generateKey → CryptoKey AES-256-GCM extractable
 * - TC-CRYPTO-02 : exportKey → ArrayBuffer 32 bytes
 * - TC-CRYPTO-03 : importKey → CryptoKey non extractable
 * - TC-CRYPTO-04 : encrypt → ciphertext + IV 12 bytes (R-CLI-06)
 * - TC-CRYPTO-05 : decrypt → objet original retrouvé (round-trip)
 * - TC-CRYPTO-06 : IV unique par opération (R-CLI-06)
 * - TC-CRYPTO-07 : sérialisation Array<number> round-trip (P-018 JSON-safe)
 * - TC-CRYPTO-08 : IV fourni (custom) vs IV généré aléatoirement
 * - TC-CRYPTO-09 : comparaison cross-run — clé persistée via Array<number>
 * - TC-CRYPTO-10 : mauvaise clé → rejet DOMException
 * - TC-CRYPTO-11 : ciphertext tronqué → rejet DOMException
 *
 * Référence : DAT §8.2 (AES-256-GCM), P-018 (sérialisation Array<number>),
 *             R-CLI-06 (IV unique par opération), TACHE-024
 */

import { describe, it, expect } from 'vitest';
import { CryptoService } from '@/background/crypto-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convertit un ArrayBuffer en Array<number> (P-018 — sérialisation JSON-safe).
 * Format utilisé pour persister la clé AES dans chrome.storage.local.
 */
function arrayBufferToArray(buffer: ArrayBuffer): number[] {
  return Array.from(new Uint8Array(buffer));
}

/**
 * Recrée un ArrayBuffer depuis un Array<number> (round-trip P-018).
 */
function arrayToArrayBuffer(arr: number[]): ArrayBuffer {
  return new Uint8Array(arr).buffer;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CryptoService — Node.js natif (no jsdom)', () => {
  const service = new CryptoService();

  it('TC-CRYPTO-01 : generateKey → CryptoKey AES-GCM 256 bits extractable', async () => {
    const key = await service.generateKey();

    expect(key).toBeDefined();
    expect(key.type).toBe('secret');
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });
    expect(key.extractable).toBe(true);
    expect(key.usages).toContain('encrypt');
    expect(key.usages).toContain('decrypt');
  });

  it('TC-CRYPTO-02 : exportKey → ArrayBuffer de 32 bytes (256 bits)', async () => {
    const key = await service.generateKey();
    const material = await service.exportKey(key);

    expect(material).toBeDefined();
    expect(material.byteLength).toBe(32); // 256 bits = 32 bytes
  });

  it('TC-CRYPTO-03 : importKey → CryptoKey non extractable', async () => {
    const key = await service.generateKey();
    const material = await service.exportKey(key);
    const imported = await service.importKey(material);

    expect(imported).toBeDefined();
    expect(imported.type).toBe('secret');
    expect(imported.extractable).toBe(false); // non extractable après import
    expect(imported.usages).toContain('encrypt');
    expect(imported.usages).toContain('decrypt');
  });

  it('TC-CRYPTO-04 : encrypt → ciphertext non vide + IV 12 bytes', async () => {
    const key = await service.generateKey();
    const data = { domain_hash: 'a3f8c1d2', nudge_shown: true };

    const { ciphertext, iv } = await service.encrypt(key, data);

    expect(ciphertext).toBeDefined();
    expect(ciphertext.byteLength).toBeGreaterThan(0);
    expect(iv).toBeDefined();
    expect(iv.byteLength).toBe(12); // 96 bits — R-CLI-06
  });

  it('TC-CRYPTO-05 : decrypt → objet original retrouvé (round-trip)', async () => {
    const key = await service.generateKey();
    const original = {
      domain_hash: 'b4e9d0c3f5a678901234567890abcdef',
      signals: ['hsts_miss', 'http'],
      score_delta: 7,
    };

    const { ciphertext, iv } = await service.encrypt(key, original);
    const decrypted = await service.decrypt(key, ciphertext, iv);

    expect(decrypted).toEqual(original);
  });

  it('TC-CRYPTO-06 : IV unique par opération (R-CLI-06)', async () => {
    const key = await service.generateKey();
    const data = { test: 'value' };

    const result1 = await service.encrypt(key, data);
    const result2 = await service.encrypt(key, data);

    // Les IV doivent être différents
    const iv1 = Array.from(result1.iv);
    const iv2 = Array.from(result2.iv);
    expect(iv1).not.toEqual(iv2);
  });

  it('TC-CRYPTO-07 : sérialisation Array<number> round-trip (P-018 JSON-safe)', async () => {
    const key = await service.generateKey();
    const material = await service.exportKey(key);

    // Convertir en Array<number> (format JSON-safe pour chrome.storage.local)
    const asArray = arrayBufferToArray(material);
    expect(Array.isArray(asArray)).toBe(true);
    expect(asArray).toHaveLength(32);
    // Toutes les valeurs sont des entiers 0-255
    expect(asArray.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)).toBe(true);

    // Sérialisation JSON et désérialisation (simuler chrome.storage.local)
    const serialized = JSON.stringify(asArray);
    const deserialized = JSON.parse(serialized) as number[];

    // Round-trip vers ArrayBuffer
    const restored = arrayToArrayBuffer(deserialized);
    const importedKey = await service.importKey(restored);

    // La clé restaurée doit pouvoir chiffrer/déchiffrer
    const data = { test: 'round-trip P-018' };
    const { ciphertext, iv } = await service.encrypt(await service.importKey(material), data);
    const decrypted = await service.decrypt(importedKey, ciphertext, iv);
    expect(decrypted).toEqual(data);
  });

  it('TC-CRYPTO-08 : clé persistée Array<number> → chiffrement cross-session cohérent', async () => {
    // Simuler une session 1 : génération + export + persistance
    const key1 = await service.generateKey();
    const material1 = await service.exportKey(key1);
    const persisted = arrayBufferToArray(material1);

    // Données chiffrées avec la clé session 1
    const original = { password_hash_prefix: 'a3f8', reuse_count: 3 };
    const { ciphertext, iv } = await service.encrypt(key1, original);

    // Simuler une session 2 : re-import depuis persistance
    const material2 = arrayToArrayBuffer(persisted);
    const key2 = await service.importKey(material2);

    // Déchiffrement avec la clé restaurée doit réussir
    const decrypted = await service.decrypt(key2, ciphertext, iv);
    expect(decrypted).toEqual(original);
  });

  it('TC-CRYPTO-09 : IV différent même données → ciphertexts différents', async () => {
    const key = await service.generateKey();
    const data = { secret: 'same-data' };

    const r1 = await service.encrypt(key, data);
    const r2 = await service.encrypt(key, data);

    // Ciphertexts différents (IV différent → résultat différent)
    expect(Buffer.from(r1.ciphertext)).not.toEqual(Buffer.from(r2.ciphertext));
  });

  it('TC-CRYPTO-10 : mauvaise clé → rejet (DOMException)', async () => {
    const key1 = await service.generateKey();
    const key2 = await service.generateKey();
    const data = { secret: 'test' };

    const { ciphertext, iv } = await service.encrypt(key1, data);

    // Déchiffrement avec clé différente → échec
    await expect(service.decrypt(key2, ciphertext, iv)).rejects.toThrow();
  });

  it('TC-CRYPTO-11 : ciphertext tronqué → rejet (données corrompues)', async () => {
    const key = await service.generateKey();
    const data = { test: 'value' };

    const { ciphertext, iv } = await service.encrypt(key, data);

    // Tronquer le ciphertext (simule corruption)
    const truncated = ciphertext.slice(0, Math.floor(ciphertext.byteLength / 2));

    await expect(service.decrypt(key, truncated, iv)).rejects.toThrow();
  });
});
