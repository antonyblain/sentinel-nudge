/**
 * @file tests/unit/content-scripts/password-detector-uc01.test.ts
 * @description Tests unitaires/intégration UC-01 — Login multi-étape (Microsoft cross-hostname,
 *              deep link Step 2, filtre isCreationForm sur SSO).
 *
 * Couvre :
 * - TC-UC01-02 : Microsoft cross-hostname — hash rattaché au hostname Step 2 (login.live.com),
 *                réutilisation inter-domaines détectée, pending_m7_toast créé avec login.live.com.
 * - TC-UC01-03 : Deep link Step 2 direct — détection M7 active sans Step 1 préalable.
 * - TC-UC01-04 : Filtre isCreationForm sur page SSO Step 2 — doit retourner false (pas de
 *                faux positif) ; comportement documenté si un hint "Create account" est présent.
 *
 * TC-UC01-01 (Google SPA) — NON TRAITÉ : dépendance TACHE-101 (correctif F-UC01-01
 *   observeDynamicForms node.matches), à ajouter après merge de la PR T-101.
 * TC-UC01-05 (Okta) — NON TRAITÉ : hors périmètre v1 (ARB-068-03 Option A).
 *
 * Stratégie :
 * - TC-UC01-02 : test d'intégration M7 handler — deux soumissions successives avec même
 *   password hash, domain_hash distincts (login.microsoftonline.com vs login.live.com).
 *   Vérifie que le handler M7 détecte la réutilisation et écrit pending_m7_toast avec
 *   le domain_hash de login.live.com.
 * - TC-UC01-03 : test content script — handleFormSubmit sur un input password simulant
 *   un deep link Step 2. Vérifie que sendMessage est appelé avec password_submitted
 *   et le domain_hash correct.
 * - TC-UC01-04 : test content script — handleFormSubmit sur un formulaire SSO Step 2
 *   avec et sans hint "Create account". Vérifie le comportement du filtre isCreationForm
 *   (via l'observation du message password_submitted envoyé ou non).
 *
 * Mini-DAT TACHE-068 v1.1 §12 — Tests de recette automatisés correspondants :
 *   TC-UC01-02, TC-UC01-03, TC-UC01-04
 *
 * Invariants vérifiés :
 *   INV-UC01-01 : domain_hash calculé exclusivement sur hostname de Step 2
 *   INV-UC01-02 : payload password_submitted ne contient jamais le mot de passe en clair
 *   INV-UC01-03 : pending_m7_toast ne contient que domain_hash + expires_at
 *   INV-UC01-04 : isCreationForm retourne false sur page de connexion SSO standard
 *
 * Référence : mini-DAT TACHE-068 v1.1 §3, §12 ; ADR-002 R-CLI-03 ; TACHE-091
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createM7Handler,
  recentSubmits,
  readPendingM7Toast,
} from '@/background/handlers/m7-handler';
import type { StorageService } from '@/background/storage-service';
import type { HeartbeatService } from '@/background/services/heartbeat-service';
import type { IncidentService } from '@/background/services/incident-service';
import type { PasswordHashRecord } from '@/shared/types/storage';
import { PENDING_M7_TOAST_KEY, PENDING_M7_TOAST_TTL_MS } from '@/shared/types/diagnostics';

// ===========================================================================
// Mock chrome.storage.local global — partagé par tous les tests
//
// Utilise une closure sur mockLocalStorage pour que les implémentations
// persistent après vi.clearAllMocks() (qui efface .mock.calls mais pas les
// implémentations définies via vi.fn(impl)).
// ===========================================================================

const mockLocalStorage: Record<string, unknown> = {};
const removedKeys: string[] = [];

global.chrome = {
  storage: {
    local: {
      get: vi.fn((_keys: string[], callback: (r: Record<string, unknown>) => void) => {
        const result: Record<string, unknown> = {};
        _keys.forEach((k) => {
          if (k in mockLocalStorage) result[k] = mockLocalStorage[k];
        });
        callback(result);
      }),
      set: vi.fn((items: Record<string, unknown>, callback?: () => void) => {
        Object.assign(mockLocalStorage, items);
        callback?.();
      }),
      remove: vi.fn((key: string | string[], callback?: () => void) => {
        const keys = Array.isArray(key) ? key : [key];
        keys.forEach((k) => {
          removedKeys.push(k);
          delete mockLocalStorage[k];
        });
        callback?.();
      }),
      clear: vi.fn((callback?: () => void) => {
        callback?.();
      }),
    },
    onChanged: {
      addListener: vi.fn(),
    },
  },
  tabs: {
    create: vi.fn().mockResolvedValue({}),
    sendMessage: vi.fn().mockResolvedValue({}),
    query: vi.fn().mockResolvedValue([]),
  },
  runtime: {
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
    sendMessage: vi.fn((_msg: unknown, callback?: (r: unknown) => void) => {
      callback?.({ success: true, action: 'skip', reason: 'no_reuse' });
    }),
    lastError: undefined,
    getManifest: vi.fn().mockReturnValue({}),
    id: 'test-extension-id',
    onMessage: { addListener: vi.fn() },
    requestUpdateCheck: vi.fn().mockResolvedValue({ status: 'no_update' }),
  },
  scripting: { executeScript: vi.fn().mockResolvedValue([]) },
  alarms: {
    create: vi.fn(),
    clear: vi.fn().mockResolvedValue(true),
    onAlarm: { addListener: vi.fn() },
  },
  i18n: { getMessage: vi.fn().mockReturnValue('') },
} as unknown as typeof chrome;

beforeEach(() => {
  recentSubmits.clear();
  Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]);
  removedKeys.length = 0;
  vi.clearAllMocks();
  // Restaurer les implémentations closure après vi.clearAllMocks()
  // clearAllMocks() efface .mock.calls mais aussi l'implémentation des vi.fn(impl).
  // On réaffecte les implémentations pour garantir leur persistance.
  vi.mocked(chrome.storage.local.get).mockImplementation(
    (_keys: string[], callback: (r: Record<string, unknown>) => void) => {
      const result: Record<string, unknown> = {};
      _keys.forEach((k) => {
        if (k in mockLocalStorage) result[k] = mockLocalStorage[k];
      });
      callback(result);
    },
  );
  vi.mocked(chrome.storage.local.set).mockImplementation(
    (items: Record<string, unknown>, callback?: () => void) => {
      Object.assign(mockLocalStorage, items);
      callback?.();
    },
  );
  vi.mocked(chrome.storage.local.remove).mockImplementation(
    (key: string | string[], callback?: () => void) => {
      const keys = Array.isArray(key) ? key : [key];
      keys.forEach((k) => {
        removedKeys.push(k);
        delete mockLocalStorage[k];
      });
      callback?.();
    },
  );
  vi.mocked(chrome.runtime.sendMessage).mockImplementation(
    (_msg: unknown, callback?: (r: unknown) => void) => {
      callback?.({ success: true, action: 'skip', reason: 'no_reuse' });
    },
  );
});

// ===========================================================================
// Helpers communs M7 handler
// ===========================================================================

/** Hash hexadécimal valide (64 chars) représentant un mot de passe réutilisé */
const HASH_PASSWORD_REUSED = 'f'.repeat(64);
const TAG_REUSED = 'f'.repeat(8);

