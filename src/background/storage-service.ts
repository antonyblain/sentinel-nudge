/**
 * @file background/storage-service.ts
 * @description Service d'abstraction IndexedDB et chrome.storage.local pour Sentinel Nudge.
 *
 * Gère :
 * - L'ouverture et la migration de la base IndexedDB `sentinel-nudge-db`
 * - L'écriture et la lecture des 5 stores avec chiffrement AES-256-GCM
 * - La purge des données expirées (90j pour events/password_hashes, 52 sem. pour quiz/scores)
 * - La lecture/écriture de la configuration et de l'état quota dans chrome.storage.local
 *
 * Référence : DAT §8.1 (schéma IndexedDB), §8.3 (politique purge), §8.4 (migrations)
 */

import { browser } from '@/shared/browser/browser-adapter';
import { CryptoService } from './crypto-service';
import type { EventRecord, EventPayload, WeeklyScore, ChromeStorageSchema } from '@/shared/types/storage';

/** Nom de la base de données IndexedDB */
const DB_NAME = 'sentinel-nudge-db';
/** Version courante du schéma IndexedDB */
const DB_VERSION = 1;

/**
 * Tableau de migrations IndexedDB indexé par numéro de version.
 *
 * Chaque entrée est une fonction qui reçoit l'objet IDBDatabase et applique
 * les modifications de schéma nécessaires pour cette version.
 * Les migrations sont irréversibles (pas de `down` — la migration descendante
 * requiert une désinstallation/réinstallation de l'extension).
 *
 * Référence : DAT §8.4 (Migration de schéma)
 */
const MIGRATIONS: Record<number, (db: IDBDatabase) => void> = {
  /**
   * Migration v1 : création des 5 stores initiaux.
   * - events : événements de nudge (90 jours)
   * - password_hashes : hashes mots de passe M7 (90 jours + FIFO 100)
   * - quiz_sessions : sessions quiz M6 (52 semaines)
   * - weekly_scores : scores hebdomadaires M3 (52 semaines)
   * - whitelist : domaines de confiance M2 (permanent)
   */
  1: (db: IDBDatabase) => {
    // Store events
    const eventsStore = db.createObjectStore('events', {
      keyPath: 'id',
      autoIncrement: true,
    });
    eventsStore.createIndex('timestamp', 'timestamp');
    eventsStore.createIndex('module', 'module');

    // Store password_hashes (avec index de pré-filtration tag — NC-DPO-01)
    const pwdStore = db.createObjectStore('password_hashes', {
      keyPath: 'id',
      autoIncrement: true,
    });
    pwdStore.createIndex('tag', 'tag'); // 4 premiers bytes en clair pour pré-filtration
    pwdStore.createIndex('domain_hash', 'domain_hash');
    pwdStore.createIndex('first_seen', 'first_seen');

    // Store quiz_sessions
    const quizStore = db.createObjectStore('quiz_sessions', {
      keyPath: 'id',
      autoIncrement: true,
    });
    quizStore.createIndex('module', 'module');
    quizStore.createIndex('quiz_date', 'quiz_date');

    // Store weekly_scores (clé primaire = semaine ISO YYYY-Www)
    db.createObjectStore('weekly_scores', { keyPath: 'week_key' });

    // Store whitelist (clé primaire = domain_hash SHA-256)
    db.createObjectStore('whitelist', { keyPath: 'domain_hash' });
  },
};

/**
 * Service de gestion du stockage persistant de Sentinel Nudge.
 *
 * Le Service Worker instancie ce service à chaque réveil.
 * initDB() doit être appelé avant toute opération de lecture/écriture.
 */
export class StorageService {
  private db: IDBDatabase | null = null;
  private readonly crypto: CryptoService;

  constructor(crypto: CryptoService) {
    this.crypto = crypto;
  }

