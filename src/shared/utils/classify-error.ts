/**
 * @file shared/utils/classify-error.ts
 * @description Helper de classification d'erreurs en codes structurés déterministes.
 *
 * Ce helper est complémentaire à la factory Logger (logger.ts).
 * Il permet de logger un code d'erreur métier sans exposer le message brut
 * qui peut contenir des données utilisateur (PII, mots de passe, tokens).
 *
 * ## Invariant de sécurité (INV-SEC-02 étendu / R-M7-08 / TACHE-083+104)
 *
 * Interdit dans tout log :
 *   - `err.message` : peut contenir "Invalid password 'abc123'" ou "user@domain.com"
 *   - `String(err)` : sérialise le message brut
 *
 * Remplacement obligatoire :
 *   - `classifyError(err)` → ErrorCode déterministe (ne contient aucune donnée utilisateur)
 *
 * ## Codes disponibles
 *
 * | Code        | Classe(s) d'erreur                                       |
 * |-------------|----------------------------------------------------------|
 * | `quota`     | QuotaExceededError                                       |
 * | `network`   | NetworkError, FetchError                                 |
 * | `crypto`    | OperationError, DataError (SubtleCrypto)                 |
 * | `not_found` | DOMException NotFoundError                               |
 * | `permission`| DOMException SecurityError, NotAllowedError              |
 * | `timeout`   | DOMException TimeoutError, AbortError                    |
 * | `storage`   | DOMException générique (IndexedDB, storage)              |
 * | `type`      | TypeError                                                |
 * | `range`     | RangeError                                               |
 * | `unknown`   | Tout le reste (non-Error, string catchée, null…)         |
 *
 * ## Référence
 * - R-M7-08 : Fuite d'information par console SW
 * - INV-SEC-02 : Pas de données utilisateur en clair
 * - TACHE-083 : factory logger.ts
 * - TACHE-104 : migration 12 sites SW handlers
 */

/**
 * Codes d'erreur structurés produits par classifyError().
 *
 * Ces codes sont exhaustifs et déterministes : pour une classe d'erreur donnée,
 * le code est toujours le même. Ils n'exposent aucune donnée utilisateur.
 */
export type ErrorCode =
  | 'network'
  | 'storage'
  | 'quota'
  | 'crypto'
  | 'type'
  | 'range'
  | 'not_found'
  | 'permission'
  | 'timeout'
  | 'unknown';

/** Noms d'erreur DOMException mappés sur 'not_found' */
const DOM_NOT_FOUND = new Set(['NotFoundError', 'NoModificationAllowedError']);

/** Noms d'erreur DOMException mappés sur 'permission' */
const DOM_PERMISSION = new Set(['SecurityError', 'NotAllowedError', 'PermissionDeniedError']);

/** Noms d'erreur DOMException mappés sur 'timeout' */
const DOM_TIMEOUT = new Set(['TimeoutError', 'AbortError']);

/** Noms d'erreur SubtleCrypto mappés sur 'crypto' */
const CRYPTO_NAMES = new Set(['OperationError', 'DataError']);

/**
 * Classifie une erreur catchée en un code structuré déterministe.
 *
 * @param err - Valeur catchée (Error, string, null, undefined, objet quelconque)
 * @returns Code d'erreur structuré de type ErrorCode
 *
 * @example
 * ```typescript
 * try {
 *   await chrome.storage.local.set(data);
 * } catch (err: unknown) {
 *   logger.error('storage_write_failed', { error_code: classifyError(err) });
 * }
 * // → { error_code: 'quota' }  si QuotaExceededError
 * // → { error_code: 'storage' } si DOMException générique
 * ```
 */
export function classifyError(err: unknown): ErrorCode {
  // Récupérer le name sans passer par instanceof Error (DOMException n'hérite pas d'Error
  // dans certains environnements comme jsdom — vérifier via duck typing sur .name)
  const name =
    err !== null &&
    err !== undefined &&
    typeof (err as Record<string, unknown>)['name'] === 'string'
      ? ((err as Record<string, unknown>)['name'] as string)
      : null;

  if (name === null) return 'unknown';

  // Quota dépassé (IndexedDB, chrome.storage)
  if (name === 'QuotaExceededError') return 'quota';

  // SubtleCrypto — OperationError, DataError
  if (CRYPTO_NAMES.has(name)) return 'crypto';

  // DOMException — classification par name (robuste jsdom / navigateur)
  if (DOM_NOT_FOUND.has(name)) return 'not_found';
  if (DOM_PERMISSION.has(name)) return 'permission';
  if (DOM_TIMEOUT.has(name)) return 'timeout';

  // DOMException générique (InvalidStateError, UnknownError, StorageError, etc.)
  // Détection par instanceof (navigateur) ou duck typing sur .code (jsdom)
  if (
    err instanceof DOMException ||
    (typeof (err as Record<string, unknown>)['code'] === 'number' &&
      typeof (err as Record<string, unknown>)['message'] === 'string' &&
      !(err instanceof Error))
  ) {
    return 'storage';
  }

  // À partir d'ici on requiert instanceof Error pour éviter les faux positifs
  if (!(err instanceof Error)) return 'unknown';

  // Erreurs réseau (fetch échoue ou NetworkError)
  if (name === 'NetworkError' || name === 'FetchError') return 'network';

  // TypeError (argument incorrect, null deref)
  if (name === 'TypeError') return 'type';

  // RangeError (index hors bornes, taille invalide)
  if (name === 'RangeError') return 'range';

  return 'unknown';
}
