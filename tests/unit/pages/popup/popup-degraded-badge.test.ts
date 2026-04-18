/**
 * @file tests/unit/pages/popup/popup-degraded-badge.test.ts
 * @description Tests unitaires badge mode dégradé (TACHE-062).
 *
 * Couvre les fonctions exportées getDegradedModules() et renderDegradedBadge()
 * de popup.ts, conformément aux critères d'acceptation TACHE-062 :
 *
 * TC-01 : tous modules ready=true → pas de badge affiché
 * TC-02 : 1 module ready=false last_boot < 1h → pas de badge (seuil non atteint)
 * TC-03 : 1 module ready=false last_boot > 1h → badge affiché avec ce module listé
 * TC-04 : 3 modules dégradés → badge affiché avec la liste complète
 * TC-05 : badge a role="alert" et aria-live="polite"
 * TC-06 : libellé i18n présent FR ("Mode dégradé") + EN ("Degraded mode")
 * TC-07 : icône warning SVG présente dans le badge
 * TC-08 : absence de diagnostics = pas dégradé (premier boot)
 * TC-09 : ready=false + last_boot_ts=0 = pas dégradé (jamais booté)
 * TC-10 : bouton "En savoir plus" présent et toggle tooltip (aria-expanded)
 * TC-11 : renderDegradedBadge avec liste vide → aucun élément inséré
 * TC-12 : getDegradedModules — seuil exact 1h non déclenché, seuil + 1ms déclenché
 *
 * Référence : TACHE-062, ADR-001 R-BOOT-04, SFD §3.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock browser adapter — défini AVANT vi.mock() (pattern popup-render-sections)
// Note : vi.mock() est hoistée en haut du fichier par Vitest.
// La référence à mockReload/mockGetMessage dans le factory doit utiliser vi.fn()
// directement dans le factory pour éviter la TDZ (temporal dead zone).
// ---------------------------------------------------------------------------

const mockGetMessage = vi.fn((key: string, substitutions?: string | string[]) => {
  const messages: Record<string, string> = {
    popup_degraded_mode_badge: 'Mode dégradé',
    popup_degraded_mode_modules: `Modules affectés : ${Array.isArray(substitutions) ? substitutions[0] : (substitutions ?? '')}`,
    popup_degraded_mode_learn_more: 'En savoir plus',
    popup_degraded_mode_tooltip:
      "Un ou plusieurs modules n'ont pas démarré correctement depuis plus d'une heure.",
    popup_degraded_mode_reload: "Recharger l'extension",
    popup_degraded_mode_tooltip_close: 'Fermer',
  };
  return messages[key] ?? key;
});

const mockReload = vi.fn();

vi.mock('@/shared/browser/browser-adapter', () => ({
  browser: {
    i18n: { getMessage: vi.fn() },
    storage: { local: { get: vi.fn().mockResolvedValue({}) } },
    runtime: {
      sendMessage: vi.fn().mockResolvedValue(null),
      id: 'test-ext-id',
      reload: vi.fn(),
    },
    tabs: { create: vi.fn().mockResolvedValue(undefined) },
  },
}));

vi.mock('@/shared/utils/apply-theme', () => ({
  initTheme: vi.fn().mockResolvedValue(undefined),
  watchThemeChanges: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports après mocks
// ---------------------------------------------------------------------------

import { getDegradedModules, renderDegradedBadge } from '@/pages/popup/popup';
import { browser } from '@/shared/browser/browser-adapter';
import {
  DIAGNOSTICS_M2_KEY,
  DIAGNOSTICS_M3_KEY,
  DIAGNOSTICS_M5_KEY,
  DIAGNOSTICS_M6_KEY,
  DIAGNOSTICS_M7_KEY,
  DIAGNOSTICS_M9_KEY,
  DIAGNOSTICS_M17_KEY,
} from '@/shared/types/diagnostics';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const ONE_HOUR_MS = 3_600_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Construit un objet diagnostics pour un module avec initBoot (last_boot_ts).
 *
 * @param ready      - Valeur du champ ready
 * @param lastBootTs - Timestamp du dernier boot (ms epoch)
 * @returns Objet diagnostics partiel
 */
function mkDiagBoot(ready: boolean, lastBootTs: number): Record<string, unknown> {
  return { ready, last_boot_ts: lastBootTs };
}

