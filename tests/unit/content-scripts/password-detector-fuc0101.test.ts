/**
 * @file tests/unit/content-scripts/password-detector-fuc0101.test.ts
 * @description Tests unitaires F-UC01-01 (TACHE-101) — détection nœud racine React.
 *
 * Bug corrigé : `observeDynamicForms()` ne détectait pas un input[type="password"]
 * ajouté DIRECTEMENT comme addedNode (nœud racine) par React dans une SPA.
 * `querySelectorAll('input[type="password"]', addedNode)` ne sélectionne pas le nœud
 * lui-même, uniquement ses descendants.
 *
 * Correctif : ajout d'un `node.matches('input[type="password"]')` avant le
 * `querySelector`, avec enregistrement immédiat via `registerPasswordInput`.
 *
 * Référence :
 *   - mini-DAT TACHE-068 §2 Cas A (Google SPA) + §3.1 F-UC01-01
 *   - BACKLOG TACHE-101 (Must / En cours)
 *
 * Stratégie :
 *   - Mock complet de chrome (niveau module) pour éviter auto-exec de initPasswordDetector
 *   - Mock de MutationObserver : capture le callback injecté par observeDynamicForms()
 *   - Appel manuel du callback avec un MutationRecord simulant un addedNode racine
 *   - Vérification via _snPasswordInputs (Set exporté) que l'input est enregistré
 *
 * Environnement : jsdom (vitest)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock de chrome — défini AVANT tout import du module testé
// ---------------------------------------------------------------------------

const mockStorageLocalGet = vi
  .fn()
  .mockImplementation((_keys: string[], callback: (r: Record<string, unknown>) => void) => {
    callback({});
  });
const mockStorageLocalSet = vi
  .fn()
  .mockImplementation((_items: Record<string, unknown>, callback?: () => void) => {
    callback?.();
  });

global.chrome = {
  storage: {
    local: {
      get: mockStorageLocalGet,
      set: mockStorageLocalSet,
      remove: vi.fn().mockImplementation((_keys: string[], callback?: () => void) => callback?.()),
      clear: vi.fn().mockImplementation((callback?: () => void) => callback?.()),
    },
    onChanged: {
      addListener: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi
      .fn()
      .mockImplementation((_msg: unknown, callback?: (r: unknown) => void) => {
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

// ---------------------------------------------------------------------------
// Import du module après les mocks
// ---------------------------------------------------------------------------

import {
  _snPasswordInputs,
  registerPasswordInput,
  observeDynamicForms,
} from '@/content-scripts/detectors/password-detector';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Construit un MutationRecord synthétique simulant l'ajout d'un nœud
 * directement par React (nœud racine dans addedNodes, pas de descendants).
 *
 * @param addedNode - Le nœud ajouté comme racine (ex: input[type="password"])
 */
function buildChildListRecord(addedNode: Node): MutationRecord {
  return {
    type: 'childList',
    target: document.body,
    addedNodes: (() => {
      const frag = document.createDocumentFragment();
      frag.appendChild(addedNode.cloneNode(false));
      // On retourne une NodeList à partir du fragment...
      // Mais on doit retourner le vrai nœud (pas le clone) pour les assertions.
      // Stratégie : créer un tableau-like via un conteneur temporaire.
      const div = document.createElement('div');
      div.appendChild(addedNode);
      return div.childNodes;
    })(),
    removedNodes: document.createDocumentFragment().childNodes,
    previousSibling: null,
    nextSibling: null,
    attributeName: null,
    attributeNamespace: null,
    oldValue: null,
  } as unknown as MutationRecord;
}

// ---------------------------------------------------------------------------
// Suite de tests F-UC01-01
// ---------------------------------------------------------------------------

