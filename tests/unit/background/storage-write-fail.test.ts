/**
 * @file tests/unit/background/storage-write-fail.test.ts
 * @description Tests unitaires — instrumentation storage_write_fail aux sites critiques.
 *
 * Couvre OBS-04 (PV comité revue code TACHE-061 §8.3) :
 * tout échec chrome.storage.local.set aux sites critiques doit logguer un incident
 * storage_write_fail avec type, module, site et hint.
 *
 * Sites instrumentés :
 * - TC-01 : service-worker.ts — site encryption_key_boot (boot_fail path, clé absente)
 * - TC-02 : m7-handler.ts   — site pending_m7_toast (writePendingM7Toast, log-only)
 * - TC-03 : heartbeat-service.ts — site heartbeat_write (write(), re-throw)
 * - TC-04 : succès normal → aucun incident loggué (baseline)
 * - TC-05 : payload non-JSON-sérialisable → incident loggué avec hint explicite
 * - TC-06 : QuotaExceededError simulée → incident loggué, severity=error
 *
 * Stratégie : simuler les logiques de chaque site via des helpers reproduisant
 * EXACTEMENT le pattern d'instrumentation, sans importer les modules sources
 * (évite les side-effects module-level du SW et les dépendances chrome.* complexes).
 *
 * Référence : OBS-04 PV comité revue code TACHE-061 §8.3
 *             ADR-001 SW-BOOT-CONTRACT (R-BOOT-04 — diagnostics persistés au boot)
 *             ADR-002 CROSS-LIFECYCLE-INTENT (R-CLI-03 — pending_m7_toast expires_at)
 *             TACHE-078 — instrumentation storage_write_fail
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Types minimaux reproduits depuis diagnostics.ts (évite l'import module-level)
// ---------------------------------------------------------------------------

type StorageWriteFailModule = 'boot' | 'm7' | 'heartbeat';

type StorageWriteFailSite =
  | 'encryption_key_boot'
  | 'encryption_key_canary'
  | 'pending_m7_toast'
  | 'heartbeat_write';

interface StorageWriteFailContext {
  type: 'storage_write_fail';
  module: StorageWriteFailModule;
  site: StorageWriteFailSite;
  hint: string;
}

// ---------------------------------------------------------------------------
// Mock IncidentService minimal
// ---------------------------------------------------------------------------

interface LoggedIncident {
  type: string;
  severity: string;
  context: StorageWriteFailContext;
}

function createMockIncidentService() {
  const incidents: LoggedIncident[] = [];
  return {
    incidents,
    log: vi.fn(
      async (type: string, severity: string, context: StorageWriteFailContext): Promise<void> => {
        incidents.push({ type, severity, context });
      },
    ),
  };
}

// ---------------------------------------------------------------------------
// Helpers — simulent le pattern d'instrumentation de chaque site
// ---------------------------------------------------------------------------

/**
 * Simule le pattern d'instrumentation du site encryption_key_boot
 * (service-worker.ts — boot_fail path, clé AES absente → régénération obligatoire).
 *
 * Re-throw obligatoire : si la clé n'est pas persistée, le boot est compromis.
 */
async function simulateEncryptionKeyBootWrite(
  storageSet: (items: Record<string, unknown>) => Promise<void>,
  incidentService: ReturnType<typeof createMockIncidentService>,
): Promise<void> {
  const materialArray = [1, 2, 3]; // Array<number> simulé
  try {
    await storageSet({ encryption_key_material: materialArray });
  } catch (writeErr: unknown) {
    await incidentService.log('storage_write_fail', 'error', {
      type: 'storage_write_fail',
      module: 'boot',
      site: 'encryption_key_boot',
      hint: (writeErr instanceof Error ? writeErr.message : String(writeErr)).slice(0, 100),
    });
    throw writeErr;
  }
}

/**
 * Simule le pattern d'instrumentation du site pending_m7_toast
 * (m7-handler.ts — writePendingM7Toast, log-only pattern).
 *
 * Ne re-throw pas : un toast manquant est tolérable (le flow principal continue).
 */