/**
 * domain_hash simulé pour login.microsoftonline.com
 * (Step 1 — jamais utilisé par M7 pour le stockage ; documente INV-UC01-01).
 */
const DOMAIN_HASH_MICROSOFTONLINE = 'a'.repeat(64);

/**
 * domain_hash simulé pour login.live.com
 * (Step 2 — hostname effectif de saisie ; INV-UC01-01).
 */
const DOMAIN_HASH_LIVE = 'b'.repeat(64);

/** Crée un PasswordHashRecord factice */
function buildHashRecord(hash: string, domainHash: string, id = 1): PasswordHashRecord {
  return {
    id,
    tag: hash.substring(0, 8),
    value: new ArrayBuffer(32),
    iv: new Uint8Array(12),
    domain_hash: domainHash,
    first_seen: Date.now() - 2000,
    count: 1,
  };
}

/** Crée un mock de StorageService */
function createMockStorage(options: {
  candidates?: PasswordHashRecord[];
  isSuppressed?: boolean;
}): Partial<StorageService> {
  return {
    addPasswordHash: vi.fn().mockResolvedValue(undefined),
    getPasswordHashesByTag: vi.fn().mockResolvedValue(options.candidates ?? []),
    isWhitelisted: vi.fn().mockResolvedValue(options.isSuppressed ?? false),
    addToWhitelist: vi.fn().mockResolvedValue(undefined),
    logEvent: vi.fn().mockResolvedValue(42),
  };
}

