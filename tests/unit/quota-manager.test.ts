/**
 * @file tests/unit/quota-manager.test.ts
 * @description Tests unitaires du gestionnaire de quota journalier.
 *
 * Ces tests vérifient le comportement du QuotaManager en isolation,
 * avec un mock de StorageService.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuotaManager } from '@/background/quota-manager';
import type { StorageService } from '@/background/storage-service';
import type { ChromeStorageSchema } from '@/shared/types/storage';

/** Mock minimal de StorageService */
function createMockStorage(
  quotaState: ChromeStorageSchema['quota_state'] | null,
  quotaLimit: 3 | 5 | 10 | null = 3,
): Partial<StorageService> {
  const today = new Date().toISOString().split('T')![0]!;
  return {
    getQuotaState: vi.fn().mockResolvedValue(quotaState),
    setQuotaState: vi.fn().mockResolvedValue(undefined),
    getConfig: vi.fn().mockResolvedValue({
      modules: {},
      quota_limit: quotaLimit,
      profile: 'beginner',
      onboarding_complete: false,
      language: 'fr',
    } as ChromeStorageSchema['config']),
  };
}

describe('QuotaManager.checkQuota', () => {
  let today: string;

  beforeEach(() => {
    today = new Date().toISOString().split('T')![0]!;
  });

  it('autorise toujours les modules critiques (bypass quota)', async () => {
    const storage = createMockStorage({ date: today, count: 99 });
    const qm = new QuotaManager(storage as StorageService);
    const result = await qm.checkQuota('M2', true);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeNull();
  });

  it('autorise si quota non atteint', async () => {
    const storage = createMockStorage({ date: today, count: 1 });
    const qm = new QuotaManager(storage as StorageService);
    const result = await qm.checkQuota('M6', false);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2); // 3 - 1 = 2
  });

  it('refuse si quota atteint (count >= limit)', async () => {
    const storage = createMockStorage({ date: today, count: 3 });
    const qm = new QuotaManager(storage as StorageService);
    const result = await qm.checkQuota('M6', false);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('autorise pour un nouveau jour (réinitialisation)', async () => {
    const yesterday = '2026-01-01';
    const storage = createMockStorage({ date: yesterday, count: 3 });
    const qm = new QuotaManager(storage as StorageService);
    const result = await qm.checkQuota('M6', false);
    expect(result.allowed).toBe(true);
  });

  it('autorise si quota illimité (null)', async () => {
    const storage = createMockStorage({ date: today, count: 100 }, null);
    const qm = new QuotaManager(storage as StorageService);
    const result = await qm.checkQuota('M6', false);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeNull();
  });
});

describe('QuotaManager.incrementQuota', () => {
  it('incrémente le compteur du jour courant', async () => {
    const today = new Date().toISOString().split('T')![0]!;
    const storage = createMockStorage({ date: today, count: 1 });
    const qm = new QuotaManager(storage as StorageService);
    await qm.incrementQuota();
    expect(storage.setQuotaState).toHaveBeenCalledWith({ date: today, count: 2 });
  });
});
