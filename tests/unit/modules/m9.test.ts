/**
 * @file tests/unit/modules/m9.test.ts
 * @description Tests unitaires du handler M9 — indicateur de force mot de passe.
 *
 * Vérifie :
 * - Enregistrement de l'évaluation correcte au submit
 * - Rejet des payloads invalides (score hors plage, type inconnu)
 * - Réponse 'skip' correcte (M9 ne déclenche pas d'affichage côté SW)
 *
 * TACHE-089 — diagnostics M9 (Option B) :
 * - TC-M9-DIAG-READ-01 : readM9Diagnostics retourne la valeur par défaut si absent
 * - TC-M9-DIAG-UPDATE-01 : updateM9DiagnosticsOnAction met à jour diagnostics.m9 (succès)
 * - TC-M9-DIAG-UPDATE-02 : updateM9DiagnosticsOnAction émet incident m9_handler_error (échec)
 * - TC-M9-DIAG-HANDLER-01 : handler M9 met à jour diagnostics si incidentService fourni
 * - TC-M9-DIAG-HANDLER-02 : handler M9 sans incidentService — fonctionne sans diagnostic
 *
 * T-189 lot 3 : mock inline remplacé par createMockChromeStorage() (wrapper JSON-strict P-018).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createM9Handler, readM9Diagnostics } from '@/background/handlers/m9-handler';
import { readM9Diagnostics as readM9DiagnosticsService, updateM9DiagnosticsOnAction } from '@/background/services/m9-boot-service';
import type { StorageService } from '@/background/storage-service';
import type { NudgeMessage } from '@/shared/types/messages';
import type { IncidentService } from '@/background/services/incident-service';
import { DIAGNOSTICS_M9_KEY, M9_DIAGNOSTICS_DEFAULT } from '@/shared/types/diagnostics';
import { createMockChromeStorage } from '../../helpers/mock-chrome-storage';

// ---------------------------------------------------------------------------
// Mock chrome.storage.local — wrapper JSON-strict T-189 / P-018
// ---------------------------------------------------------------------------

const { storage, reset: resetStorage } = createMockChromeStorage();

global.chrome = {
  storage: {
    local: storage,
  },
} as unknown as typeof chrome;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Crée un mock minimal de StorageService pour les tests M9 */
function createMockStorage(): Partial<StorageService> {
  return {
    logEvent: vi.fn().mockResolvedValue(42),
  };
}

/** Crée une CryptoKey factice pour les tests (non utilisée en prod dans ce handler) */
function createFakeKey(): CryptoKey {
  return {} as CryptoKey;
}

/** Construit un NudgeMessage M9 avec le payload donné */
function buildM9Message(payload: Record<string, unknown>): NudgeMessage {
  return {
    module: 'M9',
    action: 'password_evaluated',
    payload,
    timestamp: Date.now(),
  };
}

