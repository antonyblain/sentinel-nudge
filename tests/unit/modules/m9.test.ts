/**
 * @file tests/unit/modules/m9.test.ts
 * @description Tests unitaires du handler M9 — indicateur de force mot de passe.
 *
 * Vérifie :
 * - Enregistrement de l'évaluation correcte au submit
 * - Rejet des payloads invalides (score hors plage, type inconnu)
 * - Réponse 'skip' correcte (M9 ne déclenche pas d'affichage côté SW)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createM9Handler } from '@/background/handlers/m9-handler';
import type { StorageService } from '@/background/storage-service';
import type { NudgeMessage } from '@/shared/types/messages';

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
