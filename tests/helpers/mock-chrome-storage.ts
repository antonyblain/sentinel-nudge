/**
 * @file tests/helpers/mock-chrome-storage.ts
 * @description Wrapper mock JSON-strict de chrome.storage.local réutilisable par la suite Vitest.
 *
 * Motivations (post-mortem M7 D-PM-03) :
 * - P-018 fix critique : chrome.storage.local.set({key: ArrayBuffer}) échoue silencieusement
 *   dans Chrome réel. Ce wrapper lève une TypeError immédiate sur tout type non-JSON-serializable.
 * - P-020 fix : quota 5 Mo simulé — QuotaExceededError sur dépassement.
 * - ADR-001 SW-BOOT-CONTRACT + ADR-002 CROSS-LIFECYCLE-INTENT : simulateSWKill() conserve le
 *   storage persistant mais purge les listeners onChanged et tout état in-memory non persistant.
 *
 * Utilisation dans un test :
 * ```ts
 * import { createMockChromeStorage } from '../helpers/mock-chrome-storage';
 *
 * const { storage, simulateSWKill, getQuotaUsage, reset } = createMockChromeStorage();
 *
 * global.chrome = {
 *   storage: { local: storage },
 * } as unknown as typeof chrome;
 *
 * beforeEach(() => reset());
 * ```
 *
 * Migration des tests existants :
 * Remplacer le bloc `const mockLocalStorage: Record<string, unknown> = {}` + `global.chrome = { ... }`
 * codé en dur dans chaque fichier de test par `createMockChromeStorage()` et affecter
 * `global.chrome.storage.local = storage`. Cela centralise la validation JSON-strict et
 * supprime les mocks permissifs qui laissent passer les ArrayBuffer silencieusement.
 *
 * Références : P-018, P-020, ADR-001, ADR-002, TACHE-060, TACHE-177
 */

// ---------------------------------------------------------------------------
// Types internes
// ---------------------------------------------------------------------------

/** Options de création du mock storage */
export interface MockChromeStorageOpts {
  /** Quota en octets (défaut : 5 242 880 = 5 Mo, identique à chrome.storage.local) */
  quotaBytes?: number;
}

/** Payload d'un événement onChanged */
export interface StorageChange {
  oldValue?: unknown;
  newValue?: unknown;
}

/** Type d'un listener onChanged */
export type StorageChangeListener = (changes: Record<string, StorageChange>) => void;

/** Interface minimale compatible chrome.storage.local MV3 */
export interface MockStorageLocal {
  get(
    keys: string | string[] | Record<string, unknown> | null,
    callback?: (result: Record<string, unknown>) => void,
  ): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>, callback?: () => void): Promise<void>;
  remove(keys: string | string[], callback?: () => void): Promise<void>;
  clear(callback?: () => void): Promise<void>;
  onChanged: {
    addListener(listener: StorageChangeListener): void;
    removeListener(listener: StorageChangeListener): void;
    /** Déclenche manuellement (usage interne + tests avancés) */
    _fire(changes: Record<string, StorageChange>): void;
  };
  /** Drapeaux in-memory non persistants — purgés à simulateSWKill() */
  _inMemoryFlags: Record<string, unknown>;
}

/** Résultat de createMockChromeStorage */
export interface MockChromeStorageResult {
  storage: MockStorageLocal;
  /** Simule un kill du Service Worker : conserve le storage persistant, purge listeners + _inMemoryFlags */
  simulateSWKill(): void;
  /** Retourne le nombre d'octets approximativement utilisés (via JSON.stringify.length) */
  getQuotaUsage(): number;
  /** Réinitialise complètement (storage + listeners + quotaBytes) */
  reset(): void;
}

// ---------------------------------------------------------------------------
// Types non-JSON (types interdits dans chrome.storage.local Chrome réel)
// ---------------------------------------------------------------------------

/** Liste des constructeurs natifs dont les instances NE sont PAS JSON-safe */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
const NON_JSON_CONSTRUCTORS: ReadonlyArray<Function> = [
  ArrayBuffer,
  Uint8Array,
  Int8Array,
  Uint8ClampedArray,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array,
  BigInt64Array,
  BigUint64Array,
  DataView,
  Map,
  Set,
  WeakMap,
  WeakSet,
  Date,
  RegExp,
  Error,
  Blob,
];

/**
 * Vérifie récursivement qu'une valeur est JSON-safe.
 *
 * Règles :
 * - string, number fini, boolean, null → OK
 * - BigInt → KO (JSON.stringify lève une TypeError)
 * - Symbol → KO
 * - function → KO
 * - Instances des constructeurs NON_JSON_CONSTRUCTORS → KO
 * - CryptoKey (détecté par duck-typing : type + algorithm + extractable) → KO
 * - plain object → récursion sur les valeurs
 * - Array → récursion sur les éléments
 * - undefined → KO (JSON.stringify omet les propriétés undefined, mais chrome.storage.local
 *   lève une erreur si une valeur de premier niveau est undefined)
 */
