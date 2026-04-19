/**
 * @file pages/popup/popup.ts
 * @description Script de la popup Sentinel Nudge — refonte pixel-perfect T-156.
 *
 * La popup affiche (structure matchant fidèlement les maquettes v3) :
 * - Header : div.popup-header avec icone emoji 🛡 + h2 "Sentinel Nudge" + p tagline
 *   - Aegis Light : fond primary (#1e3a5f), texte blanc
 *   - Midnight Obsidian : fond surface-2 sombre + barre accent gradient (popup-header-accent)
 *   - Cyberpunk Neon : fond surface-2 sombre + bordure néon + h2 en cyan neon
 * - Score gauge : SVG arc 180° (viewBox 120×80) côte-à-côte avec gauge-info
 * - Section "MODULES ACTIFS" : grille 2 colonnes × 4 lignes de chips (dot + label)
 * - Nudges aujourd'hui : label + compteur "used/quota" + barre de progression
 * - Actions : bouton principal + bouton secondaire pleine largeur
 * - Badge mode dégradé (TACHE-062) si modules KO depuis plus d'1 heure
 *
 * Technique :
 * - Envoie {module: 'M3', action: 'get_state'} au SW pour récupérer le score courant
 * - Lecture de la config depuis chrome.storage.local pour les modules actifs et le quota
 *
 * Accessibilité :
 * - Structure sémantique h2, sections, aria-labels
 * - Skip link WCAG 2.4.1 A (T-132)
 * - Score exprimé via aria-label sur le SVG
 * - Grille modules avec role="list" + role="listitem"
 * - Barre de progression avec role="meter" + aria-valuenow/min/max
 * - Taille : 320px × ~480px (CSS fixe width)
 *
 * Sécurité :
 * - D-SEC-003 : Aucun innerHTML. Tout DOM via createElement/textContent/appendChild.
 *
 * Référence : DAT §3.1 (Popup), SFD §3.5, DAT §11.4 (design system),
 *             Maquettes v3 : theme-clair-1-aegis-light, theme-sombre-2-midnight-obsidian,
 *             theme-matrix-2-cyberpunk-neon (Section 1 — Popup)
 */

import { browser } from '@/shared/browser/browser-adapter';
import { initTheme, watchThemeChanges } from '@/shared/utils/apply-theme';
import {
  DIAGNOSTICS_M2_KEY,
  DIAGNOSTICS_M3_KEY,
  DIAGNOSTICS_M5_KEY,
  DIAGNOSTICS_M6_KEY,
  DIAGNOSTICS_M7_KEY,
  DIAGNOSTICS_M9_KEY,
  DIAGNOSTICS_M17_KEY,
} from '@/shared/types/diagnostics';
import { createLogger, Logger } from '@/shared/utils/logger';

/** Logger scopé — Popup (INV-SEC-02 étendu) */
const logger = createLogger('Popup');

/** Score seuil vert (>= 70) */
const SCORE_GREEN_THRESHOLD = 70;

/** Score seuil orange (>= 40) */
const SCORE_ORANGE_THRESHOLD = 40;

/** SVG path de l'icone d'avertissement (triangle attention, Material Design "warning", viewBox 24x24) */
const ICON_WARNING = 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z';

/**
 * Descripteurs des 8 chips de la grille modules (4x2 maquette v3).
 * Le dernier chip est un placeholder pour les modules futurs.
 */
const MODULE_CHIPS: Array<{ id: string; labelKey: string; fallback: string }> = [
  { id: 'M2', labelKey: 'module_m2_name', fallback: 'Sites douteux' },
  { id: 'M3', labelKey: 'module_m3_name', fallback: 'Score' },
  { id: 'M5', labelKey: 'module_m5_name', fallback: 'Mise à jour' },
  { id: 'M6', labelKey: 'module_m6_name', fallback: 'Quiz' },
  { id: 'M7', labelKey: 'module_m7_name', fallback: 'MDP réutilisés' },
  { id: 'M9', labelKey: 'module_m9_name', fallback: 'Force MDP' },
  { id: 'M17', labelKey: 'module_m17_name', fallback: 'Presse-papiers' },
  { id: '', labelKey: '', fallback: '' }, // placeholder futur
];

