/**
 * @file tests/unit/background/score-calculator-components.test.ts
 * @description Tests unitaires des composantes du ScoreCalculator (TACHE-026).
 *
 * score-calculator.ts était couvert à 73% — ce fichier cible les branches non couvertes :
 * - calculateM5Component (cas upToDate + non upToDate)
 * - calculateM6Component (aucun quiz / quiz en semaine / score_pct connu)
 * - calculateM2Component (0 dismissed / N dismissed / plancher 0)
 * - calculateM7Component (0 réutilisations / N réutilisations)
 * - calculateM9Component (aucune évaluation / mots de passe forts / mélange)
 * - redistributeWeights (tous actifs / module désactivé / tous désactivés)
 * - selectRecommendedAction (première semaine / écart >= 50% / aucun écart / maxWeight=0)
 * - getPreviousWeekKey (semaine 1 → dernière semaine année précédente / semaine > 1)
 *
 * Référence : SFD §2.2.3, DAT §6.1, TACHE-026
 */

import { describe, it, expect } from 'vitest';
import { ScoreCalculator, COMPONENT_WEIGHTS } from '@/background/score-calculator';
import type { ScoreComponents } from '@/background/score-calculator';
import type { EventPayload } from '@/shared/types/storage';

// Factory minimaliste — les tests de composantes n'ont pas besoin d'un vrai storage
function makeCalculator(): ScoreCalculator {
  return new ScoreCalculator({} as never);
}

// ---------------------------------------------------------------------------
// calculateM5Component
// ---------------------------------------------------------------------------

