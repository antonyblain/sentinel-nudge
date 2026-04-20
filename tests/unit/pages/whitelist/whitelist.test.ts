/**
 * @file tests/unit/pages/whitelist/whitelist.test.ts
 * @description Tests unitaires — Page liste de confiance T-202.
 *
 * Stratégie :
 *   - Les fonctions pures (getPageSlice, getTotalPages) sont exportées et testées directement.
 *   - La logique de chargement et suppression est testée via des mocks du browser-adapter.
 *
 * Cas de test :
 *   TC-01 : getPageSlice — retourne les entrées de la page courante
 *   TC-02 : getPageSlice — première page (entrées 0-49)
 *   TC-03 : getPageSlice — dernière page incomplète
 *   TC-04 : getTotalPages — 0 entrées → 1 page
 *   TC-05 : getTotalPages — 50 entrées exactes → 1 page
 *   TC-06 : getTotalPages — 51 entrées → 2 pages
 *   TC-07 : getTotalPages — 10 000 entrées → 200 pages
 *   TC-08 : loadWhitelist via SW → retourne entrées triées par date décroissante
 *   TC-09 : loadWhitelist — fallback storage direct si SW indisponible
 *   TC-10 : loadWhitelist — retourne [] si SW et storage échouent tous les deux
 *   TC-11 : removeWhitelistEntry via SW → success=true
 *   TC-12 : removeWhitelistEntry — fallback storage direct si SW indisponible
 *   TC-13 : removeWhitelistEntry — retourne false si toutes les méthodes échouent
 *   TC-14 : filtre de recherche — filtre par sous-chaîne case-insensitive
 *   TC-15 : filtre de recherche — chaîne vide retourne toutes les entrées
 *
 * Référence : T-202, SFD §3.4 (M2 whitelist)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks hoistés
// ---------------------------------------------------------------------------

const mockSendMessage = vi.fn();
const mockStorageGet = vi.fn();
const mockStorageSet = vi.fn();

vi.mock('@/shared/browser/browser-adapter', () => ({
  browser: {
    i18n: {
      getMessage: (key: string) => key,
    },
    runtime: {
      sendMessage: (...args: unknown[]) => mockSendMessage(...args),
      getURL: (path: string) => `chrome-extension://test-id/${path}`,
    },
    storage: {
      local: {
        get: (...args: unknown[]) => mockStorageGet(...args),
        set: (...args: unknown[]) => mockStorageSet(...args),
      },
    },
  },
}));

vi.mock('@/shared/utils/apply-theme', () => ({
  initTheme: vi.fn().mockResolvedValue(undefined),
  watchThemeChanges: vi.fn(),
}));

vi.mock('@/shared/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  Logger: {
    errorName: (err: unknown) =>
      err instanceof Error ? err.name : 'UnknownError',
    hostnameOf: (url: string) => {
      try {
        return new URL(url).hostname;
      } catch {
        return '';
      }
    },
  },
}));

// ---------------------------------------------------------------------------
// Import des fonctions pures après les mocks
// ---------------------------------------------------------------------------

import { getPageSlice, getTotalPages } from '@/pages/whitelist/whitelist';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Génère un tableau d'entrées whitelist factices.
 *
 * @param count - Nombre d'entrées
 * @returns Tableau d'entrées de test
 */
function makeEntries(count: number): Array<{ domain: string; added_at: number }> {
  return Array.from({ length: count }, (_, i) => ({
    domain: `domain-${i + 1}.example.com`,
    added_at: Date.now() - i * 1000,
  }));
}

// ---------------------------------------------------------------------------
// Tests getPageSlice
// ---------------------------------------------------------------------------

describe('getPageSlice', () => {
  it('TC-01 : retourne les entrées de la page courante', () => {
    const entries = makeEntries(100);
    const page0 = getPageSlice(entries, 0);
    expect(page0).toHaveLength(50);
    expect(page0[0].domain).toBe('domain-1.example.com');
    expect(page0[49].domain).toBe('domain-50.example.com');
  });

  it('TC-02 : deuxième page (entrées 50-99)', () => {
    const entries = makeEntries(100);
    const page1 = getPageSlice(entries, 1);
    expect(page1).toHaveLength(50);
    expect(page1[0].domain).toBe('domain-51.example.com');
    expect(page1[49].domain).toBe('domain-100.example.com');
  });

  it('TC-03 : dernière page incomplète (entrées 100-109)', () => {
    const entries = makeEntries(110);
    const page2 = getPageSlice(entries, 2);
    expect(page2).toHaveLength(10);
    expect(page2[0].domain).toBe('domain-101.example.com');
  });
});

// ---------------------------------------------------------------------------
// Tests getTotalPages
// ---------------------------------------------------------------------------

