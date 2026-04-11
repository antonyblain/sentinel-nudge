/**
 * @file pages/onboarding/onboarding.ts
 * @description Script d'onboarding obligatoire au premier lancement de Sentinel Nudge.
 *
 * L'onboarding comporte 4 étapes :
 * 1. Présentation de l'extension (ce qu'elle fait, privacy by design)
 * 2. Choix des modules à activer (avec descriptions)
 * 3. Consentement explicite M7 (opt-in hash mots de passe — RGPD Art. 6.1.a)
 * 4. Choix du profil et du quota
 *
 * À la complétion, `onboarding_complete: true` est écrit dans chrome.storage.local
 * et la popup est désormais fonctionnelle.
 *
 * Accessibilité :
 * - Navigation par étapes avec indicateur de progression visible
 * - Focus géré explicitement entre les étapes
 *
 * Référence : DAT §3.1 (Onboarding), §8.1 (bases légales RGPD — M7 consentement)
 */

import { browser } from '@/shared/browser/browser-adapter';

/**
 * Initialise l'onboarding au chargement du DOM.
 */
function initOnboarding(): void {
  const root = document.getElementById('onboarding-root');
  if (!root) return;

  const title = document.createElement('h1');
  title.textContent = browser.i18n.getMessage('extension_name') || 'Sentinel Nudge';
  root.appendChild(title);

  // TODO(P4-ONBOARDING) : implémenter les 4 étapes d'onboarding
  // Étape 1 : Présentation + privacy by design
  // Étape 2 : Choix des modules (checkboxes)
  // Étape 3 : Consentement M7 (opt-in explicite RGPD)
  // Étape 4 : Profil + quota
  // Finalisation : setConfig({ onboarding_complete: true })
}

document.addEventListener('DOMContentLoaded', initOnboarding);
