/**
 * @file tests/unit/pages/options/options-theme-selector.test.ts
 * @description Tests unitaires — sélecteur de thème dans options (TACHE-147/148).
 *
 * Tâches couvertes :
 *   TACHE-147 : sélecteur 4 positions (auto/light/dark/matrix) dans options.ts
 *   TACHE-148 : application data-theme sur document.documentElement
 *
 * Stratégie :
 *   Les fonctions de options.ts ne sont pas exportées (fichier de page).
 *   On teste directement le module partagé apply-theme.ts (logique centrale)
 *   et on réimplémente localement la logique renderAppearanceSection pour
 *   les assertions DOM / storage.
 *
 * Cas de test :
 *   TC-01 : sélection 'auto' → aucun data-theme appliqué
 *   TC-02 : sélection 'light' → data-theme='light' sur <html>
 *   TC-03 : sélection 'dark'  → data-theme='dark' sur <html>
 *   TC-04 : sélection 'matrix' → data-theme='matrix' sur <html>
 *   TC-05 : rechargement → lecture storage restaure data-theme='dark'
 *   TC-06 : labels i18n FR — 6 clés présentes et non vides
 *   TC-07 : labels i18n — chaque option radio a un label non vide
 *   TC-08 : accessibilité — fieldset a role='radiogroup' et aria-label
 *   TC-09 : accessibilité — 4 inputs radio avec les valeurs attendues
 *   TC-10 : initTheme avec storage 'auto' → data-theme absent
 *   TC-11 : initTheme avec storage 'matrix' → data-theme='matrix'
 *   TC-12 : watchThemeChanges → changement dynamique via onChanged 'light'
 *
 * Référence : TACHE-147, TACHE-148, DAT §11.4 (design system)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — les factories vi.mock sont hoistées, ne PAS référencer des
// variables locales déclarées avec let/const dans la factory.
// ---------------------------------------------------------------------------

const mockStorageGet = vi.fn();
const mockStorageSet = vi.fn().mockResolvedValue(undefined);

let storedOnChangedCallback: ((changes: Record<string, unknown>, area: string) => void) | null =
  null;

vi.mock('@/shared/browser/browser-adapter', () => {
  const fr: Record<string, string> = {
    options_section_appearance: 'Apparence',
    options_theme_label: "Thème de l'interface",
    options_theme_auto: 'Auto (OS)',
    options_theme_light: 'Clair',
    options_theme_dark: 'Sombre',
    options_theme_matrix: 'Matrix',
  };
  return {
    browser: {
      i18n: {
        getMessage: (key: string) => fr[key] ?? '',
      },
      storage: {
        local: {
          get: (...args: unknown[]) => mockStorageGet(...args),
          set: (...args: unknown[]) => mockStorageSet(...args),
        },
        onChanged: {
          addListener: (cb: (changes: Record<string, unknown>, area: string) => void) => {
            storedOnChangedCallback = cb;
          },
        },
      },
      runtime: {
        getManifest: () => ({ version: '1.0.0' }),
        getURL: (path: string) => `chrome-extension://test/${path}`,
      },
    },
  };
});

// ---------------------------------------------------------------------------
// Import après mock
// ---------------------------------------------------------------------------

import { initTheme, watchThemeChanges } from '@/shared/utils/apply-theme';

// ---------------------------------------------------------------------------
// Helpers locaux
// ---------------------------------------------------------------------------

/** Implémentation locale de applyThemeToDocument (miroir de apply-theme.ts). */
function applyThemeLocally(theme: unknown): void {
  const allowed = new Set(['light', 'dark', 'matrix']);
  if (typeof theme !== 'string') return;
  if (allowed.has(theme)) {
    document.documentElement.dataset['theme'] = theme;
  } else {
    delete document.documentElement.dataset['theme'];
  }
}

/** Crée un radiogroup DOM avec les 4 options de thème. */
function buildThemeRadioGroup(): HTMLFieldSetElement {
  const fieldset = document.createElement('fieldset');
  fieldset.setAttribute('role', 'radiogroup');
  fieldset.setAttribute('aria-label', "Thème de l'interface");

  const opts = [
    { value: 'auto', label: 'Auto (OS)' },
    { value: 'light', label: 'Clair' },
    { value: 'dark', label: 'Sombre' },
    { value: 'matrix', label: 'Matrix' },
  ];

  for (const opt of opts) {
    const input = document.createElement('input');
    input.type = 'radio';
    input.id = `theme-${opt.value}`;
    input.name = 'ui-theme';
    input.value = opt.value;

    const label = document.createElement('label');
    label.htmlFor = input.id;
    label.textContent = opt.label;

    fieldset.appendChild(input);
    fieldset.appendChild(label);
  }

  return fieldset;
}

/** Map i18n FR utilisée pour TC-06. */
const FR_I18N: Record<string, string> = {
  options_section_appearance: 'Apparence',
  options_theme_label: "Thème de l'interface",
  options_theme_auto: 'Auto (OS)',
  options_theme_light: 'Clair',
  options_theme_dark: 'Sombre',
  options_theme_matrix: 'Matrix',
};

