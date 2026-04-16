/**
 * @file tests/unit/services/heartbeat-service.test.ts
 * @description Tests unitaires du HeartbeatService — Heartbeat M7.
 *
 * Couvre les invariants :
 * - INV-01  : ready=true implique canary_verified=true
 * - INV-02  : boot_count est monotone croissant
 * - INV-05  : last_boot_ts mis à jour même en cas d'échec
 * - TC-M7-17 : deuxième boot incrémente boot_count et met à jour last_boot_ts
 * - TC-M7-18 : onDetection() met à jour last_detection_ts dans les 100ms
 * - TC-M7-21 : read() retourne les valeurs par défaut si diagnostics.m7 absent
 *
 * Référence : Mini-DAT TACHE-061 §7 (plan de tests)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeartbeatService } from '@/background/services/heartbeat-service';
import { DIAGNOSTICS_M7_KEY, M7_DIAGNOSTICS_DEFAULT } from '@/shared/types/diagnostics';

// ---------------------------------------------------------------------------
// Mock chrome.storage.local
// ---------------------------------------------------------------------------
const mockLocalStorage: Record<string, unknown> = {};

global.chrome = {
  storage: {
    local: {
      get: vi.fn((_keys: string[], callback: (r: Record<string, unknown>) => void) => {
        callback({ ...mockLocalStorage });
      }),
      set: vi.fn((items: Record<string, unknown>, callback?: () => void) => {
        Object.assign(mockLocalStorage, items);
        callback?.();
      }),
    },
  },
} as unknown as typeof chrome;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HeartbeatService', () => {
  let service: HeartbeatService;

  beforeEach(() => {
    // Réinitialiser le storage avant chaque test
    Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]);
    vi.clearAllMocks();
    service = new HeartbeatService();
  });

  // TC-M7-21 — INV-01/INV-02
  it('TC-M7-21 : read() retourne les valeurs par défaut si diagnostics.m7 absent', async () => {
    const result = await service.read();
    expect(result).toEqual(M7_DIAGNOSTICS_DEFAULT);
    expect(result.ready).toBe(false);
    expect(result.boot_count).toBe(0);
    expect(result.last_detection_ts).toBeNull();
    expect(result.canary_verified).toBe(false);
    expect(result.last_boot_ts).toBe(0);
  });

  it('read() retourne les valeurs par défaut si la valeur stockée est corrompue (non-objet)', async () => {
    mockLocalStorage[DIAGNOSTICS_M7_KEY] = 'invalid_string';
    const result = await service.read();
    expect(result).toEqual(M7_DIAGNOSTICS_DEFAULT);
  });

  it('read() retourne les valeurs par défaut si les champs obligatoires sont absents', async () => {
    mockLocalStorage[DIAGNOSTICS_M7_KEY] = { ready: true }; // boot_count manquant
    const result = await service.read();
    expect(result).toEqual(M7_DIAGNOSTICS_DEFAULT);
  });

  it('write() persiste le heartbeat dans chrome.storage.local', async () => {
    const diagnostics = {
      ready: true,
      last_boot_ts: 1000,
      last_detection_ts: null,
      boot_count: 3,
      canary_verified: true,
    };
    await service.write(diagnostics);
    const readBack = await service.read();
    expect(readBack).toEqual(diagnostics);
  });

  // TC-M7-17 (partie 1 — premier boot)
  it('TC-M7-13 : onBootStart() incrémente boot_count et met last_boot_ts à jour', async () => {
    const before = Date.now();
    const result = await service.onBootStart();
    const after = Date.now();

    expect(result.boot_count).toBe(1);
    expect(result.ready).toBe(false);
    expect(result.canary_verified).toBe(false);
    expect(result.last_boot_ts).toBeGreaterThanOrEqual(before);
    expect(result.last_boot_ts).toBeLessThanOrEqual(after);
  });

  // TC-M7-17 (partie 2 — deuxième boot)
  it('TC-M7-17 : deuxième onBootStart() incrémente boot_count de 1 à 2', async () => {
    await service.onBootStart();
    const secondBoot = await service.onBootStart();
    expect(secondBoot.boot_count).toBe(2);
  });

  // INV-02 : boot_count monotone croissant
  it('INV-02 : boot_count est strictement monotone croissant sur 5 boots', async () => {
    let prevCount = -1;
    for (let i = 0; i < 5; i++) {
      const result = await service.onBootStart();
      expect(result.boot_count).toBeGreaterThan(prevCount);
      prevCount = result.boot_count;
    }
  });

  // INV-01 : ready=true implique canary_verified=true
  it('INV-01 : onBootSuccess() met ready=true ET canary_verified=true', async () => {
    await service.onBootStart();
    await service.onBootSuccess();
    const result = await service.read();
    expect(result.ready).toBe(true);
    expect(result.canary_verified).toBe(true);
  });

  it('onBootFailure() met ready=false et canary_verified=false', async () => {
    await service.onBootStart();
    await service.onBootSuccess();
    await service.onBootFailure();
    const result = await service.read();
    expect(result.ready).toBe(false);
    expect(result.canary_verified).toBe(false);
  });

  // INV-05 : last_boot_ts mis à jour même en cas d'échec
  it('INV-05 : last_boot_ts est mis à jour par onBootStart() même si onBootFailure() est appelé ensuite', async () => {
    const before = Date.now();
    await service.onBootStart();
    await service.onBootFailure();
    const result = await service.read();
    expect(result.last_boot_ts).toBeGreaterThanOrEqual(before);
    expect(result.ready).toBe(false);
  });

  // TC-M7-18 : onDetection() met à jour last_detection_ts dans les 100ms
  it('TC-M7-18 : onDetection() met à jour last_detection_ts', async () => {
    await service.onBootStart();
    await service.onBootSuccess();
    const before = Date.now();
    await service.onDetection();
    const after = Date.now();

    const result = await service.read();
    expect(result.last_detection_ts).not.toBeNull();
    expect(result.last_detection_ts).toBeGreaterThanOrEqual(before);
    expect(result.last_detection_ts).toBeLessThanOrEqual(after + 100);
    // Vérifier que les autres champs ne sont pas modifiés
    expect(result.ready).toBe(true);
    expect(result.boot_count).toBe(1);
  });

  it('setReady(false) remet canary_verified=false (invariant INV-01)', async () => {
    await service.onBootStart();
    await service.onBootSuccess();
    await service.setReady(false);
    const result = await service.read();
    expect(result.ready).toBe(false);
    expect(result.canary_verified).toBe(false);
  });

  it('setReady(true) ne modifie pas canary_verified si déjà true', async () => {
    await service.onBootStart();
    await service.onBootSuccess();
    await service.setReady(true);
    const result = await service.read();
    expect(result.ready).toBe(true);
    expect(result.canary_verified).toBe(true);
  });
});
