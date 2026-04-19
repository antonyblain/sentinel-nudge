/**
 * @file tests/unit/content-scripts/password-detector-uc05-spa.test.ts
 * @description Tests unitaires TC-UC05-05-SPA — détachement/re-render d'un input React/Vue.
 *
 * Contexte :
 *   Comité revue code TACHE-069/072 point C-06 : le scénario TC-UC05-05-SPA
 *   (détachement DOM + re-render React/Vue) n'avait pas de couverture test.
 *   Le mini-DAT TACHE-072 §6 l'identifie comme gap v1.
 *
 * Problème couvert :
 *   Un input[type="password"] observé peut être démonté (React unmount) puis
 *   re-monté avec un nouveau node DOM. Les listeners M7 attachés à l'ancien
 *   node deviennent orphelins. Le MutationObserver (observeDynamicForms) doit
 *   détecter le re-mount et enregistrer le nouveau node via registerPasswordInput.
 *
 * ARB-072-01 (rappel) :
 *   Pas de purge active du Set _snPasswordInputs sur removedNodes —
 *   l'ancien node reste dans le Set (rétention bornée au document).
 *   Le nouveau node est ajouté lors du remount via le MutationObserver callback.
 *
 * Scénarios :
 *   TC-UC05-05-SPA-01 : unmount + remount → nouveau node enregistré, pas de faux positif
 *   TC-UC05-05-SPA-02 : MutationObserver détecte le remount et ré-attache via registerPasswordInput
 *   TC-UC05-05-SPA-03 : submit sur nouveau node après remount → hash M7 correct
 *   TC-UC05-05-SPA-04 : 2 inputs React, 1 démonté → seul le restant dans le DOM est collecté
 *   TC-UC05-05-SPA-05 : toggle show/hide sur input démonté puis remonté → traitement différencié
 *   TC-UC05-05-SPA-06 : stress 10 cycles mount/unmount/mount → pas de fuite dans _snPasswordInputs
 *   TC-UC05-05-SPA-07 : input dans un portal React (ailleurs dans le DOM) → détecté par MutationObserver
 *
 * Environnement : jsdom (vitest)
 * Référence : TACHE-097 / mini-DAT TACHE-072 §6 / comité revue code C-06
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock chrome — DOIT être défini avant l'import du module testé
// Le mock empêche l'auto-exec de initPasswordDetector() (side-effects module-level)
// ---------------------------------------------------------------------------

const mockStorageLocalGet = vi
  .fn()
  .mockImplementation((_keys: unknown, callback: (r: Record<string, unknown>) => void) => {
    callback({ installation_salt: 'a'.repeat(64) });
  });
const mockStorageOnChangedAddListener = vi.fn();
const mockRuntimeSendMessage = vi
  .fn()
  .mockImplementation((_msg: unknown, callback?: (r: unknown) => void) => {
    callback?.({ success: true, action: 'skip', reason: 'no_reuse' });
  });

global.chrome = {
  storage: {
    local: {
      get: mockStorageLocalGet,
      set: vi.fn().mockImplementation((_items: unknown, callback?: () => void) => callback?.()),
      remove: vi.fn().mockImplementation((_keys: unknown, callback?: () => void) => callback?.()),
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
  i18n: { getMessage: vi.fn().mockReturnValue('') },
} as unknown as typeof chrome;

// ---------------------------------------------------------------------------
// Import du module après les mocks (NB-01 T-096)
// ---------------------------------------------------------------------------

import {
  _snPasswordInputs,
  registerPasswordInput,
  collectPasswordInputs,
  handleFormSubmit,
  observeDynamicForms,
} from '@/content-scripts/detectors/password-detector';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Crée un SubmitEvent simulé avec isTrusted = true.
 * handleFormSubmit ne lit que event.isTrusted.
 */
function createTrustedSubmitEvent(): SubmitEvent {
  return { isTrusted: true } as unknown as SubmitEvent;
}

/**
 * Simule un cycle React mount/unmount/mount :
 *   1. Crée et insère oldInput dans parent
 *   2. Retire oldInput du DOM (unmount)
 *   3. Crée newInput et l'insère dans parent (remount)
 *
 * @param parent - Conteneur DOM (form ou document.body)
 * @param value  - Valeur à placer dans les inputs
 * @returns { oldInput, newInput }
 */
