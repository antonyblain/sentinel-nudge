/**
 * @file shared/utils/apply-theme.ts
 * @description Utilitaire d'application du thème de l'interface (TACHE-148).
 *
 * Applique `data-theme` sur `<html>` avant tout rendu pour éviter le FOUC
 * (Flash Of Unstyled Content). Doit être appelé en tout premier dans chaque
 * entry point de page (popup, options, dashboard, onboarding).
 *
 * Valeurs stockées :
 *   'auto'   → ne pas modifier document.documentElement.dataset.theme
 *              (CSS gère via @media prefers-color-scheme)
 *   'light'  → document.documentElement.dataset.theme = 'light'
 *   'dark'   → document.documentElement.dataset.theme = 'dark'
 *   'matrix' → document.documentElement.dataset.theme = 'matrix'
 *
 * Écoute également chrome.storage.onChanged pour appliquer dynamiquement
 * les changements effectués depuis la page Options.
 *
 * Sécurité :
 * - D-SEC-003 : aucun innerHTML, pas d'eval, valeur whitélistée avant application.
 *
 * Référence : TACHE-148 (apply data-theme), TACHE-147 (sélecteur options)
 */

import { browser } from '@/shared/browser/browser-adapter';

/** Valeurs autorisées pour data-theme (whitelist de sécurité). */
const ALLOWED_THEMES = new Set(['light', 'dark', 'matrix']);

/**
 * Applique la valeur `data-theme` sur l'élément `<html>`.
 *
 * @param theme - Valeur lue depuis chrome.storage.local (clé 'theme')
 */
function applyThemeToDocument(theme: unknown): void {
  if (typeof theme !== 'string') return;
  if (ALLOWED_THEMES.has(theme)) {
    document.documentElement.dataset['theme'] = theme;
  } else {
    // 'auto' ou valeur inconnue : retirer data-theme (laisse prefers-color-scheme agir)
    delete document.documentElement.dataset['theme'];
  }
}

/**
 * Lit le thème depuis chrome.storage.local et l'applique immédiatement
 * sur `document.documentElement` (avant le premier rendu).
 *
 * Cette fonction est async mais son appelant n'a pas besoin d'awaiter :
 * l'application du theme est best-effort pour éviter FOUC.
 *
 * @returns Promise<void>
 */
export async function initTheme(): Promise<void> {
  try {
    const result = await browser.storage.local.get('theme');
    applyThemeToDocument(result['theme']);
  } catch {
    // Pas de log — erreur silencieuse pour ne pas bloquer le rendu de la page
  }
}

/**
 * Installe un écouteur sur chrome.storage.onChanged pour appliquer
 * dynamiquement le changement de thème sans rechargement de page.
 *
 * À appeler une seule fois après le chargement du DOM.
 */
export function watchThemeChanges(): void {
  browser.storage.onChanged.addListener(
    (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local') return;
      if (!('theme' in changes)) return;
      applyThemeToDocument(changes['theme']?.newValue);
    },
  );
}
