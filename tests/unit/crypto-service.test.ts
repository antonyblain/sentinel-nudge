/**
 * @file tests/unit/crypto-service.test.ts
 * @description Tests unitaires du service de chiffrement AES-256-GCM.
 *
 * Vérifie le cycle complet : generateKey → exportKey → importKey → encrypt → decrypt.
 * Ces tests requièrent l'environnement jsdom avec SubtleCrypto disponible.
 */

import { describe, it, expect } from 'vitest';
import { CryptoService } from '@/background/crypto-service';

describe('CryptoService', () => {
  const service = new CryptoService();

  it('génère une CryptoKey AES-GCM 256 bits', async () => {
    const key = await service.generateKey();
    expect(key).toBeDefined();
    expect(key.type).toBe('secret');
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });
    expect(key.extractable).toBe(true);
    expect(key.usages).toContain('encrypt');
    expect(key.usages).toContain('decrypt');
  });

  it('exporte et ré-importe une clé de manière cohérente', async () => {
    const key = await service.generateKey();
    const material = await service.exportKey(key);

    // Node.js webcrypto retourne un type buffer compatible ArrayBuffer
    expect(material).toBeDefined();
    expect(material.byteLength).toBe(32); // 256 bits = 32 bytes

    const reimportedKey = await service.importKey(material);
    expect(reimportedKey).toBeDefined();
    expect(reimportedKey.extractable).toBe(false); // non extractable après import
  });

  it('chiffre et déchiffre un objet de manière transparente', async () => {
    const key = await service.generateKey();
    const original = { domain_hash: 'abc123', signals: ['http', 'hsts_miss'], score_delta: 5 };

    const { ciphertext, iv } = await service.encrypt(key, original);

    expect(ciphertext).toBeDefined();
    expect(ciphertext.byteLength).toBeGreaterThan(0);
    expect(iv).toBeDefined();
    expect(iv.byteLength).toBe(12); // 96 bits

    const decrypted = (await service.decrypt(key, ciphertext, iv)) as typeof original;
    expect(decrypted).toEqual(original);
  });

  it('produit un IV différent à chaque chiffrement', async () => {
    const key = await service.generateKey();
    const data = { test: 'value' };

    const result1 = await service.encrypt(key, data);
    const result2 = await service.encrypt(key, data);

    // Les IV doivent être différents (générés aléatoirement)
    expect(Buffer.from(result1.iv)).not.toEqual(Buffer.from(result2.iv));
  });

  it('lève une exception si on déchiffre avec une mauvaise clé', async () => {
    const key1 = await service.generateKey();
    const key2 = await service.generateKey();
    const data = { secret: 'test' };

    const { ciphertext, iv } = await service.encrypt(key1, data);

    await expect(service.decrypt(key2, ciphertext, iv)).rejects.toThrow();
  });
});