/**
 * Seuil de dégradation en millisecondes (1 heure).
 * Si ready=false ET le dernier timestamp connu est antérieur à ce seuil,
 * le module est considéré dégradé (ADR-001 R-BOOT-04, TACHE-062).
 */
const DEGRADED_THRESHOLD_MS = 60 * 60 * 1000; // 3 600 000 ms

/**
 * Modules surveillés pour le badge dégradé.
 * Le champ `tsKey` identifie le champ timestamp pertinent selon le type de module :
 * - Modules avec initBoot (M2/M5/M6/M7) : `last_boot_ts`
 * - Module M3 (Option B) : `last_boot`
 * - Modules M9/M17 (Option B) : `last_action_ts`
 */
const MONITORED_MODULES: Array<{ label: string; storageKey: string; tsKey: string }> = [
  { label: 'M2', storageKey: DIAGNOSTICS_M2_KEY, tsKey: 'last_boot_ts' },
  { label: 'M3', storageKey: DIAGNOSTICS_M3_KEY, tsKey: 'last_boot' },
  { label: 'M5', storageKey: DIAGNOSTICS_M5_KEY, tsKey: 'last_boot_ts' },
  { label: 'M6', storageKey: DIAGNOSTICS_M6_KEY, tsKey: 'last_boot_ts' },
  { label: 'M7', storageKey: DIAGNOSTICS_M7_KEY, tsKey: 'last_boot_ts' },
  { label: 'M9', storageKey: DIAGNOSTICS_M9_KEY, tsKey: 'last_action_ts' },
  { label: 'M17', storageKey: DIAGNOSTICS_M17_KEY, tsKey: 'last_action_ts' },
];

/**
 * Analyse les diagnostics lus depuis chrome.storage.local et retourne
 * la liste des labels de modules considérés dégradés.
 *
 * Un module est dégradé si et seulement si :
 * 1. Son objet diagnostics est présent dans le storage.
 * 2. `ready === false`
 * 3. Le dernier timestamp connu (tsKey) est antérieur de plus de DEGRADED_THRESHOLD_MS.
 *
 * @param storageResult - Résultat brut de chrome.storage.local.get sur les clés diagnostics
 * @param now           - Timestamp courant en ms (paramétrable pour les tests)
 * @returns Tableau de labels de modules dégradés (ex: ['M2', 'M7'])
 */
export function getDegradedModules(
  storageResult: Record<string, unknown>,
  now: number = Date.now(),
): string[] {
  const degraded: string[] = [];
  for (const mod of MONITORED_MODULES) {
    const diag = storageResult[mod.storageKey] as Record<string, unknown> | undefined;
    if (!diag) continue;
    if (diag['ready'] !== false) continue;
    const ts = typeof diag[mod.tsKey] === 'number' ? (diag[mod.tsKey] as number) : 0;
    if (ts === 0) continue;
    if (now - ts > DEGRADED_THRESHOLD_MS) {
      degraded.push(mod.label);
    }
  }
  return degraded;
}

/**
 * Construit et insère le badge "mode dégradé" dans le conteneur donné.
 *
 * Accessibilité :
 * - role="alert" + aria-live="polite" sur le badge
 * - Bouton "En savoir plus" accessible au clavier
 * - Tooltip avec bouton fermer accessible
 *
 * Sécurité :
 * - D-SEC-003 : aucun innerHTML, tout DOM via createElement/textContent/appendChild
 *
 * @param container       - Élément parent où insérer le badge
 * @param degradedModules - Liste des labels de modules dégradés
 */
