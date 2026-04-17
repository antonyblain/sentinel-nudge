/**
 * @file tests/unit/modules/m5.test.ts
 * @description Tests unitaires du module M5 — rappel mise à jour navigateur.
 *
 * Couvre :
 * - getLastNudgeDate / getSnoozeCount / setSnoozeCount / resetSnoozeCount
 * - handleCheckUpdate : délai de grâce, throttling, no_update, update_available
 * - handleToastAction : update_now, remind_4h, why, closed
 * - Contrainte anti-snooze infini (CA-M5-06)
 * - initBootM5 : boot happy path, snooze corrompu, pending_m5_update_reminder (TACHE-087)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getLastNudgeDate,
  getSnoozeCount,
  setSnoozeCount,
  resetSnoozeCount,
  setUpToDateState,
  NUDGE_GRACE_PERIOD_MS,
  MAX_SNOOZE_COUNT,
  M5_LAST_NUDGE_KEY,
  M5_SNOOZE_COUNT_KEY,
  M5_UP_TO_DATE_KEY,
  createM5Handler,
} from '@/background/handlers/m5-handler';
import { initBootM5, readM5Diagnostics } from '@/background/services/m5-boot-service';
import type { StorageService } from '@/background/storage-service';
import type { NudgeMessage } from '@/shared/types/messages';
import type { IncidentService } from '@/background/services/incident-service';
import {
  M5_SNOOZE_COUNT_STORAGE_KEY,
  PENDING_M5_UPDATE_REMINDER_KEY,
  PENDING_M5_UPDATE_REMINDER_TTL_MS,
} from '@/shared/types/diagnostics';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockLocalStorage: Record<string, unknown> = {};

/** Statut courant de requestUpdateCheck (modifiable par chaque test) */
let currentUpdateStatus = 'no_update';

/** Response simulée de tabs.sendMessage (contexte onglet actif) */
const mockTabContext = { fullscreen: false, form_active: false };

global.chrome = {
  storage: {
    local: {
      get: vi.fn((keys: string[], callback: (r: Record<string, unknown>) => void) => {
        const result: Record<string, unknown> = {};
        for (const k of keys) {
          if (mockLocalStorage[k] !== undefined) result[k] = mockLocalStorage[k];
        }
        callback(result);
      }),
      set: vi.fn((items: Record<string, unknown>, callback?: () => void) => {
        Object.assign(mockLocalStorage, items);
        callback?.();
      }),
      remove: vi.fn((_keys: string | string[], callback?: () => void) => {
        callback?.();
      }),
    },
  },
  tabs: {
    // chrome.tabs.create retourne une Promise nativement en MV3
    create: vi.fn().mockResolvedValue({}),
    // chrome.tabs.query est callback-style dans le browser-adapter
    query: vi.fn((_queryInfo: object, callback: (tabs: chrome.tabs.Tab[]) => void) => {
      callback([{ id: 42, active: true, index: 0 } as chrome.tabs.Tab]);
    }),
    // chrome.tabs.sendMessage est callback-style dans le browser-adapter
    sendMessage: vi.fn(
      (_tabId: number, _message: unknown, callback: (response: unknown) => void) => {
        callback(mockTabContext);
      },
    ),
  },
  runtime: {
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
    // chrome.runtime.requestUpdateCheck est callback-style dans le browser-adapter
    requestUpdateCheck: vi.fn(
      (callback: (status: chrome.runtime.RequestUpdateCheckStatus) => void) => {
        callback(currentUpdateStatus as chrome.runtime.RequestUpdateCheckStatus);
      },
    ),
    lastError: undefined,
  },
  alarms: {
    create: vi.fn(),
    clear: vi.fn(),
  },
  action: {
    setBadgeText: vi.fn().mockResolvedValue(undefined),
    setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
  },
} as unknown as typeof chrome;

/** Crée un mock minimal de StorageService */
function createMockStorageService(): StorageService {
  return {
    logEvent: vi.fn().mockResolvedValue(1),
    getEvents: vi.fn().mockResolvedValue([]),
    getConfig: vi.fn().mockResolvedValue({
      modules: { M5: true },
      quota_limit: 3,
      profile: 'beginner',
      onboarding_complete: true,
      language: 'fr',
    }),
  } as unknown as StorageService;
}

