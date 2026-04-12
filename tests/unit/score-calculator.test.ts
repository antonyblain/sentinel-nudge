/**
 * @file tests/unit/score-calculator.test.ts
 * @description Tests de base du calculateur de score hebdomadaire M3.
 *
 * Les tests complets des 5 composantes sont dans tests/unit/modules/m3.test.ts.
 * Ce fichier couvre uniquement getCurrentWeekKey.
 */

import { describe, it, expect } from 'vitest';
import { ScoreCalculator } from '@/background/score-calculator';

describe('ScoreCalculator.getCurrentWeekKey', () => {
  it('retourne une clé au format YYYY-Www', () => {
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