export function renderDegradedBadge(container: HTMLElement, degradedModules: string[]): void {
  if (degradedModules.length === 0) return;

  const badge = document.createElement('div');
  badge.className = 'degraded-badge';
  badge.setAttribute('role', 'alert');
  badge.setAttribute('aria-live', 'polite');

  const badgeHeader = document.createElement('div');
  badgeHeader.className = 'degraded-badge-header';

  const warnIcon = createInlineIcon(ICON_WARNING, 18);
  warnIcon.classList.add('degraded-badge-icon');
  badgeHeader.appendChild(warnIcon);

  const badgeLabel = document.createElement('span');
  badgeLabel.className = 'degraded-badge-label';
  badgeLabel.textContent = browser.i18n.getMessage('popup_degraded_mode_badge') || 'Mode degrade';
  badgeHeader.appendChild(badgeLabel);

  badge.appendChild(badgeHeader);

  const modulesLine = document.createElement('p');
  modulesLine.className = 'degraded-badge-modules';
  const modulesList = degradedModules.join(', ');
  modulesLine.textContent =
    browser.i18n.getMessage('popup_degraded_mode_modules', modulesList) ||
    `Modules affectés : ${modulesList}`;
  badge.appendChild(modulesLine);

  const learnMoreBtn = document.createElement('button');
  learnMoreBtn.type = 'button';
  learnMoreBtn.className = 'degraded-badge-learn-more';
  learnMoreBtn.textContent =
    browser.i18n.getMessage('popup_degraded_mode_learn_more') || 'En savoir plus';
  learnMoreBtn.setAttribute('aria-expanded', 'false');
  learnMoreBtn.setAttribute('aria-controls', 'degraded-tooltip');
  badge.appendChild(learnMoreBtn);

  const tooltip = document.createElement('div');
  tooltip.className = 'degraded-tooltip';
  tooltip.id = 'degraded-tooltip';
  tooltip.setAttribute('role', 'region');
  tooltip.setAttribute(
    'aria-label',
    browser.i18n.getMessage('popup_degraded_mode_badge') || 'Mode degrade',
  );
  tooltip.hidden = true;

  const tooltipText = document.createElement('p');
  tooltipText.className = 'degraded-tooltip-text';
  tooltipText.textContent =
    browser.i18n.getMessage('popup_degraded_mode_tooltip') ||
    "Un ou plusieurs modules n'ont pas démarré correctement depuis plus d'une heure.";
  tooltip.appendChild(tooltipText);

  const reloadBtn = document.createElement('button');
  reloadBtn.type = 'button';
  reloadBtn.className = 'degraded-tooltip-reload';
  reloadBtn.textContent =
    browser.i18n.getMessage('popup_degraded_mode_reload') || "Recharger l'extension";
  reloadBtn.addEventListener('click', () => {
    void browser.runtime.reload();
  });
  tooltip.appendChild(reloadBtn);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'degraded-tooltip-close';
  closeBtn.textContent = browser.i18n.getMessage('popup_degraded_mode_tooltip_close') || 'Fermer';
  closeBtn.addEventListener('click', () => {
    tooltip.hidden = true;
    learnMoreBtn.setAttribute('aria-expanded', 'false');
    learnMoreBtn.focus();
  });
  tooltip.appendChild(closeBtn);

  badge.appendChild(tooltip);

  learnMoreBtn.addEventListener('click', () => {
    const isOpen = !tooltip.hidden;
    tooltip.hidden = isOpen;
    learnMoreBtn.setAttribute('aria-expanded', String(!isOpen));
  });

  container.appendChild(badge);
}

/**
 * Crée un SVG inline décoratif aria-hidden.
 *
 * @param pathData - Donnée du path SVG (viewBox 0 0 24 24)
 * @param size     - Taille en px (défaut 16)
 * @returns Élément SVGElement prêt à insérer
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

// getNextMonday() supprimée (feedback Commanditaire 2026-04-19 : doublon "lundi lundi")
// Le trend fresh install utilise uniquement l'i18n popup_score_pending_trend sans date.

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
 * Détermine le niveau textuel du score.
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
 * Construit le libellé de tendance du score (delta vs semaine précédente).
 *
 * @param previousScore - Score semaine précédente (null si premier score)
 * @param currentScore  - Score courant
 * @returns Libellé de tendance localisé
 */
