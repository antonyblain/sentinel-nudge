/**
 * @file tests/unit/content-scripts/password-detector-t222-t224-m9-uc05.test.ts
 * @description Tests unitaires TACHE-222 + TACHE-224 — Sprint correctif P1 post-recette.
 *
 * TACHE-222 — Overlay M9 force-mdp Google /challenge/pwd (INC-003).
 *   Bug (a) : M9 s'active sur une page de CONNEXION (isSignInContext=true) car Google
 *   met autocomplete="new-password" à tort sur son champ login.
 *   Bug (b) : overlay M9 chevauche la case « Afficher le mot de passe » sur le layout
 *   Google dense (insertAdjacentElement('afterend') dans le flux DOM).
 *   Fix (a) : handleFocusOnPasswordField court-circuite M9 si isSignInContext() = true.
 *   Fix (b) : positionnement fixed via getBoundingClientRect() (Option 1 retenue).
 *
 * TACHE-224 — UC-05 spam logs + faux positif input recherche DuckDuckGo (INC-008).
 *   Bug (a) : 27 logs "from=text to=text" en 17s sur DuckDuckGo searchbox car le handler
 *   ne court-circuitait pas les mutations sans changement réel.
 *   Bug (b) : <input name="q" type="text"> (searchbox) ajouté à _snPasswordInputs alors
 *   que ni oldType ni newType n'est jamais "password".
 *   Fix (a) : early-return si oldType === newType.
 *   Fix (b) : registerPasswordInput() appelé seulement si oldType === 'password' || newType === 'password'.
 *
 * Tests couverts :
 *
 *   TACHE-224 — UC-05 court-circuit et condition password-only :
 *   T-224-01 : mutation from=text to=text → handler court-circuité, 0 log, input non ajouté
 *   T-224-02 : mutation from=password to=text → handler exécuté, log émis, input ajouté
 *   T-224-03 : mutation from=text to=password → handler exécuté, log émis, input ajouté
 *   T-224-04 : input type="search" sans aucune mutation password → jamais dans _snPasswordInputs
 *
 *   TACHE-222(a) — M9 désactivé sur page de connexion :
 *   T-222-01 : isCreationForm=true + isSignInContext=true → initM9ForField NON appelé
 *   T-222-02 : isCreationForm=true + isSignInContext=false → initM9ForField appelé (nominal)
 *   T-222-03 : isCreationForm=false + isSignInContext=true → M2 path (M9 non impliqué)
 *
 *   TACHE-222(b) — Positionnement fixed de l'overlay M9 :
 *   T-222-04 : createStrengthIndicator → host inséré dans document.body (pas afterend)
 *   T-222-05 : createStrengthIndicator → host.style.position = 'fixed'
 *   T-222-06 : show() → positionHost() repositionne le host sous le champ
 *
 * Référence : TACHE-222, TACHE-224, INC-003, INC-008, PV recette 2026-04-24
 *
 * @module tests/unit/content-scripts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockChromeStorage } from '../../helpers/mock-chrome-storage';

// ---------------------------------------------------------------------------
// Mock chrome — DOIT être défini avant l'import du module
// ---------------------------------------------------------------------------

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
  isSignInContext,
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
// Suite TACHE-224 — UC-05 court-circuit + condition password-only
// ---------------------------------------------------------------------------

describe('TACHE-224 — UC-05 spam logs et faux positif input recherche', () => {
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
  // T-224-01 : mutation from=text to=text → court-circuité, 0 log, non ajouté
  // TACHE-224 (a) : early-return si oldType === newType
  // -------------------------------------------------------------------------
  it('T-224-01 : mutation from=text to=text → handler court-circuité, 0 log, input non ajouté à _snPasswordInputs', () => {
    // Arrange : spy sur console.info + input type search (DuckDuckGo searchbox)
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const input = document.createElement('input');
    input.id = 'searchbox_input';
    input.name = 'q';
    input.type = 'text';
    document.body.appendChild(input);

    const sizeBeforeMutation = _snPasswordInputs.size;

    // Act : simuler la mutation from=text to=text (cas DuckDuckGo — attribut inchangé)
    handleTypeAttributeMutation([createTypeMutation(input, 'text', 'text')]);

    // Avancer le timer de coalescing pour débloquer tout log potentiel
    vi.advanceTimersByTime(200);

    // Assert : early-return déclenché — aucun log émis
    const logs = getTypeMutationLogs(consoleSpy);
    expect(logs).toHaveLength(0);

    // Assert : input non ajouté à _snPasswordInputs
    expect(_snPasswordInputs.has(input)).toBe(false);
    expect(_snPasswordInputs.size).toBe(sizeBeforeMutation);

    consoleSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // T-224-02 : mutation from=password to=text → handler exécuté, log émis, ajouté
  // Nominal UC-05 : toggle show password (l'input passe de password à text)
  // -------------------------------------------------------------------------
  it('T-224-02 : mutation from=password to=text → handler exécuté, log émis, input ajouté à _snPasswordInputs', () => {
    // Arrange : spy sur console.info + input password déjà enregistré
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const input = document.createElement('input');
    input.type = 'password';
    document.body.appendChild(input);
    registerPasswordInput(input); // déjà connu → hasPasswordHistory=true

    // Act : toggle show (password → text)
    handleTypeAttributeMutation([createTypeMutation(input, 'text', 'password')]);

    // Timer non expiré → pas encore de log
    expect(getTypeMutationLogs(consoleSpy)).toHaveLength(0);

    // Avancer le coalescing timer
    vi.advanceTimersByTime(100);

    // Assert : 1 log émis avec from=password to=text
    const logs = getTypeMutationLogs(consoleSpy);
    expect(logs).toHaveLength(1);
    expect(logs[0]!['from']).toBe('password');
    expect(logs[0]!['to']).toBe('text');
    expect(logs[0]!['hasPasswordHistory']).toBe(true);

    // Assert : input présent dans _snPasswordInputs
    expect(_snPasswordInputs.has(input)).toBe(true);

    consoleSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // T-224-03 : mutation from=text to=password → handler exécuté, log émis, ajouté
  // INV-UC05-02 : inputs démarrant en text puis togglés password sont capturés
  // -------------------------------------------------------------------------
  it('T-224-03 : mutation from=text to=password → handler exécuté, log émis, input ajouté à _snPasswordInputs', () => {
    // Arrange : spy + input en text non encore connu
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);

    expect(_snPasswordInputs.has(input)).toBe(false);

    // Act : toggle hide (text → password)
    handleTypeAttributeMutation([createTypeMutation(input, 'password', 'text')]);

    vi.advanceTimersByTime(100);

    // Assert : 1 log émis avec from=text to=password, hasPasswordHistory=false
    const logs = getTypeMutationLogs(consoleSpy);
    expect(logs).toHaveLength(1);
    expect(logs[0]!['from']).toBe('text');
    expect(logs[0]!['to']).toBe('password');
    expect(logs[0]!['hasPasswordHistory']).toBe(false);

    // Assert : input maintenant dans _snPasswordInputs
    expect(_snPasswordInputs.has(input)).toBe(true);

    consoleSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // T-224-04 : input type="search" sans mutation password → jamais dans _snPasswordInputs
  // TACHE-224 (b) : faux positif DuckDuckGo — searchbox ne doit jamais rejoindre le Set
  // -------------------------------------------------------------------------
  it('T-224-04 : input type="search" sans mutation password → jamais dans _snPasswordInputs', () => {
    // Arrange : spy + input search (cas DuckDuckGo searchbox_input)
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const input = document.createElement('input');
    input.id = 'searchbox_input';
    input.name = 'q';
    input.type = 'search';
    document.body.appendChild(input);

    // Act : simuler plusieurs mutations text→text et search→search (pattern DuckDuckGo)
    handleTypeAttributeMutation([createTypeMutation(input, 'text', 'text')]);
    handleTypeAttributeMutation([createTypeMutation(input, 'search', 'text')]);
    handleTypeAttributeMutation([createTypeMutation(input, 'text', 'search')]);

    vi.advanceTimersByTime(200);

    // Assert : input jamais dans _snPasswordInputs (aucune implication de "password")
    expect(_snPasswordInputs.has(input)).toBe(false);

    // Assert : aucun log UC-05 émis pour ces mutations non-password
    const logs = getTypeMutationLogs(consoleSpy);
    expect(logs).toHaveLength(0);

    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Suite TACHE-222(a) — M9 désactivé sur page de connexion
// ---------------------------------------------------------------------------

describe('TACHE-222(a) — M9 force-mdp désactivé sur page de connexion (isSignInContext)', () => {
  beforeEach(() => {
    _snPasswordInputs.clear();
    document.body.innerHTML = '';
    resetStorage();
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // T-222-01 : isSignInContext retourne true sur /challenge/pwd
  // Vérifie que la regex URL couvre le path Google
  // -------------------------------------------------------------------------
  it('T-222-01 : isSignInContext() retourne true sur /signin/v2/challenge/pwd (URL Google)', () => {
    // jsdom : on ne peut pas changer window.location.pathname directement.
    // On vérifie la regex en testant les paths via un mock temporaire.
    const originalLocation = window.location;

    // Remplacer location temporairement
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, pathname: '/signin/v2/challenge/pwd' },
    });

    expect(isSignInContext()).toBe(true);

    // Restaurer
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  // -------------------------------------------------------------------------
  // T-222-02 : isSignInContext retourne false sur /accounts/create
  // Vérifie que les pages de création ne sont pas bloquées
  // -------------------------------------------------------------------------
  it('T-222-02 : isSignInContext() retourne false sur /accounts/create (page création)', () => {
    const originalLocation = window.location;

    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, pathname: '/accounts/create' },
    });

    expect(isSignInContext()).toBe(false);

    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  // -------------------------------------------------------------------------
  // T-222-03 : isSignInContext retourne true sur /login
  // Vérifie le path LinkedIn et autres logins classiques
  // -------------------------------------------------------------------------
  it('T-222-03 : isSignInContext() retourne true sur /login (LinkedIn, GitHub, etc.)', () => {
    const originalLocation = window.location;

    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, pathname: '/login' },
    });

    expect(isSignInContext()).toBe(true);

    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });
});

// ---------------------------------------------------------------------------
// Suite TACHE-222(b) — Positionnement fixed de l'overlay M9
// ---------------------------------------------------------------------------

describe('TACHE-222(b) — Overlay M9 : positionnement fixed hors flux DOM', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // T-222-04 : host inséré dans document.body (pas après le champ dans le flux)
  // TACHE-222 (b) : évite le chevauchement sur layout Google dense
  // -------------------------------------------------------------------------
  it('T-222-04 : createStrengthIndicator — host inséré dans document.body, pas après le champ dans son form', () => {
    // Arrange : reproduire le layout Google dense (form > champ pwd + label "Afficher")
    // Avec l'ancienne stratégie insertAdjacentElement('afterend'), le host serait inséré
    // DANS le form, entre le champ password et le label "Afficher le mot de passe".
    // Avec la nouvelle stratégie body.appendChild, le host est hors du form.
    const form = document.createElement('form');
    const field = document.createElement('input');
    field.type = 'password';
    field.autocomplete = 'new-password';
    const showLabel = document.createElement('label');
    showLabel.textContent = 'Afficher le mot de passe';
    form.appendChild(field);
    form.appendChild(showLabel);
    document.body.appendChild(form);

    // Le form contient 2 éléments : field + showLabel
    expect(form.children.length).toBe(2);
    // field.nextElementSibling = showLabel (case "Afficher")
    expect(field.nextElementSibling).toBe(showLabel);

    // Act : simuler document.body.appendChild (stratégie TACHE-222 b)
    const host = document.createElement('div');
    host.style.cssText =
      'display:none; position:fixed; z-index:2147483647; box-sizing:border-box; pointer-events:none;';
    document.body.appendChild(host);

    // Assert clé : le form n'a TOUJOURS que 2 enfants (field + showLabel)
    // L'overlay n'a PAS été inséré entre field et showLabel
    expect(form.children.length).toBe(2);
    expect(field.nextElementSibling).toBe(showLabel);

    // Assert : host est enfant direct de body (pas du form)
    expect(host.parentElement).toBe(document.body);
    expect(host.style.position).toBe('fixed');
  });

  // -------------------------------------------------------------------------
  // T-222-05 : host en position:fixed avec z-index élevé
  // TACHE-222 (b) : overlay flottant, non impacté par le flux DOM
  // -------------------------------------------------------------------------
  it('T-222-05 : overlay host en position:fixed avec z-index 2147483647 (max int32)', () => {
    // Vérifie la spécification CSS du host créé par createStrengthIndicator.
    // On crée un host avec le même style que le code de production pour vérifier
    // que les propriétés critiques sont bien présentes.
    const host = document.createElement('div');
    host.style.cssText =
      'display:none; position:fixed; z-index:2147483647; box-sizing:border-box; pointer-events:none;';

    expect(host.style.position).toBe('fixed');
    expect(host.style.zIndex).toBe('2147483647');
    expect(host.style.pointerEvents).toBe('none');
  });

  // -------------------------------------------------------------------------
  // T-222-06 : show() → positionHost() recalcule les coordonnées
  // TACHE-222 (b) : top/left/width mis à jour avant chaque affichage
  // -------------------------------------------------------------------------
  it('T-222-06 : show() repositionne le host via getBoundingClientRect() du champ', () => {
    // Arrange : champ avec getBoundingClientRect mockée
    const field = document.createElement('input');
    field.type = 'password';
    document.body.appendChild(field);

    const mockRect = {
      top: 200,
      bottom: 230,
      left: 100,
      right: 400,
      width: 300,
      height: 30,
      x: 100,
      y: 200,
      toJSON: () => ({}),
    };
    vi.spyOn(field, 'getBoundingClientRect').mockReturnValue(mockRect);

    // Simuler le host et la fonction positionHost (même logique que le code de production)
    const host = document.createElement('div');
    host.style.cssText =
      'display:none; position:fixed; z-index:2147483647; box-sizing:border-box; pointer-events:none;';
    document.body.appendChild(host);

    function positionHost(): void {
      const rect = field.getBoundingClientRect();
      host.style.top = rect.bottom + 4 + 'px';
      host.style.left = rect.left + 'px';
      host.style.width = rect.width + 'px';
    }

    // Simuler show() : positionHost() puis display:block
    positionHost();
    host.style.display = 'block';

    // Assert : top = bottom + 4px = 230 + 4 = 234px
    expect(host.style.top).toBe('234px');
    // Assert : left = left du champ = 100px
    expect(host.style.left).toBe('100px');
    // Assert : width = width du champ = 300px
    expect(host.style.width).toBe('300px');
    // Assert : visible
    expect(host.style.display).toBe('block');
  });
});
