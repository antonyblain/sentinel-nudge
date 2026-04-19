/**
 * @file tests/unit/modules/m3.test.ts
 * @description Tests unitaires du module M3 — score cyber-hygiène hebdomadaire.
 *
 * Couvre :
 * - ScoreCalculator.calculateM5Component : 0/20
 * - ScoreCalculator.calculateM6Component : (% bonnes réponses) × 25
 * - ScoreCalculator.calculateM2Component : 20 − (4 × dismissed), plancher 0
 * - ScoreCalculator.calculateM7Component : 20 − (4 × réutilisations), plancher 0
 * - ScoreCalculator.calculateM9Component : (forts/total) × 15, cas 0/0 = 15
 * - ScoreCalculator.redistributeWeights : redistribution proportionnelle
 * - ScoreCalculator.selectRecommendedAction : écart relatif >= 50%
 * - ScoreCalculator.getCurrentWeekKey / getPreviousWeekKey
 * - Cas limites : score 0, première semaine, tous modules désactivés
 * - readM3Diagnostics / updateM3DiagnosticsOnAlarm : diagnostics.m3 (TACHE-086)
 *
 * T-189 : mock inline remplacé par createMockChromeStorage() (wrapper JSON-strict P-018).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ScoreCalculator,
  COMPONENT_WEIGHTS,
  type ScoreComponents,
} from '@/background/score-calculator';
import {
  readM3Diagnostics,
  updateM3DiagnosticsOnAlarm,
} from '@/background/services/m3-boot-service';
import type { StorageService } from '@/background/storage-service';
import type { EventPayload } from '@/shared/types/storage';
import type { IncidentService } from '@/background/services/incident-service';
import { createMockChromeStorage } from '../../helpers/mock-chrome-storage';

// ---------------------------------------------------------------------------
// Mock chrome.storage.local — wrapper JSON-strict T-189 / P-018
// ---------------------------------------------------------------------------

const { storage, reset: resetStorage } = createMockChromeStorage();

global.chrome = {
  storage: {
    local: storage,
  },
  action: {
    setBadgeText: vi.fn().mockResolvedValue(undefined),
    setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
  },
} as unknown as typeof chrome;

/** Crée un mock minimal de StorageService */
function createMockStorageService(overrides: Partial<StorageService> = {}): StorageService {
  return {
    getEvents: vi.fn().mockResolvedValue([]),
    setWeeklyScore: vi.fn().mockResolvedValue(undefined),
    getWeeklyScore: vi.fn().mockResolvedValue(null),
    getConfig: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as unknown as StorageService;
}

/** Construit un EventPayload M2 dismissed */
function buildM2DismissedEvent(): EventPayload {
  return { action: 'dismissed', domain_hash: 'a'.repeat(64), signals: ['http'] };
}

/** Construit un EventPayload M9 évaluation */
function buildM9EvaluationEvent(score: number): EventPayload {
  return { action: 'evaluated', module_data: { score } };
}

/** Construit un EventPayload M6 quiz complété */
function buildM6QuizEvent(scorePct: number): EventPayload {
  return { action: 'quiz_completed', module_data: { score_pct: scorePct } };
}

/** Construit un EventPayload M7 réutilisation détectée */
function buildM7ReuseEvent(): EventPayload {
  return { action: 'shown', domain_hash: 'a'.repeat(64) };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createCalculator(overrides: Partial<StorageService> = {}): ScoreCalculator {
  return new ScoreCalculator(createMockStorageService(overrides) as StorageService);
}

/**
 * Crée un mock d'IncidentService pour les tests M3 diagnostics.
 */
function createMockIncidentService(): {
  service: Partial<IncidentService>;
  incidents: Array<{ type: string; severity: string }>;
} {
  const incidents: Array<{ type: string; severity: string }> = [];
  const service: Partial<IncidentService> = {
    log: vi.fn(async (type, severity) => {
      incidents.push({ type, severity });
    }),
  };
  return { service, incidents };
}

/** Réinitialise le mock storage */
function doReset(): void {
  resetStorage();
  vi.clearAllMocks();
}

// ---------------------------------------------------------------------------
// Tests par composante
// ---------------------------------------------------------------------------

describe('ScoreCalculator — composante M5 (MAJ navigateur)', () => {
  it('retourne 20 si navigateur à jour', () => {
    const calc = createCalculator();
    expect(calc.calculateM5Component(true)).toBe(20);
  });

  it('retourne 0 si navigateur non à jour', () => {
    const calc = createCalculator();
    expect(calc.calculateM5Component(false)).toBe(0);
  });
});

describe('ScoreCalculator — composante M6 (phishing)', () => {
  it('retourne 25 si score 100%', () => {
    const calc = createCalculator();
    expect(calc.calculateM6Component([buildM6QuizEvent(100)])).toBe(25);
  });

  it('retourne 0 si aucun quiz cette semaine et pas de score connu', () => {
    const calc = createCalculator();
    expect(calc.calculateM6Component([])).toBe(0);
  });

  it('calcule correctement pour 60% de bonnes réponses', () => {
    const calc = createCalculator();
    const result = calc.calculateM6Component([buildM6QuizEvent(60)]);
    expect(result).toBe(Math.round(0.6 * 25)); // 15
  });

  it('fait la moyenne si plusieurs quiz dans la semaine', () => {
    const calc = createCalculator();
    const events = [buildM6QuizEvent(100), buildM6QuizEvent(0)];
    const result = calc.calculateM6Component(events);
    expect(result).toBe(Math.round(0.5 * 25)); // 13 (arrondi)
  });
});

describe('ScoreCalculator — composante M2 (sites risqués)', () => {
  it('retourne 20 si aucun dismissed', () => {
    const calc = createCalculator();
    expect(calc.calculateM2Component([])).toBe(20);
  });

  it('retire 4 points par dismissed', () => {
    const calc = createCalculator();
    const events = [buildM2DismissedEvent(), buildM2DismissedEvent()];
    expect(calc.calculateM2Component(events)).toBe(12); // 20 - 4*2
  });

  it('plancher à 0 si plus de 5 dismissed', () => {
    const calc = createCalculator();
    const events = Array.from({ length: 6 }, () => buildM2DismissedEvent());
    expect(calc.calculateM2Component(events)).toBe(0);
  });

  it('compte aussi les actions silent (SFD §2.1.5)', () => {
    const calc = createCalculator();
    const events = [{ action: 'silent' } as EventPayload];
    expect(calc.calculateM2Component(events)).toBe(16); // 20 - 4*1
  });
});

describe('ScoreCalculator — composante M7 (diversité mots de passe)', () => {
  it('retourne 20 si aucune réutilisation', () => {
    const calc = createCalculator();
    expect(calc.calculateM7Component([])).toBe(20);
  });

  it('retire 4 points par réutilisation', () => {
    const calc = createCalculator();
    const events = [buildM7ReuseEvent(), buildM7ReuseEvent(), buildM7ReuseEvent()];
    expect(calc.calculateM7Component(events)).toBe(8); // 20 - 4*3
  });

  it('plancher à 0 si plus de 5 réutilisations', () => {
    const calc = createCalculator();
    const events = Array.from({ length: 7 }, () => buildM7ReuseEvent());
    expect(calc.calculateM7Component(events)).toBe(0);
  });
});

describe('ScoreCalculator — composante M9 (force mots de passe)', () => {
  it('retourne 15 si aucune création (indicateur 0/0)', () => {
    const calc = createCalculator();
    expect(calc.calculateM9Component([])).toBe(15);
  });

  it('retourne 15 si tous les mots de passe sont forts (score >= 4)', () => {
    const calc = createCalculator();
    const events = [
      buildM9EvaluationEvent(4),
      buildM9EvaluationEvent(4),
      buildM9EvaluationEvent(3), // non fort
    ];
    // 2 forts sur 3 = 2/3 * 15 = 10
    expect(calc.calculateM9Component(events)).toBe(10);
  });

  it('retourne 0 si aucun mot de passe fort', () => {
    const calc = createCalculator();
    const events = [buildM9EvaluationEvent(1), buildM9EvaluationEvent(2)];
    expect(calc.calculateM9Component(events)).toBe(0);
  });

  it('retourne 15 si tous forts', () => {
    const calc = createCalculator();
    const events = [buildM9EvaluationEvent(4), buildM9EvaluationEvent(4)];
    expect(calc.calculateM9Component(events)).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// Tests redistribution des poids
// ---------------------------------------------------------------------------

describe('ScoreCalculator — redistribution des poids', () => {
  const mockStorage = createMockStorageService();
  const calc = new ScoreCalculator(mockStorage as StorageService);

  const baseComponents: ScoreComponents = {
    m5_update: 20,
    m6_phishing: 25,
    m2_risky_sites: 20,
    m7_password_diversity: 20,
    m9_password_strength: 15,
  };

  it('sans modules désactivés — pas de redistribution', () => {
    const { components } = calc.redistributeWeights(baseComponents);
    expect(components).toEqual(baseComponents);
  });

  it('CA-M3-07 : M6 désactivé (25 pts redistribués) — total reste 100', () => {
    const enabledModules = { M5: true, M6: false, M2: true, M7: true, M9: true };
    const { components, maxWeights } = calc.redistributeWeights(baseComponents, enabledModules);

    // M6 est désactivé → ses points sont redistribués
    expect(components.m6_phishing).toBe(0);

    // Le total des maxWeights actifs doit être ~100
    const totalMaxWeights = Object.values(maxWeights).reduce((a, b) => a + b, 0);
    expect(totalMaxWeights).toBeCloseTo(100, 0);
  });

  it('CA-M3-07 : M6 (25) et M9 (15) désactivés — redistribution sur M5+M2+M7', () => {
    const enabledModules = { M5: true, M6: false, M2: true, M7: true, M9: false };
    const { maxWeights } = calc.redistributeWeights(baseComponents, enabledModules);

    // M6 et M9 doivent avoir maxWeight = 0
    expect(maxWeights.m6_phishing).toBe(0);
    expect(maxWeights.m9_password_strength).toBe(0);

    // Les 3 modules actifs ont des maxWeights > 20
    expect(maxWeights.m5_update).toBeGreaterThan(20);
    expect(maxWeights.m2_risky_sites).toBeGreaterThan(20);
    expect(maxWeights.m7_password_diversity).toBeGreaterThan(20);

    // Total doit être 100
    const total = Object.values(maxWeights).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(100, 0);
  });

  it('tous modules désactivés — components = 0', () => {
    const enabledModules = { M5: false, M6: false, M2: false, M7: false, M9: false };
    const { components } = calc.redistributeWeights(baseComponents, enabledModules);
    Object.values(components).forEach((v) => expect(v).toBe(0));
  });
});

// ---------------------------------------------------------------------------
// Tests sélection de l'action recommandée
// ---------------------------------------------------------------------------

describe('ScoreCalculator — sélection action recommandée', () => {
  const mockStorage = createMockStorageService();
  const calc = new ScoreCalculator(mockStorage as StorageService);

  const standardWeights: Record<keyof ScoreComponents, number> = {
    m5_update: 20,
    m6_phishing: 25,
    m2_risky_sites: 20,
    m7_password_diversity: 20,
    m9_password_strength: 15,
  };

  it('CA-M3-08 : composante la plus faible avec écart >= 50% → action corrective', () => {
    const components: ScoreComponents = {
      m5_update: 20,
      m6_phishing: 25,
      m2_risky_sites: 20,
      m7_password_diversity: 4, // 4/20 = 80% d'écart
      m9_password_strength: 15,
    };
    const action = calc.selectRecommendedAction(components, standardWeights);
    expect(action).toContain('Diversifiez'); // Action corrective diversité mdp
  });

  it('toutes composantes > 50% → "Continuez ainsi !"', () => {
    const components: ScoreComponents = {
      m5_update: 20,
      m6_phishing: 20,
      m2_risky_sites: 15,
      m7_password_diversity: 15,
      m9_password_strength: 12,
    };
    const action = calc.selectRecommendedAction(components, standardWeights);
    expect(action).toBe('Continuez ainsi !');
  });

  it('première semaine → "Votre premier score !"', () => {
    const components: ScoreComponents = {
      m5_update: 0,
      m6_phishing: 0,
      m2_risky_sites: 0,
      m7_password_diversity: 0,
      m9_password_strength: 0,
    };
    const action = calc.selectRecommendedAction(components, standardWeights, true);
    expect(action).toBe('Votre premier score !');
  });

  it('composante M5 la plus faible → action mise à jour', () => {
    const components: ScoreComponents = {
      m5_update: 0, // 0/20 = 100% d'écart
      m6_phishing: 25,
      m2_risky_sites: 20,
      m7_password_diversity: 20,
      m9_password_strength: 15,
    };
    const action = calc.selectRecommendedAction(components, standardWeights);
    expect(action).toContain('navigateur');
  });
});

// ---------------------------------------------------------------------------
// Tests getCurrentWeekKey / getPreviousWeekKey
// ---------------------------------------------------------------------------

describe('ScoreCalculator — clé de semaine ISO', () => {
  const calc = createCalculator();

  it('getCurrentWeekKey retourne le format YYYY-Www', () => {
    const key = calc.getCurrentWeekKey();
    expect(key).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('getCurrentWeekKey retourne une semaine valide (1-53)', () => {
    const key = calc.getCurrentWeekKey();
    const week = parseInt(key.split('-W')[1]!, 10);
    expect(week).toBeGreaterThanOrEqual(1);
    expect(week).toBeLessThanOrEqual(53);
  });

  it('getPreviousWeekKey retourne la semaine précédente', () => {
    const prev = calc.getPreviousWeekKey('2026-W10');
    expect(prev).toBe('2026-W09');
  });

  it("getPreviousWeekKey gère le passage d'année", () => {
    const prev = calc.getPreviousWeekKey('2026-W01');
    // Semaine 1 → dernière semaine de 2025 (W52 ou W53)
    expect(prev).toMatch(/^2025-W(52|53)$/);
  });
});

// ---------------------------------------------------------------------------
// Tests des poids standards
// ---------------------------------------------------------------------------

describe('COMPONENT_WEIGHTS — validation du total', () => {
  it('la somme des poids standards vaut 100', () => {
    const total = Object.values(COMPONENT_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });

  it('le poids M5 est 20', () => {
    expect(COMPONENT_WEIGHTS['m5_update']).toBe(20);
  });

  it('le poids M6 est 25', () => {
    expect(COMPONENT_WEIGHTS['m6_phishing']).toBe(25);
  });

  it('le poids M2 est 20', () => {
    expect(COMPONENT_WEIGHTS['m2_risky_sites']).toBe(20);
  });

  it('le poids M7 est 20', () => {
    expect(COMPONENT_WEIGHTS['m7_password_diversity']).toBe(20);
  });

  it('le poids M9 est 15', () => {
    expect(COMPONENT_WEIGHTS['m9_password_strength']).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// Tests : diagnostics M3 — ADR-001 Option B (TACHE-086)
// ---------------------------------------------------------------------------
// M3 n'a pas d'initBoot complet (Option B arbitrée en T-058).
// Les tests vérifient readM3Diagnostics() et updateM3DiagnosticsOnAlarm()
// qui est appelé au déclenchement de l'alarme score (pas au boot SW).
// ---------------------------------------------------------------------------

describe('readM3Diagnostics — valeur par défaut', () => {
  beforeEach(doReset);

  it('TC-M3-BOOT-01 : diagnostics.m3 absent → retourne défaut (ready=false, last_boot=0)', async () => {
    const diag = await readM3Diagnostics();

    expect(diag.ready).toBe(false);
    expect(diag.last_boot).toBe(0);
    expect(diag.last_incident).toBeUndefined();
  });

  it('TC-M3-BOOT-02 : diagnostics.m3 corrompu → retourne défaut', async () => {
    // Corruption : l'entrée est un nombre au lieu d'un objet
    await storage.set({ 'diagnostics.m3': 42 });

    const diag = await readM3Diagnostics();

    expect(diag.ready).toBe(false);
    expect(diag.last_boot).toBe(0);
  });
});

describe('updateM3DiagnosticsOnAlarm — IDB accessible', () => {
  beforeEach(doReset);

  it('TC-M3-BOOT-03 : IDB accessible → diagnostics.m3 ready=true, last_boot mis à jour', async () => {
    const { service, incidents } = createMockIncidentService();
    const diag = await updateM3DiagnosticsOnAlarm(service as IncidentService, true);

    expect(diag.ready).toBe(true);
    expect(diag.last_boot).toBeGreaterThan(0);
    expect(diag.last_incident).toBeUndefined();
    expect(incidents).toHaveLength(0);
  });

  it('TC-M3-BOOT-04 : diagnostics.m3 persisté dans chrome.storage.local après alarme', async () => {
    const { service } = createMockIncidentService();
    await updateM3DiagnosticsOnAlarm(service as IncidentService, true);

    const stored = (await storage.get('diagnostics.m3'))['diagnostics.m3'] as Record<
      string,
      unknown
    >;
    expect(stored).toBeDefined();
    expect(stored['ready']).toBe(true);
    expect(typeof stored['last_boot']).toBe('number');
  });

  it("TC-M3-BOOT-05 : readM3Diagnostics retourne l'état persisté après alarme", async () => {
    const { service } = createMockIncidentService();
    await updateM3DiagnosticsOnAlarm(service as IncidentService, true);

    const diag = await readM3Diagnostics();
    expect(diag.ready).toBe(true);
    expect(diag.last_boot).toBeGreaterThan(0);
  });
});

describe('updateM3DiagnosticsOnAlarm — IDB inaccessible (events_store_corrupted)', () => {
  beforeEach(doReset);

  it('TC-M3-BOOT-06 : IDB inaccessible → incident events_store_corrupted (error)', async () => {
    const { service, incidents } = createMockIncidentService();
    const diag = await updateM3DiagnosticsOnAlarm(
      service as IncidentService,
      false,
      'IDBTransactionError',
    );

    // Incident émis
    const corruptedIncident = incidents.find((i) => i.type === 'events_store_corrupted');
    expect(corruptedIncident).toBeDefined();
    expect(corruptedIncident?.severity).toBe('error');

    // diagnostics.m3 ready=false
    expect(diag.ready).toBe(false);
    expect(diag.last_boot).toBeGreaterThan(0);
  });

  it("TC-M3-BOOT-07 : diagnostics.m3.last_incident reflète l'incident events_store_corrupted", async () => {
    const { service } = createMockIncidentService();
    const diag = await updateM3DiagnosticsOnAlarm(
      service as IncidentService,
      false,
      'QuotaExceededError',
    );

    expect(diag.last_incident).toBeDefined();
    expect(diag.last_incident?.type).toBe('events_store_corrupted');
    expect(diag.last_incident?.severity).toBe('error');
    expect(diag.last_incident?.ts).toBeGreaterThan(0);
  });

  it('TC-M3-BOOT-08 : IDB inaccessible sans error_name → utilise UnknownError', async () => {
    const { service, incidents } = createMockIncidentService();
    // Appel sans idbErrorName → doit utiliser 'UnknownError' par défaut
    await updateM3DiagnosticsOnAlarm(service as IncidentService, false);

    expect(incidents).toHaveLength(1);
    expect(incidents[0].type).toBe('events_store_corrupted');
  });

  it("TC-M3-BOOT-09 : diagnostics.m3 persisté avec ready=false en cas d'IDB KO", async () => {
    const { service } = createMockIncidentService();
    await updateM3DiagnosticsOnAlarm(service as IncidentService, false, 'NetworkError');

    const stored = (await storage.get('diagnostics.m3'))['diagnostics.m3'] as Record<
      string,
      unknown
    >;
    expect(stored).toBeDefined();
    expect(stored['ready']).toBe(false);
    expect(stored['last_incident']).toBeDefined();
  });
});
