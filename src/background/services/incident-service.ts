/**
 * @file background/services/incident-service.ts
 * @description Service de gestion du registre d'incidents M7 (IndexedDB store m7_incidents).
 *
 * Le registre est un journal circulaire borné à MAX_INCIDENTS=500 entrées.
 * Il sert au diagnostic local et à la forensique post-incident.
 * Il n'est PAS un journal inviolable (CM-T1 — mini-DAT §11.2).
 *
 * Caractéristiques :
 * - Purge FIFO avec priorité sévérité (INV-SEC-04) : info → warn → error (dernier recours)
 * - Buffer mémoire pré-initDB de 10 entrées max (ARB-061-02 / Option B)
 *   → les incidents émis avant initDB sont bufferisés et flushés au premier tick
 * - Coalescing anti-DoS (CM-DOS2) : incidents identiques (type, severity, context structurel)
 *   < 1s sont coalesés (increment repeat_count) sauf severity='error' (CM-DOS3)
 * - Seules les écritures passent par log() — pas d'API d'édition exposée (CM-T4)
 *
 * Invariants :
 * - INV-03  : count() ≤ MAX_INCIDENTS à tout moment
 * - INV-SEC-02 : context typé IncidentContext — aucun plaintext sensible
 * - INV-SEC-04 : les error ne sont purgés qu'en dernier recours (store 100% error)
 *
 * Référence : Mini-DAT TACHE-061 §3.3, §4, §6 (INV-03), §6bis (INV-SEC-04),
 *             §9 (ARB-061-02/03), §9bis, §11.2/11.4
 */

import type {
  M7IncidentRecord,
  M7IncidentType,
  M7IncidentSeverity,
  IncidentContext,
} from '@/shared/types/diagnostics';

/** Borne maximale du registre circulaire (ARB-061-03 / Option A) */
export const MAX_INCIDENTS = 500;

/** Taille maximale du buffer mémoire pré-initDB (ARB-061-02 / Option B) */
const PRE_INIT_BUFFER_MAX = 10;

/** Fenêtre de coalescing anti-DoS en millisecondes (CM-DOS2) */
const COALESCE_WINDOW_MS = 1000;

/** Nombre maximum de coalescings consécutifs avant nouvelle entrée (CM-DOS2) */
const COALESCE_MAX_REPEAT = 10;

/**
 * Enregistrement étendu pour le coalescing (champ repeat_count non persisté en IDB).
 * Utilisé uniquement pour la dernière entrée lors des vérifications de coalescing.
 */
interface M7IncidentRecordExtended extends M7IncidentRecord {
  /** Nombre de répétitions coalescées (optionnel, géré en mémoire) */
  repeat_count?: number;
}

/**
 * Service de journalisation des incidents M7 dans IndexedDB.
 *
 * Instance créée après storageService.initDB() en utilisant la référence IDBDatabase
 * exposée par StorageService.getDB() (ARB-061-01 / Option A).
 *
 * Le buffer mémoire pré-initDB permet de ne pas perdre les incidents émis au boot
 * (notamment boot_fail et canary_failed) avant que initDB() ait terminé.
 */
export class IncidentService {
  /** Référence IDBDatabase — null tant que initDB() n'a pas été appelé */
  private db: IDBDatabase | null = null;

  /**
   * Buffer mémoire pré-initDB (ARB-061-02).
   * Taille max : PRE_INIT_BUFFER_MAX (10 entrées).
   * Drop du plus ancien si buffer saturé avant flush.
   */
  private readonly preInitBuffer: M7IncidentRecord[] = [];

  /**
   * Flag indiquant si initDB() a été appelé et le flush effectué.
   * Évite un double-flush si initService() est appelé plusieurs fois.
   */
  private initialized = false;

  /**
   * Référence à la dernière entrée insérée — pour le coalescing CM-DOS2.
   * Réinitialisée après chaque flush de buffer ou insertion non-coalescée.
   */
  private lastInserted: M7IncidentRecordExtended | null = null;

  /**
   * Initialise le service avec la référence IDBDatabase.
   * Flush immédiat du buffer pré-initDB.
   *
   * À appeler au premier tick après storageService.initDB().
   *
   * @param db - Référence IDBDatabase ouverte (via StorageService.getDB())
   */
  async initService(db: IDBDatabase): Promise<void> {
    if (this.initialized) return;
    this.db = db;
    this.initialized = true;
    await this.flushBuffer();
  }

