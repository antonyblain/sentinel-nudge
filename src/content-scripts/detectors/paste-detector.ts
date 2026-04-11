/**
 * @file content-scripts/detectors/paste-detector.ts
 * @description Détecteur de données sensibles dans le presse-papiers (module M17).
 *
 * Ce content script écoute l'événement `paste` sur le document.
 * Si le contenu collé correspond à un pattern IBAN, numéro de carte, ou clé API,
 * il est signalé au service worker qui déclenche le toast M17 et nullifie le presse-papiers.
 *
 * Sécurité (D-SEC-002) :
 * - La nullification du presse-papiers est déclenchée < 10 ms après la détection
 * - L'extrait envoyé au SW est masqué (ex: "****1234" pour une CB)
 * - Le contenu complet n'est jamais transmis au SW
 *
 * Référence : DAT §6.2 (flux M17), §9.4 (D-SEC-002 nullification presse-papiers)
 */

import { browser } from '@/shared/browser/browser-adapter';

/**
 * Patterns de détection de données sensibles.
 * Les patterns sont intentionnellement simplifiés pour la v1 — à affiner en P4.
 */
const SENSITIVE_PATTERNS = {
  iban: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7,}(?:[A-Z0-9]?\d{6,})?(?:[A-Z0-9]?\d{2,})?\b/i,
  card: /\b(?:\d[ -]?){13,16}\b/,
  api_key: /\b(?:sk[-_]|pk[-_]|api[-_]key[-_]|token[-_])[a-z0-9]{16,}\b/i,
} as const;

/**
 * Initialise le détecteur de presse-papiers.
 */
function initPasteDetector(): void {
  document.addEventListener('paste', handlePaste);
}

/**
 * Gère l'événement paste et détecte les données sensibles.
 *
 * @param event - Événement ClipboardEvent
 */
function handlePaste(event: ClipboardEvent): void {
  const text = event.clipboardData?.getData('text/plain');
  if (!text || text.length === 0) return;

  const detectedType = detectSensitiveType(text);
  if (!detectedType) return;

  // Masquage de l'extrait pour l'affichage dans le toast (jamais le contenu complet)
  const previewMasked = maskContent(text, detectedType);

  void notifyServiceWorker(detectedType, previewMasked);
}

/**
 * Détecte le type de données sensibles dans le texte.
 *
 * @param text - Texte collé
 * @returns Type détecté ou null
 */
function detectSensitiveType(text: string): 'iban' | 'card' | 'api_key' | null {
  if (SENSITIVE_PATTERNS.iban.test(text)) return 'iban';
  if (SENSITIVE_PATTERNS.card.test(text)) return 'card';
  if (SENSITIVE_PATTERNS.api_key.test(text)) return 'api_key';
  return null;
}

/**
 * Masque un contenu sensible pour l'affichage dans le toast.
 *
 * @param text - Contenu à masquer
 * @param type - Type de données détectées
 * @returns Extrait masqué (ex: "FR76****1234" pour un IBAN)
 */
function maskContent(text: string, type: 'iban' | 'card' | 'api_key'): string {
  const trimmed = text.trim();
  const last4 = trimmed.slice(-4);
  const prefix = type === 'iban' ? trimmed.slice(0, 4) : type === 'card' ? '••••' : '****';
  return `${prefix}****${last4}`;
}

/**
 * Notifie le service worker de la détection et déclenche la nullification.
 *
 * @param type          - Type de données détectées
 * @param previewMasked - Extrait masqué pour le toast
 */
async function notifyServiceWorker(
  type: 'iban' | 'card' | 'api_key',
  previewMasked: string,
): Promise<void> {
  const message = {
    module: 'M17' as const,
    action: 'sensitive_data_detected',
    payload: { type, preview_masked: previewMasked },
    timestamp: Date.now(),
  };

  try {
    await browser.runtime.sendMessage(message);
  } catch {
    // SW endormi — silencieux
  }
}

initPasteDetector();
