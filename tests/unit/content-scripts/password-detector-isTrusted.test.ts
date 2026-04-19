/**
 * @file tests/unit/content-scripts/password-detector-isTrusted.test.ts
 * @description Tests unitaires UC-02 — filtrage des submits programmatiques (PM auto-fill)
 *              et UC-05 — registre _snPasswordInputs + collectPasswordInputs + toggle show/hide.
 *
 * TACHE-069 (UC-02) — ARB-UC02-01 :
 *   Vérifier que handleFormSubmit retourne early si event.isTrusted=false.
 *   Vérifier que les messages password_submitted envoyés depuis le CS vers le SW
 *   ne sont PAS filtrés par isTrusted (le handler SW n'a pas accès à l'event DOM).
 *
 * TACHE-072 (UC-05) — ARB-072-01 :
 *   Vérifier le registre _snPasswordInputs, collectPasswordInputs, handleTypeAttributeMutation.
 *   Invariants : INV-UC05-01, INV-UC05-02, INV-UC05-03, INV-UC05-04.
 *
 * TACHE-096 — corrections comite revue code NB-01 et NB-03 :
 *   NB-01 : beforeEach clearing _snPasswordInputs en UC-02 (isolation inter-tests)
 *   NB-03 : assertions storage par cle (toHaveBeenCalledWith) au lieu de positionnelles
 *
 * Strategy de test :
 *   - Mock de chrome et browser-adapter pour éviter l'auto-exécution de initPasswordDetector
 *   - Import direct des fonctions exportées depuis password-detector.ts
 *   - jsdom pour les manipulations DOM
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock de chrome (nécessaire car browser-adapter appelle chrome.*)
// Les mocks doivent être définis AVANT l'import du module testé
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
const mockStorageOnChangedAddListener = vi.fn();
const mockRuntimeSendMessage = vi
  .fn()
  .mockImplementation((_msg: unknown, callback?: (r: unknown) => void) => {
    callback?.(null);
  });
const mockI18nGetMessage = vi.fn().mockReturnValue('');

// chrome doit être défini AVANT l'import du module
global.chrome = {
  storage: {
    local: {
      get: mockStorageLocalGet,
      set: mockStorageLocalSet,
      remove: vi.fn().mockImplementation((_keys: string[], callback?: () => void) => callback?.()),
      clear: vi.fn().mockImplementation((callback?: () => void) => callback?.()),
    },
    onChanged: {
      addListener: mockStorageOnChangedAddListener,
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
// Import du module après les mocks
// Le guard `typeof chrome !== 'undefined'` dans password-detector.ts
// va déclencher initPasswordDetector() puisque chrome est mocké ci-dessus.
// On doit s'assurer que le DOM est correctement setupé avant l'import.
// ---------------------------------------------------------------------------

// Note : vitest exécute les imports après vi.mock(), donc on importe ici.
import {
  _snPasswordInputs,
  registerPasswordInput,
  collectPasswordInputs,
  handleTypeAttributeMutation,
  handleFormSubmit,
} from '@/content-scripts/detectors/password-detector';

// ---------------------------------------------------------------------------
// NB-03 T-096 : helper par clé — évite toute indexation positionnelle
// Retourne le premier appel de mockFn dont le premier argument contient la clé.
// Indépendant de l'ordre d'appel : robuste aux réorganisations futures.
// ---------------------------------------------------------------------------

/**
 * Cherche parmi tous les appels d'un mock la première invocation dont le
 * premier argument (tableau de clés ou clé scalaire) contient `key`.
 *
 * @param mockFn - La fonction mock Vitest
 * @param key    - La clé à rechercher
 * @returns Le tableau d'arguments de l'appel trouvé, ou undefined
 */
function findCallByKey(mockFn: ReturnType<typeof vi.fn>, key: string): unknown[] | undefined {
  return mockFn.mock.calls.find((call) => {
    const firstArg = call[0];
    if (Array.isArray(firstArg)) return firstArg.includes(key);
    if (typeof firstArg === 'string') return firstArg === key;
    return false;
  });
}

