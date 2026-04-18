/**
 * @file tests/unit/background/message-router.test.ts
 * @description Tests unitaires du MessageRouter — dispatch, rate-limit, quota, handlers.
 *
 * TACHE-019 — couverture initiale 0% sur message-router.ts.
 *
 * Couvre :
 * - registerHandler + getHandler : enregistrement nominal + handler absent
 * - handleValidatedMessage (via dispatch interne) :
 *   - dispatch nominal → réponse du handler
 *   - handler_not_registered → response skip
 *   - quota_exceeded → response skip (quota=0)
 *   - quota bypass CRITICAL_MODULES (M7) via isCritical flag passe au QuotaManager
 *   - rate_limit_exceeded → response error + incident loggue si incidentService
 *   - exception handler → response error reason=internal_error
 *   - quota increment uniquement si action === 'show' et non critique
 * - setIncidentService : injection apres construction
 * - listen() : enregistre un seul listener
 * - validateNudgeMessage : rejet des messages invalides (module absent, action vide, timestamp absent)
 * - R-CLI-05 : incidentService null (pas d'injection) → rate_limit drop sans crash
 *
 * Note TC-MR-13 : le re-throw dans handleValidatedMessage n'est pas observable via
 * dispatchMsg (qui resout la promise sur sendResponse avant le re-throw). Le comportement
 * observe est action='error' reason='internal_error'. Le re-throw en lui-meme est couvert
 * par les tests d'integration service-worker.
 *
 * Référence : DAT §3.3, UC-03 / INV-UC03-05, NC-SEC-01
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageRouter } from '@/background/message-router';
import { QuotaManager } from '@/background/quota-manager';
import { validateNudgeMessage } from '@/shared/utils/message-validator';
import type { NudgeMessage, NudgeResponse } from '@/shared/types/messages';
import type { IncidentService } from '@/background/services/incident-service';

// ---------------------------------------------------------------------------
// Mocks globaux
// ---------------------------------------------------------------------------

const mockLocalStorage: Record<string, unknown> = {};

global.chrome = {
  runtime: {
    onMessage: {
      addListener: vi.fn(),
    },
    sendMessage: vi.fn(),
  },
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
    },
  },
  tabs: {
    sendMessage: vi.fn(),
  },
} as unknown as typeof chrome;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reinitialise le storage mock avant chaque test */
function resetStorage(): void {
  Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]);
}

/** Construit un NudgeMessage valide */
function buildMsg(module: string, action: string, payload = {}): NudgeMessage {
  return { module: module as NudgeMessage['module'], action, payload, timestamp: Date.now() };
}

/** Cree un mock minimal de QuotaManager permettant les nudges */
function createPermissiveQuotaMock(): QuotaManager {
  return {
    checkQuota: vi.fn().mockResolvedValue({ allowed: true, remaining: 2 }),
    incrementQuota: vi.fn().mockResolvedValue(undefined),
  } as unknown as QuotaManager;
}

/**
 * Cree un mock de QuotaManager qui refuse les modules non critiques
 * mais respecte le flag isCritical (simule le vrai comportement QuotaManager).
 * Necessaire pour TC-MR-09 : tester que M7 bypass le quota.
 */
function createCriticalAwareBlockingQuotaMock(): QuotaManager {
  return {
    checkQuota: vi.fn((_module: string, isCritical: boolean) =>
      Promise.resolve(
        isCritical ? { allowed: true, remaining: null } : { allowed: false, remaining: 0 },
      ),
    ),
    incrementQuota: vi.fn().mockResolvedValue(undefined),
  } as unknown as QuotaManager;
}

/** Cree un mock de QuotaManager qui refuse toujours (ignore isCritical) */
function createBlockingQuotaMock(): QuotaManager {
  return {
    checkQuota: vi.fn().mockResolvedValue({ allowed: false, remaining: 0 }),
    incrementQuota: vi.fn().mockResolvedValue(undefined),
  } as unknown as QuotaManager;
}

/** Cree un mock d'IncidentService */
function createIncidentMock(): {
  svc: IncidentService;
  calls: Array<{ type: string; severity: string }>;
} {
  const calls: Array<{ type: string; severity: string }> = [];
  const svc = {
    log: vi.fn(async (type: string, severity: string) => {
      calls.push({ type, severity });
    }),
  } as unknown as IncidentService;
  return { svc, calls };
}

