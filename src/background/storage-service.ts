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
import type {
  EventRecord,
  EventPayload,
  WeeklyScore,
  ChromeStorageSchema,
  PasswordHashRecord,
  WhitelistEntry,
} from '@/shared/types/storage';

/** Nom de la base de données IndexedDB */
const DB_NAME = 'sentinel-nudge-db';
/** Version courante du schéma IndexedDB */
const DB_VERSION = 1;

/** Nombre maximum de hashes de mots de passe stockés (FIFO) */
const MAX_PASSWORD_HASHES = 100;

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

    // Store whitelist (clé primaire = domain_hash SHA-256 + module)
    const wlStore = db.createObjectStore('whitelist', { keyPath: ['domain_hash', 'module'] });
    wlStore.createIndex('module', 'module');
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
        reject(
          new Error(
            `[StorageService] Échec ouverture IndexedDB: ${request.error?.message ?? 'Erreur inconnue'}`,
          ),
        );
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
      throw new Error("[StorageService] Base IndexedDB non initialisée. Appeler initDB() d'abord.");
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
  async logEvent(module: string, payload: EventPayload, cryptoKey: CryptoKey): Promise<number> {
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
            const payload = (await this.crypto.decrypt(
              cryptoKey,
              record.value,
              record.iv,
            )) as EventPayload;
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
   * Supprime les enregistrements expirés dans tous les stores concernés.
   * Déclenché par l'alarme de purge quotidienne (02h00).
   *
   * Politique de rétention (DAT §8.3, Mi-005) :
   * - events          : timestamp < before (90 jours passés en paramètre)
   * - password_hashes : first_seen < before (90 jours) — la règle FIFO max 100 est gérée à l'insertion
   * - quiz_sessions   : quiz_date < now - 52 semaines (364 jours)
   * - weekly_scores   : week_key < semaine courante - 52
   *
   * @param before - Timestamp limite pour events et password_hashes (Date.now() - 90j)
   * @returns Nombre total d'enregistrements supprimés toutes stores confondues
   */
  async purgeExpired(before: number): Promise<number> {
    const db = this.getDB();
    let totalCount = 0;

    // --- 1. Purge events (timestamp < before) ---
    totalCount += await new Promise<number>((resolve, reject) => {
      const tx = db.transaction('events', 'readwrite');
      const store = tx.objectStore('events');
      const index = store.index('timestamp');
      const range = IDBKeyRange.upperBound(before, true);
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
        reject(
          new Error(`[StorageService] Échec purgeExpired events: ${request.error?.message ?? ''}`),
        );
    });

    // --- 2. Purge password_hashes (first_seen < before — 90 jours) ---
    totalCount += await new Promise<number>((resolve, reject) => {
      const tx = db.transaction('password_hashes', 'readwrite');
      const store = tx.objectStore('password_hashes');
      const index = store.index('first_seen');
      const range = IDBKeyRange.upperBound(before, true);
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
        reject(
          new Error(
            `[StorageService] Échec purgeExpired password_hashes: ${request.error?.message ?? ''}`,
          ),
        );
    });

    // --- 3. Purge quiz_sessions (quiz_date < now - 52 semaines = 364 jours) ---
    const quizCutoff = new Date(Date.now() - 364 * 24 * 60 * 60 * 1000).toISOString();
    totalCount += await new Promise<number>((resolve, reject) => {
      const tx = db.transaction('quiz_sessions', 'readwrite');
      const store = tx.objectStore('quiz_sessions');
      const index = store.index('quiz_date');
      // Les dates ISO 8601 sont comparables lexicographiquement
      const range = IDBKeyRange.upperBound(quizCutoff, true);
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
        reject(
          new Error(
            `[StorageService] Échec purgeExpired quiz_sessions: ${request.error?.message ?? ''}`,
          ),
        );
    });

    // --- 4. Purge weekly_scores (week_key < semaine courante - 52) ---
    const scoreCutoffKey = this.getWeekKeyOffset(-52);
    totalCount += await new Promise<number>((resolve, reject) => {
      const tx = db.transaction('weekly_scores', 'readwrite');
      const store = tx.objectStore('weekly_scores');
      // week_key est la clé primaire (string YYYY-Www), comparable lexicographiquement
      const range = IDBKeyRange.upperBound(scoreCutoffKey, true);
      let count = 0;
      const request = store.openCursor(range);
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
        reject(
          new Error(
            `[StorageService] Échec purgeExpired weekly_scores: ${request.error?.message ?? ''}`,
          ),
        );
    });

    return totalCount;
  }

  /**
   * Calcule la clé de semaine ISO (YYYY-Www) pour la semaine courante décalée de `offset` semaines.
   *
   * @param offset - Nombre de semaines de décalage (négatif = dans le passé)
   * @returns Clé de semaine au format YYYY-Www
   */
  private getWeekKeyOffset(offset: number): string {
    const date = new Date(Date.now() + offset * 7 * 24 * 60 * 60 * 1000);
    // Calcul du numéro de semaine ISO 8601
    const jan1 = new Date(date.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((date.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000));
    const weekNum = Math.ceil((dayOfYear + jan1.getDay() + 1) / 7);
    return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
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
          const decrypted = (await this.crypto.decrypt(cryptoKey, record.value, record.iv)) as Omit<
            WeeklyScore,
            'value' | 'iv'
          >;
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
  async setWeeklyScore(
    score: Omit<WeeklyScore, 'value' | 'iv'>,
    cryptoKey: CryptoKey,
  ): Promise<void> {
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

  // ---------------------------------------------------------------------------
  // Store password_hashes (IndexedDB) — Module M7
  // ---------------------------------------------------------------------------

  /**
   * Ajoute un hash de mot de passe dans le store password_hashes.
   * Applique la règle FIFO : si le store dépasse MAX_PASSWORD_HASHES,
   * le plus ancien enregistrement (first_seen minimal) est supprimé.
   *
   * La valeur du hash est chiffrée AES-256-GCM avant stockage (D-SEC-001).
   * Le tag (8 chars hex) reste en clair pour la pré-filtration par index.
   *
   * @param hash       - Hash hexadécimal SHA-256 du mot de passe (64 chars)
   * @param tag        - 8 premiers chars hex du hash (index de pré-filtration)
   * @param domainHash - SHA-256(salt + domain) du domaine source
   * @param cryptoKey  - Clé AES-256-GCM pour le chiffrement
   */
  async addPasswordHash(
    hash: string,
    tag: string,
    domainHash: string,
    cryptoKey: CryptoKey,
  ): Promise<void> {
    // Chiffrement du hash complet
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encoder.encode(hash),
    );

    const db = this.getDB();

    // Vérification et application FIFO dans une transaction readwrite
    return new Promise((resolve, reject) => {
      const tx = db.transaction('password_hashes', 'readwrite');
      const store = tx.objectStore('password_hashes');

      // Compter les enregistrements existants
      const countReq = store.count();

      countReq.onsuccess = () => {
        const count = countReq.result;

        const addRecord = (): void => {
          const record: Omit<PasswordHashRecord, 'id'> = {
            tag,
            value: ciphertext,
            iv,
            domain_hash: domainHash,
            first_seen: Date.now(),
            count: 1,
          };
          const addReq = store.add(record);
          addReq.onsuccess = () => resolve();
          addReq.onerror = () =>
            reject(
              new Error(`[StorageService] Échec addPasswordHash: ${addReq.error?.message ?? ''}`),
            );
        };

        if (count >= MAX_PASSWORD_HASHES) {
          // Supprimer le plus ancien (index first_seen, premier enregistrement)
          const idx = store.index('first_seen');
          const cursorReq = idx.openCursor();
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (cursor) {
              cursor.delete();
              addRecord();
            } else {
              addRecord();
            }
          };
          cursorReq.onerror = () => addRecord(); // Si erreur, on ajoute quand même
        } else {
          addRecord();
        }
      };

      countReq.onerror = () =>
        reject(
          new Error(
            `[StorageService] Échec count password_hashes: ${countReq.error?.message ?? ''}`,
          ),
        );

      tx.onerror = () =>
        reject(
          new Error(
            `[StorageService] Échec transaction password_hashes: ${tx.error?.message ?? ''}`,
          ),
        );
    });
  }

  /**
   * Récupère les hashes de mots de passe correspondant à un tag donné.
   * Utilisé pour la pré-filtration avant comparaison exacte (SFD §2.5.3).
   *
   * @param tag - 8 premiers chars hex du hash (index de pré-filtration)
   * @returns Liste des enregistrements password_hashes avec ce tag
   */
  async getPasswordHashesByTag(tag: string): Promise<PasswordHashRecord[]> {
    const db = this.getDB();
    const tx = db.transaction('password_hashes', 'readonly');
    const store = tx.objectStore('password_hashes');
    const index = store.index('tag');

    return new Promise((resolve, reject) => {
      const results: PasswordHashRecord[] = [];
      const request = index.openCursor(IDBKeyRange.only(tag));

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(results);
          return;
        }
        results.push(cursor.value as PasswordHashRecord);
        cursor.continue();
      };

      request.onerror = () =>
        reject(
          new Error(
            `[StorageService] Échec getPasswordHashesByTag: ${request.error?.message ?? ''}`,
          ),
        );
    });
  }

  /**
   * Retourne le nombre total de hashes de mots de passe stockés.
   *
   * @returns Nombre d'enregistrements dans password_hashes
   */
  async getPasswordHashCount(): Promise<number> {
    const db = this.getDB();
    const tx = db.transaction('password_hashes', 'readonly');
    const store = tx.objectStore('password_hashes');

    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(
          new Error(`[StorageService] Échec getPasswordHashCount: ${request.error?.message ?? ''}`),
        );
    });
  }

  /**
   * Retourne les métadonnées agrégées du store password_hashes pour l'export RGPD Art. 20.
   *
   * Seules les métadonnées sont retournées — jamais les hashes ni les valeurs chiffrées
   * (exigence NC-DPO-01 : les hashes de mots de passe ne sont pas exportables en clair).
   *
   * Les timestamps `oldest` et `newest` sont lus depuis l'index `first_seen`
   * (valeur en clair, non réversible en mot de passe).
   *
   * @returns Objet { count, oldest, newest } où oldest/newest sont des ISO 8601 ou '' si vide
   */
  async getPasswordHashMeta(): Promise<{ count: number; oldest: string; newest: string }> {
    const db = this.getDB();
    const tx = db.transaction('password_hashes', 'readonly');
    const store = tx.objectStore('password_hashes');
    const index = store.index('first_seen');

    return new Promise((resolve, reject) => {
      const countReq = store.count();
      let count = 0;

      countReq.onsuccess = () => {
        count = countReq.result;
        if (count === 0) {
          resolve({ count: 0, oldest: '', newest: '' });
          return;
        }

        // Curseur ascendant pour trouver le plus ancien (first_seen minimal)
        const oldestReq = index.openCursor(null, 'next');
        oldestReq.onsuccess = () => {
          const oldestCursor = oldestReq.result;
          const oldestTs =
            oldestCursor != null
              ? new Date((oldestCursor.value as PasswordHashRecord).first_seen).toISOString()
              : '';

          // Curseur descendant pour trouver le plus récent (first_seen maximal)
          const newestReq = index.openCursor(null, 'prev');
          newestReq.onsuccess = () => {
            const newestCursor = newestReq.result;
            const newestTs =
              newestCursor != null
                ? new Date((newestCursor.value as PasswordHashRecord).first_seen).toISOString()
                : '';

            resolve({ count, oldest: oldestTs, newest: newestTs });
          };
          newestReq.onerror = () => resolve({ count, oldest: oldestTs, newest: '' });
        };
        oldestReq.onerror = () => resolve({ count, oldest: '', newest: '' });
      };

      countReq.onerror = () =>
        reject(
          new Error(`[StorageService] Échec getPasswordHashMeta: ${countReq.error?.message ?? ''}`),
        );
    });
  }

  /**
   * Récupère tous les scores hebdomadaires pour l'export RGPD Art. 20.
   *
   * Retourne les enregistrements bruts (chiffrés) — la valeur chiffrée `value`
   * sera sérialisée en JSON via le mécanisme natif de structuredClone.
   * Les champs en clair (week_key, total_score, components) sont lisibles directement.
   *
   * @returns Liste des WeeklyScore (champs en clair + value/iv chiffrés)
   */
  async getAllWeeklyScores(): Promise<object[]> {
    const db = this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('weekly_scores', 'readonly');
      const store = tx.objectStore('weekly_scores');
      const request = store.getAll();
      request.onsuccess = (): void => resolve(request.result as object[]);
      request.onerror = (): void => reject(new Error('[StorageService] Échec getAllWeeklyScores'));
    });
  }

  /**
   * Récupère toutes les sessions quiz pour l'export RGPD Art. 20.
   *
   * Retourne les enregistrements bruts du store quiz_sessions.
   * Les champs en clair (id, module, quiz_date) sont lisibles directement.
   *
   * @returns Liste des enregistrements quiz_sessions
   */
  async getAllQuizSessions(): Promise<object[]> {
    const db = this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('quiz_sessions', 'readonly');
      const store = tx.objectStore('quiz_sessions');
      const request = store.getAll();
      request.onsuccess = (): void => resolve(request.result as object[]);
      request.onerror = (): void => reject(new Error('[StorageService] Échec getAllQuizSessions'));
    });
  }

  /**
   * Récupère toutes les entrées de la whitelist pour l'export RGPD Art. 20.
   *
   * Les entrées contiennent uniquement des hashes de domaines (domain_hash),
   * non réversibles en domaine en clair (privacy by design).
   *
   * @returns Liste des WhitelistEntry
   */
  async getAllWhitelist(): Promise<object[]> {
    const db = this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('whitelist', 'readonly');
      const store = tx.objectStore('whitelist');
      const request = store.getAll();
      request.onsuccess = (): void => resolve(request.result as object[]);
      request.onerror = (): void => reject(new Error('[StorageService] Échec getAllWhitelist'));
    });
  }

  // ---------------------------------------------------------------------------
  // Store whitelist (IndexedDB) — Modules M2 et M7
  // ---------------------------------------------------------------------------

  /**
   * Vérifie si un domaine est dans la whitelist pour un module donné.
   *
   * Utilisé par M2 (domaines de confiance) et M7 (suppression_list).
   *
   * @param domainHash - SHA-256(salt + domain)
   * @param module     - Module qui gère cette whitelist ('M2' ou 'M7')
   * @returns true si le domaine est dans la whitelist pour ce module
   */
  async isWhitelisted(domainHash: string, module: string): Promise<boolean> {
    const db = this.getDB();
    const tx = db.transaction('whitelist', 'readonly');
    const store = tx.objectStore('whitelist');

    return new Promise((resolve, reject) => {
      // Clé composite [domain_hash, module]
      const request = store.get([domainHash, module]);
      request.onsuccess = () => resolve(request.result !== undefined);
      request.onerror = () =>
        reject(new Error(`[StorageService] Échec isWhitelisted: ${request.error?.message ?? ''}`));
    });
  }

  /**
   * Ajoute un domaine dans la whitelist pour un module donné.
   *
   * @param domainHash - SHA-256(salt + domain)
   * @param module     - Module qui gère cette whitelist ('M2' ou 'M7')
   */
  async addToWhitelist(domainHash: string, module: string): Promise<void> {
    const db = this.getDB();
    const tx = db.transaction('whitelist', 'readwrite');
    const store = tx.objectStore('whitelist');

    const entry: WhitelistEntry & { module: string } = {
      domain_hash: domainHash,
      module,
      added_at: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const request = store.put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(`[StorageService] Échec addToWhitelist: ${request.error?.message ?? ''}`));
    });
  }

  /**
   * Supprime un domaine de la whitelist pour un module donné.
   *
   * @param domainHash - SHA-256(salt + domain)
   * @param module     - Module qui gère cette whitelist ('M2' ou 'M7')
   */
  async removeFromWhitelist(domainHash: string, module: string): Promise<void> {
    const db = this.getDB();
    const tx = db.transaction('whitelist', 'readwrite');
    const store = tx.objectStore('whitelist');

    return new Promise((resolve, reject) => {
      const request = store.delete([domainHash, module]);
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(
          new Error(`[StorageService] Échec removeFromWhitelist: ${request.error?.message ?? ''}`),
        );
    });
  }

  // ---------------------------------------------------------------------------
  // Store events — Méthodes spécialisées M6 (quiz sessions)
  // ---------------------------------------------------------------------------

  /**
   * Lit les N derniers événements de quiz M6 depuis le store events.
   *
   * Retourne les payloads déchiffrés des N dernières sessions,
   * triés du plus récent au plus ancien.
   *
   * @param n         - Nombre de sessions récentes à retourner
   * @param cryptoKey - Clé AES-256-GCM pour le déchiffrement
   * @returns Liste des payloads des dernières sessions quiz
   */
  async getRecentQuizSessions(n: number, cryptoKey: CryptoKey): Promise<EventPayload[]> {
    try {
      // Lire tous les événements M6 (depuis le début)
      const allM6 = await this.getEvents('M6', 0, cryptoKey);
      // Filtrer les sessions complètes et retourner les N dernières
      return allM6
        .filter((e) => e.action === 'quiz_completed' || e.action === 'quiz_incomplete')
        .slice(-n);
    } catch {
      return [];
    }
  }

  /**
   * Retourne le nombre total de sessions quiz M6 enregistrées.
   * Utilisé par le calcul de spaced repetition pour déterminer l'intervalle.
   *
   * @returns Nombre de sessions quiz M6
   */
  async getQuizSessionCount(): Promise<number> {
    const db = this.getDB();
    const tx = db.transaction('events', 'readonly');
    const store = tx.objectStore('events');
    const index = store.index('module');

    return new Promise((resolve, reject) => {
      let count = 0;
      const request = index.openCursor(IDBKeyRange.only('M6'));

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(count);
          return;
        }
        const record = cursor.value as { module: string };
        if (record) {
          count++;
        }
        cursor.continue();
      };

      request.onerror = () =>
        reject(
          new Error(`[StorageService] Échec getQuizSessionCount: ${request.error?.message ?? ''}`),
        );
    });
  }
}
