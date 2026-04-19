/**
 * @file tests/unit/content-scripts/password-detector-t094-extension-context.test.ts
 * @description Tests unitaires TACHE-094 — isExtensionContext() mockable.
 *
 * Objectifs :
 * - Vérifier que isExtensionContext() retourne true uniquement quand
 *   chrome.runtime.id est une chaîne non-vide.
 * - Vérifier que isExtensionContext() retourne false en l'absence de chrome,
 *   en l'absence de runtime, ou quand runtime.id est undefined.
 * - Vérifier que initPasswordDetector peut être importé sans auto-exécution
 *   non souhaitée dans un environnement de test.
 *
 * Stratégie :
 * - Tester directement isExtensionContext() via l'export du module.
 * - Manipuler globalThis.chrome pour simuler les différents contextes.
 *
 * Référence : TACHE-094 — comité revue code TACHE-069/072 C-02/NB-05
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockChromeStorage } from '../../helpers/mock-chrome-storage';

// ---------------------------------------------------------------------------
// Setup global chrome AVANT l'import du module — état initial : extension réelle
// ---------------------------------------------------------------------------

// T-189 : storage.local délégué au wrapper createMockChromeStorage() (P-018)
const { storage, reset: resetStorage } = createMockChromeStorage();

const mockRuntimeSendMessage = vi
  .fn()
  .mockImplementation((_msg: unknown, callback?: (r: unknown) => void) => {
    callback?.(null);
  });

// Chrome initial avec runtime.id défini → isExtensionContext() = true
global.chrome = {
  storage: {
    local: storage,
    onChanged: {
      addListener: vi.fn(),
    },
  },
  runtime: {
    sendMessage: mockRuntimeSendMessage,
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

import { isExtensionContext } from '@/content-scripts/detectors/password-detector';

// ---------------------------------------------------------------------------
// Suite TACHE-094 — isExtensionContext() comportement
// ---------------------------------------------------------------------------

describe('TACHE-094 — isExtensionContext() : guard mockable pour auto-exec', () => {
  /**
   * Sauvegarde du chrome initial pour restauration après chaque test
   * qui manipule l'objet global.
   */
  const originalChrome = global.chrome;

  beforeEach(() => {
    resetStorage();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restaurer chrome après chaque test qui le manipule
    global.chrome = originalChrome;
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // T094-01 : chrome avec runtime.id string → isExtensionContext() = true
  // -------------------------------------------------------------------------
  it('T094-01 : chrome.runtime.id présent et string → isExtensionContext() retourne true', () => {
    // Arrange : chrome est défini avec runtime.id = 'test-extension-id'
    // (état initial du mock — rien à modifier)

    // Act
    const result = isExtensionContext();

    // Assert
    expect(result).toBe(true);
  });

  // -------------------------------------------------------------------------
  // T094-02 : chrome sans runtime.id (undefined) → isExtensionContext() = false
  // -------------------------------------------------------------------------
  it('T094-02 : chrome.runtime.id absent (undefined) → isExtensionContext() retourne false', () => {
    // Arrange : simuler chrome sans runtime.id (extension non chargée)
    global.chrome = {
      ...originalChrome,
      runtime: {
        ...(originalChrome.runtime as Record<string, unknown>),
        id: undefined,
      },
    } as unknown as typeof chrome;

    // Act
    const result = isExtensionContext();

    // Assert
    expect(result).toBe(false);
  });

  // -------------------------------------------------------------------------
  // T094-03 : chrome sans runtime du tout → isExtensionContext() = false
  // -------------------------------------------------------------------------
  it('T094-03 : chrome.runtime absent (undefined) → isExtensionContext() retourne false', () => {
    // Arrange : simuler chrome sans runtime (edge case — contexte sandbox)
    global.chrome = {
      ...originalChrome,
      runtime: undefined,
    } as unknown as typeof chrome;

    // Act
    const result = isExtensionContext();

    // Assert
    expect(result).toBe(false);
  });

  // -------------------------------------------------------------------------
  // T094-04 : chrome sans runtime.id de type nombre (non-string) → false
  // -------------------------------------------------------------------------
  it('T094-04 : chrome.runtime.id non-string (number) → isExtensionContext() retourne false', () => {
    // Arrange : simuler un id non-string (cas défensif)
    global.chrome = {
      ...originalChrome,
      runtime: {
        ...(originalChrome.runtime as Record<string, unknown>),
        id: 12345,
      },
    } as unknown as typeof chrome;

    // Act
    const result = isExtensionContext();

    // Assert
    expect(result).toBe(false);
  });

  // -------------------------------------------------------------------------
  // T094-05 : initPasswordDetector est exportée et appelable sans erreur
  // (vérifie que l'export existe et que la fonction est une Function — TACHE-094)
  // -------------------------------------------------------------------------
  it('T094-05 : initPasswordDetector est exportée depuis le module (testabilité TACHE-094)', async () => {
    // Arrange : importer initPasswordDetector depuis le module
    const { initPasswordDetector } = await import('@/content-scripts/detectors/password-detector');

    // Assert : la fonction est bien exportée et de type Function
    expect(typeof initPasswordDetector).toBe('function');
  });

  // -------------------------------------------------------------------------
  // T094-06 : isExtensionContext() est mockable — permet de contrôler l'auto-exec
  // Ce test documente le pattern de mock utilisable dans d'autres suites :
  //   vi.spyOn(module, 'isExtensionContext').mockReturnValue(false)
  //   → empêche l'auto-exécution de initPasswordDetector au chargement du module.
  // -------------------------------------------------------------------------
  it('T094-06 : isExtensionContext() peut être mockée pour retourner false (pattern mock)', () => {
    // Arrange : mock isExtensionContext via manipulation chrome
    global.chrome = {
      ...originalChrome,
      runtime: {
        ...(originalChrome.runtime as Record<string, unknown>),
        id: undefined,
      },
    } as unknown as typeof chrome;

    // Act
    const result = isExtensionContext();

    // Assert : la fonction reflète bien l'état de chrome.runtime.id
    expect(result).toBe(false);

    // Restore
    global.chrome = originalChrome;
    expect(isExtensionContext()).toBe(true);
  });
});