function simulateReactRemount(
  parent: HTMLElement,
  value: string = 'TestPass!SPA1',
): { oldInput: HTMLInputElement; newInput: HTMLInputElement } {
  const oldInput = document.createElement('input');
  oldInput.type = 'password';
  oldInput.value = value;
  parent.appendChild(oldInput);

  // unmount — React retire le node du DOM
  oldInput.remove();

  // remount — React crée un nouveau node
  const newInput = document.createElement('input');
  newInput.type = 'password';
  newInput.value = value;
  parent.appendChild(newInput);

  return { oldInput, newInput };
}

/**
 * Construit un MutationRecord synthétique de type childList simulant
 * l'ajout d'un node directement par React (F-UC01-01).
 *
 * @param addedNode   - Node ajouté (input password)
 * @param removedNode - Node retiré (optionnel, pour simuler le swap)
 * @param target      - Nœud parent (document.body par défaut)
 */
function buildChildListRecord(
  addedNode: Node,
  removedNode?: Node,
  target: Node = document.body,
): MutationRecord {
  return {
    type: 'childList',
    target,
    addedNodes: [addedNode] as unknown as NodeList,
    removedNodes: removedNode
      ? ([removedNode] as unknown as NodeList)
      : ([] as unknown as NodeList),
    previousSibling: null,
    nextSibling: null,
    attributeName: null,
    attributeNamespace: null,
    oldValue: null,
  } as unknown as MutationRecord;
}

