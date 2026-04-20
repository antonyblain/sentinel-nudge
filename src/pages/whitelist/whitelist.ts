/**
 * @file pages/whitelist/whitelist.ts
 * @description Page standalone "Liste de confiance" — T-202.
 *
 * Affiche la whitelist M2 (domaines marqués comme de confiance par l'utilisateur).
 * Permet de retirer des entrées individuelles avec confirmation inline.
 *
 * Fonctionnalités :
 * - Chargement depuis chrome.storage.local (`m2_whitelist`) via le SW
 * - Affichage paginé (PAGE_SIZE = 50) trié par date d'ajout décroissante
 * - Filtre client-side par domaine (recherche textuelle)
 * - Action "Retirer" par entrée : confirmation inline → suppression storage + IDB + log
 * - i18n via browser.i18n.getMessage (clés `whitelist_*`)
 *
 * Accessibilité :
 * - Landmark main, h1, section labelisée
 * - Boutons nommés explicitement (aria-label)
 * - Live region pour annonces a11y lors des suppressions
 * - Focus visible (tokens.css), contraste WCAG 2.2 AA
 * - Skip link vers le contenu principal
 *
 * Sécurité :
 * - D-SEC-003 : Aucun innerHTML — tout DOM via createElement/textContent/appendChild
 * - Les domaines sont affichés directement (c'est l'utilisateur qui les a ajoutés)
 *
 * Référence : SFD §3.4 (M2 whitelist), DAT §8.1 (IDB whitelist store)
 */

import { browser } from '@/shared/browser/browser-adapter';
import { initTheme, watchThemeChanges } from '@/shared/utils/apply-theme';
import { createLogger, Logger } from '@/shared/utils/logger';

/** Logger scopé — Whitelist page */
const logger = createLogger('WhitelistPage');

/** Nombre d'entrées affichées par page */
const PAGE_SIZE = 50;

/**
 * Entrée affichable de la whitelist.
 * Contient le domaine en clair (non le hash — stocké ici pour l'affichage).
 */
interface WhitelistDisplayEntry {
  /** Domaine en clair (stocké dans m2_whitelist de chrome.storage.local) */
  domain: string;
  /** Timestamp Date.now() de l'ajout */
  added_at: number;
}

/**
 * Réponse du SW pour la lecture de la whitelist M2.
 */
interface GetM2WhitelistResponse {
  success: boolean;
  whitelist?: WhitelistDisplayEntry[];
  error?: string;
}

/**
 * Réponse du SW pour la suppression d'une entrée whitelist.
 */
