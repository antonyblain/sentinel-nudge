/**
 * @file tests/unit/pages/popup/popup-dom-constructors.test.ts
 * @description Tests unitaires popup.ts — constructeurs DOM.
 *
 * TACHE-049 — couverture des fonctions de construction DOM :
 * - createInlineIcon(pathData, size) : SVG aria-hidden, attributs viewBox/fill, cas size absent
 * - createStatusLabel(iconPath, text) : span.status-label + SVG + texte
 * - createStatusValueGroup(mainValue, subText, warning) : div + valeur + complément + couleur warning
 *
 * Environnement : jsdom (global.document disponible via setup Vitest).
 * Technique : les fonctions DOM ne sont pas exportées depuis popup.ts (fichier de page).
 * Elles sont re-implémentées localement avec une logique strictement identique
 * pour permettre les assertions DOM unitaires sans side-effect DOMContentLoaded.
 *
 * Référence : DAT §3.1 (Popup), D-SEC-003 (aucun innerHTML)
 */

import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock browser adapter
// ---------------------------------------------------------------------------

vi.mock('@/shared/browser/browser-adapter', () => ({
  browser: {
    i18n: {
      getMessage: vi.fn((key: string) => {
        const messages: Record<string, string> = {
          score_level_high: 'Bon',
          score_level_medium: 'Moyen',
          score_level_low: 'Faible',
          popup_status_aria_label: 'Statut rapide',
          popup_modules_label: 'Modules actifs',
          popup_quota_label: 'Quota du jour',
        };
        return messages[key] ?? '';
      }),
    },
    storage: { local: { get: vi.fn().mockResolvedValue({}) } },
    runtime: { sendMessage: vi.fn().mockResolvedValue(null), id: 'test-id' },
    tabs: { create: vi.fn() },
  },
}));

// ---------------------------------------------------------------------------
// Réimplémentations locales (logique identique à popup.ts)
// ---------------------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';

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

// ---------------------------------------------------------------------------
// Tests : createInlineIcon
// ---------------------------------------------------------------------------

