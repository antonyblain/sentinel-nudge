/**
 * @file tests/unit/content-scripts/password-detector-t095-uc05-sendmessage.test.ts
 * @description Tests unitaires TACHE-095 — Couverture end-to-end UC-05 :
 *              extension de TC-UC05-01 et TC-UC05-04 pour vérifier le
 *              chrome.runtime.sendMessage mock call count (niveau SW).
 *
 * Objectifs :
 * - TC-UC05-01-MSG : input password enregistré puis soumis → sendMessage M7
 *   est appelé exactement 1 fois avec module:'M7' action:'password_submitted'.
 * - TC-UC05-04-MSG : 2 inputs (A togglé text, B reste password) → submit collecte
 *   les 2 → 2 appels sendMessage M7 (un par champ, salt présent).
 * - TC-UC05-ORPHAN-MSG : collectPasswordInputs sur document + handleFormSubmit
 *   → sendMessage M7 appelé pour l'input orphelin.
 *
 * Complément de TACHE-082 (scope partiel) :
 *   Valide que le message password_submitted est réellement émis au niveau SW
 *   et pas seulement que l'input est présent dans le registre.
 *
 * Référence : TACHE-095 — comité revue code TACHE-069/072 C-03
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
  collectPasswordInputs,
  handleTypeAttributeMutation,
  handleFormSubmit,
} from '@/content-scripts/detectors/password-detector';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Crée un SubmitEvent simulé avec isTrusted configurable.
 * handleFormSubmit ne lit que event.isTrusted, ce cast est suffisant.
 *
 * @param trusted - Valeur de isTrusted
 */
function createSubmitEvent(trusted: boolean): SubmitEvent {
  return { isTrusted: trusted } as unknown as SubmitEvent;
}

/**
 * Filtre les appels mockRuntimeSendMessage pour module:'M7' action:'password_submitted'.
 */
function getM7Calls(): unknown[][] {
  return mockRuntimeSendMessage.mock.calls.filter(
    (call) =>
      typeof call[0] === 'object' &&
      call[0] !== null &&
      (call[0] as Record<string, unknown>)['module'] === 'M7' &&
      (call[0] as Record<string, unknown>)['action'] === 'password_submitted',
  );
}

// ---------------------------------------------------------------------------
// Suite TACHE-095 — Vérification sendMessage call count UC-05
// ---------------------------------------------------------------------------

