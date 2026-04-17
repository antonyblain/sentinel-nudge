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
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectSensitiveTypes,
  luhnCheck,
  ibanModulo97,
  shannonEntropy,
} from '@/content-scripts/detectors/paste-detector';
import { createM17Handler } from '@/background/handlers/m17-handler';
import type { StorageService } from '@/background/storage-service';
import type { NudgeMessage } from '@/shared/types/messages';

// ---------------------------------------------------------------------------
// Setup : mock chrome pour les tests du handler
// ---------------------------------------------------------------------------

global.chrome = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejette un type invalide', async () => {
    const storage = createMockStorage();
    const handler = createM17Handler(storage as StorageService, createFakeKey());
    const msg = buildM17Message({ type: 'bank_account', all_types: ['bank_account'] });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(false);
    expect(response.reason).toBe('invalid_data_type');
  });

  it('rejette un payload sans type', async () => {
    const storage = createMockStorage();
    const handler = createM17Handler(storage as StorageService, createFakeKey());
    const msg = buildM17Message({ all_types: ['iban'] });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(false);
    expect(response.reason).toBe('invalid_data_type');
  });

  it('rejette une action inconnue', async () => {
    const storage = createMockStorage();
    const handler = createM17Handler(storage as StorageService, createFakeKey());
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retourne show pour un type credit_card valide', async () => {
    const storage = createMockStorage();
    const handler = createM17Handler(storage as StorageService, createFakeKey());
    const msg = buildM17Message({ type: 'credit_card', all_types: ['credit_card'] });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('show');
    expect(response.data?.['data_type']).toBe('credit_card');
  });

  it('retourne show pour un type iban valide', async () => {
    const storage = createMockStorage();
    const handler = createM17Handler(storage as StorageService, createFakeKey());
    const msg = buildM17Message({ type: 'iban', all_types: ['iban'] });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('show');
  });

  it('retourne show pour un type api_key valide', async () => {
    const storage = createMockStorage();
    const handler = createM17Handler(storage as StorageService, createFakeKey());
    const msg = buildM17Message({ type: 'api_key', all_types: ['api_key'] });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('show');
  });

  it("enregistre l'événement avec le type détecté (pas la valeur)", async () => {
    const storage = createMockStorage();
    const handler = createM17Handler(storage as StorageService, createFakeKey());
    const msg = buildM17Message({ type: 'iban', all_types: ['iban'] });
    await handler(msg, {} as chrome.runtime.MessageSender);

    expect(storage.logEvent).toHaveBeenCalledWith(
      'M17',
      expect.objectContaining({
        action: 'detected',
        module_data: expect.objectContaining({ data_type: 'iban' }),
      }),
      expect.anything(),
    );
  });

  it("N'expose jamais de valeur sensible dans le payload logué", async () => {
    const storage = createMockStorage();
    const handler = createM17Handler(storage as StorageService, createFakeKey());
    const msg = buildM17Message({ type: 'credit_card', all_types: ['credit_card'] });
    await handler(msg, {} as chrome.runtime.MessageSender);

    // Vérifier que logEvent n'a jamais été appelé avec du contenu ressemblant à un numéro de carte
    const calls = vi.mocked(storage.logEvent!).mock.calls;
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enregistre l'action clipboard_cleared", async () => {
    const storage = createMockStorage();
    const handler = createM17Handler(storage as StorageService, createFakeKey());
    const msg = buildM17Message(
      { user_action: 'clipboard_cleared', data_type: 'credit_card' },
      'toast_action',
    );
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(storage.logEvent).toHaveBeenCalledWith(
      'M17',
      expect.objectContaining({ action: 'clipboard_cleared' }),
      expect.anything(),
    );
  });

  it("enregistre l'action acknowledged", async () => {
    const storage = createMockStorage();
    const handler = createM17Handler(storage as StorageService, createFakeKey());
    const msg = buildM17Message({ user_action: 'acknowledged', data_type: 'iban' }, 'toast_action');
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(storage.logEvent).toHaveBeenCalledWith(
      'M17',
      expect.objectContaining({ action: 'acknowledged' }),
      expect.anything(),
    );
  });

  it("enregistre l'échec du vidage (clipboard_clear_failed)", async () => {
    const storage = createMockStorage();
    const handler = createM17Handler(storage as StorageService, createFakeKey());
    const msg = buildM17Message(
      { user_action: 'clipboard_clear_failed', data_type: 'credit_card' },
      'toast_action',
    );
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(storage.logEvent).toHaveBeenCalledWith(
      'M17',
      expect.objectContaining({ action: 'clipboard_clear_failed' }),
      expect.anything(),
    );
  });

  it("ouvre la page d'explication pour learn_more", async () => {
    const storage = createMockStorage();
    const handler = createM17Handler(storage as StorageService, createFakeKey());
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
    const storage = createMockStorage();
    const handler = createM17Handler(storage as StorageService, createFakeKey());
    const msg = buildM17Message(
      { user_action: 'unknown_toast_action', data_type: 'iban' },
      'toast_action',
    );
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(false);
    expect(response.reason).toBe('invalid_toast_action');
  });
});
