/**
 * @file pages/options/options.ts
 * @description Script de la page de configuration Sentinel Nudge.
 *
 * La page Options expose :
 * - Activation/désactivation de chaque module
 * - Choix du quota journalier (3, 5, 10, Tous)
 * - Choix du profil (débutant, intermédiaire, avancé)
 * - Droit d'effacement RGPD (Art. 17) : bouton "Supprimer toutes mes données"
 * - Droit à la portabilité RGPD (Art. 20) : bouton "Exporter mes données"
 * - Réinitialisation de la whitelist M2
 * - Section Transparence radicale (documentation des risques D-SEC-004)
 *
 * Référence : DAT §3.1 (Options Page), §8.3 (droits RGPD), §9.4 (D-SEC-004)
 */

import { browser } from '@/shared/browser/browser-adapter';

/**
 * Initialise la page Options au chargement du DOM.
 */
function initOptions(): void {
  const root = document.getElementById('options-root');
  if (!root) return;

  const title = document.createElement('h1');
  title.textContent = browser.i18n.getMessage('extension_name') || 'Sentinel Nudge';
  root.appendChild(title);

  // TODO(P4-OPTIONS) : charger la config depuis le SW et rendre les formulaires
  // - Module toggles
  // - Quota selector
  // - Profile selector
  // - RGPD buttons (export, delete)
}

document.addEventListener('DOMContentLoaded', initOptions);