function buildTrendLabel(previousScore: number | null, currentScore: number): string {
  if (previousScore === null) {
    return browser.i18n.getMessage('popup_score_trend_stable') || 'Stable cette semaine';
  }
  const delta = currentScore - previousScore;
  if (delta > 0) {
    return (
      browser.i18n.getMessage('popup_score_trend_up', String(delta)) || `+ ${delta} cette semaine`
    );
  }
  if (delta < 0) {
    return (
      browser.i18n.getMessage('popup_score_trend_down', String(Math.abs(delta))) ||
      `- ${Math.abs(delta)} cette semaine`
    );
  }
  return browser.i18n.getMessage('popup_score_trend_stable') || 'Stable cette semaine';
}

/**
 * Construit et insère la section score M3 dans le conteneur donné.
 *
 * Structure maquette v3 (pixel-perfect T-156) :
 * section > div.gauge-wrap > (svg.gauge-svg + div.gauge-info > (gauge-score + gauge-label + gauge-trend))
 *
 * Arc SVG semi-circulaire 180° : viewBox 120×80, path M10,70 A50,50 0 0,1 110,70
 * Longueur de l'arc = π × 50 ≈ 157
 *
 * @param container     - Élément parent où insérer la section
 * @param score         - Score entre 0 et 100, ou null si aucun score disponible
 * @param previousScore - Score semaine précédente (pour la tendance), ou null
 */