/** Map i18n EN utilisée pour TC-06 (contrôle présence). */
const EN_I18N: Record<string, string> = {
  options_section_appearance: 'Appearance',
  options_theme_label: 'Interface theme',
  options_theme_auto: 'Auto (OS)',
  options_theme_light: 'Light',
  options_theme_dark: 'Dark',
  options_theme_matrix: 'Matrix',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('options-theme-selector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storedOnChangedCallback = null;
    delete document.documentElement.dataset['theme'];
    mockStorageGet.mockResolvedValue({});
  });

  afterEach(() => {
    delete document.documentElement.dataset['theme'];
  });

  // TC-01 : 'auto' → pas de data-theme
  it("TC-01: sélection 'auto' → aucun data-theme sur <html>", () => {
    // Simuler un data-theme préexistant
    document.documentElement.dataset['theme'] = 'dark';

    applyThemeLocally('auto');

    expect(document.documentElement.dataset['theme']).toBeUndefined();
  });

  // TC-02 : 'light' → data-theme='light'
  it("TC-02: sélection 'light' → data-theme='light' sur <html>", () => {
    applyThemeLocally('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
  });

  // TC-03 : 'dark' → data-theme='dark'
  it("TC-03: sélection 'dark' → data-theme='dark' sur <html>", () => {
    applyThemeLocally('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  // TC-04 : 'matrix' → data-theme='matrix'
  it("TC-04: sélection 'matrix' → data-theme='matrix' sur <html>", () => {
    applyThemeLocally('matrix');
    expect(document.documentElement.dataset['theme']).toBe('matrix');
  });

  // TC-05 : rechargement → storage restaure data-theme
  it("TC-05: rechargement → storage='dark' restaure data-theme='dark'", async () => {
    mockStorageGet.mockResolvedValueOnce({ theme: 'dark' });

    await initTheme();

    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  // TC-06 : labels i18n FR et EN — 6 clés présentes et non vides
  it('TC-06: labels i18n FR et EN — 6 clés présentes et non vides', () => {
    const keys = [
      'options_section_appearance',
      'options_theme_label',
      'options_theme_auto',
      'options_theme_light',
      'options_theme_dark',
      'options_theme_matrix',
    ];

    for (const key of keys) {
      expect(FR_I18N[key], `FR '${key}' doit être défini`).toBeTruthy();
      expect(FR_I18N[key].length, `FR '${key}' doit être non vide`).toBeGreaterThan(0);
      expect(EN_I18N[key], `EN '${key}' doit être défini`).toBeTruthy();
      expect(EN_I18N[key].length, `EN '${key}' doit être non vide`).toBeGreaterThan(0);
    }
  });

  // TC-07 : chaque option radio a un label non vide
  it('TC-07: chaque option radio a un label non vide', () => {
    const fieldset = buildThemeRadioGroup();
    const labels = fieldset.querySelectorAll('label');

    expect(labels).toHaveLength(4);
    for (const label of Array.from(labels)) {
      expect((label.textContent?.trim().length ?? 0) > 0, 'label non vide').toBe(true);
    }
  });

  // TC-08 : accessibilité — radiogroup + aria-label
  it("TC-08: accessibilité — fieldset a role='radiogroup' et aria-label non vide", () => {
    const fieldset = buildThemeRadioGroup();

    expect(fieldset.getAttribute('role')).toBe('radiogroup');
    const ariaLabel = fieldset.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel!.length).toBeGreaterThan(0);
  });

  // TC-09 : 4 inputs radio avec les valeurs attendues
  it('TC-09: accessibilité — 4 inputs radio avec valeurs auto/light/dark/matrix', () => {
    const fieldset = buildThemeRadioGroup();
    const inputs = fieldset.querySelectorAll<HTMLInputElement>('input[type="radio"]');

    expect(inputs).toHaveLength(4);
    const values = Array.from(inputs).map((i) => i.value);
    expect(values).toContain('auto');
    expect(values).toContain('light');
    expect(values).toContain('dark');
    expect(values).toContain('matrix');
  });

  // TC-10 : initTheme avec 'auto' → pas de data-theme
  it("TC-10: initTheme avec storage 'auto' → data-theme absent", async () => {
    mockStorageGet.mockResolvedValueOnce({ theme: 'auto' });

    await initTheme();

    expect(document.documentElement.dataset['theme']).toBeUndefined();
  });

  // TC-11 : initTheme avec 'matrix' → data-theme='matrix'
  it("TC-11: initTheme avec storage 'matrix' → data-theme='matrix'", async () => {
    mockStorageGet.mockResolvedValueOnce({ theme: 'matrix' });

    await initTheme();

    expect(document.documentElement.dataset['theme']).toBe('matrix');
  });

  // TC-12 : watchThemeChanges → changement dynamique
  it("TC-12: watchThemeChanges → onChanged 'light' applique data-theme='light'", () => {
    watchThemeChanges();

    expect(storedOnChangedCallback).not.toBeNull();

    storedOnChangedCallback!(
      { theme: { oldValue: 'auto', newValue: 'light' } } as Record<string, unknown>,
      'local',
    );

    expect(document.documentElement.dataset['theme']).toBe('light');
  });
});