/** Crée une CryptoKey mock */
function createMockCryptoKey(): CryptoKey {
  return {} as CryptoKey;
}

/** Construit un NudgeMessage M5 */
function buildM5Message(action: string, payload: Record<string, unknown> = {}): NudgeMessage {
  return { module: 'M5', action, payload, timestamp: Date.now() };
}

const mockSender = {} as chrome.runtime.MessageSender;

/**
 * Crée un mock d'IncidentService pour les tests initBootM5.
 */
function createMockIncidentService(): {
  service: Partial<IncidentService>;
  incidents: Array<{ type: string; severity: string }>;
} {
  const incidents: Array<{ type: string; severity: string }> = [];
  const service: Partial<IncidentService> = {
    log: vi.fn(async (type, severity) => {
      incidents.push({ type, severity });
    }),
  };
  return { service, incidents };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Réinitialiser le storage mock
  Object.keys(mockLocalStorage).forEach((k) => {
    delete mockLocalStorage[k];
  });
  currentUpdateStatus = 'no_update';
  vi.clearAllMocks();

  // Remettre les mocks callback en place après vi.clearAllMocks()
  (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
    (keys: string[], callback: (r: Record<string, unknown>) => void) => {
      const result: Record<string, unknown> = {};
      for (const k of keys) {
        if (mockLocalStorage[k] !== undefined) result[k] = mockLocalStorage[k];
      }
      callback(result);
    },
  );
  (chrome.storage.local.set as ReturnType<typeof vi.fn>).mockImplementation(
    (items: Record<string, unknown>, callback?: () => void) => {
      Object.assign(mockLocalStorage, items);
      callback?.();
    },
  );
  (chrome.storage.local.remove as ReturnType<typeof vi.fn>).mockImplementation(
    (_keys: string | string[], callback?: () => void) => {
      callback?.();
    },
  );
  (chrome.tabs.query as ReturnType<typeof vi.fn>).mockImplementation(
    (_queryInfo: object, callback: (tabs: chrome.tabs.Tab[]) => void) => {
      callback([{ id: 42, active: true, index: 0 } as chrome.tabs.Tab]);
    },
  );
  (chrome.tabs.sendMessage as ReturnType<typeof vi.fn>).mockImplementation(
    (_tabId: number, _message: unknown, callback: (response: unknown) => void) => {
      callback(mockTabContext);
    },
  );
  (chrome.runtime.requestUpdateCheck as ReturnType<typeof vi.fn>).mockImplementation(
    (callback: (status: chrome.runtime.RequestUpdateCheckStatus) => void) => {
      callback(currentUpdateStatus as chrome.runtime.RequestUpdateCheckStatus);
    },
  );
});

describe('M5Handler — fonctions utilitaires storage', () => {
  it('getLastNudgeDate retourne 0 si jamais nudgé', async () => {
    const date = await getLastNudgeDate();
    expect(date).toBe(0);
  });

  it('getSnoozeCount retourne 0 si aucun snooze', async () => {
    const count = await getSnoozeCount();
    expect(count).toBe(0);
  });

  it('setSnoozeCount persiste le snoozeCount et met à jour last_nudge_date', async () => {
    const before = Date.now();
    await setSnoozeCount(2);

    expect(mockLocalStorage[M5_SNOOZE_COUNT_KEY]).toBe(2);
    const savedDate = mockLocalStorage[M5_LAST_NUDGE_KEY] as number;
    expect(savedDate).toBeGreaterThanOrEqual(before);
  });

  it('resetSnoozeCount remet le compteur à 0', async () => {
    mockLocalStorage[M5_SNOOZE_COUNT_KEY] = 3;
    await resetSnoozeCount();
    expect(mockLocalStorage[M5_SNOOZE_COUNT_KEY]).toBe(0);
  });

  it("setUpToDateState persiste l'état is_up_to_date", async () => {
    await setUpToDateState(true);
    expect(mockLocalStorage[M5_UP_TO_DATE_KEY]).toBe(true);

    await setUpToDateState(false);
    expect(mockLocalStorage[M5_UP_TO_DATE_KEY]).toBe(false);
  });
});

