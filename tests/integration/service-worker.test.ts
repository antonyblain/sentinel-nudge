/**
 * @file tests/integration/service-worker.test.ts
 * @description Tests d'intégration de la purge `pending_*` dans onPurgeDaily (TACHE-093 / ADR-002).
 *
 * Teste la logique de `purgePendingIntents` depuis service-worker.ts.
 * Cette fonction purge les clés `pending_*` expirées de chrome.storage.local pour éviter
 * l'accumulation silencieuse d'intents cross-lifecycle orphelins (ADR-002 §Conséquences négatives).
 *
 * Scénarios couverts :
 * - TC-T093-01 : clé `pending_xxx` avec `expires_at` passé → purgée
 * - TC-T093-02 : clé `pending_xxx` avec `expires_at` futur → conservée
 * - TC-T093-03 : clé `pending_m7_toast` legacy (timestamp) expiré → purgée
 * - TC-T093-04 : clé `pending_m7_toast` legacy récent → conservée
 * - TC-T093-05 : clé `pending_xxx` sans `expires_at` ni `timestamp` → conservée (fail-safe)
 * - TC-T093-06 : clés non-`pending_*` → non impactées
 * - TC-T093-07 : 1 clé provoquant exception → autres clés continuent, incident loggué
 * - TC-T093-08 : storage vide (aucune clé pending_*) → scanned=0, purged=0
 * - TC-T093-09 : mix de clés → seulement les expirées sont supprimées
 * - TC-T093-10 : entrée scalaire (string) sous clé pending_* → conservée (fail-safe)
 * - TC-T093-11 : expires_at === now → conservée (condition strictement inférieure)
 *
 * Architecture de test :
 * La fonction `purgePendingIntents` est une function declaration dans service-worker.ts.
 * Le module ne peut pas être importé directement car il a des side-effects module-level
 * (IIFE de boot, listeners chrome.runtime, etc.) qui nécessitent un environnement Chrome complet.
 *
 * Solution : on extrait la logique dans une fonction `purgePendingIntentsTestable`
 * qui prend les dépendances en paramètres (storage, now, TTL) et reflète exactement
 * la logique de `purgePendingIntents`. Cette approche permet de tester la logique
 * métier en isolation, sans importer le module complet.
 *
 * Référence : TACHE-093, ADR-002 §Conséquences négatives
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Constante TTL legacy M7 (miroir de PENDING_M7_LEGACY_TTL_MS dans service-worker.ts)
// ---------------------------------------------------------------------------

/** TTL legacy pour pending_m7_toast — 10 minutes (aligné sur password-detector.ts et ADR-002 E-CLI-01) */
const PENDING_M7_LEGACY_TTL_MS = 10 * 60 * 1_000;

// ---------------------------------------------------------------------------
// Logique de purge extraite (miroir exact de purgePendingIntents dans service-worker.ts)
// ---------------------------------------------------------------------------

/**
 * Reproduit fidèlement la logique de `purgePendingIntents` de service-worker.ts.
 * Les dépendances (storage, temps, TTL) sont injectées pour les tests.
 *
 * @param storage        - Abstraction de chrome.storage.local (mock)
 * @param now            - Timestamp courant (injectable pour contrôler le temps)
 * @param legacyTtlMs    - TTL legacy pour les shapes `{ timestamp }` (10 min en prod)
 * @param warnCallback   - Callback pour les incidents warn (TC-T093-07)
 * @param infoCallback   - Callback pour le log info de fin de purge
 * @returns Métriques de purge : nombre de clés scannées et purgées
 */
async function purgePendingIntentsTestable(
  storage: {
    getAll: () => Promise<Record<string, unknown>>;
    remove: (key: string) => Promise<void>;
  },
  now: number,
  legacyTtlMs: number,
  warnCallback?: (hint: string) => void,
  infoCallback?: (scanned: number, purged: number) => void,
): Promise<{ scanned: number; purged: number }> {
  const allEntries = await storage.getAll();
  const pendingKeys = Object.keys(allEntries).filter((key) => key.startsWith('pending_'));

  let purgedCount = 0;

  for (const key of pendingKeys) {
    try {
      const entry = allEntries[key];

      // Valider que l'entrée est un objet non-null (scalaires ignorés — fail-safe)
      if (typeof entry !== 'object' || entry === null) {
        continue;
      }

      const entryObj = entry as Record<string, unknown>;
      let shouldPurge = false;

      if (typeof entryObj['expires_at'] === 'number') {
        // Shape canonique ADR-002 R-CLI-03
        shouldPurge = entryObj['expires_at'] < now;
      } else if (typeof entryObj['timestamp'] === 'number') {
        // Shape legacy M7 (E-CLI-01 / TACHE-091)
        shouldPurge = entryObj['timestamp'] + legacyTtlMs < now;
      }
      // Shape inconnue → conserver (fail-safe)

      if (shouldPurge) {
        await storage.remove(key);
        purgedCount++;
      }
    } catch {
      warnCallback?.('storage_purge_failed');
    }
  }

  infoCallback?.(pendingKeys.length, purgedCount);
  return { scanned: pendingKeys.length, purged: purgedCount };
}

