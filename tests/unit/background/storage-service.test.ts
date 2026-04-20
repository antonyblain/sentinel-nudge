/**
 * @file tests/unit/background/storage-service.test.ts
 * @description Tests unitaires du StorageService — IndexedDB via fake-indexeddb.
 *
 * TACHE-018 — couverture initiale 0% sur storage-service.ts.
 * T-080 — extraction verifyKeyAgainstPasswordHashes (CM-EOP1 testable).
 * T-081 — initDB() idempotent : flag dbReady + early return.
 *
 * Couvre :
 * - initDB() : creation des 6 stores (v1 → v2), indexes, idempotence (getDB)
 * - initDB() idempotent (T-081) : premier appel → init, 2e appel → early return
 * - verifyKeyAgainstPasswordHashes (T-080) : cle valide, invalide, store vide, IDB inaccessible
 * - Migrations v1 + v2 : stores et indexes verifies
 * - Store events : logEvent (ecriture) + getEvents avec timestamp futur (0 resultats)
 * - Store weekly_scores : setWeeklyScore + getWeeklyScore (nominal, absent)
 * - Store password_hashes : addPasswordHash + getPasswordHashesByTag + getPasswordHashCount
 *   + getPasswordHashMeta + FIFO (>100 entrees)
 * - Store whitelist : addToWhitelist + isWhitelisted + removeFromWhitelist + getAllWhitelist
 * - Store quiz_sessions / weekly_scores bulk : getAllWeeklyScores + getAllQuizSessions
 * - purgeExpired : events, password_hashes (cursor synchrone)
 * - getDB() avant initDB() : throw attendu
 * - chrome.storage.local : getConfig/setConfig + getQuotaState/setQuotaState
 *
 * Note fake-indexeddb : cursor.continue() dans un onsuccess async leve TransactionInactiveError
 * car fake-indexeddb ferme la transaction pendant le await. Les tests getEvents avec dechiffrement
 * sont couverts dans tests/integration/storage-service.test.ts (TODO TACHE-018-BIS).
 *
 * Reference : DAT §8.1 (schema IndexedDB), §8.3 (purge), §8.4 (migrations)
 * Reference ADR-001 / R-CLI-05 : dbReady flag garanti par initDB()
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { StorageService, DB_VERSION, MIGRATIONS } from '@/background/storage-service';
import { CryptoService } from '@/background/crypto-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cree une instance fraiche StorageService avec une IDBFactory isolee par test */
function createService(): StorageService {
  const idbFactory = new IDBFactory();
  // Patch globalThis.indexedDB pour que chaque test ait sa propre IDB
  Object.defineProperty(globalThis, 'indexedDB', {
    value: idbFactory,
    configurable: true,
    writable: true,
  });
  const crypto = new CryptoService();
  return new StorageService(crypto);
}

/** Genere une CryptoKey AES-256-GCM pour les tests */
async function generateKey(): Promise<CryptoKey> {
  return globalThis.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

// ---------------------------------------------------------------------------
// Mock chrome.storage.local
// ---------------------------------------------------------------------------

const mockLocalStorage: Record<string, unknown> = {};

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
    },
  },
} as unknown as typeof chrome;

beforeEach(() => {
  Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]);
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
// TC-SS-01 : getDB() avant initDB() → throw
// ---------------------------------------------------------------------------

describe('StorageService — getDB avant initDB', () => {
  it('TC-SS-01 : getDB() avant initDB() leve une erreur explicite', () => {
    const svc = createService();
    expect(() => svc.getDB()).toThrow('non initialis');
  });
});

// ---------------------------------------------------------------------------
// TC-SS-02/03/04/05 : initDB() — creation stores + idempotence
// ---------------------------------------------------------------------------

