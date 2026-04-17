/**
 * @file tests/unit/hash.test.ts
 * @description Tests unitaires des fonctions de hachage SHA-256 salé.
 *
 * Vérifie :
 * - La fonction hashPassword retourne un hash de 64 caractères hex
 * - La fonction hashDomain retourne un hash de 64 caractères hex
 * - Deux appels avec les mêmes paramètres retournent le même résultat (déterministe)
 * - Un sel différent produit un hash différent (isolation inter-installations)
 * - extractTag retourne les 8 premiers caractères
 */

import { describe, it, expect } from 'vitest';
import { hashPassword, hashDomain, extractTag } from '@/shared/utils/hash';

describe('hashPassword', () => {
  const salt = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';

  it('retourne une chaîne de 64 caractères hexadécimaux', async () => {
    const hash = await hashPassword(salt, 'monMotDePasse123!');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('est déterministe — même résultat pour les mêmes entrées', async () => {
    const hash1 = await hashPassword(salt, 'password');
    const hash2 = await hashPassword(salt, 'password');
    expect(hash1).toBe(hash2);
  });

  it('produit un hash différent avec un sel différent (isolation D-SEC-001)', async () => {
    const salt2 = 'z9y8x7w6v5u4z9y8x7w6v5u4z9y8x7w6';
    const hash1 = await hashPassword(salt, 'password');
    const hash2 = await hashPassword(salt2, 'password');
    expect(hash1).not.toBe(hash2);
  });

  it('produit un hash différent pour des mots de passe différents', async () => {
    const hash1 = await hashPassword(salt, 'password1');
    const hash2 = await hashPassword(salt, 'password2');
    expect(hash1).not.toBe(hash2);
  });
});

describe('hashDomain', () => {
  const salt = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';

  it('retourne une chaîne de 64 caractères hexadécimaux', async () => {
    const hash = await hashDomain(salt, 'example.com');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('est déterministe', async () => {
    const hash1 = await hashDomain(salt, 'paypal.com');
    const hash2 = await hashDomain(salt, 'paypal.com');
    expect(hash1).toBe(hash2);
  });
});

describe('extractTag', () => {
  it('retourne les 8 premiers caractères du hash', () => {
    const hash = 'a3f2c1b0d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1';
    expect(extractTag(hash)).toBe('a3f2c1b0');
  });

  it('retourne 8 caractères pour un hash quelconque', () => {
    const hash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    expect(extractTag(hash)).toHaveLength(8);
  });
});