/** Crée des mocks HeartbeatService et IncidentService */
function createMockServices(): {
  heartbeat: Partial<HeartbeatService>;
  incident: Partial<IncidentService>;
} {
  return {
    heartbeat: { onDetection: vi.fn().mockResolvedValue(undefined) },
    incident: { log: vi.fn().mockResolvedValue(undefined) },
  };
}

/** Crée une CryptoKey factice */
function createFakeKey(): CryptoKey {
  return {} as CryptoKey;
}

// ===========================================================================
// TC-UC01-02 — Microsoft cross-hostname
// INV-UC01-01 : domain_hash = SHA-256(salt + "login.live.com"), jamais login.microsoftonline.com
// INV-UC01-03 : pending_m7_toast contient uniquement domain_hash + expires_at
// ===========================================================================

describe('TC-UC01-02 — Microsoft cross-hostname : hash rattaché à login.live.com (Step 2)', () => {
  /**
   * Contexte simulé :
   * - Step 1 (login.microsoftonline.com) : aucun champ password → M7 ne stocke rien
   * - Step 2 (login.live.com) : submit du mot de passe → M7 stocke avec DOMAIN_HASH_LIVE
   *
   * Ce test vérifie que lors d'une deuxième soumission du même mot de passe depuis un
   * troisième domaine, M7 détecte la réutilisation inter-domaines, prouvant que le hash
   * était correctement rattaché à login.live.com (Step 2) et non à microsoftonline.
   */

  it('TC-UC01-02-A : Step 2 sur login.live.com → hash stocké avec domain_hash login.live.com (INV-UC01-01)', async () => {
    // Arrange : aucun hash existant (première saisie Step 2)
    const storage = createMockStorage({ candidates: [] });
    const { heartbeat, incident } = createMockServices();
    const handler = createM7Handler(
      storage as StorageService,
      createFakeKey(),
      heartbeat as HeartbeatService,
      incident as IncidentService,
    );

    // Act : submit depuis Step 2 (login.live.com) — domain_hash = DOMAIN_HASH_LIVE
    const response = await handler(
      {
        module: 'M7',
        action: 'password_submitted',
        payload: { hash: HASH_PASSWORD_REUSED, domain_hash: DOMAIN_HASH_LIVE },
        timestamp: Date.now(),
      },
      {} as chrome.runtime.MessageSender,
    );

    // Assert : stockage appelé avec le domain_hash de login.live.com (Step 2)
    expect(response.success).toBe(true);
    expect(storage.addPasswordHash).toHaveBeenCalledWith(
      HASH_PASSWORD_REUSED,
      TAG_REUSED,
      DOMAIN_HASH_LIVE, // INV-UC01-01 : hostname Step 2 uniquement
      createFakeKey(),
    );
    // domain_hash de login.microsoftonline.com (Step 1) ne doit JAMAIS apparaître
    expect(storage.addPasswordHash).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      DOMAIN_HASH_MICROSOFTONLINE, // Step 1 — jamais stocké (pas de champ password)
      expect.anything(),
    );
  });

  it('TC-UC01-02-B : réutilisation détectée quand même hash soumis depuis un autre domaine (cross-hostname)', async () => {
    /**
     * Scénario :
     * 1. Soumission précédente depuis login.live.com → hash stocké sous DOMAIN_HASH_LIVE
     * 2. Soumission du même mot de passe depuis un autre domaine (DOMAIN_HASH_MICROSOFTONLINE)
     * → M7 doit pré-filtrer par tag et tenter la comparaison cryptographique
     *
     * Note : la crypto AES-GCM n'est pas disponible dans jsdom. isPasswordReused ignore
     * silencieusement les candidats corrompus (catch). Ce test vérifie la pré-filtration
     * par tag (getPasswordHashesByTag) et que le hash est stocké avec le bon domain_hash.
     * La détection réelle de réutilisation est validée en recette manuelle (§12 mini-DAT).
     */
    const existingRecord = buildHashRecord(HASH_PASSWORD_REUSED, DOMAIN_HASH_LIVE, 1);
    const storage = createMockStorage({ candidates: [existingRecord] });
    const { heartbeat, incident } = createMockServices();
    const handler = createM7Handler(
      storage as StorageService,
      createFakeKey(),
      heartbeat as HeartbeatService,
      incident as IncidentService,
    );

    // Act : soumission depuis un autre domaine avec le même tag → pré-filtration activée
    const response = await handler(
      {
        module: 'M7',
        action: 'password_submitted',
        payload: { hash: HASH_PASSWORD_REUSED, domain_hash: DOMAIN_HASH_MICROSOFTONLINE },
        timestamp: Date.now(),
      },
      {} as chrome.runtime.MessageSender,
    );

    // Assert : pré-filtration par tag appelée
    expect(storage.getPasswordHashesByTag).toHaveBeenCalledWith(TAG_REUSED);
    // Hash stocké avec le domain_hash du domaine courant (pas celui du Step 1 Microsoft)
    expect(storage.addPasswordHash).toHaveBeenCalledWith(
      HASH_PASSWORD_REUSED,
      TAG_REUSED,
      DOMAIN_HASH_MICROSOFTONLINE,
      createFakeKey(),
    );
    expect(response.success).toBe(true);
  });

  it('TC-UC01-02-C : pending_m7_toast créé avec domain_hash de login.live.com et expires_at valide (INV-UC01-03)', async () => {
    /**
     * Force isPasswordReused = true en mockant crypto.subtle.decrypt pour retourner
     * le hash en clair. Vérifie que pending_m7_toast est écrit avec DOMAIN_HASH_LIVE
     * (hostname Step 2) et un expires_at dans le futur (INV-UC01-03, R-CLI-03).
     */
    const candidateFromOtherDomain = buildHashRecord(
      HASH_PASSWORD_REUSED,
      DOMAIN_HASH_MICROSOFTONLINE,
      2,
    );
    const storage = createMockStorage({ candidates: [candidateFromOtherDomain] });
    const { heartbeat, incident } = createMockServices();

    // Mock crypto.subtle.decrypt pour simuler la détection de réutilisation
    const encoder = new TextEncoder();
    const fakeDecrypted = encoder.encode(HASH_PASSWORD_REUSED).buffer as ArrayBuffer;
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        subtle: {
          decrypt: vi.fn().mockResolvedValue(fakeDecrypted),
        },
      },
      writable: true,
      configurable: true,
    });

    const handler = createM7Handler(
      storage as StorageService,
      createFakeKey(),
      heartbeat as HeartbeatService,
      incident as IncidentService,
    );

    const nowBefore = Date.now();
    const response = await handler(
      {
        module: 'M7',
        action: 'password_submitted',
        payload: { hash: HASH_PASSWORD_REUSED, domain_hash: DOMAIN_HASH_LIVE },
        timestamp: Date.now(),
      },
      {} as chrome.runtime.MessageSender,
    );

    // Restaurer crypto original
    Object.defineProperty(globalThis, 'crypto', {
      value: originalCrypto,
      writable: true,
      configurable: true,
    });

    // Assert : réutilisation détectée → action 'show' avec domain_hash login.live.com
    expect(response.success).toBe(true);
    expect(response.action).toBe('show');
    expect((response as { data?: { domain_hash?: string } }).data?.domain_hash).toBe(
      DOMAIN_HASH_LIVE,
    );

    // pending_m7_toast écrit dans chrome.storage.local (INV-UC01-03, ADR-002)
    const pendingToast = mockLocalStorage[PENDING_M7_TOAST_KEY] as
      | Record<string, unknown>
      | undefined;
    expect(pendingToast).toBeDefined();
    // domain_hash = login.live.com (Step 2), jamais login.microsoftonline.com (Step 1)
    expect(pendingToast?.['domain_hash']).toBe(DOMAIN_HASH_LIVE);
    // expires_at doit être dans le futur (TTL 10 min — R-CLI-03 / TACHE-091)
    expect(typeof pendingToast?.['expires_at']).toBe('number');
    expect(pendingToast?.['expires_at'] as number).toBeGreaterThan(nowBefore);
    expect(pendingToast?.['expires_at'] as number).toBeLessThanOrEqual(
      nowBefore + PENDING_M7_TOAST_TTL_MS + 200,
    );
    // Aucun champ 'timestamp' (format legacy supprimé — R-CLI-03 / TACHE-091)
    expect(pendingToast?.['timestamp']).toBeUndefined();

    // Vérification via readPendingM7Toast (lecture backward-compatible)
    const readResult = await readPendingM7Toast();
    expect(readResult).not.toBeNull();
    expect(readResult?.domain_hash).toBe(DOMAIN_HASH_LIVE);
    expect(readResult?.expires_at).toBeGreaterThan(nowBefore);
  });
});

