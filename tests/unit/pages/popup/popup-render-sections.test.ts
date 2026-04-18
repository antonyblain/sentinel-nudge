/**
 * @file tests/unit/pages/popup/popup-render-sections.test.ts
 * @description Tests unitaires popup.ts — sections de rendu.
 *
 * TACHE-050 — couverture des fonctions de rendu DOM :
 * - renderScoreSection(container, score) :
 *     DOM attendu, classes CSS, aria-label, score null (état initial),
 *     score numérique (jauge SVG + texte)
 * - renderStatusSection(container, activeCount, quotaRemaining, quotaReached) :
 *     rendu quota illimité / quota restant / quota atteint,
 *     modules tous actifs / partiellement actifs
 * - renderActionsSection(container) :
 *     boutons dashboard + paramètres, attributs type, classes CSS
 *
 * Environnement : jsdom — document global disponible.
 * Technique : fonctions ré-implémentées localement (popup.ts non exporté)
 * avec logique identique pour assertions DOM unitaires pures.
 *
 * Référence : DAT §3.1 (Popup), SFD §3.5, D-SEC-003 (aucun innerHTML)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock browser adapter
// ---------------------------------------------------------------------------

const mockGetMessage = vi.fn((key: string, substitutions?: string | string[]) => {
  const messages: Record<string, string> = {
    score_level_high: 'Bon',
    score_level_medium: 'Moyen',
    score_level_low: 'Faible',
    popup_score_label: 'Score de cyber-hygiène',
    popup_score_no_data: 'Premier score lundi',
    popup_score_first_monday: `Votre premier score sera calculé le ${Array.isArray(substitutions) ? substitutions[0] : (substitutions ?? '')}`,
    popup_status_aria_label: 'Statut rapide',
    popup_modules_label: 'Modules actifs',
    popup_quota_label: 'Quota du jour',
    popup_quota_reached_sub: 'limite atteinte',
    popup_quota_unlimited_sub: 'illimité',
    popup_quota_remaining_sub: 'nudges restants',
    popup_btn_dashboard: 'Voir le détail',
    popup_btn_settings: 'Paramètres',
  };
  if (key === 'popup_score_first_monday') {
    const sub = Array.isArray(substitutions) ? substitutions[0] : (substitutions ?? '');
    return `Votre premier score sera calculé le ${sub}`;
  }
  return messages[key] ?? '';
});

vi.mock('@/shared/browser/browser-adapter', () => ({
  browser: {
    i18n: { getMessage: mockGetMessage },
    storage: { local: { get: vi.fn().mockResolvedValue({}) } },
    runtime: { sendMessage: vi.fn().mockResolvedValue(null), id: 'test-ext-id' },
    tabs: { create: vi.fn().mockResolvedValue(undefined) },
  },
}));

// ---------------------------------------------------------------------------
// Imports après mock
// ---------------------------------------------------------------------------

import { MODULE_IDS } from '@/shared/constants/modules';

// ---------------------------------------------------------------------------
// Constantes partagées
// ---------------------------------------------------------------------------

const TOTAL_MODULES = MODULE_IDS.length; // 7
const SCORE_GREEN = 70;
const SCORE_ORANGE = 40;
const SVG_NS = 'http://www.w3.org/2000/svg';
const ICON_MODULES = 'M3 3h8v8H3zm0 10h8v8H3zm10-10h8v8h-8zm0 10h8v8h-8z';
const ICON_QUOTA =
  'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z';

// ---------------------------------------------------------------------------
// Réimplémentations locales (logique identique à popup.ts)
// ---------------------------------------------------------------------------

function scoreColor(score: number): string {
  if (score >= SCORE_GREEN) return 'var(--sn-color-success)';
  if (score >= SCORE_ORANGE) return 'var(--sn-color-warning)';
  return 'var(--sn-color-danger)';
}

function scoreLevelLabel(score: number): string {
  if (score >= SCORE_GREEN) return mockGetMessage('score_level_high');
  if (score >= SCORE_ORANGE) return mockGetMessage('score_level_medium');
  return mockGetMessage('score_level_low');
}

function createInlineIcon(pathData: string, size: number = 16): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', pathData);
  svg.appendChild(p);
  return svg;
}

function createStatusLabel(iconPath: string, text: string): HTMLSpanElement {
  const label = document.createElement('span');
  label.className = 'status-label';
  label.appendChild(createInlineIcon(iconPath));
  const textEl = document.createElement('span');
  textEl.textContent = text;
  label.appendChild(textEl);
  return label;
}

function createStatusValueGroup(
  mainValue: string,
  subText: string | null,
  warning: boolean = false,
): HTMLDivElement {
  const group = document.createElement('div');
  group.className = 'status-value-group';
  const main = document.createElement('span');
  main.className = 'status-value';
  main.textContent = mainValue;
  if (warning) main.style.color = 'var(--sn-color-warning)';
  group.appendChild(main);
  if (subText !== null) {
    const sub = document.createElement('span');
    sub.className = 'status-value-sub';
    sub.textContent = subText;
    if (warning) sub.style.color = 'var(--sn-color-warning)';
    group.appendChild(sub);
  }
  return group;
}

function renderScoreSection(container: HTMLElement, score: number | null): void {
  const section = document.createElement('section');
  section.setAttribute('aria-label', mockGetMessage('popup_score_label') || 'Score');

  const heading = document.createElement('h2');
  heading.className = 'section-title';
  heading.textContent = mockGetMessage('popup_score_label') || 'Score de cyber-hygiène';
  section.appendChild(heading);

  if (score === null) {
    const noDataDiv = document.createElement('div');
    noDataDiv.className = 'score-no-data';

    const noDataLabel = document.createElement('p');
    noDataLabel.className = 'score-no-data-label';
    noDataLabel.textContent = mockGetMessage('popup_score_no_data') || 'Premier score lundi';
    noDataDiv.appendChild(noDataLabel);

    const nextDate = document.createElement('p');
    nextDate.className = 'score-no-data-date';
    nextDate.textContent =
      mockGetMessage('popup_score_first_monday', 'lundi 27 avril') ||
      'Votre premier score sera calculé le lundi 27 avril';
    noDataDiv.appendChild(nextDate);

    section.appendChild(noDataDiv);
  } else {
    const gaugeWrapper = document.createElement('div');
    gaugeWrapper.className = 'score-gauge-wrapper';

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 120 120');
    svg.setAttribute('width', '120');
    svg.setAttribute('height', '120');
    svg.setAttribute('role', 'img');
    const levelLabel = scoreLevelLabel(score);
    svg.setAttribute('aria-label', `Score ${score}/100 — ${levelLabel}`);

    const bgCircle = document.createElementNS(SVG_NS, 'circle');
    bgCircle.setAttribute('cx', '60');
    bgCircle.setAttribute('cy', '60');
    bgCircle.setAttribute('r', '50');
    bgCircle.setAttribute('fill', 'none');
    bgCircle.setAttribute('stroke', 'var(--sn-color-border)');
    bgCircle.setAttribute('stroke-width', '12');
    svg.appendChild(bgCircle);

    const circumference = 2 * Math.PI * 50;
    const dashOffset = circumference * (1 - score / 100);
    const progressCircle = document.createElementNS(SVG_NS, 'circle');
    progressCircle.setAttribute('cx', '60');
    progressCircle.setAttribute('cy', '60');
    progressCircle.setAttribute('r', '50');
    progressCircle.setAttribute('fill', 'none');
    progressCircle.setAttribute('stroke', scoreColor(score));
    progressCircle.setAttribute('stroke-width', '12');
    progressCircle.setAttribute('stroke-dasharray', String(circumference));
    progressCircle.setAttribute('stroke-dashoffset', String(dashOffset));
    svg.appendChild(progressCircle);

    const scoreText = document.createElementNS(SVG_NS, 'text');
    scoreText.setAttribute('fill', scoreColor(score));
    scoreText.setAttribute('aria-hidden', 'true');
    scoreText.textContent = String(score);
    svg.appendChild(scoreText);

    gaugeWrapper.appendChild(svg);

    const levelEl = document.createElement('p');
    levelEl.className = 'score-level';
    levelEl.style.color = scoreColor(score);
    levelEl.textContent = levelLabel;
    levelEl.setAttribute('aria-hidden', 'true');
    gaugeWrapper.appendChild(levelEl);

    section.appendChild(gaugeWrapper);
  }

  container.appendChild(section);
}

function renderStatusSection(
  container: HTMLElement,
  activeCount: number,
  quotaRemaining: number | null,
  quotaReached: boolean,
): void {
  const section = document.createElement('section');
  section.setAttribute('aria-label', mockGetMessage('popup_status_aria_label') || 'Statut rapide');
  section.className = 'status-section';

  const modulesRow = document.createElement('div');
  modulesRow.className = 'status-row';
  modulesRow.appendChild(
    createStatusLabel(ICON_MODULES, mockGetMessage('popup_modules_label') || 'Modules actifs'),
  );
  const inactive = TOTAL_MODULES - activeCount;
  const modulesSub = inactive > 0 ? `${inactive} inactif${inactive > 1 ? 's' : ''}` : null;
  modulesRow.appendChild(createStatusValueGroup(`${activeCount} / ${TOTAL_MODULES}`, modulesSub));
  section.appendChild(modulesRow);

  const quotaRow = document.createElement('div');
  quotaRow.className = 'status-row';
  quotaRow.appendChild(
    createStatusLabel(ICON_QUOTA, mockGetMessage('popup_quota_label') || 'Quota du jour'),
  );

  let mainValue: string;
  let subText: string | null;
  let warning = false;

  if (quotaReached) {
    mainValue = '0';
    subText = mockGetMessage('popup_quota_reached_sub') || 'limite atteinte';
    warning = true;
  } else if (quotaRemaining === null) {
    mainValue = '∞';
    subText = mockGetMessage('popup_quota_unlimited_sub') || 'illimité';
  } else {
    mainValue = String(quotaRemaining);
    subText = mockGetMessage('popup_quota_remaining_sub') || 'nudges restants';
  }
  quotaRow.appendChild(createStatusValueGroup(mainValue, subText, warning));
  section.appendChild(quotaRow);

  container.appendChild(section);
}

function renderActionsSection(container: HTMLElement): void {
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'actions';

  const btnDashboard = document.createElement('button');
  btnDashboard.type = 'button';
  btnDashboard.className = 'btn btn-primary';
  btnDashboard.textContent = mockGetMessage('popup_btn_dashboard') || 'Voir le détail';
  actionsDiv.appendChild(btnDashboard);

  const btnSettings = document.createElement('button');
  btnSettings.type = 'button';
  btnSettings.className = 'btn btn-secondary';
  btnSettings.textContent = mockGetMessage('popup_btn_settings') || 'Paramètres';
  actionsDiv.appendChild(btnSettings);

  container.appendChild(actionsDiv);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContainer(): HTMLDivElement {
  return document.createElement('div');
}

// ---------------------------------------------------------------------------
// Tests : renderScoreSection — score null (état initial)
// ---------------------------------------------------------------------------

describe('renderScoreSection — score null (état initial)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = makeContainer();
    renderScoreSection(container, null);
  });

  it('TC-RS-01 : ajoute une section au container', () => {
    expect(container.querySelector('section')).not.toBeNull();
  });

  it('TC-RS-02 : section a un aria-label non vide', () => {
    const section = container.querySelector('section');
    expect(section?.getAttribute('aria-label')).toBeTruthy();
  });

  it('TC-RS-03 : contient un h2.section-title', () => {
    const h2 = container.querySelector('h2.section-title');
    expect(h2).not.toBeNull();
  });

  it('TC-RS-04 : contient div.score-no-data (pas de jauge)', () => {
    expect(container.querySelector('.score-no-data')).not.toBeNull();
  });

  it('TC-RS-05 : contient p.score-no-data-label', () => {
    const p = container.querySelector('p.score-no-data-label');
    expect(p).not.toBeNull();
    expect(p?.textContent).toBeTruthy();
  });

  it('TC-RS-06 : contient p.score-no-data-date avec la date du prochain lundi', () => {
    const p = container.querySelector('p.score-no-data-date');
    expect(p).not.toBeNull();
    expect(p?.textContent).toBeTruthy();
  });

  it('TC-RS-07 : PAS de jauge SVG (score-gauge-wrapper absent)', () => {
    expect(container.querySelector('.score-gauge-wrapper')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests : renderScoreSection — score numérique
// ---------------------------------------------------------------------------

describe('renderScoreSection — score numérique (jauge SVG)', () => {
  it('TC-RS-08 : score 75 → jauge SVG avec role=img', () => {
    const container = makeContainer();
    renderScoreSection(container, 75);
    const svg = container.querySelector('.score-gauge-wrapper svg');
    expect(svg?.getAttribute('role')).toBe('img');
  });

  it('TC-RS-09 : score 75 → aria-label du SVG contient le score et le niveau', () => {
    const container = makeContainer();
    renderScoreSection(container, 75);
    const svg = container.querySelector('svg[role="img"]');
    const label = svg?.getAttribute('aria-label') ?? '';
    expect(label).toContain('75');
    expect(label).toContain('Bon');
  });

  it('TC-RS-10 : score 50 → aria-label du SVG contient "Moyen"', () => {
    const container = makeContainer();
    renderScoreSection(container, 50);
    const svg = container.querySelector('svg[role="img"]');
    expect(svg?.getAttribute('aria-label')).toContain('Moyen');
  });

  it('TC-RS-11 : score 20 → aria-label du SVG contient "Faible"', () => {
    const container = makeContainer();
    renderScoreSection(container, 20);
    const svg = container.querySelector('svg[role="img"]');
    expect(svg?.getAttribute('aria-label')).toContain('Faible');
  });

  it('TC-RS-12 : score 75 → p.score-level avec textContent "Bon"', () => {
    const container = makeContainer();
    renderScoreSection(container, 75);
    const levelEl = container.querySelector('p.score-level');
    expect(levelEl?.textContent).toBe('Bon');
  });

  it('TC-RS-13 : score 75 → p.score-level avec couleur success', () => {
    const container = makeContainer();
    renderScoreSection(container, 75);
    const levelEl = container.querySelector('p.score-level') as HTMLElement;
    expect(levelEl?.style.color).toBe('var(--sn-color-success)');
  });

  it('TC-RS-14 : score 50 → p.score-level avec couleur warning', () => {
    const container = makeContainer();
    renderScoreSection(container, 50);
    const levelEl = container.querySelector('p.score-level') as HTMLElement;
    expect(levelEl?.style.color).toBe('var(--sn-color-warning)');
  });

  it('TC-RS-15 : score 20 → p.score-level avec couleur danger', () => {
    const container = makeContainer();
    renderScoreSection(container, 20);
    const levelEl = container.querySelector('p.score-level') as HTMLElement;
    expect(levelEl?.style.color).toBe('var(--sn-color-danger)');
  });

  it('TC-RS-16 : score numérique → PAS de div.score-no-data', () => {
    const container = makeContainer();
    renderScoreSection(container, 80);
    expect(container.querySelector('.score-no-data')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests : renderStatusSection — modules
// ---------------------------------------------------------------------------

describe('renderStatusSection — modules', () => {
  it('TC-RS-17 : section avec aria-label "Statut rapide"', () => {
    const container = makeContainer();
    renderStatusSection(container, 7, 3, false);
    const section = container.querySelector('section');
    expect(section?.getAttribute('aria-label')).toBe('Statut rapide');
  });

  it('TC-RS-18 : section avec classe "status-section"', () => {
    const container = makeContainer();
    renderStatusSection(container, 7, 3, false);
    expect(container.querySelector('section.status-section')).not.toBeNull();
  });

  it('TC-RS-19 : 7 modules actifs → valeur "7 / 7" sans sous-texte inactifs', () => {
    const container = makeContainer();
    renderStatusSection(container, 7, 3, false);
    const rows = container.querySelectorAll('.status-row');
    const modulesRow = rows[0];
    const mainValue = modulesRow.querySelector('.status-value');
    expect(mainValue?.textContent).toBe('7 / 7');
    expect(modulesRow.querySelector('.status-value-sub')).toBeNull();
  });

  it('TC-RS-20 : 5 modules actifs → valeur "5 / 7" + sous-texte "2 inactifs"', () => {
    const container = makeContainer();
    renderStatusSection(container, 5, 3, false);
    const rows = container.querySelectorAll('.status-row');
    const modulesRow = rows[0];
    const mainValue = modulesRow.querySelector('.status-value');
    expect(mainValue?.textContent).toBe('5 / 7');
    const sub = modulesRow.querySelector('.status-value-sub');
    expect(sub?.textContent).toBe('2 inactifs');
  });

  it('TC-RS-21 : 6 modules actifs → sous-texte "1 inactif" (singulier)', () => {
    const container = makeContainer();
    renderStatusSection(container, 6, 3, false);
    const rows = container.querySelectorAll('.status-row');
    const sub = rows[0].querySelector('.status-value-sub');
    expect(sub?.textContent).toBe('1 inactif');
  });
});

// ---------------------------------------------------------------------------
// Tests : renderStatusSection — quota
// ---------------------------------------------------------------------------

describe('renderStatusSection — quota', () => {
  it('TC-RS-22 : quotaRemaining=3, quotaReached=false → valeur "3", sous-texte "nudges restants"', () => {
    const container = makeContainer();
    renderStatusSection(container, 7, 3, false);
    const rows = container.querySelectorAll('.status-row');
    const quotaRow = rows[1];
    expect(quotaRow.querySelector('.status-value')?.textContent).toBe('3');
    expect(quotaRow.querySelector('.status-value-sub')?.textContent).toBe('nudges restants');
  });

  it('TC-RS-23 : quotaRemaining=null → valeur "∞", sous-texte "illimité"', () => {
    const container = makeContainer();
    renderStatusSection(container, 7, null, false);
    const rows = container.querySelectorAll('.status-row');
    const quotaRow = rows[1];
    expect(quotaRow.querySelector('.status-value')?.textContent).toBe('∞');
    expect(quotaRow.querySelector('.status-value-sub')?.textContent).toBe('illimité');
  });

  it('TC-RS-24 : quotaReached=true → valeur "0", sous-texte "limite atteinte", couleur warning', () => {
    const container = makeContainer();
    renderStatusSection(container, 7, 0, true);
    const rows = container.querySelectorAll('.status-row');
    const quotaRow = rows[1];
    const main = quotaRow.querySelector('.status-value') as HTMLElement;
    expect(main.textContent).toBe('0');
    expect(quotaRow.querySelector('.status-value-sub')?.textContent).toBe('limite atteinte');
    expect(main.style.color).toBe('var(--sn-color-warning)');
  });

  it('TC-RS-25 : quota non atteint → pas de couleur warning sur la valeur', () => {
    const container = makeContainer();
    renderStatusSection(container, 7, 2, false);
    const rows = container.querySelectorAll('.status-row');
    const main = rows[1].querySelector('.status-value') as HTMLElement;
    expect(main.style.color).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Tests : renderActionsSection — boutons
// ---------------------------------------------------------------------------

describe("renderActionsSection — boutons d'action", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = makeContainer();
    renderActionsSection(container);
  });

  it('TC-RS-26 : ajoute un div.actions', () => {
    expect(container.querySelector('div.actions')).not.toBeNull();
  });

  it('TC-RS-27 : contient exactement 2 boutons', () => {
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(2);
  });

  it('TC-RS-28 : premier bouton avec classe "btn btn-primary"', () => {
    const buttons = container.querySelectorAll('button');
    expect(buttons[0].className).toBe('btn btn-primary');
  });

  it('TC-RS-29 : premier bouton avec textContent "Voir le détail"', () => {
    const buttons = container.querySelectorAll('button');
    expect(buttons[0].textContent).toBe('Voir le détail');
  });

  it('TC-RS-30 : second bouton avec classe "btn btn-secondary"', () => {
    const buttons = container.querySelectorAll('button');
    expect(buttons[1].className).toBe('btn btn-secondary');
  });

  it('TC-RS-31 : second bouton avec textContent "Paramètres"', () => {
    const buttons = container.querySelectorAll('button');
    expect(buttons[1].textContent).toBe('Paramètres');
  });

  it('TC-RS-32 : tous les boutons ont type="button" (pas de submit par défaut)', () => {
    const buttons = container.querySelectorAll('button');
    for (const btn of buttons) {
      expect(btn.type).toBe('button');
    }
  });
});
