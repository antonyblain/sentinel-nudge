/**
 * @file messages.ts
 * @description Interfaces de communication inter-composants Sentinel Nudge.
 *
 * Ces types définissent le contrat de passage de messages entre :
 * - les content scripts détecteurs et le service worker
 * - le service worker et les pages UI (popup, options, dashboard)
 * - le service worker et les content scripts UI
 *
 * Référence : DAT §3.3 — Communication inter-composants
 */

import type { ModuleId } from './modules';

/**
 * Message standardisé envoyé via chrome.runtime.sendMessage() ou chrome.tabs.sendMessage().
 *
 * @property module - Identifiant du module émetteur (liste blanche MODULE_IDS)
 * @property action - Action demandée ou signalée (ex: 'detected', 'show', 'dismissed')
 * @property payload - Données spécifiques au module (validées par type guard dans message-validator.ts)
 * @property timestamp - Horodatage de l'émission (Date.now())
 */
export interface NudgeMessage {
  module: ModuleId;
  action: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

/**
 * Réponse renvoyée par le service worker au content script émetteur.
 *
 * @property success - true si le message a été traité avec succès
 * @property action - Instruction pour l'émetteur : afficher, ignorer ou erreur
 * @property reason - Raison optionnelle (ex: 'quota_exceeded', 'module_disabled')
 * @property data - Données optionnelles de retour (ex: signals pour l'affichage)
 */
export interface NudgeResponse {
  success: boolean;
  action: 'show' | 'skip' | 'error';
  reason?: string;
  data?: Record<string, unknown>;
}

/**
 * Payload spécifique au module M2 (analyse de risque domaine).
 *
 * @property signals - Signaux de risque détectés (ex: ['http', 'hsts_miss', 'levenshtein'])
 * @property domain_hash - SHA-256(installation_salt + domain) — jamais le domaine en clair
 */
export interface M2Payload {
  signals: string[];
  domain_hash: string;
}

/**
 * Payload spécifique au module M7 (réutilisation mot de passe).
 *
 * @property hash - SHA-256(installation_salt + password) — jamais le mot de passe en clair
 * @property domain_hash - SHA-256(installation_salt + domain)
 */
export interface M7Payload {
  hash: string;
  domain_hash: string;
}

/**
 * Payload spécifique au module M9 (évaluation force mot de passe).
 *
 * @property score - Score zxcvbn (0 à 4)
 * @property suggestions - Suggestions d'amélioration de zxcvbn-ts
 */
export interface M9Payload {
  score: number;
  suggestions: string[];
}

/**
 * Payload spécifique au module M17 (détection données sensibles dans le presse-papiers).
 *
 * @property type - Type de donnée détectée
 * @property preview_masked - Extrait masqué pour l'affichage dans le toast (ex: "****1234")
 */
export interface M17Payload {
  type: 'iban' | 'card' | 'api_key' | 'unknown';
  preview_masked: string;
}
