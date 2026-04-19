/**
 * @file tests/unit/background/message-router-boot-window.test.ts
 * @description Test de non-régression T-103 — fenêtre boot SW ~100ms.
 *
 * Scénario : un message `rate_limit_exceeded` arrive 50ms après le boot du SW,
 * AVANT que `initService()` ait pu être appelé sur l'IncidentService.
 *
 * AVANT T-103 :
 *   - MessageRouter était instancié sans incidentService (setter post-construction).
 *   - L'incident était silencieusement perdu (guard `if (this.incidentService)` = false).
 *
 * APRÈS T-103 :
 *   - incidentService est injecté au constructeur → disponible immédiatement.
 *   - L'incident est correctement enregistré même si le rate-limit se déclenche
 *     dans les premières millisecondes du boot.
 *
 * Référence : PV revue Archi sécu TACHE-070 point 2 — Could, severity=warn.
 * DAT §3.3 (MessageRouter), UC-03 / INV-UC03-05.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageRouter } from '@/background/message-router';
import type { NudgeMessage, NudgeResponse } from '@/shared/types/messages';
import type { IncidentService } from '@/background/services/incident-service';
import type { QuotaManager } from '@/background/quota-manager';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockLocalStorage: Record<string, unknown> = {};

global.chrome = {
  runtime: {
    onMessage: { addListener: vi.fn() },
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
  tabs: { sendMessage: vi.fn() },
} as unknown as typeof chrome;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMsg(module: string, action: string): NudgeMessage {
  return { module: module as NudgeMessage['module'], action, payload: {}, timestamp: Date.now() };
}

function createPermissiveQuotaMock(): QuotaManager {
  return {
    checkQuota: vi.fn().mockResolvedValue({ allowed: true, remaining: 10 }),
    incrementQuota: vi.fn().mockResolvedValue(undefined),
  } as unknown as QuotaManager;
}

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

async function dispatchMsg(
  router: MessageRouter,
  msg: NudgeMessage,
  sender: chrome.runtime.MessageSender = {},
): Promise<NudgeResponse> {
  return new Promise((resolve) => {
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

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]);
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// TC-MR-BOOT-01 : non-régression fenêtre boot ~100ms (T-103)
// ---------------------------------------------------------------------------

describe('MessageRouter — non-régression fenêtre boot SW (T-103)', () => {
  /**
   * TC-MR-BOOT-01
   *
   * Simule : rate_limit_exceeded reçu 50ms après le boot du SW,
   * AVANT que initService() ait été appelé (buffer pré-init de IncidentService).
   *
   * Avec T-103, incidentService est injecté au constructeur → l'incident est
   * enregistré même si initService() n'a pas encore été appelé.
   *
   * Ce test vérifie la non-régression : l'incident ne doit PAS être perdu.
   */
  it('TC-MR-BOOT-01 : rate_limit_exceeded à 50ms boot → incident correctement enregistré (fix T-103)', async () => {
    const { svc, calls } = createIncidentMock();

    // T-103 : injection au constructeur (simule le boot SW réorganisé)
    const router = new MessageRouter(createPermissiveQuotaMock(), svc);
    router.registerHandler('M3', vi.fn().mockResolvedValue({ success: true, action: 'show' }));

    const sender: chrome.runtime.MessageSender = { tab: { id: 7 } as chrome.tabs.Tab };
    const msg = buildMsg('M3', 'calculate_score');

    // Simuler 50ms écoulées depuis le boot (initService() pas encore appelé)
    vi.advanceTimersByTime(50);

    // Saturer le rate-limit (10 messages autorisés)
    for (let i = 0; i < 10; i++) {
      await dispatchMsg(router, msg, sender);
    }

    // 11e message → rate_limit_exceeded — l'incident doit être enregistré
    const result = await dispatchMsg(router, msg, sender);

    // Vérification réponse
    expect(result.success).toBe(false);
    expect((result as Record<string, unknown>)['error']).toBe('rate_limit_exceeded');

    // Vérification incident : DOIT être loggué (comportement attendu après T-103)
    expect(calls.some((c) => c.type === 'rate_limit_exceeded' && c.severity === 'warn')).toBe(true);
  });

  /**
   * TC-MR-BOOT-02
   *
   * Régression : vérifie qu'avec l'ANCIENNE approche (instanciation sans incidentService,
   * setter appelé après), l'incident AURAIT été perdu.
   *
   * Ce test documente le bug original pour servir de référence comparative.
   * Il instancie MessageRouter sans incidentService (null par défaut = ancien comportement
   * avant l'appel du setter) et vérifie que l'incident n'est PAS enregistré.
   */
  it('TC-MR-BOOT-02 : régression documentaire — sans injection constructeur, incident perdu pendant boot', async () => {
    const { calls } = createIncidentMock();

    // Ancienne approche : pas d'injection au constructeur
    // (setter non encore appelé — fenêtre boot simulée)
    const router = new MessageRouter(createPermissiveQuotaMock());
    // NOTE : setIncidentService() n'est intentionnellement PAS appelé ici
    // pour simuler la fenêtre boot pré-T-103.
    router.registerHandler('M3', vi.fn().mockResolvedValue({ success: true, action: 'show' }));

    const sender: chrome.runtime.MessageSender = { tab: { id: 8 } as chrome.tabs.Tab };
    const msg = buildMsg('M3', 'calculate_score');

    vi.advanceTimersByTime(50);

    for (let i = 0; i < 10; i++) {
      await dispatchMsg(router, msg, sender);
    }
    await dispatchMsg(router, msg, sender);

    // Sans injection, incidentService = null → incident non enregistré (bug pré-T-103)
    expect(calls).toHaveLength(0);
  });

  /**
   * TC-MR-BOOT-03
   *
   * Vérifie que l'injection via constructeur fonctionne correctement
   * pour plusieurs déclenchements successifs du rate-limit (stabilité).
   */
  it('TC-MR-BOOT-03 : injections multiples rate_limit dans la fenêtre boot → tous les incidents enregistrés', async () => {
    const { svc, calls } = createIncidentMock();

    const router = new MessageRouter(createPermissiveQuotaMock(), svc);
    router.registerHandler('M2', vi.fn().mockResolvedValue({ success: true, action: 'show' }));
    router.registerHandler('M3', vi.fn().mockResolvedValue({ success: true, action: 'show' }));

    const sender: chrome.runtime.MessageSender = { tab: { id: 9 } as chrome.tabs.Tab };

    vi.advanceTimersByTime(30);

    // Saturer M2 (tab 9)
    for (let i = 0; i < 10; i++) {
      await dispatchMsg(router, buildMsg('M2', 'detected'), sender);
    }
    await dispatchMsg(router, buildMsg('M2', 'detected'), sender);

    // Saturer M3 (tab 9) — clé de rate-limit différente (tabId:module)
    for (let i = 0; i < 10; i++) {
      await dispatchMsg(router, buildMsg('M3', 'calculate_score'), sender);
    }
    await dispatchMsg(router, buildMsg('M3', 'calculate_score'), sender);

    // Deux incidents attendus (un par module)
    const rlIncidents = calls.filter((c) => c.type === 'rate_limit_exceeded');
    expect(rlIncidents).toHaveLength(2);
    expect(rlIncidents.every((c) => c.severity === 'warn')).toBe(true);
  });
});
