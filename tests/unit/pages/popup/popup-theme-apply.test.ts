/**
 * @file tests/unit/pages/popup/popup-theme-apply.test.ts
 * @description Tests unitaires — application du thème dans popup (TACHE-148).
 *
 * Tâches couvertes :
 *   TACHE-148 : application data-theme au chargement avant le rendu (FOUC prevention)
 *
 * Cas de test :
 *   TC-01 : storage='auto' → aucun data-theme sur <html>
 *   TC-02 : storage='dark' → data-theme='dark' appliqué (anti-FOUC)
 *   TC-03 : storage='matrix' → data-theme='matrix'
 *   TC-04 : storage='light' → data-theme='light'
 *   TC-05 : storage vide (pas de clé theme) → data-theme absent
 *   TC-06 : valeur invalide 'hacker' → data-theme absent (sécurité whitelist)
 *   TC-07 : onChanged clé 'theme'='dark' → appliqué dynamiquement
 *   TC-08 : onChanged depuis area='sync' → ignoré
 *
 * Référence : TACHE-148 (apply data-theme), DAT §11.4 (design system)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — les factories vi.mock sont hoistées.
// On utilise une closure pour capturer le callback onChanged.
// ---------------------------------------------------------------------------

const mockStorageGet = vi.fn();

let storedOnChangedCallback: ((changes: Record<string, unknown>, area: string) => void) | null =
  null;

vi.mock('@/shared/browser/browser-adapter', () => ({
  browser: {
    i18n: {
      getMessage: (key: string) => key,
    },
    storage: {
      local: {
        get: (...args: unknown[]) => mockStorageGet(...args),
        set: vi.fn().mockResolvedValue(undefined),
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
      sendMessage: vi.fn().mockResolvedValue(null),
      id: 'test-ext-id',
    },
    tabs: {
      create: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

// ---------------------------------------------------------------------------
// Import après mock
// ---------------------------------------------------------------------------

import { initTheme, watchThemeChanges } from '@/shared/utils/apply-theme';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('popup-theme-apply', () => {
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
  it("TC-01: storage='auto' → aucun data-theme sur <html>", async () => {
    mockStorageGet.mockResolvedValueOnce({ theme: 'auto' });

    await initTheme();

    expect(document.documentElement.dataset['theme']).toBeUndefined();
  });

  // TC-02 : 'dark' → data-theme='dark' (anti-FOUC)
  it("TC-02: storage='dark' → data-theme='dark' appliqué (anti-FOUC)", async () => {
    mockStorageGet.mockResolvedValueOnce({ theme: 'dark' });

    await initTheme();

    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  // TC-03 : 'matrix' → data-theme='matrix'
  it("TC-03: storage='matrix' → data-theme='matrix' appliqué", async () => {
    mockStorageGet.mockResolvedValueOnce({ theme: 'matrix' });

    await initTheme();

    expect(document.documentElement.dataset['theme']).toBe('matrix');
  });

  // TC-04 : 'light' → data-theme='light'
  it("TC-04: storage='light' → data-theme='light' appliqué", async () => {
    mockStorageGet.mockResolvedValueOnce({ theme: 'light' });

    await initTheme();

    expect(document.documentElement.dataset['theme']).toBe('light');
  });

  // TC-05 : storage vide → aucun data-theme
  it('TC-05: storage vide (pas de clé theme) → data-theme absent', async () => {
    mockStorageGet.mockResolvedValueOnce({});

    await initTheme();

    expect(document.documentElement.dataset['theme']).toBeUndefined();
  });

  // TC-06 : valeur invalide → data-theme absent (whitelist sécurité)
  it("TC-06: valeur invalide 'hacker' → data-theme absent (sécurité whitelist)", async () => {
    mockStorageGet.mockResolvedValueOnce({ theme: 'hacker' });

    await initTheme();

    expect(document.documentElement.dataset['theme']).toBeUndefined();
  });

  // TC-07 : onChanged local 'dark' → data-theme='dark' dynamique
  it("TC-07: onChanged clé 'theme'='dark' → data-theme='dark' dynamique", () => {
    watchThemeChanges();

    expect(storedOnChangedCallback).not.toBeNull();

    storedOnChangedCallback!(
      { theme: { oldValue: 'auto', newValue: 'dark' } } as Record<string, unknown>,
      'local',
    );

    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  // TC-08 : onChanged depuis sync → ignoré
  it("TC-08: onChanged depuis area='sync' → data-theme non modifié (ignoré)", () => {
    watchThemeChanges();

    expect(storedOnChangedCallback).not.toBeNull();

    storedOnChangedCallback!(
      { theme: { oldValue: 'auto', newValue: 'matrix' } } as Record<string, unknown>,
      'sync',
    );

    // L'area sync doit être ignorée
    expect(document.documentElement.dataset['theme']).toBeUndefined();
  });
});