describe('M5Handler — check_update : no_update', () => {
  it('marque navigateur à jour et retourne skip avec raison no_update', async () => {
    currentUpdateStatus = 'no_update';

    const storage = createMockStorageService();
    const cryptoKey = createMockCryptoKey();
    const handler = createM5Handler(storage, cryptoKey);

    const response = await handler(buildM5Message('check_update'), mockSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('skip');
    expect(response.reason).toBe('no_update');
    expect(mockLocalStorage[M5_UP_TO_DATE_KEY]).toBe(true);
  });
});

describe('M5Handler — check_update : throttled (CA-M5-05)', () => {
  it('programme une alarme de réessai dans 1h et retourne skip', async () => {
    currentUpdateStatus = 'throttled';

    const storage = createMockStorageService();
    const cryptoKey = createMockCryptoKey();
    const handler = createM5Handler(storage, cryptoKey);

    const response = await handler(buildM5Message('check_update'), mockSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('skip');
    expect(response.reason).toBe('throttled');
    // Alarme de réessai programmée
    expect(chrome.alarms.create).toHaveBeenCalledWith(
      'm5_retry_throttled',
      expect.objectContaining({ delayInMinutes: 60 }),
    );
  });
});

describe('M5Handler — check_update : délai de grâce 48h', () => {
  it('retourne skip grace_period si dernier nudge < 48h', async () => {
    currentUpdateStatus = 'update_available';

    // Simuler un nudge récent (30 min ago)
    mockLocalStorage[M5_LAST_NUDGE_KEY] = Date.now() - 30 * 60 * 1000;

    const storage = createMockStorageService();
    const cryptoKey = createMockCryptoKey();
    const handler = createM5Handler(storage, cryptoKey);

    const response = await handler(buildM5Message('check_update'), mockSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('skip');
    expect(response.reason).toBe('grace_period');
  });

  it('affiche le toast si dernier nudge >= 48h', async () => {
    currentUpdateStatus = 'update_available';

    // Simuler un nudge ancien (50h ago)
    mockLocalStorage[M5_LAST_NUDGE_KEY] = Date.now() - 50 * 60 * 60 * 1000;

    const storage = createMockStorageService();
    const cryptoKey = createMockCryptoKey();
    const handler = createM5Handler(storage, cryptoKey);

    const response = await handler(buildM5Message('check_update'), mockSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('show');
    // Vérifier que tabs.sendMessage a été appelé (callback-style)
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ action: 'show_update_toast' }),
      expect.any(Function),
    );
  });
});

describe('M5Handler — toast_action : update_now', () => {
  it('ouvre chrome://settings/help et remet snoozeCount à 0', async () => {
    mockLocalStorage[M5_SNOOZE_COUNT_KEY] = 2;

    const storage = createMockStorageService();
    const cryptoKey = createMockCryptoKey();
    const handler = createM5Handler(storage, cryptoKey);

    await handler(
      buildM5Message('toast_action', { user_action: 'update_now', snooze_count: 2 }),
      mockSender,
    );

    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: 'chrome://settings/help' });
    expect(mockLocalStorage[M5_SNOOZE_COUNT_KEY]).toBe(0);
  });
});

describe('M5Handler — toast_action : remind_4h', () => {
  it('incrémente snoozeCount et programme une alarme de 4h', async () => {
    const storage = createMockStorageService();
    const cryptoKey = createMockCryptoKey();
    const handler = createM5Handler(storage, cryptoKey);

    await handler(
      buildM5Message('toast_action', { user_action: 'remind_4h', snooze_count: 1 }),
      mockSender,
    );

    expect(mockLocalStorage[M5_SNOOZE_COUNT_KEY]).toBe(2);
    expect(chrome.alarms.create).toHaveBeenCalledWith(
      'm5_snooze',
      expect.objectContaining({ delayInMinutes: 240 }),
    );
  });

  it('CA-M5-06 : snoozeCount ne dépasse pas MAX_SNOOZE_COUNT', async () => {
    const storage = createMockStorageService();
    const cryptoKey = createMockCryptoKey();
    const handler = createM5Handler(storage, cryptoKey);

    await handler(
      buildM5Message('toast_action', { user_action: 'remind_4h', snooze_count: MAX_SNOOZE_COUNT }),
      mockSender,
    );

    expect(mockLocalStorage[M5_SNOOZE_COUNT_KEY]).toBe(MAX_SNOOZE_COUNT);
  });
});

