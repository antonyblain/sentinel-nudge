/**
 * @file tests/unit/pages/popup/popup-t152-new-components.test.ts
 * @description Tests unitaires T-152 — nouveaux composants popup (refonte structurelle).
 *
 * Couvre les nouvelles fonctions exportées introduites dans la refonte T-152 :
 * - renderScoreSection(container, score, previousScore) :
 *     disposition gauge-wrap (SVG + gauge-info), trend, score null
 * - renderModulesSection(container, moduleStates, degradedLabels) :
 *     grille 8 chips, dot statut, placeholder futur
 * - renderQuotaBar(container, quotaUsed, quotaLimit, quotaReached) :
 *     barre de progression, compteur, cas illimité, cas atteint
 *
 * TC-GAUGE-* : jauge circulaire (structure gauge-wrap, gauge-info, gauge-score, gauge-label, gauge-trend)
 * TC-MODULES-GRID-* : grille modules chips (dot actif/inactif/warning, placeholder)
 * TC-QUOTA-BAR-* : barre quota (barre progression, role meter, accessibilité)
 *
 * Référence : TACHE-152, Maquettes v3, DAT §3.1, WCAG 2.2 AA
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock browser adapter
// Note : vi.mock() est hoistée. Le factory NE PEUT PAS référencer des variables
// définies avant vi.mock(). On utilise vi.fn() directement dans le factory,
// et on surcharge getMessage via mockBrowserGetMessage après import.
// ---------------------------------------------------------------------------

vi.mock('@/shared/browser/browser-adapter', () => {
  return {
    browser: {
      i18n: {
        getMessage: vi.fn((key: string, substitutions?: string | string[]) => {
          const sub = Array.isArray(substitutions)
            ? substitutions[0]
            : (substitutions ?? '');
          const messages: Record<string, string> = {
            score_level_high: 'Bon',
            score_level_medium: 'Moyen',
            score_level_low: 'Faible',
            popup_score_label: 'Score de cyber-hygiène',
            popup_score_no_data: 'Premier score lundi',
            popup_score_trend_stable: 'Stable cette semaine',
            popup_modules_section_title: 'Modules actifs',
            popup_modules_grid_aria: 'Grille des modules de protection',
            popup_nudges_today_label: "Nudges aujourd'hui",
            popup_quota_unlimited_sub: 'illimité',
            module_m2_name: 'M2 Phishing',
            module_m3_name: 'M3 Score',
            module_m5_name: 'M5 MAJ',
            module_m6_name: 'M6 Quiz',
            module_m7_name: 'M7 MDP',
            module_m9_name: 'M9 2FA',
            module_m17_name: 'M17 Session',
          };
          if (key === 'popup_score_first_monday')
            return `Votre premier score sera calculé le ${sub}`;
          if (key === 'popup_score_trend_up') return `+ ${sub} cette semaine`;
          if (key === 'popup_score_trend_down') return `- ${sub} cette semaine`;
          return messages[key] ?? '';
        }),
      },
      storage: { local: { get: vi.fn().mockResolvedValue({}) } },
      runtime: {
        sendMessage: vi.fn().mockResolvedValue(null),
        id: 'test-ext-id',
      },
      tabs: { create: vi.fn().mockResolvedValue(undefined) },
    },
  };
});

// ---------------------------------------------------------------------------
// Import des fonctions sous test (exportées depuis popup.ts T-152)
// ---------------------------------------------------------------------------

import {
  renderScoreSection,
  renderModulesSection,
  renderQuotaBar,
} from '@/pages/popup/popup';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeContainer(): HTMLDivElement {
  return document.createElement('div');
}

// ===========================================================================
// TC-GAUGE — renderScoreSection
// ===========================================================================

describe('TC-GAUGE — renderScoreSection (refonte T-152)', () => {
  // ─── Score null (état initial) — TACHE-153 : structure gauge préservée ───

  it('TC-GAUGE-01 : score null → div.gauge-wrap présent (T-153 structure complète fresh install)', () => {
    const container = makeContainer();
    renderScoreSection(container, null);
    expect(container.querySelector('.gauge-wrap')).not.toBeNull();
  });

  it('TC-GAUGE-02 : score null → SVG gauge-svg présent avec em-dash (T-153)', () => {
    const container = makeContainer();
    renderScoreSection(container, null);
    const svg = container.querySelector('svg.gauge-svg');
    expect(svg).not.toBeNull();
    // Texte dans SVG : "—" (em-dash U+2014) au lieu d'un chiffre
    const scoreText = svg?.querySelector('text');
    expect(scoreText?.textContent).toBe('\u2014');
  });

  it('TC-GAUGE-03 : score null → gauge-trend contient message "Premier score lundi" (T-153)', () => {
    const container = makeContainer();
    renderScoreSection(container, null);
    const trendEl = container.querySelector('.gauge-trend');
    expect(trendEl?.textContent).toBeTruthy();
    // Le trend en état fresh install informe que le premier score sera calculé lundi
    expect(trendEl?.textContent?.toLowerCase()).toMatch(/lundi|monday|score/);
  });

  it('TC-GAUGE-03b : score null → aucun div.score-no-data (T-153 supprime le fallback plat)', () => {
    const container = makeContainer();
    renderScoreSection(container, null);
    expect(container.querySelector('.score-no-data')).toBeNull();
  });

  // ─── Structure gauge-wrap (maquette v3) ───

  it('TC-GAUGE-04 : score 74 → div.gauge-wrap présent', () => {
    const container = makeContainer();
    renderScoreSection(container, 74);
    expect(container.querySelector('.gauge-wrap')).not.toBeNull();
  });

  it('TC-GAUGE-05 : score 74 → SVG avec class gauge-svg', () => {
    const container = makeContainer();
    renderScoreSection(container, 74);
    const svg = container.querySelector('svg.gauge-svg');
    expect(svg).not.toBeNull();
  });

  it('TC-GAUGE-06 : score 74 → SVG avec role=img', () => {
    const container = makeContainer();
    renderScoreSection(container, 74);
    const svg = container.querySelector('svg[role="img"]');
    expect(svg).not.toBeNull();
  });

  it('TC-GAUGE-07 : score 74 → SVG aria-label contient "74" et le niveau "Bon"', () => {
    const container = makeContainer();
    renderScoreSection(container, 74);
    const svg = container.querySelector('svg[role="img"]');
    const label = svg?.getAttribute('aria-label') ?? '';
    expect(label).toContain('74');
    expect(label).toContain('Bon');
  });

  it('TC-GAUGE-08 : score 74 → div.gauge-info présent dans .gauge-wrap', () => {
    const container = makeContainer();
    renderScoreSection(container, 74);
    const gaugeWrap = container.querySelector('.gauge-wrap');
    expect(gaugeWrap?.querySelector('.gauge-info')).not.toBeNull();
  });

  it('TC-GAUGE-09 : score 74 → div.gauge-score avec textContent "74"', () => {
    const container = makeContainer();
    renderScoreSection(container, 74);
    const gaugeScore = container.querySelector('.gauge-score');
    expect(gaugeScore?.textContent).toBe('74');
  });

  it('TC-GAUGE-10 : score 74 → div.gauge-label avec niveau "Bon"', () => {
    const container = makeContainer();
    renderScoreSection(container, 74);
    const gaugeLabel = container.querySelector('.gauge-label');
    expect(gaugeLabel?.textContent).toBe('Bon');
  });

  it('TC-GAUGE-11 : score 50 → div.gauge-label avec niveau "Moyen"', () => {
    const container = makeContainer();
    renderScoreSection(container, 50);
    const gaugeLabel = container.querySelector('.gauge-label');
    expect(gaugeLabel?.textContent).toBe('Moyen');
  });

  it('TC-GAUGE-12 : score 20 → div.gauge-label avec niveau "Faible"', () => {
    const container = makeContainer();
    renderScoreSection(container, 20);
    const gaugeLabel = container.querySelector('.gauge-label');
    expect(gaugeLabel?.textContent).toBe('Faible');
  });

  it('TC-GAUGE-13 : score 74 → div.gauge-trend présent', () => {
    const container = makeContainer();
    renderScoreSection(container, 74);
    expect(container.querySelector('.gauge-trend')).not.toBeNull();
  });

  // ─── Tendance (trend) ───

  it('TC-GAUGE-14 : trend — previousScore null → texte contenant "Stable"', () => {
    const container = makeContainer();
    renderScoreSection(container, 74, null);
    const trend = container.querySelector('.gauge-trend');
    expect(trend?.textContent).toContain('Stable');
  });

  it('TC-GAUGE-15 : trend — delta positif (74-69=+5) → texte contient "5" et "+"', () => {
    const container = makeContainer();
    renderScoreSection(container, 74, 69);
    const trend = container.querySelector('.gauge-trend');
    expect(trend?.textContent).toContain('5');
    expect(trend?.textContent).toContain('+');
  });

  it('TC-GAUGE-16 : trend — delta négatif (67-70=-3) → texte contient "3" et "-"', () => {
    const container = makeContainer();
    renderScoreSection(container, 67, 70);
    const trend = container.querySelector('.gauge-trend');
    expect(trend?.textContent).toContain('3');
    expect(trend?.textContent).toContain('-');
  });

  it('TC-GAUGE-17 : trend — delta égal (74-74=0) → texte contient "Stable"', () => {
    const container = makeContainer();
    renderScoreSection(container, 74, 74);
    const trend = container.querySelector('.gauge-trend');
    expect(trend?.textContent).toContain('Stable');
  });

  // ─── Accessibilité ───

  it('TC-GAUGE-18 : score 74 → section avec aria-label non vide', () => {
    const container = makeContainer();
    renderScoreSection(container, 74);
    const section = container.querySelector('section');
    expect(section?.getAttribute('aria-label')).toBeTruthy();
  });

  it('TC-GAUGE-19 : score 74 → .gauge-score est aria-hidden (lecteurs écran : SVG)', () => {
    const container = makeContainer();
    renderScoreSection(container, 74);
    const gaugeScore = container.querySelector('.gauge-score');
    expect(gaugeScore?.getAttribute('aria-hidden')).toBe('true');
  });

  it('TC-GAUGE-20 : score 74 → .gauge-trend est aria-hidden', () => {
    const container = makeContainer();
    renderScoreSection(container, 74);
    const gaugeTrend = container.querySelector('.gauge-trend');
    expect(gaugeTrend?.getAttribute('aria-hidden')).toBe('true');
  });
});

// ===========================================================================
// TC-MODULES-GRID — renderModulesSection
// ===========================================================================

describe('TC-MODULES-GRID — renderModulesSection (refonte T-152)', () => {
  let container: HTMLDivElement;
  const allActive: Record<string, boolean> = {
    M2: true,
    M3: true,
    M5: true,
    M6: true,
    M7: true,
    M9: true,
    M17: true,
  };

  beforeEach(() => {
    container = makeContainer();
  });

  it('TC-MODULES-GRID-01 : titre .card-title présent avec texte non vide', () => {
    renderModulesSection(container, allActive, []);
    const title = container.querySelector('.card-title');
    expect(title?.textContent).toBeTruthy();
  });

  it('TC-MODULES-GRID-02 : grille .modules-grid présente', () => {
    renderModulesSection(container, allActive, []);
    expect(container.querySelector('.modules-grid')).not.toBeNull();
  });

  it('TC-MODULES-GRID-03 : grille a role="list"', () => {
    renderModulesSection(container, allActive, []);
    const grid = container.querySelector('.modules-grid');
    expect(grid?.getAttribute('role')).toBe('list');
  });

  it('TC-MODULES-GRID-04 : grille a aria-label non vide', () => {
    renderModulesSection(container, allActive, []);
    const grid = container.querySelector('.modules-grid');
    expect(grid?.getAttribute('aria-label')).toBeTruthy();
  });

  it('TC-MODULES-GRID-05 : 8 chips .module-chip (7 modules + 1 placeholder)', () => {
    renderModulesSection(container, allActive, []);
    const chips = container.querySelectorAll('.module-chip');
    expect(chips.length).toBe(8);
  });

  it('TC-MODULES-GRID-06 : chaque chip a role="listitem"', () => {
    renderModulesSection(container, allActive, []);
    const chips = container.querySelectorAll('.module-chip');
    chips.forEach((chip) => {
      expect(chip.getAttribute('role')).toBe('listitem');
    });
  });

  it('TC-MODULES-GRID-07 : module M2 actif → premier chip dot avec classe "active"', () => {
    renderModulesSection(container, allActive, []);
    const firstChip = container.querySelector('.module-chip');
    const dot = firstChip?.querySelector('.module-chip-dot');
    expect(dot?.classList.contains('active')).toBe(true);
  });

  it('TC-MODULES-GRID-08 : module M2 inactif (false) → premier chip dot avec classe "inactive"', () => {
    const states: Record<string, boolean> = {
      M2: false,
      M3: true,
      M5: true,
      M6: true,
      M7: true,
      M9: true,
      M17: true,
    };
    renderModulesSection(container, states, []);
    const firstChip = container.querySelector('.module-chip');
    const dot = firstChip?.querySelector('.module-chip-dot');
    expect(dot?.classList.contains('inactive')).toBe(true);
  });

  it('TC-MODULES-GRID-09 : module M2 dégradé → premier chip dot avec classe "warning"', () => {
    renderModulesSection(container, allActive, ['M2']);
    const firstChip = container.querySelector('.module-chip');
    const dot = firstChip?.querySelector('.module-chip-dot');
    expect(dot?.classList.contains('warning')).toBe(true);
  });

  it('TC-MODULES-GRID-10 : dernier chip (index 7, placeholder) → dot avec classe "inactive"', () => {
    renderModulesSection(container, allActive, []);
    const chips = container.querySelectorAll('.module-chip');
    const lastChip = chips[7];
    const dot = lastChip?.querySelector('.module-chip-dot');
    expect(dot?.classList.contains('inactive')).toBe(true);
  });

  it('TC-MODULES-GRID-11 : tous actifs + degradedLabels vide → aucun dot.warning', () => {
    renderModulesSection(container, allActive, []);
    const warningDots = container.querySelectorAll('.module-chip-dot.warning');
    expect(warningDots.length).toBe(0);
  });

  it('TC-MODULES-GRID-12 : M7 dégradé (actif+dégradé) → 5e chip dot = warning', () => {
    renderModulesSection(container, allActive, ['M7']);
    const chips = container.querySelectorAll('.module-chip');
    const m7Chip = chips[4]; // M7 est en 5e position (index 4)
    const dot = m7Chip?.querySelector('.module-chip-dot');
    expect(dot?.classList.contains('warning')).toBe(true);
    expect(dot?.classList.contains('active')).toBe(false);
  });
});

// ===========================================================================
// TC-QUOTA-BAR — renderQuotaBar
// ===========================================================================

describe('TC-QUOTA-BAR — renderQuotaBar (refonte T-152)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = makeContainer();
  });

  it('TC-QUOTA-BAR-01 : div.quota-bar-wrap présent', () => {
    renderQuotaBar(container, 1, 3, false);
    expect(container.querySelector('.quota-bar-wrap')).not.toBeNull();
  });

  it('TC-QUOTA-BAR-02 : div.quota-label présent', () => {
    renderQuotaBar(container, 1, 3, false);
    expect(container.querySelector('.quota-label')).not.toBeNull();
  });

  it('TC-QUOTA-BAR-03 : compteur "1 / 3" dans le span droit du quota-label', () => {
    renderQuotaBar(container, 1, 3, false);
    const labelRow = container.querySelector('.quota-label');
    const spans = labelRow?.querySelectorAll('span');
    expect(spans?.[1]?.textContent).toBe('1 / 3');
  });

  it('TC-QUOTA-BAR-04 : quota illimité → texte "illimité" dans quota-label', () => {
    renderQuotaBar(container, 0, null, false);
    const labelRow = container.querySelector('.quota-label');
    expect(labelRow?.textContent).toContain('illimité');
  });

  it('TC-QUOTA-BAR-05 : div.quota-track présent', () => {
    renderQuotaBar(container, 1, 3, false);
    expect(container.querySelector('.quota-track')).not.toBeNull();
  });

  it('TC-QUOTA-BAR-06 : quota-track a role="meter"', () => {
    renderQuotaBar(container, 1, 3, false);
    const track = container.querySelector('.quota-track');
    expect(track?.getAttribute('role')).toBe('meter');
  });

  it('TC-QUOTA-BAR-07 : quota-track a aria-valuenow = quotaUsed (2)', () => {
    renderQuotaBar(container, 2, 3, false);
    const track = container.querySelector('.quota-track');
    expect(track?.getAttribute('aria-valuenow')).toBe('2');
  });

  it('TC-QUOTA-BAR-08 : quota-track a aria-valuemax = quotaLimit (3)', () => {
    renderQuotaBar(container, 1, 3, false);
    const track = container.querySelector('.quota-track');
    expect(track?.getAttribute('aria-valuemax')).toBe('3');
  });

  it('TC-QUOTA-BAR-09 : quota-track a aria-valuemin = "0"', () => {
    renderQuotaBar(container, 1, 3, false);
    const track = container.querySelector('.quota-track');
    expect(track?.getAttribute('aria-valuemin')).toBe('0');
  });

  it('TC-QUOTA-BAR-10 : div.quota-fill présent dans .quota-track', () => {
    renderQuotaBar(container, 1, 3, false);
    const track = container.querySelector('.quota-track');
    expect(track?.querySelector('.quota-fill')).not.toBeNull();
  });

  it('TC-QUOTA-BAR-11 : quota atteint → fill à 100% avec couleur warning', () => {
    renderQuotaBar(container, 3, 3, true);
    const fill = container.querySelector('.quota-fill') as HTMLElement;
    expect(fill.style.width).toBe('100%');
    expect(fill.style.backgroundColor).toContain('warning');
  });

  it('TC-QUOTA-BAR-12 : quota 1/3 → fill width = "33%"', () => {
    renderQuotaBar(container, 1, 3, false);
    const fill = container.querySelector('.quota-fill') as HTMLElement;
    expect(fill.style.width).toBe('33%');
  });

  it('TC-QUOTA-BAR-13 : quota illimité → fill width = "0%"', () => {
    renderQuotaBar(container, 0, null, false);
    const fill = container.querySelector('.quota-fill') as HTMLElement;
    expect(fill.style.width).toBe('0%');
  });

  it('TC-QUOTA-BAR-14 : quota-track a aria-label non vide', () => {
    renderQuotaBar(container, 1, 3, false);
    const track = container.querySelector('.quota-track');
    expect(track?.getAttribute('aria-label')).toBeTruthy();
  });

  it('TC-QUOTA-BAR-15 : quota-label span gauche (libellé) non vide', () => {
    renderQuotaBar(container, 1, 3, false);
    const labelRow = container.querySelector('.quota-label');
    const spans = labelRow?.querySelectorAll('span');
    expect(spans?.[0]?.textContent).toBeTruthy();
  });
});