export function renderScoreSection(
  container: HTMLElement,
  score: number | null,
  previousScore: number | null = null,
): void {
  const section = document.createElement('section');
  section.setAttribute('aria-label', browser.i18n.getMessage('popup_score_label') || 'Score');

  // TACHE-153 : structure gauge TOUJOURS affichée, même sans score (fresh install).
  // Préférence Commanditaire 2026-04-19 : pas de fallback plat "Premier score lundi".
  const hasScore = score !== null;
  const displayScore = hasScore ? String(score) : '\u2014'; // em-dash si pas de score
  const displayColor = hasScore ? scoreColor(score) : 'var(--sn-color-fg-muted)';
  const displayLabel = hasScore
    ? scoreLevelLabel(score)
    : browser.i18n.getMessage('popup_score_pending_label') || 'En cours';
  const displayTrend = hasScore
    ? buildTrendLabel(previousScore, score)
    : browser.i18n.getMessage('popup_score_pending_trend') || 'Premier score lundi';
  const progressRatio = hasScore ? score / 100 : 0;
  const ariaScore = hasScore
    ? `Score ${score}/100 \u2014 ${displayLabel}`
    : browser.i18n.getMessage('popup_score_pending_aria') || 'Score en cours de calcul';

  // Disposition côte-à-côte : SVG + info score (maquette v3)
  const gaugeWrap = document.createElement('div');
  gaugeWrap.className = 'gauge-wrap';

  // SVG arc semi-circulaire 180° (maquette v3 : viewBox 120×80)
  // Path : M10,70 A50,50 0 0,1 110,70 — demi-cercle horizontal en haut
  // Longueur de l'arc = π * 50 ≈ 157
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'gauge-svg');
  svg.setAttribute('viewBox', '0 0 120 80');
  svg.setAttribute('width', '120');
  svg.setAttribute('height', '80');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', ariaScore);

  const ARC_LENGTH = Math.PI * 50; // ≈ 157

  // Arc de fond (track)
  const bgPath = document.createElementNS(svgNS, 'path');
  bgPath.setAttribute('d', 'M10,70 A50,50 0 0,1 110,70');
  bgPath.setAttribute('fill', 'none');
  bgPath.setAttribute('stroke', 'var(--sn-gauge-track)');
  bgPath.setAttribute('stroke-width', '10');
  bgPath.setAttribute('stroke-linecap', 'round');
  svg.appendChild(bgPath);

  // Arc de progression
  const dashOffset = ARC_LENGTH * (1 - progressRatio);
  const progressPath = document.createElementNS(svgNS, 'path');
  progressPath.setAttribute('d', 'M10,70 A50,50 0 0,1 110,70');
  progressPath.setAttribute('fill', 'none');
  progressPath.setAttribute('stroke', displayColor);
  progressPath.setAttribute('stroke-width', '10');
  progressPath.setAttribute('stroke-linecap', 'round');
  progressPath.setAttribute('stroke-dasharray', String(ARC_LENGTH));
  progressPath.setAttribute('stroke-dashoffset', String(dashOffset));
  svg.appendChild(progressPath);

  // Texte score dans SVG (centré dans l'arc, aria-hidden)
  const scoreText = document.createElementNS(svgNS, 'text');
  scoreText.setAttribute('x', '60');
  scoreText.setAttribute('y', '64');
  scoreText.setAttribute('text-anchor', 'middle');
  scoreText.setAttribute('font-size', '22');
  scoreText.setAttribute('font-weight', '700');
  scoreText.setAttribute('fill', displayColor);
  scoreText.setAttribute('aria-hidden', 'true');
  scoreText.textContent = displayScore;
  svg.appendChild(scoreText);

  // Texte /100 sous le score
  const maxText = document.createElementNS(svgNS, 'text');
  maxText.setAttribute('x', '60');
  maxText.setAttribute('y', '78');
  maxText.setAttribute('text-anchor', 'middle');
  maxText.setAttribute('font-size', '9');
  maxText.setAttribute('fill', 'var(--sn-color-fg-muted)');
  maxText.setAttribute('aria-hidden', 'true');
  maxText.textContent = '/ 100';
  svg.appendChild(maxText);

  gaugeWrap.appendChild(svg);

  // Info score à droite (maquette v3)
  const gaugeInfo = document.createElement('div');
  gaugeInfo.className = 'gauge-info';

  // Grand score numérique textuel (aria-hidden : SVG porte le sens)
  const gaugeScoreEl = document.createElement('div');
  gaugeScoreEl.className = 'gauge-score';
  gaugeScoreEl.style.color = displayColor;
  gaugeScoreEl.textContent = displayScore;
  gaugeScoreEl.setAttribute('aria-hidden', 'true');
  gaugeInfo.appendChild(gaugeScoreEl);

  // Label niveau
  const gaugeLabelEl = document.createElement('div');
  gaugeLabelEl.className = 'gauge-label';
  gaugeLabelEl.style.color = displayColor;
  gaugeLabelEl.textContent = displayLabel;
  gaugeLabelEl.setAttribute('aria-hidden', 'true');
  gaugeInfo.appendChild(gaugeLabelEl);

  // Tendance (ou message "premier score lundi" si pas encore de score)
  const gaugeTrendEl = document.createElement('div');
  gaugeTrendEl.className = 'gauge-trend';
  gaugeTrendEl.textContent = displayTrend;
  gaugeTrendEl.setAttribute('aria-hidden', 'true');
  gaugeInfo.appendChild(gaugeTrendEl);

  gaugeWrap.appendChild(gaugeInfo);
  section.appendChild(gaugeWrap);

  container.appendChild(section);
}

/**
 * Construit et insère la grille des modules (8 chips 4×2) dans le conteneur.
 *
 * Chaque chip affiche :
 * - Un point de statut coloré (vert=actif, orange=dégradé, gris=inactif)
 * - Le label court du module
 *
 * Accessibilité :
 * - role="list" sur la grille, role="listitem" sur chaque chip
 *
 * @param container      - Élément parent
 * @param moduleStates   - Record<moduleId, boolean> depuis la config storage
 * @param degradedLabels - Labels des modules dégradés (ex: ['M2', 'M7'])
 */