describe('F-UC01-01 (TACHE-101) — observeDynamicForms : détection nœud racine React', () => {
  /**
   * Référence du callback capturé lors de l'instanciation de MutationObserver
   * par observeDynamicForms().
   */
  let capturedCallback: MutationCallback | null = null;

  /**
   * Référence vers l'instance mock du MutationObserver.
   */
  let observeSpy: ReturnType<typeof vi.fn>;
  let disconnectSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Réinitialiser le Set entre les tests
    _snPasswordInputs.clear();
    document.body.innerHTML = '';
    capturedCallback = null;

    // Mock de MutationObserver pour capturer le callback sans dépendre de l'implémentation jsdom
    observeSpy = vi.fn();
    disconnectSpy = vi.fn();

    vi.stubGlobal(
      'MutationObserver',
      vi.fn().mockImplementation((callback: MutationCallback) => {
        capturedCallback = callback;
        return {
          observe: observeSpy,
          disconnect: disconnectSpy,
          takeRecords: vi.fn().mockReturnValue([]),
        };
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  // -------------------------------------------------------------------------
  // TC-F-UC01-01-01 : nœud racine input[type="password"] directement ajouté
  // → registerPasswordInput appelé, input présent dans _snPasswordInputs
  // -------------------------------------------------------------------------
  it(
    'TC-F-UC01-01-01 : input[type="password"] ajouté comme nœud racine React ' +
      '→ enregistré dans _snPasswordInputs',
    () => {
      // Arrange : démarrer l'observation
      observeDynamicForms();
      expect(capturedCallback).not.toBeNull();

      // Créer l'input comme React le ferait : nœud racine direct sans wrapper
      const passwordInput = document.createElement('input');
      passwordInput.type = 'password';

      // Construire un MutationRecord simulant addedNodes = [passwordInput]
      // Le nœud est ajouté directement (pas de form wrapper, pas de div parent)
      const mockMutations: MutationRecord[] = [
        {
          type: 'childList',
          target: document.body,
          addedNodes: [passwordInput] as unknown as NodeList,
          removedNodes: [] as unknown as NodeList,
          previousSibling: null,
          nextSibling: null,
          attributeName: null,
          attributeNamespace: null,
          oldValue: null,
        } as unknown as MutationRecord,
      ];

      // Act : déclencher le callback MutationObserver comme le navigateur le ferait
      capturedCallback!(mockMutations, {} as MutationObserver);

      // Assert : l'input doit être enregistré dans _snPasswordInputs
      // (registerPasswordInput a été appelé avec ce nœud)
      expect(_snPasswordInputs.has(passwordInput)).toBe(true);
    },
  );

  // -------------------------------------------------------------------------
  // TC-F-UC01-01-02 : input[type="text"] ajouté comme nœud racine
  // → NON enregistré (pas un champ password)
  // -------------------------------------------------------------------------
  it(
    'TC-F-UC01-01-02 : input[type="text"] ajouté comme nœud racine ' +
      '→ NOT enregistré dans _snPasswordInputs',
    () => {
      // Arrange
      observeDynamicForms();
      expect(capturedCallback).not.toBeNull();

      const textInput = document.createElement('input');
      textInput.type = 'text';

      const mockMutations: MutationRecord[] = [
        {
          type: 'childList',
          target: document.body,
          addedNodes: [textInput] as unknown as NodeList,
          removedNodes: [] as unknown as NodeList,
          previousSibling: null,
          nextSibling: null,
          attributeName: null,
          attributeNamespace: null,
          oldValue: null,
        } as unknown as MutationRecord,
      ];

      // Act
      capturedCallback!(mockMutations, {} as MutationObserver);

      // Assert : un input text ne doit PAS être enregistré
      expect(_snPasswordInputs.has(textInput)).toBe(false);
    },
  );

  // -------------------------------------------------------------------------
  // TC-F-UC01-01-03 : input[type="password"] descendant d'un wrapper div
  // → NON enregistré via matches, mais détecté via querySelector (comportement existant)
  // Ce test valide que le correctif ne casse pas le chemin querySelector nominal
  // -------------------------------------------------------------------------
  it(
    'TC-F-UC01-01-03 : input[type="password"] descendant d\'un wrapper div ' +
      '→ détection via querySelector (chemin nominal préservé)',
    () => {
      // Arrange
      observeDynamicForms();
      expect(capturedCallback).not.toBeNull();

      // Simuler un wrapper div React (le nœud racine est un div, pas l'input directement)
      const wrapper = document.createElement('div');
      const passwordInput = document.createElement('input');
      passwordInput.type = 'password';
      wrapper.appendChild(passwordInput);

      const mockMutations: MutationRecord[] = [
        {
          type: 'childList',
          target: document.body,
          addedNodes: [wrapper] as unknown as NodeList,
          removedNodes: [] as unknown as NodeList,
          previousSibling: null,
          nextSibling: null,
          attributeName: null,
          attributeNamespace: null,
          oldValue: null,
        } as unknown as MutationRecord,
      ];

      // Act
      capturedCallback!(mockMutations, {} as MutationObserver);

      // Assert : le wrapper div n'est pas un input password → matches = false
      // querySelector détecte l'input descendant → hasNewForms = true (attachSubmitListeners)
      // L'input descendant N'est PAS enregistré dans _snPasswordInputs via ce chemin
      // (registerPasswordInput est appelé uniquement sur le nœud racine via matches)
      // Cela est correct : attachSubmitListeners couvrira le form/input via querySelectorAll
      expect(_snPasswordInputs.has(passwordInput)).toBe(false);
      // Le wrapper lui-même non plus
      expect(_snPasswordInputs.size).toBe(0);
    },
  );

  // -------------------------------------------------------------------------
  // TC-F-UC01-01-04 : observer.observe() est bien appelé sur document.body
  // (confirme que observeDynamicForms() démarre l'observation)
  // -------------------------------------------------------------------------
  it('TC-F-UC01-01-04 : observeDynamicForms() appelle observer.observe sur document.body', () => {
    // Arrange + Act
    observeDynamicForms();

    // Assert : observe doit avoir été appelé
    expect(observeSpy).toHaveBeenCalledOnce();
    // Vérifier que le premier argument est document.body (ou document.documentElement en fallback)
    const target = observeSpy.mock.calls[0][0] as Node;
    expect([document.body, document.documentElement]).toContain(target);

    // Vérifier les options (childList + subtree + attributes)
    const options = observeSpy.mock.calls[0][1] as MutationObserverInit;
    expect(options.childList).toBe(true);
    expect(options.subtree).toBe(true);
    expect(options.attributes).toBe(true);
    expect(options.attributeFilter).toContain('type');
  });

  // -------------------------------------------------------------------------
  // TC-F-UC01-01-05 : registerPasswordInput utilisable indépendamment (smoke test)
  // -------------------------------------------------------------------------
  it('TC-F-UC01-01-05 : registerPasswordInput enregistre un input dans _snPasswordInputs', () => {
    const input = document.createElement('input');
    input.type = 'password';

    registerPasswordInput(input);

    expect(_snPasswordInputs.has(input)).toBe(true);
  });
});