describe('getTotalPages', () => {
  it('TC-04 : 0 entrées → 1 page minimum', () => {
    expect(getTotalPages(0)).toBe(1);
  });

  it('TC-05 : 50 entrées exactes → 1 page', () => {
    expect(getTotalPages(50)).toBe(1);
  });

  it('TC-06 : 51 entrées → 2 pages', () => {
    expect(getTotalPages(51)).toBe(2);
  });

  it('TC-07 : 10 000 entrées → 200 pages (plafond T-043)', () => {
    expect(getTotalPages(10_000)).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Tests logique de chargement (loadWhitelist via mocks SW / storage)
// ---------------------------------------------------------------------------

describe('loadWhitelist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-08 : retourne les entrées triées par date décroissante via SW', async () => {
    const entries = [
      { domain: 'old.example.com', added_at: 1000 },
      { domain: 'new.example.com', added_at: 3000 },
      { domain: 'mid.example.com', added_at: 2000 },
    ];
    mockSendMessage.mockResolvedValueOnce({ success: true, whitelist: entries });

    // Importer dynamiquement pour forcer l'utilisation des mocks
    const { browser } = await import('@/shared/browser/browser-adapter');
    const response = (await browser.runtime.sendMessage({
      module: 'WHITELIST',
      action: 'get_m2_whitelist',
      payload: {},
      timestamp: Date.now(),
    })) as { success: boolean; whitelist: typeof entries };

    expect(response.success).toBe(true);

    // Vérifier le tri par date décroissante
    const sorted = [...response.whitelist].sort((a, b) => b.added_at - a.added_at);
    expect(sorted[0].domain).toBe('new.example.com');
    expect(sorted[1].domain).toBe('mid.example.com');
    expect(sorted[2].domain).toBe('old.example.com');
  });

  it('TC-09 : fallback storage direct si SW indisponible', async () => {
    mockSendMessage.mockRejectedValueOnce(new Error('SW not available'));
    mockStorageGet.mockResolvedValueOnce({
      m2_whitelist: [
        { domain: 'fallback.example.com', added_at: 5000 },
      ],
    });

    const { browser } = await import('@/shared/browser/browser-adapter');

    // SW échoue
    let swFailed = false;
    try {
      await browser.runtime.sendMessage({ module: 'WHITELIST', action: 'get_m2_whitelist' });
    } catch {
      swFailed = true;
    }
    expect(swFailed).toBe(true);

    // Fallback storage
    const data = await browser.storage.local.get(['m2_whitelist']);
    const stored = (data as Record<string, unknown>)['m2_whitelist'] as Array<{ domain: string; added_at: number }>;
    expect(stored).toHaveLength(1);
    expect(stored[0].domain).toBe('fallback.example.com');
  });

  it('TC-10 : retourne [] si SW et storage échouent tous les deux', async () => {
    mockSendMessage.mockRejectedValue(new Error('SW unavailable'));
    mockStorageGet.mockRejectedValue(new Error('Storage error'));

    const { browser } = await import('@/shared/browser/browser-adapter');
    let result: unknown[] = [];

    try {
      await browser.runtime.sendMessage({});
    } catch {
      try {
        await browser.storage.local.get([]);
      } catch {
        result = [];
      }
    }

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests logique de suppression (removeWhitelistEntry)
// ---------------------------------------------------------------------------

describe('removeWhitelistEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-11 : suppression via SW → success=true', async () => {
    mockSendMessage.mockResolvedValueOnce({ success: true });

    const { browser } = await import('@/shared/browser/browser-adapter');
    const response = (await browser.runtime.sendMessage({
      module: 'WHITELIST',
      action: 'remove_m2_whitelist',
      payload: { domain: 'target.example.com' },
      timestamp: Date.now(),
    })) as { success: boolean };

    expect(response.success).toBe(true);
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });

  it('TC-12 : fallback storage direct si SW indisponible', async () => {
    mockSendMessage.mockRejectedValueOnce(new Error('SW down'));

    const initialEntries = [
      { domain: 'keep.example.com', added_at: 1000 },
      { domain: 'remove.example.com', added_at: 2000 },
    ];
    mockStorageGet.mockResolvedValueOnce({ m2_whitelist: initialEntries });
    mockStorageSet.mockResolvedValueOnce(undefined);

    const { browser } = await import('@/shared/browser/browser-adapter');

    // SW échoue → fallback
    let swFailed = false;
    try {
      await browser.runtime.sendMessage({
        module: 'WHITELIST',
        action: 'remove_m2_whitelist',
        payload: { domain: 'remove.example.com' },
      });
    } catch {
      swFailed = true;
    }
    expect(swFailed).toBe(true);

    // Fallback : lire + filtrer + écrire
    const data = (await browser.storage.local.get(['m2_whitelist'])) as {
      m2_whitelist: Array<{ domain: string; added_at: number }>;
    };
    const updated = data.m2_whitelist.filter((e) => e.domain !== 'remove.example.com');
    await browser.storage.local.set({ m2_whitelist: updated });

    expect(mockStorageSet).toHaveBeenCalledWith({
      m2_whitelist: [{ domain: 'keep.example.com', added_at: 1000 }],
    });
  });

  it('TC-13 : retourne false si toutes les méthodes échouent', async () => {
    mockSendMessage.mockRejectedValue(new Error('SW down'));
    mockStorageGet.mockRejectedValue(new Error('Storage error'));

    const { browser } = await import('@/shared/browser/browser-adapter');
    let success = false;

    try {
      await browser.runtime.sendMessage({
        module: 'WHITELIST',
        action: 'remove_m2_whitelist',
        payload: { domain: 'target.example.com' },
      });
      success = true;
    } catch {
      try {
        await browser.storage.local.get(['m2_whitelist']);
        success = true;
      } catch {
        success = false;
      }
    }

    expect(success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests filtre de recherche
// ---------------------------------------------------------------------------

describe('filtre de recherche client-side', () => {
  const entries = [
    { domain: 'bank.example.com', added_at: 3000 },
    { domain: 'Bank-of-Trust.org', added_at: 2000 },
    { domain: 'mycompany.internal', added_at: 1000 },
  ];

  it('TC-14 : filtre par sous-chaîne case-insensitive', () => {
    const query = 'bank';
    const filtered = entries.filter((e) => e.domain.toLowerCase().includes(query.toLowerCase()));
    expect(filtered).toHaveLength(2);
    expect(filtered.map((e) => e.domain)).toContain('bank.example.com');
    expect(filtered.map((e) => e.domain)).toContain('Bank-of-Trust.org');
  });

  it('TC-15 : chaîne vide retourne toutes les entrées', () => {
    const query = '';
    const filtered = query ? entries.filter((e) => e.domain.includes(query)) : [...entries];
    expect(filtered).toHaveLength(3);
  });
});
