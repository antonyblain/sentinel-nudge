/**
 * @file content-scripts/detectors/password-detector.ts
 * @description Détecteur de champs mot de passe dans les pages web (modules M2, M7, M9).
 *
 * Ce content script est injecté dynamiquement via scripting.executeScript()
 * uniquement si M2, M7 ou M9 est activé dans la configuration.
 *
 * Écoute :
 * - `focusin` sur input[type=password] → déclenche RiskAnalyzer + envoie message au SW
 * - `blur` sur input[type=password] → fin d'interaction
 *
 * Sécurité :
 * - Le mot de passe en clair n'est JAMAIS envoyé au service worker
 * - Seul le hash SHA-256(salt + password) est transmis pour M7
 * - Le sel est lu depuis chrome.storage.local (installation_salt)
 *
 * Référence : DAT §6.2 (flux M2/M7/M9), §9.4 (D-SEC-001 hash salé)
 */

import { browser } from '@/shared/browser/browser-adapter';

/**
 * Initialise le détecteur de champs mot de passe.
 * Appelé une seule fois à l'injection du content script.
 */
function initPasswordDetector(): void {
  document.addEventListener('focusin', handleFocusIn);
}

/**
 * Gère le focus entrant sur un élément de la page.
 *
 * @param event - Événement focusin
 */
function handleFocusIn(event: FocusEvent): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.type !== 'password') return;

  // TODO(P4-M2) : appeler RiskAnalyzer pour analyser les signaux du domaine courant
  // TODO(P4-M7) : envoyer le hash du mot de passe au SW après blur
  // TODO(P4-M9) : attacher un listener input pour zxcvbn en temps réel

  void sendPasswordFocusEvent();
}

/**
 * Envoie un signal de détection de champ mot de passe au service worker.
 * Le domaine courant est hashé côté content script (D-SEC-001).
 */
async function sendPasswordFocusEvent(): Promise<void> {
  // TODO(P4-M2) : récupérer le sel d'installation et hasher le domaine
  // Pour l'instant : squelette fonctionnel qui prouve la communication CS → SW
  const message = {
    module: 'M2' as const,
    action: 'password_field_focused',
    payload: {
      signals: [] as string[],
      domain_hash: 'placeholder_hash', // TODO(P4-M2) : SHA-256(salt + location.hostname)
    },
    timestamp: Date.now(),
  };

  try {
    await browser.runtime.sendMessage(message);
  } catch {
    // Le SW peut être endormi — l'échec est silencieux (non bloquant pour l'utilisateur)
  }
}

// Démarrage du détecteur
initPasswordDetector();