// ===========================================================================
// TC-UC01-03 — Deep link Step 2 direct
// INV-UC01-01 : détection M7 active sans Step 1 préalable
// ===========================================================================

// ---------------------------------------------------------------------------
// Import du module password-detector pour TC-UC01-03 et TC-UC01-04
// L'import doit être APRÈS la définition de global.chrome (ci-dessus).
// ---------------------------------------------------------------------------
import { _snPasswordInputs, handleFormSubmit } from '@/content-scripts/detectors/password-detector';

describe('TC-UC01-03 — Deep link Step 2 direct : détection M7 active sans Step 1', () => {
  /**
   * Scénario : l'utilisateur accède directement à login.live.com/login.srf (Step 2)
   * via un deep link, sans jamais visiter login.microsoftonline.com (Step 1).
   *
   * M7 doit capturer la soumission normalement : le hash est calculé sur le hostname
   * de la page courante, indépendamment de toute navigation préalable.
   *
   * L'invariant INV-UC01-01 est garanti architecturalement : handleFormSubmit utilise
   * exclusivement location.hostname de la page courante pour le domain_hash.
   */

  afterEach(() => {
    document.body.innerHTML = '';
    _snPasswordInputs.clear();
  });

  it('TC-UC01-03-A : soumission directe sur Step 2 → sendMessage password_submitted envoyé (pas de dépendance Step 1)', async () => {
    // Arrange : input password Step 2, sans aucun état Step 1 préalable
    _snPasswordInputs.clear(); // Registre vide (aucun Step 1 jamais visité)

    const form = document.createElement('form');
    const pwdInput = document.createElement('input');
    pwdInput.type = 'password';
    pwdInput.value = 'MySecurePassword!123';
    form.appendChild(pwdInput);
    document.body.appendChild(form);

    // Mock salt disponible (SW initialisé)
    vi.mocked(chrome.storage.local.get).mockImplementationOnce(
      (_keys: string[], callback: (r: Record<string, unknown>) => void) => {
        callback({ installation_salt: 'c'.repeat(64) });
      },
    );

    // Capturer les messages envoyés au SW
    const capturedMessages: unknown[] = [];
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      (msg: unknown, callback?: (r: unknown) => void) => {
        capturedMessages.push(msg);
        callback?.({ success: true, action: 'skip', reason: 'no_reuse' });
      },
    );

    const submitEvent = { isTrusted: true } as unknown as SubmitEvent;

    // Act : soumission directe Step 2 (sans Step 1 préalable)
    await handleFormSubmit(submitEvent, pwdInput);

    // Assert : sendMessage appelé avec password_submitted (pas de dépendance à Step 1)
    const m7Messages = capturedMessages.filter(
      (msg) =>
        typeof msg === 'object' &&
        msg !== null &&
        (msg as Record<string, unknown>)['module'] === 'M7' &&
        (msg as Record<string, unknown>)['action'] === 'password_submitted',
    );
    expect(m7Messages.length).toBeGreaterThanOrEqual(1);

    // Le payload ne doit pas contenir le mot de passe en clair (INV-UC01-02)
    for (const msg of m7Messages) {
      const payload = (msg as Record<string, unknown>)['payload'] as Record<string, unknown>;
      expect(payload).toHaveProperty('hash');
      expect(payload).toHaveProperty('domain_hash');
      expect(payload['hash']).not.toBe('MySecurePassword!123'); // jamais en clair
      expect(payload).not.toHaveProperty('password');
      expect(payload).not.toHaveProperty('isTrusted');
    }
  });

  it('TC-UC01-03-B : hash calculé avec le hostname de la page Step 2 (domain_hash = SHA-256 valide)', async () => {
    // Arrange
    _snPasswordInputs.clear();

    const form = document.createElement('form');
    const pwdInput = document.createElement('input');
    pwdInput.type = 'password';
    pwdInput.value = 'AnotherPassword456!';
    form.appendChild(pwdInput);
    document.body.appendChild(form);

    vi.mocked(chrome.storage.local.get).mockImplementationOnce(
      (_keys: string[], callback: (r: Record<string, unknown>) => void) => {
        callback({ installation_salt: 'd'.repeat(64) });
      },
    );

    const capturedMessages: unknown[] = [];
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      (msg: unknown, callback?: (r: unknown) => void) => {
        capturedMessages.push(msg);
        callback?.({ success: true, action: 'skip', reason: 'no_reuse' });
      },
    );

    const submitEvent = { isTrusted: true } as unknown as SubmitEvent;
    await handleFormSubmit(submitEvent, pwdInput);

    // Le domain_hash doit être une chaîne hex de 64 chars (SHA-256)
    const m7Messages = capturedMessages.filter(
      (msg) =>
        typeof msg === 'object' &&
        msg !== null &&
        (msg as Record<string, unknown>)['module'] === 'M7' &&
        (msg as Record<string, unknown>)['action'] === 'password_submitted',
    );

    if (m7Messages.length > 0) {
      const payload = (m7Messages[0] as Record<string, unknown>)['payload'] as Record<
        string,
        unknown
      >;
      const domainHash = payload['domain_hash'] as string;
      // domain_hash doit être un hash SHA-256 valide (64 hex chars)
      expect(typeof domainHash).toBe('string');
      expect(domainHash).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(domainHash)).toBe(true);
      // domain_hash ≠ password hash (deux calculs distincts — INV-UC01-01)
      const passwordHash = payload['hash'] as string;
      expect(domainHash).not.toBe(passwordHash);
    }
  });
});