export function renderModulesSection(
  container: HTMLElement,
  moduleStates: Record<string, boolean>,
  degradedLabels: string[],
): void {
  const sectionTitle = document.createElement('div');
  sectionTitle.className = 'card-title';
  sectionTitle.textContent =
    browser.i18n.getMessage('popup_modules_section_title') || 'Modules actifs';
  container.appendChild(sectionTitle);

  const grid = document.createElement('div');
  grid.className = 'modules-grid';
  grid.setAttribute('role', 'list');
  grid.setAttribute(
    'aria-label',
    browser.i18n.getMessage('popup_modules_grid_aria') || 'Grille des modules de protection',
  );

  for (const chip of MODULE_CHIPS) {
    const chipEl = document.createElement('div');
    chipEl.className = 'module-chip';
    chipEl.setAttribute('role', 'listitem');

    if (chip.id === '') {
      // Placeholder : chip inactif futur
      const dot = document.createElement('div');
      dot.className = 'module-chip-dot inactive';
      chipEl.appendChild(dot);
      const label = document.createElement('span');
      label.textContent = '\u2014';
      chipEl.appendChild(label);
    } else {
      const isActive = moduleStates[chip.id] !== false;
      const isDegraded = degradedLabels.includes(chip.id);

      const dot = document.createElement('div');
      if (isDegraded) {
        dot.className = 'module-chip-dot warning';
      } else if (isActive) {
        dot.className = 'module-chip-dot active';
      } else {
        dot.className = 'module-chip-dot inactive';
      }
      chipEl.appendChild(dot);

      const label = document.createElement('span');
      const i18nLabel = browser.i18n.getMessage(chip.labelKey);
      label.textContent = i18nLabel || chip.fallback;
      chipEl.appendChild(label);
    }

    grid.appendChild(chipEl);
  }

  container.appendChild(grid);
}

/**
 * Construit et insère la barre de progression du quota de nudges.
 *
 * Accessibilité :
 * - .quota-track a role="meter" + aria-valuenow/min/max/valuetext
 *
 * @param container      - Élément parent
 * @param quotaUsed      - Nudges déjà envoyés aujourd'hui
 * @param quotaLimit     - Limite du quota (null = illimité)
 * @param quotaReached   - true si le quota du jour est atteint
 */
export function renderQuotaBar(
  container: HTMLElement,
  quotaUsed: number,
  quotaLimit: number | null,
  quotaReached: boolean,
): void {
  const wrap = document.createElement('div');
  wrap.className = 'quota-bar-wrap';

  const labelRow = document.createElement('div');
  labelRow.className = 'quota-label';

  const labelLeft = document.createElement('span');
  labelLeft.textContent =
    browser.i18n.getMessage('popup_nudges_today_label') || "Nudges aujourd'hui";
  labelRow.appendChild(labelLeft);

  const labelRight = document.createElement('span');
  if (quotaLimit === null) {
    labelRight.textContent = browser.i18n.getMessage('popup_quota_unlimited_sub') || 'illimité';
  } else {
    labelRight.textContent = `${quotaUsed} / ${quotaLimit}`;
  }
  labelRow.appendChild(labelRight);

  wrap.appendChild(labelRow);

  const fillPct =
    quotaLimit !== null ? Math.min(100, Math.round((quotaUsed / quotaLimit) * 100)) : 0;

  const track = document.createElement('div');
  track.className = 'quota-track';
  track.setAttribute('role', 'meter');
  track.setAttribute('aria-valuenow', String(quotaUsed));
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', String(quotaLimit ?? 0));
  track.setAttribute(
    'aria-valuetext',
    quotaLimit !== null ? `${quotaUsed} sur ${quotaLimit}` : 'illimité',
  );
  track.setAttribute(
    'aria-label',
    browser.i18n.getMessage('popup_nudges_today_label') || "Nudges aujourd'hui",
  );

  const fill = document.createElement('div');
  fill.className = 'quota-fill';
  if (quotaReached) {
    fill.style.width = '100%';
    fill.style.backgroundColor = 'var(--sn-color-warning)';
  } else if (quotaLimit === null) {
    fill.style.width = '0%';
  } else {
    fill.style.width = `${fillPct}%`;
  }

  track.appendChild(fill);
  wrap.appendChild(track);

  container.appendChild(wrap);
}

/**
 * Construit la section des boutons d'action.
 * Structure maquette v3 : div.popup-actions avec btn-primary + btn-secondary.
 *
 * @param container - Élément parent
 */