describe('TACHE-095 — UC-05 : sendMessage M7 call count (extension TC-UC05-01/04)', () => {
  beforeEach(async () => {
    // Vider le registre + DOM avant chaque test
    _snPasswordInputs.clear();
    document.body.innerHTML = '';
    resetStorage();
    vi.clearAllMocks();

    // T-189 : salt pré-chargé dans le wrapper (remplace mockImplementation)
    await storage.set({ installation_salt: 'a'.repeat(64) });
    // Mock sendMessage par défaut
    mockRuntimeSendMessage.mockImplementation((_msg: unknown, callback?: (r: unknown) => void) => {
      callback?.({ success: true, action: 'skip', reason: 'no_reuse' });
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // TC-UC05-01-MSG : input password enregistré → submit → sendMessage M7 x1
  // Extension de TC-UC05-01 : vérifie le call count sendMessage (pas juste le registre)
  // -------------------------------------------------------------------------
  it('TC-UC05-01-MSG : input enregistré dans _snPasswordInputs → handleFormSubmit → sendMessage M7 appelé 1 fois', async () => {
    // Arrange
    const form = document.createElement('form');
    const input = document.createElement('input');
    input.type = 'password';
    input.value = 'SecretPass!95';
    form.appendChild(input);
    document.body.appendChild(form);

    registerPasswordInput(input);

    // Vérification pré-condition : input bien dans le registre
    expect(collectPasswordInputs(form)).toContain(input);

    const event = createSubmitEvent(true);

    // Act
    await handleFormSubmit(event, input);

    // Assert : sendMessage M7 password_submitted appelé exactement 1 fois
    const m7Calls = getM7Calls();
    expect(m7Calls).toHaveLength(1);

    // Vérifier la structure du payload (INV-UC01-02 : pas de mot de passe en clair)
    const payload = (m7Calls[0]![0] as Record<string, unknown>)['payload'] as Record<
      string,
      unknown
    >;
    expect(payload).toHaveProperty('hash');
    expect(payload).toHaveProperty('domain_hash');
    expect(payload).not.toHaveProperty('password');
    expect(payload).not.toHaveProperty('value');
  });

  // -------------------------------------------------------------------------
  // TC-UC05-04-MSG : 2 inputs (A togglé text, B reste password) → 2 sendMessage M7
  // Extension de TC-UC05-04 : vérifie que les 2 champs déclenchent chacun un sendMessage
  // -------------------------------------------------------------------------
  it('TC-UC05-04-MSG : 2 inputs collectés (1 togglé text + 1 password) → 2 sendMessage M7 distincts', async () => {
    // Arrange
    const form = document.createElement('form');

    const inputA = document.createElement('input');
    inputA.type = 'password';
    inputA.value = 'PassA!095';
    form.appendChild(inputA);

    const inputB = document.createElement('input');
    inputB.type = 'password';
    inputB.value = 'PassB!095';
    form.appendChild(inputB);

    document.body.appendChild(form);

    // Enregistrer les deux
    registerPasswordInput(inputA);
    registerPasswordInput(inputB);

    // Toggle inputA vers text (UC-05 show password)
    inputA.type = 'text';
    const mutations: MutationRecord[] = [
      {
        type: 'attributes',
        attributeName: 'type',
        target: inputA,
        addedNodes: document.createDocumentFragment().childNodes,
        removedNodes: document.createDocumentFragment().childNodes,
        previousSibling: null,
        nextSibling: null,
        attributeNamespace: null,
        oldValue: 'password',
      } as unknown as MutationRecord,
    ];
    handleTypeAttributeMutation(mutations);

    // Pré-condition : les 2 inputs sont collectés
    const collected = collectPasswordInputs(form);
    expect(collected).toContain(inputA);
    expect(collected).toContain(inputB);
    expect(collected).toHaveLength(2);

    const event = createSubmitEvent(true);

    // Act : soumettre les deux champs séquentiellement
    await handleFormSubmit(event, inputA);
    await handleFormSubmit(event, inputB);

    // Assert : 2 appels M7 sendMessage
    const m7Calls = getM7Calls();
    expect(m7Calls).toHaveLength(2);

    // Chaque appel doit avoir un hash (potentiellement différent car passwords différents)
    const payloadA = (m7Calls[0]![0] as Record<string, unknown>)['payload'] as Record<
      string,
      unknown
    >;
    const payloadB = (m7Calls[1]![0] as Record<string, unknown>)['payload'] as Record<
      string,
      unknown
    >;
    expect(payloadA).toHaveProperty('hash');
    expect(payloadB).toHaveProperty('hash');
    // Les hashes doivent être différents car les passwords sont différents
    expect(payloadA['hash']).not.toBe(payloadB['hash']);
  });

  // -------------------------------------------------------------------------
  // TC-UC05-ORPHAN-MSG : input orphelin collecté via document → sendMessage M7
  // -------------------------------------------------------------------------
  it('TC-UC05-ORPHAN-MSG : input orphelin (sans form) enregistré → handleFormSubmit → sendMessage M7 appelé', async () => {
    // Arrange : input sans form (orphelin)
    const orphan = document.createElement('input');
    orphan.type = 'password';
    orphan.value = 'OrphanPass!095';
    document.body.appendChild(orphan);

    registerPasswordInput(orphan);

    // Vérification pré-condition : collecté via document scope
    const collected = collectPasswordInputs(document);
    expect(collected).toContain(orphan);

    const event = createSubmitEvent(true);

    // Act
    await handleFormSubmit(event, orphan);

    // Assert : sendMessage M7 appelé pour l'orphelin
    const m7Calls = getM7Calls();
    expect(m7Calls).toHaveLength(1);

    const payload = (m7Calls[0]![0] as Record<string, unknown>)['payload'] as Record<
      string,
      unknown
    >;
    expect(payload).toHaveProperty('hash');
    expect(payload).toHaveProperty('domain_hash');
  });
});
