/**
 * @file tests/unit/background/service-worker-install-flag.test.ts
 * @description Tests unitaires du flag `installation_in_progress` — TACHE-079 / R-M7-09.
 *
 * Couvre la garde anti-race entre l'IIFE module-level du Service Worker et
 * onInstalled(reason='install') au premier install. Sans cette garde, les deux
 * s'exécutent en quasi-simultané et l'IIFE voit la clé AES absente (pas encore
 * écrite par onFirstInstall), produisant deux incidents fantômes boot_fail +
 * key_regenerated qui polluent la forensique (R-M7-04) et R-M7-09.
 *
 * Scénarios couverts :
 * - TC-01 : flag posé par onFirstInstall → IIFE skip (canary verify + key regen skippés)
 * - TC-01b : flag posé en boolean true (rétrocompatibilité) → IIFE skip aussi
 * - TC-02 : onFirstInstall terminé (finally levé) → IIFE suivante procède normalement
 * - TC-02b : flag removal explicite → IIFE procède au boot complet
 * - TC-03 : flag orphelin timestamp > 60s → IIFE ignore + log warn install_flag_stale
 * - TC-03b : flag orphelin (timestamp exact à la limite) → skip toujours si < 60s
 * - TC-03c : flag orphelin supprimé → boot nominal après nettoyage
 * - TC-04 : pas de flag → comportement nominal, heartbeat démarre
 * - TC-04b : storage vide (résultat {} sans clé) → comportement nominal préservé
 * - TC-05 : log info émis avec hint=install_in_progress quand skip
 * - TC-05b : log warn émis avec hint=install_flag_stale quand stale
 * - TC-06 : flag posé + flag levé en finally même en cas d'exception dans onFirstInstall
 *
 * Stratégie : simuler les logiques de onFirstInstall() et de l'IIFE via des helpers
 * reproduisant EXACTEMENT le code de service-worker.ts, sans l'importer (l'import
 * déclencherait les side-effects module-level : listeners chrome.runtime, IIFE).
 *
 * Référence : TACHE-079, R-M7-09 (RISQUES.md), ADR-001 R-BOOT-01/04
 *             service-worker.ts étape 0 (garde anti-race)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock chrome.storage.local
// ---------------------------------------------------------------------------

const mockLocalStorage: Record<string, unknown> = {};
const removedKeys: string[] = [];
const warnCalls: Array<{ message: string; context?: Record<string, unknown> }> = [];
const infoCalls: Array<{ message: string; context?: Record<string, unknown> }> = [];

global.chrome = {
  storage: {
    local: {
      get: vi.fn((keys: string[], callback: (r: Record<string, unknown>) => void) => {
        const result: Record<string, unknown> = {};
        keys.forEach((k) => {
          if (k in mockLocalStorage) result[k] = mockLocalStorage[k];
        });
        callback(result);
      }),
      set: vi.fn((items: Record<string, unknown>, callback?: () => void) => {
        Object.assign(mockLocalStorage, items);
        callback?.();
      }),
      remove: vi.fn((key: string | string[], callback?: () => void) => {
        const keys = Array.isArray(key) ? key : [key];
        keys.forEach((k) => {
          removedKeys.push(k);
          delete mockLocalStorage[k];
        });
        callback?.();
      }),
    },
  },
} as unknown as typeof chrome;

// ---------------------------------------------------------------------------
// Constants (reproduites depuis service-worker.ts pour les tests — TACHE-079)
// ---------------------------------------------------------------------------

/** TTL du flag installation_in_progress au-delà duquel il est considéré stale (60 secondes) */
const INSTALL_FLAG_STALE_MS = 60 * 1_000;

// ---------------------------------------------------------------------------
// Helpers — simulent la logique de service-worker.ts sans l'importer
// ---------------------------------------------------------------------------

/**
 * Simule le comportement de onFirstInstall() pour le flag anti-race (TACHE-079).
 *
 * Reproduit exactement :
 * 1. `browser.storage.local.set({ installation_in_progress: Date.now() })`
 * 2. `try { await body() } finally { browser.storage.local.remove('installation_in_progress') }`
 *
 * @param body - Corps async de onFirstInstall() à exécuter entre pose et levée
 */
async function simulateOnFirstInstall(body: () => Promise<void>): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ installation_in_progress: Date.now() }, resolve);
  });
  try {
    await body();
  } finally {
    await new Promise<void>((resolve) => {
      chrome.storage.local.remove('installation_in_progress', resolve);
    });
  }
}

/** Résultat de la simulation de l'IIFE étape 0 */
interface IifeStep0Result {
  /** true si l'IIFE a sauté son exécution (flag présent et récent) */
  skipped: boolean;
  /** true si le flag était stale (> 60s) et a été nettoyé */
  wasStale: boolean;
  /** true si le boot a continué (pas skipped et pas d'erreur) */
  bootContinued: boolean;
}