function renderActionsSection(container: HTMLElement): void {
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'popup-actions';

  const btnDashboard = document.createElement('button');
  btnDashboard.type = 'button';
  btnDashboard.className = 'btn btn-primary';
  btnDashboard.textContent =
    browser.i18n.getMessage('popup_btn_dashboard') || 'Voir le tableau de bord';
  btnDashboard.addEventListener('click', () => {
    const dashboardUrl = browser.runtime.id
      ? `chrome-extension://${browser.runtime.id}/pages/dashboard/dashboard.html`
      : '';
    if (dashboardUrl) {
      void browser.tabs.create({ url: dashboardUrl });
    }
  });
  actionsDiv.appendChild(btnDashboard);

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
 * 1. Injecter le skip link WCAG 2.4.1 A
 * 2. Construire div.popup-header (pixel-perfect maquette v3) :
 *    - Aegis Light (clair) : fond primary bleu acier + icône 🛡 + h2 blanc + tagline
 *    - Midnight Obsidian (sombre) : fond surface-2 + barre accent gradient + h2 + tagline
 *    - Cyberpunk Neon (matrix) : fond surface-2 + neon border + h2 cyan neon + tagline
 * 3. Afficher un état de chargement
 * 4. Envoyer un message au SW pour récupérer le score M3 courant + historique trend
 * 5. Lire la config depuis chrome.storage.local
 * 6. Rendre div.popup-body (gauge + modules + quota + actions)
 *
 * @returns Promise<void>
 */
async function initPopup(): Promise<void> {
  const root = document.getElementById('popup-root');
  if (!root) return;

  // Skip link WCAG 2.4.1 A (T-132)
  const skipLink = document.createElement('a');
  skipLink.className = 'skip-link';
  skipLink.href = '#popup-main';
  skipLink.textContent = browser.i18n.getMessage('skip_link_text') || 'Aller au contenu';
  root.appendChild(skipLink);

  // ─── En-tête pixel-perfect maquettes v3 ───────────────────────────────────
  // Structure commune : div.popup-header > div.popup-header-icon (emoji) + div.popup-header-text > h2 + p
  // Variante sombre (Midnight Obsidian) : ajoute div.popup-header-accent avant le texte
  // Variante matrix (Cyberpunk Neon) : h2 en neon-cyan via CSS tokens

  const popupHeader = document.createElement('div');
  popupHeader.className = 'popup-header';
  popupHeader.setAttribute('role', 'banner');

  // Barre d'accent décorative (Midnight Obsidian uniquement — masquée via CSS en clair/matrix)
  const headerAccent = document.createElement('div');
  headerAccent.className = 'popup-header-accent';
  headerAccent.setAttribute('aria-hidden', 'true');
  popupHeader.appendChild(headerAccent);

  // Icône bouclier emoji (🛡) — identique dans les 3 thèmes selon maquette v3
  const headerIcon = document.createElement('div');
  headerIcon.className = 'popup-header-icon';
  headerIcon.setAttribute('aria-hidden', 'true');
  headerIcon.textContent = '\uD83D\uDEE1'; // emoji 🛡 (U+1F6E1)
  popupHeader.appendChild(headerIcon);

  // Texte : titre h2 + tagline p
  const headerText = document.createElement('div');
  headerText.className = 'popup-header-text';

  const h2 = document.createElement('h2');
  h2.className = 'popup-title';
  h2.textContent = browser.i18n.getMessage('popup_title') || 'Sentinel Nudge';
  headerText.appendChild(h2);

  const tagline = document.createElement('p');
  tagline.className = 'popup-tagline';
  tagline.textContent = browser.i18n.getMessage('popup_tagline') || 'Score de cyber-hygiène';
  headerText.appendChild(tagline);

  popupHeader.appendChild(headerText);
  root.appendChild(popupHeader);

  // État de chargement
  const loadingEl = document.createElement('p');
  loadingEl.className = 'loading-text';
  loadingEl.setAttribute('aria-live', 'polite');
  loadingEl.textContent = browser.i18n.getMessage('popup_loading') || 'Chargement\u2026';
  root.appendChild(loadingEl);

  try {
    // Score M3 courant via SW
    const scoreResponse = (await browser.runtime.sendMessage({
      module: 'M3',
      action: 'get_state',
      payload: {},
      timestamp: Date.now(),
    })) as Record<string, unknown> | null;

    // Historique scores pour le trend (semaine précédente)
    let previousScore: number | null = null;
    try {
      const histResponse = (await browser.runtime.sendMessage({
        module: 'M3',
        action: 'get_scores_history',
        payload: { limit: 2 },
        timestamp: Date.now(),
      })) as Record<string, unknown> | null;
      if (
        histResponse?.['success'] === true &&
        Array.isArray((histResponse['data'] as Record<string, unknown>)?.['scores'])
      ) {
        const scores = (histResponse['data'] as Record<string, unknown>)['scores'] as Array<{
          total_score: number;
        }>;
        if (scores.length >= 2) {
          previousScore = scores[1].total_score;
        }
      }
    } catch {
      // Dégradation gracieuse : pas de trend
    }

    // Config + quota + diagnostics
    const diagnosticsKeys = MONITORED_MODULES.map((m) => m.storageKey);
    const storageData = await browser.storage.local.get([
      'config',
      'quota_state',
      ...diagnosticsKeys,
    ]);
    const config = storageData['config'] as
      | { modules: Record<string, boolean>; quota_limit: number | null }
      | undefined;

    const moduleStates: Record<string, boolean> = config?.modules ?? {};
    const quotaLimit = config?.quota_limit ?? 3;
    const quotaState = storageData['quota_state'] as { date: string; count: number } | undefined;
    const quotaUsed = quotaState?.count ?? 0;
    const isUnlimited = quotaLimit === null;
    const quotaRemaining = isUnlimited ? null : Math.max(0, quotaLimit - quotaUsed);
    const quotaReached = !isUnlimited && quotaRemaining === 0;

    // Extraction du score courant
    let currentScore: number | null = null;
    if (
      scoreResponse &&
      scoreResponse['success'] === true &&
      scoreResponse['data'] &&
      typeof (scoreResponse['data'] as Record<string, unknown>)['score'] === 'number'
    ) {
      currentScore = (scoreResponse['data'] as Record<string, unknown>)['score'] as number;
    }

    // Modules dégradés (TACHE-062)
    const degradedModules = getDegradedModules(storageData);

    root.removeChild(loadingEl);

    // Corps de la popup (div.popup-body — maquette v3)
    const popupBody = document.createElement('div');
    popupBody.id = 'popup-main';
    popupBody.className = 'popup-body';

    // 1. Score gauge (SVG arc 180° + gauge-info côte-à-côte)
    renderScoreSection(popupBody, currentScore, previousScore);

    // 2. Badge mode dégradé (après score, avant modules)
    renderDegradedBadge(popupBody, degradedModules);

    // 3. Grille modules chips (4×2)
    renderModulesSection(popupBody, moduleStates, degradedModules);

    // 4. Barre quota
    renderQuotaBar(popupBody, quotaUsed, isUnlimited ? null : quotaLimit, quotaReached);

    // 5. Boutons d'action
    renderActionsSection(popupBody);

    root.appendChild(popupBody);
  } catch (err: unknown) {
    root.removeChild(loadingEl);

    const errorEl = document.createElement('p');
    errorEl.className = 'error-text';
    errorEl.setAttribute('role', 'alert');
    errorEl.textContent =
      browser.i18n.getMessage('popup_error') || 'Impossible de récupérer les données';
    root.appendChild(errorEl);

    logger.warn('Popup: échec récupération état SW', {
      error_name: Logger.errorName(err),
    });
  }
}

// Attendre le chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
  void initTheme();
  watchThemeChanges();
  initPopup().catch((err: unknown) => {
    logger.error('Popup: erreur inattendue', {
      error_name: Logger.errorName(err),
    });
  });
});