/**
 * Filtre les appels sendMessage M7 password_submitted.
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
// Suite TC-UC05-05-SPA
// ---------------------------------------------------------------------------

describe('TC-UC05-05-SPA — Détachement/re-render input React/Vue (TACHE-097 C-06)', () => {
  /** Callback MutationObserver capturé par le mock */
  let capturedCallback: MutationCallback | null = null;
  let observeSpy: ReturnType<typeof vi.fn>;
  let disconnectSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // NB-01 T-096 : reset complet avant chaque test
    _snPasswordInputs.clear();
    document.body.innerHTML = '';
    vi.clearAllMocks();

    // Réinitialiser le salt mock après clearAllMocks
    mockStorageLocalGet.mockImplementation(
      (_keys: unknown, callback: (r: Record<string, unknown>) => void) => {
        callback({ installation_salt: 'a'.repeat(64) });
      },
    );
    mockRuntimeSendMessage.mockImplementation((_msg: unknown, callback?: (r: unknown) => void) => {
      callback?.({ success: true, action: 'skip', reason: 'no_reuse' });
    });

    // Mock MutationObserver pour capturer le callback injecté par observeDynamicForms()
    capturedCallback = null;
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
  // TC-UC05-05-SPA-01 : unmount + remount → nouveau node enregistré
  // ARB-072-01 : l'ancien node reste dans le Set (pas de purge active)
  // Le nouveau node est ajouté par le MutationObserver callback
  // -------------------------------------------------------------------------
  it(
    'TC-UC05-05-SPA-01 : input password monté → registered → unmount → remount nouveau node' +
      ' → nouveau node enregistré, ancien node absent du DOM mais toujours dans Set (ARB-072-01)',
    () => {
      // Arrange : démarrer l'observation
      observeDynamicForms();
      expect(capturedCallback).not.toBeNull();

      // Simuler le mount initial : React insère un input
      const oldInput = document.createElement('input');
      oldInput.type = 'password';
      oldInput.value = 'OldPass!SPA01';
      document.body.appendChild(oldInput);

      // Enregistrement initial via registerPasswordInput (comme le ferait observeDynamicForms)
      registerPasswordInput(oldInput);
      expect(_snPasswordInputs.has(oldInput)).toBe(true);

      // Act : unmount — React retire l'ancien node
      oldInput.remove();
      expect(document.body.contains(oldInput)).toBe(false);

      // Remount — React insère un nouveau node (node différent)
      const newInput = document.createElement('input');
      newInput.type = 'password';
      newInput.value = 'OldPass!SPA01'; // même valeur, nouveau node
      document.body.appendChild(newInput);

      // Simuler le MutationObserver qui détecte le remount
      const remountMutation = buildChildListRecord(newInput, oldInput);
      capturedCallback!([remountMutation], {} as MutationObserver);

      // Assert
      // Nouveau node enregistré dans _snPasswordInputs
      expect(_snPasswordInputs.has(newInput)).toBe(true);
      // Nouveau node présent dans le DOM
      expect(document.body.contains(newInput)).toBe(true);
      // Ancien node toujours dans le Set (ARB-072-01 — pas de purge active)
      expect(_snPasswordInputs.has(oldInput)).toBe(true);
      // Ancien node absent du DOM
      expect(document.body.contains(oldInput)).toBe(false);
      // Pas de faux positif : collectPasswordInputs ne collecte PAS l'ancien (hors DOM)
      const collected = collectPasswordInputs(document);
      expect(collected).toContain(newInput);
      expect(collected).not.toContain(oldInput);
    },
  );

  // -------------------------------------------------------------------------
  // TC-UC05-05-SPA-02 : MutationObserver détecte le remount et ré-attache
  // via registerPasswordInput (chemin F-UC01-01 — nœud racine ajouté directement)
  // -------------------------------------------------------------------------
  it(
    'TC-UC05-05-SPA-02 : MutationObserver childList callback sur remount' +
      ' → registerPasswordInput appelé pour le nouveau node (F-UC01-01)',
    () => {
      // Arrange
      observeDynamicForms();
      expect(capturedCallback).not.toBeNull();

      const newInput = document.createElement('input');
      newInput.type = 'password';
      newInput.value = 'NewPass!SPA02';
      document.body.appendChild(newInput);

      // Vérification pré-condition : pas encore enregistré
      expect(_snPasswordInputs.has(newInput)).toBe(false);

      // Act : simuler un MutationRecord childList avec addedNodes = [newInput] (nœud racine React)
      const mutation = buildChildListRecord(newInput);
      capturedCallback!([mutation], {} as MutationObserver);

      // Assert : le nouveau node doit être dans _snPasswordInputs
      expect(_snPasswordInputs.has(newInput)).toBe(true);
      // observeSpy appelé lors de l'initialisation de observeDynamicForms
      expect(observeSpy).toHaveBeenCalledWith(
        expect.any(Node),
        expect.objectContaining({ childList: true, subtree: true }),
      );
    },
  );

  // -------------------------------------------------------------------------
  // TC-UC05-05-SPA-03 : submit sur nouveau node après remount → hash M7 correct
  // Vérifie que handleFormSubmit produit un payload hash valide (INV-UC01-02)
  // sur un input issu d'un remount React
  // -------------------------------------------------------------------------
  it(
    'TC-UC05-05-SPA-03 : submit sur nouveau node après remount React' +
      ' → M7 sendMessage appelé 1 fois, payload hash présent, pas de password en clair',
    async () => {
      // Arrange : simuler un cycle unmount/remount
      observeDynamicForms();

      const form = document.createElement('form');
      document.body.appendChild(form);

      const { newInput } = simulateReactRemount(form, 'RemountPass!SPA03');

      // Enregistrement du nouveau node (comme le ferait le MutationObserver)
      registerPasswordInput(newInput);
      expect(_snPasswordInputs.has(newInput)).toBe(true);

      const event = createTrustedSubmitEvent();

      // Act
      await handleFormSubmit(event, newInput);

      // Assert : sendMessage M7 appelé exactement 1 fois
      const m7Calls = getM7Calls();
      expect(m7Calls).toHaveLength(1);

      // INV-UC01-02 : pas de mot de passe en clair dans le payload
      const payload = (m7Calls[0]![0] as Record<string, unknown>)['payload'] as Record<
        string,
        unknown
      >;
      expect(payload).toHaveProperty('hash');
      expect(payload).toHaveProperty('domain_hash');
      expect(payload).not.toHaveProperty('password');
      expect(payload).not.toHaveProperty('value');

      // Le hash doit être une chaîne hexadécimale non vide
      expect(typeof payload['hash']).toBe('string');
      expect((payload['hash'] as string).length).toBeGreaterThan(0);
    },
  );

  // -------------------------------------------------------------------------
  // TC-UC05-05-SPA-04 : 2 inputs React, 1 démonté → seul le restant est collecté
  // collectPasswordInputs filtre via scope.contains() — exclut les nodes hors DOM
  // -------------------------------------------------------------------------
  it(
    'TC-UC05-05-SPA-04 : form React avec 2 inputs password — 1 input démonté' +
      ' → collectPasswordInputs retourne uniquement le restant (node encore dans le DOM)',
    () => {
      // Arrange : 2 inputs dans un form React
      observeDynamicForms();

      const form = document.createElement('form');
      document.body.appendChild(form);

      const inputA = document.createElement('input');
      inputA.type = 'password';
      inputA.value = 'PassA!SPA04';
      form.appendChild(inputA);

      const inputB = document.createElement('input');
      inputB.type = 'password';
      inputB.value = 'PassB!SPA04';
      form.appendChild(inputB);

      // Enregistrer les deux
      registerPasswordInput(inputA);
      registerPasswordInput(inputB);

      expect(_snPasswordInputs.has(inputA)).toBe(true);
      expect(_snPasswordInputs.has(inputB)).toBe(true);

      // Act : unmount inputA (React le retire du DOM)
      inputA.remove();

      // Assert : collectPasswordInputs ne collecte que inputB (encore dans le DOM)
      const collected = collectPasswordInputs(form);
      expect(collected).toContain(inputB);
      expect(collected).not.toContain(inputA);
      expect(collected).toHaveLength(1);

      // inputA est toujours dans le Set (ARB-072-01), mais filtré par scope.contains()
      expect(_snPasswordInputs.has(inputA)).toBe(true);
    },
  );

  // -------------------------------------------------------------------------
  // TC-UC05-05-SPA-05 : toggle show/hide sur input démonté puis remonté
  // Vérifie que le toggle (type=password→text) sur le nouveau node est capturé
  // indépendamment de l'ancien node démonté
  // -------------------------------------------------------------------------
  it(
    'TC-UC05-05-SPA-05 : toggle show/hide (type=password→text→password) sur input démonté' +
      ' puis remonté → nouveau node enregistré, toggle sur nouveau node traité différemment',
    () => {
      // Arrange
      observeDynamicForms();
      expect(capturedCallback).not.toBeNull();

      const oldInput = document.createElement('input');
      oldInput.type = 'password';
      oldInput.value = 'OldToggle!SPA05';
      document.body.appendChild(oldInput);
      registerPasswordInput(oldInput);

      // Unmount de l'ancien
      oldInput.remove();

      // Remount d'un nouveau node
      const newInput = document.createElement('input');
      newInput.type = 'password';
      newInput.value = 'NewToggle!SPA05';
      document.body.appendChild(newInput);

      // MutationObserver détecte le remount
      const remountMutation = buildChildListRecord(newInput, oldInput);
      capturedCallback!([remountMutation], {} as MutationObserver);

      expect(_snPasswordInputs.has(newInput)).toBe(true);

      // Act : toggle show/hide sur le NOUVEAU node (type=password → text)
      newInput.type = 'text';
      const toggleMutation: MutationRecord = {
        type: 'attributes',
        attributeName: 'type',
        target: newInput,
        addedNodes: [] as unknown as NodeList,
        removedNodes: [] as unknown as NodeList,
        previousSibling: null,
        nextSibling: null,
        attributeNamespace: null,
        oldValue: 'password',
      } as unknown as MutationRecord;
      capturedCallback!([toggleMutation], {} as MutationObserver);

      // Assert : newInput toujours dans le Set après toggle
      expect(_snPasswordInputs.has(newInput)).toBe(true);

      // collectPasswordInputs via _snPasswordInputs doit retourner newInput
      // (il est togglé en text mais reste dans le registre — INV-UC05-01)
      const collected = collectPasswordInputs(document);
      expect(collected).toContain(newInput);
      // L'ancien node démonté n'est pas collecté (hors DOM)
      expect(collected).not.toContain(oldInput);

      // Toggle retour : text → password sur le nouveau node
      newInput.type = 'password';
      const toggleBackMutation: MutationRecord = {
        type: 'attributes',
        attributeName: 'type',
        target: newInput,
        addedNodes: [] as unknown as NodeList,
        removedNodes: [] as unknown as NodeList,
        previousSibling: null,
        nextSibling: null,
        attributeNamespace: null,
        oldValue: 'text',
      } as unknown as MutationRecord;
      capturedCallback!([toggleBackMutation], {} as MutationObserver);

      // Nouveau node toujours enregistré après retour en password
      expect(_snPasswordInputs.has(newInput)).toBe(true);
    },
  );

  // -------------------------------------------------------------------------
  // TC-UC05-05-SPA-06 : stress 10 cycles mount/unmount/mount
  // Vérifie que le Set _snPasswordInputs grandit de façon bornée et cohérente
  // ARB-072-01 : les anciens nodes restent dans le Set (rétention document-scoped)
  // La croissance est linéaire (N+1 nodes par cycle) — pas de fuite exponentielle
  // -------------------------------------------------------------------------
  it(
    'TC-UC05-05-SPA-06 : stress 10 cycles mount/unmount/mount' +
      ' → _snPasswordInputs contient exactement 10 new nodes (croissance linéaire, pas de doublon)',
    () => {
      // Arrange
      observeDynamicForms();
      expect(capturedCallback).not.toBeNull();

      const CYCLES = 10;
      const mountedInputs: HTMLInputElement[] = [];

      // Act : 10 cycles de mount/unmount/remount
      for (let i = 0; i < CYCLES; i++) {
        // Créer le node "courant" et l'enregistrer
        const input = document.createElement('input');
        input.type = 'password';
        input.value = `StressPass!${i}`;

        // Simuler le MutationObserver qui le détecte au mount
        document.body.appendChild(input);
        const mountMutation = buildChildListRecord(input);
        capturedCallback!([mountMutation], {} as MutationObserver);

        mountedInputs.push(input);

        // Unmount (mais pas purge du Set — ARB-072-01)
        input.remove();
      }

      // Assert : exactement CYCLES nodes dans le Set (un par cycle, pas de doublon)
      // Chaque node est unique (nouvel élément DOM créé à chaque itération)
      expect(_snPasswordInputs.size).toBe(CYCLES);

      // Tous les nodes créés sont dans le Set
      for (const input of mountedInputs) {
        expect(_snPasswordInputs.has(input)).toBe(true);
      }

      // Aucun des nodes n'est dans le DOM (tous démontés)
      for (const input of mountedInputs) {
        expect(document.body.contains(input)).toBe(false);
      }

      // collectPasswordInputs retourne 0 nodes (tous hors DOM)
      const collected = collectPasswordInputs(document);
      expect(collected).toHaveLength(0);
    },
  );

  // -------------------------------------------------------------------------
  // TC-UC05-05-SPA-07 : input password dans un portal React
  // Un portal React peut attacher un node ailleurs dans le DOM (ex: document.body
  // au lieu du parent logique). observeDynamicForms observe {subtree:true} sur
  // document.body → détecte le portal si l'insertion se fait sous body.
  // -------------------------------------------------------------------------
  it(
    'TC-UC05-05-SPA-07 : input password inséré dans un portal React (sous document.body)' +
      ' → détecté par MutationObserver avec observe(document.body, {subtree:true})',
    () => {
      // Arrange : démarrer l'observation
      observeDynamicForms();
      expect(capturedCallback).not.toBeNull();

      // Vérifier que observeSpy a été appelé avec subtree:true
      expect(observeSpy).toHaveBeenCalledWith(
        expect.any(Node),
        expect.objectContaining({ subtree: true }),
      );

      // Simuler un portal React : un div conteneur créé hors de tout form,
      // attaché directement à document.body (pattern portal)
      const portalContainer = document.createElement('div');
      portalContainer.id = 'react-portal-root';
      document.body.appendChild(portalContainer);

      const portalInput = document.createElement('input');
      portalInput.type = 'password';
      portalInput.value = 'PortalPass!SPA07';
      portalContainer.appendChild(portalInput);

      // Le MutationObserver (subtree:true) détecte l'insertion dans le portal
      // Le node portalInput est un descendant de document.body → capturé
      // F-UC01-01 : on simule le cas où l'input est l'addedNode racine du record
      const portalMutation = buildChildListRecord(portalInput, undefined, portalContainer);
      capturedCallback!([portalMutation], {} as MutationObserver);

      // Assert : l'input du portal est enregistré dans _snPasswordInputs
      expect(_snPasswordInputs.has(portalInput)).toBe(true);

      // collectPasswordInputs via document scope le trouve (il est dans le DOM)
      const collected = collectPasswordInputs(document);
      expect(collected).toContain(portalInput);
    },
  );
});
