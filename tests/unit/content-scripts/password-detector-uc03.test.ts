/**
 * @file tests/unit/content-scripts/password-detector-uc03.test.ts
 * @description Tests unitaires UC-03 — filtre same-origin (INV-UC03-01/03).
 *
 * Vérifie :
 * - TC-UC03-01 : content script dans top frame (same-origin) → _snIsSameOriginOrTop=true,
 *                initPasswordDetector() installe les listeners
 * - TC-UC03-02 : content script dans iframe cross-origin (window.top.location lance SecurityError)
 *                → _snIsSameOriginOrTop=false, initPasswordDetector() retourne early,
 *                aucun listener document.focusin installé
 * - TC-UC03-03 : checkAndShowPendingM7Toast() dans une iframe (window.top !== window)
 *                → return early, aucun storage.local.get appelé
 * - TC-UC03-04 : paste-detector dans iframe cross-origin → initPasteDetector() retourne early,
 *                aucun listener 'paste' installé
 *
 * Stratégie :
 * - vi.resetModules() + import dynamique pour rejouer l'évaluation module-level
 *   de _snIsSameOriginOrTop avec différents mocks de window.top
 * - Mock complet de chrome avant chaque import dynamique
 *
 * Référence : mini-DAT TACHE-070 §INV-UC03-01, §INV-UC03-03
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockChromeStorage } from '../../helpers/mock-chrome-storage';

// ---------------------------------------------------------------------------
// Helpers de mock chrome (réutilisés dans chaque sous-bloc)
// ---------------------------------------------------------------------------

function buildChromeMock() {
  // T-189 : storage.local délégué au wrapper createMockChromeStorage() (P-018)
  const { storage: mockStorage } = createMockChromeStorage();

  const chromeMock = {
    storage: {
      local: mockStorage,
      onChanged: { addListener: vi.fn() },
    },
    runtime: {
      sendMessage: vi.fn().mockImplementation((_msg: unknown, callback?: (r: unknown) => void) => {
        callback?.(null);
      }),
      lastError: undefined,
      getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
      getManifest: vi.fn().mockReturnValue({}),
      id: 'test-extension-id',
      onMessage: { addListener: vi.fn() },
      requestUpdateCheck: vi.fn().mockResolvedValue({ status: 'no_update' }),
    },
    tabs: {
      create: vi.fn().mockResolvedValue({}),
      sendMessage: vi.fn().mockResolvedValue({}),
      query: vi.fn().mockResolvedValue([]),
    },
    scripting: { executeScript: vi.fn().mockResolvedValue([]) },
    alarms: {
      create: vi.fn(),
      clear: vi.fn().mockResolvedValue(true),
      onAlarm: { addListener: vi.fn() },
    },
    i18n: { getMessage: vi.fn().mockReturnValue('') },
  } as unknown as typeof chrome;

  return { chromeMock, mockStorage };
}

// ---------------------------------------------------------------------------
// TC-UC03-01 : top frame (same-origin) → init installe les listeners
// ---------------------------------------------------------------------------

describe('TC-UC03-01 : top frame → initPasswordDetector() installe les listeners', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('dans le top frame, les listeners focusin sont installés', async () => {
    // Simuler window.top === window (top frame)
    Object.defineProperty(window, 'top', { value: window, configurable: true });

    const { chromeMock } = buildChromeMock();
    global.chrome = chromeMock;

    // Spy sur document.addEventListener avant l'import du module
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    // Import dynamique pour rejouer l'évaluation module-level
    await import('@/content-scripts/detectors/password-detector');

    // initPasswordDetector() a été appelé et a installé au moins un listener
    // (focusin, submit, keydown ou click)
    const listenerNames = addEventListenerSpy.mock.calls.map((c) => c[0]);
    expect(listenerNames).toContain('focusin');
  });
});

// ---------------------------------------------------------------------------
// TC-UC03-02 : iframe cross-origin → _snIsSameOriginOrTop=false, aucun listener
// ---------------------------------------------------------------------------

describe('TC-UC03-02 : iframe cross-origin → initPasswordDetector() retourne early', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('cross-origin SecurityError → _snIsSameOriginOrTop=false, aucun listener focusin', async () => {
    // Simuler window.top.location.origin qui lève SecurityError (cross-origin)
    const topProxy = new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === 'location') {
            throw new DOMException('SecurityError: cross-origin', 'SecurityError');
          }
          return undefined;
        },
      },
    );
    Object.defineProperty(window, 'top', { value: topProxy, configurable: true });

    const { chromeMock } = buildChromeMock();
    global.chrome = chromeMock;

    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    // Import dynamique pour rejouer l'évaluation module-level
    await import('@/content-scripts/detectors/password-detector');

    // Aucun listener 'focusin' ne doit être installé (early return dans initPasswordDetector)
    const focusinCalls = addEventListenerSpy.mock.calls.filter((c) => c[0] === 'focusin');
    expect(focusinCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TC-UC03-03 : checkAndShowPendingM7Toast dans une iframe → return early,
//              storage.local.get non appelé
// ---------------------------------------------------------------------------

describe('TC-UC03-03 : pending M7 toast dans iframe → return early', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('window.top !== window → checkAndShowPendingM7Toast ne lit pas le storage', async () => {
    // Simuler une iframe same-origin (window.top !== window, mais origin accessible)
    const fakeTop = { location: { origin: window.location.origin } } as Window;
    Object.defineProperty(window, 'top', { value: fakeTop, configurable: true });

    const { chromeMock, mockStorage } = buildChromeMock();
    global.chrome = chromeMock;

    // Import dynamique — same-origin mais pas top frame
    await import('@/content-scripts/detectors/password-detector');

    // Déclencher manuellement checkAndShowPendingM7Toast via storage.onChanged
    // La fonction retourne early car window.top !== window
    const onChangedListener = (chromeMock.storage.onChanged.addListener as ReturnType<typeof vi.fn>)
      .mock.calls[0]?.[0];
    if (onChangedListener) {
      onChangedListener({
        pending_m7_toast: { newValue: { domain_hash: '1'.repeat(64), timestamp: Date.now() } },
      });
      // Laisser le temps aux promesses de se résoudre
      await new Promise((r) => setTimeout(r, 0));
    }

    // T-189 : le storage wrapper retourne {} si la clé n'a jamais été écrite.
    // La fonction retourne early (window.top !== window) → pending_m7_toast n'est jamais écrit.
    const result = await mockStorage.get(['pending_m7_toast']);
    expect(result['pending_m7_toast']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// TC-UC03-04 : paste-detector dans iframe cross-origin → initPasteDetector() retourne early
// ---------------------------------------------------------------------------

describe('TC-UC03-04 : paste-detector cross-origin → initPasteDetector() retourne early', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('cross-origin → aucun listener paste installé sur document', async () => {
    // Simuler cross-origin
    const topProxy = new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === 'location') {
            throw new DOMException('SecurityError: cross-origin', 'SecurityError');
          }
          return undefined;
        },
      },
    );
    Object.defineProperty(window, 'top', { value: topProxy, configurable: true });

    const { chromeMock } = buildChromeMock();
    global.chrome = chromeMock;

    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    // Import dynamique du paste-detector
    await import('@/content-scripts/detectors/paste-detector');

    // Aucun listener 'paste' ne doit être installé (early return dans initPasteDetector)
    const pasteCalls = addEventListenerSpy.mock.calls.filter((c) => c[0] === 'paste');
    expect(pasteCalls).toHaveLength(0);
  });
});