/**
 * Construit un objet diagnostics pour M3 (last_boot).
 *
 * @param ready    - Valeur du champ ready
 * @param lastBoot - Timestamp du dernier déclenchement handler score (ms epoch)
 * @returns Objet diagnostics M3 partiel
 */
function mkDiagM3(ready: boolean, lastBoot: number): Record<string, unknown> {
  return { ready, last_boot: lastBoot };
}

/**
 * Construit un objet diagnostics pour M9/M17 (last_action_ts).
 *
 * @param ready        - Valeur du champ ready
 * @param lastActionTs - Timestamp de la dernière action handler (ms epoch)
 * @returns Objet diagnostics M9/M17 partiel
 */
function mkDiagAction(ready: boolean, lastActionTs: number): Record<string, unknown> {
  return { ready, last_action_ts: lastActionTs };
}

// ---------------------------------------------------------------------------
// Tests getDegradedModules()
// ---------------------------------------------------------------------------

describe('getDegradedModules', () => {
  const NOW = 1_000_000_000_000; // Timestamp fixe pour des tests déterministes

  /**
   * TC-01 : Tous les modules sont ready=true → liste dégradée vide.
   * Aucun badge ne doit être affiché.
   */
  it('TC-01 : tous modules ready=true → liste vide', () => {
    const storage: Record<string, unknown> = {
      [DIAGNOSTICS_M2_KEY]: mkDiagBoot(true, NOW - 30_000),
      [DIAGNOSTICS_M3_KEY]: mkDiagM3(true, NOW - 30_000),
      [DIAGNOSTICS_M5_KEY]: mkDiagBoot(true, NOW - 30_000),
      [DIAGNOSTICS_M6_KEY]: mkDiagBoot(true, NOW - 30_000),
      [DIAGNOSTICS_M7_KEY]: mkDiagBoot(true, NOW - 30_000),
      [DIAGNOSTICS_M9_KEY]: mkDiagAction(true, NOW - 30_000),
      [DIAGNOSTICS_M17_KEY]: mkDiagAction(true, NOW - 30_000),
    };
    expect(getDegradedModules(storage, NOW)).toEqual([]);
  });

  /**
   * TC-02 : 1 module ready=false mais last_boot < 1h → pas dégradé.
   * M7 est en échec depuis 30 minutes seulement : seuil non atteint.
   */
  it('TC-02 : 1 module ready=false last_boot < 1h → pas de dégradation', () => {
    const storage: Record<string, unknown> = {
      [DIAGNOSTICS_M7_KEY]: mkDiagBoot(false, NOW - 30 * 60 * 1000), // 30 min
    };
    expect(getDegradedModules(storage, NOW)).toEqual([]);
  });

  /**
   * TC-03 : 1 module ready=false last_boot > 1h → module listé comme dégradé.
   */
  it('TC-03 : 1 module ready=false last_boot > 1h → module M7 dégradé', () => {
    const storage: Record<string, unknown> = {
      [DIAGNOSTICS_M7_KEY]: mkDiagBoot(false, NOW - ONE_HOUR_MS - 1), // 1h + 1ms
    };
    expect(getDegradedModules(storage, NOW)).toEqual(['M7']);
  });

  /**
   * TC-04 : 3 modules dégradés → liste complète avec les 3 labels.
   * M3 est ready=true → non inclus dans la liste dégradée.
   */
  it('TC-04 : 3 modules dégradés → liste [M2, M7, M9]', () => {
    const storage: Record<string, unknown> = {
      [DIAGNOSTICS_M2_KEY]: mkDiagBoot(false, NOW - ONE_HOUR_MS - 5000),
      [DIAGNOSTICS_M3_KEY]: mkDiagM3(true, NOW - 2 * ONE_HOUR_MS), // ready=true → ignoré
      [DIAGNOSTICS_M7_KEY]: mkDiagBoot(false, NOW - 2 * ONE_HOUR_MS),
      [DIAGNOSTICS_M9_KEY]: mkDiagAction(false, NOW - ONE_HOUR_MS - 1),
    };
    expect(getDegradedModules(storage, NOW)).toEqual(['M2', 'M7', 'M9']);
  });

  /**
   * TC-08 : diagnostics absent (clé non présente dans storage) → pas dégradé.
   * L'absence de diagnostics indique un premier boot, pas un état dégradé.
   */
  it('TC-08 : storage vide → aucune dégradation (premier boot)', () => {
    expect(getDegradedModules({}, NOW)).toEqual([]);
  });

  /**
   * TC-09 : ready=false + timestamp=0 → pas dégradé (jamais booté).
   * ts=0 indique que le module n'a jamais terminé un boot SW complet.
   */
  it('TC-09 : ready=false + last_boot_ts=0 → pas dégradé (module jamais démarré)', () => {
    const storage: Record<string, unknown> = {
      [DIAGNOSTICS_M7_KEY]: mkDiagBoot(false, 0),
    };
    expect(getDegradedModules(storage, NOW)).toEqual([]);
  });

  /**
   * TC-12 : seuil strictement supérieur — exactement 1h NON déclenché, 1h+1ms déclenché.
   * La condition est `now - ts > DEGRADED_THRESHOLD_MS` (strict, pas >=).
   */
  it('TC-12 : seuil exactement 1h non déclenché, 1h+1ms déclenché', () => {
    const atExact: Record<string, unknown> = {
      [DIAGNOSTICS_M5_KEY]: mkDiagBoot(false, NOW - ONE_HOUR_MS), // exactement 1h (non déclenché)
    };
    expect(getDegradedModules(atExact, NOW)).toEqual([]);

    const oneMilliOver: Record<string, unknown> = {
      [DIAGNOSTICS_M5_KEY]: mkDiagBoot(false, NOW - ONE_HOUR_MS - 1), // 1h+1ms (déclenché)
    };
    expect(getDegradedModules(oneMilliOver, NOW)).toEqual(['M5']);
  });
});

