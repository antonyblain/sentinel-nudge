/**
 * @file pages/popup/popup.ts
 * @description Script de la popup Sentinel Nudge — refonte structurelle T-152.
 *
 * La popup affiche (structure matchant les maquettes v3) :
 * - Header : icone bouclier SVG + titre "Sentinel Nudge" + tagline
 * - Score gauge : SVG circulaire cote-a-cote avec valeur textuelle + label + trend
 * - Section "MODULES ACTIFS" : grille 2 colonnes x 4 lignes de chips (dot + label)
 * - Nudges aujourd'hui : libelle + compteur "used/quota" + barre de progression
 * - Actions : bouton principal "Voir le tableau de bord" + bouton secondaire "Parametres"
 * - Badge mode degrade (TACHE-062) si modules KO depuis plus d'1 heure
 *
 * Technique :
 * - Envoie {module: 'M3', action: 'get_state'} au SW pour recuperer le score courant
 * - Lecture de la config depuis chrome.storage.local pour les modules actifs et le quota
 *
 * Accessibilite :
 * - Structure semantique h1, sections, aria-labels
 * - Score exprime via aria-label avec valeur textuelle
 * - Grille modules avec role="list" + role="listitem"
 * - Barre de progression avec role="meter" + aria-valuenow/min/max
 * - Taille : 320px x ~480px (CSS fixe width)
 * - Skip link WCAG 2.4.1 A (T-132)
 *
 * Securite :
 * - D-SEC-003 : Aucun innerHTML. Tout DOM via createElement/textContent/appendChild.
 *
 * Reference : DAT §3.1 (Popup), SFD §3.5, DAT §11.4 (design system), Maquettes v3
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

/** Score seuil vert (>= 70) */
const SCORE_GREEN_THRESHOLD = 70;

/** Score seuil orange (>= 40) */
const SCORE_ORANGE_THRESHOLD = 40;

/** SVG path du bouclier affiche dans le header (Material Design "security", viewBox 24x24) */
const ICON_HEADER_SHIELD = 'M12 2L4 5v6c0 5.25 3.5 10.15 8 11.35C16.5 21.15 20 16.25 20 11V5L12 2z';

/** SVG path de l'icone d'avertissement (triangle attention, Material Design "warning", viewBox 24x24) */
const ICON_WARNING = 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z';

/**
 * Descripteurs des 8 chips de la grille modules (4x2 maquette v3).
 * Le dernier chip est un placeholder pour les modules futurs.
 */
const MODULE_CHIPS: Array<{ id: string; labelKey: string; fallback: string }> = [
  { id: 'M2', labelKey: 'module_m2_name', fallback: 'M2 Phishing' },
  { id: 'M3', labelKey: 'module_m3_name', fallback: 'M3 Score' },
  { id: 'M5', labelKey: 'module_m5_name', fallback: 'M5 MAJ' },
  { id: 'M6', labelKey: 'module_m6_name', fallback: 'M6 Quiz' },
  { id: 'M7', labelKey: 'module_m7_name', fallback: 'M7 MDP' },
  { id: 'M9', labelKey: 'module_m9_name', fallback: 'M9 2FA' },
  { id: 'M17', labelKey: 'module_m17_name', fallback: 'M17 Session' },
  { id: '', labelKey: '', fallback: '' }, // placeholder futur
];

/**
 * Seuil de degradation en millisecondes (1 heure).
 * Si ready=false ET le dernier timestamp connu est anterieur a ce seuil,
 * le module est considere degrade (ADR-001 R-BOOT-04, TACHE-062).
 */
const DEGRADED_THRESHOLD_MS = 60 * 60 * 1000; // 3 600 000 ms

/**
 * Modules surveilles pour le badge degrade.
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
 * la liste des labels de modules consideres degrades.
 *
 * Un module est degrade si et seulement si :
 * 1. Son objet diagnostics est present dans le storage.
 * 2. `ready === false`
 * 3. Le dernier timestamp connu (tsKey) est anterieur de plus de DEGRADED_THRESHOLD_MS.
 *
 * @param storageResult - Resultat brut de chrome.storage.local.get sur les cles diagnostics
 * @param now           - Timestamp courant en ms (parametrable pour les tests)
 * @returns Tableau de labels de modules degrades (ex: ['M2', 'M7'])
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
 * Construit et insere le badge "mode degrade" dans le conteneur donne.
 *
 * Accessibilite :
 * - role="alert" + aria-live="polite" sur le badge
 * - Bouton "En savoir plus" accessible au clavier
 * - Tooltip avec bouton fermer accessible
 *
 * Securite :
 * - D-SEC-003 : aucun innerHTML, tout DOM via createElement/textContent/appendChild
 *
 * @param container       - Element parent ou inserer le badge
 * @param degradedModules - Liste des labels de modules degrades
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
    `Modules affectes : ${modulesList}`;
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
    "Un ou plusieurs modules n'ont pas demarre correctement depuis plus d'une heure.";
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
 * Cree un SVG inline decoratif aria-hidden.
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
 * Calcule la date du prochain lundi a partir d'aujourd'hui.
 *
 * @returns Date du prochain lundi au format lisible (ex: "lundi 14 avril")
 */
