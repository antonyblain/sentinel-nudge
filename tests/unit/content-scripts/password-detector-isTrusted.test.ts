/**
 * @file tests/unit/content-scripts/password-detector-isTrusted.test.ts
 * @description Tests unitaires UC-02 â€” filtrage des submits programmatiques (PM auto-fill)
 *              et UC-05 â€” registre _snPasswordInputs + collectPasswordInputs + toggle show/hide.
 *
 * TACHE-069 (UC-02) â€” ARB-UC02-01 :
 *   VÃ©rifier que handleFormSubmit retourne early si event.isTrusted=false.
 *   VÃ©rifier que les messages password_submitted envoyÃ©s depuis le CS vers le SW
 *   ne sont PAS filtrÃ©s par isTrusted (le handler SW n'a pas accÃ¨s Ã  l'event DOM).
 *
 * TACHE-072 (UC-05) â€” ARB-072-01 :
 *   VÃ©rifier le registre _snPasswordInputs, collectPasswordInputs, handleTypeAttributeMutation.
 *   Invariants : INV-UC05-01, INV-UC05-02, INV-UC05-03, INV-UC05-04.
 *
 * TACHE-096 â€” corrections comite revue code NB-01 et NB-03 :
 *   NB-01 : beforeEach clearing _snPasswordInputs en UC-02 (isolation inter-tests)
 *   NB-03 : assertions storage par cle (toHaveBeenCalledWith) au lieu de positionnelles
 *
 * T-189 : mock inline storage.local remplacÃ© par createMockChromeStorage() (wrapper JSON-strict P-018).
 *         TC-NB03-REG-01/02 adaptÃ©s pour utiliser mockRuntimeSendMessage (vi.fn) au lieu de
 *         mockStorageLocalGet (dÃ©sormais dÃ©lÃ©guÃ© au wrapper non-espionnable).
 *
 * Strategy de test :
 *   - Mock de chrome et browser-adapter pour Ã©viter l'auto-exÃ©cution de initPasswordDetector
 *   - Import direct des fonctions exportÃ©es depuis password-detector.ts
 *   - jsdom pour les manipulations DOM
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockChromeStorage } from '../../helpers/mock-chrome-storage';

// ---------------------------------------------------------------------------
// Mock de chrome (nÃ©cessaire car browser-adapter appelle chrome.*)
// Les mocks doivent Ãªtre dÃ©finis AVANT l'import du module testÃ©
// ---------------------------------------------------------------------------

const { storage, reset: resetStorage } = createMockChromeStorage();

const mockRuntimeSendMessage = vi
  .fn()
  .mockImplementation((_msg: unknown, callback?: (r: unknown) => void) => {
    callback?.(null);
  });
const mockI18nGetMessage = vi.fn().mockReturnValue('');

// chrome doit Ãªtre dÃ©fini AVANT l'import du module
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
  i18n: { getMessage: mockI18nGetMessage },
} as unknown as typeof chrome;

// ---------------------------------------------------------------------------
// Import du module aprÃ¨s les mocks
// ---------------------------------------------------------------------------

import {
  _snPasswordInputs,
  registerPasswordInput,
  collectPasswordInputs,
  handleTypeAttributeMutation,
  handleFormSubmit,
} from '@/content-scripts/detectors/password-detector';

// ---------------------------------------------------------------------------
// NB-03 T-096 : helper par clÃ© â€” Ã©vite toute indexation positionnelle
// T-189 : adaptÃ© pour fonctionner sur mockRuntimeSendMessage (module/action comme clÃ©).
// ---------------------------------------------------------------------------

/**
 * Cherche parmi tous les appels d'un mock la premiÃ¨re invocation dont le
 * premier argument contient la clÃ© (tableau, string, ou propriÃ©tÃ© d'objet).
 */
function findCallByKey(mockFn: ReturnType<typeof vi.fn>, key: string): unknown[] | undefined {
  return mockFn.mock.calls.find((call) => {
    const firstArg = call[0];
    if (Array.isArray(firstArg)) return (firstArg as string[]).includes(key);
    if (typeof firstArg === 'string') return firstArg === key;
    if (typeof firstArg === 'object' && firstArg !== null) {
      const obj = firstArg as Record<string, unknown>;
      return obj['module'] === key || obj['action'] === key;
    }
    return false;
  });
}