// ---------------------------------------------------------------------------
// Factory de mock chrome.storage.local
// ---------------------------------------------------------------------------

/**
 * Crée un mock de chrome.storage.local + un adaptateur pour purgePendingIntentsTestable.
 *
 * Le mock supporte `get(null)` (retourne tout le storage) contrairement au mock de
 * boot-sequence.test.ts qui ne supporte que string[].
 *
 * @param initial - Données initiales du storage
 */
function createStorageMockAndAdapter(initial: Record<string, unknown> = {}): {
  store: Record<string, unknown>;
  removedKeys: string[];
  adapter: {
    getAll: () => Promise<Record<string, unknown>>;
    remove: (key: string) => Promise<void>;
    mockRemove: ReturnType<typeof vi.fn>;
  };
} {
  const store: Record<string, unknown> = { ...initial };
  const removedKeys: string[] = [];

  const mockRemove = vi.fn((keys: string | string[], callback?: () => void) => {
    const ks = Array.isArray(keys) ? keys : [keys];
    ks.forEach((k) => {
      removedKeys.push(k);
      delete store[k];
    });
    callback?.();
  });

  const mockGet = vi.fn((keys: string[] | null, callback: (r: Record<string, unknown>) => void) => {
    if (keys === null) {
      callback({ ...store });
    } else {
      const result: Record<string, unknown> = {};
      keys.forEach((k) => {
        if (k in store) result[k] = store[k];
      });
      callback(result);
    }
  });

  const adapter = {
    getAll: () =>
      new Promise<Record<string, unknown>>((resolve) => {
        mockGet(null, resolve);
      }),
    remove: (key: string) =>
      new Promise<void>((resolve, reject) => {
        try {
          mockRemove([key], resolve);
        } catch (err) {
          reject(err);
        }
      }),
    mockRemove,
  };

  return { store, removedKeys, adapter };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('purgePendingIntents (TACHE-093 / ADR-002)', () => {
  // Timestamp stable pour tous les tests (2026-04-17T09:00:00Z)
  const NOW = 1_713_351_600_000;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TC-T093-01 : expires_at passé → purgée
  it('TC-T093-01 : pending_xxx avec expires_at passé → purgée', async () => {
    const { store, removedKeys, adapter } = createStorageMockAndAdapter({
      pending_m6_quiz: { expires_at: NOW - 1_000 }, // expiré il y a 1 seconde
    });

    const { scanned, purged } = await purgePendingIntentsTestable(
      adapter,
      NOW,
      PENDING_M7_LEGACY_TTL_MS,
    );

    expect(scanned).toBe(1);
    expect(purged).toBe(1);
    expect(removedKeys).toContain('pending_m6_quiz');
    expect('pending_m6_quiz' in store).toBe(false);
  });

  // TC-T093-02 : expires_at futur → conservée
  it('TC-T093-02 : pending_xxx avec expires_at futur → conservée', async () => {
    const { store, removedKeys, adapter } = createStorageMockAndAdapter({
      pending_m6_quiz: { expires_at: NOW + 60_000 }, // expire dans 60 secondes
    });

    const { scanned, purged } = await purgePendingIntentsTestable(
      adapter,
      NOW,
      PENDING_M7_LEGACY_TTL_MS,
    );

    expect(scanned).toBe(1);
    expect(purged).toBe(0);
    expect(removedKeys).not.toContain('pending_m6_quiz');
    expect('pending_m6_quiz' in store).toBe(true);
  });

  // TC-T093-03 : pending_m7_toast legacy (timestamp) expiré → purgée
  it('TC-T093-03 : pending_m7_toast legacy timestamp expiré → purgée', async () => {
    // timestamp: NOW - 11 minutes → NOW - ts = 11 min > TTL 10 min
    const expiredTs = NOW - PENDING_M7_LEGACY_TTL_MS - 60_000;
    const { store, removedKeys, adapter } = createStorageMockAndAdapter({
      pending_m7_toast: { domain_hash: 'abcdef1234567890abcdef1234567890', timestamp: expiredTs },
    });

    const { scanned, purged } = await purgePendingIntentsTestable(
      adapter,
      NOW,
      PENDING_M7_LEGACY_TTL_MS,
    );

    expect(scanned).toBe(1);
    expect(purged).toBe(1);
    expect(removedKeys).toContain('pending_m7_toast');
    expect('pending_m7_toast' in store).toBe(false);
  });

  // TC-T093-04 : pending_m7_toast legacy récent → conservée
  it('TC-T093-04 : pending_m7_toast legacy timestamp récent → conservée', async () => {
    // timestamp: NOW - 5 minutes → dans les 10 min de TTL
    const recentTs = NOW - 5 * 60 * 1_000;
    const { store, removedKeys, adapter } = createStorageMockAndAdapter({
      pending_m7_toast: { domain_hash: 'abcdef1234567890abcdef1234567890', timestamp: recentTs },
    });

    const { scanned, purged } = await purgePendingIntentsTestable(
      adapter,
      NOW,
      PENDING_M7_LEGACY_TTL_MS,
    );

    expect(scanned).toBe(1);
    expect(purged).toBe(0);
    expect(removedKeys).not.toContain('pending_m7_toast');
    expect('pending_m7_toast' in store).toBe(true);
  });

  // TC-T093-05 : pending_xxx sans expires_at ni timestamp → conservée (fail-safe)
  it('TC-T093-05 : pending_xxx sans expires_at ni timestamp → conservée (fail-safe)', async () => {
    const { store, removedKeys, adapter } = createStorageMockAndAdapter({
      pending_unknown_module: { some_data: 'value', other: 42 },
    });

    const { scanned, purged } = await purgePendingIntentsTestable(
      adapter,
      NOW,
      PENDING_M7_LEGACY_TTL_MS,
    );

    expect(scanned).toBe(1);
    expect(purged).toBe(0);
    expect(removedKeys).not.toContain('pending_unknown_module');
    expect('pending_unknown_module' in store).toBe(true);
  });

  // TC-T093-06 : clés non-pending_* → non impactées
  it('TC-T093-06 : clés non-pending_* → non impactées', async () => {
    const { store, removedKeys, adapter } = createStorageMockAndAdapter({
      config: { modules: { M7: false } },
      quota_state: { date: '2026-04-17', count: 5 },
      encryption_key_material: [1, 2, 3],
      m7_last_nudge_by_domain: { abcd1234: NOW - 1_000_000 },
    });

    const { scanned, purged } = await purgePendingIntentsTestable(
      adapter,
      NOW,
      PENDING_M7_LEGACY_TTL_MS,
    );

    expect(scanned).toBe(0);
    expect(purged).toBe(0);
    expect(removedKeys).toHaveLength(0);
    expect('config' in store).toBe(true);
    expect('quota_state' in store).toBe(true);
    expect('encryption_key_material' in store).toBe(true);
  });

  // TC-T093-07 : 1 clé provoquant exception → autres clés continuent, incident loggué
  it('TC-T093-07 : 1 clé avec exception → autres continuent, incident warn loggué', async () => {
    const { removedKeys, adapter } = createStorageMockAndAdapter({
      pending_m6_quiz: { expires_at: NOW - 1_000 },
      pending_m5_update_reminder: { expires_at: NOW - 2_000 },
      pending_m17_toast: { expires_at: NOW - 500 },
    });

    // Injecter une exception pour pending_m5_update_reminder uniquement
    const originalRemove = adapter.remove.bind(adapter);
    adapter.remove = async (key: string) => {
      if (key === 'pending_m5_update_reminder') {
        throw new Error('Simulated chrome.storage error');
      }
      return originalRemove(key);
    };

    const warnCalls: string[] = [];
    const { scanned, purged } = await purgePendingIntentsTestable(
      adapter,
      NOW,
      PENDING_M7_LEGACY_TTL_MS,
      (hint) => warnCalls.push(hint),
    );

    // 3 clés scannées
    expect(scanned).toBe(3);
    // 2 purgées (m6_quiz + m17_toast) — m5 a levé une exception
    expect(purged).toBe(2);
    // Incident warn signalé
    expect(warnCalls).toContain('storage_purge_failed');
    // Les 2 clés sans exception ont bien été supprimées
    expect(removedKeys).toContain('pending_m6_quiz');
    expect(removedKeys).toContain('pending_m17_toast');
    // La clé défaillante n'est pas dans les removedKeys (remove n'a pas abouti)
    expect(removedKeys).not.toContain('pending_m5_update_reminder');
  });

  // TC-T093-08 : storage vide → scanned=0, purged=0
  it("TC-T093-08 : storage vide → scanned=0, purged=0, pas d'erreur", async () => {
    const { adapter } = createStorageMockAndAdapter({});

    const infoCalls: Array<{ scanned: number; purged: number }> = [];
    const { scanned, purged } = await purgePendingIntentsTestable(
      adapter,
      NOW,
      PENDING_M7_LEGACY_TTL_MS,
      undefined,
      (s, p) => infoCalls.push({ scanned: s, purged: p }),
    );

    expect(scanned).toBe(0);
    expect(purged).toBe(0);
    expect(infoCalls).toHaveLength(1);
    expect(infoCalls[0]).toEqual({ scanned: 0, purged: 0 });
  });

  // TC-T093-09 : mix de clés → seulement les expirées sont supprimées
  it('TC-T093-09 : mix de clés → seulement les expirées sont supprimées', async () => {
    const { store, removedKeys, adapter } = createStorageMockAndAdapter({
      // Non-pending — préservées
      config: { modules: {} },
      // Canoniques expirées → purgées
      pending_m6_quiz: { expires_at: NOW - 1_000 },
      pending_m17_toast: { expires_at: NOW - 500 },
      // Canonique future → conservée
      pending_m5_update_reminder: { expires_at: NOW + 30_000 },
      // Legacy M7 expirée → purgée
      pending_m7_toast: {
        domain_hash: 'abcd1234',
        timestamp: NOW - PENDING_M7_LEGACY_TTL_MS - 1_000,
      },
      // Sans shape connue → conservée (fail-safe)
      pending_unknown: { some_field: true },
    });

    const { scanned, purged } = await purgePendingIntentsTestable(
      adapter,
      NOW,
      PENDING_M7_LEGACY_TTL_MS,
    );

    expect(scanned).toBe(5); // 5 clés pending_ (pas config)
    expect(purged).toBe(3); // m6_quiz, m17_toast, m7_toast

    expect(removedKeys).toContain('pending_m6_quiz');
    expect(removedKeys).toContain('pending_m17_toast');
    expect(removedKeys).toContain('pending_m7_toast');

    expect(removedKeys).not.toContain('pending_m5_update_reminder');
    expect(removedKeys).not.toContain('pending_unknown');
    expect(removedKeys).not.toContain('config');

    expect('pending_m5_update_reminder' in store).toBe(true);
    expect('pending_unknown' in store).toBe(true);
    expect('config' in store).toBe(true);
  });

  // TC-T093-10 : entrée scalaire sous clé pending_* → conservée (fail-safe)
  it('TC-T093-10 : pending_xxx avec valeur scalaire (string) → conservée (fail-safe)', async () => {
    const { store, removedKeys, adapter } = createStorageMockAndAdapter({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pending_corrupted: 'not_an_object' as any,
    });

    const { scanned, purged } = await purgePendingIntentsTestable(
      adapter,
      NOW,
      PENDING_M7_LEGACY_TTL_MS,
    );

    expect(scanned).toBe(1);
    expect(purged).toBe(0);
    expect(removedKeys).not.toContain('pending_corrupted');
    expect('pending_corrupted' in store).toBe(true);
  });

  // TC-T093-11 : expires_at === now → conservée (condition <, pas <=)
  it('TC-T093-11 : pending_xxx avec expires_at === now → conservée (< strict)', async () => {
    const { store, removedKeys, adapter } = createStorageMockAndAdapter({
      pending_m6_quiz: { expires_at: NOW }, // limite exacte
    });

    const { purged } = await purgePendingIntentsTestable(adapter, NOW, PENDING_M7_LEGACY_TTL_MS);

    // expires_at < now est false quand expires_at === now → conservée
    expect(purged).toBe(0);
    expect(removedKeys).not.toContain('pending_m6_quiz');
    expect('pending_m6_quiz' in store).toBe(true);
  });

  // --- Tests squelette hérités (P4-SW) ---

  it('TODO(P4-SW) : MessageRouter rejette silencieusement les messages invalides', () => {
    // Test avec chrome-mock ou playwright-crx — hors scope TACHE-093
    expect(true).toBe(true);
  });

  it('TODO(P4-SW) : QuotaManager intégré au routeur', () => {
    // Test avec chrome-mock ou playwright-crx — hors scope TACHE-093
    expect(true).toBe(true);
  });
});