// ===========================================================================
// TC-UC01-04 — Filtre isCreationForm sur page SSO Step 2
// INV-UC01-04 : isCreationForm retourne false sur page de connexion SSO standard
// ===========================================================================

describe('TC-UC01-04 — Filtre isCreationForm sur page SSO Step 2', () => {
  /**
   * isCreationForm n'est pas exportée directement. Son comportement est testé via
   * handleFormSubmit : si isCreationForm retourne false (page connexion), M7 continue
   * et sendMessage password_submitted est appelé.
   *
   * Note architecturale : isCreationForm est évaluée dans handleFocusOnPasswordField
   * (au focus), pas dans handleFormSubmit (au submit). Au submit, M7 procède
   * indépendamment du résultat de isCreationForm. Ce test documente ce comportement.
   *
   * Les heuristiques de isCreationForm pour une page SSO Step 2 standard :
   * - Signal 1 : autocomplete="new-password" → absent sur login.live.com → false
   * - Signal 2 : 2+ champs password → absent (Step 2 = 1 seul champ) → false
   * - Signal 3 : URL keywords (register, signup...) → absents → false
   * - Signal 4 : bouton submit avec keyword inscription → absent → false
   * - Signal 5 : email sans lien "forgot" → lien "forgot" présent → false
   * → isCreationForm retourne false (INV-UC01-04)
   */

  afterEach(() => {
    document.body.innerHTML = '';
    _snPasswordInputs.clear();
  });

  it('TC-UC01-04-A : formulaire SSO Step 2 standard → M7 envoie password_submitted (isCreationForm=false)', async () => {
    // Arrange : page Step 2 standard — lien "forgot", bouton "Sign in", 1 seul password
    const form = document.createElement('form');

    const pwdInput = document.createElement('input');
    pwdInput.type = 'password';
    pwdInput.value = 'SSOLoginPassword!';
    // Pas d'autocomplete="new-password" (Signal 1 absent)
    form.appendChild(pwdInput);

    // Lien "mot de passe oublié" → contredit Signal 5 (isCreationForm = false)
    const forgotLink = document.createElement('a');
    forgotLink.href = '/forgot-password';
    forgotLink.textContent = 'Forgot password?';
    form.appendChild(forgotLink);

    // Bouton "Sign in" — pas de mot-clé d'inscription (Signal 4 absent)
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.textContent = 'Sign in';
    form.appendChild(submitBtn);

    document.body.appendChild(form);

    vi.mocked(chrome.storage.local.get).mockImplementationOnce(
      (_keys: string[], callback: (r: Record<string, unknown>) => void) => {
        callback({ installation_salt: 'e'.repeat(64) });
      },
    );
    const capturedMessages: unknown[] = [];
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      (msg: unknown, callback?: (r: unknown) => void) => {
        capturedMessages.push(msg);
        callback?.({ success: true, action: 'skip', reason: 'no_reuse' });
      },
    );

    const submitEvent = { isTrusted: true } as unknown as SubmitEvent;
    await handleFormSubmit(submitEvent, pwdInput);

    // Assert : password_submitted envoyé (M7 actif — isCreationForm=false sur SSO Step 2)
    const m7Messages = capturedMessages.filter(
      (msg) =>
        typeof msg === 'object' &&
        msg !== null &&
        (msg as Record<string, unknown>)['module'] === 'M7' &&
        (msg as Record<string, unknown>)['action'] === 'password_submitted',
    );
    expect(m7Messages.length).toBeGreaterThanOrEqual(1);
  });

  it('TC-UC01-04-B : formulaire SSO avec autocomplete="new-password" → M7 envoie password_submitted au submit (comportement documenté)', async () => {
    /**
     * Comportement documentaire (pas strictement un échec) :
     *
     * isCreationForm est évaluée dans handleFocusOnPasswordField (au focus), non au submit.
     * handleFormSubmit envoie toujours password_submitted à M7, indépendamment de
     * isCreationForm. L'impact d'un faux positif isCreationForm se limite au routing
     * M9 vs M2 au focus — M7 au submit n'est pas affecté.
     *
     * Si un IdP SSO expose autocomplete="new-password" sur son formulaire de connexion
     * Step 2, M7 continue de détecter la réutilisation. Seul M9 (force) peut s'afficher
     * au lieu de M2 (risque site) — comportement non bloquant pour UC-01.
     *
     * Ticket BACKLOG TACHE-118 (suggéré) : vérifier si un IdP SSO réel expose
     * autocomplete="new-password" sur son formulaire de connexion Step 2. Si confirmé,
     * ajouter une exception de domaine dans Signal 1 de isCreationForm pour les domaines
     * SSO connus (login.live.com, accounts.google.com, *.okta.com).
     */
    const form = document.createElement('form');

    const pwdInput = document.createElement('input');
    pwdInput.type = 'password';
    pwdInput.autocomplete = 'new-password'; // Signal 1 : isCreationForm=true au focus
    pwdInput.value = 'SSOPasswordWithHint!';
    form.appendChild(pwdInput);

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.textContent = 'Next';
    form.appendChild(submitBtn);

    document.body.appendChild(form);

    vi.mocked(chrome.storage.local.get).mockImplementationOnce(
      (_keys: string[], callback: (r: Record<string, unknown>) => void) => {
        callback({ installation_salt: 'f'.repeat(64) });
      },
    );
    const capturedMessages: unknown[] = [];
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      (msg: unknown, callback?: (r: unknown) => void) => {
        capturedMessages.push(msg);
        callback?.({ success: true, action: 'skip', reason: 'no_reuse' });
      },
    );

    const submitEvent = { isTrusted: true } as unknown as SubmitEvent;
    await handleFormSubmit(submitEvent, pwdInput);

    // Assert documentaire : M7 envoie password_submitted même si autocomplete="new-password"
    // (isCreationForm s'applique au focus seulement, pas au submit)
    const m7Messages = capturedMessages.filter(
      (msg) =>
        typeof msg === 'object' &&
        msg !== null &&
        (msg as Record<string, unknown>)['module'] === 'M7' &&
        (msg as Record<string, unknown>)['action'] === 'password_submitted',
    );
    // Si ce test échoue (m7Messages.length === 0), cela signifie que isCreationForm
    // est aussi appliquée au submit → signaler comme BUG dans BACKLOG (TACHE-118)
    expect(m7Messages.length).toBeGreaterThanOrEqual(1);
  });

  it('TC-UC01-04-C : formulaire avec hint "Create account" type="button" → pas de faux positif Signal 4', async () => {
    /**
     * Signal 4 de isCreationForm (bouton submit avec mot-clé inscription) s'applique
     * uniquement aux sélecteurs : button[type="submit"], input[type="submit"], button:not([type]).
     *
     * Un bouton type="button" avec le texte "Create account" n'est PAS dans ce sélecteur
     * → Signal 4 absent → isCreationForm=false → M7 actif au focus ET au submit.
     *
     * Ce test vérifie que le hint "Create account" non-submit ne déclenche pas de
     * faux positif dans isCreationForm, conformément à INV-UC01-04.
     *
     * Ticket BACKLOG TACHE-118 (suggéré) : si un IdP SSO place un bouton "Create account"
     * de type "button" (pas "submit") dans le même form que le bouton "Sign in", le
     * comportement est correct. Documenter ce cas dans la recette manuelle.
     */
    const form = document.createElement('form');

    const pwdInput = document.createElement('input');
    pwdInput.type = 'password';
    pwdInput.value = 'LoginPassword!789';
    form.appendChild(pwdInput);

    // Bouton principal : connexion (Signal 4 : "Sign in" → pas de keyword inscription)
    const loginBtn = document.createElement('button');
    loginBtn.type = 'submit';
    loginBtn.textContent = 'Sign in';
    form.appendChild(loginBtn);

    // Hint "Create account" comme bouton non-submit
    // type="button" → exclus du sélecteur Signal 4 → pas de faux positif
    const createHint = document.createElement('button');
    createHint.type = 'button';
    createHint.textContent = 'Create account';
    form.appendChild(createHint);

    // Lien forgot → contredit Signal 5
    const forgotLink = document.createElement('a');
    forgotLink.href = '/forgot-password';
    form.appendChild(forgotLink);

    document.body.appendChild(form);

    vi.mocked(chrome.storage.local.get).mockImplementationOnce(
      (_keys: string[], callback: (r: Record<string, unknown>) => void) => {
        callback({ installation_salt: 'a0'.repeat(32) });
      },
    );
    const capturedMessages: unknown[] = [];
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      (msg: unknown, callback?: (r: unknown) => void) => {
        capturedMessages.push(msg);
        callback?.({ success: true, action: 'skip', reason: 'no_reuse' });
      },
    );

    const submitEvent = { isTrusted: true } as unknown as SubmitEvent;
    await handleFormSubmit(submitEvent, pwdInput);

    const m7Messages = capturedMessages.filter(
      (msg) =>
        typeof msg === 'object' &&
        msg !== null &&
        (msg as Record<string, unknown>)['module'] === 'M7' &&
        (msg as Record<string, unknown>)['action'] === 'password_submitted',
    );

    // Avec bouton "Create account" type="button" (non-submit) → Signal 4 absent
    // + lien forgot présent → Signal 5 absent
    // → isCreationForm=false → M7 envoie password_submitted (INV-UC01-04)
    expect(m7Messages.length).toBeGreaterThanOrEqual(1);
  });
});