describe('ScoreCalculator.calculateM5Component', () => {
  it('TC-SC-M5-01 : à jour → 20 pts', () => {
    const calc = makeCalculator();
    expect(calc.calculateM5Component(true)).toBe(COMPONENT_WEIGHTS['m5_update']);
  });

  it('TC-SC-M5-02 : pas à jour → 0 pt', () => {
    const calc = makeCalculator();
    expect(calc.calculateM5Component(false)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateM6Component
// ---------------------------------------------------------------------------

describe('ScoreCalculator.calculateM6Component', () => {
  it('TC-SC-M6-01 : aucun événement → 0 pt', () => {
    const calc = makeCalculator();
    expect(calc.calculateM6Component([])).toBe(0);
  });

  it('TC-SC-M6-02 : quiz_completed score_pct=100 → 25 pts', () => {
    const calc = makeCalculator();
    const events: EventPayload[] = [
      { action: 'quiz_completed', module_data: { score_pct: 100 } },
    ];
    expect(calc.calculateM6Component(events)).toBe(25);
  });

  it('TC-SC-M6-03 : quiz_completed score_pct=80 → 20 pts', () => {
    const calc = makeCalculator();
    const events: EventPayload[] = [
      { action: 'quiz_completed', module_data: { score_pct: 80 } },
    ];
    expect(calc.calculateM6Component(events)).toBe(20);
  });

  it('TC-SC-M6-04 : deux quiz — moyenne des score_pct', () => {
    const calc = makeCalculator();
    const events: EventPayload[] = [
      { action: 'quiz_completed', module_data: { score_pct: 100 } },
      { action: 'quiz_completed', module_data: { score_pct: 0 } },
    ];
    // Moyenne = 50% → 50/100 × 25 = 12.5 → arrondi 13
    expect(calc.calculateM6Component(events)).toBe(13);
  });

  it('TC-SC-M6-05 : aucun quiz mais last_known_score_pct connu → score proportionnel', () => {
    const calc = makeCalculator();
    // Pas de quiz_completed, mais last_known_score_pct = 60
    const events: EventPayload[] = [
      { action: 'score_summary', module_data: { last_known_score_pct: 60 } },
    ];
    // 60/100 × 25 = 15
    expect(calc.calculateM6Component(events)).toBe(15);
  });

  it('TC-SC-M6-06 : événements sans score_pct → ignorés', () => {
    const calc = makeCalculator();
    const events: EventPayload[] = [
      { action: 'quiz_completed', module_data: { other_field: 42 } },
    ];
    expect(calc.calculateM6Component(events)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateM2Component
// ---------------------------------------------------------------------------

describe('ScoreCalculator.calculateM2Component', () => {
  it('TC-SC-M2-01 : aucun événement → 20 pts (plein score)', () => {
    const calc = makeCalculator();
    expect(calc.calculateM2Component([])).toBe(20);
  });

  it('TC-SC-M2-02 : 1 dismissed → 20 - 4 = 16 pts', () => {
    const calc = makeCalculator();
    const events: EventPayload[] = [{ action: 'dismissed' }];
    expect(calc.calculateM2Component(events)).toBe(16);
  });

  it('TC-SC-M2-03 : action silent compte comme dismissed', () => {
    const calc = makeCalculator();
    const events: EventPayload[] = [{ action: 'silent' }];
    expect(calc.calculateM2Component(events)).toBe(16);
  });

  it('TC-SC-M2-04 : 5 dismissed → plancher 0 (20 - 5×4 = 0)', () => {
    const calc = makeCalculator();
    const events: EventPayload[] = Array(5).fill({ action: 'dismissed' });
    expect(calc.calculateM2Component(events)).toBe(0);
  });

  it('TC-SC-M2-05 : 10 dismissed → plancher 0 (pas de valeur négative)', () => {
    const calc = makeCalculator();
    const events: EventPayload[] = Array(10).fill({ action: 'dismissed' });
    expect(calc.calculateM2Component(events)).toBe(0);
  });

  it('TC-SC-M2-06 : action accepted → non comptée (score plein)', () => {
    const calc = makeCalculator();
    const events: EventPayload[] = [{ action: 'accepted' }];
    expect(calc.calculateM2Component(events)).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// calculateM7Component
// ---------------------------------------------------------------------------

describe('ScoreCalculator.calculateM7Component', () => {
  it('TC-SC-M7-01 : aucun événement → 20 pts (plein score)', () => {
    const calc = makeCalculator();
    expect(calc.calculateM7Component([])).toBe(20);
  });

  it('TC-SC-M7-02 : 1 réutilisation (shown) → 20 - 4 = 16 pts', () => {
    const calc = makeCalculator();
    const events: EventPayload[] = [{ action: 'shown' }];
    expect(calc.calculateM7Component(events)).toBe(16);
  });

  it('TC-SC-M7-03 : action silent compte comme réutilisation', () => {
    const calc = makeCalculator();
    const events: EventPayload[] = [{ action: 'silent' }];
    expect(calc.calculateM7Component(events)).toBe(16);
  });

  it('TC-SC-M7-04 : 5 réutilisations → plancher 0', () => {
    const calc = makeCalculator();
    const events: EventPayload[] = Array(5).fill({ action: 'shown' });
    expect(calc.calculateM7Component(events)).toBe(0);
  });

  it('TC-SC-M7-05 : action accepted → non comptée', () => {
    const calc = makeCalculator();
    const events: EventPayload[] = [{ action: 'accepted' }];
    expect(calc.calculateM7Component(events)).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// calculateM9Component
// ---------------------------------------------------------------------------

describe('ScoreCalculator.calculateM9Component', () => {
  it('TC-SC-M9-01 : aucune évaluation → 15 pts (indicateur 0/0 = plein score)', () => {
    const calc = makeCalculator();
    expect(calc.calculateM9Component([])).toBe(15);
  });

  it('TC-SC-M9-02 : 1 évaluation forte (score=4) → 15 pts', () => {
    const calc = makeCalculator();
    const events: EventPayload[] = [
      { action: 'evaluated', module_data: { score: 4 } },
    ];
    expect(calc.calculateM9Component(events)).toBe(15);
  });

  it('TC-SC-M9-03 : 1 évaluation faible (score=2) → 0 pt', () => {
    const calc = makeCalculator();
    const events: EventPayload[] = [
      { action: 'evaluated', module_data: { score: 2 } },
    ];
    expect(calc.calculateM9Component(events)).toBe(0);
  });

  it('TC-SC-M9-04 : 2 évaluations 1 forte + 1 faible → 50% × 15 = 8 pts', () => {
    const calc = makeCalculator();
    const events: EventPayload[] = [
      { action: 'evaluated', module_data: { score: 4 } },
      { action: 'evaluated', module_data: { score: 1 } },
    ];
    expect(calc.calculateM9Component(events)).toBe(8);
  });

  it('TC-SC-M9-05 : évaluation sans champ score → ignorée', () => {
    const calc = makeCalculator();
    const events: EventPayload[] = [
      { action: 'evaluated', module_data: { other: 'data' } },
    ];
    // Pas d'évaluation valide → indicateur 0/0 = plein score
    expect(calc.calculateM9Component(events)).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// redistributeWeights
// ---------------------------------------------------------------------------

describe('ScoreCalculator.redistributeWeights', () => {
  const fullComponents: ScoreComponents = {
    m5_update: 20,
    m6_phishing: 25,
    m2_risky_sites: 20,
    m7_password_diversity: 20,
    m9_password_strength: 15,
  };

  it('TC-SC-RW-01 : sans enabledModules → composantes inchangées', () => {
    const calc = makeCalculator();
    const { components, maxWeights } = calc.redistributeWeights(fullComponents, undefined);
    expect(components).toEqual(fullComponents);
    expect(maxWeights['m5_update']).toBe(20);
    expect(maxWeights['m6_phishing']).toBe(25);
  });

  it('TC-SC-RW-02 : tous les modules actifs → composantes inchangées', () => {
    const calc = makeCalculator();
    const enabled = { M5: true, M6: true, M2: true, M7: true, M9: true };
    const { components } = calc.redistributeWeights(fullComponents, enabled);
    expect(components).toEqual(fullComponents);
  });

  it('TC-SC-RW-03 : M5 désactivé → ses 20 pts redistribués aux autres', () => {
    const calc = makeCalculator();
    const enabled = { M5: false, M6: true, M2: true, M7: true, M9: true };
    const { components, maxWeights } = calc.redistributeWeights(fullComponents, enabled);

    // M5 désactivé → 0 pts dans les composantes
    expect(components['m5_update']).toBe(0);
    expect(maxWeights['m5_update']).toBe(0);

    // Les autres modules ont des poids max > standard
    expect(maxWeights['m6_phishing']).toBeGreaterThan(25);
    expect(maxWeights['m2_risky_sites']).toBeGreaterThan(20);

    // Total max = 100 (redistribution proportionfonnelle)
    const totalMax = Object.values(maxWeights).reduce((acc, v) => acc + v, 0);
    expect(Math.round(totalMax)).toBe(100);
  });

  it('TC-SC-RW-04 : tous les modules désactivés → toutes les composantes à 0', () => {
    const calc = makeCalculator();
    const enabled = { M5: false, M6: false, M2: false, M7: false, M9: false };
    const { components, maxWeights } = calc.redistributeWeights(fullComponents, enabled);

    Object.values(components).forEach((v) => expect(v).toBe(0));
    Object.values(maxWeights).forEach((v) => expect(v).toBe(0));
  });

  it('TC-SC-RW-05 : M9 désactivé + score brut plein → scores redistribués corrects', () => {
    const calc = makeCalculator();
    const enabled = { M5: true, M6: true, M2: true, M7: true, M9: false };
    const { components, maxWeights } = calc.redistributeWeights(fullComponents, enabled);

    expect(components['m9_password_strength']).toBe(0);
    expect(maxWeights['m9_password_strength']).toBe(0);

    // Score total redistribué ≈ 100 (les modules actifs récupèrent les 15 pts de M9)
    const totalScore = Math.round(Object.values(components).reduce((acc, v) => acc + v, 0));
    expect(totalScore).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// selectRecommendedAction
// ---------------------------------------------------------------------------

describe('ScoreCalculator.selectRecommendedAction', () => {
  const maxWeights: Record<keyof ScoreComponents, number> = {
    m5_update: 20,
    m6_phishing: 25,
    m2_risky_sites: 20,
    m7_password_diversity: 20,
    m9_password_strength: 15,
  };

  it('TC-SC-SRA-01 : première semaine → message spécial', () => {
    const calc = makeCalculator();
    const components: ScoreComponents = {
      m5_update: 20,
      m6_phishing: 25,
      m2_risky_sites: 20,
      m7_password_diversity: 20,
      m9_password_strength: 15,
    };
    const action = calc.selectRecommendedAction(components, maxWeights, true);
    expect(action).toBe('Votre premier score !');
  });

  it('TC-SC-SRA-02 : score plein sur toutes les composantes → Continuez ainsi !', () => {
    const calc = makeCalculator();
    const components: ScoreComponents = {
      m5_update: 20,
      m6_phishing: 25,
      m2_risky_sites: 20,
      m7_password_diversity: 20,
      m9_password_strength: 15,
    };
    const action = calc.selectRecommendedAction(components, maxWeights, false);
    expect(action).toBe('Continuez ainsi !');
  });

  it('TC-SC-SRA-03 : m5_update=0 (écart 100% ≥ 50%) → action corrective M5', () => {
    const calc = makeCalculator();
    const components: ScoreComponents = {
      m5_update: 0,
      m6_phishing: 25,
      m2_risky_sites: 20,
      m7_password_diversity: 20,
      m9_password_strength: 15,
    };
    const action = calc.selectRecommendedAction(components, maxWeights, false);
    expect(action).toContain('navigateur');
  });

  it('TC-SC-SRA-04 : m9=0 (écart 100%) et m5=0 (écart 100%) → le pire écart selectionné', () => {
    const calc = makeCalculator();
    const components: ScoreComponents = {
      m5_update: 0,
      m6_phishing: 25,
      m2_risky_sites: 20,
      m7_password_diversity: 20,
      m9_password_strength: 0,
    };
    // Les deux ont écart relatif = 1.0 → le premier en itération
    const action = calc.selectRecommendedAction(components, maxWeights, false);
    expect(typeof action).toBe('string');
    expect(action.length).toBeGreaterThan(0);
  });

  it('TC-SC-SRA-05 : maxWeight=0 pour un module → ignoré dans la sélection', () => {
    const calc = makeCalculator();
    const components: ScoreComponents = {
      m5_update: 0,
      m6_phishing: 25,
      m2_risky_sites: 20,
      m7_password_diversity: 20,
      m9_password_strength: 15,
    };
    // m5_update a maxWeight=0 → ignoré
    const weights: Record<keyof ScoreComponents, number> = {
      m5_update: 0,
      m6_phishing: 25,
      m2_risky_sites: 20,
      m7_password_diversity: 20,
      m9_password_strength: 15,
    };
    const action = calc.selectRecommendedAction(components, weights, false);
    expect(action).toBe('Continuez ainsi !');
  });
});

// ---------------------------------------------------------------------------
// getPreviousWeekKey
// ---------------------------------------------------------------------------

describe('ScoreCalculator.getPreviousWeekKey', () => {
  it('TC-SC-PWK-01 : semaine > 1 → même année, semaine - 1', () => {
    const calc = makeCalculator();
    expect(calc.getPreviousWeekKey('2026-W15')).toBe('2026-W14');
  });

  it('TC-SC-PWK-02 : semaine 01 → dernière semaine de l\'année précédente (2025-W52)', () => {
    const calc = makeCalculator();
    const prev = calc.getPreviousWeekKey('2026-W01');
    // 2025 a 52 ou 53 semaines ISO
    expect(prev).toMatch(/^2025-W(52|53)$/);
  });

  it('TC-SC-PWK-03 : format invalide → retourné tel quel (pas de crash)', () => {
    const calc = makeCalculator();
    const invalid = 'not-a-week';
    expect(calc.getPreviousWeekKey(invalid)).toBe(invalid);
  });

  it('TC-SC-PWK-04 : semaine 02 → semaine 01 de la même année', () => {
    const calc = makeCalculator();
    expect(calc.getPreviousWeekKey('2026-W02')).toBe('2026-W01');
  });

  it('TC-SC-PWK-05 : résultat format YYYY-Www respecté', () => {
    const calc = makeCalculator();
    const prev = calc.getPreviousWeekKey('2026-W10');
    expect(prev).toMatch(/^\d{4}-W\d{2}$/);
  });
});