  /**
   * Insère un incident dans le registre m7_incidents.
   *
   * Comportement selon l'état :
   * - Avant initService() : bufferisation dans preInitBuffer (max 10 entrées, drop oldest)
   * - Après initService() : insertion directe dans IndexedDB avec purge FIFO si nécessaire
   *
   * Coalescing anti-DoS (CM-DOS2) :
   * - Si le même (type, severity) a été loggé < COALESCE_WINDOW_MS avec repeat_count < COALESCE_MAX_REPEAT
   *   → incrémenter repeat_count de la dernière entrée au lieu d'en créer une nouvelle
   * - Exception : severity='error' → jamais coalescé (CM-DOS3, timestamp précis préservé)
   *
   * INV-SEC-02 : le type IncidentContext garantit à la compilation l'absence de données sensibles.
   * INV-SEC-04 : si count >= MAX_INCIDENTS, la purge cible info → warn → error (dernier recours).
   *
   * @param type     - Type d'incident (M7IncidentType)
   * @param severity - Sévérité (info/warn/error)
   * @param context  - Contexte structuré (IncidentContext — CM-ID2)
   */
  async log(
    type: M7IncidentType,
    severity: M7IncidentSeverity,
    context: IncidentContext,
  ): Promise<void> {
    const record: M7IncidentRecord = {
      ts: Date.now(),
      type,
      severity,
      context,
    };

    if (!this.initialized || this.db === null) {
      // Mode buffer : stocker avant que initDB soit disponible (ARB-061-02)
      this.bufferIncident(record);
      return;
    }

    await this.insertWithFifo(record);
  }