describe('M5Handler — toast_action : closed', () => {
  it("remet snoozeCount à 0 et enregistre l'événement", async () => {
    mockLocalStorage[M5_SNOOZE_COUNT_KEY] = 2;

    const storage = createMockStorageService();
    const cryptoKey = createMockCryptoKey();
    const handler = createM5Handler(storage, cryptoKey);

    const response = await handler(
      buildM5Message('toast_action', { user_action: 'closed', snooze_count: 2 }),
      mockSender,
    );

    expect(response.success).toBe(true);
    expect(mockLocalStorage[M5_SNOOZE_COUNT_KEY]).toBe(0);
    expect(storage.logEvent).toHaveBeenCalledWith(
      'M5',
      expect.objectContaining({ action: 'closed' }),
      cryptoKey,
    );
  });
});

describe('M5Handler — constantes', () => {
  it('NUDGE_GRACE_PERIOD_MS vaut 48 heures en ms', () => {
    expect(NUDGE_GRACE_PERIOD_MS).toBe(48 * 60 * 60 * 1000);
  });

  it('MAX_SNOOZE_COUNT vaut 3', () => {
    expect(MAX_SNOOZE_COUNT).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Tests : initBootM5 — ADR-001 SW-BOOT-CONTRACT (TACHE-087)
// ---------------------------------------------------------------------------

describe('initBootM5 — boot happy path (snooze_count valide)', () => {
  it('TC-M5-BOOT-01 : snooze_count valide → ready=true, pas d\'incident', async () => {
    mockLocalStorage[M5_SNOOZE_COUNT_STORAGE_KEY] = 2;

    const { service, incidents } = createMockIncidentService();
    const diag = await initBootM5(service as IncidentService);

    expect(diag.ready).toBe(true);
    expect(diag.snooze_count).toBe(2);
    expect(diag.last_boot_ts).toBeGreaterThan(0);
    expect(diag.last_incident).toBeUndefined();
    expect(incidents).toHaveLength(0);
  });

  it('TC-M5-BOOT-02 : diagnostics.m5 persisté avec ready=true', async () => {
    mockLocalStorage[M5_SNOOZE_COUNT_STORAGE_KEY] = 0;

    const { service } = createMockIncidentService();
    await initBootM5(service as IncidentService);

    const stored = mockLocalStorage['diagnostics.m5'] as Record<string, unknown>;
    expect(stored).toBeDefined();
    expect(stored['ready']).toBe(true);
    expect(stored['snooze_count']).toBe(0);
    expect(typeof stored['last_boot_ts']).toBe('number');
  });

  it('TC-M5-BOOT-03 : readM5Diagnostics retourne l\'état persisté après boot', async () => {
    mockLocalStorage[M5_SNOOZE_COUNT_STORAGE_KEY] = 1;

    const { service } = createMockIncidentService();
    await initBootM5(service as IncidentService);

    const diag = await readM5Diagnostics();
    expect(diag.ready).toBe(true);
    expect(diag.snooze_count).toBe(1);
  });
});

describe('initBootM5 — snooze_count absent (premier boot)', () => {
  it('TC-M5-BOOT-04 : snooze_count absent → initialisé à 0, ready=true, pas d\'incident', async () => {
    // Aucun snooze_count dans le storage

    const { service, incidents } = createMockIncidentService();
    const diag = await initBootM5(service as IncidentService);

    expect(diag.ready).toBe(true);
    expect(diag.snooze_count).toBe(0);
    expect(incidents).toHaveLength(0);

    // m5_snooze_count initialisé à 0 dans le storage
    expect(mockLocalStorage[M5_SNOOZE_COUNT_STORAGE_KEY]).toBe(0);
  });

  it('TC-M5-BOOT-05 : snooze_count null → comportement identique à absent', async () => {
    mockLocalStorage[M5_SNOOZE_COUNT_STORAGE_KEY] = null;

    const { service, incidents } = createMockIncidentService();
    const diag = await initBootM5(service as IncidentService);

    expect(diag.ready).toBe(true);
    expect(diag.snooze_count).toBe(0);
    expect(incidents).toHaveLength(0);
  });
});

describe('initBootM5 — snooze_count corrompu', () => {
  it('TC-M5-BOOT-06 : snooze_count = string → incident m5_snooze_corrupted (error)', async () => {
    mockLocalStorage[M5_SNOOZE_COUNT_STORAGE_KEY] = 'invalid';

    const { service, incidents } = createMockIncidentService();
    const diag = await initBootM5(service as IncidentService);

    const corruptedIncident = incidents.find((i) => i.type === 'm5_snooze_corrupted');
    expect(corruptedIncident).toBeDefined();
    expect(corruptedIncident?.severity).toBe('error');

    // Réinitialisation à 0
    expect(diag.snooze_count).toBe(0);
    expect(diag.ready).toBe(false);
  });

  it('TC-M5-BOOT-07 : snooze_count négatif → invalide → incident + réinitialisation', async () => {
    mockLocalStorage[M5_SNOOZE_COUNT_STORAGE_KEY] = -1;

    const { service, incidents } = createMockIncidentService();
    const diag = await initBootM5(service as IncidentService);

    expect(incidents.some((i) => i.type === 'm5_snooze_corrupted')).toBe(true);
    expect(diag.snooze_count).toBe(0);
  });

  it('TC-M5-BOOT-08 : snooze_count = objet → invalide → incident', async () => {
    mockLocalStorage[M5_SNOOZE_COUNT_STORAGE_KEY] = { corrupted: true };

    const { service, incidents } = createMockIncidentService();
    await initBootM5(service as IncidentService);

    expect(incidents.some((i) => i.type === 'm5_snooze_corrupted')).toBe(true);
  });

  it('TC-M5-BOOT-09 : diagnostics.m5.last_incident reflète la corruption', async () => {
    mockLocalStorage[M5_SNOOZE_COUNT_STORAGE_KEY] = 'bad';

    const { service } = createMockIncidentService();
    const diag = await initBootM5(service as IncidentService);

    expect(diag.last_incident).toBeDefined();
    expect(diag.last_incident?.type).toBe('m5_snooze_corrupted');
    expect(diag.last_incident?.severity).toBe('error');
    expect(diag.last_incident?.ts).toBeGreaterThan(0);
  });

  it('TC-M5-BOOT-10 : m5_snooze_count réinitialisé à 0 dans storage après corruption', async () => {
    mockLocalStorage[M5_SNOOZE_COUNT_STORAGE_KEY] = 'corrupted';

    const { service } = createMockIncidentService();
    await initBootM5(service as IncidentService);

    expect(mockLocalStorage[M5_SNOOZE_COUNT_STORAGE_KEY]).toBe(0);
  });
});

describe('initBootM5 — état initial conservatif', () => {
  it('TC-M5-BOOT-11 : diagnostics.m5 posé à ready=false au début du boot (R-BOOT-03)', async () => {
    mockLocalStorage[M5_SNOOZE_COUNT_STORAGE_KEY] = 0;

    let conservativeStateObserved = false;
    let callCount = 0;
    (global.chrome.storage.local.set as ReturnType<typeof vi.fn>).mockImplementation(
      (items: Record<string, unknown>, callback?: () => void) => {
        callCount++;
        if (callCount === 1 && items['diagnostics.m5']) {
          const diag = items['diagnostics.m5'] as Record<string, unknown>;
          if (diag['ready'] === false) {
            conservativeStateObserved = true;
          }
        }
        Object.assign(mockLocalStorage, items);
        callback?.();
      },
    );

    const { service } = createMockIncidentService();
    await initBootM5(service as IncidentService);

    expect(conservativeStateObserved).toBe(true);
  });

  it('TC-M5-BOOT-12 : readM5Diagnostics retourne défaut si diagnostics.m5 absent', async () => {
    const diag = await readM5Diagnostics();

    expect(diag.ready).toBe(false);
    expect(diag.last_boot_ts).toBe(0);
    expect(diag.snooze_count).toBe(0);
  });
});

describe('initBootM5 — constantes ADR-002 (TACHE-087)', () => {
  it('PENDING_M5_UPDATE_REMINDER_KEY conforme R-CLI-01 (convention pending_<module>_<action>)', () => {
    expect(PENDING_M5_UPDATE_REMINDER_KEY).toBe('pending_m5_update_reminder');
  });

  it('PENDING_M5_UPDATE_REMINDER_TTL_MS vaut 30 minutes', () => {
    expect(PENDING_M5_UPDATE_REMINDER_TTL_MS).toBe(30 * 60 * 1000);
  });
});