/**
 * Simule l'étape 0 de l'IIFE de service-worker.ts (garde anti-race TACHE-079).
 *
 * Reproduit exactement la logique :
 * 1. `const installFlagValue = installCheck['installation_in_progress']`
 * 2. Si présent + récent → skip (return)
 * 3. Si présent + stale (> INSTALL_FLAG_STALE_MS) → log warn + remove + continuer
 * 4. Si absent → continuer normalement
 */
async function simulateIifeStep0(): Promise<IifeStep0Result> {
  const installCheck = await new Promise<Record<string, unknown>>((resolve) => {
    chrome.storage.local.get(['installation_in_progress'], resolve);
  });

  const installFlagValue = installCheck['installation_in_progress'];

  if (installFlagValue) {
    const isTimestamp = typeof installFlagValue === 'number';
    const isStale =
      isTimestamp && Date.now() - (installFlagValue as number) > INSTALL_FLAG_STALE_MS;

    if (isStale) {
      // Fallback safety : flag orphelin — log warn + nettoyer + continuer
      warnCalls.push({
        message: 'SW init: install flag stale (> 60s) — flag nettoyé, boot normal (TACHE-079)',
        context: {
          hint: 'install_flag_stale',
          flag_age_ms: Date.now() - (installFlagValue as number),
        },
      });
      await new Promise<void>((resolve) => {
        chrome.storage.local.remove('installation_in_progress', resolve);
      });
      return { skipped: false, wasStale: true, bootContinued: true };
    } else {
      // Flag présent et récent → skip
      infoCalls.push({
        message: 'SW init: installation_in_progress — IIFE boot skipped (TACHE-079)',
        context: { hint: 'install_in_progress' },
      });
      return { skipped: true, wasStale: false, bootContinued: false };
    }
  }

  // Pas de flag → boot normal
  return { skipped: false, wasStale: false, bootContinued: true };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TACHE-079 — flag installation_in_progress (service-worker.ts)', () => {
  beforeEach(() => {
    // Réinitialiser le storage et les logs avant chaque test
    Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]);
    removedKeys.length = 0;
    warnCalls.length = 0;
    infoCalls.length = 0;
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // TC-01 : flag posé par onFirstInstall → IIFE skip
  // ---------------------------------------------------------------------------

  it('TC-01 : flag posé (timestamp récent) → IIFE skip, canary/key regen non exécutés', async () => {
    // onFirstInstall pose le flag avec un timestamp récent
    mockLocalStorage['installation_in_progress'] = Date.now();

    const result = await simulateIifeStep0();

    // L'IIFE doit avoir sauté
    expect(result.skipped).toBe(true);
    expect(result.wasStale).toBe(false);
    expect(result.bootContinued).toBe(false);

    // Log info émis
    expect(infoCalls).toHaveLength(1);
    expect(infoCalls[0].context?.hint).toBe('install_in_progress');
  });

  it('TC-01b : flag en boolean true (rétrocompatibilité) → IIFE skip aussi', async () => {
    // Format boolean (ancien format avant TACHE-079) — doit toujours skip
    mockLocalStorage['installation_in_progress'] = true;

    const result = await simulateIifeStep0();

    // Un boolean true n'est pas un timestamp → isTimestamp=false → isStale=false → skip
    expect(result.skipped).toBe(true);
    expect(result.wasStale).toBe(false);
    expect(result.bootContinued).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // TC-02 : onFirstInstall terminé → IIFE suivante procède normalement
  // ---------------------------------------------------------------------------

  it('TC-02 : onFirstInstall complet (finally levé) → IIFE suivante non bloquée', async () => {
    let flagDuringInstall: boolean = false;

    await simulateOnFirstInstall(async () => {
      // Pendant l'install : flag présent
      flagDuringInstall = Boolean(mockLocalStorage['installation_in_progress']);
    });

    // Après l'install : flag levé
    expect(flagDuringInstall).toBe(true);
    expect(mockLocalStorage['installation_in_progress']).toBeUndefined();
    expect(removedKeys).toContain('installation_in_progress');

    // L'IIFE suivante procède normalement
    const result = await simulateIifeStep0();
    expect(result.skipped).toBe(false);
    expect(result.bootContinued).toBe(true);
  });

  it('TC-02b : removal explicite du flag → IIFE procède au boot complet', async () => {
    // Poser puis retirer le flag manuellement
    mockLocalStorage['installation_in_progress'] = Date.now();
    delete mockLocalStorage['installation_in_progress'];

    const result = await simulateIifeStep0();

    expect(result.skipped).toBe(false);
    expect(result.bootContinued).toBe(true);
    expect(infoCalls).toHaveLength(0);
    expect(warnCalls).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // TC-03 : flag orphelin (timestamp > 60s) → IIFE ignore + log warn install_flag_stale
  // ---------------------------------------------------------------------------

  it('TC-03 : flag orphelin (timestamp > 60s) → IIFE ignore flag + log warn install_flag_stale', async () => {
    // Simuler un flag posé il y a 65 secondes (> INSTALL_FLAG_STALE_MS=60s)
    const staleTimestamp = Date.now() - (INSTALL_FLAG_STALE_MS + 5_000);
    mockLocalStorage['installation_in_progress'] = staleTimestamp;

    const result = await simulateIifeStep0();

    // L'IIFE ne doit PAS sauter (flag stale)
    expect(result.skipped).toBe(false);
    expect(result.wasStale).toBe(true);
    expect(result.bootContinued).toBe(true);

    // Log warn install_flag_stale émis
    expect(warnCalls).toHaveLength(1);
    expect(warnCalls[0].context?.hint).toBe('install_flag_stale');

    // Flag nettoyé du storage
    expect(mockLocalStorage['installation_in_progress']).toBeUndefined();
    expect(removedKeys).toContain('installation_in_progress');
  });

  it('TC-03b : flag récent (exactement à la limite < 60s) → IIFE skip (pas stale)', async () => {
    // Simuler un flag posé il y a 59 secondes (< INSTALL_FLAG_STALE_MS)
    const recentTimestamp = Date.now() - (INSTALL_FLAG_STALE_MS - 1_000);
    mockLocalStorage['installation_in_progress'] = recentTimestamp;

    const result = await simulateIifeStep0();

    // Doit être considéré récent → skip
    expect(result.skipped).toBe(true);
    expect(result.wasStale).toBe(false);
    expect(warnCalls).toHaveLength(0);
    expect(infoCalls).toHaveLength(1);
  });

  it('TC-03c : après nettoyage flag stale → boot nominal sans incident fantôme', async () => {
    // Simuler un flag stale
    mockLocalStorage['installation_in_progress'] = Date.now() - 90_000;

    const result = await simulateIifeStep0();
    expect(result.wasStale).toBe(true);

    // Après nettoyage, un deuxième appel ne voit plus le flag
    const result2 = await simulateIifeStep0();
    expect(result2.skipped).toBe(false);
    expect(result2.wasStale).toBe(false);
    expect(result2.bootContinued).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // TC-04 : pas de flag → comportement nominal
  // ---------------------------------------------------------------------------

  it('TC-04 : storage sans flag → boot nominal, aucun skip, aucun warn', async () => {
    // Storage vide (pas de flag installation_in_progress)
    expect(mockLocalStorage['installation_in_progress']).toBeUndefined();

    const result = await simulateIifeStep0();

    expect(result.skipped).toBe(false);
    expect(result.wasStale).toBe(false);
    expect(result.bootContinued).toBe(true);
    expect(infoCalls).toHaveLength(0);
    expect(warnCalls).toHaveLength(0);
  });

  it('TC-04b : résultat {} (clé absente du storage) → comportement nominal préservé', async () => {
    // Simuler chrome.storage.local.get retournant {} (clé inexistante)
    // — mockLocalStorage vide, la clé n'est pas dans le résultat
    const result = await simulateIifeStep0();

    // undefined est falsy → pas de skip
    expect(result.skipped).toBe(false);
    expect(result.bootContinued).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // TC-05 : incidents logués avec hints corrects
  // ---------------------------------------------------------------------------

  it('TC-05 : log info émis avec hint=install_in_progress lors du skip', async () => {
    mockLocalStorage['installation_in_progress'] = Date.now();

    await simulateIifeStep0();

    // Vérifier que le log info contient bien le hint attendu
    expect(infoCalls).toHaveLength(1);
    const logEntry = infoCalls[0];
    expect(logEntry.message).toContain('IIFE boot skipped');
    expect(logEntry.context?.hint).toBe('install_in_progress');
    // Pas de warn émis dans ce cas
    expect(warnCalls).toHaveLength(0);
  });

  it('TC-05b : log warn émis avec hint=install_flag_stale lors du fallback stale', async () => {
    mockLocalStorage['installation_in_progress'] = Date.now() - 120_000; // 2 minutes d'age

    await simulateIifeStep0();

    // Vérifier que le log warn contient bien le hint attendu
    expect(warnCalls).toHaveLength(1);
    const logEntry = warnCalls[0];
    expect(logEntry.message).toContain('stale');
    expect(logEntry.context?.hint).toBe('install_flag_stale');
    expect(typeof logEntry.context?.flag_age_ms).toBe('number');
    // Pas de log info dans ce cas
    expect(infoCalls).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // TC-06 : onFirstInstall lève le flag en finally même en cas d'exception
  // ---------------------------------------------------------------------------

  it('TC-06 : flag levé en finally même si onFirstInstall lève une exception', async () => {
    let flagDuringInstall: boolean = false;

    await expect(
      simulateOnFirstInstall(async () => {
        flagDuringInstall = Boolean(mockLocalStorage['installation_in_progress']);
        throw new Error('Erreur simulée — crash dans onFirstInstall');
      }),
    ).rejects.toThrow('Erreur simulée — crash dans onFirstInstall');

    // Pendant l'install : flag était posé
    expect(flagDuringInstall).toBe(true);

    // Après l'exception (finally garanti) : flag levé
    expect(mockLocalStorage['installation_in_progress']).toBeUndefined();
    expect(removedKeys).toContain('installation_in_progress');

    // L'IIFE suivante peut procéder normalement
    const result = await simulateIifeStep0();
    expect(result.skipped).toBe(false);
    expect(result.bootContinued).toBe(true);
  });
});
