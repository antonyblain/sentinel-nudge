/**
 * @file tests/unit/pages/health/health.test.ts
 * @description Tests unitaires de la page État de santé — T-109.
 *
 * Couverture :
 * 1. Rendu complet : 7 modules OK → sections vertes (data-status='ok' ou 'unknown')
 * 2. Module avec lastError récent → section jaune/rouge (data-status='warn'|'error')
 * 3. Heartbeat > 1h → alerte "dégradé" + status 'warn'
 * 4. Bouton expand/collapse fonctionnel (aria-expanded + hidden)
 * 5. formatTimestamp : timestamp nul → '—', timestamp réel → date formatée
 * 6. computeM7Status : combinaisons ready/canary_verified/stale
 * 7. Storage vide → modules 'unknown'
 * 8. Erreur storage → message d'erreur accessible
 *
 * Technique :
 * - Mock chrome.storage.local.get via vi.hoisted (évite le hoisting vi.mock)
 * - Fonctions exportées testées directement (formatTimestamp, computeM7Status, etc.)
 * - initHealth() testée avec DOM jsdom (#health-main requis)
 * - D-SEC-003 : zéro innerHTML dans le code source
 *
 * Référence : T-109, ARB-061-01, ADR-001 R-BOOT-04
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  M2Diagnostics,
  M3Diagnostics,
  M5Diagnostics,
  M6Diagnostics,
  M7Diagnostics,
  M9Diagnostics,
  M17Diagnostics,
} from '@/shared/types/diagnostics';

// ---------------------------------------------------------------------------
// vi.hoisted : variable initialisée avant le hoisting de vi.mock
// ---------------------------------------------------------------------------

const { mockStorageGet } = vi.hoisted(() => ({
  mockStorageGet: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/shared/browser/browser-adapter', () => ({
  browser: {
    i18n: {
      getMessage: vi.fn((key: string) => {
        const messages: Record<string, string> = {
          options_about_health: 'Etat de sante (avance)',
        };
        return messages[key] ?? '';
      }),
    },
    storage: {
      local: {
        get: mockStorageGet,
      },
    },
    runtime: {
      sendMessage: vi.fn().mockResolvedValue(null),
      getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
      getManifest: vi.fn(() => ({ version: '1.0.0' })),
      id: 'test-ext-id',
    },
    tabs: { create: vi.fn() },
  },
}));

vi.mock('@/shared/utils/apply-theme', () => ({
  initTheme: vi.fn().mockResolvedValue(undefined),
  watchThemeChanges: vi.fn(),
}));

vi.mock('@/shared/utils/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  Logger: {
    errorName: vi.fn((err: unknown) => (err instanceof Error ? err.name : 'UnknownError')),
  },
}));

// ---------------------------------------------------------------------------
// Imports des fonctions exportées (après les mocks)
// ---------------------------------------------------------------------------

import {
  formatTimestamp,
  ageMs,
  computeM2Status,
  computeM3Status,
  computeM5Status,
  computeM6Status,
  computeM7Status,
  computeM9Status,
  computeM17Status,
  statusLabel,
  createDetailsToggle,
  initHealth,
} from '@/pages/health/health';

// ---------------------------------------------------------------------------
// Constantes temporelles
// ---------------------------------------------------------------------------

const NOW = Date.now();
const ONE_HOUR_MS = 60 * 60 * 1000;
const THIRTY_MIN_MS = 30 * 60 * 1000;

// ---------------------------------------------------------------------------
// Helpers : diagnostics factices
// ---------------------------------------------------------------------------

function makeM2(overrides: Partial<M2Diagnostics> = {}): M2Diagnostics {
  return { ready: true, last_boot_ts: NOW - 5000, whitelist_size: 42, ...overrides };
}

function makeM3(overrides: Partial<M3Diagnostics> = {}): M3Diagnostics {
  return { ready: true, last_boot: NOW - 5000, ...overrides };
}

function makeM5(overrides: Partial<M5Diagnostics> = {}): M5Diagnostics {
  return { ready: true, last_boot_ts: NOW - 5000, snooze_count: 0, ...overrides };
}

function makeM6(overrides: Partial<M6Diagnostics> = {}): M6Diagnostics {
  return {
    ready: true,
    last_boot_ts: NOW - 5000,
    install_date: NOW - 7 * 24 * 60 * 60 * 1000,
    ...overrides,
  };
}

function makeM7(overrides: Partial<M7Diagnostics> = {}): M7Diagnostics {
  return {
    ready: true,
    last_boot_ts: NOW - 5000,
    last_detection_ts: null,
    boot_count: 5,
    canary_verified: true,
    ...overrides,
  };
}

function makeM9(overrides: Partial<M9Diagnostics> = {}): M9Diagnostics {
  return { ready: true, last_action_ts: NOW - 5000, ...overrides };
}

function makeM17(overrides: Partial<M17Diagnostics> = {}): M17Diagnostics {
  return { ready: true, last_action_ts: NOW - 5000, ...overrides };
}

/**
 * Configure mockStorageGet pour retourner un jeu complet de diagnostics.
 */