export function isJsonSafe(value: unknown): boolean {
  if (value === null) return true;
  if (value === undefined) return false;

  const t = typeof value;

  if (t === 'string' || t === 'boolean') return true;
  if (t === 'number') return Number.isFinite(value as number);
  if (t === 'bigint') return false;
  if (t === 'symbol') return false;
  if (t === 'function') return false;

  if (t === 'object') {
    // Duck-typing CryptoKey (pas exposé dans jsdom, pas de classe importable directement)
    if (isCryptoKey(value)) return false;

    // Vérification par constructeur
    for (const ctor of NON_JSON_CONSTRUCTORS) {
      if (value instanceof ctor) return false;
    }

    // Array → récursion sur éléments
    if (Array.isArray(value)) {
      return (value as unknown[]).every((item) => isJsonSafe(item));
    }

    // Plain object (ou objet de classe inconnue — on inspecte les valeurs)
    // Exclure les objets dont le prototype n'est ni Object ni null (instances de classes custom)
    const proto = Object.getPrototypeOf(value) as unknown;
    if (proto !== null && proto !== Object.prototype) {
      // Classe custom inconnue — refusé par sécurité
      return false;
    }

    // Récursion sur les valeurs du plain object
    return Object.values(value as Record<string, unknown>).every((v) => isJsonSafe(v));
  }

  return false;
}

/** Duck-type un CryptoKey sans dépendre du type natif (absent dans jsdom) */
function isCryptoKey(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['type'] === 'string' &&
    typeof obj['algorithm'] === 'object' &&
    typeof obj['extractable'] === 'boolean' &&
    Array.isArray(obj['usages'])
  );
}

// ---------------------------------------------------------------------------
// Approximation du quota en octets
// ---------------------------------------------------------------------------

/**
 * Approxime la taille en octets d'un enregistrement via JSON.stringify.
 * La valeur réelle dans Chrome utilise une sérialisation structurée binaire,
 * mais JSON.stringify.length est une approximation raisonnable pour les tests.
 * Note : JSON.stringify retourne undefined si la valeur n'est pas sérialisable,
 * mais isJsonSafe() est toujours appelé avant.
 */
function approximateSizeBytes(key: string, value: unknown): number {
  const serialized = JSON.stringify(value);
  // key length + value serialized length (UTF-16 ~2 octets/char dans V8, on simplifie à 1)
  return key.length + (serialized?.length ?? 0);
}

// ---------------------------------------------------------------------------
// Fabrique principale
// ---------------------------------------------------------------------------

/** Quota par défaut : 5 242 880 octets = 5 Mo (identique à chrome.storage.local) */
const DEFAULT_QUOTA_BYTES = 5 * 1024 * 1024;

/**
 * Crée un mock JSON-strict de chrome.storage.local.
 *
 * @param opts.quotaBytes Quota en octets. Défaut : 5 242 880 (5 Mo).
 */