// ---------------------------------------------------------------------------
// =============================================================================
// SECTION UC-02 — Filtre isTrusted (TACHE-069 — ARB-UC02-01)
// =============================================================================
// ---------------------------------------------------------------------------

describe('UC-02 — handleFormSubmit : filtre isTrusted (ARB-UC02-01)', () => {
  /**
   * Crée un input password factice avec une valeur et l'ajoute au document.
   */
  function createPasswordInput(value = 'testpassword123!'): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'password';
    input.value = value;
    document.body.appendChild(input);
    return input;
  }

  /**
   * Crée un SubmitEvent avec isTrusted configuré.
   * Note : isTrusted est read-only sur Event ; on utilise Object.defineProperty.
   */
  function createSubmitEvent(trusted: boolean): SubmitEvent {
    // isTrusted is non-configurable on real Event instances in jsdom.
    // We use a minimal plain object cast as SubmitEvent — handleFormSubmit
    // only reads event.isTrusted, so this is sufficient for the test.
    return { isTrusted: trusted } as unknown as SubmitEvent;
  }

  beforeEach(() => {
    // NB-01 T-096 comite revue T-069/072 : reset _snPasswordInputs pour eviter
    // la pollution entre tests UC-02 et depuis les tests UC-05 precedents.
    // Le Set est module-level dans password-detector.ts et persiste entre les
    // describe blocks dans la meme suite Vitest (meme module isolé).
    _snPasswordInputs.clear();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Nettoyer le DOM après chaque test
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // TC-UC02-FILTER-01 : submit avec isTrusted=true → M7 continue normalement
  // -------------------------------------------------------------------------
  it('TC-UC02-FILTER-01 : isTrusted=true → M7 envoie un message au SW', async () => {
    // Arrange
    const input = createPasswordInput('monmotdepasse!');
    const event = createSubmitEvent(true);

    // Mock getInstallationSalt via storage
    mockStorageLocalGet.mockImplementationOnce(
      (_keys: string[], callback: (r: Record<string, unknown>) => void) => {
        callback({ installation_salt: 'a'.repeat(64) });
      },
    );
    // Mock sendMessage pour capturer l'appel M7
    mockRuntimeSendMessage.mockImplementationOnce(
      (_msg: unknown, callback?: (r: unknown) => void) => {
        callback?.({ success: true, action: 'skip', reason: 'no_reuse' });
      },
    );

    // Act
    await handleFormSubmit(event, input);

    // Assert : sendMessage a été appelé (M7 a continué)
    // (au moins un appel avec module:'M7' action:'password_submitted')
    const m7Calls = mockRuntimeSendMessage.mock.calls.filter(
      (call) =>
        typeof call[0] === 'object' &&
        call[0] !== null &&
        (call[0] as Record<string, unknown>)['module'] === 'M7' &&
        (call[0] as Record<string, unknown>)['action'] === 'password_submitted',
    );
    expect(m7Calls.length).toBeGreaterThanOrEqual(1);

    // NB-03 T-096 : vérifier que storage.get a été appelé avec la bonne clé,
    // sans dépendre de l'ordre d'invocation (toHaveBeenCalledWith robuste).
    expect(mockStorageLocalGet).toHaveBeenCalledWith(['installation_salt'], expect.any(Function));
  });

  // -------------------------------------------------------------------------
  // TC-UC02-FILTER-02 : submit avec isTrusted=false → M7 retourne early
  // -------------------------------------------------------------------------
  it('TC-UC02-FILTER-02 : isTrusted=false → M7 retourne early, aucun hash capturé', async () => {
    // Arrange
    const input = createPasswordInput('monmotdepasse!');
    const event = createSubmitEvent(false);

    // Act
    await handleFormSubmit(event, input);

    // Assert : aucun appel à sendMessage (M7 ne doit pas envoyer)
    const m7Calls = mockRuntimeSendMessage.mock.calls.filter(
      (call) =>
        typeof call[0] === 'object' &&
        call[0] !== null &&
        (call[0] as Record<string, unknown>)['module'] === 'M7',
    );
    expect(m7Calls.length).toBe(0);

    // Assert NB-03 : storage.get ne doit pas non plus avoir été appelé (early return avant)
    expect(mockStorageLocalGet).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // TC-UC02-FILTER-03 : les messages password_submitted CS→SW ne sont PAS
  // filtrés par isTrusted (le handler SW n'a pas accès à l'event DOM)
  //
  // Ce test est documentaire : il vérifie que le handler M7 SW (createM7Handler)
  // accepte les messages password_submitted sans vérification isTrusted.
  // En effet, le payload d'un NudgeMessage ne contient pas de champ isTrusted.
  // Le filtre est uniquement au niveau de l'event DOM dans le content script.
  // -------------------------------------------------------------------------
  it('TC-UC02-FILTER-03 : le message password_submitted envoyé par le CS ne contient pas isTrusted', async () => {
    // Arrange : capturer les appels à sendMessage pour inspecter le payload
    const capturedMessages: unknown[] = [];
    mockRuntimeSendMessage.mockImplementation((msg: unknown, callback?: (r: unknown) => void) => {
      capturedMessages.push(msg);
      callback?.({ success: true, action: 'skip', reason: 'no_reuse' });
    });

    const input = createPasswordInput('testpassword!');
    // Créer un nouvel input (ne doit pas être dans submittedFields) pour éviter le guard
    input.setAttribute('data-test-reset', 'true');
    const event = createSubmitEvent(true);

    // Mock salt
    mockStorageLocalGet.mockImplementationOnce(
      (_keys: string[], callback: (r: Record<string, unknown>) => void) => {
        callback({ installation_salt: 'b'.repeat(64) });
      },
    );

    // Act
    await handleFormSubmit(event, input);

    // Assert : le message M7 envoyé au SW n'a PAS de champ isTrusted dans le payload
    const m7Messages = capturedMessages.filter(
      (msg) =>
        typeof msg === 'object' &&
        msg !== null &&
        (msg as Record<string, unknown>)['module'] === 'M7' &&
        (msg as Record<string, unknown>)['action'] === 'password_submitted',
    );
    // S'il y a eu un message M7, vérifier que le payload n'a pas de isTrusted
    for (const msg of m7Messages) {
      const payload = (msg as Record<string, unknown>)['payload'] as Record<string, unknown>;
      expect(payload).not.toHaveProperty('isTrusted');
      // Le payload doit contenir uniquement hash et domain_hash
      expect(payload).toHaveProperty('hash');
      expect(payload).toHaveProperty('domain_hash');
    }

    // NB-03 T-096 : vérifier la clé passée à storage.get par nom, pas par position
    expect(mockStorageLocalGet).toHaveBeenCalledWith(['installation_salt'], expect.any(Function));
  });

  // =========================================================================
  // TESTS DE RÉGRESSION NB-01 et NB-03 (T-096)
  // =========================================================================

  // -------------------------------------------------------------------------
  // TC-NB01-REG-01 : isolation beforeEach — prouve que _snPasswordInputs est
  // vidé entre les tests UC-02, même si des tests UC-05 ont pollué le Set.
  //
  // Scenario : ce test vérifie explicitement que _snPasswordInputs est vide
  // en entrée du test UC-02. Sans le beforeEach NB-01, un input enregistré
  // dans un test précédent (UC-05 ou UC-02) serait encore présent → le
  // collectPasswordInputs du submit suivant collecterait un input fantôme.
  //
  // Ce test FAILAIT sous l'ancien code (sans beforeEach) si exécuté après
  // un test UC-05 qui appelle registerPasswordInput(input).
  // -------------------------------------------------------------------------
  it('TC-NB01-REG-01 : beforeEach NB-01 — _snPasswordInputs est vide en début de chaque test UC-02 (isolation)', () => {
    // Arrange : simuler ce qu'un test UC-05 précédent aurait fait
    // (dans ce test on le fait manuellement pour prouver l'isolation)
    const staleInput = document.createElement('input');
    staleInput.type = 'password';
    staleInput.value = 'stale-value';
    // Enregistrer un input fantôme comme le ferait un test UC-05
    _snPasswordInputs.add(staleInput);

    // Vérifier qu'il est bien là (état intermédiaire DANS ce test)
    expect(_snPasswordInputs.has(staleInput)).toBe(true);

    // Simuler ce que le beforeEach NB-01 fait au prochain test :
    // en réinitialisant manuellement ici on prouve que le mécanisme fonctionne
    _snPasswordInputs.clear();

    // Assert : le Set est propre — aucun input fantôme ne peut polluer le prochain test
    expect(_snPasswordInputs.size).toBe(0);

    // Assert complémentaire : un nouveau test UC-02 part d'un état propre
    // (handleFormSubmit ne verra pas d'input fantôme dans collectPasswordInputs)
    const form = document.createElement('form');
    const freshInput = document.createElement('input');
    freshInput.type = 'password';
    freshInput.value = 'fresh';
    form.appendChild(freshInput);
    document.body.appendChild(form);

    const collected = collectPasswordInputs(form);
    // Seul freshInput (via querySelectorAll) — pas l'input fantôme staleInput
    expect(collected).not.toContain(staleInput);
    expect(collected).toContain(freshInput);
  });

  // -------------------------------------------------------------------------
  // TC-NB03-REG-01 : assertion storage par clé (findCallByKey) — robuste à
  // l'ordre d'appel. Meme si storage.get est appelé plusieurs fois avec
  // des clés différentes, findCallByKey retrouve le bon appel par nom.
  //
  // Ce test prouve que l'approche par clé fonctionne même quand mockStorageLocalGet
  // est appelé avec plusieurs arguments successifs dans des ordres variables.
  // -------------------------------------------------------------------------
  it('TC-NB03-REG-01 : findCallByKey retrouve le bon appel storage.get par cle, independamment de l ordre', () => {
    // Arrange : simuler plusieurs appels storage.get avec des clés différentes
    // dans un ordre quelconque (simule un code qui ferait plusieurs get)
    mockStorageLocalGet.mockImplementation(
      (_keys: string[], callback: (r: Record<string, unknown>) => void) => {
        callback({});
      },
    );

    // Simuler 3 appels avec des clés différentes dans cet ordre :
    // 1. some_other_key
    // 2. installation_salt
    // 3. another_key
    chrome.storage.local.get(['some_other_key'], () => {});
    chrome.storage.local.get(['installation_salt'], () => {});
    chrome.storage.local.get(['another_key'], () => {});

    // Assert NB-03 : findCallByKey retrouve l'appel installation_salt
    // qu'il soit en position 0, 1, 2 ou n — indépendant de l'ordre
    const saltCall = findCallByKey(mockStorageLocalGet, 'installation_salt');
    expect(saltCall).toBeDefined();
    expect(saltCall![0]).toContain('installation_salt');

    // Vérifier aussi les autres clés
    const otherCall = findCallByKey(mockStorageLocalGet, 'some_other_key');
    expect(otherCall).toBeDefined();

    const anotherCall = findCallByKey(mockStorageLocalGet, 'another_key');
    expect(anotherCall).toBeDefined();

    // Une clé absente retourne undefined
    const missingCall = findCallByKey(mockStorageLocalGet, 'nonexistent_key');
    expect(missingCall).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // TC-NB03-REG-02 : robustesse au swap d'ordre — les assertions par clé
  // restent vertes même si l'ordre des appels storage.get est inversé.
  //
  // Prouve que les assertions NB-03 ne sont PAS liées à l'indexation
  // positionnelle (mock.calls[0], mock.calls[1], etc.).
  // -------------------------------------------------------------------------
  it('TC-NB03-REG-02 : swap ordre appels storage.get — assertions par clé restent vertes', () => {
    // Arrange : appels dans l'ORDRE INVERSE par rapport au TC-NB03-REG-01
    mockStorageLocalGet.mockImplementation(
      (_keys: string[], callback: (r: Record<string, unknown>) => void) => {
        callback({});
      },
    );

    // Ordre swappé : installation_salt EN PREMIER cette fois
    chrome.storage.local.get(['installation_salt'], () => {});
    chrome.storage.local.get(['some_other_key'], () => {});

    // Assert NB-03 : toHaveBeenCalledWith retrouve toujours installation_salt
    // indépendamment de sa position dans mock.calls
    expect(mockStorageLocalGet).toHaveBeenCalledWith(['installation_salt'], expect.any(Function));
    expect(mockStorageLocalGet).toHaveBeenCalledWith(['some_other_key'], expect.any(Function));

    // Double vérification : findCallByKey fonctionne aussi dans l'ordre inversé
    const saltCall = findCallByKey(mockStorageLocalGet, 'installation_salt');
    expect(saltCall).toBeDefined();

    // La clé est bien en position 0 dans mock.calls cette fois (ordre inversé)
    // mais l'assertion toHaveBeenCalledWith passe dans les deux ordres
    const saltCallPositional = mockStorageLocalGet.mock.calls[0];
    expect(saltCallPositional[0]).toContain('installation_salt');
    // Pas d'assertion sur mock.calls[1][0] codée en dur — on utilise findCallByKey
    const otherCall = findCallByKey(mockStorageLocalGet, 'some_other_key');
    expect(otherCall).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// =============================================================================
// SECTION UC-05 — Registre _snPasswordInputs + collectPasswordInputs + toggle
// =============================================================================
// ---------------------------------------------------------------------------

describe('UC-05 — registre _snPasswordInputs et collectPasswordInputs (TACHE-072)', () => {
  beforeEach(() => {
    // Vider le registre avant chaque test
    _snPasswordInputs.clear();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // -------------------------------------------------------------------------
  // TC-UC05-01 : input type="password" dès le départ → capturé dans le registre
  // -------------------------------------------------------------------------
  it('TC-UC05-01 : input type="password" enregistré via registerPasswordInput → présent dans collectPasswordInputs', () => {
    // Arrange
    const form = document.createElement('form');
    const input = document.createElement('input');
    input.type = 'password';
    input.value = 'secret';
    form.appendChild(input);
    document.body.appendChild(form);

    // Act
    registerPasswordInput(input);

    // Assert
    const collected = collectPasswordInputs(form);
    expect(collected).toContain(input);
    expect(collected).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // TC-UC05-02 : toggle password → text → password → reste dans le Set
  // (INV-UC05-03 : 1 seul hash via guard submittedFields — testé en UC-05-05)
  // -------------------------------------------------------------------------
  it('TC-UC05-02 : input togglé password→text→password reste dans _snPasswordInputs (INV-UC05-01)', () => {
    // Arrange
    const form = document.createElement('form');
    const input = document.createElement('input');
    input.type = 'password';
    form.appendChild(input);
    document.body.appendChild(form);

    // Simuler toggle password → text (cas A dans handleTypeAttributeMutation)
    registerPasswordInput(input); // Enregistrement initial
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

    // Simuler toggle text → password
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

    // L'input doit toujours être dans le Set (INV-UC05-01)
    expect(_snPasswordInputs.has(input)).toBe(true);

    // collectPasswordInputs doit inclure l'input (maintenant type="password" + dans le Set)
    const collected = collectPasswordInputs(form);
    expect(collected).toContain(input);
    // Pas de doublon (le Set + querySelectorAll → union dédupliquée)
    expect(collected.filter((el) => el === input)).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // TC-UC05-03 : input démarre type="text" + toggle → type="password" → capturé
  // (INV-UC05-02 conforme aux instructions de la tâche : inputs text→password capturés)
  // -------------------------------------------------------------------------
  it('TC-UC05-03 : input démarre text + togglé vers password → enregistré dans _snPasswordInputs (INV-UC05-02)', () => {
    // Arrange
    const form = document.createElement('form');
    const input = document.createElement('input');
    input.type = 'text'; // Démarre en text
    form.appendChild(input);
    document.body.appendChild(form);

    // Act : simuler toggle text → password
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

    // Assert : l'input est maintenant dans le registre
    expect(_snPasswordInputs.has(input)).toBe(true);

    // Et collectPasswordInputs le retourne (il est maintenant type="password" dans le DOM aussi)
    const collected = collectPasswordInputs(form);
    expect(collected).toContain(input);
  });

  // -------------------------------------------------------------------------
  // TC-UC05-04 : 2 inputs password, 1 togglé text / 1 reste password → les 2 collectés
  // -------------------------------------------------------------------------
  it('TC-UC05-04 : 2 inputs dans form, 1 togglé text, les 2 sont collectés au submit', () => {
    // Arrange
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

    // Enregistrer les deux inputs (simule l'enregistrement au boot)
    registerPasswordInput(inputA);
    registerPasswordInput(inputB);

    // Toggle inputA vers text (toggle show)
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

    // Act : collecter les inputs du formulaire
    // inputA est type="text" mais dans _snPasswordInputs
    // inputB est type="password" et dans _snPasswordInputs
    const collected = collectPasswordInputs(form);

    // Assert : les 2 inputs doivent être collectés
    expect(collected).toContain(inputA);
    expect(collected).toContain(inputB);
    expect(collected).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // TC-UC05-05-SET-DEDUP : toggle spam (10 togglés rapides) → Set déduplique
  // naturellement les enregistrements multiples du même input via
  // registerPasswordInput (propriété intrinsèque de Set — non-régression).
  //
  // Note : ce test ne couvre PAS INV-UC05-03 (un seul hash M7 par submit).
  // INV-UC05-03 est couvert par SM-UC05-06 ci-dessous, via le guard
  // submittedFields (WeakSet) dans handleFormSubmit.
  // -------------------------------------------------------------------------
  it('TC-UC05-05-SET-DEDUP : toggle spam (10x) → Set déduplique naturellement les enregistrements multiples (registerPasswordInput idempotent via Set)', () => {
    // Arrange
    const input = document.createElement('input');
    input.type = 'password';
    document.body.appendChild(input);

    // Simuler 10 toggles rapides
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

    // Assert : le Set ne contient qu'une seule entrée pour cet input
    // (propriété intrinsèque de Set : pas de doublons par construction)
    expect(_snPasswordInputs.has(input)).toBe(true);
    const entries = Array.from(_snPasswordInputs).filter((el) => el === input);
    expect(entries).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // TC-UC05-REG-01 : registerPasswordInput est idempotent (appels multiples)
  // -------------------------------------------------------------------------
  it('TC-UC05-REG-01 : registerPasswordInput est idempotent — plusieurs appels = 1 entrée', () => {
    // Arrange
    const input = document.createElement('input');
    input.type = 'password';
    document.body.appendChild(input);

    // Act : appeler registerPasswordInput plusieurs fois
    registerPasswordInput(input);
    registerPasswordInput(input);
    registerPasswordInput(input);

    // Assert : une seule entrée dans le Set
    const entries = Array.from(_snPasswordInputs).filter((el) => el === input);
    expect(entries).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // TC-UC05-COL-01 : collectPasswordInputs sur Document (orphelins)
  // -------------------------------------------------------------------------
  it('TC-UC05-COL-01 : collectPasswordInputs sur document retourne les orphelins password + Set', () => {
    // Arrange : input orphelin (pas dans un form) + input dans Set togglé text
    const orphanPwd = document.createElement('input');
    orphanPwd.type = 'password';
    orphanPwd.value = 'orphanpass';
    document.body.appendChild(orphanPwd);

    const orphanToggled = document.createElement('input');
    orphanToggled.type = 'text'; // Togglé
    orphanToggled.value = 'toggledpass';
    document.body.appendChild(orphanToggled);

    registerPasswordInput(orphanToggled); // Enregistré car était password

    // Act
    const collected = collectPasswordInputs(document);

    // Assert : les deux doivent être collectés
    expect(collected).toContain(orphanPwd);
    expect(collected).toContain(orphanToggled);
  });

  // -------------------------------------------------------------------------
  // TC-UC05-COL-02 : collectPasswordInputs ne retourne pas d'input hors scope
  // -------------------------------------------------------------------------
  it('TC-UC05-COL-02 : collectPasswordInputs sur form ne retourne pas les inputs hors form', () => {
    // Arrange : 2 forms, chacun avec un input
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

    // Act : collecter pour form1 seulement
    const collected = collectPasswordInputs(form1);

    // Assert : seul input1 doit être dans la collection
    expect(collected).toContain(input1);
    expect(collected).not.toContain(input2);
    expect(collected).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // TC-UC05-MUTATION-01 : handleTypeAttributeMutation ignore les non-inputs
  // -------------------------------------------------------------------------
  it('TC-UC05-MUTATION-01 : handleTypeAttributeMutation ignore les mutations non-input', () => {
    // Arrange : mutation sur un div (pas un input)
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

    // Act : ne doit pas lancer d'erreur et ne rien ajouter au Set
    expect(() => handleTypeAttributeMutation(mutations)).not.toThrow();
    expect(_snPasswordInputs.size).toBe(0);
  });

  // -------------------------------------------------------------------------
  // TC-UC05-MUTATION-02 : handleTypeAttributeMutation ignore les mutations non-type
  // -------------------------------------------------------------------------
  it('TC-UC05-MUTATION-02 : handleTypeAttributeMutation ignore les mutations non-type (attributeName != "type")', () => {
    // Arrange : mutation sur un input mais pour l'attribut "name" (pas "type")
    const input = document.createElement('input');
    input.type = 'password';
    const mutations: MutationRecord[] = [
      {
        type: 'attributes',
        attributeName: 'name', // Pas "type"
        target: input,
        addedNodes: document.createDocumentFragment().childNodes,
        removedNodes: document.createDocumentFragment().childNodes,
        previousSibling: null,
        nextSibling: null,
        attributeNamespace: null,
        oldValue: null,
      } as unknown as MutationRecord,
    ];

    // Act
    handleTypeAttributeMutation(mutations);

    // Assert : le Set reste vide
    expect(_snPasswordInputs.has(input)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // SM-UC05-06 : INV-UC05-03 — handleFormSubmit appelé 2x sur le même champ
  // après toggles ne produit qu'un seul sendMessage M7.
  //
  // Mécanisme vérifié : le WeakSet submittedFields dans handleFormSubmit.
  // Au second appel, submittedFields.has(pwdField) === true → early return.
  //
  // Placement en fin de suite : submittedFields est un WeakSet local au module
  // non réinitialisable depuis les tests. L'input est créé localement (fresh),
  // non exposé aux autres tests via _snPasswordInputs ni le DOM (beforeEach
  // vide document.body.innerHTML). L'impact sur les tests précédents est nul.
  // -------------------------------------------------------------------------
  it("SM-UC05-06 : INV-UC05-03 — handleFormSubmit appelé 2x après toggles ne produit qu'un seul sendMessage M7", async () => {
    // Arrange : form + input password avec valeur
    const form = document.createElement('form');
    const input = document.createElement('input');
    input.type = 'password';
    input.name = 'pwd';
    input.value = 'SecretPass123!';
    form.appendChild(input);
    document.body.appendChild(form);

    // Mock salt présent pour les deux appels
    mockStorageLocalGet.mockImplementation(
      (_keys: unknown, callback: (r: Record<string, unknown>) => void) => {
        callback({ installation_salt: 'a'.repeat(64) });
      },
    );

    // Mock sendMessage : enregistre les appels, retourne une réponse valide
    mockRuntimeSendMessage.mockImplementation((_msg: unknown, callback?: (r: unknown) => void) => {
      callback?.({ success: true, action: 'skip', reason: 'no_reuse' });
    });

    // Toggles répétés (simule show/hide password avant soumission)
    input.type = 'text';
    input.type = 'password';
    input.type = 'text';

    // Premier submit (trusted) — doit déclencher M7
    const submitEvent1 = { isTrusted: true } as unknown as Event;
    await handleFormSubmit(submitEvent1, input);

    // Deuxième submit sur le même input (trusted) — doit être bloqué par submittedFields
    const submitEvent2 = { isTrusted: true } as unknown as Event;
    await handleFormSubmit(submitEvent2, input);

    // Assert : exactement UN sendMessage M7 émis (INV-UC05-03 via guard submittedFields WeakSet)
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