  /**
   * Ouvre ou crée la base IndexedDB et applique les migrations nécessaires.
   *
   * @returns Résolution quand la base est prête
   * @throws Error si l'ouverture ou la migration échoue
   */
  async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error(`[StorageService] Échec ouverture IndexedDB: ${request.error?.message ?? 'Erreur inconnue'}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;
        const newVersion = event.newVersion ?? DB_VERSION;

        // Applique toutes les migrations depuis l'ancienne version
        for (let v = oldVersion + 1; v <= newVersion; v++) {
          const migration = MIGRATIONS[v];
          if (migration) {
            migration(db);
          }
        }
      };
    });
  }

  /**
   * Retourne la référence à la base IndexedDB ouverte.
   * @throws Error si initDB() n'a pas été appelé
   */
  private getDB(): IDBDatabase {
    if (!this.db) {
      throw new Error('[StorageService] Base IndexedDB non initialisée. Appeler initDB() d\'abord.');
    }
    return this.db;
  }

  // ---------------------------------------------------------------------------
  // Configuration chrome.storage.local
  // ---------------------------------------------------------------------------

  /**
   * Lit la configuration utilisateur depuis chrome.storage.local.
   *
   * @returns Configuration utilisateur ou null si non initialisée (premier lancement)
   */
  async getConfig(): Promise<ChromeStorageSchema['config'] | null> {
    const result = await browser.storage.local.get(['config']);
    const config = result['config'];
    if (!config) return null;
    return config as ChromeStorageSchema['config'];
  }

  /**
   * Écrit la configuration utilisateur dans chrome.storage.local.
   *
   * @param config - Configuration à persister
   */
  async setConfig(config: ChromeStorageSchema['config']): Promise<void> {
    await browser.storage.local.set({ config });
  }

  /**
   * Lit l'état du quota journalier depuis chrome.storage.local.
   *
   * @returns État quota ou null si non initialisé
   */
  async getQuotaState(): Promise<ChromeStorageSchema['quota_state'] | null> {
    const result = await browser.storage.local.get(['quota_state']);
    const state = result['quota_state'];
    if (!state) return null;
    return state as ChromeStorageSchema['quota_state'];
  }

  /**
   * Écrit l'état du quota journalier dans chrome.storage.local.
   *
   * @param state - Nouvel état quota à persister
   */
  async setQuotaState(state: ChromeStorageSchema['quota_state']): Promise<void> {
    await browser.storage.local.set({ quota_state: state });
  }

  // ---------------------------------------------------------------------------
  // Store events (IndexedDB)
  // ---------------------------------------------------------------------------

  /**
   * Enregistre un événement de nudge dans IndexedDB (chiffré AES-256-GCM).
   *
   * @param module    - Module source (ex: 'M2')
   * @param payload   - Données de l'événement à chiffrer
   * @param cryptoKey - Clé AES-256-GCM active
   * @returns ID de l'enregistrement créé
   */
  async logEvent(
    module: string,
    payload: EventPayload,
    cryptoKey: CryptoKey,
  ): Promise<number> {
    const { ciphertext, iv } = await this.crypto.encrypt(cryptoKey, payload);

    const record: Omit<EventRecord, 'id'> = {
      timestamp: Date.now(),
      module,
      value: ciphertext,
      iv,
    };

    return new Promise((resolve, reject) => {
      const db = this.getDB();
      const tx = db.transaction('events', 'readwrite');
      const store = tx.objectStore('events');
      const request = store.add(record);

      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () =>
        reject(new Error(`[StorageService] Échec logEvent: ${request.error?.message ?? ''}`));
    });
  }

  /**
   * Lit les événements d'un module sur une période donnée.
   *
   * @param module    - Module cible (ou null pour tous les modules)
   * @param since     - Timestamp de début (Date.now() - durée)
   * @param cryptoKey - Clé AES-256-GCM pour le déchiffrement
   * @returns Liste des payloads déchiffrés
   */
  async getEvents(
    module: string | null,
    since: number,
    cryptoKey: CryptoKey,
  ): Promise<EventPayload[]> {
    const db = this.getDB();
    const tx = db.transaction('events', 'readonly');
    const store = tx.objectStore('events');
    const index = store.index('timestamp');
    const range = IDBKeyRange.lowerBound(since);

    return new Promise((resolve, reject) => {
      const results: EventPayload[] = [];
      const request = index.openCursor(range);

      request.onsuccess = async () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(results);
          return;
        }

        const record = cursor.value as EventRecord;
        if (module === null || record.module === module) {
          try {
            const payload = (await this.crypto.decrypt(cryptoKey, record.value, record.iv)) as EventPayload;
            results.push(payload);
          } catch {
            // Enregistrement corrompu — on l'ignore sans bloquer la lecture
          }
        }
        cursor.continue();
      };

      request.onerror = () =>
        reject(new Error(`[StorageService] Échec getEvents: ${request.error?.message ?? ''}`));
    });
  }

  /**
   * Supprime les événements dont le timestamp est antérieur à `before`.
   * Déclenché par l'alarme de purge quotidienne (02h00).
   *
   * @param before - Timestamp limite (supprimer les records dont timestamp < before)
   * @returns Nombre d'enregistrements supprimés
   */
  async purgeExpired(before: number): Promise<number> {
    const db = this.getDB();
    const tx = db.transaction('events', 'readwrite');
    const store = tx.objectStore('events');
    const index = store.index('timestamp');
    const range = IDBKeyRange.upperBound(before, true);

    return new Promise((resolve, reject) => {
      let count = 0;
      const request = index.openCursor(range);

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(count);
          return;
        }
        cursor.delete();
        count++;
        cursor.continue();
      };

      request.onerror = () =>
        reject(new Error(`[StorageService] Échec purgeExpired: ${request.error?.message ?? ''}`));
    });
  }

  /**
   * Lit le score hebdomadaire pour une semaine donnée.
   *
   * @param weekKey   - Clé de semaine ISO (ex: "2026-W15")
   * @param cryptoKey - Clé AES-256-GCM pour le déchiffrement
   * @returns Score hebdomadaire ou null si inexistant
   */
  async getWeeklyScore(weekKey: string, cryptoKey: CryptoKey): Promise<WeeklyScore | null> {
    const db = this.getDB();
    const tx = db.transaction('weekly_scores', 'readonly');
    const store = tx.objectStore('weekly_scores');

    return new Promise((resolve, reject) => {
      const request = store.get(weekKey);

      request.onsuccess = async () => {
        const record = request.result as WeeklyScore | undefined;
        if (!record) {
          resolve(null);
          return;
        }
        try {
          const decrypted = (await this.crypto.decrypt(cryptoKey, record.value, record.iv)) as Omit<WeeklyScore, 'value' | 'iv'>;
          resolve({ ...decrypted, value: record.value, iv: record.iv });
        } catch {
          resolve(null);
        }
      };

      request.onerror = () =>
        reject(new Error(`[StorageService] Échec getWeeklyScore: ${request.error?.message ?? ''}`));
    });
  }

  /**
   * Écrit ou met à jour le score hebdomadaire d'une semaine donnée.
   *
   * @param score     - Objet WeeklyScore à persister
   * @param cryptoKey - Clé AES-256-GCM pour le chiffrement
   */
  async setWeeklyScore(score: Omit<WeeklyScore, 'value' | 'iv'>, cryptoKey: CryptoKey): Promise<void> {
    const { ciphertext, iv } = await this.crypto.encrypt(cryptoKey, score);
    const record: WeeklyScore = { ...score, value: ciphertext, iv };

    const db = this.getDB();
    const tx = db.transaction('weekly_scores', 'readwrite');
    const store = tx.objectStore('weekly_scores');

    return new Promise((resolve, reject) => {
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(`[StorageService] Échec setWeeklyScore: ${request.error?.message ?? ''}`));
    });
  }
}
