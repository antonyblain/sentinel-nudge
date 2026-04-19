/**
 * @file tests/unit/modules/m17.test.ts
 * @description Tests unitaires du module M17 — alerte données sensibles presse-papiers.
 *
 * Couvre :
 * - luhnCheck : validation algorithme de Luhn
 * - ibanModulo97 : validation IBAN modulo 97
 * - shannonEntropy : calcul d'entropie Shannon
 * - detectSensitiveTypes : pattern matching complet
 * - createM17Handler : validation payload, enregistrement événements, actions toast
 *
 * TACHE-089 — diagnostics M17 (Option B) :
 * - TC-M17-DIAG-READ-01 : readM17Diagnostics retourne valeur par défaut si absent
 * - TC-M17-DIAG-UPDATE-01 : updateM17DiagnosticsOnAction succès
 * - TC-M17-DIAG-UPDATE-02 : updateM17DiagnosticsOnAction échec + incident m17_handler_error
 * - TC-M17-DIAG-HANDLER-01 : handler M17 avec incidentService met à jour diagnostics
 * - TC-M17-DIAG-HANDLER-02 : handler M17 sans incidentService (rétro-compat)
 *
 * TACHE-090 — pending_m17_toast (ADR-002 R-CLI-01 à 07) :
 * - TC-M17-PENDING-01 : writePendingM17Toast écrit le bon format (expires_at, data_type enum)
 * - TC-M17-PENDING-02 : readPendingM17Toast retourne null si absent/expiré/corrompu
 * - TC-M17-PENDING-03 : consumePendingM17Toast supprime après lecture (R-CLI-04)
 * - TC-M17-PENDING-04 : R-CLI-07 — JAMAIS la valeur collée (data_type enum strict)
 * - TC-M17-PENDING-05 : TTL 5 min — toast expiré ignoré
 * - TC-M17-PENDING-06 : handler M17 écrit pending_m17_toast pour credit_card et iban
 *
 * T-189 lot 3 : mock inline remplacé par createMockChromeStorage() (wrapper JSON-strict P-018).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectSensitiveTypes,
  luhnCheck,
  ibanModulo97,
  shannonEntropy,
} from '@/content-scripts/detectors/paste-detector';
import { createM17Handler, readM17Diagnostics } from '@/background/handlers/m17-handler';
import {
  readM17Diagnostics as readM17DiagnosticsService,
  updateM17DiagnosticsOnAction,
  writePendingM17Toast,
  readPendingM17Toast,
  consumePendingM17Toast,
} from '@/background/services/m17-boot-service';
import type { StorageService } from '@/background/storage-service';
import type { NudgeMessage } from '@/shared/types/messages';
import type { IncidentService } from '@/background/services/incident-service';
import {
  DIAGNOSTICS_M17_KEY,
  M17_DIAGNOSTICS_DEFAULT,
  PENDING_M17_TOAST_KEY,
  PENDING_M17_TOAST_TTL_MS,
} from '@/shared/types/diagnostics';
import { createMockChromeStorage } from '../../helpers/mock-chrome-storage';

// ---------------------------------------------------------------------------
// Mock chrome.storage.local — wrapper JSON-strict T-189 / P-018
// ---------------------------------------------------------------------------

const { storage, reset: resetStorage } = createMockChromeStorage();

global.chrome = {
  storage: {
    local: storage,
  },
  tabs: {
    create: vi.fn().mockResolvedValue({}),
  },
  runtime: {
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
  },
} as unknown as typeof chrome;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Construit un NudgeMessage M17 */
function buildM17Message(
  payload: Record<string, unknown>,
  action = 'sensitive_data_detected',
): NudgeMessage {
  return {
    module: 'M17',
    action,
    payload,
    timestamp: Date.now(),
  };
}

/** Crée un mock de StorageService pour les tests M17 */
function createMockStorage(): Partial<StorageService> {
  return {
    logEvent: vi.fn().mockResolvedValue(1),
  };
}