function setupStorageMock(
  overrides: {
    m2?: Partial<M2Diagnostics>;
    m3?: Partial<M3Diagnostics>;
    m5?: Partial<M5Diagnostics>;
    m6?: Partial<M6Diagnostics>;
    m7?: Partial<M7Diagnostics>;
    m9?: Partial<M9Diagnostics>;
    m17?: Partial<M17Diagnostics>;
  } = {},
): void {
  mockStorageGet.mockResolvedValue({
    'diagnostics.m2': makeM2(overrides.m2),
    'diagnostics.m3': makeM3(overrides.m3),
    'diagnostics.m5': makeM5(overrides.m5),
    'diagnostics.m6': makeM6(overrides.m6),
    'diagnostics.m7': makeM7(overrides.m7),
    'diagnostics.m9': makeM9(overrides.m9),
    'diagnostics.m17': makeM17(overrides.m17),
  });
}

/**
 * Monte un DOM minimal avec #health-main.
 */
function mountHealthRoot(): HTMLElement {
  document.body.innerHTML = '';
  const root = document.createElement('main');
  root.id = 'health-main';
  document.body.appendChild(root);
  return root;
}

// ---------------------------------------------------------------------------
// Tests : formatTimestamp
// ---------------------------------------------------------------------------

describe('formatTimestamp', () => {
  it('retourne un tiret pour timestamp nul (0)', () => {
    expect(formatTimestamp(0)).toBe('\u2014');
  });

  it('retourne un tiret pour timestamp null', () => {
    expect(formatTimestamp(null)).toBe('\u2014');
  });

  it('retourne un tiret pour timestamp undefined', () => {
    expect(formatTimestamp(undefined)).toBe('\u2014');
  });

  it('retourne une chaîne formatée pour un timestamp valide', () => {
    const ts = new Date('2026-04-20T10:30:00').getTime();
    const result = formatTimestamp(ts);
    expect(result).toContain('2026');
    expect(result).not.toBe('\u2014');
  });
});

// ---------------------------------------------------------------------------
// Tests : ageMs
// ---------------------------------------------------------------------------

describe('ageMs', () => {
  it('retourne Infinity pour ts === 0', () => {
    expect(ageMs(0)).toBe(Infinity);
  });

  it('retourne un âge positif pour un timestamp récent', () => {
    const age = ageMs(Date.now() - 5000);
    expect(age).toBeGreaterThan(0);
    expect(age).toBeLessThan(10000);
  });
});

// ---------------------------------------------------------------------------
// Tests : statusLabel
// ---------------------------------------------------------------------------

describe('statusLabel', () => {
  it('retourne "Opérationnel" pour ok', () => {
    expect(statusLabel('ok')).toBe('Opérationnel');
  });

  it('retourne "Dégradé" pour warn', () => {
    expect(statusLabel('warn')).toBe('Dégradé');
  });

  it('retourne "Erreur" pour error', () => {
    expect(statusLabel('error')).toBe('Erreur');
  });

  it('retourne "Non initialisé" pour unknown', () => {
    expect(statusLabel('unknown')).toBe('Non initialisé');
  });
});

// ---------------------------------------------------------------------------
// Tests : computeM7Status (heartbeat stale — ARB-061-01)
// ---------------------------------------------------------------------------

describe('computeM7Status', () => {
  it('retourne ok : ready=true, boot récent (< 1h)', () => {
    expect(computeM7Status(makeM7({ last_boot_ts: NOW - 1000 }))).toBe('ok');
  });

  it('retourne unknown : last_boot_ts === 0 (jamais initialisé)', () => {
    expect(computeM7Status(makeM7({ last_boot_ts: 0, ready: false, canary_verified: false }))).toBe(
      'unknown',
    );
  });

  it('retourne warn : ready=true mais heartbeat stale > 1h (ARB-061-01)', () => {
    expect(computeM7Status(makeM7({ last_boot_ts: NOW - ONE_HOUR_MS - 1000 }))).toBe('warn');
  });

  it('retourne error : ready=false ET heartbeat stale > 1h', () => {
    expect(
      computeM7Status(
        makeM7({ ready: false, canary_verified: false, last_boot_ts: NOW - ONE_HOUR_MS - 1000 }),
      ),
    ).toBe('error');
  });

  it('retourne warn : ready=false mais boot récent', () => {
    expect(
      computeM7Status(makeM7({ ready: false, canary_verified: false, last_boot_ts: NOW - 1000 })),
    ).toBe('warn');
  });
});

