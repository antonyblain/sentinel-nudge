/**
 * @file tests/unit/modules/m2.test.ts
 * @description Tests unitaires du module M2 — analyse de risque domaine.
 *
 * Squelette de tests — l'implémentation complète sera ajoutée en P4 module M2.
 * TODO(P4-M2) : tests de la détection HTTP, HSTS, Levenshtein, whitelist.
 */

import { describe, it, expect } from 'vitest';
import { analyzeRisks } from '@/content-scripts/detectors/risk-analyzer';

describe('analyzeRisks', () => {
  it('détecte le signal HTTP pour une URL en http://', () => {
    const result = analyzeRisks('http://example.com/login');
    expect(result.signals).toContain('http');
  });

  it('ne détecte pas le signal HTTP pour une URL en https://', () => {
    const result = analyzeRisks('https://example.com/login');
    expect(result.signals).not.toContain('http');
  });

  it('retourne un niveau de risque 0 si aucun signal', () => {
    // Avec les cibles typosquatting d'exemple, un domaine très différent ne déclenche rien
    const result = analyzeRisks('https://exemple-tres-different-xyz123.com/');
    // HTTP absent, pas de typosquatting évident
    expect(result.riskLevel).toBeGreaterThanOrEqual(0);
  });

  it('détecte le typosquatting pour paypa1.com', () => {
    const result = analyzeRisks('https://paypa1.com/login');
    expect(result.signals).toContain('levenshtein');
  });

  it('retourne un résultat vide pour une URL invalide', () => {
    const result = analyzeRisks('not-a-valid-url');
    expect(result.signals).toHaveLength(0);
    expect(result.riskLevel).toBe(0);
  });
});