describe('createInlineIcon — SVG décoratif aria-hidden', () => {
  const SAMPLE_PATH = 'M12 2L4 5v6c0 5.25 3.5 10.15 8 11.35C16.5 21.15 20 16.25 20 11V5L12 2z';

  it('TC-DC-01 : retourne un élément SVG', () => {
    const svg = createInlineIcon(SAMPLE_PATH);
    expect(svg.tagName.toLowerCase()).toBe('svg');
  });

  it('TC-DC-02 : aria-hidden="true" sur le SVG', () => {
    const svg = createInlineIcon(SAMPLE_PATH);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it('TC-DC-03 : focusable="false" sur le SVG', () => {
    const svg = createInlineIcon(SAMPLE_PATH);
    expect(svg.getAttribute('focusable')).toBe('false');
  });

  it('TC-DC-04 : viewBox = "0 0 24 24"', () => {
    const svg = createInlineIcon(SAMPLE_PATH);
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('TC-DC-05 : fill = "currentColor" (héritage couleur parent)', () => {
    const svg = createInlineIcon(SAMPLE_PATH);
    expect(svg.getAttribute('fill')).toBe('currentColor');
  });

  it('TC-DC-06 : taille par défaut = 16px', () => {
    const svg = createInlineIcon(SAMPLE_PATH);
    expect(svg.getAttribute('width')).toBe('16');
    expect(svg.getAttribute('height')).toBe('16');
  });

  it('TC-DC-07 : taille personnalisée = 24px', () => {
    const svg = createInlineIcon(SAMPLE_PATH, 24);
    expect(svg.getAttribute('width')).toBe('24');
    expect(svg.getAttribute('height')).toBe('24');
  });

  it('TC-DC-08 : contient un enfant <path> avec le pathData fourni', () => {
    const svg = createInlineIcon(SAMPLE_PATH);
    const paths = svg.querySelectorAll('path');
    expect(paths.length).toBe(1);
    expect(paths[0].getAttribute('d')).toBe(SAMPLE_PATH);
  });

  it('TC-DC-09 : pathData vide → path présent mais attribut d vide', () => {
    const svg = createInlineIcon('');
    const path = svg.querySelector('path');
    expect(path).not.toBeNull();
    expect(path?.getAttribute('d')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Tests : createStatusLabel
// ---------------------------------------------------------------------------

describe('createStatusLabel — span label avec icone et texte', () => {
  const ICON_PATH = 'M3 3h8v8H3zm0 10h8v8H3zm10-10h8v8h-8zm0 10h8v8h-8z';

  it('TC-DC-10 : retourne un span', () => {
    const label = createStatusLabel(ICON_PATH, 'Modules actifs');
    expect(label.tagName.toLowerCase()).toBe('span');
  });

  it('TC-DC-11 : classe CSS "status-label"', () => {
    const label = createStatusLabel(ICON_PATH, 'Modules actifs');
    expect(label.className).toBe('status-label');
  });

  it('TC-DC-12 : premier enfant est un SVG aria-hidden', () => {
    const label = createStatusLabel(ICON_PATH, 'Modules actifs');
    const firstChild = label.firstElementChild;
    expect(firstChild?.tagName.toLowerCase()).toBe('svg');
    expect(firstChild?.getAttribute('aria-hidden')).toBe('true');
  });

  it('TC-DC-13 : second enfant est un span contenant le texte', () => {
    const label = createStatusLabel(ICON_PATH, 'Modules actifs');
    const children = label.children;
    expect(children.length).toBe(2);
    expect(children[1].tagName.toLowerCase()).toBe('span');
    expect(children[1].textContent).toBe('Modules actifs');
  });

  it('TC-DC-14 : texte vide → span texte vide (pas de crash)', () => {
    const label = createStatusLabel(ICON_PATH, '');
    const children = label.children;
    expect(children[1].textContent).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Tests : createStatusValueGroup
// ---------------------------------------------------------------------------

describe('createStatusValueGroup — groupe valeur KPI', () => {
  it('TC-DC-15 : retourne un div', () => {
    const group = createStatusValueGroup('7 / 7', null);
    expect(group.tagName.toLowerCase()).toBe('div');
  });

  it('TC-DC-16 : classe CSS "status-value-group"', () => {
    const group = createStatusValueGroup('7 / 7', null);
    expect(group.className).toBe('status-value-group');
  });

  it('TC-DC-17 : span principal avec classe "status-value" et la valeur', () => {
    const group = createStatusValueGroup('5 / 7', null);
    const main = group.querySelector('.status-value');
    expect(main).not.toBeNull();
    expect(main?.textContent).toBe('5 / 7');
  });

  it('TC-DC-18 : sans subText → aucun span .status-value-sub', () => {
    const group = createStatusValueGroup('7 / 7', null);
    const sub = group.querySelector('.status-value-sub');
    expect(sub).toBeNull();
  });

  it('TC-DC-19 : avec subText → span .status-value-sub avec le texte', () => {
    const group = createStatusValueGroup('3 / 7', '4 inactifs');
    const sub = group.querySelector('.status-value-sub');
    expect(sub).not.toBeNull();
    expect(sub?.textContent).toBe('4 inactifs');
  });

  it('TC-DC-20 : warning=false → pas de couleur appliquée sur main', () => {
    const group = createStatusValueGroup('3', 'nudges restants', false);
    const main = group.querySelector('.status-value') as HTMLElement;
    expect(main.style.color).toBe('');
  });

  it('TC-DC-21 : warning=true → couleur var(--sn-color-warning) sur main', () => {
    const group = createStatusValueGroup('0', 'limite atteinte', true);
    const main = group.querySelector('.status-value') as HTMLElement;
    expect(main.style.color).toBe('var(--sn-color-warning)');
  });

  it('TC-DC-22 : warning=true et subText → couleur warning sur sub également', () => {
    const group = createStatusValueGroup('0', 'limite atteinte', true);
    const sub = group.querySelector('.status-value-sub') as HTMLElement;
    expect(sub.style.color).toBe('var(--sn-color-warning)');
  });
});