// ---------------------------------------------------------------------------
// Tests : computeM2Status
// ---------------------------------------------------------------------------

describe('computeM2Status', () => {
  it('retourne ok pour M2 healthy', () => {
    expect(computeM2Status(makeM2())).toBe('ok');
  });

  it('retourne unknown si last_boot_ts === 0', () => {
    expect(computeM2Status(makeM2({ last_boot_ts: 0, ready: false }))).toBe('unknown');
  });

  it('retourne error : ready=false avec incident < 30min', () => {
    expect(
      computeM2Status(
        makeM2({
          ready: false,
          last_incident: { type: 'whitelist_corrupted', severity: 'error', ts: NOW - 1000 },
        }),
      ),
    ).toBe('error');
  });

  it('retourne warn : ready=false avec incident > 30min', () => {
    expect(
      computeM2Status(
        makeM2({
          ready: false,
          last_incident: {
            type: 'whitelist_corrupted',
            severity: 'error',
            ts: NOW - THIRTY_MIN_MS - 1000,
          },
        }),
      ),
    ).toBe('warn');
  });

  it('retourne warn : ready=true mais incident récent < 30min', () => {
    expect(
      computeM2Status(
        makeM2({
          ready: true,
          last_incident: { type: 'whitelist_regenerated', severity: 'info', ts: NOW - 1000 },
        }),
      ),
    ).toBe('warn');
  });
});

// ---------------------------------------------------------------------------
// Tests : computeM3, M5, M6, M9, M17 (smoke + unknown)
// ---------------------------------------------------------------------------

describe('computeM3Status', () => {
  it('retourne ok pour M3 healthy', () => {
    expect(computeM3Status(makeM3())).toBe('ok');
  });

  it('retourne unknown si last_boot === 0', () => {
    expect(computeM3Status(makeM3({ last_boot: 0, ready: false }))).toBe('unknown');
  });
});

describe('computeM5Status', () => {
  it('retourne ok pour M5 healthy', () => {
    expect(computeM5Status(makeM5())).toBe('ok');
  });

  it('retourne unknown si last_boot_ts === 0', () => {
    expect(computeM5Status(makeM5({ last_boot_ts: 0, ready: false }))).toBe('unknown');
  });
});

describe('computeM6Status', () => {
  it('retourne ok pour M6 healthy', () => {
    expect(computeM6Status(makeM6())).toBe('ok');
  });

  it('retourne unknown si last_boot_ts === 0', () => {
    expect(computeM6Status(makeM6({ last_boot_ts: 0, ready: false }))).toBe('unknown');
  });
});

describe('computeM9Status', () => {
  it('retourne ok pour M9 healthy', () => {
    expect(computeM9Status(makeM9())).toBe('ok');
  });

  it('retourne unknown si last_action_ts === 0', () => {
    expect(computeM9Status(makeM9({ last_action_ts: 0, ready: false }))).toBe('unknown');
  });
});

describe('computeM17Status', () => {
  it('retourne ok pour M17 healthy', () => {
    expect(computeM17Status(makeM17())).toBe('ok');
  });

  it('retourne error : ready=false avec incident récent', () => {
    expect(
      computeM17Status(
        makeM17({
          ready: false,
          last_incident: { type: 'm17_handler_error', severity: 'error', ts: NOW - 1000 },
        }),
      ),
    ).toBe('error');
  });
});

// ---------------------------------------------------------------------------
// Test 4 : Bouton expand/collapse fonctionnel
// ---------------------------------------------------------------------------

describe('createDetailsToggle — expand/collapse', () => {
  it('commence collapsed : aria-expanded=false, block hidden', () => {
    const [btn, block] = createDetailsToggle({ test: 'data' });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(block.hidden).toBe(true);
  });

  it('après clic : aria-expanded=true, block visible', () => {
    const [btn, block] = createDetailsToggle({ foo: 'bar' });
    btn.click();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(block.hidden).toBe(false);
  });

  it('second clic : re-collapse aria-expanded=false, block hidden', () => {
    const [btn, block] = createDetailsToggle({ baz: 42 });
    btn.click();
    btn.click();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(block.hidden).toBe(true);
  });

  it('le bloc pre contient le JSON sérialisé des diagnostics', () => {
    const data = { module: 'M7', ready: true };
    const [, block] = createDetailsToggle(data);
    const pre = block.querySelector('pre');
    expect(pre?.textContent).toContain('"module"');
    expect(pre?.textContent).toContain('"M7"');
  });

  it('le bouton et le bloc partagent un id aria-controls cohérent', () => {
    const [btn, block] = createDetailsToggle({});
    expect(btn.getAttribute('aria-controls')).toBe(block.id);
    expect(block.id).not.toBe('');
  });
});