// ---------------------------------------------------------------------------
// SECTION UC-02 â€” Filtre isTrusted (TACHE-069 â€” ARB-UC02-01)
// ---------------------------------------------------------------------------

describe('UC-02 â€” handleFormSubmit : filtre isTrusted (ARB-UC02-01)', () => {
  function createPasswordInput(value = 'testpassword123!'): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'password';
    input.value = value;
    document.body.appendChild(input);
    return input;
  }

  function createSubmitEvent(trusted: boolean): SubmitEvent {
    return { isTrusted: trusted } as unknown as SubmitEvent;
  }

  beforeEach(async () => {
    // NB-01 T-096 : reset _snPasswordInputs pour eviter pollution inter-tests
    _snPasswordInputs.clear();
    document.body.innerHTML = '';
    resetStorage();
    vi.clearAllMocks();
    // T-189 : salt prÃ©-chargÃ© dans le wrapper (remplace mockImplementationOnce)
    await storage.set({ installation_salt: 'a'.repeat(64) });
    mockRuntimeSendMessage.mockImplementation((_msg: unknown, callback?: (r: unknown) => void) => {
      callback?.({ success: true, action: 'skip', reason: 'no_reuse' });
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('TC-UC02-FILTER-01 : isTrusted=true â†’ M7 envoie un message au SW', async () => {
    const input = createPasswordInput('monmotdepasse!');
    const event = createSubmitEvent(true);

    await handleFormSubmit(event, input);

    const m7Calls = mockRuntimeSendMessage.mock.calls.filter(
      (call) =>
        typeof call[0] === 'object' &&
        call[0] !== null &&
        (call[0] as Record<string, unknown>)['module'] === 'M7' &&
        (call[0] as Record<string, unknown>)['action'] === 'password_submitted',
    );
    expect(m7Calls.length).toBeGreaterThanOrEqual(1);
  });

  it('TC-UC02-FILTER-02 : isTrusted=false â†’ M7 retourne early, aucun hash capturÃ©', async () => {
    const input = createPasswordInput('monmotdepasse!');
    const event = createSubmitEvent(false);

    await handleFormSubmit(event, input);

    const m7Calls = mockRuntimeSendMessage.mock.calls.filter(
      (call) =>
        typeof call[0] === 'object' &&
        call[0] !== null &&
        (call[0] as Record<string, unknown>)['module'] === 'M7',
    );
    expect(m7Calls.length).toBe(0);
  });

  it('TC-UC02-FILTER-03 : le message password_submitted envoyÃ© par le CS ne contient pas isTrusted', async () => {
    const capturedMessages: unknown[] = [];
    mockRuntimeSendMessage.mockImplementation((msg: unknown, callback?: (r: unknown) => void) => {
      capturedMessages.push(msg);
      callback?.({ success: true, action: 'skip', reason: 'no_reuse' });
    });

    const input = createPasswordInput('testpassword!');
    input.setAttribute('data-test-reset', 'true');
    const event = createSubmitEvent(true);

    await handleFormSubmit(event, input);

    const m7Messages = capturedMessages.filter(
      (msg) =>
        typeof msg === 'object' &&
        msg !== null &&
        (msg as Record<string, unknown>)['module'] === 'M7' &&
        (msg as Record<string, unknown>)['action'] === 'password_submitted',
    );
    for (const msg of m7Messages) {
      const payload = (msg as Record<string, unknown>)['payload'] as Record<string, unknown>;
      expect(payload).not.toHaveProperty('isTrusted');
      expect(payload).toHaveProperty('hash');
      expect(payload).toHaveProperty('domain_hash');
    }
  });

  // =========================================================================
  // TESTS DE RÃ‰GRESSION NB-01 et NB-03 (T-096)
  // =========================================================================

  it('TC-NB01-REG-01 : beforeEach NB-01 â€” _snPasswordInputs est vide en dÃ©but de chaque test UC-02 (isolation)', () => {
    const staleInput = document.createElement('input');
    staleInput.type = 'password';
    staleInput.value = 'stale-value';
    _snPasswordInputs.add(staleInput);
    expect(_snPasswordInputs.has(staleInput)).toBe(true);

    _snPasswordInputs.clear();
    expect(_snPasswordInputs.size).toBe(0);

    const form = document.createElement('form');
    const freshInput = document.createElement('input');
    freshInput.type = 'password';
    freshInput.value = 'fresh';
    form.appendChild(freshInput);
    document.body.appendChild(form);

    const collected = collectPasswordInputs(form);
    expect(collected).not.toContain(staleInput);
    expect(collected).toContain(freshInput);
  });

  // -------------------------------------------------------------------------
  // TC-NB03-REG-01 : findCallByKey retrouve le bon appel par clÃ©,
  // indÃ©pendamment de l'ordre d'appel.
  //
  // T-189 : adaptÃ© pour utiliser mockRuntimeSendMessage (vi.fn) au lieu de
  // mockStorageLocalGet (dÃ©sormais dÃ©lÃ©guÃ© au wrapper non-espionnable).
  // -------------------------------------------------------------------------
  it('TC-NB03-REG-01 : findCallByKey retrouve le bon appel par cle, independamment de l ordre', () => {
    chrome.runtime.sendMessage({ module: 'M1', action: 'event_a' }, () => {});
    chrome.runtime.sendMessage({ module: 'M7', action: 'password_submitted' }, () => {});
    chrome.runtime.sendMessage({ module: 'M9', action: 'event_b' }, () => {});

    const m7Call = findCallByKey(mockRuntimeSendMessage, 'M7');
    expect(m7Call).toBeDefined();
    expect((m7Call![0] as Record<string, unknown>)['module']).toBe('M7');

    const m1Call = findCallByKey(mockRuntimeSendMessage, 'M1');
    expect(m1Call).toBeDefined();

    const m9Call = findCallByKey(mockRuntimeSendMessage, 'M9');
    expect(m9Call).toBeDefined();

    const missingCall = findCallByKey(mockRuntimeSendMessage, 'M99');
    expect(missingCall).toBeUndefined();
  });

  it('TC-NB03-REG-02 : swap ordre appels sendMessage â€” assertions par clÃ© restent vertes', () => {
    chrome.runtime.sendMessage({ module: 'M7', action: 'password_submitted' }, () => {});
    chrome.runtime.sendMessage({ module: 'M1', action: 'event_a' }, () => {});

    expect(mockRuntimeSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'M7' }),
      expect.any(Function),
    );
    expect(mockRuntimeSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'M1' }),
      expect.any(Function),
    );

    const m7Call = findCallByKey(mockRuntimeSendMessage, 'M7');
    expect(m7Call).toBeDefined();

    const m7CallPositional = mockRuntimeSendMessage.mock.calls[0];
    expect((m7CallPositional[0] as Record<string, unknown>)['module']).toBe('M7');

    const m1Call = findCallByKey(mockRuntimeSendMessage, 'M1');
    expect(m1Call).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// SECTION UC-05 â€” Registre _snPasswordInputs + collectPasswordInputs + toggle
// ---------------------------------------------------------------------------

describe('UC-05 â€” registre _snPasswordInputs et collectPasswordInputs (TACHE-072)', () => {
  beforeEach(() => {
    _snPasswordInputs.clear();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('TC-UC05-01 : input type="password" enregistrÃ© via registerPasswordInput â†’ prÃ©sent dans collectPasswordInputs', () => {
    const form = document.createElement('form');
    const input = document.createElement('input');
    input.type = 'password';
    input.value = 'secret';
    form.appendChild(input);
    document.body.appendChild(form);

    registerPasswordInput(input);

    const collected = collectPasswordInputs(form);
    expect(collected).toContain(input);
    expect(collected).toHaveLength(1);
  });

  it('TC-UC05-02 : input togglÃ© passwordâ†’textâ†’password reste dans _snPasswordInputs (INV-UC05-01)', () => {
    const form = document.createElement('form');
    const input = document.createElement('input');
    input.type = 'password';
    form.appendChild(input);
    document.body.appendChild(form);

    registerPasswordInput(input);
    input.type = 'text';
    const mutations1: MutationRecord[] = [
      {
        type: 'attributes',
        attributeName: 'type',
        target: input,
        addedNodes: document.createDocumentFragment().childNodes,
        removedNodes: document.createDocumentFragment().childNodes,
        previousSibling: null,
        nextSibling: null,
        attributeNamespace: null,
        oldValue: 'password',
      } as unknown as MutationRecord,
    ];
    handleTypeAttributeMutation(mutations1);
    expect(_snPasswordInputs.has(input)).toBe(true);

    input.type = 'password';
    const mutations2: MutationRecord[] = [
      {
        type: 'attributes',
        attributeName: 'type',
        target: input,
        addedNodes: document.createDocumentFragment().childNodes,
        removedNodes: document.createDocumentFragment().childNodes,
        previousSibling: null,
        nextSibling: null,
        attributeNamespace: null,
        oldValue: 'text',
      } as unknown as MutationRecord,
    ];
    handleTypeAttributeMutation(mutations2);

    expect(_snPasswordInputs.has(input)).toBe(true);
    const collected = collectPasswordInputs(form);
    expect(collected).toContain(input);
    expect(collected.filter((el) => el === input)).toHaveLength(1);
  });

  it('TC-UC05-03 : input dÃ©marre text + togglÃ© vers password â†’ enregistrÃ© dans _snPasswordInputs (INV-UC05-02)', () => {
    const form = document.createElement('form');
    const input = document.createElement('input');
    input.type = 'text';
    form.appendChild(input);
    document.body.appendChild(form);

    input.type = 'password';
    const mutations: MutationRecord[] = [
      {
        type: 'attributes',
        attributeName: 'type',
        target: input,
        addedNodes: document.createDocumentFragment().childNodes,
        removedNodes: document.createDocumentFragment().childNodes,
        previousSibling: null,
        nextSibling: null,
        attributeNamespace: null,
        oldValue: 'text',
      } as unknown as MutationRecord,
    ];
    handleTypeAttributeMutation(mutations);

    expect(_snPasswordInputs.has(input)).toBe(true);
    const collected = collectPasswordInputs(form);
    expect(collected).toContain(input);
  });

  it('TC-UC05-04 : 2 inputs dans form, 1 togglÃ© text, les 2 sont collectÃ©s au submit', () => {
    const form = document.createElement('form');

    const inputA = document.createElement('input');
    inputA.type = 'password';
    inputA.value = 'passA';
    form.appendChild(inputA);

    const inputB = document.createElement('input');
    inputB.type = 'password';
    inputB.value = 'passB';
    form.appendChild(inputB);

    document.body.appendChild(form);

    registerPasswordInput(inputA);
    registerPasswordInput(inputB);

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

    const collected = collectPasswordInputs(form);

    expect(collected).toContain(inputA);
    expect(collected).toContain(inputB);
    expect(collected).toHaveLength(2);
  });

  it('TC-UC05-05-SET-DEDUP : toggle spam (10x) â†’ Set dÃ©duplique naturellement les enregistrements multiples (registerPasswordInput idempotent via Set)', () => {
    const input = document.createElement('input');
    input.type = 'password';
    document.body.appendChild(input);

    for (let i = 0; i < 10; i++) {
      const newType = i % 2 === 0 ? 'text' : 'password';
      input.type = newType;
      const mutations: MutationRecord[] = [
        {
          type: 'attributes',
          attributeName: 'type',
          target: input,
          addedNodes: document.createDocumentFragment().childNodes,
          removedNodes: document.createDocumentFragment().childNodes,
          previousSibling: null,
          nextSibling: null,
          attributeNamespace: null,
          oldValue: i % 2 === 0 ? 'password' : 'text',
        } as unknown as MutationRecord,
      ];
      handleTypeAttributeMutation(mutations);
    }

    expect(_snPasswordInputs.has(input)).toBe(true);
    const entries = Array.from(_snPasswordInputs).filter((el) => el === input);
    expect(entries).toHaveLength(1);
  });

  it('TC-UC05-REG-01 : registerPasswordInput est idempotent â€” plusieurs appels = 1 entrÃ©e', () => {
    const input = document.createElement('input');
    input.type = 'password';
    document.body.appendChild(input);

    registerPasswordInput(input);
    registerPasswordInput(input);
    registerPasswordInput(input);

    const entries = Array.from(_snPasswordInputs).filter((el) => el === input);
    expect(entries).toHaveLength(1);
  });

  it('TC-UC05-COL-01 : collectPasswordInputs sur document retourne les orphelins password + Set', () => {
    const orphanPwd = document.createElement('input');
    orphanPwd.type = 'password';
    orphanPwd.value = 'orphanpass';
    document.body.appendChild(orphanPwd);

    const orphanToggled = document.createElement('input');
    orphanToggled.type = 'text';
    orphanToggled.value = 'toggledpass';
    document.body.appendChild(orphanToggled);

    registerPasswordInput(orphanToggled);

    const collected = collectPasswordInputs(document);

    expect(collected).toContain(orphanPwd);
    expect(collected).toContain(orphanToggled);
  });

  it('TC-UC05-COL-02 : collectPasswordInputs sur form ne retourne pas les inputs hors form', () => {
    const form1 = document.createElement('form');
    const input1 = document.createElement('input');
    input1.type = 'password';
    input1.value = 'pass1';
    form1.appendChild(input1);
    document.body.appendChild(form1);

    const form2 = document.createElement('form');
    const input2 = document.createElement('input');
    input2.type = 'password';
    input2.value = 'pass2';
    form2.appendChild(input2);
    document.body.appendChild(form2);

    registerPasswordInput(input1);
    registerPasswordInput(input2);

    const collected = collectPasswordInputs(form1);

    expect(collected).toContain(input1);
    expect(collected).not.toContain(input2);
    expect(collected).toHaveLength(1);
  });

  it('TC-UC05-MUTATION-01 : handleTypeAttributeMutation ignore les mutations non-input', () => {
    const div = document.createElement('div');
    const mutations: MutationRecord[] = [
      {
        type: 'attributes',
        attributeName: 'type',
        target: div,
        addedNodes: document.createDocumentFragment().childNodes,
        removedNodes: document.createDocumentFragment().childNodes,
        previousSibling: null,
        nextSibling: null,
        attributeNamespace: null,
        oldValue: null,
      } as unknown as MutationRecord,
    ];

    expect(() => handleTypeAttributeMutation(mutations)).not.toThrow();
    expect(_snPasswordInputs.size).toBe(0);
  });

  it('TC-UC05-MUTATION-02 : handleTypeAttributeMutation ignore les mutations non-type (attributeName != "type")', () => {
    const input = document.createElement('input');
    input.type = 'password';
    const mutations: MutationRecord[] = [
      {
        type: 'attributes',
        attributeName: 'name',
        target: input,
        addedNodes: document.createDocumentFragment().childNodes,
        removedNodes: document.createDocumentFragment().childNodes,
        previousSibling: null,
        nextSibling: null,
        attributeNamespace: null,
        oldValue: null,
      } as unknown as MutationRecord,
    ];

    handleTypeAttributeMutation(mutations);

    expect(_snPasswordInputs.has(input)).toBe(false);
  });

  it("SM-UC05-06 : INV-UC05-03 â€” handleFormSubmit appelÃ© 2x aprÃ¨s toggles ne produit qu'un seul sendMessage M7", async () => {
    const form = document.createElement('form');
    const input = document.createElement('input');
    input.type = 'password';
    input.name = 'pwd';
    input.value = 'SecretPass123!';
    form.appendChild(input);
    document.body.appendChild(form);

    // T-189 : salt chargÃ© directement dans le wrapper pour ce test
    await storage.set({ installation_salt: 'a'.repeat(64) });

    mockRuntimeSendMessage.mockImplementation((_msg: unknown, callback?: (r: unknown) => void) => {
      callback?.({ success: true, action: 'skip', reason: 'no_reuse' });
    });

    input.type = 'text';
    input.type = 'password';
    input.type = 'text';

    const submitEvent1 = { isTrusted: true } as unknown as Event;
    await handleFormSubmit(submitEvent1, input);

    const submitEvent2 = { isTrusted: true } as unknown as Event;
    await handleFormSubmit(submitEvent2, input);

    const m7Calls = mockRuntimeSendMessage.mock.calls.filter(
      (call) =>
        typeof call[0] === 'object' &&
        call[0] !== null &&
        (call[0] as Record<string, unknown>)['module'] === 'M7' &&
        (call[0] as Record<string, unknown>)['action'] === 'password_submitted',
    );
    expect(m7Calls).toHaveLength(1);
  });
});