function getNextMonday(): string {
  const today = new Date();
  const dayOfWeek = today.getDay();
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
 * Determine la couleur CSS selon le score M3.
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
 * Determine le niveau textuel du score.
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
 * Construit le libelle de tendance du score (delta vs semaine precedente).
 *
 * @param previousScore - Score semaine precedente (null si premier score)
 * @param currentScore  - Score courant
 * @returns Libelle de tendance localise
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
 * Construit et insere la section score M3 dans le conteneur donne.
 *
 * Structure maquette v3 :
 * section > div.gauge-wrap > (svg.gauge-svg + div.gauge-info > (gauge-score + gauge-label + gauge-trend))
 *
 * @param container     - Element parent ou inserer la section
 * @param score         - Score entre 0 et 100, ou null si aucun score disponible
 * @param previousScore - Score semaine precedente (pour la tendance), ou null
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
    : browser.i18n.getMessage('popup_score_pending_trend') ||
      `Premier score lundi ${getNextMonday()}`;
  const progressRatio = hasScore ? score / 100 : 0;
  const ariaScore = hasScore
    ? `Score ${score}/100 \u2014 ${displayLabel}`
    : browser.i18n.getMessage('popup_score_pending_aria') || 'Score en cours de calcul';

  // Disposition cote-a-cote : SVG + info score (maquette v3)
  const gaugeWrap = document.createElement('div');
  gaugeWrap.className = 'gauge-wrap';

  // SVG arc semi-circulaire (maquette v3 : viewBox 120x80, arc 180°)
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

  // Info score a droite (maquette v3)
  const gaugeInfo = document.createElement('div');
  gaugeInfo.className = 'gauge-info';

  // Grand score numerique textuel (aria-hidden : SVG porte le sens)
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
 * Construit et insere la grille des modules (8 chips 4x2) dans le conteneur.
 *
 * Chaque chip affiche :
 * - Un point de statut colore (vert=actif, orange=degrade, gris=inactif)
 * - Le label court du module
 *
 * Accessibilite :
 * - role="list" sur la grille, role="listitem" sur chaque chip
 *
 * @param container      - Element parent
 * @param moduleStates   - Record<moduleId, boolean> depuis la config storage
 * @param degradedLabels - Labels des modules degrades (ex: ['M2', 'M7'])
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
 * Construit et insere la barre de progression du quota de nudges.
 *
 * Accessibilite :
 * - .quota-track a role="meter" + aria-valuenow/min/max/valuetext
 *
 * @param container      - Element parent
 * @param quotaUsed      - Nudges deja envoyes aujourd'hui
 * @param quotaLimit     - Limite du quota (null = illimite)
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
    labelRight.textContent = browser.i18n.getMessage('popup_quota_unlimited_sub') || 'illimite';
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
    quotaLimit !== null ? `${quotaUsed} sur ${quotaLimit}` : 'illimite',
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
 * @param container - Element parent
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
  btnSettings.textContent = browser.i18n.getMessage('popup_btn_settings') || 'Parametres';
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
 * Point d'entree principal : initialise la popup.
 *
 * Sequence :
 * 1. Afficher un etat de chargement
 * 2. Envoyer un message au SW pour recuperer le score M3 courant + historique trend
 * 3. Lire la config depuis chrome.storage.local
 * 4. Rendre l'UI complète (structure maquettes v3)
 *
 * @returns Promise<void>
 */
async function initPopup(): Promise<void> {
  const root = document.getElementById('popup-root');
  if (!root) return;

  // En-tete : icone bouclier + titre + tagline (maquette v3)
  const header = document.createElement('header');

  const headerInner = document.createElement('div');
  headerInner.className = 'popup-header-inner';

  const headerIcon = createInlineIcon(ICON_HEADER_SHIELD, 20);
  headerIcon.classList.add('header-shield');
  headerIcon.setAttribute('aria-hidden', 'true');
  headerInner.appendChild(headerIcon);

  const headerText = document.createElement('div');
  headerText.className = 'popup-header-text';

  const h1 = document.createElement('h1');
  h1.className = 'popup-title';
  h1.textContent = browser.i18n.getMessage('popup_title') || 'Sentinel Nudge';
  headerText.appendChild(h1);

  const tagline = document.createElement('p');
  tagline.className = 'popup-tagline';
  tagline.textContent = browser.i18n.getMessage('popup_tagline') || 'Score de cyber-hygiene';
  headerText.appendChild(tagline);

  headerInner.appendChild(headerText);
  header.appendChild(headerInner);
  root.appendChild(header);

  // Etat de chargement
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

    // Historique scores pour le trend (semaine precedente)
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
      // Degradation gracieuse : pas de trend
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

    // Modules degrades (TACHE-062)
    const degradedModules = getDegradedModules(storageData);

    root.removeChild(loadingEl);

    // Corps de la popup (div.popup-body — maquette v3)
    const popupBody = document.createElement('div');
    popupBody.className = 'popup-body';

    // 1. Score gauge (SVG + gauge-info cote-a-cote)
    renderScoreSection(popupBody, currentScore, previousScore);

    // 2. Badge mode degrade (apres score, avant modules)
    renderDegradedBadge(popupBody, degradedModules);

    // 3. Grille modules chips (4x2)
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
      browser.i18n.getMessage('popup_error') || 'Impossible de recuperer les donnees';
    root.appendChild(errorEl);

    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'warn',
        message: 'Popup: echec recuperation etat SW',
        context: { error: message },
      }),
    );
  }
}

// Attendre le chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
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