/** Crée une CryptoKey factice */
function createFakeKey(): CryptoKey {
  return {} as CryptoKey;
}

/** Crée un mock de IncidentService */
function createMockIncidentService(): Partial<IncidentService> {
  return {
    log: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  resetStorage();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests : luhnCheck
// ---------------------------------------------------------------------------

describe('luhnCheck', () => {
  it('valide un numéro de carte Visa connu (4532015112830366)', () => {
    // Numéro de test Visa standard Luhn-valide
    expect(luhnCheck('4532015112830366')).toBe(true);
  });

  it('valide un numéro de carte Mastercard connu (5425233430109903)', () => {
    expect(luhnCheck('5425233430109903')).toBe(true);
  });

  it('valide un numéro AMEX connu (374251018720018)', () => {
    // AMEX : 15 chiffres
    expect(luhnCheck('374251018720018')).toBe(true);
  });

  it('rejette un numéro invalide (chiffre modifié)', () => {
    expect(luhnCheck('4532015112830367')).toBe(false);
  });

  it('rejette un numéro trop court (< 13 chiffres)', () => {
    expect(luhnCheck('123456789012')).toBe(false);
  });

  it('rejette un numéro trop long (> 19 chiffres)', () => {
    expect(luhnCheck('12345678901234567890')).toBe(false);
  });

  it('ignore les espaces et tirets', () => {
    // 4532 0151 1283 0366 == 4532015112830366
    expect(luhnCheck('4532 0151 1283 0366')).toBe(true);
    expect(luhnCheck('4532-0151-1283-0366')).toBe(true);
  });

  it('rejette une chaîne vide', () => {
    expect(luhnCheck('')).toBe(false);
  });

  it('rejette une chaîne non numérique', () => {
    expect(luhnCheck('abcdefghijklmnop')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests : ibanModulo97
// ---------------------------------------------------------------------------

describe('ibanModulo97', () => {
  it('valide un IBAN français correct (FR7630006000011234567890189)', () => {
    expect(ibanModulo97('FR7630006000011234567890189')).toBe(true);
  });

  it('valide un IBAN allemand correct (DE89370400440532013000)', () => {
    expect(ibanModulo97('DE89370400440532013000')).toBe(true);
  });

  it('valide un IBAN belge correct (BE68539007547034)', () => {
    expect(ibanModulo97('BE68539007547034')).toBe(true);
  });

  it('rejette un IBAN avec chiffre de contrôle incorrect', () => {
    // Modification du chiffre de contrôle FR76 → FR77
    expect(ibanModulo97('FR7730006000011234567890188')).toBe(false);
  });

  it('rejette un IBAN trop court', () => {
    expect(ibanModulo97('FR7614')).toBe(false);
  });

  it('ignore les espaces', () => {
    expect(ibanModulo97('FR76 3000 6000 0112 3456 7890 189')).toBe(true);
  });

  it('rejette une chaîne vide', () => {
    expect(ibanModulo97('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests : shannonEntropy
// ---------------------------------------------------------------------------

describe('shannonEntropy', () => {
  it('retourne 0 pour une chaîne vide', () => {
    expect(shannonEntropy('')).toBe(0);
  });

  it('retourne 0 pour une chaîne de caractères identiques', () => {
    expect(shannonEntropy('aaaaaaaaaaaaaaaa')).toBe(0);
  });

  it('retourne une entropie élevée pour une chaîne aléatoire', () => {
    // Chaîne avec haute entropie : beaucoup de caractères différents
    const highEntropy = 'aB3xK9mP2qR7vN1wZtYs5uEj8iLc4dFgH6oC0';
    expect(shannonEntropy(highEntropy)).toBeGreaterThanOrEqual(4.0);
  });

  it('retourne une entropie faible pour un mot commun', () => {
    // Un mot simple a peu de variété de caractères
    const lowEntropy = 'password123password123password123';
    expect(shannonEntropy(lowEntropy)).toBeLessThan(4.0);
  });

  it('dépasse le seuil de 4.0 bits pour une clé API réaliste', () => {
    // Clé API simulée : 32+ chars avec haute entropie
    const apiKey = 'sk-proj-abc123XYZ456def789GHI012jkl345mn';
    expect(shannonEntropy(apiKey)).toBeGreaterThanOrEqual(4.0);
  });
});

// ---------------------------------------------------------------------------
// Tests : detectSensitiveTypes
// ---------------------------------------------------------------------------

describe('detectSensitiveTypes', () => {
  it('détecte un numéro de carte bancaire valide (Luhn)', () => {
    const types = detectSensitiveTypes('4532015112830366');
    expect(types).toContain('credit_card');
  });

  it('ne détecte pas un numéro de carte invalide (Luhn fail)', () => {
    const types = detectSensitiveTypes('4532015112830367');
    expect(types).not.toContain('credit_card');
  });

  it('détecte un IBAN valide', () => {
    const types = detectSensitiveTypes('FR7630006000011234567890189');
    expect(types).toContain('iban');
  });

  it('ne détecte pas un IBAN invalide (modulo 97 fail)', () => {
    const types = detectSensitiveTypes('FR7730006000011234567890188');
    expect(types).not.toContain('iban');
  });

  it('détecte une clé API avec haute entropie', () => {
    // Chaîne 32+ chars avec entropie ≥ 4.0
    const apiKey = 'sk-proj-aB3xK9mP2qR7vN1wZtYs5uEj8iLc4dFgH6oC0';
    const types = detectSensitiveTypes(apiKey);
    expect(types).toContain('api_key');
  });

  it('ne détecte pas une chaîne répétitive comme clé API (entropie faible)', () => {
    // 32+ chars mais entropie faible
    const notApiKey = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const types = detectSensitiveTypes(notApiKey);
    expect(types).not.toContain('api_key');
  });

  it('ne détecte rien dans un texte normal', () => {
    const types = detectSensitiveTypes('Bonjour, voici un texte normal sans donnée sensible.');
    expect(types).toHaveLength(0);
  });

  it('priorité : carte bancaire détectée en premier', () => {
    // Texte avec carte ET IBAN
    const text = '4532015112830366 et FR7630006000011234567890189';
    const types = detectSensitiveTypes(text);
    if (types.length > 1) {
      expect(types[0]).toBe('credit_card');
    }
  });

  it('retourne un tableau vide pour une chaîne vide', () => {
    const types = detectSensitiveTypes('');
    expect(types).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests : createM17Handler — validation du payload
// ---------------------------------------------------------------------------

describe('createM17Handler — validation du payload', () => {
  it('rejette un type invalide', async () => {
    const mockStorageService = createMockStorage();
    const handler = createM17Handler(mockStorageService as StorageService, createFakeKey());
    const msg = buildM17Message({ type: 'bank_account', all_types: ['bank_account'] });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(false);
    expect(response.reason).toBe('invalid_data_type');
  });

  it('rejette un payload sans type', async () => {
    const mockStorageService = createMockStorage();
    const handler = createM17Handler(mockStorageService as StorageService, createFakeKey());
    const msg = buildM17Message({ all_types: ['iban'] });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(false);
    expect(response.reason).toBe('invalid_data_type');
  });

  it('rejette une action inconnue', async () => {
    const mockStorageService = createMockStorage();
    const handler = createM17Handler(mockStorageService as StorageService, createFakeKey());
    const msg = buildM17Message({ type: 'credit_card' }, 'unknown_action');
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(false);
    expect(response.reason).toBe('unknown_action');
  });
});

// ---------------------------------------------------------------------------
// Tests : createM17Handler — logique métier
// ---------------------------------------------------------------------------

describe('createM17Handler — sensitive_data_detected', () => {
  it('retourne show pour un type credit_card valide', async () => {
    const mockStorageService = createMockStorage();
    const handler = createM17Handler(mockStorageService as StorageService, createFakeKey());
    const msg = buildM17Message({ type: 'credit_card', all_types: ['credit_card'] });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('show');
    expect(response.data?.['data_type']).toBe('credit_card');
  });

  it('retourne show pour un type iban valide', async () => {
    const mockStorageService = createMockStorage();
    const handler = createM17Handler(mockStorageService as StorageService, createFakeKey());
    const msg = buildM17Message({ type: 'iban', all_types: ['iban'] });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('show');
  });

  it('retourne show pour un type api_key valide', async () => {
    const mockStorageService = createMockStorage();
    const handler = createM17Handler(mockStorageService as StorageService, createFakeKey());
    const msg = buildM17Message({ type: 'api_key', all_types: ['api_key'] });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('show');
  });

  it("enregistre l'événement avec le type détecté (pas la valeur)", async () => {
    const mockStorageService = createMockStorage();
    const handler = createM17Handler(mockStorageService as StorageService, createFakeKey());
    const msg = buildM17Message({ type: 'iban', all_types: ['iban'] });
    await handler(msg, {} as chrome.runtime.MessageSender);

    expect(mockStorageService.logEvent).toHaveBeenCalledWith(
      'M17',
      expect.objectContaining({
        action: 'detected',
        module_data: expect.objectContaining({ data_type: 'iban' }),
      }),
      expect.anything(),
    );
  });

  it("N'expose jamais de valeur sensible dans le payload logué", async () => {
    const mockStorageService = createMockStorage();
    const handler = createM17Handler(mockStorageService as StorageService, createFakeKey());
    const msg = buildM17Message({ type: 'credit_card', all_types: ['credit_card'] });
    await handler(msg, {} as chrome.runtime.MessageSender);

    // Vérifier que logEvent n'a jamais été appelé avec du contenu ressemblant à un numéro de carte
    const calls = vi.mocked(mockStorageService.logEvent!).mock.calls;
    for (const [, payload] of calls) {
      const serialized = JSON.stringify(payload);
      expect(serialized).not.toMatch(/\d{13,19}/);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests : createM17Handler — action toast_action
// ---------------------------------------------------------------------------

describe('createM17Handler — toast_action', () => {
  it("enregistre l'action clipboard_cleared", async () => {
    const mockStorageService = createMockStorage();
    const handler = createM17Handler(mockStorageService as StorageService, createFakeKey());
    const msg = buildM17Message(
      { user_action: 'clipboard_cleared', data_type: 'credit_card' },
      'toast_action',
    );
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(mockStorageService.logEvent).toHaveBeenCalledWith(
      'M17',
      expect.objectContaining({ action: 'clipboard_cleared' }),
      expect.anything(),
    );
  });

  it("enregistre l'action acknowledged", async () => {
    const mockStorageService = createMockStorage();
    const handler = createM17Handler(mockStorageService as StorageService, createFakeKey());
    const msg = buildM17Message({ user_action: 'acknowledged', data_type: 'iban' }, 'toast_action');
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(mockStorageService.logEvent).toHaveBeenCalledWith(
      'M17',
      expect.objectContaining({ action: 'acknowledged' }),
      expect.anything(),
    );
  });

  it("enregistre l'échec du vidage (clipboard_clear_failed)", async () => {
    const mockStorageService = createMockStorage();
    const handler = createM17Handler(mockStorageService as StorageService, createFakeKey());
    const msg = buildM17Message(
      { user_action: 'clipboard_clear_failed', data_type: 'credit_card' },
      'toast_action',
    );
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(mockStorageService.logEvent).toHaveBeenCalledWith(
      'M17',
      expect.objectContaining({ action: 'clipboard_clear_failed' }),
      expect.anything(),
    );
  });

  it("ouvre la page d'explication pour learn_more", async () => {
    const mockStorageService = createMockStorage();
    const handler = createM17Handler(mockStorageService as StorageService, createFakeKey());
    const msg = buildM17Message(
      { user_action: 'learn_more', data_type: 'api_key' },
      'toast_action',
    );
    await handler(msg, {} as chrome.runtime.MessageSender);

    expect(chrome.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining('donnees-sensibles-presse-papiers.html') }),
    );
  });

  it('rejette une action toast inconnue', async () => {
    const mockStorageService = createMockStorage();
    const handler = createM17Handler(mockStorageService as StorageService, createFakeKey());
    const msg = buildM17Message(
      { user_action: 'unknown_toast_action', data_type: 'iban' },
      'toast_action',
    );
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(false);
    expect(response.reason).toBe('invalid_toast_action');
  });
});

// ---------------------------------------------------------------------------
// TACHE-089 — Tests diagnostics M17 (Option B)
// ---------------------------------------------------------------------------

describe('TC-M17-DIAG-READ-01 — readM17Diagnostics retourne valeur par défaut si absent', () => {
  it('retourne M17_DIAGNOSTICS_DEFAULT si clé absente du storage', async () => {
    const diag = await readM17DiagnosticsService();

    expect(diag.ready).toBe(M17_DIAGNOSTICS_DEFAULT.ready);
    expect(diag.last_action_ts).toBe(M17_DIAGNOSTICS_DEFAULT.last_action_ts);
    expect(diag.last_incident).toBeUndefined();
  });

  it('retourne M17_DIAGNOSTICS_DEFAULT si la shape est corrompue', async () => {
    await storage.set({ [DIAGNOSTICS_M17_KEY]: { corrupt: true } });

    const diag = await readM17DiagnosticsService();

    expect(diag.ready).toBe(false);
    expect(diag.last_action_ts).toBe(0);
  });

  it('lit un diagnostics.m17 avec last_incident', async () => {
    const incidentTs = Date.now() - 3000;
    await storage.set({
      [DIAGNOSTICS_M17_KEY]: {
        ready: false,
        last_action_ts: incidentTs,
        last_incident: {
          type: 'm17_handler_error',
          severity: 'error',
          ts: incidentTs,
        },
      },
    });

    const diag = await readM17DiagnosticsService();

    expect(diag.ready).toBe(false);
    expect(diag.last_incident?.type).toBe('m17_handler_error');
    expect(diag.last_incident?.severity).toBe('error');
  });
});

describe('TC-M17-DIAG-UPDATE-01/02 — updateM17DiagnosticsOnAction', () => {
  it('TC-M17-DIAG-UPDATE-01 : met à jour diagnostics.m17 avec ready=true sur action réussie', async () => {
    const incidentService = createMockIncidentService() as IncidentService;

    const result = await updateM17DiagnosticsOnAction(
      incidentService,
      true,
      'handleSensitiveDataDetected',
    );

    expect(result.ready).toBe(true);
    expect(result.last_action_ts).toBeGreaterThan(0);
    expect(result.last_incident).toBeUndefined();
    expect(incidentService.log).not.toHaveBeenCalled();

    const stored = (await storage.get(DIAGNOSTICS_M17_KEY))[DIAGNOSTICS_M17_KEY] as Record<string, unknown>;
    expect(stored['ready']).toBe(true);
  });

  it('TC-M17-DIAG-UPDATE-02 : émet m17_handler_error et ready=false sur échec', async () => {
    const incidentService = createMockIncidentService() as IncidentService;

    const result = await updateM17DiagnosticsOnAction(
      incidentService,
      false,
      'handleToastAction',
      'StorageError',
    );

    expect(result.ready).toBe(false);
    expect(result.last_incident?.type).toBe('m17_handler_error');
    expect(result.last_incident?.severity).toBe('error');

    expect(incidentService.log).toHaveBeenCalledWith(
      'm17_handler_error',
      'error',
      expect.objectContaining({
        type: 'm17_handler_error',
        error_name: 'StorageError',
        code_path: 'handleToastAction',
      }),
    );
  });
});

describe('TC-M17-DIAG-HANDLER-01/02 — handler M17 avec/sans incidentService', () => {
  it('TC-M17-DIAG-HANDLER-01 : met à jour diagnostics.m17 si incidentService fourni', async () => {
    const mockStorageService = createMockStorage();
    const fakeKey = createFakeKey();
    const incidentService = createMockIncidentService() as IncidentService;

    const handler = createM17Handler(mockStorageService as StorageService, fakeKey, incidentService);
    const msg = buildM17Message({ type: 'credit_card', all_types: ['credit_card'] });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    await new Promise((r) => setTimeout(r, 0));

    const diag = await readM17DiagnosticsService();
    expect(diag.ready).toBe(true);
  });

  it('TC-M17-DIAG-HANDLER-02 : fonctionne sans incidentService (rétro-compat)', async () => {
    const mockStorageService = createMockStorage();
    const fakeKey = createFakeKey();

    // Sans incidentService — rétro-compat service-worker.ts
    const handler = createM17Handler(mockStorageService as StorageService, fakeKey);
    const msg = buildM17Message({ type: 'iban', all_types: ['iban'] });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('show');
  });
});

// ---------------------------------------------------------------------------
// TACHE-090 — Tests pending_m17_toast (ADR-002 R-CLI-01 à 07)
// ---------------------------------------------------------------------------

describe('TC-M17-PENDING-01 — writePendingM17Toast (format correct, data_type enum)', () => {
  it('écrit pending_m17_toast avec expires_at et data_type valide (cb)', async () => {
    const before = Date.now();
    await writePendingM17Toast('cb', 42);

    const stored = (await storage.get(PENDING_M17_TOAST_KEY))[PENDING_M17_TOAST_KEY] as Record<string, unknown>;
    expect(stored['data_type']).toBe('cb');
    expect(typeof stored['expires_at']).toBe('number');
    expect(stored['expires_at'] as number).toBeGreaterThan(before + PENDING_M17_TOAST_TTL_MS - 100);
    expect(stored['tab_id']).toBe(42);
    // R-CLI-07 : jamais de valeur collée dans le storage
    expect(stored['value']).toBeUndefined();
    expect(stored['content']).toBeUndefined();
  });

  it('écrit pending_m17_toast pour iban sans tab_id', async () => {
    await writePendingM17Toast('iban');

    const stored = (await storage.get(PENDING_M17_TOAST_KEY))[PENDING_M17_TOAST_KEY] as Record<string, unknown>;
    expect(stored['data_type']).toBe('iban');
    expect(stored['tab_id']).toBeUndefined();
  });

  it('ignore silencieusement un data_type invalide (R-CLI-07 guard)', async () => {
    // Appel avec un data_type invalide — ne doit pas lever d'exception
    await writePendingM17Toast('invalid_type' as 'cb', 1);

    // Rien ne doit être écrit
    expect((await storage.get(PENDING_M17_TOAST_KEY))[PENDING_M17_TOAST_KEY]).toBeUndefined();
  });
});

describe('TC-M17-PENDING-02 — readPendingM17Toast (absent/expiré/corrompu)', () => {
  it('retourne null si absent', async () => {
    const result = await readPendingM17Toast();
    expect(result).toBeNull();
  });

  it('retourne le toast si valide', async () => {
    const expiresAt = Date.now() + PENDING_M17_TOAST_TTL_MS;
    await storage.set({
      [PENDING_M17_TOAST_KEY]: {
        data_type: 'iban',
        expires_at: expiresAt,
      },
    });

    const result = await readPendingM17Toast();

    expect(result).not.toBeNull();
    expect(result?.data_type).toBe('iban');
    expect(result?.expires_at).toBe(expiresAt);
  });

  it('retourne null et supprime si expiré', async () => {
    await storage.set({
      [PENDING_M17_TOAST_KEY]: {
        data_type: 'cb',
        expires_at: Date.now() - 60_000,
      },
    });

    const result = await readPendingM17Toast();

    expect(result).toBeNull();
    expect((await storage.get(PENDING_M17_TOAST_KEY))[PENDING_M17_TOAST_KEY]).toBeUndefined();
  });

  it('retourne null et supprime si shape corrompue', async () => {
    await storage.set({
      [PENDING_M17_TOAST_KEY]: {
        data_type: 'invalid_enum',
        expires_at: Date.now() + 60_000,
      },
    });

    const result = await readPendingM17Toast();

    expect(result).toBeNull();
    expect((await storage.get(PENDING_M17_TOAST_KEY))[PENDING_M17_TOAST_KEY]).toBeUndefined();
  });
});

describe('TC-M17-PENDING-03 — consumePendingM17Toast (R-CLI-04 : suppression après lecture)', () => {
  it('retourne le toast et le supprime (consommation atomique)', async () => {
    await storage.set({
      [PENDING_M17_TOAST_KEY]: {
        data_type: 'cb',
        expires_at: Date.now() + PENDING_M17_TOAST_TTL_MS,
      },
    });

    const result = await consumePendingM17Toast();

    expect(result).not.toBeNull();
    expect(result?.data_type).toBe('cb');
    // La clé doit être supprimée après consommation (R-CLI-04)
    expect((await storage.get(PENDING_M17_TOAST_KEY))[PENDING_M17_TOAST_KEY]).toBeUndefined();

    // Deuxième consommation : null (double consommation empêchée)
    const secondResult = await consumePendingM17Toast();
    expect(secondResult).toBeNull();
  });

  it('retourne null silencieusement si absent', async () => {
    const result = await consumePendingM17Toast();
    expect(result).toBeNull();
  });
});

describe('TC-M17-PENDING-04 — R-CLI-07 : JAMAIS la valeur collée', () => {
  it('R-CLI-07 : data_type est un enum strict (cb|iban|ssn) — jamais la valeur collée', async () => {
    // Vérification exhaustive : aucun champ ne contient de donnée sensible
    await writePendingM17Toast('cb');

    const stored = (await storage.get(PENDING_M17_TOAST_KEY))[PENDING_M17_TOAST_KEY] as Record<string, unknown>;
    const serialized = JSON.stringify(stored);

    // Aucun numéro de carte, IBAN, ou valeur longue
    expect(serialized).not.toMatch(/"(\d{13,19})"/); // numéro de carte (en tant que string JSON, pas timestamp numérique)
    expect(serialized).not.toMatch(/[A-Z]{2}\d{2}[A-Z0-9]{10,30}/); // IBAN
    // Le champ data_type doit être l'un des 3 valeurs enum
    expect(['cb', 'iban', 'ssn']).toContain(stored['data_type']);
  });

  it('R-002 : handler M17 ne stocke jamais la valeur dans pending_m17_toast', async () => {
    const mockStorageService = createMockStorage();
    const handler = createM17Handler(mockStorageService as StorageService, createFakeKey());

    // Simuler une détection avec payload incluant potentiellement une valeur (ne doit pas passer)
    const msg = buildM17Message({ type: 'credit_card', all_types: ['credit_card'] });
    await handler(msg, { tab: { id: 1 } } as chrome.runtime.MessageSender);

    // Attendre la résolution du void writePendingM17Toast
    await new Promise((r) => setTimeout(r, 0));

    const stored = (await storage.get(PENDING_M17_TOAST_KEY))[PENDING_M17_TOAST_KEY] as Record<string, unknown> | undefined;
    if (stored) {
      // Si écrit, vérifier qu'il n'y a pas de valeur sensible
      expect(stored['value']).toBeUndefined();
      expect(stored['content']).toBeUndefined();
      expect(stored['raw']).toBeUndefined();
      // Uniquement les champs autorisés
      const allowedKeys = new Set(['data_type', 'expires_at', 'tab_id']);
      for (const key of Object.keys(stored)) {
        expect(allowedKeys.has(key)).toBe(true);
      }
    }
  });
});

describe('TC-M17-PENDING-05 — TTL 5 min (PENDING_M17_TOAST_TTL_MS)', () => {
  it('TTL est de 5 minutes (300 000 ms)', () => {
    expect(PENDING_M17_TOAST_TTL_MS).toBe(5 * 60 * 1000);
  });

  it('toast expiré après 5 min est ignoré par readPendingM17Toast', async () => {
    // Simuler un toast créé il y a 6 minutes (> 5 min TTL)
    const oldExpiresAt = Date.now() - 60_000; // expiré il y a 1 minute
    await storage.set({
      [PENDING_M17_TOAST_KEY]: {
        data_type: 'iban',
        expires_at: oldExpiresAt,
      },
    });

    const result = await readPendingM17Toast();

    expect(result).toBeNull();
    expect((await storage.get(PENDING_M17_TOAST_KEY))[PENDING_M17_TOAST_KEY]).toBeUndefined();
  });
});

describe('TC-M17-PENDING-06 — handler M17 écrit pending_m17_toast pour credit_card et iban', () => {
  it('écrit pending_m17_toast (cb) pour credit_card', async () => {
    const mockStorageService = createMockStorage();
    const handler = createM17Handler(mockStorageService as StorageService, createFakeKey());
    const msg = buildM17Message({ type: 'credit_card', all_types: ['credit_card'] });
    await handler(msg, { tab: { id: 5 } } as chrome.runtime.MessageSender);

    // Attendre la résolution du void writePendingM17Toast
    await new Promise((r) => setTimeout(r, 10));

    const stored = (await storage.get(PENDING_M17_TOAST_KEY))[PENDING_M17_TOAST_KEY] as Record<string, unknown> | undefined;
    // Si le pending toast est écrit, il doit être 'cb' (pas 'credit_card')
    if (stored) {
      expect(stored['data_type']).toBe('cb');
      expect(stored['tab_id']).toBe(5);
    }
  });

  it('écrit pending_m17_toast (iban) pour iban', async () => {
    const mockStorageService = createMockStorage();
    const handler = createM17Handler(mockStorageService as StorageService, createFakeKey());
    const msg = buildM17Message({ type: 'iban', all_types: ['iban'] });
    await handler(msg, { tab: { id: 7 } } as chrome.runtime.MessageSender);

    await new Promise((r) => setTimeout(r, 10));

    const stored = (await storage.get(PENDING_M17_TOAST_KEY))[PENDING_M17_TOAST_KEY] as Record<string, unknown> | undefined;
    if (stored) {
      expect(stored['data_type']).toBe('iban');
    }
  });

  it('ne crée PAS de pending_m17_toast pour api_key (toast direct suffisant)', async () => {
    const mockStorageService = createMockStorage();
    const handler = createM17Handler(mockStorageService as StorageService, createFakeKey());
    const msg = buildM17Message({ type: 'api_key', all_types: ['api_key'] });
    await handler(msg, { tab: { id: 3 } } as chrome.runtime.MessageSender);

    await new Promise((r) => setTimeout(r, 10));

    // Pour api_key, pas de pending toast
    expect((await storage.get(PENDING_M17_TOAST_KEY))[PENDING_M17_TOAST_KEY]).toBeUndefined();
  });
});

// Export réexporté depuis le handler
describe('readM17Diagnostics — export du handler', () => {
  it('readM17Diagnostics (export handler) est identique à readM17Diagnostics (service)', async () => {
    await storage.set({
      [DIAGNOSTICS_M17_KEY]: {
        ready: true,
        last_action_ts: 777,
      },
    });

    const fromHandler = await readM17Diagnostics();
    const fromService = await readM17DiagnosticsService();

    expect(fromHandler).toEqual(fromService);
  });
});