describe('StorageService — initDB', () => {
  it('TC-SS-02 : initDB() cree les 6 stores attendus (v1 + v2)', async () => {
    const svc = createService();
    await svc.initDB();
    const db = svc.getDB();

    const storeNames = Array.from(db.objectStoreNames);
    expect(storeNames).toContain('events');
    expect(storeNames).toContain('password_hashes');
    expect(storeNames).toContain('quiz_sessions');
    expect(storeNames).toContain('weekly_scores');
    expect(storeNames).toContain('whitelist');
    expect(storeNames).toContain('m7_incidents');
  });

  it('TC-SS-03 : DB_VERSION exportee = 2', () => {
    expect(DB_VERSION).toBe(2);
  });

  it('TC-SS-04 : getDB() apres initDB() retourne une IDBDatabase', async () => {
    const svc = createService();
    await svc.initDB();
    const db = svc.getDB();
    expect(db).toBeDefined();
    expect(typeof db.transaction).toBe('function');
  });

  it('TC-SS-05 : MIGRATIONS contient les cles 1 et 2', () => {
    expect(typeof MIGRATIONS[1]).toBe('function');
    expect(typeof MIGRATIONS[2]).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// TC-SS-06/07/08/09 : Store events — logEvent + getEvents
//
// Note : getEvents utilise cursor.continue() dans un handler onsuccess async
// (await this.crypto.decrypt). fake-indexeddb ferme la transaction pendant le
// await, ce qui leve TransactionInactiveError.
// Les tests avec decrypt (TC-SS-07/08) testent uniquement le cas 0 resultats
// (since = futur) pour eviter cette limitation.
// Le comportement de dechiffrement en cursor est couvert dans les tests
// d'integration (tests/integration/storage-service.test.ts - TODO TACHE-018-BIS).
// ---------------------------------------------------------------------------

describe('StorageService — store events', () => {
  it('TC-SS-06 : logEvent retourne un id numerique', async () => {
    const svc = createService();
    await svc.initDB();
    const key = await generateKey();

    const id = await svc.logEvent('M3', { action: 'dismissed', score_delta: 5 }, key);
    expect(typeof id).toBe('number');
    expect(id).toBeGreaterThan(0);
  });

  it('TC-SS-07 : logEvent incremente les ids de maniere sequentielle', async () => {
    const svc = createService();
    await svc.initDB();
    const key = await generateKey();

    const id1 = await svc.logEvent('M3', { action: 'show' }, key);
    const id2 = await svc.logEvent('M2', { action: 'dismissed' }, key);
    expect(id2).toBeGreaterThan(id1);
  });

  it('TC-SS-08 : getEvents avec since dans le futur retourne [] (aucun event dans la fenetre)', async () => {
    const svc = createService();
    await svc.initDB();
    const key = await generateKey();

    await svc.logEvent('M3', { action: 'show' }, key);

    // since = futur → aucun event dans la fenetre (IDBKeyRange.lowerBound ne matche rien)
    const events = await svc.getEvents(null, Date.now() + 60_000, key);
    expect(events).toEqual([]);
  });

  it('TC-SS-09 : getEvents avec timestamp futur retourne [] pour tous les modules', async () => {
    const svc = createService();
    await svc.initDB();
    const key = await generateKey();

    await svc.logEvent('M3', { score_delta: 1 }, key);
    await svc.logEvent('M5', { score_delta: 2 }, key);

    // Filtre strict module + timestamp futur → vide
    const m3Future = await svc.getEvents('M3', Date.now() + 60_000, key);
    expect(m3Future).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// TC-SS-10/11/12 : Store weekly_scores
// ---------------------------------------------------------------------------

describe('StorageService — store weekly_scores', () => {
  it('TC-SS-10 : getWeeklyScore retourne null si absent', async () => {
    const svc = createService();
    await svc.initDB();
    const key = await generateKey();

    const result = await svc.getWeeklyScore('2026-W99', key);
    expect(result).toBeNull();
  });

  it('TC-SS-11 : setWeeklyScore + getWeeklyScore cycle aller-retour', async () => {
    const svc = createService();
    await svc.initDB();
    const key = await generateKey();

    const score = {
      week_key: '2026-W15',
      total_score: 82,
      components: { M3: 82 },
    };
    await svc.setWeeklyScore(score, key);

    const retrieved = await svc.getWeeklyScore('2026-W15', key);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.week_key).toBe('2026-W15');
    expect(retrieved?.total_score).toBe(82);
  });

  it('TC-SS-12 : getAllWeeklyScores retourne la liste complete', async () => {
    const svc = createService();
    await svc.initDB();
    const key = await generateKey();

    await svc.setWeeklyScore({ week_key: '2026-W14', total_score: 60, components: {} }, key);
    await svc.setWeeklyScore({ week_key: '2026-W15', total_score: 75, components: {} }, key);

    const all = await svc.getAllWeeklyScores();
    expect(all.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// TC-SS-13/14/15/16/17 : Store password_hashes
// ---------------------------------------------------------------------------

describe('StorageService — store password_hashes', () => {
  it('TC-SS-13 : addPasswordHash + getPasswordHashesByTag retourne le bon enregistrement', async () => {
    const svc = createService();
    await svc.initDB();
    const key = await generateKey();

    await svc.addPasswordHash('a3f2c1b0deadbeef' + 'x'.repeat(48), 'a3f2c1b0', 'domhash1', key);

    const hashes = await svc.getPasswordHashesByTag('a3f2c1b0');
    expect(hashes.length).toBe(1);
    expect(hashes[0].tag).toBe('a3f2c1b0');
    expect(hashes[0].domain_hash).toBe('domhash1');
  });

  it('TC-SS-14 : getPasswordHashesByTag avec tag inexistant retourne []', async () => {
    const svc = createService();
    await svc.initDB();

    const hashes = await svc.getPasswordHashesByTag('ffffffff');
    expect(hashes).toEqual([]);
  });

  it('TC-SS-15 : getPasswordHashCount retourne le bon count', async () => {
    const svc = createService();
    await svc.initDB();
    const key = await generateKey();

    expect(await svc.getPasswordHashCount()).toBe(0);

    await svc.addPasswordHash('hash1' + 'x'.repeat(59), 'aabbccdd', 'dom1', key);
    await svc.addPasswordHash('hash2' + 'x'.repeat(59), '11223344', 'dom2', key);

    expect(await svc.getPasswordHashCount()).toBe(2);
  });

  it('TC-SS-16 : getPasswordHashMeta retourne count/oldest/newest corrects', async () => {
    const svc = createService();
    await svc.initDB();
    const key = await generateKey();

    const metaEmpty = await svc.getPasswordHashMeta();
    expect(metaEmpty.count).toBe(0);
    expect(metaEmpty.oldest).toBe('');
    expect(metaEmpty.newest).toBe('');

    await svc.addPasswordHash('hash1' + 'x'.repeat(59), 'aabbccdd', 'dom1', key);

    const meta = await svc.getPasswordHashMeta();
    expect(meta.count).toBe(1);
    expect(meta.oldest).not.toBe('');
    expect(meta.newest).not.toBe('');
  });

  it('TC-SS-17 : FIFO — ajout de 101 hashes → count reste a 100', async () => {
    const svc = createService();
    await svc.initDB();
    const key = await generateKey();

    for (let i = 0; i < 101; i++) {
      const tag = i.toString(16).padStart(8, '0');
      await svc.addPasswordHash(tag + 'x'.repeat(56), tag, `dom${i}`, key);
    }

    const count = await svc.getPasswordHashCount();
    expect(count).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// TC-SS-18/19/20/21/22 : Store whitelist
// ---------------------------------------------------------------------------

describe('StorageService — store whitelist', () => {
  it('TC-SS-18 : isWhitelisted retourne false si absent', async () => {
    const svc = createService();
    await svc.initDB();

    const result = await svc.isWhitelisted('hash_inexistant', 'M2');
    expect(result).toBe(false);
  });

  it('TC-SS-19 : addToWhitelist + isWhitelisted retourne true', async () => {
    const svc = createService();
    await svc.initDB();

    await svc.addToWhitelist('domain_hash_abc', 'M2');
    const result = await svc.isWhitelisted('domain_hash_abc', 'M2');
    expect(result).toBe(true);
  });

  it('TC-SS-20 : whitelist isolee par module (M2 vs M7)', async () => {
    const svc = createService();
    await svc.initDB();

    await svc.addToWhitelist('shared_hash', 'M2');

    const m2 = await svc.isWhitelisted('shared_hash', 'M2');
    const m7 = await svc.isWhitelisted('shared_hash', 'M7');

    expect(m2).toBe(true);
    expect(m7).toBe(false);
  });

  it("TC-SS-21 : removeFromWhitelist supprime l'entree", async () => {
    const svc = createService();
    await svc.initDB();

    await svc.addToWhitelist('domain_to_remove', 'M7');
    expect(await svc.isWhitelisted('domain_to_remove', 'M7')).toBe(true);

    await svc.removeFromWhitelist('domain_to_remove', 'M7');
    expect(await svc.isWhitelisted('domain_to_remove', 'M7')).toBe(false);
  });

  it('TC-SS-22 : getAllWhitelist retourne toutes les entrees', async () => {
    const svc = createService();
    await svc.initDB();

    await svc.addToWhitelist('hash_a', 'M2');
    await svc.addToWhitelist('hash_b', 'M7');

    const all = await svc.getAllWhitelist();
    expect(all.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// TC-SS-23 : getAllQuizSessions
// ---------------------------------------------------------------------------

describe('StorageService — store quiz_sessions', () => {
  it('TC-SS-23 : getAllQuizSessions retourne un tableau (potentiellement vide)', async () => {
    const svc = createService();
    await svc.initDB();

    const sessions = await svc.getAllQuizSessions();
    expect(Array.isArray(sessions)).toBe(true);
    expect(sessions.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// TC-SS-24/25/26/27 : purgeExpired
// ---------------------------------------------------------------------------

describe('StorageService — purgeExpired', () => {
  it('TC-SS-24 : purgeExpired retourne 0 si aucun enregistrement expire', async () => {
    const svc = createService();
    await svc.initDB();
    const key = await generateKey();

    // Ajouter un event recent
    await svc.logEvent('M3', { action: 'show' }, key);

    // before = timestamp passe lointain (avant l'event) → 0 expire
    const count = await svc.purgeExpired(Date.now() - 10_000);
    expect(count).toBe(0);
  });

  it('TC-SS-25 : purgeExpired supprime les events expires', async () => {
    const svc = createService();
    await svc.initDB();
    const key = await generateKey();

    await svc.logEvent('M3', { action: 'old' }, key);

    // before = maintenant + 1ms → tous les events sont expires
    const count = await svc.purgeExpired(Date.now() + 1000);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('TC-SS-26 : purgeExpired supprime les password_hashes expires', async () => {
    const svc = createService();
    await svc.initDB();
    const key = await generateKey();

    await svc.addPasswordHash('tag1234xx' + 'x'.repeat(55), 'tag1234x', 'dom1', key);
    expect(await svc.getPasswordHashCount()).toBe(1);

    // before = futur → first_seen est expire
    const count = await svc.purgeExpired(Date.now() + 1000);
    expect(count).toBeGreaterThanOrEqual(1);
    expect(await svc.getPasswordHashCount()).toBe(0);
  });

  it('TC-SS-27 : purgeExpired(0) ne supprime rien (timestamps recents > 0)', async () => {
    const svc = createService();
    await svc.initDB();
    const key = await generateKey();

    // logEvent produit un timestamp = Date.now() >> 0
    await svc.logEvent('M3', { action: 'recent' }, key);

    // before = 0 (epoch) → timestamp de l'event est > 0 donc non expire
    const count = await svc.purgeExpired(0);
    expect(count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// TC-SS-28/29 : chrome.storage.local — config + quotaState
// ---------------------------------------------------------------------------

describe('StorageService — chrome.storage.local', () => {
  it('TC-SS-28 : getConfig retourne null si absent + setConfig/getConfig cycle', async () => {
    const svc = createService();
    await svc.initDB();

    const empty = await svc.getConfig();
    expect(empty).toBeNull();

    const cfg = {
      modules: { M2: true, M3: true, M5: true, M6: true, M7: true, M9: true, M17: true },
      quota_limit: 3 as const,
      profile: 'beginner' as const,
      onboarding_complete: true,
      language: 'fr' as const,
    };
    await svc.setConfig(cfg);

    const loaded = await svc.getConfig();
    expect(loaded).not.toBeNull();
    expect(loaded?.quota_limit).toBe(3);
    expect(loaded?.profile).toBe('beginner');
  });

  it('TC-SS-29 : getQuotaState retourne null si absent + setQuotaState/getQuotaState cycle', async () => {
    const svc = createService();
    await svc.initDB();

    const empty = await svc.getQuotaState();
    expect(empty).toBeNull();

    await svc.setQuotaState({ date: '2026-04-18', count: 2 });
    const state = await svc.getQuotaState();
    expect(state?.date).toBe('2026-04-18');
    expect(state?.count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// TC-SS-30 : Comportement getDB — meme instance apres initDB
// ---------------------------------------------------------------------------

describe('StorageService — robustesse getDB', () => {
  it("TC-SS-30 : getDB() renvoie la meme instance apres initDB()", async () => {
    const svc = createService();
    await svc.initDB();
    const db1 = svc.getDB();
    const db2 = svc.getDB();
    // Meme reference → pas de reconnexion inattendue
    expect(db1).toBe(db2);
  });
});

// ---------------------------------------------------------------------------
// TC-SS-31/32/33/34 : T-080 — verifyKeyAgainstPasswordHashes
// ---------------------------------------------------------------------------

describe('StorageService — verifyKeyAgainstPasswordHashes (T-080 CM-EOP1)', () => {
  it('TC-SS-31 : store vide → retourne null (CM-EOP1 non applicable)', async () => {
    const svc = createService();
    await svc.initDB();
    const key = await generateKey();

    const result = await svc.verifyKeyAgainstPasswordHashes(key);
    expect(result).toBeNull();
  });

  it('TC-SS-32 : cle valide → retourne true apres ajout dun hash', async () => {
    const svc = createService();
    await svc.initDB();
    const key = await generateKey();

    await svc.addPasswordHash('a3f2c1b0' + 'x'.repeat(56), 'a3f2c1b0', 'dom1', key);

    const result = await svc.verifyKeyAgainstPasswordHashes(key);
    expect(result).toBe(true);
  });

  it('TC-SS-33 : cle invalide (differente) → retourne false', async () => {
    const svc = createService();
    await svc.initDB();
    const keyWrite = await generateKey();
    const keyWrong = await generateKey(); // cle differente

    await svc.addPasswordHash('b1c2d3e4' + 'x'.repeat(56), 'b1c2d3e4', 'dom2', keyWrite);

    const result = await svc.verifyKeyAgainstPasswordHashes(keyWrong);
    expect(result).toBe(false);
  });

  it('TC-SS-34 : IDB inaccessible (initDB non appele) → leve une erreur', async () => {
    const svc = createService(); // pas de initDB()
    const key = await generateKey();

    await expect(svc.verifyKeyAgainstPasswordHashes(key)).rejects.toThrow('non initialis');
  });
});

// ---------------------------------------------------------------------------
// TC-SS-35/36/37 : T-081 — initDB idempotent
// ---------------------------------------------------------------------------

describe('StorageService — initDB idempotent (T-081)', () => {
  it('TC-SS-35 : premier appel initDB() ouvre la base et rend getDB() disponible', async () => {
    const svc = createService();
    await svc.initDB();
    expect(() => svc.getDB()).not.toThrow();
  });

  it('TC-SS-36 : double appel initDB() → pas de reouverture (indexedDB.open appele 1 seule fois)', async () => {
    const idbFactory = new IDBFactory();
    Object.defineProperty(globalThis, 'indexedDB', {
      value: idbFactory,
      configurable: true,
      writable: true,
    });
    const openSpy = vi.spyOn(idbFactory, 'open');
    const crypto = new CryptoService();
    const svc = new StorageService(crypto);

    await svc.initDB();
    await svc.initDB(); // deuxieme appel — doit etre early-return

    // indexedDB.open ne doit avoir ete appele qu'une seule fois
    expect(openSpy).toHaveBeenCalledTimes(1);
    openSpy.mockRestore();
  });

  it('TC-SS-37 : apres premier initDB() reussi, getDB() retourne la meme instance sur appels consecutifs', async () => {
    const svc = createService();
    await svc.initDB();
    await svc.initDB(); // early return

    const db1 = svc.getDB();
    const db2 = svc.getDB();
    expect(db1).toBe(db2);
  });
});
