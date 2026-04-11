/**
 * @file pages/dashboard/dashboard.ts
 * @description Script du tableau de bord Sentinel Nudge.
 *
 * Le dashboard affiche :
 * - Historique SVG des scores M3 sur 52 semaines (avec table sr-only pour accessibilité)
 * - Résultats des quiz M6
 * - Statistiques des nudges par module
 *
 * Accessibilité :
 * - SVG annoté avec role="img" + <title> + <desc> (DAT §11.5)
 * - Table sr-only exposant les 52 valeurs aux technologies d'assistance
 *
 * Le dashboard lit IndexedDB directement (sans passer par le SW) pour les lectures
 * volumineuses (52 semaines), conformément à l'architecture DAT §3.2.
 *
 * Référence : DAT §3.1 (Dashboard), §11.5 (accessibilité graphiques SVG)
 */

import { browser } from '@/shared/browser/browser-adapter';

/**
 * Initialise le tableau de bord au chargement du DOM.
 */
function initDashboard(): void {
  const root = document.getElementById('dashboard-root');
  if (!root) return;

  const title = document.createElement('h1');
  title.textContent = browser.i18n.getMessage('extension_name') || 'Sentinel Nudge';
  root.appendChild(title);

  // TODO(P4-DASHBOARD) : lire les weekly_scores depuis IndexedDB et rendre le graphique SVG
  // - Graphique SVG 52 semaines avec role="img" + title + desc (DAT §11.5)
  // - Table sr-only avec les 52 valeurs
  // - Section quiz M6 (résultats quiz_sessions)
}

document.addEventListener('DOMContentLoaded', initDashboard);