// ---------------------------------------------------------------------------
// Tests renderDegradedBadge()
// ---------------------------------------------------------------------------

describe('renderDegradedBadge', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    // Injecter les mocks dans le module browser via l'instance importée
    vi.mocked(browser.i18n.getMessage).mockImplementation(
      (key: string, substitutions?: string | string[]) =>
        mockGetMessage(key, substitutions),
    );
    vi.mocked(browser.runtime.reload).mockImplementation(mockReload);
  });

  /**
   * TC-11 : liste vide → aucun enfant inséré.
   * renderDegradedBadge doit être un no-op si degradedModules est vide.
   */
  it('TC-11 : liste vide → aucun enfant inséré dans le conteneur', () => {
    renderDegradedBadge(container, []);
    expect(container.children).toHaveLength(0);
  });

  /**
   * TC-03 : 1 module dégradé → badge présent, module M7 visible dans le texte.
   */
  it('TC-03 : 1 module dégradé → badge inséré avec M7', () => {
    renderDegradedBadge(container, ['M7']);
    expect(container.children).toHaveLength(1);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.className).toBe('degraded-badge');
    expect(badge.textContent).toContain('M7');
  });

  /**
   * TC-04 : 3 modules dégradés → badge avec la liste complète M2, M5, M17.
   */
  it('TC-04 : 3 modules dégradés → liste complète dans le badge', () => {
    renderDegradedBadge(container, ['M2', 'M5', 'M17']);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.textContent).toContain('M2');
    expect(badge.textContent).toContain('M5');
    expect(badge.textContent).toContain('M17');
  });

  /**
   * TC-05 : Le badge a role="alert" et aria-live="polite".
   * Exigence WCAG — annonce automatique aux lecteurs d'écran.
   */
  it('TC-05 : badge a role="alert" et aria-live="polite"', () => {
    renderDegradedBadge(container, ['M7']);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.getAttribute('role')).toBe('alert');
    expect(badge.getAttribute('aria-live')).toBe('polite');
  });

  /**
   * TC-06 FR : libellé i18n "Mode dégradé" (FR) présent dans le badge.
   * getMessage('popup_degraded_mode_badge') doit être appelé.
   */
  it('TC-06 : libellé i18n FR "Mode dégradé" présent dans le badge', () => {
    renderDegradedBadge(container, ['M7']);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.textContent).toContain('Mode dégradé');
    expect(vi.mocked(browser.i18n.getMessage)).toHaveBeenCalledWith('popup_degraded_mode_badge');
  });

  /**
   * TC-06 EN : fallback "Mode degrade" utilisé quand getMessage retourne ''.
   * Simule le cas où la locale EN est active et retourne la chaîne EN attendue.
   */
  it('TC-06 : fallback hardcodé utilisé si getMessage retourne chaîne vide', () => {
    vi.mocked(browser.i18n.getMessage).mockReturnValue('');
    renderDegradedBadge(container, ['M7']);
    const badge = container.firstElementChild as HTMLElement;
    // Le fallback de renderDegradedBadge est "Mode degrade" (sans accent)
    expect(badge.textContent).toContain('Mode degrade');
  });

  /**
   * TC-07 : icône SVG warning présente dans le badge-header.
   * L'icône doit être aria-hidden et utiliser le path triangle attention.
   */
  it('TC-07 : icône SVG warning présente dans .degraded-badge-header', () => {
    renderDegradedBadge(container, ['M7']);
    const badge = container.firstElementChild as HTMLElement;
    const header = badge.querySelector('.degraded-badge-header');
    expect(header).not.toBeNull();
    const svg = header?.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    const path = svg?.querySelector('path');
    // Path Material Design "warning" (triangle + point d'exclamation)
    expect(path?.getAttribute('d')).toBe('M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z');
  });

  /**
   * TC-10 : Bouton "En savoir plus" présent, toggle tooltip via aria-expanded.
   * Clic 1 → tooltip visible + aria-expanded="true".
   * Clic 2 → tooltip masquée + aria-expanded="false".
   */
  it('TC-10 : bouton En savoir plus toggle la tooltip et aria-expanded', () => {
    renderDegradedBadge(container, ['M7']);
    const badge = container.firstElementChild as HTMLElement;

    const learnMoreBtn = badge.querySelector('.degraded-badge-learn-more') as HTMLButtonElement;
    expect(learnMoreBtn).not.toBeNull();
    expect(learnMoreBtn.textContent).toContain('En savoir plus');
    expect(learnMoreBtn.getAttribute('aria-expanded')).toBe('false');

    const tooltip = badge.querySelector('.degraded-tooltip') as HTMLElement;
    expect(tooltip.hidden).toBe(true);

    // Clic 1 : ouvre la tooltip
    learnMoreBtn.click();
    expect(tooltip.hidden).toBe(false);
    expect(learnMoreBtn.getAttribute('aria-expanded')).toBe('true');

    // Clic 2 : ferme la tooltip
    learnMoreBtn.click();
    expect(tooltip.hidden).toBe(true);
    expect(learnMoreBtn.getAttribute('aria-expanded')).toBe('false');
  });

  /**
   * TC-S1 : bouton "Recharger l'extension" appelle browser.runtime.reload().
   */
  it('TC-S1 : bouton Recharger appelle browser.runtime.reload()', () => {
    renderDegradedBadge(container, ['M7']);
    const badge = container.firstElementChild as HTMLElement;

    // Ouvrir la tooltip d'abord
    const learnMoreBtn = badge.querySelector('.degraded-badge-learn-more') as HTMLButtonElement;
    learnMoreBtn.click();

    const reloadBtn = badge.querySelector('.degraded-tooltip-reload') as HTMLButtonElement;
    expect(reloadBtn).not.toBeNull();
    reloadBtn.click();
    expect(vi.mocked(browser.runtime.reload)).toHaveBeenCalledOnce();
  });

  /**
   * TC-S2 : bouton "Fermer" masque la tooltip et restaure aria-expanded=false.
   */
  it('TC-S2 : bouton Fermer masque la tooltip et restaure aria-expanded=false', () => {
    renderDegradedBadge(container, ['M7']);
    const badge = container.firstElementChild as HTMLElement;

    // Ouvrir la tooltip
    const learnMoreBtn = badge.querySelector('.degraded-badge-learn-more') as HTMLButtonElement;
    learnMoreBtn.click();
    expect((badge.querySelector('.degraded-tooltip') as HTMLElement).hidden).toBe(false);

    const closeBtn = badge.querySelector('.degraded-tooltip-close') as HTMLButtonElement;
    closeBtn.click();
    expect((badge.querySelector('.degraded-tooltip') as HTMLElement).hidden).toBe(true);
    expect(learnMoreBtn.getAttribute('aria-expanded')).toBe('false');
  });
});
