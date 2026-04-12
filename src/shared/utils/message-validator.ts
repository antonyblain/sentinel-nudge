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
 * Référence : DAT §3.3 (Validation runtime des messages), §9.3 (D-SEC-003)
 */

import { MODULE_IDS } from '../constants/modules';
import type { ModuleId } from '../types/modules';
import type { NudgeMessage } from '../types/messages';

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
