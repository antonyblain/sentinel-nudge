/**
 * @file tests/unit/levenshtein.test.ts
 * @description Tests unitaires de l'algorithme de distance de Levenshtein.
 */

import { describe, it, expect } from 'vitest';
import { levenshteinDistance } from '@/shared/utils/levenshtein';

describe('levenshteinDistance', () => {
  it('retourne 0 pour deux chaînes identiques', () => {
    expect(levenshteinDistance('paypal.com', 'paypal.com')).toBe(0);
  });

  it('retourne la longueur de b si a est vide', () => {
    expect(levenshteinDistance('', 'abc')).toBe(3);
  });

  it('retourne la longueur de a si b est vide', () => {
    expect(levenshteinDistance('abc', '')).toBe(3);
  });

  it('détecte le typosquatting paypa1.com → paypal.com (distance 1)', () => {
    expect(levenshteinDistance('paypa1.com', 'paypal.com')).toBe(1);
  });

  it('détecte le typosquatting g00gle.com → google.com (distance 2)', () => {
    expect(levenshteinDistance('g00gle.com', 'google.com')).toBe(2);
  });

  it('retourne 1 pour une substitution unique', () => {
    expect(levenshteinDistance('kitten', 'sitten')).toBe(1);
  });

  it('retourne 3 pour kitten → sitting (exemple classique)', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
  });

  it('ne détecte pas de typosquatting pour un domaine très différent', () => {
    expect(levenshteinDistance('amazon.com', 'github.com')).toBeGreaterThan(2);
  });
});
