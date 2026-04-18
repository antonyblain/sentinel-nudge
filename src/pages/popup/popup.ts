/**
 * @file pages/popup/popup.ts
 * @description Script de la popup Sentinel Nudge.
 *
 * La popup affiche :
 * - Le score M3 de la semaine courante (ou message "Premier score lundi" avant le premier calcul)
 * - L'état d'activation des modules (X/7 actifs)
 * - Le quota du jour (nudges restants)
 * - Un bouton "Voir le détail" qui ouvre le dashboard
 * - Un bouton "Paramètres" qui ouvre la page Options
 *
 * Technique :
 * - Envoie {module: 'M3', action: 'get_state'} au SW pour récupérer le score courant
 * - Envoie {module: 'M3', action: 'get_quota'} pour récupérer le quota restant
 * - Lecture de la config depuis chrome.storage.local pour le nombre de modules actifs
 *
 * Accessibilité :
 * - Structure sémantique h1, sections, aria-labels
 * - Score exprimé via aria-label avec valeur textuelle
 * - Taille : 320px × ~400px (CSS fixe width)
 *
 * Sécurité :
 * - D-SEC-003 : Aucun innerHTML. Tout DOM via createElement/textContent/appendChild.
 *
 * Référence : DAT §3.1 (Popup), SFD §3.5, DAT §11.4 (design system)
 */

import { browser } from '@/shared/browser/browser-adapter';
import { MODULE_IDS } from '@/shared/constants/modules';
import { initTheme, watchThemeChanges } from '@/shared/utils/apply-theme';

/** Nombre total de modules v1 (7). Rattache a MODULE_IDS pour eviter la desync en v2. */
const TOTAL_MODULES_V1 = MODULE_IDS.length;

/** Score seuil vert (>= 70) */
const SCORE_GREEN_THRESHOLD = 70;

/** Score seuil orange (>= 40) */
const SCORE_ORANGE_THRESHOLD = 40;

/** SVG path du bouclier affiche dans le header (Material Design "security", viewBox 24x24) */
const ICON_HEADER_SHIELD = 'M12 2L4 5v6c0 5.25 3.5 10.15 8 11.35C16.5 21.15 20 16.25 20 11V5L12 2z';

/** SVG path de l'icone Modules (grille 2x2, viewBox 24x24) */
const ICON_STATUS_MODULES = 'M3 3h8v8H3zm0 10h8v8H3zm10-10h8v8h-8zm0 10h8v8h-8z';

/** SVG path de l'icone Quota (horloge, viewBox 24x24) */
const ICON_STATUS_QUOTA =
  'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z';

/**
 * Cree un SVG inline decoratif aria-hidden.
 * La couleur est heritee du parent via currentColor (fill="currentColor"),
 * ce qui permet la coherence automatique avec le dark/light mode.
 *
 * @param pathData - Donnee du path SVG (viewBox 0 0 24 24)
 * @param size     - Taille en px (defaut 16)
 * @returns Element SVGElement pret a inserer
 */
function createInlineIcon(pathData: string, size: number = 16): SVGElement {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  const p = document.createElementNS(svgNS, 'path');
  p.setAttribute('d', pathData);
  svg.appendChild(p);
  return svg;
}

/**
 * Calcule la date du prochain lundi à partir d'aujourd'hui.
 *
 * @returns Date du prochain lundi au format lisible (ex: "lundi 14 avril")
 */