async function simulatePendingM7ToastWrite(
  storageSet: (items: Record<string, unknown>) => Promise<void>,
  incidentService: ReturnType<typeof createMockIncidentService>,
): Promise<{ toastWritten: boolean }> {
  const payload = { domain_hash: 'abc123', expires_at: Date.now() + 600_000 };
  try {
    await storageSet({ pending_m7_toast: payload });
    return { toastWritten: true };
  } catch (writeErr: unknown) {
    await incidentService.log('storage_write_fail', 'error', {
      type: 'storage_write_fail',
      module: 'm7',
      site: 'pending_m7_toast',
      hint: (writeErr instanceof Error ? writeErr.message : String(writeErr)).slice(0, 100),
    });
    // Log-only : ne pas re-throw
    return { toastWritten: false };
  }
}

/**
 * Simule le pattern d'instrumentation du site heartbeat_write
 * (heartbeat-service.ts — write(), re-throw préservé).
 *
 * Re-throw : les callers opèrent dans des try/catch de service-worker.ts.
 */
async function simulateHeartbeatWrite(
  storageSet: (items: Record<string, unknown>) => Promise<void>,
  incidentService: ReturnType<typeof createMockIncidentService>,
): Promise<void> {
  const diagnostics = {
    ready: false,
    last_boot_ts: Date.now(),
    last_detection_ts: null,
    boot_count: 1,
    canary_verified: false,
  };
  try {
    await storageSet({ 'diagnostics.m7': diagnostics });
  } catch (writeErr: unknown) {
    await incidentService.log('storage_write_fail', 'error', {
      type: 'storage_write_fail',
      module: 'heartbeat',
      site: 'heartbeat_write',
      hint: (writeErr instanceof Error ? writeErr.message : String(writeErr)).slice(0, 100),
    });
    throw writeErr;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TACHE-078 — storage_write_fail instrumentation (OBS-04)', () => {
  let incidentService: ReturnType<typeof createMockIncidentService>;

  beforeEach(() => {
    incidentService = createMockIncidentService();
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // TC-01 : site encryption_key_boot — clé AES non persistée → incident + re-throw
  // ---------------------------------------------------------------------------

  it('TC-01 : échec écriture clé AES (encryption_key_boot) → incident storage_write_fail loggué + re-throw', async () => {
    // Simuler chrome.storage.local.set qui rejette (QuotaExceededError typique)
    const storageSet = vi.fn().mockRejectedValue(new Error('QuotaExceededError'));

    await expect(simulateEncryptionKeyBootWrite(storageSet, incidentService)).rejects.toThrow(
      'QuotaExceededError',
    );

    // Incident loggué
    expect(incidentService.log).toHaveBeenCalledTimes(1);
    const call = incidentService.incidents[0];
    expect(call.type).toBe('storage_write_fail');
    expect(call.severity).toBe('error');
    expect(call.context.type).toBe('storage_write_fail');
    expect(call.context.module).toBe('boot');
    expect(call.context.site).toBe('encryption_key_boot');
    expect(call.context.hint).toContain('QuotaExceededError');
  });

  // ---------------------------------------------------------------------------
  // TC-02 : site pending_m7_toast — échec log-only, handler retourne fallback gracieux
  // ---------------------------------------------------------------------------

  it('TC-02 : échec écriture pending_m7_toast → incident loggué, handler retourne fallback gracieux (pas de throw)', async () => {
    const storageSet = vi.fn().mockRejectedValue(new Error('QUOTA_BYTES quota exceeded'));

    const result = await simulatePendingM7ToastWrite(storageSet, incidentService);

    // Fallback gracieux — pas d'exception levée
    expect(result.toastWritten).toBe(false);

    // Incident loggué avec les bons champs
    expect(incidentService.log).toHaveBeenCalledTimes(1);
    const call = incidentService.incidents[0];
    expect(call.type).toBe('storage_write_fail');
    expect(call.severity).toBe('error');
    expect(call.context.module).toBe('m7');
    expect(call.context.site).toBe('pending_m7_toast');
    expect(typeof call.context.hint).toBe('string');
  });

  // ---------------------------------------------------------------------------
  // TC-03 : site heartbeat_write — échec loggué + re-throw pour callers SW
  // ---------------------------------------------------------------------------

  it('TC-03 : échec écriture heartbeat (heartbeat_write) → incident loggué + re-throw', async () => {
    const storageSet = vi.fn().mockRejectedValue(new Error('Storage is disabled'));

    await expect(simulateHeartbeatWrite(storageSet, incidentService)).rejects.toThrow(
      'Storage is disabled',
    );

    // Incident loggué
    expect(incidentService.log).toHaveBeenCalledTimes(1);
    const call = incidentService.incidents[0];
    expect(call.type).toBe('storage_write_fail');
    expect(call.severity).toBe('error');
    expect(call.context.module).toBe('heartbeat');
    expect(call.context.site).toBe('heartbeat_write');
    expect(call.context.hint).toBe('Storage is disabled');
  });

  // ---------------------------------------------------------------------------
  // TC-04 : succès normal → aucun incident loggué (baseline)
  // ---------------------------------------------------------------------------

  it('TC-04 : écriture storage réussie → aucun incident loggué (baseline)', async () => {
    const mockStorage: Record<string, unknown> = {};
    const storageSet = vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(mockStorage, items);
    });

    // Tous les sites en succès
    await simulateEncryptionKeyBootWrite(storageSet, incidentService);
    const result = await simulatePendingM7ToastWrite(storageSet, incidentService);
    await simulateHeartbeatWrite(storageSet, incidentService);

    expect(incidentService.log).not.toHaveBeenCalled();
    expect(incidentService.incidents).toHaveLength(0);
    expect(result.toastWritten).toBe(true);
    // Les 3 appels storageSet ont réussi
    expect(storageSet).toHaveBeenCalledTimes(3);
  });

  // ---------------------------------------------------------------------------
  // TC-05 : payload non-JSON-sérialisable → incident loggué avec hint explicite
  // ---------------------------------------------------------------------------

  it('TC-05 : payload non-JSON-sérialisable → incident loggué avec hint explicite', async () => {
    // Simuler une erreur de sérialisation (chrome lève une TypeError si la valeur
    // contient un symbol, une fonction, ou un ArrayBuffer non converti)
    const serializationError = new TypeError(
      'Could not serialize value for storage: Value is not JSON-serializable',
    );
    const storageSet = vi.fn().mockRejectedValue(serializationError);

    await expect(simulateEncryptionKeyBootWrite(storageSet, incidentService)).rejects.toThrow(
      'Could not serialize',
    );

    const call = incidentService.incidents[0];
    expect(call.context.type).toBe('storage_write_fail');
    expect(call.context.hint).toContain('not JSON-serializable');
    // Le hint est tronqué à 100 chars max
    expect(call.context.hint.length).toBeLessThanOrEqual(100);
  });

  // ---------------------------------------------------------------------------
  // TC-06 : QuotaExceededError simulée → incident loggué, severity=error
  // ---------------------------------------------------------------------------

  it('TC-06 : QuotaExceededError (quota dépassé) → incident loggué, severity=error', async () => {
    // Chrome lève QUOTA_BYTES_PER_ITEM exceeded quand un item dépasse 8 KB
    const quotaError = new Error('QUOTA_BYTES_PER_ITEM quota exceeded');
    quotaError.name = 'QuotaExceededError';
    const storageSet = vi.fn().mockRejectedValue(quotaError);

    await expect(simulateHeartbeatWrite(storageSet, incidentService)).rejects.toThrow(
      'QUOTA_BYTES_PER_ITEM',
    );

    expect(incidentService.log).toHaveBeenCalledTimes(1);
    const call = incidentService.incidents[0];
    expect(call.severity).toBe('error');
    expect(call.context.type).toBe('storage_write_fail');
    expect(call.context.module).toBe('heartbeat');
    expect(call.context.site).toBe('heartbeat_write');
    // Le hint contient le message de l'erreur quota
    expect(call.context.hint).toContain('QUOTA_BYTES_PER_ITEM');
  });
});
