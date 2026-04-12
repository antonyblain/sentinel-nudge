/**
 * @file utils/message-validator.ts
 * @description Validation runtime des messages entrants dans le Service Worker (NC-SEC-01).
 *
 * Deux niveaux de validation :
 * 1. Validation du champ `module` contre la liste blanche MODULE_IDS
 * 2. Validation de la structure de base du message (action, payload, timestamp)
 *
 * Les messages non conformes sont rejetés silencieusement (pas de réponse, pas d'exception)
 * pour éviter toute fuite d'information sur la surface d'attaque.
 *
 * Des type guards spécifiques par module (isM2Payload, isM7Payload, etc.) sont fournis
 * pour la validation du payload dans message-router.ts.
 *
 * Référence : DAT §3.3 (Validation runtime des messages), §9.3 (D-SEC-003)
 */

import { MODULE_IDS } from '../constants/modules';
import type { ModuleId } from '../types/modules';
import type { NudgeMessage, M2Payload, M7Payload, M9Payload, M17Payload } from '../types/messages';

/**
 * Vérifie qu'une valeur est un identifiant de module valide (liste blanche MODULE_IDS).
 *
 * @param value - Valeur à tester (inconnue à la réception du message)
 * @returns true si la valeur est un ModuleId valide
 */
/** Identifiants internes (non-modules) acceptés par le message router */
const INTERNAL_IDS: readonly string[] = ['EXPORT'];

export function isValidModuleId(value: unknown): value is ModuleId {
  return (
    typeof value === 'string' &&
    ((MODULE_IDS as readonly string[]).includes(value) || INTERNAL_IDS.includes(value))
  );
}

/**
 * Valide la structure de base d'un message entrant (NudgeMessage).
 *
 * Vérifie :
 * - L'objet n'est pas null
 * - `module` est dans la liste blanche MODULE_IDS
 * - `action` est une chaîne non vide
 * - `payload` est un objet non null
 * - `timestamp` est un nombre
 *
 * @param msg - Message brut reçu via chrome.runtime.onMessage
 * @returns true si le message respecte l'interface NudgeMessage
 */
export function validateNudgeMessage(msg: unknown): msg is NudgeMessage {
  if (typeof msg !== 'object' || msg === null) return false;
  const m = msg as Record<string, unknown>;
  if (!isValidModuleId(m['module'])) return false;
  if (typeof m['action'] !== 'string' || m['action'].length === 0) return false;
  if (typeof m['payload'] !== 'object' || m['payload'] === null) return false;
  if (typeof m['timestamp'] !== 'number') return false;
  return true;
}

// ---------------------------------------------------------------------------
// Type guards spécifiques par module
// ---------------------------------------------------------------------------

/**
 * Valide le payload d'un message M2 (analyse de risque domaine).
 *
 * Vérifie que `signals` est un tableau et `domain_hash` est une chaîne non vide.
 *
 * @param payload - Payload brut du message M2
 * @returns true si le payload respecte M2Payload
 */
export function isM2Payload(payload: unknown): payload is M2Payload {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return (
    Array.isArray(p['signals']) &&
    typeof p['domain_hash'] === 'string' &&
    p['domain_hash'].length > 0
  );
}

/**
 * Valide le payload d'un message M7 (réutilisation mot de passe).
 *
 * Vérifie que `hash` et `domain_hash` sont des chaînes non vides.
 * Ces champs doivent contenir des hashes SHA-256 (64 caractères hex).
 *
 * @param payload - Payload brut du message M7
 * @returns true si le payload respecte M7Payload
 */
export function isM7Payload(payload: unknown): payload is M7Payload {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p['hash'] === 'string' &&
    p['hash'].length > 0 &&
    typeof p['domain_hash'] === 'string' &&
    p['domain_hash'].length > 0
  );
}

/**
 * Valide le payload d'un message M9 (force de mot de passe).
 *
 * @param payload - Payload brut du message M9
 * @returns true si le payload respecte M9Payload
 */
export function isM9Payload(payload: unknown): payload is M9Payload {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p['score'] === 'number' &&
    p['score'] >= 0 &&
    p['score'] <= 4 &&
    Array.isArray(p['suggestions'])
  );
}

/**
 * Valide le payload d'un message M17 (données sensibles dans le presse-papiers).
 *
 * @param payload - Payload brut du message M17
 * @returns true si le payload respecte M17Payload
 */
export function isM17Payload(payload: unknown): payload is M17Payload {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  const validTypes = ['iban', 'card', 'api_key', 'unknown'];
  return (
    typeof p['type'] === 'string' &&
    validTypes.includes(p['type']) &&
    typeof p['preview_masked'] === 'string'
  );
}
