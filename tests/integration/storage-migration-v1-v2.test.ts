/**
 * @file tests/integration/storage-migration-v1-v2.test.ts
 * @description TC-M7-24 — Tests migration IndexedDB v1→v2 (ajout store m7_incidents).
 *
 * TACHE-077 — fake-indexeddb + migration v1→v2.
 *
 * Scénarios couverts :
 * - TC-MIG-01 : migration nominale depuis v1 → schéma v2 complet (6 stores)
 * - TC-MIG-02 : données v1 pré-existantes préservées après migration (events + whitelist)
 * - TC-MIG-03 : index m7_incidents.ts et m7_incidents.type créés
 * - TC-MIG-04 : migration depuis v0 (premier install) → même résultat que v2 directe
 * - TC-MIG-05 : store m7_incidents opérationnel après migration (insert + getLast)
 * - TC-MIG-06 : IDBFactory fraiche — idempotence (deux initDB() consécutifs)
 * - TC-MIG-07 : MIGRATIONS[1] appliqué seul → 5 stores (schéma v1)
 * - TC-MIG-08 : MIGRATIONS[2] appliqué en upgrade sur schéma v1 → m7_incidents ajouté
 *
 * Contraintes :
 * - fake-indexeddb expose `IDBFactory` avec support complet onupgradeneeded
 * - Chaque test utilise une IDBFactory isolée pour éviter les collisions
 * - Les migrations sont testées via les exports MIGRATIONS du storage-service
 *
 * Référence : TACHE-061 (migration v2), TACHE-077, DAT §8.4 (migrations IDB)
 */

import { describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { StorageService, DB_VERSION, MIGRATIONS } from '@/background/storage-service';
import { CryptoService } from '@/background/crypto-service';
import { IncidentService } from '@/background/services/incident-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DB_NAME = 'sentinel-nudge-db';

/** Crée une IDBFactory isolée et la patche dans globalThis */
function createIsolatedFactory(): IDBFactory {
  const factory = new IDBFactory();
  Object.defineProperty(globalThis, 'indexedDB', {
    value: factory,
    configurable: true,
    writable: true,
  });
  return factory;
}

/** Crée un StorageService sur l'IDBFactory courante */
function createStorageService(): StorageService {
  return new StorageService(new CryptoService());
}

/** Génère une CryptoKey AES-256-GCM */
async function generateKey(): Promise<CryptoKey> {
  return globalThis.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Ouvre une base IDB en version 1 directement (sans StorageService) pour simuler
 * un état pré-existant v1. Retourne la IDBDatabase ouverte.
 *
 * Applique uniquement MIGRATIONS[1] dans onupgradeneeded.
 */
function openV1Database(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, 1);
    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      MIGRATIONS[1](db);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Insère directement un événement dans un store IDB v1 ouvert.
 * Utilisé pour créer des données pré-migration.
 */
function insertRawEvent(
  db: IDBDatabase,
  record: { timestamp: number; module: string; value: ArrayBuffer; iv: Uint8Array },
): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('events', 'readwrite');
    const store = tx.objectStore('events');
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Insère directement une entrée whitelist dans un store IDB v1 ouvert.
 */
function insertRawWhitelist(
  db: IDBDatabase,
  entry: { domain_hash: string; module: string; added_at: number },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('whitelist', 'readwrite');
    const store = tx.objectStore('whitelist');
    const req = store.put(entry);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Compte les enregistrements dans un store d'une IDB ouverte.
 */
function countStore(db: IDBDatabase, storeName: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------------
// Tests migration v1 → v2
// ---------------------------------------------------------------------------

describe('Migration IndexedDB v1→v2 (TACHE-077 / TC-M7-24)', () => {
  // TC-MIG-01 : migration nominale depuis premier install → 6 stores
  it('TC-MIG-01 : initDB() depuis v0 (premier install) crée les 6 stores du schéma v2', async () => {
    createIsolatedFactory();
    const svc = createStorageService();
    await svc.initDB();
    const db = svc.getDB();

    const stores = Array.from(db.objectStoreNames);
    expect(stores).toHaveLength(6);
    expect(stores).toContain('events');
    expect(stores).toContain('password_hashes');
    expect(stores).toContain('quiz_sessions');
    expect(stores).toContain('weekly_scores');
    expect(stores).toContain('whitelist');
    expect(stores).toContain('m7_incidents');
  });

  // TC-MIG-02 : données v1 pré-existantes préservées après migration v1→v2
  it('TC-MIG-02 : données pré-existantes en v1 préservées après migration vers v2', async () => {
    const factory = createIsolatedFactory();

    // Phase 1 : ouvrir la base en v1 et insérer des données
    const v1db = await openV1Database(factory);

    const fakeIv = new Uint8Array(12).fill(1);
    const fakeValue = new ArrayBuffer(32);

    await insertRawEvent(v1db, {
      timestamp: Date.now() - 1000,
      module: 'M3',
      value: fakeValue,
      iv: fakeIv,
    });
    await insertRawEvent(v1db, {
      timestamp: Date.now() - 2000,
      module: 'M6',
      value: fakeValue,
      iv: fakeIv,
    });

    await insertRawWhitelist(v1db, {
      domain_hash: 'aabbccdd1234567890abcdef12345678',
      module: 'M2',
      added_at: Date.now(),
    });

    // Fermer la connexion v1
    v1db.close();

    // Phase 2 : ouvrir StorageService en v2 → migration appliquée
    const svc = createStorageService();
    await svc.initDB();
    const v2db = svc.getDB();

    // Vérifier que les données v1 sont préservées
    const eventCount = await countStore(v2db, 'events');
    expect(eventCount).toBe(2);

    const wlCount = await countStore(v2db, 'whitelist');
    expect(wlCount).toBe(1);
  });

  // TC-MIG-03 : store m7_incidents possède les index ts et type
  it('TC-MIG-03 : store m7_incidents possède les index ts et type après migration', async () => {
    createIsolatedFactory();
    const svc = createStorageService();
    await svc.initDB();
    const db = svc.getDB();

    const tx = db.transaction('m7_incidents', 'readonly');
    const store = tx.objectStore('m7_incidents');
    const indexNames = Array.from(store.indexNames);

    expect(indexNames).toContain('ts');
    expect(indexNames).toContain('type');
  });

  // TC-MIG-04 : migration v1→v2 sans données pré-existantes — store m7_incidents vide mais opérationnel
  it('TC-MIG-04 : migration v1→v2 sans données préalables — m7_incidents vide et opérationnel', async () => {
    const factory = createIsolatedFactory();

    // Ouvrir en v1 (vide)
    const v1db = await openV1Database(factory);
    v1db.close();

    // Migrer vers v2
    const svc = createStorageService();
    await svc.initDB();
    const v2db = svc.getDB();

    // m7_incidents vide mais accessible
    const count = await countStore(v2db, 'm7_incidents');
    expect(count).toBe(0);
  });

  // TC-MIG-05 : store m7_incidents opérationnel après migration (insert + getLast via IncidentService)
  it('TC-MIG-05 : m7_incidents opérationnel après migration — insert + getLast via IncidentService', async () => {
    const factory = createIsolatedFactory();

    // Pré-état v1 avec données
    const v1db = await openV1Database(factory);
    const fakeIv = new Uint8Array(12).fill(2);
    const fakeValue = new ArrayBuffer(16);
    await insertRawEvent(v1db, { timestamp: Date.now(), module: 'M7', value: fakeValue, iv: fakeIv });
    v1db.close();

    // Migration v1→v2
    const svc = createStorageService();
    await svc.initDB();

    // Utiliser IncidentService sur la base migrée
    const incidentSvc = new IncidentService();
    await incidentSvc.initService(svc.getDB());

    await incidentSvc.log('boot_fail', 'error', { hint: 'post_migration_test' });
    await incidentSvc.log('canary_failed', 'warn', { hint: 'post_migration_warn' });

    const last = await incidentSvc.getLast(5);
    expect(last).toHaveLength(2);

    const count = await incidentSvc.count();
    expect(count).toBe(2);

    // Les données v1 (events) sont toujours présentes
    const v2db = svc.getDB();
    const eventCount = await countStore(v2db, 'events');
    expect(eventCount).toBe(1);
  });

  // TC-MIG-06 : idempotence — deux initDB() consécutifs ne doublent pas les stores
  it('TC-MIG-06 : deux initDB() consécutifs sur la même IDBFactory ne dupliquent pas les stores', async () => {
    createIsolatedFactory();
    const svc = createStorageService();
    await svc.initDB();
    await svc.initDB(); // second appel sur la même instance

    const db = svc.getDB();
    const stores = Array.from(db.objectStoreNames);
    expect(stores).toHaveLength(6);
  });

  // TC-MIG-07 : MIGRATIONS[1] appliqué seul crée les 5 stores v1
  it('TC-MIG-07 : MIGRATIONS[1] crée les 5 stores du schéma v1 (sans m7_incidents)', () => {
    createIsolatedFactory();
    // Ouvrir une base temporaire en mémoire et appliquer MIGRATIONS[1]
    return new Promise<void>((resolve, reject) => {
      const req = globalThis.indexedDB.open('sentinel-nudge-db-v1-test', 1);
      req.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        MIGRATIONS[1](db);
      };
      req.onsuccess = () => {
        const db = req.result;
        const stores = Array.from(db.objectStoreNames);
        try {
          expect(stores).toContain('events');
          expect(stores).toContain('password_hashes');
          expect(stores).toContain('quiz_sessions');
          expect(stores).toContain('weekly_scores');
          expect(stores).toContain('whitelist');
          expect(stores).not.toContain('m7_incidents');
          expect(stores).toHaveLength(5);
          db.close();
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      req.onerror = () => reject(req.error);
    });
  });

  // TC-MIG-08 : migration v1→v2 en upgrade ajoute uniquement m7_incidents
  it('TC-MIG-08 : migration v1→v2 ajoute le store m7_incidents et préserve les 5 stores v1', async () => {
    const factory = createIsolatedFactory();

    // Phase 1 : ouvrir en v1
    const v1db = await openV1Database(factory);
    const storesV1 = Array.from(v1db.objectStoreNames);
    expect(storesV1).toHaveLength(5);
    expect(storesV1).not.toContain('m7_incidents');
    v1db.close();

    // Phase 2 : migrer vers v2 via StorageService
    const svc = createStorageService();
    await svc.initDB();
    const v2db = svc.getDB();

    const storesV2 = Array.from(v2db.objectStoreNames);
    expect(storesV2).toHaveLength(6);
    expect(storesV2).toContain('m7_incidents');
    // Les 5 stores v1 sont toujours présents
    storesV1.forEach((name) => expect(storesV2).toContain(name));
  });
});

// ---------------------------------------------------------------------------
// TC-MIG-DEG-01/02 : Cas dégradés migration
// ---------------------------------------------------------------------------

describe('Migration IDB v1→v2 — cas dégradés', () => {
  // TC-MIG-DEG-01 : données corrompues dans events (ArrayBuffer invalide) → migration réussit quand même
  it('TC-MIG-DEG-01 : données corrompues dans le store events n\'empêchent pas la migration vers v2', async () => {
    const factory = createIsolatedFactory();

    // Insérer un enregistrement avec value = null (corrompu) dans v1
    const v1db = await openV1Database(factory);

    await new Promise<void>((resolve, reject) => {
      const tx = v1db.transaction('events', 'readwrite');
      const store = tx.objectStore('events');
      // Enregistrement corrompu : value=null au lieu d'ArrayBuffer
      const req = store.add({
        timestamp: Date.now(),
        module: 'CORRUPTED',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        value: null as any,
        iv: new Uint8Array(12),
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    v1db.close();

    // La migration doit réussir malgré les données corrompues
    const svc = createStorageService();
    await expect(svc.initDB()).resolves.toBeUndefined();

    const db = svc.getDB();
    const stores = Array.from(db.objectStoreNames);
    expect(stores).toContain('m7_incidents');
    expect(stores).toHaveLength(6);
  });

  // TC-MIG-DEG-02 : DB_VERSION constant (invariant de non-régression)
  it('TC-MIG-DEG-02 : DB_VERSION est bien 2 (invariant de non-régression)', () => {
    // Si DB_VERSION change sans mise à jour des tests, ce test échoue → alerte intentionnelle
    expect(DB_VERSION).toBe(2);
  });
});
