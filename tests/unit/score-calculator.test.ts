/**
 * @file tests/unit/score-calculator.test.ts
 * @description Tests unitaires du calculateur de score hebdomadaire M3.
 *
 * Squelette de tests — l'implémentation complète sera ajoutée en P4 module M3.
 * TODO(P4-M3) : tests des 5 composantes de scoring.
 */

import { describe, it, expect } from 'vitest';
import { ScoreCalculator } from '@/background/score-calculator';

describe('ScoreCalculator.getCurrentWeekKey', () => {
  it('retourne une clé au format YYYY-Www', () => {
    // StorageService mock minimal pour instancier ScoreCalculator
    const mockStorage = {} as Parameters<typeof ScoreCalculator.prototype.constructor>[0];
    const calculator = new ScoreCalculator(mockStorage as never);
    const weekKey = calculator.getCurrentWeekKey();

    expect(weekKey).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('retourne une semaine cohérente avec la date courante', () => {
    const mockStorage = {} as Parameters<typeof ScoreCalculator.prototype.constructor>[0];
    const calculator = new ScoreCalculator(mockStorage as never);
    const weekKey = calculator.getCurrentWeekKey();

    const year = weekKey.split('-W')[0];
    const week = weekKey.split('-W')[1];

    expect(Number(year)).toBeGreaterThanOrEqual(2026);
    expect(Number(week)).toBeGreaterThanOrEqual(1);
    expect(Number(week)).toBeLessThanOrEqual(53);
  });
});
