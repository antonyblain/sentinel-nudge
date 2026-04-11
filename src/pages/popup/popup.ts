/**
 * @file pages/popup/popup.ts
 * @description Script de la popup Sentinel Nudge.
 *
 * La popup affiche :
 * - Le score M3 de la semaine courante (ou un message d'accueil avant le premier calcul)
 * - L'état d'activation des modules
 * - Un lien rapide vers le dashboard
 *
 * Durée de vie : la fenêtre popup est détruite à sa fermeture.
 * Toutes les données sont lues depuis le service worker via chrome.runtime.sendMessage().
 *
 * Référence : DAT §3.1 (Popup), §3.3 (communication popup → SW)
 */

import { browser } from '@/shared/browser/browser-adapter';

/**
 * Initialise la popup au chargement du DOM.
 */
function initPopup(): void {
  const root = document.getElementById('popup-root');
  if (!root) return;

  // Affichage d'un état de chargement
  const loadingEl = document.createElement('p');
  loadingEl.textContent = browser.i18n.getMessage('extension_name') || 'Sentinel Nudge';
  loadingEl.setAttribute('aria-live', 'polite');
  root.appendChild(loadingEl);

  // TODO(P4-POPUP) : demander l'état au service worker et afficher le score M3
  // Message type : { module: 'M3', action: 'get_state', payload: {}, timestamp: Date.now() }
}

// Attendre le chargement du DOM
document.addEventListener('DOMContentLoaded', initPopup);