  /**
   * Retourne les N derniers incidents, triés par ts décroissant.
   * Utilisé par les tests et la future page de diagnostic.
   *
   * @param n - Nombre maximum d'incidents à retourner
   * @returns Liste d'incidents triés par ts décroissant
   * @throws Error si la base n'est pas initialisée
   */
  async getLast(n: number): Promise<M7IncidentRecord[]> {
    const db = this.requireDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('m7_incidents', 'readonly');
      const store = tx.objectStore('m7_incidents');
      const index = store.index('ts');
      const results: M7IncidentRecord[] = [];

      // Curseur décroissant sur l'index ts pour récupérer les plus récents en premier
      const request = index.openCursor(null, 'prev');

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || results.length >= n) {
          resolve(results);
          return;
        }
        results.push(cursor.value as M7IncidentRecord);
        cursor.continue();
      };

      request.onerror = () =>
        reject(
          new Error(
            `[IncidentService] Échec getLast: ${request.error?.message ?? 'Erreur inconnue'}`,
          ),
        );
    });
  }

  /**
   * Retourne le nombre total d'entrées dans le store m7_incidents.
   * Utile pour les assertions de test (invariant INV-03 : ≤ MAX_INCIDENTS).
   *
   * @returns Nombre d'enregistrements dans m7_incidents
   * @throws Error si la base n'est pas initialisée
   */
  async count(): Promise<number> {
    const db = this.requireDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('m7_incidents', 'readonly');
      const store = tx.objectStore('m7_incidents');
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(
          new Error(
            `[IncidentService] Échec count: ${request.error?.message ?? 'Erreur inconnue'}`,
          ),
        );
    });
  }

  // ---------------------------------------------------------------------------
  // Méthodes privées
  // ---------------------------------------------------------------------------

  /**
   * Ajoute un incident au buffer mémoire pré-initDB.
   * Si le buffer est saturé (≥ PRE_INIT_BUFFER_MAX), supprime le plus ancien (shift).
   *
   * @param record - Incident à bufferiser
   */
  private bufferIncident(record: M7IncidentRecord): void {
    if (this.preInitBuffer.length >= PRE_INIT_BUFFER_MAX) {
      // Drop du plus ancien — le plus critique (error) est protégé par INV-SEC-04 après flush
      this.preInitBuffer.shift();
    }
    this.preInitBuffer.push(record);
  }

  /**
   * Vide le buffer mémoire pré-initDB vers IndexedDB.
   * Appelé au premier tick après initService().
   */
  private async flushBuffer(): Promise<void> {
    const toFlush = [...this.preInitBuffer];
    this.preInitBuffer.length = 0;

    for (const record of toFlush) {
      await this.insertWithFifo(record);
    }
  }

  /**
   * Insère un incident dans IndexedDB avec purge FIFO si count >= MAX_INCIDENTS.
   *
   * Logique de purge INV-SEC-04 :
   * - Priorité 1 : supprimer l'entrée la plus ancienne de severity='info'
   * - Priorité 2 : supprimer l'entrée la plus ancienne de severity='warn'
   * - Priorité 3 (cas pathologique) : supprimer l'entrée la plus ancienne de severity='error'
   *   (uniquement si 100% du store est composé d'entrées error)
   *
   * Coalescing CM-DOS2 (sauf severity='error') :
   * - Si même type et severity que lastInserted, < COALESCE_WINDOW_MS,
   *   et repeat_count < COALESCE_MAX_REPEAT → pas de nouvelle entrée
   *
   * @param record - Incident à insérer
   */
  private async insertWithFifo(record: M7IncidentRecord): Promise<void> {
    const db = this.requireDB();

    // Coalescing anti-DoS CM-DOS2 — jamais pour les error (CM-DOS3)
    if (record.severity !== 'error' && this.shouldCoalesce(record)) {
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction('m7_incidents', 'readwrite');
      const store = tx.objectStore('m7_incidents');

      const countReq = store.count();

      countReq.onsuccess = () => {
        const currentCount = countReq.result;

        const doInsert = (): void => {
          const addReq = store.add(record);
          addReq.onsuccess = () => {
            // Mémoriser pour le coalescing
            const inserted = { ...record, id: addReq.result as number };
            this.lastInserted = { ...inserted, repeat_count: 0 };
            resolve();
          };
          addReq.onerror = () =>
            reject(
              new Error(
                `[IncidentService] Échec insertion: ${addReq.error?.message ?? 'Erreur inconnue'}`,
              ),
            );
        };

        if (currentCount >= MAX_INCIDENTS) {
          // INV-SEC-04 : purge prioritaire info → warn → error (dernier recours)
          this.purgeOldestByPriority(store, doInsert, reject);
        } else {
          doInsert();
        }
      };

      countReq.onerror = () =>
        reject(
          new Error(
            `[IncidentService] Échec count avant insertion: ${countReq.error?.message ?? 'Erreur inconnue'}`,
          ),
        );

      tx.onerror = () =>
        reject(
          new Error(
            `[IncidentService] Échec transaction: ${tx.error?.message ?? 'Erreur inconnue'}`,
          ),
        );
    });
  }

  /**
   * Supprime l'entrée la plus ancienne dans l'ordre de priorité INV-SEC-04 :
   * info (priorité 1) → warn (priorité 2) → error (dernier recours).
   *
   * Utilise l'index 'ts' pour trouver l'entrée la plus ancienne de chaque sévérité.
   *
   * @param store    - IDBObjectStore en mode readwrite
   * @param onDone   - Callback appelé après suppression réussie
   * @param onError  - Callback appelé en cas d'erreur
   */
  private purgeOldestByPriority(
    store: IDBObjectStore,
    onDone: () => void,
    onError: (err: Error) => void,
  ): void {
    const severityOrder: M7IncidentSeverity[] = ['info', 'warn', 'error'];

    const tryPurgeSeverity = (index: number): void => {
      if (index >= severityOrder.length) {
        // Ne devrait pas arriver, mais on insère quand même sans purge en dernier recours
        onDone();
        return;
      }

      const targetSeverity = severityOrder[index];
      if (targetSeverity === undefined) {
        onDone();
        return;
      }

      // Ouvrir un curseur sur l'index ts (ordre croissant) et chercher la plus ancienne de cette sévérité
      const tsIndex = store.index('ts');
      const cursorReq = tsIndex.openCursor(null, 'next');
      let found = false;

      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) {
          // Aucune entrée de cette sévérité → passer à la suivante
          if (!found) {
            tryPurgeSeverity(index + 1);
          }
          return;
        }

        const entry = cursor.value as M7IncidentRecord;
        if (entry.severity === targetSeverity) {
          // Supprimer cette entrée
          found = true;
          const deleteReq = cursor.delete();
          deleteReq.onsuccess = () => onDone();
          deleteReq.onerror = () =>
            onError(
              new Error(
                `[IncidentService] Échec purge: ${deleteReq.error?.message ?? 'Erreur inconnue'}`,
              ),
            );
        } else {
          // Continuer à chercher dans ce curseur
          cursor.continue();
        }
      };

      cursorReq.onerror = () => {
        onError(
          new Error(
            `[IncidentService] Échec curseur purge: ${cursorReq.error?.message ?? 'Erreur inconnue'}`,
          ),
        );
      };
    };

    tryPurgeSeverity(0);
  }

  /**
   * Détermine si l'incident peut être coalescé avec le dernier incident inséré (CM-DOS2).
   *
   * Conditions de coalescing :
   * 1. lastInserted existe et a le même type et la même severity
   * 2. L'incident est dans la fenêtre COALESCE_WINDOW_MS
   * 3. repeat_count < COALESCE_MAX_REPEAT
   *
   * @param record - Incident candidat au coalescing
   * @returns true si l'incident peut être coalescé (ne pas insérer de nouvelle entrée)
   */
  private shouldCoalesce(record: M7IncidentRecord): boolean {
    if (!this.lastInserted) return false;

    const timeDiff = record.ts - this.lastInserted.ts;
    if (timeDiff > COALESCE_WINDOW_MS) return false;
    if (this.lastInserted.type !== record.type) return false;
    if (this.lastInserted.severity !== record.severity) return false;

    const repeatCount = this.lastInserted.repeat_count ?? 0;
    if (repeatCount >= COALESCE_MAX_REPEAT) return false;

    // Incrémenter le compteur de répétitions en mémoire
    this.lastInserted.repeat_count = repeatCount + 1;
    return true;
  }

  /**
   * Retourne la référence IDBDatabase ou lève une erreur si non initialisée.
   *
   * @returns IDBDatabase ouverte
   * @throws Error si initService() n'a pas été appelé
   */
  private requireDB(): IDBDatabase {
    if (!this.db) {
      throw new Error(
        '[IncidentService] Base IndexedDB non initialisée. Appeler initService() après storageService.initDB().',
      );
    }
    return this.db;
  }
}