export function createMockChromeStorage(opts: MockChromeStorageOpts = {}): MockChromeStorageResult {
  const quotaBytes = opts.quotaBytes ?? DEFAULT_QUOTA_BYTES;

  // Store persistant (survit au simulateSWKill)
  let persistentStore: Record<string, unknown> = {};

  // Listeners onChanged (purgés à simulateSWKill)
  let listeners: StorageChangeListener[] = [];

  // Drapeaux in-memory non persistants (purgés à simulateSWKill)
  const inMemoryFlags: Record<string, unknown> = {};

  // ------------------------------------------------------------------
  // Utilitaires internes
  // ------------------------------------------------------------------

  function computeQuotaUsage(): number {
    return Object.entries(persistentStore).reduce(
      (total, [key, value]) => total + approximateSizeBytes(key, value),
      0,
    );
  }

  function fireOnChanged(changes: Record<string, StorageChange>): void {
    // Copie de la liste pour éviter les mutations pendant l'itération
    const snapshot = [...listeners];
    for (const listener of snapshot) {
      listener(changes);
    }
  }

  /** Retourne un nom lisible du type d'une valeur */
  function getTypeName(value: unknown): string {
    if (value === null) return 'null';
    if (typeof value === 'bigint') return 'BigInt';
    if (typeof value === 'symbol') return 'Symbol';
    if (typeof value === 'function') return 'function';
    if (typeof value === 'object') {
      const name = (value as { constructor?: { name?: string } })?.constructor?.name;
      if (name) return name;
      return 'object';
    }
    return typeof value;
  }

  // ------------------------------------------------------------------
  // Implémentation des méthodes storage
  // Toutes les fonctions sont async pour garantir que les erreurs
  // (throw TypeError, throw QuotaExceededError) sont correctement
  // enveloppées dans une Promise rejetée — ce qui permet à Vitest
  // de les capturer via await expect(...).rejects.toThrow() (P-018).
  // ------------------------------------------------------------------

  async function storageGet(
    keys: string | string[] | Record<string, unknown> | null,
    callback?: (result: Record<string, unknown>) => void,
  ): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};

    if (keys === null) {
      // Retourner toutes les entrées
      Object.assign(result, persistentStore);
    } else if (typeof keys === 'string') {
      if (keys in persistentStore) {
        result[keys] = persistentStore[keys];
      }
    } else if (Array.isArray(keys)) {
      for (const k of keys) {
        if (k in persistentStore) {
          result[k] = persistentStore[k];
        }
      }
    } else if (typeof keys === 'object') {
      // keys est un objet de defaults : pour chaque clé, retourner la valeur stockée ou le défaut
      for (const [k, defaultValue] of Object.entries(keys)) {
        result[k] = k in persistentStore ? persistentStore[k] : defaultValue;
      }
    }

    callback?.(result);
    return result;
  }

  async function storageSet(items: Record<string, unknown>, callback?: () => void): Promise<void> {
    // 1. Validation JSON-strict (P-018)
    // Effectuée dans une fonction async : le throw devient un Promise.reject automatiquement,
    // ce qui permet à Vitest await expect(...).rejects.toThrow(TypeError) de fonctionner.
    for (const [key, value] of Object.entries(items)) {
      if (!isJsonSafe(value)) {
        const typeName = getTypeName(value);
        throw new TypeError(
          `[mock-chrome-storage] chrome.storage.local.set() — valeur non JSON-serializable ` +
            `pour la clé "${key}": type ${typeName} interdit. ` +
            `Chrome réel échoue silencieusement; ce mock lève une erreur immédiate (P-018).`,
        );
      }
    }

    // 2. Vérification quota (P-020)
    const currentUsage = computeQuotaUsage();
    const newBytesApprox = Object.entries(items).reduce((total, [key, value]) => {
      // Soustraire la taille de la clé existante (remplacement)
      const existingSize =
        key in persistentStore ? approximateSizeBytes(key, persistentStore[key]) : 0;
      return total + approximateSizeBytes(key, value) - existingSize;
    }, 0);

    if (currentUsage + newBytesApprox > quotaBytes) {
      const error = new Error(
        `[mock-chrome-storage] QuotaExceededError: quota chrome.storage.local dépassé. ` +
          `Usage courant : ${currentUsage} octets, tentative d'ajout : ${newBytesApprox} octets, ` +
          `quota : ${quotaBytes} octets. (P-020)`,
      );
      error.name = 'QuotaExceededError';
      throw error;
    }

    // 3. Construction des changements pour onChanged
    const changes: Record<string, StorageChange> = {};
    for (const [key, newValue] of Object.entries(items)) {
      changes[key] = {
        oldValue: key in persistentStore ? persistentStore[key] : undefined,
        newValue,
      };
    }

    // 4. Écriture dans le store persistant
    Object.assign(persistentStore, items);

    // 5. Déclenchement des listeners onChanged
    fireOnChanged(changes);

    callback?.();
  }

  async function storageRemove(keys: string | string[], callback?: () => void): Promise<void> {
    const keyList = Array.isArray(keys) ? keys : [keys];

    const changes: Record<string, StorageChange> = {};
    for (const key of keyList) {
      if (key in persistentStore) {
        changes[key] = { oldValue: persistentStore[key], newValue: undefined };
        delete persistentStore[key];
      }
    }

    if (Object.keys(changes).length > 0) {
      fireOnChanged(changes);
    }

    callback?.();
  }

  async function storageClear(callback?: () => void): Promise<void> {
    const changes: Record<string, StorageChange> = {};
    for (const [key, value] of Object.entries(persistentStore)) {
      changes[key] = { oldValue: value, newValue: undefined };
    }

    persistentStore = {};

    if (Object.keys(changes).length > 0) {
      fireOnChanged(changes);
    }

    callback?.();
  }

  // ------------------------------------------------------------------
  // Objet storage exposé
  // ------------------------------------------------------------------

  const storage: MockStorageLocal = {
    get: storageGet,
    set: storageSet,
    remove: storageRemove,
    clear: storageClear,
    onChanged: {
      addListener(listener: StorageChangeListener): void {
        if (!listeners.includes(listener)) {
          listeners.push(listener);
        }
      },
      removeListener(listener: StorageChangeListener): void {
        listeners = listeners.filter((l) => l !== listener);
      },
      _fire(changes: Record<string, StorageChange>): void {
        fireOnChanged(changes);
      },
    },
    _inMemoryFlags: inMemoryFlags,
  };

  // ------------------------------------------------------------------
  // Fonctions du cycle de vie
  // ------------------------------------------------------------------

  /** Simule un kill du Service Worker (ADR-001 / ADR-002) */
  function simulateSWKill(): void {
    // Le storage persistant est conservé (chrome.storage.local survit au kill SW)
    // Les listeners onChanged sont purgés (état in-memory du SW perdu)
    listeners = [];
    // Les drapeaux in-memory non persistants sont purgés
    Object.keys(inMemoryFlags).forEach((k) => delete inMemoryFlags[k]);
  }

  /** Retourne l'usage quota approximatif en octets */
  function getQuotaUsage(): number {
    return computeQuotaUsage();
  }

  /** Réinitialisation complète (appeler dans beforeEach) */
  function reset(): void {
    persistentStore = {};
    listeners = [];
    Object.keys(inMemoryFlags).forEach((k) => delete inMemoryFlags[k]);
  }

  return { storage, simulateSWKill, getQuotaUsage, reset };
}