function getNextMonday(): string {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = dimanche, 1 = lundi, ..., 6 = samedi
  const daysUntilMonday = dayOfWeek === 1 ? 7 : (8 - dayOfWeek) % 7;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  return nextMonday.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * Détermine la couleur CSS selon le score M3.
 *
 * @param score - Score entre 0 et 100
 * @returns Couleur CSS (variable CSS token)
 */
function scoreColor(score: number): string {
  if (score >= SCORE_GREEN_THRESHOLD) return 'var(--sn-color-success)';
  if (score >= SCORE_ORANGE_THRESHOLD) return 'var(--sn-color-warning)';
  return 'var(--sn-color-danger)';
}

/**
 * Détermine le niveau textuel du score pour le lecteur d'écran.
 *
 * @param score - Score entre 0 et 100
 * @returns Niveau textuel (Bon / Moyen / Faible)
 */
function scoreLevelLabel(score: number): string {
  if (score >= SCORE_GREEN_THRESHOLD) return browser.i18n.getMessage('score_level_high') || 'Bon';
  if (score >= SCORE_ORANGE_THRESHOLD)
    return browser.i18n.getMessage('score_level_medium') || 'Moyen';
  return browser.i18n.getMessage('score_level_low') || 'Faible';
}

/**
 * Construit et insère la section score M3 dans le conteneur donné.
 * Affiche soit le score avec jauge colorée, soit un message "Premier score lundi".
 *
 * @param container - Élément parent où insérer la section
 * @param score     - Score entre 0 et 100, ou null si aucun score disponible
 */
function renderScoreSection(container: HTMLElement, score: number | null): void {
  const section = document.createElement('section');
  section.setAttribute('aria-label', browser.i18n.getMessage('popup_score_label') || 'Score');

  const heading = document.createElement('h2');
  heading.className = 'section-title';
  heading.textContent = browser.i18n.getMessage('popup_score_label') || 'Score de cyber-hygiène';
  section.appendChild(heading);

  if (score === null) {
    // État initial : avant le premier lundi
    const noDataDiv = document.createElement('div');
    noDataDiv.className = 'score-no-data';

    const noDataLabel = document.createElement('p');
    noDataLabel.className = 'score-no-data-label';
    noDataLabel.textContent =
      browser.i18n.getMessage('popup_score_no_data') || 'Premier score lundi';
    noDataDiv.appendChild(noDataLabel);

    const nextDate = document.createElement('p');
    nextDate.className = 'score-no-data-date';
    const nextMondayStr = getNextMonday();
    nextDate.textContent =
      browser.i18n.getMessage('popup_score_first_monday', nextMondayStr) ||
      `Votre premier score sera calculé le ${nextMondayStr}`;
    noDataDiv.appendChild(nextDate);

    section.appendChild(noDataDiv);
  } else {
    // Jauge circulaire via SVG
    const gaugeWrapper = document.createElement('div');
    gaugeWrapper.className = 'score-gauge-wrapper';

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 120 120');
    svg.setAttribute('width', '120');
    svg.setAttribute('height', '120');
    svg.setAttribute('role', 'img');
    const levelLabel = scoreLevelLabel(score);
    svg.setAttribute('aria-label', `Score ${score}/100 — ${levelLabel}`);

    // Cercle de fond
    const bgCircle = document.createElementNS(svgNS, 'circle');
    bgCircle.setAttribute('cx', '60');
    bgCircle.setAttribute('cy', '60');
    bgCircle.setAttribute('r', '50');
    bgCircle.setAttribute('fill', 'none');
    bgCircle.setAttribute('stroke', 'var(--sn-color-border)');
    bgCircle.setAttribute('stroke-width', '12');
    svg.appendChild(bgCircle);

    // Cercle de progression
    const circumference = 2 * Math.PI * 50;
    const dashOffset = circumference * (1 - score / 100);
    const progressCircle = document.createElementNS(svgNS, 'circle');
    progressCircle.setAttribute('cx', '60');
    progressCircle.setAttribute('cy', '60');
    progressCircle.setAttribute('r', '50');
    progressCircle.setAttribute('fill', 'none');
    progressCircle.setAttribute('stroke', scoreColor(score));
    progressCircle.setAttribute('stroke-width', '12');
    progressCircle.setAttribute('stroke-linecap', 'round');
    progressCircle.setAttribute('stroke-dasharray', String(circumference));
    progressCircle.setAttribute('stroke-dashoffset', String(dashOffset));
    progressCircle.setAttribute('transform', 'rotate(-90 60 60)');
    svg.appendChild(progressCircle);

    // Texte score numérique
    const scoreText = document.createElementNS(svgNS, 'text');
    scoreText.setAttribute('x', '60');
    scoreText.setAttribute('y', '62');
    scoreText.setAttribute('text-anchor', 'middle');
    scoreText.setAttribute('dominant-baseline', 'middle');
    scoreText.setAttribute('font-size', '28');
    scoreText.setAttribute('font-weight', '600');
    scoreText.setAttribute('fill', scoreColor(score));
    scoreText.setAttribute('aria-hidden', 'true');
    scoreText.textContent = String(score);
    svg.appendChild(scoreText);

    // Texte /100
    const maxText = document.createElementNS(svgNS, 'text');
    maxText.setAttribute('x', '60');
    maxText.setAttribute('y', '82');
    maxText.setAttribute('text-anchor', 'middle');
    maxText.setAttribute('font-size', '12');
    maxText.setAttribute('fill', 'var(--sn-color-muted)');
    maxText.setAttribute('aria-hidden', 'true');
    maxText.textContent = '/100';
    svg.appendChild(maxText);

    gaugeWrapper.appendChild(svg);

    // Label niveau textuel
    const levelEl = document.createElement('p');
    levelEl.className = 'score-level';
    levelEl.style.color = scoreColor(score);
    levelEl.textContent = levelLabel;
    levelEl.setAttribute('aria-hidden', 'true');
    gaugeWrapper.appendChild(levelEl);

    section.appendChild(gaugeWrapper);
  }

  container.appendChild(section);
}

/**
 * Cree un label de statut avec icone SVG + texte (pattern KPI card).
 *
 * @param iconPath - SVG path de l'icone d'accompagnement (viewBox 24x24)
 * @param text     - Texte du label
 * @returns Element span.status-label
 */
function createStatusLabel(iconPath: string, text: string): HTMLSpanElement {
  const label = document.createElement('span');
  label.className = 'status-label';
  label.appendChild(createInlineIcon(iconPath));
  const textEl = document.createElement('span');
  textEl.textContent = text;
  label.appendChild(textEl);
  return label;
}

/**
 * Cree un groupe de valeur KPI : chiffre principal + complement optionnel.
 *
 * @param mainValue - Valeur principale (chiffre ou symbole, proeminente)
 * @param subText   - Complement textuel optionnel (11px, muted)
 * @param warning   - Si true, valeur et complement colores en warning
 * @returns Element div.status-value-group
 */
function createStatusValueGroup(
  mainValue: string,
  subText: string | null,
  warning: boolean = false,
): HTMLDivElement {
  const group = document.createElement('div');
  group.className = 'status-value-group';

  const main = document.createElement('span');
  main.className = 'status-value';
  main.textContent = mainValue;
  if (warning) main.style.color = 'var(--sn-color-warning)';
  group.appendChild(main);

  if (subText !== null) {
    const sub = document.createElement('span');
    sub.className = 'status-value-sub';
    sub.textContent = subText;
    if (warning) sub.style.color = 'var(--sn-color-warning)';
    group.appendChild(sub);
  }
  return group;
}

/**
 * Construit la section statut modules et quota (pattern KPI card).
 * Chaque ligne contient : icone + label a gauche, valeur numerique + complement a droite.
 *
 * @param container      - Element parent
 * @param activeCount    - Nombre de modules actifs
 * @param quotaRemaining - Nudges restants (null si illimite, nombre si limite)
 * @param quotaReached   - true si le quota du jour est atteint
 */
function renderStatusSection(
  container: HTMLElement,
  activeCount: number,
  quotaRemaining: number | null,
  quotaReached: boolean,
): void {
  const section = document.createElement('section');
  section.setAttribute(
    'aria-label',
    browser.i18n.getMessage('popup_status_aria_label') || 'Statut rapide',
  );
  section.className = 'status-section';

  // Ligne Modules : KPI "N / 7" + complement si partiellement actifs
  const modulesRow = document.createElement('div');
  modulesRow.className = 'status-row';
  modulesRow.appendChild(
    createStatusLabel(
      ICON_STATUS_MODULES,
      browser.i18n.getMessage('popup_modules_label') || 'Modules actifs',
    ),
  );
  const inactive = TOTAL_MODULES_V1 - activeCount;
  const modulesSub = inactive > 0 ? `${inactive} inactif${inactive > 1 ? 's' : ''}` : null;
  modulesRow.appendChild(
    createStatusValueGroup(`${activeCount} / ${TOTAL_MODULES_V1}`, modulesSub),
  );
  section.appendChild(modulesRow);

  // Ligne Quota : KPI chiffre + complement contextuel
  const quotaRow = document.createElement('div');
  quotaRow.className = 'status-row';
  quotaRow.appendChild(
    createStatusLabel(
      ICON_STATUS_QUOTA,
      browser.i18n.getMessage('popup_quota_label') || 'Quota du jour',
    ),
  );

  let mainValue: string;
  let subText: string | null;
  let warning = false;
  if (quotaReached) {
    mainValue = '0';
    subText = browser.i18n.getMessage('popup_quota_reached_sub') || 'limite atteinte';
    warning = true;
  } else if (quotaRemaining === null) {
    mainValue = '∞';
    subText = browser.i18n.getMessage('popup_quota_unlimited_sub') || 'illimite';
  } else {
    mainValue = String(quotaRemaining);
    subText = browser.i18n.getMessage('popup_quota_remaining_sub') || 'nudges restants';
  }
  quotaRow.appendChild(createStatusValueGroup(mainValue, subText, warning));
  section.appendChild(quotaRow);

  container.appendChild(section);
}

/**
 * Construit la section des boutons d'action (dashboard + paramètres).
 *
 * @param container - Élément parent
 */
function renderActionsSection(container: HTMLElement): void {
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'actions';

  // Bouton Dashboard
  const btnDashboard = document.createElement('button');
  btnDashboard.type = 'button';
  btnDashboard.className = 'btn btn-primary';
  btnDashboard.textContent = browser.i18n.getMessage('popup_btn_dashboard') || 'Voir le détail';
  btnDashboard.addEventListener('click', () => {
    const dashboardUrl = browser.runtime.id
      ? `chrome-extension://${browser.runtime.id}/pages/dashboard/dashboard.html`
      : '';
    if (dashboardUrl) {
      void browser.tabs.create({ url: dashboardUrl });
    }
  });
  actionsDiv.appendChild(btnDashboard);

  // Bouton Paramètres
  const btnSettings = document.createElement('button');
  btnSettings.type = 'button';
  btnSettings.className = 'btn btn-secondary';
  btnSettings.textContent = browser.i18n.getMessage('popup_btn_settings') || 'Paramètres';
  btnSettings.addEventListener('click', () => {
    const optionsUrl = browser.runtime.id
      ? `chrome-extension://${browser.runtime.id}/pages/options/options.html`
      : '';
    if (optionsUrl) {
      void browser.tabs.create({ url: optionsUrl });
    }
  });
  actionsDiv.appendChild(btnSettings);

  container.appendChild(actionsDiv);
}

/**
 * Point d'entrée principal : initialise la popup.
 *
 * Séquence :
 * 1. Afficher un état de chargement
 * 2. Envoyer un message au SW pour récupérer le score M3 courant et le quota
 * 3. Lire la config (modules actifs) depuis chrome.storage.local
 * 4. Rendre l'UI complète
 *
 * @returns Promise<void>
 */
async function initPopup(): Promise<void> {
  const root = document.getElementById('popup-root');
  if (!root) return;

  // En-tête : icone bouclier + titre sur la meme ligne (branding)
  const header = document.createElement('header');
  const headerInner = document.createElement('div');
  headerInner.className = 'popup-header-inner';

  const headerIcon = createInlineIcon(ICON_HEADER_SHIELD, 24);
  headerIcon.classList.add('header-shield');
  headerInner.appendChild(headerIcon);

  const h1 = document.createElement('h1');
  h1.className = 'popup-title';
  h1.textContent = browser.i18n.getMessage('popup_title') || 'Sentinel Nudge';
  headerInner.appendChild(h1);

  header.appendChild(headerInner);
  root.appendChild(header);

  // État de chargement
  const loadingEl = document.createElement('p');
  loadingEl.className = 'loading-text';
  loadingEl.setAttribute('aria-live', 'polite');
  loadingEl.textContent = browser.i18n.getMessage('popup_loading') || 'Chargement…';
  root.appendChild(loadingEl);

  try {
    // Récupération du score M3 via le SW
    const scoreResponse = (await browser.runtime.sendMessage({
      module: 'M3',
      action: 'get_state',
      payload: {},
      timestamp: Date.now(),
    })) as Record<string, unknown> | null;

    // Récupération de la config (modules actifs + quota)
    const storageData = await browser.storage.local.get(['config', 'quota_state']);
    const config = storageData['config'] as
      | { modules: Record<string, boolean>; quota_limit: number | null }
      | undefined;

    // Calcul du nombre de modules actifs
    const activeCount = config?.modules ? Object.values(config.modules).filter(Boolean).length : 0;

    // Calcul du quota restant
    const quotaLimit = config?.quota_limit ?? 3;
    const quotaState = storageData['quota_state'] as { date: string; count: number } | undefined;
    const quotaUsed = quotaState?.count ?? 0;
    const isUnlimited = quotaLimit === null;
    const quotaRemaining = isUnlimited ? null : Math.max(0, quotaLimit - quotaUsed);
    const quotaReached = !isUnlimited && quotaRemaining === 0;

    // Extraction du score depuis la réponse du SW
    let currentScore: number | null = null;
    if (
      scoreResponse &&
      scoreResponse['success'] === true &&
      scoreResponse['data'] &&
      typeof (scoreResponse['data'] as Record<string, unknown>)['score'] === 'number'
    ) {
      currentScore = (scoreResponse['data'] as Record<string, unknown>)['score'] as number;
    }

    // Effacer l'état de chargement
    root.removeChild(loadingEl);

    // Rendu des sections
    const mainContent = document.createElement('div');
    mainContent.className = 'popup-content';

    renderScoreSection(mainContent, currentScore);
    renderStatusSection(mainContent, activeCount, quotaRemaining, quotaReached);
    renderActionsSection(mainContent);

    root.appendChild(mainContent);
  } catch (err: unknown) {
    // Afficher un message d'erreur sans exposer les détails techniques
    root.removeChild(loadingEl);

    const errorEl = document.createElement('p');
    errorEl.className = 'error-text';
    errorEl.setAttribute('role', 'alert');
    errorEl.textContent =
      browser.i18n.getMessage('popup_error') || 'Impossible de récupérer les données';
    root.appendChild(errorEl);

    // Log structuré (ne jamais exposer de données personnelles)
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'warn',
        message: 'Popup: échec récupération état SW',
        context: { error: message },
      }),
    );
  }
}

// Attendre le chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
  // Appliquer le thème AVANT le rendu pour éviter le FOUC (TACHE-148)
  void initTheme();
  watchThemeChanges();
  initPopup().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Popup: erreur inattendue',
        context: { error: message },
      }),
    );
  });
});