/** Crée un mock de IncidentService */
function createMockIncidentService(): Partial<IncidentService> {
  return {
    log: vi.fn().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetStorage();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests handler M9 existants
// ---------------------------------------------------------------------------

describe('createM9Handler', () => {
  let mockStorage: Partial<StorageService>;
  let fakeKey: CryptoKey;

  beforeEach(() => {
    mockStorage = createMockStorage();
    fakeKey = createFakeKey();
  });

  describe('payloads valides', () => {
    it('enregistre un score 0 (très faible) de type password', async () => {
      const handler = createM9Handler(mockStorage as StorageService, fakeKey);
      const msg = buildM9Message({ score: 0, type: 'password' });
      const response = await handler(msg, {} as chrome.runtime.MessageSender);

      expect(response.success).toBe(true);
      expect(response.action).toBe('skip');
      expect(mockStorage.logEvent).toHaveBeenCalledOnce();
      expect(mockStorage.logEvent).toHaveBeenCalledWith(
        'M9',
        expect.objectContaining({
          module_data: expect.objectContaining({
            strength_score: 0,
            input_type: 'password',
            is_strong: false,
          }),
        }),
        fakeKey,
      );
    });

    it('enregistre un score 3 (fort) — is_strong=true', async () => {
      const handler = createM9Handler(mockStorage as StorageService, fakeKey);
      const msg = buildM9Message({ score: 3, type: 'password' });
      const response = await handler(msg, {} as chrome.runtime.MessageSender);

      expect(response.success).toBe(true);
      expect(mockStorage.logEvent).toHaveBeenCalledWith(
        'M9',
        expect.objectContaining({
          module_data: expect.objectContaining({
            strength_score: 3,
            is_strong: true,
          }),
        }),
        fakeKey,
      );
    });

    it('enregistre un score 4 (très fort) de type passphrase', async () => {
      const handler = createM9Handler(mockStorage as StorageService, fakeKey);
      const msg = buildM9Message({ score: 4, type: 'passphrase' });
      const response = await handler(msg, {} as chrome.runtime.MessageSender);

      expect(response.success).toBe(true);
      expect(mockStorage.logEvent).toHaveBeenCalledWith(
        'M9',
        expect.objectContaining({
          module_data: expect.objectContaining({
            strength_score: 4,
            input_type: 'passphrase',
            is_strong: true,
          }),
        }),
        fakeKey,
      );
    });

    it('score 2 (moyen) — is_strong=false', async () => {
      const handler = createM9Handler(mockStorage as StorageService, fakeKey);
      const msg = buildM9Message({ score: 2, type: 'password' });
      const response = await handler(msg, {} as chrome.runtime.MessageSender);

      expect(response.success).toBe(true);
      expect(mockStorage.logEvent).toHaveBeenCalledWith(
        'M9',
        expect.objectContaining({
          module_data: expect.objectContaining({ is_strong: false }),
        }),
        fakeKey,
      );
    });
  });

  describe('payloads invalides', () => {
    it('rejette un score hors plage (score = 5)', async () => {
      const handler = createM9Handler(mockStorage as StorageService, fakeKey);
      const msg = buildM9Message({ score: 5, type: 'password' });
      const response = await handler(msg, {} as chrome.runtime.MessageSender);

      expect(response.success).toBe(false);
      expect(response.action).toBe('skip');
      expect(response.reason).toBe('invalid_payload_score');
      expect(mockStorage.logEvent).not.toHaveBeenCalled();
    });

    it('rejette un score négatif (score = -1)', async () => {
      const handler = createM9Handler(mockStorage as StorageService, fakeKey);
      const msg = buildM9Message({ score: -1, type: 'password' });
      const response = await handler(msg, {} as chrome.runtime.MessageSender);

      expect(response.success).toBe(false);
      expect(response.reason).toBe('invalid_payload_score');
    });

    it('rejette un score non-numérique (score = "fort")', async () => {
      const handler = createM9Handler(mockStorage as StorageService, fakeKey);
      const msg = buildM9Message({ score: 'fort', type: 'password' });
      const response = await handler(msg, {} as chrome.runtime.MessageSender);

      expect(response.success).toBe(false);
      expect(response.reason).toBe('invalid_payload_score');
    });

    it('rejette un type inconnu (type = "pin")', async () => {
      const handler = createM9Handler(mockStorage as StorageService, fakeKey);
      const msg = buildM9Message({ score: 3, type: 'pin' });
      const response = await handler(msg, {} as chrome.runtime.MessageSender);

      expect(response.success).toBe(false);
      expect(response.reason).toBe('invalid_payload_type');
      expect(mockStorage.logEvent).not.toHaveBeenCalled();
    });

    it('rejette un payload sans score', async () => {
      const handler = createM9Handler(mockStorage as StorageService, fakeKey);
      const msg = buildM9Message({ type: 'password' });
      const response = await handler(msg, {} as chrome.runtime.MessageSender);

      expect(response.success).toBe(false);
    });
  });

  describe('gestion des erreurs de stockage', () => {
    it('retourne une erreur si logEvent lève une exception', async () => {
      const failingStorage: Partial<StorageService> = {
        logEvent: vi.fn().mockRejectedValue(new Error('IDB indisponible')),
      };
      const handler = createM9Handler(failingStorage as StorageService, fakeKey);
      const msg = buildM9Message({ score: 3, type: 'password' });
      const response = await handler(msg, {} as chrome.runtime.MessageSender);

      expect(response.success).toBe(false);
      expect(response.action).toBe('error');
      expect(response.reason).toBe('storage_error');
    });
  });
});

// ---------------------------------------------------------------------------
// TACHE-089 — Tests diagnostics M9 (Option B)
// ---------------------------------------------------------------------------

describe('TC-M9-DIAG-READ-01 — readM9Diagnostics retourne valeur par défaut si absent', () => {
  it('retourne M9_DIAGNOSTICS_DEFAULT si clé absente du storage', async () => {
    const diag = await readM9DiagnosticsService();

    expect(diag.ready).toBe(M9_DIAGNOSTICS_DEFAULT.ready);
    expect(diag.last_action_ts).toBe(M9_DIAGNOSTICS_DEFAULT.last_action_ts);
    expect(diag.last_incident).toBeUndefined();
  });

  it('retourne M9_DIAGNOSTICS_DEFAULT si la shape est corrompue', async () => {
    await storage.set({ [DIAGNOSTICS_M9_KEY]: { corrupt: true } });

    const diag = await readM9DiagnosticsService();

    expect(diag.ready).toBe(false);
    expect(diag.last_action_ts).toBe(0);
  });

  it('lit un diagnostics.m9 valide depuis le storage', async () => {
    await storage.set({ [DIAGNOSTICS_M9_KEY]: { ready: true, last_action_ts: 1234567890 } });

    const diag = await readM9DiagnosticsService();

    expect(diag.ready).toBe(true);
    expect(diag.last_action_ts).toBe(1234567890);
    expect(diag.last_incident).toBeUndefined();
  });

  it('lit un diagnostics.m9 avec last_incident', async () => {
    const incidentTs = Date.now() - 5000;
    await storage.set({
      [DIAGNOSTICS_M9_KEY]: {
        ready: false,
        last_action_ts: incidentTs,
        last_incident: {
          type: 'm9_handler_error',
          severity: 'error',
          ts: incidentTs,
        },
      },
    });

    const diag = await readM9DiagnosticsService();

    expect(diag.ready).toBe(false);
    expect(diag.last_incident?.type).toBe('m9_handler_error');
    expect(diag.last_incident?.severity).toBe('error');
  });
});

describe('TC-M9-DIAG-UPDATE-01 — updateM9DiagnosticsOnAction (succès)', () => {
  it('met à jour diagnostics.m9 avec ready=true sur action réussie', async () => {
    const incidentService = createMockIncidentService() as IncidentService;

    const result = await updateM9DiagnosticsOnAction(incidentService, true);

    expect(result.ready).toBe(true);
    expect(result.last_action_ts).toBeGreaterThan(0);
    expect(result.last_incident).toBeUndefined();

    // Vérifie la persistance dans le storage
    const stored = (await storage.get(DIAGNOSTICS_M9_KEY))[DIAGNOSTICS_M9_KEY] as Record<string, unknown>;
    expect(stored['ready']).toBe(true);

    // Aucun incident émis
    expect(incidentService.log).not.toHaveBeenCalled();
  });
});

describe('TC-M9-DIAG-UPDATE-02 — updateM9DiagnosticsOnAction (échec + incident)', () => {
  it('émet un incident m9_handler_error et met diagnostics ready=false sur échec', async () => {
    const incidentService = createMockIncidentService() as IncidentService;

    const result = await updateM9DiagnosticsOnAction(incidentService, false, 'IDBTransactionError');

    expect(result.ready).toBe(false);
    expect(result.last_action_ts).toBeGreaterThan(0);
    expect(result.last_incident?.type).toBe('m9_handler_error');
    expect(result.last_incident?.severity).toBe('error');

    // Incident émis avec le bon contexte
    expect(incidentService.log).toHaveBeenCalledWith(
      'm9_handler_error',
      'error',
      expect.objectContaining({
        type: 'm9_handler_error',
        error_name: 'IDBTransactionError',
      }),
    );
  });

  it('utilise "UnknownError" si errorName absent', async () => {
    const incidentService = createMockIncidentService() as IncidentService;

    await updateM9DiagnosticsOnAction(incidentService, false);

    expect(incidentService.log).toHaveBeenCalledWith(
      'm9_handler_error',
      'error',
      expect.objectContaining({ error_name: 'UnknownError' }),
    );
  });
});

describe('TC-M9-DIAG-HANDLER-01 — handler M9 avec incidentService', () => {
  it('met à jour diagnostics.m9 après logEvent réussi', async () => {
    const mockStorageService = createMockStorage();
    const fakeKey = createFakeKey();
    const incidentService = createMockIncidentService() as IncidentService;

    const handler = createM9Handler(mockStorageService as StorageService, fakeKey, incidentService);
    const msg = buildM9Message({ score: 3, type: 'password' });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    // Laisser le microtask queue se vider (void updateM9DiagnosticsOnAction)
    await new Promise((r) => setTimeout(r, 0));

    const diag = await readM9DiagnosticsService();
    expect(diag.ready).toBe(true);
  });

  it('émet m9_handler_error si logEvent échoue', async () => {
    const failingStorage: Partial<StorageService> = {
      logEvent: vi.fn().mockRejectedValue(new Error('IDB fail')),
    };
    const fakeKey = createFakeKey();
    const incidentService = createMockIncidentService() as IncidentService;

    const handler = createM9Handler(failingStorage as StorageService, fakeKey, incidentService);
    const msg = buildM9Message({ score: 2, type: 'password' });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(false);
    expect(response.action).toBe('error');
    // Laisser le microtask queue se vider
    await new Promise((r) => setTimeout(r, 0));

    expect(incidentService.log).toHaveBeenCalledWith(
      'm9_handler_error',
      'error',
      expect.objectContaining({ type: 'm9_handler_error' }),
    );
  });
});

describe('TC-M9-DIAG-HANDLER-02 — handler M9 sans incidentService (rétro-compatibilité)', () => {
  it('fonctionne correctement sans incidentService (paramètre optionnel)', async () => {
    const mockStorageService = createMockStorage();
    const fakeKey = createFakeKey();

    // Sans incidentService — rétro-compat service-worker.ts
    const handler = createM9Handler(mockStorageService as StorageService, fakeKey);
    const msg = buildM9Message({ score: 4, type: 'passphrase' });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('skip');
    expect(mockStorageService.logEvent).toHaveBeenCalledOnce();
  });

  it('retourne une erreur sans incidentService si logEvent échoue', async () => {
    const failingStorage: Partial<StorageService> = {
      logEvent: vi.fn().mockRejectedValue(new Error('IDB fail')),
    };
    const fakeKey = createFakeKey();

    const handler = createM9Handler(failingStorage as StorageService, fakeKey);
    const msg = buildM9Message({ score: 1, type: 'password' });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(false);
    expect(response.action).toBe('error');
    // Aucune exception non gérée — ne doit pas rejeter
  });
});

// Export réexporté depuis le handler
describe('readM9Diagnostics — export du handler', () => {
  it('readM9Diagnostics (export handler) est identique à readM9Diagnostics (service)', async () => {
    await storage.set({
      [DIAGNOSTICS_M9_KEY]: {
        ready: true,
        last_action_ts: 999,
      },
    });

    const fromHandler = await readM9Diagnostics();
    const fromService = await readM9DiagnosticsService();

    expect(fromHandler).toEqual(fromService);
  });
});
