/**
 * @file utils/sanitize.ts
 * @description Fonctions d'insertion sécurisée dans le DOM (D-SEC-003).
 *
 * Conformément à D-SEC-003, innerHTML, outerHTML et insertAdjacentHTML sont
 * totalement interdits dans la codebase. Toute insertion de contenu utilise
 * exclusivement textContent, createElement et appendChild.
 *
 * Ces fonctions utilitaires facilitent la construction sûre d'éléments DOM
 * dans les composants Shadow DOM des content scripts.
 *
 * Référence : DAT §9.3 (D-SEC-003 — Sanitisation et intégrité du DOM)
 */

/**
 * Crée un élément HTML avec du texte sûr.
 *
 * Utilise textContent pour assigner le texte — aucune interprétation HTML.
 * Toute tentative d'injection XSS via le texte est neutralisée.
 *
 * @param tag  - Balise HTML (ex: 'div', 'span', 'button', 'p')
 * @param text - Texte à insérer (sera encodé, jamais interprété comme HTML)
 * @returns L'élément créé avec son contenu textuel
 *
 * @example
 * const title = createSafeElement('h2', browser.i18n.getMessage('m2_overlay_title'));
 * shadowRoot.appendChild(title);
 */
export function createSafeElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.textContent = text;
  return el;
}

/**
 * Ajoute un nœud texte sûr à un élément parent existant.
 *
 * Utilise createTextNode — le texte est toujours traité comme du texte brut,
 * jamais comme du HTML.
 *
 * @param parent - Élément parent auquel ajouter le texte
 * @param text   - Texte à ajouter (sera encodé, jamais interprété comme HTML)
 *
 * @example
 * const p = document.createElement('p');
 * appendSafeText(p, 'Domaine détecté : ');
 * appendSafeText(p, domain); // domain = chaîne potentiellement non fiable
 * container.appendChild(p);
 */
export function appendSafeText(parent: HTMLElement, text: string): void {
  const textNode = document.createTextNode(text);
  parent.appendChild(textNode);
}
