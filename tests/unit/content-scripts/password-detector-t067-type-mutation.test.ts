/**
 * @file tests/unit/content-scripts/password-detector-t067-type-mutation.test.ts
 * @description Tests unitaires TACHE-067 — MutationObserver sur changements `type`
 *              des inputs password (UC-05 toggle show/hide).
 *
 * Objectifs :
 * - TC-T067-01 : input type=password → type=text reste dans _snPasswordInputs (observé)
 * - TC-T067-02 : input type=text → type=password est ajouté au Set
 * - TC-T067-03 : mutation autre attribut (pas type) → aucune action sur le Set
 * - TC-T067-04 : log structuré contient from/to/hasPasswordHistory corrects
 *   - sous-cas a : premier enregistrement → hasPasswordHistory=false
 *   - sous-cas b : input déjà connu → hasPasswordHistory=true
 *
 * Référence : T-067 (Could), mini-DAT T-072 toggle v1.1, INV-UC05-01/02, M-SEC-02
 *
 * @module tests/unit/content-scripts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockChromeStorage } from '../../helpers/mock-chrome-storage';

// ---------------------------------------------------------------------------
// Mock chrome — DOIT être défini avant l'import du module
// ---------------------------------------------------------------------------

// T-189 : storage.local délégué au wrapper createMockChromeStorage() (P-018)
const { storage, reset: resetStorage } = createMockChromeStorage();

const mockRuntimeSendMessage = vi
  .fn()
  .mockImplementation((_msg: unknown, callback?: (r: unknown) => void) => {
    callback?.({ success: true, action: 'skip', reason: 'no_reuse' });
  });

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

import {
  _snPasswordInputs,
  registerPasswordInput,
  handleTypeAttributeMutation,
} from '@/content-scripts/detectors/password-detector';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Crée un MutationRecord simulé pour changement d'attribut type sur un input.
 * Positionne input.type sur newType avant retour (simule la mutation DOM).
 *
 * @param target   - Élément input cible
 * @param newType  - Nouveau type après mutation
 * @param oldValue - Ancienne valeur de l'attribut type (mutation.oldValue)
 */
function createTypeMutation(
  target: HTMLInputElement,
  newType: string,
  oldValue: string,
): MutationRecord {
  target.type = newType;
  return {
    type: 'attributes',
    attributeName: 'type',
    target,
    addedNodes: document.createDocumentFragment().childNodes,
    removedNodes: document.createDocumentFragment().childNodes,
    previousSibling: null,
    nextSibling: null,
    attributeNamespace: null,
    oldValue,
  } as unknown as MutationRecord;
}

/**
 * Crée un MutationRecord simulé pour un changement d'attribut autre que type.
 * Utile pour vérifier qu'un changement de placeholder/id/name n'affecte pas le Set.
 *
 * @param target        - Élément input cible
 * @param attributeName - Nom de l'attribut muté (différent de 'type')
 */
function createOtherAttrMutation(
  target: HTMLInputElement,
  attributeName: string,
): MutationRecord {
  return {
    type: 'attributes',
    attributeName,
    target,
    addedNodes: document.createDocumentFragment().childNodes,
    removedNodes: document.createDocumentFragment().childNodes,
    previousSibling: null,
    nextSibling: null,
    attributeNamespace: null,
    oldValue: null,
  } as unknown as MutationRecord;
}

/**
 * Extrait les entrées de log JSON correspondant à une mutation de type UC-05.
 * Filtre les appels console.info qui contiennent 'type attribute mutation registered'.
 *
 * @param spy - Spy sur console.info
 * @returns Tableau d'objets JSON parsés correspondant aux mutations UC-05
 */