interface RemoveM2WhitelistResponse {
  success: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// État de la page
// ---------------------------------------------------------------------------

/** Toutes les entrées chargées depuis le storage */
let allEntries: WhitelistDisplayEntry[] = [];
/** Entrées actuellement filtrées par la recherche */
let filteredEntries: WhitelistDisplayEntry[] = [];
/** Page courante (0-based) */
let currentPage = 0;

// ---------------------------------------------------------------------------
// Chargement des données
// ---------------------------------------------------------------------------

/**
 * Charge la whitelist M2 depuis chrome.storage.local via le Service Worker.
 * Tente d'abord via le SW (action `get_m2_whitelist`) puis fallback direct storage.
 *
 * @returns Tableau d'entrées triées par date décroissante
 */
async function loadWhitelist(): Promise<WhitelistDisplayEntry[]> {
  // Tentative via SW
  try {
    const response = (await browser.runtime.sendMessage({
      module: 'WHITELIST',
      action: 'get_m2_whitelist',
      payload: {},
      timestamp: Date.now(),
    })) as GetM2WhitelistResponse | undefined;

    if (response?.success && Array.isArray(response.whitelist)) {
      return [...response.whitelist].sort((a, b) => b.added_at - a.added_at);
    }
  } catch (err: unknown) {
    logger.warn('WhitelistPage: SW get_m2_whitelist indisponible, fallback storage direct', {
      error_name: Logger.errorName(err),
    });
  }

  // Fallback : lecture directe chrome.storage.local
  try {
    const data = await browser.storage.local.get(['m2_whitelist']);
    const stored = (data['m2_whitelist'] as WhitelistDisplayEntry[] | undefined) ?? [];
    return [...stored].sort((a, b) => b.added_at - a.added_at);
  } catch (err: unknown) {
    logger.error('WhitelistPage: échec chargement whitelist storage direct', {
      error_name: Logger.errorName(err),
    });
    return [];
  }
}

/**
 * Supprime une entrée de la whitelist M2.
 * Notifie le SW pour synchronisation IDB + log `whitelist_remove`.
 *
 * @param domain - Domaine à retirer
 * @returns true si succès
 */
async function removeWhitelistEntry(domain: string): Promise<boolean> {
  // Tentative via SW (synchronise IDB + log diagnostics)
  try {
    const response = (await browser.runtime.sendMessage({
      module: 'WHITELIST',
      action: 'remove_m2_whitelist',
      payload: { domain },
      timestamp: Date.now(),
    })) as RemoveM2WhitelistResponse | undefined;

    if (response?.success) {
      logger.info('WhitelistPage: entrée retirée via SW', { action: 'whitelist_remove' });
      return true;
    }
  } catch (err: unknown) {
    logger.warn('WhitelistPage: SW remove_m2_whitelist indisponible, fallback storage direct', {
      error_name: Logger.errorName(err),
    });
  }

  // Fallback : suppression directe chrome.storage.local
  try {
    const data = await browser.storage.local.get(['m2_whitelist']);
    const stored = (data['m2_whitelist'] as WhitelistDisplayEntry[] | undefined) ?? [];
    const updated = stored.filter((e) => e.domain !== domain);
    await browser.storage.local.set({ m2_whitelist: updated });
    logger.info('WhitelistPage: entrée retirée via storage direct (fallback)', {
      action: 'whitelist_remove',
    });
    return true;
  } catch (err: unknown) {
    logger.error('WhitelistPage: échec suppression whitelist', {
      error_name: Logger.errorName(err),
    });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Utilitaires UI
// ---------------------------------------------------------------------------

/**
 * Affiche un message i18n dans un élément, avec fallback sur le texte brut.
 *
 * @param key      - Clé i18n
 * @param fallback - Texte de secours si la clé est absente
 * @returns Texte résolu
 */
function t(key: string, fallback: string): string {
  return browser.i18n.getMessage(key) || fallback;
}

/**
 * Formate un timestamp Date.now() en date locale lisible.
 *
 * @param ts - Timestamp milliseconds
 * @returns Chaîne de date localisée
 */
function formatDate(ts: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

/**
 * Affiche un toast de notification temporaire.
 *
 * @param message  - Texte affiché
 * @param variant  - 'success' ou 'error'
 */
function showToast(message: string, variant: 'success' | 'error'): void {
  const existingToast = document.getElementById('wl-toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.id = 'wl-toast';
  toast.className = `wl-toast wl-toast-${variant}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('wl-toast-visible');
  });

  setTimeout(() => {
    toast.classList.remove('wl-toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

/**
 * Met à jour la live region pour les annonces accessibles.
 *
 * @param message - Message à annoncer
 */
function announceToScreenReader(message: string): void {
  const region = document.getElementById('wl-live-region');
  if (region) {
    region.textContent = '';
    // Délai minimal pour forcer la re-lecture par les lecteurs d'écran
    setTimeout(() => {
      region.textContent = message;
    }, 50);
  }
}

// ---------------------------------------------------------------------------
// Rendu de la liste
// ---------------------------------------------------------------------------

/**
 * Calcule la tranche d'entrées pour la page courante.
 *
 * @param entries - Toutes les entrées filtrées
 * @param page    - Page courante (0-based)
 * @returns Tranche d'entrées pour cette page
 */
export function getPageSlice(
  entries: WhitelistDisplayEntry[],
  page: number,
): WhitelistDisplayEntry[] {
  const start = page * PAGE_SIZE;
  return entries.slice(start, start + PAGE_SIZE);
}

/**
 * Calcule le nombre total de pages.
 *
 * @param totalEntries - Nombre total d'entrées filtrées
 * @returns Nombre de pages (minimum 1)
 */
export function getTotalPages(totalEntries: number): number {
  return Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
}

/**
 * Crée la ligne d'une entrée whitelist avec son bouton Retirer et confirmation inline.
 *
 * @param entry       - Entrée à afficher
 * @param onRemoved   - Callback appelé après suppression effective
 * @returns Élément li de la liste
 */
function createEntryItem(
  entry: WhitelistDisplayEntry,
  onRemoved: (domain: string) => void,
): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'wl-item';

  // Informations domaine
  const info = document.createElement('div');
  info.className = 'wl-item-info';

  const domainEl = document.createElement('span');
  domainEl.className = 'wl-item-domain';
  domainEl.textContent = entry.domain;

  const dateEl = document.createElement('span');
  dateEl.className = 'wl-item-date';
  dateEl.textContent = formatDate(entry.added_at);

  info.appendChild(domainEl);
  info.appendChild(dateEl);
  li.appendChild(info);

  // Bouton "Retirer"
  const btnRemove = document.createElement('button');
  btnRemove.type = 'button';
  btnRemove.className = 'wl-btn-remove';
  btnRemove.textContent = t('whitelist_remove_button', 'Retirer');
  btnRemove.setAttribute(
    'aria-label',
    `${t('whitelist_remove_button', 'Retirer')} ${entry.domain}`,
  );

  // Zone de confirmation inline (cachée par défaut)
  const confirmZone = document.createElement('div');
  confirmZone.className = 'wl-confirm';
  confirmZone.style.display = 'none';
  confirmZone.setAttribute('role', 'group');
  confirmZone.setAttribute(
    'aria-label',
    `${t('whitelist_confirm_remove', 'Confirmer la suppression de')} ${entry.domain}`,
  );

  const confirmText = document.createElement('span');
  confirmText.className = 'wl-confirm-text';
  confirmText.textContent = t('whitelist_confirm_remove', 'Confirmer ?');
  confirmText.setAttribute('aria-hidden', 'true');

  const btnYes = document.createElement('button');
  btnYes.type = 'button';
  btnYes.className = 'wl-btn-confirm-yes';
  btnYes.textContent = t('whitelist_confirm_yes', 'Oui');
  btnYes.setAttribute(
    'aria-label',
    `${t('whitelist_confirm_yes', 'Confirmer la suppression de')} ${entry.domain}`,
  );

  const btnNo = document.createElement('button');
  btnNo.type = 'button';
  btnNo.className = 'wl-btn-confirm-no';
  btnNo.textContent = t('whitelist_confirm_no', 'Annuler');
  btnNo.setAttribute('aria-label', t('whitelist_confirm_no', 'Annuler la suppression'));

  confirmZone.appendChild(confirmText);
  confirmZone.appendChild(btnYes);
  confirmZone.appendChild(btnNo);

  // Logique d'interaction
  btnRemove.addEventListener('click', () => {
    btnRemove.style.display = 'none';
    confirmZone.style.display = 'flex';
    btnNo.focus();
  });

  btnNo.addEventListener('click', () => {
    confirmZone.style.display = 'none';
    btnRemove.style.display = '';
    btnRemove.focus();
  });

  btnYes.addEventListener('click', () => {
    btnYes.disabled = true;
    btnNo.disabled = true;

    removeWhitelistEntry(entry.domain)
      .then((success) => {
        if (success) {
          onRemoved(entry.domain);
          showToast(
            `${t('whitelist_removed_success', 'Domaine retiré :')} ${entry.domain}`,
            'success',
          );
          announceToScreenReader(
            `${t('whitelist_removed_success', 'Domaine retiré :')} ${entry.domain}`,
          );
        } else {
          showToast(t('whitelist_remove_error', 'Erreur lors de la suppression.'), 'error');
          btnYes.disabled = false;
          btnNo.disabled = false;
          confirmZone.style.display = 'none';
          btnRemove.style.display = '';
          btnRemove.focus();
        }
      })
      .catch(() => {
        showToast(t('whitelist_remove_error', 'Erreur lors de la suppression.'), 'error');
      });
  });

  li.appendChild(btnRemove);
  li.appendChild(confirmZone);

  return li;
}

/**
 * Reconstruit le bloc liste + pagination à partir de l'état courant.
 *
 * @param listContainer  - Conteneur de la liste ul
 * @param paginationEl   - Conteneur de la pagination
 * @param countEl        - Élément du compteur d'entrées
 */
function renderList(
  listContainer: HTMLElement,
  paginationEl: HTMLElement,
  countEl: HTMLElement,
): void {
  // Mise à jour du compteur
  const total = filteredEntries.length;
  countEl.textContent =
    total === 0
      ? ''
      : `${total} ${total === 1 ? t('whitelist_entry_singular', 'domaine') : t('whitelist_entry_plural', 'domaines')}`;

  // Vider la liste
  while (listContainer.firstChild) {
    listContainer.removeChild(listContainer.firstChild);
  }

  if (total === 0) {
    const emptyEl = document.createElement('p');
    emptyEl.className = 'wl-empty';
    emptyEl.textContent = t('whitelist_empty', 'Aucun domaine de confiance enregistré.');
    listContainer.appendChild(emptyEl);
    // Vider pagination
    while (paginationEl.firstChild) paginationEl.removeChild(paginationEl.firstChild);
    return;
  }

  // Clamp la page courante si nécessaire
  const totalPages = getTotalPages(total);
  if (currentPage >= totalPages) currentPage = totalPages - 1;

  // Créer la liste ul
  const ul = document.createElement('ul');
  ul.className = 'wl-list';
  ul.setAttribute('aria-label', t('whitelist_list_label', 'Domaines de confiance'));

  const slice = getPageSlice(filteredEntries, currentPage);
  for (const entry of slice) {
    const li = createEntryItem(entry, (removedDomain) => {
      // Mettre à jour les deux tableaux (allEntries et filteredEntries)
      allEntries = allEntries.filter((e) => e.domain !== removedDomain);
      filteredEntries = filteredEntries.filter((e) => e.domain !== removedDomain);
      renderList(listContainer, paginationEl, countEl);
    });
    ul.appendChild(li);
  }
  listContainer.appendChild(ul);

  // Mise à jour de la pagination
  renderPagination(paginationEl, totalPages);
}

/**
 * Construit les contrôles de pagination.
 *
 * @param paginationEl - Conteneur de la pagination
 * @param totalPages   - Nombre total de pages
 */
function renderPagination(paginationEl: HTMLElement, totalPages: number): void {
  while (paginationEl.firstChild) paginationEl.removeChild(paginationEl.firstChild);

  if (totalPages <= 1) return;

  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', t('whitelist_pagination_label', 'Navigation par pages'));

  const btnPrev = document.createElement('button');
  btnPrev.type = 'button';
  btnPrev.className = 'wl-btn-page';
  btnPrev.textContent = t('whitelist_pagination_previous', 'Précédent');
  btnPrev.disabled = currentPage === 0;
  btnPrev.setAttribute('aria-label', t('whitelist_pagination_previous', 'Page précédente'));

  const info = document.createElement('span');
  info.className = 'wl-pagination-info';
  info.textContent = `${currentPage + 1} / ${totalPages}`;
  info.setAttribute('aria-current', 'page');

  const btnNext = document.createElement('button');
  btnNext.type = 'button';
  btnNext.className = 'wl-btn-page';
  btnNext.textContent = t('whitelist_pagination_next', 'Suivant');
  btnNext.disabled = currentPage >= totalPages - 1;
  btnNext.setAttribute('aria-label', t('whitelist_pagination_next', 'Page suivante'));

  // Les listeners sont injectés au niveau supérieur car ils dépendent du rendu global
  // (listContainer et countEl sont dans la portée de renderPage)
  btnPrev.dataset['action'] = 'prev';
  btnNext.dataset['action'] = 'next';

  nav.appendChild(btnPrev);
  nav.appendChild(info);
  nav.appendChild(btnNext);
  paginationEl.appendChild(nav);
}

// ---------------------------------------------------------------------------
// Initialisation de la page
// ---------------------------------------------------------------------------

/**
 * Point d'entrée principal — initialise la page après chargement du DOM.
 *
 * @returns Promesse résolue quand la page est initialisée
 */
async function initPage(): Promise<void> {
  const root = document.getElementById('whitelist-main');
  if (!root) return;

  // Thème (suit la config comme les autres pages)
  await initTheme();
  watchThemeChanges();

  // Live region pour a11y
  const liveRegion = document.createElement('div');
  liveRegion.id = 'wl-live-region';
  liveRegion.className = 'wl-live-region';
  liveRegion.setAttribute('aria-live', 'assertive');
  liveRegion.setAttribute('aria-atomic', 'true');
  document.body.appendChild(liveRegion);

  // En-tête
  const header = document.createElement('header');
  header.className = 'wl-header';

  const backLink = document.createElement('a');
  backLink.className = 'wl-back-link';
  backLink.href = browser.runtime.getURL('pages/options/options.html');
  backLink.textContent = `\u2190 ${t('whitelist_back_to_settings', 'Retour aux paramètres')}`;
  header.appendChild(backLink);

  const h1 = document.createElement('h1');
  h1.id = 'whitelist-heading';
  h1.className = 'wl-title';
  h1.textContent = t('whitelist_title', 'Liste de confiance');
  header.appendChild(h1);

  const subtitle = document.createElement('p');
  subtitle.className = 'wl-subtitle';
  subtitle.textContent = t(
    'whitelist_subtitle',
    'Domaines que vous avez marqués comme de confiance. Vous pouvez en retirer à tout moment.',
  );
  header.appendChild(subtitle);

  root.appendChild(header);

  // Indicateur de chargement
  const loadingEl = document.createElement('p');
  loadingEl.textContent = t('whitelist_loading', 'Chargement de la liste…');
  loadingEl.setAttribute('aria-live', 'polite');
  root.appendChild(loadingEl);

  // Chargement asynchrone
  try {
    allEntries = await loadWhitelist();
    filteredEntries = [...allEntries];
  } catch (err: unknown) {
    logger.error('WhitelistPage: échec init', { error_name: Logger.errorName(err) });
    allEntries = [];
    filteredEntries = [];
  }

  // Supprimer l'indicateur de chargement
  root.removeChild(loadingEl);

  // Section recherche
  const searchSection = document.createElement('section');
  searchSection.className = 'wl-search-section';
  searchSection.setAttribute('aria-label', t('whitelist_search_section_label', 'Recherche'));

  const searchLabelEl = document.createElement('label');
  searchLabelEl.htmlFor = 'wl-search';
  searchLabelEl.className = 'wl-search-label';
  searchLabelEl.textContent = t('whitelist_search_label', 'Filtrer par domaine');
  searchSection.appendChild(searchLabelEl);

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.id = 'wl-search';
  searchInput.className = 'wl-search-input';
  searchInput.placeholder = t('whitelist_search_placeholder', 'ex: example.com');
  searchInput.setAttribute('aria-controls', 'wl-list-container');
  searchSection.appendChild(searchInput);

  root.appendChild(searchSection);

  // Compteur d'entrées
  const countEl = document.createElement('p');
  countEl.className = 'wl-count';
  countEl.setAttribute('aria-live', 'polite');
  root.appendChild(countEl);

  // Conteneur liste
  const listContainer = document.createElement('div');
  listContainer.id = 'wl-list-container';
  root.appendChild(listContainer);

  // Pagination
  const paginationEl = document.createElement('div');
  paginationEl.className = 'wl-pagination';
  root.appendChild(paginationEl);

  // Délégation des clics de pagination (event delegation)
  paginationEl.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest<HTMLButtonElement>('button[data-action]');
    if (!btn || btn.disabled) return;

    const action = btn.dataset['action'];
    const totalPages = getTotalPages(filteredEntries.length);

    if (action === 'prev' && currentPage > 0) {
      currentPage--;
      renderList(listContainer, paginationEl, countEl);
    } else if (action === 'next' && currentPage < totalPages - 1) {
      currentPage++;
      renderList(listContainer, paginationEl, countEl);
    }
  });

  // Filtre de recherche (debounce 200ms)
  let searchTimeout: ReturnType<typeof setTimeout> | undefined;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const query = searchInput.value.trim().toLowerCase();
      filteredEntries = query
        ? allEntries.filter((e) => e.domain.toLowerCase().includes(query))
        : [...allEntries];
      currentPage = 0;
      renderList(listContainer, paginationEl, countEl);
    }, 200);
  });

  // Premier rendu
  renderList(listContainer, paginationEl, countEl);
}

// Démarrage
document.addEventListener('DOMContentLoaded', () => {
  initPage().catch((err: unknown) => {
    logger.error('WhitelistPage: erreur init DOMContentLoaded', {
      error_name: Logger.errorName(err),
    });
  });
});