// ---------------------------------------------------------------------------
// Test 1 : rendu complet — 7 modules OK
// ---------------------------------------------------------------------------

describe('initHealth — rendu complet 7 modules OK', () => {
  beforeEach(() => {
    setupStorageMock();
  });

  it('génère un h1 "État de santé" et des sections pour tous les modules', async () => {
    mountHealthRoot();
    await initHealth();

    const root = document.getElementById('health-main')!;

    const h1 = root.querySelector('h1');
    expect(h1).not.toBeNull();
    expect(h1?.textContent).toContain('État de santé');

    // 7 modules + heartbeat + canary = 9 sections minimum
    const sections = root.querySelectorAll('section[aria-label]');
    expect(sections.length).toBeGreaterThanOrEqual(9);

    // Aucun statut error attendu si tous les modules sont OK
    const errorSections = root.querySelectorAll('section[data-status="error"]');
    expect(errorSections.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Test 2 : module M2 avec lastError récent → section error
// ---------------------------------------------------------------------------

describe('initHealth — module M2 avec lastError récent', () => {
  beforeEach(() => {
    setupStorageMock({
      m2: {
        ready: false,
        last_boot_ts: NOW - 1000,
        whitelist_size: 0,
        last_incident: { type: 'whitelist_corrupted', severity: 'error', ts: NOW - 1000 },
      },
    });
  });

  it('la section M2 a data-status="error" quand ready=false et incident récent', async () => {
    mountHealthRoot();
    await initHealth();

    const root = document.getElementById('health-main')!;
    const sections = Array.from(root.querySelectorAll('section[aria-label]'));
    const m2Section = sections.find((s) => s.getAttribute('aria-label')?.includes('M2'));

    expect(m2Section).not.toBeUndefined();
    expect(m2Section?.getAttribute('data-status')).toBe('error');
  });
});

// ---------------------------------------------------------------------------
// Test 3 : Heartbeat M7 stale > 1h → alerte dégradé
// ---------------------------------------------------------------------------

describe('initHealth — heartbeat M7 stale > 1h (ARB-061-01)', () => {
  beforeEach(() => {
    setupStorageMock({
      m7: {
        ready: true,
        last_boot_ts: NOW - ONE_HOUR_MS - 5000, // plus d'une heure
        boot_count: 10,
        canary_verified: true,
        last_detection_ts: null,
      },
    });
  });

  it('la section M7 a data-status="warn" et affiche une alerte heartbeat', async () => {
    mountHealthRoot();
    await initHealth();

    const root = document.getElementById('health-main')!;
    const sections = Array.from(root.querySelectorAll('section[aria-label]'));

    const m7Section = sections.find((s) => s.getAttribute('aria-label')?.includes('M7'));
    expect(m7Section?.getAttribute('data-status')).toBe('warn');

    // Une alerte heartbeat doit être présente (role=alert contenant 'heartbeat' ou 'dégradé')
    const alerts = root.querySelectorAll('[role="alert"]');
    const hasHeartbeatAlert = Array.from(alerts).some(
      (a) => a.textContent?.toLowerCase().includes('heartbeat') || a.textContent?.includes('boot'),
    );
    expect(hasHeartbeatAlert).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 7 : Storage vide → modules unknown
// ---------------------------------------------------------------------------

describe('initHealth — storage vide → statuts unknown', () => {
  beforeEach(() => {
    mockStorageGet.mockResolvedValue({});
  });

  it('affiche des sections en statut unknown quand aucun diagnostics stocké', async () => {
    mountHealthRoot();
    await initHealth();

    const root = document.getElementById('health-main')!;
    const unknownSections = root.querySelectorAll('section[data-status="unknown"]');
    // Modules M2/M5/M6/M7 ont last_boot_ts=0 par défaut → unknown
    expect(unknownSections.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Test 8 : Erreur storage → message d'erreur accessible
// ---------------------------------------------------------------------------

describe('initHealth — erreur storage', () => {
  beforeEach(() => {
    mockStorageGet.mockRejectedValue(new Error('Storage unavailable'));
  });

  it('affiche un message d erreur accessible (role=alert) en cas d erreur storage', async () => {
    mountHealthRoot();
    await initHealth();

    const root = document.getElementById('health-main')!;
    const errorEl = root.querySelector('[role="alert"]');

    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent).toContain('Impossible de charger');
  });
});