function getTypeMutationLogs(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown>[] {
  return spy.mock.calls
    .filter(
      (call) =>
        typeof call[0] === 'string' &&
        (call[0] as string).includes('type attribute mutation registered'),
    )
    .map((call) => {
      try {
        return JSON.parse(call[0] as string) as Record<string, unknown>;
      } catch {
        return {};
      }
    });
}

// ---------------------------------------------------------------------------
// Suite TACHE-067 — MutationObserver type password (UC-05 toggle show/hide)
// ---------------------------------------------------------------------------

describe('TACHE-067 — MutationObserver type password (UC-05 toggle show/hide)', () => {
  beforeEach(() => {
    _snPasswordInputs.clear();
    document.body.innerHTML = '';
    resetStorage();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // TC-T067-01 : input type=password → type=text reste dans _snPasswordInputs
  // INV-UC05-01 : l'input togglé show doit rester dans le périmètre M7
  // -------------------------------------------------------------------------
  it('TC-T067-01 : input type=password togglé type=text reste dans _snPasswordInputs (INV-UC05-01)', () => {
    // Arrange : créer un input password et l'enregistrer dans le Set
    const input = document.createElement('input');
    input.type = 'password';
    document.body.appendChild(input);
    registerPasswordInput(input);

    expect(_snPasswordInputs.has(input)).toBe(true);

    // Act : simuler le toggle show (password → text)
    handleTypeAttributeMutation([createTypeMutation(input, 'text', 'password')]);

    // Assert : l'input est toujours dans le Set après le toggle show
    expect(_snPasswordInputs.has(input)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TC-T067-02 : input type=text → type=password est ajouté au Set
  // INV-UC05-02 : inputs démarrant en text puis togglés password sont capturés
  // -------------------------------------------------------------------------
  it('TC-T067-02 : input type=text togglé type=password est ajouté à _snPasswordInputs (INV-UC05-02)', () => {
    // Arrange : créer un input en type=text (pas encore dans le Set)
    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);

    expect(_snPasswordInputs.has(input)).toBe(false);

    // Act : simuler le toggle hide (text → password)
    handleTypeAttributeMutation([createTypeMutation(input, 'password', 'text')]);

    // Assert : l'input est maintenant dans le Set
    expect(_snPasswordInputs.has(input)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TC-T067-03 : mutation d'un autre attribut → aucune action sur le Set
  // INV-UC05-01 : seul l'attribut 'type' doit déclencher l'enregistrement
  // -------------------------------------------------------------------------
  it('TC-T067-03 : mutation autre attribut (placeholder) → _snPasswordInputs inchangé', () => {
    // Arrange : input text non enregistré
    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);

    const sizeBeforeMutation = _snPasswordInputs.size;

    // Act : simuler une mutation de l'attribut placeholder (pas type)
    handleTypeAttributeMutation([createOtherAttrMutation(input, 'placeholder')]);

    // Assert : le Set n'a pas changé
    expect(_snPasswordInputs.size).toBe(sizeBeforeMutation);
    expect(_snPasswordInputs.has(input)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // TC-T067-04a : log structuré — premier enregistrement → hasPasswordHistory=false
  // T-067 : champs from/to/hasPasswordHistory requis dans le log
  // -------------------------------------------------------------------------
  it('TC-T067-04a : log structuré contient from="text", to="password", hasPasswordHistory=false (premier toggle)', () => {
    // Arrange : spy sur console.info (logger émet JSON.stringify)
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'pwd-field';
    input.name = 'password';
    document.body.appendChild(input);

    // Vérifier que l'input n'est pas encore connu (hasPasswordHistory=false)
    expect(_snPasswordInputs.has(input)).toBe(false);

    // Act : toggle text → password
    handleTypeAttributeMutation([createTypeMutation(input, 'password', 'text')]);

    // Timer coalescing 100ms non encore expiré → aucun log
    expect(getTypeMutationLogs(consoleSpy)).toHaveLength(0);

    // Avancer le timer de 100ms
    vi.advanceTimersByTime(100);

    // Assert : 1 log structuré émis avec les bons champs T-067
    const logs = getTypeMutationLogs(consoleSpy);
    expect(logs).toHaveLength(1);

    const log = logs[0];
    expect(log).toBeDefined();
    expect(log!['from']).toBe('text');
    expect(log!['to']).toBe('password');
    expect(log!['hasPasswordHistory']).toBe(false);

    consoleSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // TC-T067-04b : log structuré — input déjà connu → hasPasswordHistory=true
  // T-067 : hasPasswordHistory=true si l'input était déjà dans _snPasswordInputs
  // -------------------------------------------------------------------------
  it('TC-T067-04b : log structuré contient from="password", to="text", hasPasswordHistory=true (input déjà connu)', () => {
    // Arrange : spy sur console.info
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const input = document.createElement('input');
    input.type = 'password';
    input.id = 'pwd-toggle';
    document.body.appendChild(input);

    // Pré-enregistrer l'input pour que hasPasswordHistory=true
    registerPasswordInput(input);
    expect(_snPasswordInputs.has(input)).toBe(true);

    // Act : toggle password → text (show password)
    handleTypeAttributeMutation([createTypeMutation(input, 'text', 'password')]);

    // Avancer le timer de 100ms
    vi.advanceTimersByTime(100);

    // Assert : log structuré avec hasPasswordHistory=true
    const logs = getTypeMutationLogs(consoleSpy);
    expect(logs).toHaveLength(1);

    const log = logs[0];
    expect(log).toBeDefined();
    expect(log!['from']).toBe('password');
    expect(log!['to']).toBe('text');
    expect(log!['hasPasswordHistory']).toBe(true);

    consoleSpy.mockRestore();
  });
});