/** Simule l'appel interne handleValidatedMessage via le sendResponse callback */
async function dispatchMsg(
  router: MessageRouter,
  msg: NudgeMessage,
  sender: chrome.runtime.MessageSender = {},
): Promise<NudgeResponse> {
  return new Promise((resolve) => {
    // Acces a la methode privee via cast
    const r = router as unknown as {
      handleValidatedMessage: (
        msg: NudgeMessage,
        sender: chrome.runtime.MessageSender,
        cb: (r: unknown) => void,
      ) => Promise<void>;
    };
    void r.handleValidatedMessage(msg, sender, (response) => resolve(response as NudgeResponse));
  });
}

beforeEach(() => {
  resetStorage();
  vi.clearAllMocks();
  (global.chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
    (keys: string[], callback: (r: Record<string, unknown>) => void) => {
      const result: Record<string, unknown> = {};
      for (const k of keys) {
        if (mockLocalStorage[k] !== undefined) result[k] = mockLocalStorage[k];
      }
      callback(result);
    },
  );
  (global.chrome.storage.local.set as ReturnType<typeof vi.fn>).mockImplementation(
    (items: Record<string, unknown>, callback?: () => void) => {
      Object.assign(mockLocalStorage, items);
      callback?.();
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// TC-MR-01/02 : registerHandler + getHandler
// ---------------------------------------------------------------------------

describe('MessageRouter — registerHandler / getHandler', () => {
  it('TC-MR-01 : getHandler retourne le handler enregistre', () => {
    const router = new MessageRouter(createPermissiveQuotaMock());
    const handler = vi.fn();
    router.registerHandler('M3', handler);

    const retrieved = router.getHandler('M3');
    expect(retrieved).toBe(handler);
  });

  it('TC-MR-02 : getHandler retourne undefined pour un module non enregistre', () => {
    const router = new MessageRouter(createPermissiveQuotaMock());
    expect(router.getHandler('M5')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// TC-MR-03/04/05/06 : dispatch nominal
// ---------------------------------------------------------------------------

describe('MessageRouter — dispatch nominal', () => {
  it('TC-MR-03 : dispatch vers handler enregistre → reponse transmise', async () => {
    const router = new MessageRouter(createPermissiveQuotaMock());
    const response: NudgeResponse = { success: true, action: 'show' };
    router.registerHandler('M3', vi.fn().mockResolvedValue(response));

    const result = await dispatchMsg(router, buildMsg('M3', 'calculate_score'));
    expect(result.success).toBe(true);
    expect(result.action).toBe('show');
  });

  it('TC-MR-04 : quota increment appele si action=show et module non critique', async () => {
    const quota = createPermissiveQuotaMock();
    const router = new MessageRouter(quota);
    router.registerHandler('M3', vi.fn().mockResolvedValue({ success: true, action: 'show' }));

    await dispatchMsg(router, buildMsg('M3', 'calculate_score'));
    expect(quota.incrementQuota).toHaveBeenCalledOnce();
  });

  it('TC-MR-05 : quota NOT increment si action=skip', async () => {
    const quota = createPermissiveQuotaMock();
    const router = new MessageRouter(quota);
    router.registerHandler('M3', vi.fn().mockResolvedValue({ success: true, action: 'skip' }));

    await dispatchMsg(router, buildMsg('M3', 'calculate_score'));
    expect(quota.incrementQuota).not.toHaveBeenCalled();
  });

  it('TC-MR-06 : quota NOT increment pour module critique M7 meme si action=show', async () => {
    const quota = createPermissiveQuotaMock();
    const router = new MessageRouter(quota);
    router.registerHandler('M7', vi.fn().mockResolvedValue({ success: true, action: 'show' }));

    await dispatchMsg(router, buildMsg('M7', 'detected'));
    expect(quota.incrementQuota).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// TC-MR-07 : handler_not_registered
// ---------------------------------------------------------------------------

describe('MessageRouter — handler_not_registered', () => {
  it('TC-MR-07 : module sans handler → skip reason=handler_not_registered', async () => {
    const router = new MessageRouter(createPermissiveQuotaMock());

    const result = await dispatchMsg(router, buildMsg('M5', 'detected'));
    expect(result.success).toBe(false);
    expect(result.action).toBe('skip');
    expect(result.reason).toBe('handler_not_registered');
  });
});

// ---------------------------------------------------------------------------
// TC-MR-08/09 : quota_exceeded + bypass CRITICAL_MODULES
// ---------------------------------------------------------------------------

describe('MessageRouter — quota_exceeded', () => {
  it('TC-MR-08 : quota refuse → response skip reason=quota_exceeded', async () => {
    const router = new MessageRouter(createBlockingQuotaMock());
    router.registerHandler('M3', vi.fn().mockResolvedValue({ success: true, action: 'show' }));

    const result = await dispatchMsg(router, buildMsg('M3', 'calculate_score'));
    expect(result.success).toBe(true);
    expect(result.action).toBe('skip');
    expect(result.reason).toBe('quota_exceeded');
  });

  it('TC-MR-09 : module M7 (CRITICAL) bypass quota via isCritical=true passe au QuotaManager', async () => {
    // createCriticalAwareBlockingQuotaMock simule le comportement reel :
    // - isCritical=true  → { allowed: true }  (bypass)
    // - isCritical=false → { allowed: false } (bloque)
    const quota = createCriticalAwareBlockingQuotaMock();
    const router = new MessageRouter(quota);
    const handlerResponse: NudgeResponse = { success: true, action: 'show' };
    router.registerHandler('M7', vi.fn().mockResolvedValue(handlerResponse));

    const result = await dispatchMsg(router, buildMsg('M7', 'detected'));
    // M7 est CRITICAL → isCritical=true → QuotaManager retourne allowed=true → handler appele → show
    expect(result.action).toBe('show');

    // Verifier que checkQuota a bien recu isCritical=true
    expect(quota.checkQuota).toHaveBeenCalledWith('M7', true);
  });
});

// ---------------------------------------------------------------------------
// TC-MR-10/11/12 : rate_limit_exceeded
// ---------------------------------------------------------------------------

describe('MessageRouter — rate_limit_exceeded', () => {
  it('TC-MR-10 : 11e message dans 10s → rate_limit error response', async () => {
    vi.useFakeTimers();
    const router = new MessageRouter(createPermissiveQuotaMock());
    router.registerHandler('M2', vi.fn().mockResolvedValue({ success: true, action: 'show' }));

    const sender: chrome.runtime.MessageSender = { tab: { id: 42 } as chrome.tabs.Tab };
    const msg = buildMsg('M2', 'detected');

    // 10 messages autorises
    for (let i = 0; i < 10; i++) {
      const res = await dispatchMsg(router, msg, sender);
      expect(res.success).toBeTruthy();
    }

    // 11e → rate_limit
    const result = await dispatchMsg(router, msg, sender);
    expect(result.success).toBe(false);
    expect((result as Record<string, unknown>)['error'] ?? result.reason).toBe(
      'rate_limit_exceeded',
    );
    vi.useRealTimers();
  });

  it('TC-MR-11 : rate_limit avec incidentService → incident loggue severity=warn', async () => {
    vi.useFakeTimers();
    const { svc, calls } = createIncidentMock();
    const router = new MessageRouter(createPermissiveQuotaMock());
    router.setIncidentService(svc);
    router.registerHandler('M3', vi.fn().mockResolvedValue({ success: true, action: 'show' }));

    const sender: chrome.runtime.MessageSender = { tab: { id: 99 } as chrome.tabs.Tab };
    const msg = buildMsg('M3', 'calculate_score');

    // Saturer le rate-limit
    for (let i = 0; i < 10; i++) {
      await dispatchMsg(router, msg, sender);
    }
    await dispatchMsg(router, msg, sender);

    expect(calls.some((c) => c.type === 'rate_limit_exceeded' && c.severity === 'warn')).toBe(true);
    vi.useRealTimers();
  });

  it('TC-MR-12 : rate_limit sans incidentService → pas de crash (R-CLI-05)', async () => {
    vi.useFakeTimers();
    // Pas d'injection d'incidentService → incidentService = null
    const router = new MessageRouter(createPermissiveQuotaMock());
    router.registerHandler('M3', vi.fn().mockResolvedValue({ success: true, action: 'show' }));

    const sender: chrome.runtime.MessageSender = { tab: { id: 1 } as chrome.tabs.Tab };
    const msg = buildMsg('M3', 'calculate_score');

    for (let i = 0; i < 10; i++) {
      await dispatchMsg(router, msg, sender);
    }

    // Ne doit pas lever d'exception
    await expect(dispatchMsg(router, msg, sender)).resolves.toBeDefined();
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// TC-MR-13 : exception dans handler → response error reason=internal_error
//
// Note : handleValidatedMessage fait sendResponse(error) PUIS throw err.
// dispatchMsg resout la promise sur sendResponse (avant le re-throw).
// La response observee est donc action='error' reason='internal_error'.
// Le re-throw lui-meme est capture par le service-worker (tests integration).
// ---------------------------------------------------------------------------

describe('MessageRouter — exception handler', () => {
  it('TC-MR-13 : exception dans handler → response action=error reason=internal_error', async () => {
    const router = new MessageRouter(createPermissiveQuotaMock());
    router.registerHandler('M5', vi.fn().mockRejectedValue(new Error('crash handler')));

    // dispatchMsg capture le sendResponse (appele avant le re-throw)
    // Le re-throw cree un unhandled rejection — on le capture avec a void-catch
    let response: NudgeResponse | undefined;
    const promise = new Promise<NudgeResponse>((resolve) => {
      const r = router as unknown as {
        handleValidatedMessage: (
          msg: NudgeMessage,
          sender: chrome.runtime.MessageSender,
          cb: (r: unknown) => void,
        ) => Promise<void>;
      };
      void r
        .handleValidatedMessage(buildMsg('M5', 'detected'), {}, (resp) => {
          response = resp as NudgeResponse;
          resolve(resp as NudgeResponse);
        })
        .catch(() => {
          // Re-throw attendu — on le consomme ici pour eviter l'unhandled rejection
        });
    });

    await promise;
    expect(response?.success).toBe(false);
    expect(response?.action).toBe('error');
    expect(response?.reason).toBe('internal_error');
  });
});

// ---------------------------------------------------------------------------
// TC-MR-14 : setIncidentService
// ---------------------------------------------------------------------------

describe('MessageRouter — setIncidentService', () => {
  it('TC-MR-14 : setIncidentService injecte le service sans erreur', () => {
    const router = new MessageRouter(createPermissiveQuotaMock());
    const { svc } = createIncidentMock();
    expect(() => router.setIncidentService(svc)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// TC-MR-15 : validateNudgeMessage — rejet messages invalides (NC-SEC-01)
// ---------------------------------------------------------------------------

describe('validateNudgeMessage — NC-SEC-01', () => {
  it('TC-MR-15a : message null → false', () => {
    expect(validateNudgeMessage(null)).toBe(false);
  });

  it('TC-MR-15b : module absent → false', () => {
    expect(validateNudgeMessage({ action: 'show', payload: {}, timestamp: Date.now() })).toBe(false);
  });

  it('TC-MR-15c : module inconnu → false', () => {
    expect(
      validateNudgeMessage({ module: 'UNKNOWN', action: 'show', payload: {}, timestamp: Date.now() }),
    ).toBe(false);
  });

  it('TC-MR-15d : action vide → false', () => {
    expect(
      validateNudgeMessage({ module: 'M3', action: '', payload: {}, timestamp: Date.now() }),
    ).toBe(false);
  });

  it('TC-MR-15e : payload null → false', () => {
    expect(
      validateNudgeMessage({ module: 'M3', action: 'show', payload: null, timestamp: Date.now() }),
    ).toBe(false);
  });

  it('TC-MR-15f : timestamp absent → false', () => {
    expect(validateNudgeMessage({ module: 'M3', action: 'show', payload: {} })).toBe(false);
  });

  it('TC-MR-15g : message valide → true', () => {
    expect(
      validateNudgeMessage({
        module: 'M3',
        action: 'calculate_score',
        payload: {},
        timestamp: Date.now(),
      }),
    ).toBe(true);
  });

  it('TC-MR-15h : module EXPORT (interne) → true', () => {
    expect(
      validateNudgeMessage({ module: 'EXPORT', action: 'get_data', payload: {}, timestamp: Date.now() }),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TC-MR-16 : listen() enregistre un listener
// ---------------------------------------------------------------------------

describe('MessageRouter — listen()', () => {
  it('TC-MR-16 : listen() enregistre exactement un listener', () => {
    const router = new MessageRouter(createPermissiveQuotaMock());
    router.listen();
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// TC-MR-17 : rate-limit isolation par tab.id
// ---------------------------------------------------------------------------

describe('MessageRouter — isolation rate-limit par tab.id', () => {
  it("TC-MR-17 : tab1 sature n'impacte pas tab2 (fenetre glissante par cle tabId:module)", async () => {
    vi.useFakeTimers();
    const router = new MessageRouter(createPermissiveQuotaMock());
    router.registerHandler('M6', vi.fn().mockResolvedValue({ success: true, action: 'show' }));

    const senderTab1: chrome.runtime.MessageSender = { tab: { id: 1 } as chrome.tabs.Tab };
    const senderTab2: chrome.runtime.MessageSender = { tab: { id: 2 } as chrome.tabs.Tab };
    const msg = buildMsg('M6', 'quiz_trigger');

    // Saturer tab1
    for (let i = 0; i < 10; i++) {
      await dispatchMsg(router, msg, senderTab1);
    }
    const tab1Result = await dispatchMsg(router, msg, senderTab1);
    expect(
      (tab1Result as Record<string, unknown>)['error'] ?? tab1Result.reason,
    ).toBe('rate_limit_exceeded');

    // tab2 doit etre autorise
    const tab2Result = await dispatchMsg(router, msg, senderTab2);
    expect(tab2Result.success).toBe(true);
    vi.useRealTimers();
  });
});
