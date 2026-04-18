/**
 * @file pages/dashboard/dashboard.ts
 * @description Script du tableau de bord Sentinel Nudge.
 *
 * Le dashboard affiche :
 * - Score courant : grand affichage + delta vs semaine précédente (↑↓=)
 * - Graphique SVG histogramme 12 semaines visibles (scrollable 52)
 * - Table sr-only : 52 valeurs pour les lecteurs d'écran (WCAG 1.1.1)
 * - Détail par composante : 5 lignes (M5, M6, M2, M7, M9) avec score/max
 * - Action recommandée : texte contextuel basé sur la composante la plus faible
 * - Stats nudges : nombre affichés cette semaine, taux de réponse
 * - Résultats quiz M6 : dernier score, prochaine date
 * - Bouton "Ouvrir les paramètres"
 *
 * Technique :
 * - Envoie messages au SW pour récupérer les données (scores, events, quiz)
 * - Graphique SVG construit via createElement (jamais innerHTML)
 * - Table sr-only avec classe CSS sr-only (DAT §11.5)
 * - Responsive : min-width 600px, max-width 900px
 *
 * Accessibilité (DAT §11.5) :
 * - SVG avec role="img" + <title> + <desc>
 * - Table HTML sr-only exposant les 52 valeurs
 * - Aria-live sur la zone de chargement
 *
 * Sécurité :
 * - D-SEC-003 : Aucun innerHTML. Tout DOM via createElement/textContent/appendChild.
 *
 * Référence : DAT §3.1 (Dashboard), §11.5 (accessibilité SVG), SFD §3.5
 */

import { browser } from '@/shared/browser/browser-adapter';
import { initTheme, watchThemeChanges } from '@/shared/utils/apply-theme';

/** Seuil de score vert */
const SCORE_GREEN = 70;

/** Seuil de score orange */
const SCORE_ORANGE = 40;

/** Hauteur de la zone SVG du graphique */
const CHART_HEIGHT = 160;

/** Largeur d'une barre SVG */
const BAR_WIDTH = 20;

/** Espacement entre les barres SVG */
const BAR_GAP = 6;

/**
 * Données d'un score hebdomadaire utilisées pour l'affichage.
 */
interface WeeklyScoreData {
  week_key: string;
  total_score: number;
  components: Record<string, number>;
  action_recommandee?: string;
}

/**
 * Données d'une session quiz M6 utilisées pour l'affichage.
 */
interface QuizSessionData {
  id: number;
  quiz_date: string;
  score_pct: number;
  next_quiz_date?: string;
}

/**
 * Données du dashboard consolidées depuis le SW.
 */
interface DashboardData {
  scores: WeeklyScoreData[];
  quizSessions: QuizSessionData[];
  nudgesThisWeek: number;
  responseRate: number;
}

/**
 * Détermine la couleur CSS de token selon le score.
 *
 * @param score - Score 0-100
 * @returns Couleur CSS (variable token)
 */
function scoreColorToken(score: number): string {
  if (score >= SCORE_GREEN) return 'var(--sn-color-success)';
  if (score >= SCORE_ORANGE) return 'var(--sn-color-warning)';
  return 'var(--sn-color-danger)';
}

/**
 * Couleurs hex Aegis Blue pour les attributs SVG (setAttribute ne supporte pas var()).
 * Ces valeurs dupliquent les tokens de tokens.css — les maintenir synchronisees.
 */
const SVG_COLOR_SUCCESS = '#1A7A4A';
const SVG_COLOR_WARNING = '#E67E22';
const SVG_COLOR_DANGER = '#C0392B';
const SVG_COLOR_MUTED = '#5D7A8A';

/**
 * Détermine la couleur hexadécimale (pour les attributs SVG) selon le score.
 *
 * @param score - Score 0-100
 * @returns Couleur hexadécimale
 */
function scoreColorHex(score: number): string {
  if (score >= SCORE_GREEN) return SVG_COLOR_SUCCESS;
  if (score >= SCORE_ORANGE) return SVG_COLOR_WARNING;
  return SVG_COLOR_DANGER;
}

/**
 * Formate une clé de semaine ISO en libellé court.
 * Exemple : "2026-W15" → "S15"
 *
 * @param weekKey - Clé de semaine au format YYYY-Www
 * @returns Libellé court
 */
function formatWeekLabel(weekKey: string): string {
  const match = weekKey.match(/W(\d+)$/);
  if (match) return `S${match[1]}`;
  return weekKey;
}

/**
 * Formate une date ISO en libellé localisé court.
 *
 * @param isoDate - Date au format ISO 8601
 * @returns Date formatée (ex: "21 avr. 2026")
 */
function formatDate(isoDate: string): string {
  if (!isoDate) return '';
  try {
    return new Date(isoDate).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

/**
 * Construit et insère la section "Score courant" dans le conteneur.
 *
 * @param container  - Élément parent
 * @param scores     - Historique des scores (au moins 1 élément pour l'affichage)
 */
function renderCurrentScore(container: HTMLElement, scores: WeeklyScoreData[]): void {
  const section = document.createElement('section');
  section.className = 'dashboard-section score-section';
  section.setAttribute(
    'aria-label',
    browser.i18n.getMessage('dashboard_score_current') || 'Score actuel',
  );

  const h2 = document.createElement('h2');
  h2.className = 'section-title';
  h2.textContent = browser.i18n.getMessage('dashboard_score_current') || 'Score actuel';
  section.appendChild(h2);

  if (scores.length === 0) {
    const noDataEl = document.createElement('p');
    noDataEl.className = 'no-data';
    noDataEl.textContent =
      browser.i18n.getMessage('dashboard_score_no_data') || 'Aucun score disponible';
    section.appendChild(noDataEl);
    container.appendChild(section);
    return;
  }

  const current = scores[0];
  const previous = scores.length > 1 ? scores[1] : null;
  const delta = previous !== null ? current.total_score - previous.total_score : 0;

  const scoreDisplay = document.createElement('div');
  scoreDisplay.className = 'score-display';

  // Grand chiffre du score
  const scoreNumber = document.createElement('div');
  scoreNumber.className = 'score-number';
  scoreNumber.style.color = scoreColorToken(current.total_score);
  scoreNumber.textContent = String(current.total_score);
  scoreNumber.setAttribute('aria-label', `${current.total_score} sur 100`);
  scoreDisplay.appendChild(scoreNumber);

  const scoreSuffix = document.createElement('span');
  scoreSuffix.className = 'score-suffix';
  scoreSuffix.textContent = '/100';
  scoreSuffix.setAttribute('aria-hidden', 'true');
  scoreDisplay.appendChild(scoreSuffix);

  section.appendChild(scoreDisplay);

  // Delta vs semaine précédente
  const deltaEl = document.createElement('p');
  deltaEl.className = 'score-delta';

  if (previous === null) {
    // Premier score
    deltaEl.textContent = browser.i18n.getMessage('dashboard_score_delta_equal') || '= Stable';
  } else if (delta > 0) {
    deltaEl.textContent =
      browser.i18n.getMessage('dashboard_score_delta_up', String(delta)) ||
      `↑ ${delta} points cette semaine`;
    deltaEl.style.color = 'var(--sn-color-success)';
  } else if (delta < 0) {
    deltaEl.textContent =
      browser.i18n.getMessage('dashboard_score_delta_down', String(Math.abs(delta))) ||
      `↓ ${Math.abs(delta)} points cette semaine`;
    deltaEl.style.color = 'var(--sn-color-danger)';
  } else {
    deltaEl.textContent =
      browser.i18n.getMessage('dashboard_score_delta_equal') || '= Stable cette semaine';
    deltaEl.style.color = 'var(--sn-color-muted)';
  }

  section.appendChild(deltaEl);

  // Semaine courante
  const weekEl = document.createElement('p');
  weekEl.className = 'score-week';
  weekEl.textContent = formatWeekLabel(current.week_key);
  weekEl.style.color = 'var(--sn-color-muted)';
  section.appendChild(weekEl);

  container.appendChild(section);
}

/**
 * Construit le graphique SVG histogramme (DAT §11.5).
 *
 * Construction programmatique via createElementNS — jamais innerHTML.
 * Barres colorées vert/orange/rouge selon le score.
 * Accessible via role="img" + <title> + <desc> + table sr-only.
 *
 * @param container  - Élément parent
 * @param scores     - Historique des scores (52 max, triés du plus récent au plus ancien)
 */
function renderChart(container: HTMLElement, scores: WeeklyScoreData[]): void {
  const section = document.createElement('section');
  section.className = 'dashboard-section chart-section';
  section.setAttribute('aria-label', 'Historique des scores');

  const h2 = document.createElement('h2');
  h2.className = 'section-title';
  h2.textContent = browser.i18n.getMessage('dashboard_chart_title') || 'Historique 52 semaines';
  section.appendChild(h2);

  if (scores.length === 0) {
    const noDataEl = document.createElement('p');
    noDataEl.className = 'no-data';
    noDataEl.textContent =
      browser.i18n.getMessage('dashboard_score_no_data') || 'Aucune donnée disponible';
    section.appendChild(noDataEl);
    container.appendChild(section);
    return;
  }

  // Afficher au plus 52 semaines (du plus ancien au plus récent pour le graphique)
  const displayScores = [...scores].reverse().slice(0, 52);

  const svgNS = 'http://www.w3.org/2000/svg';
  const totalBars = displayScores.length;
  const svgWidth = totalBars * (BAR_WIDTH + BAR_GAP) + BAR_GAP;
  const svgHeight = CHART_HEIGHT + 20; // 20px pour les labels

  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
  svg.setAttribute('width', String(Math.min(svgWidth, 800)));
  svg.setAttribute('height', String(svgHeight));
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-labelledby', 'chart-title chart-desc');

  // Titre accessible
  const titleEl = document.createElementNS(svgNS, 'title');
  titleEl.id = 'chart-title';
  titleEl.textContent =
    browser.i18n.getMessage('dashboard_chart_title') ||
    'Score de cyber-hygiène — 52 dernières semaines';
  svg.appendChild(titleEl);

  // Description accessible
  const descEl = document.createElementNS(svgNS, 'desc');
  descEl.id = 'chart-desc';
  descEl.textContent =
    browser.i18n.getMessage('dashboard_chart_desc') ||
    'Graphique en barres représentant le score hebdomadaire de cyber-hygiène sur les 52 dernières semaines.';
  svg.appendChild(descEl);

  // Ligne de référence "objectif 70"
  const refY = CHART_HEIGHT - (SCORE_GREEN / 100) * CHART_HEIGHT;
  const refLine = document.createElementNS(svgNS, 'line');
  refLine.setAttribute('x1', '0');
  refLine.setAttribute('y1', String(refY));
  refLine.setAttribute('x2', String(svgWidth));
  refLine.setAttribute('y2', String(refY));
  refLine.setAttribute('stroke', SVG_COLOR_SUCCESS);
  refLine.setAttribute('stroke-width', '1');
  refLine.setAttribute('stroke-dasharray', '4 4');
  refLine.setAttribute('opacity', '0.5');
  refLine.setAttribute('aria-hidden', 'true');
  svg.appendChild(refLine);

  // Barres
  displayScores.forEach((scoreData, index) => {
    const x = BAR_GAP + index * (BAR_WIDTH + BAR_GAP);
    const barHeight = Math.max(2, (scoreData.total_score / 100) * CHART_HEIGHT);
    const y = CHART_HEIGHT - barHeight;

    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', String(BAR_WIDTH));
    rect.setAttribute('height', String(barHeight));
    rect.setAttribute('fill', scoreColorHex(scoreData.total_score));
    rect.setAttribute('rx', '2');
    rect.setAttribute('aria-hidden', 'true');

    svg.appendChild(rect);

    // Label semaine sous la barre (toutes les 4 barres pour lisibilité)
    if (index % 4 === 0 || index === totalBars - 1) {
      const label = document.createElementNS(svgNS, 'text');
      label.setAttribute('x', String(x + BAR_WIDTH / 2));
      label.setAttribute('y', String(CHART_HEIGHT + 14));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '9');
      label.setAttribute('fill', SVG_COLOR_MUTED);
      label.setAttribute('aria-hidden', 'true');
      label.textContent = formatWeekLabel(scoreData.week_key);
      svg.appendChild(label);
    }
  });

  // Wrapper scrollable pour les 52 semaines
  const chartWrapper = document.createElement('div');
  chartWrapper.className = 'chart-wrapper';
  chartWrapper.appendChild(svg);
  section.appendChild(chartWrapper);

  // Table sr-only pour les technologies d'assistance (DAT §11.5)
  const table = document.createElement('table');
  table.className = 'sr-only';
  table.setAttribute(
    'aria-label',
    browser.i18n.getMessage('dashboard_chart_table_label') ||
      'Données du graphique : scores hebdomadaires',
  );

  const caption = document.createElement('caption');
  caption.textContent =
    browser.i18n.getMessage('dashboard_chart_table_caption') ||
    'Score de cyber-hygiène par semaine (52 semaines)';
  table.appendChild(caption);

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  const thWeek = document.createElement('th');
  thWeek.scope = 'col';
  thWeek.textContent = browser.i18n.getMessage('dashboard_table_col_week') || 'Semaine';
  headerRow.appendChild(thWeek);

  const thScore = document.createElement('th');
  thScore.scope = 'col';
  thScore.textContent = browser.i18n.getMessage('dashboard_table_col_score') || 'Score';
  headerRow.appendChild(thScore);

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  // Afficher les 52 semaines dans le tableau (du plus récent au plus ancien)
  for (const scoreData of scores.slice(0, 52)) {
    const tr = document.createElement('tr');

    const tdWeek = document.createElement('td');
    tdWeek.textContent = scoreData.week_key;
    tr.appendChild(tdWeek);

    const tdScore = document.createElement('td');
    tdScore.textContent = `${scoreData.total_score}/100`;
    tr.appendChild(tdScore);

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  section.appendChild(table);

  container.appendChild(section);
}

/**
 * Construit la section "Détail par composante".
 *
 * Affiche 5 barres de progression (une par composante active) :
 * M5 (20%), M6 (25%), M2 (20%), M7 (20%), M9 (15%)
 *
 * @param container - Élément parent
 * @param scores    - Historique des scores (le premier est le courant)
 */
function renderComponents(container: HTMLElement, scores: WeeklyScoreData[]): void {
  const section = document.createElement('section');
  section.className = 'dashboard-section components-section';
  section.setAttribute('aria-label', 'Détail par composante');

  const h2 = document.createElement('h2');
  h2.className = 'section-title';
  h2.textContent = browser.i18n.getMessage('dashboard_components_title') || 'Détail par composante';
  section.appendChild(h2);

  if (scores.length === 0) {
    const noDataEl = document.createElement('p');
    noDataEl.className = 'no-data';
    noDataEl.textContent = browser.i18n.getMessage('dashboard_score_no_data') || 'Aucune donnée';
    section.appendChild(noDataEl);
    container.appendChild(section);
    return;
  }

  const current = scores[0];
  const components: Array<{
    key: string;
    labelKey: string;
    maxPoints: number;
  }> = [
    { key: 'M5', labelKey: 'dashboard_component_m5', maxPoints: 20 },
    { key: 'M6', labelKey: 'dashboard_component_m6', maxPoints: 25 },
    { key: 'M2', labelKey: 'dashboard_component_m2', maxPoints: 20 },
    { key: 'M7', labelKey: 'dashboard_component_m7', maxPoints: 20 },
    { key: 'M9', labelKey: 'dashboard_component_m9', maxPoints: 15 },
  ];

  // Action recommandée : composante la plus faible
  let weakestKey = '';
  let weakestRatio = 1;

  for (const comp of components) {
    const raw = current.components[comp.key] ?? 0;
    const ratio = raw / comp.maxPoints;

    const row = document.createElement('div');
    row.className = 'component-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'component-label';
    labelEl.textContent = browser.i18n.getMessage(comp.labelKey) || comp.key;
    row.appendChild(labelEl);

    const barWrapper = document.createElement('div');
    barWrapper.className = 'component-bar-wrapper';
    barWrapper.setAttribute('role', 'meter');
    barWrapper.setAttribute('aria-label', browser.i18n.getMessage(comp.labelKey) || comp.key);
    barWrapper.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
    barWrapper.setAttribute('aria-valuemin', '0');
    barWrapper.setAttribute('aria-valuemax', '100');
    barWrapper.setAttribute('aria-valuetext', `${Math.round(ratio * 100)}%`);

    const barFill = document.createElement('div');
    barFill.className = 'component-bar-fill';
    barFill.style.width = `${Math.min(100, Math.round(ratio * 100))}%`;
    barFill.style.backgroundColor = scoreColorToken(ratio * 100);
    barWrapper.appendChild(barFill);

    row.appendChild(barWrapper);

    const scoreEl = document.createElement('span');
    scoreEl.className = 'component-score';
    scoreEl.textContent = `${raw}/${comp.maxPoints}`;
    scoreEl.setAttribute('aria-hidden', 'true');
    row.appendChild(scoreEl);

    section.appendChild(row);

    if (ratio < weakestRatio) {
      weakestRatio = ratio;
      weakestKey = comp.labelKey;
    }
  }

  // Action recommandée basée sur la composante la plus faible
  if (weakestKey && current.action_recommandee) {
    const actionSection = document.createElement('div');
    actionSection.className = 'action-recommended';
    actionSection.setAttribute('aria-label', 'Action recommandée');

    const actionTitle = document.createElement('h3');
    actionTitle.className = 'action-title';
    actionTitle.textContent =
      browser.i18n.getMessage('dashboard_action_title') || 'Action recommandée';
    actionSection.appendChild(actionTitle);

    const actionText = document.createElement('p');
    actionText.className = 'action-text';
    actionText.textContent = current.action_recommandee;
    actionSection.appendChild(actionText);

    section.appendChild(actionSection);
  }

  container.appendChild(section);
}

/**
 * Construit la section "Statistiques nudges".
 *
 * @param container       - Élément parent
 * @param nudgesThisWeek  - Nombre de nudges affichés cette semaine
 * @param responseRate    - Taux de réponse (0-100)
 */
function renderNudgeStats(
  container: HTMLElement,
  nudgesThisWeek: number,
  responseRate: number,
): void {
  const section = document.createElement('section');
  section.className = 'dashboard-section nudges-section';
  section.setAttribute('aria-label', 'Statistiques nudges');

  const h2 = document.createElement('h2');
  h2.className = 'section-title';
  h2.textContent = browser.i18n.getMessage('dashboard_nudges_title') || 'Statistiques nudges';
  section.appendChild(h2);

  const nudgesEl = document.createElement('p');
  nudgesEl.className = 'stat-line';
  nudgesEl.textContent =
    browser.i18n.getMessage('dashboard_nudges_this_week', String(nudgesThisWeek)) ||
    `Nudges affichés cette semaine : ${nudgesThisWeek}`;
  section.appendChild(nudgesEl);

  const rateEl = document.createElement('p');
  rateEl.className = 'stat-line';
  rateEl.textContent =
    browser.i18n.getMessage('dashboard_nudges_response_rate', String(responseRate)) ||
    `Taux de réponse : ${responseRate} %`;
  section.appendChild(rateEl);

  container.appendChild(section);
}

/**
 * Construit la section "Quiz M6".
 *
 * @param container   - Élément parent
 * @param sessions    - Sessions quiz (triées du plus récent au plus ancien)
 */
function renderQuizSection(container: HTMLElement, sessions: QuizSessionData[]): void {
  const section = document.createElement('section');
  section.className = 'dashboard-section quiz-section';
  section.setAttribute('aria-label', 'Quiz');

  const h2 = document.createElement('h2');
  h2.className = 'section-title';
  h2.textContent =
    browser.i18n.getMessage('dashboard_quiz_title') || 'Quiz — Résistance au phishing';
  section.appendChild(h2);

  if (sessions.length === 0) {
    const noDataEl = document.createElement('p');
    noDataEl.className = 'no-data';
    noDataEl.textContent =
      browser.i18n.getMessage('dashboard_quiz_no_session') || "Aucun quiz effectué pour l'instant.";
    section.appendChild(noDataEl);
    container.appendChild(section);
    return;
  }

  const last = sessions[0];

  const scoreEl = document.createElement('p');
  scoreEl.className = 'stat-line';
  scoreEl.textContent =
    browser.i18n.getMessage('dashboard_quiz_last_score', String(last.score_pct)) ||
    `Dernier score : ${last.score_pct} %`;
  scoreEl.style.color = scoreColorToken(last.score_pct);
  section.appendChild(scoreEl);

  if (last.next_quiz_date) {
    const nextEl = document.createElement('p');
    nextEl.className = 'stat-line';
    nextEl.textContent =
      browser.i18n.getMessage('dashboard_quiz_next_date', formatDate(last.next_quiz_date)) ||
      `Prochain quiz : ${formatDate(last.next_quiz_date)}`;
    section.appendChild(nextEl);
  }

  container.appendChild(section);
}

/**
 * Construit le bouton "Ouvrir les paramètres".
 *
 * @param container - Élément parent
 */
function renderSettingsButton(container: HTMLElement): void {
  const btnWrapper = document.createElement('div');
  btnWrapper.className = 'settings-btn-wrapper';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-secondary';
  btn.textContent = browser.i18n.getMessage('dashboard_btn_settings') || 'Ouvrir les paramètres';
  btn.addEventListener('click', () => {
    const optionsUrl = browser.runtime.id
      ? `chrome-extension://${browser.runtime.id}/pages/options/options.html`
      : '';
    if (optionsUrl) {
      void browser.tabs.create({ url: optionsUrl });
    }
  });

  btnWrapper.appendChild(btn);
  container.appendChild(btnWrapper);
}

/**
 * Récupère les données du dashboard depuis le service worker.
 *
 * Envoie des messages au SW pour :
 * - scores hebdomadaires M3 (get_scores_history)
 * - sessions quiz M6 (get_quiz_sessions)
 * - statistiques nudges (get_nudge_stats)
 *
 * @returns Données consolidées ou données vides si indisponibles
 */
async function fetchDashboardData(): Promise<DashboardData> {
  let scores: WeeklyScoreData[] = [];
  let quizSessions: QuizSessionData[] = [];
  let nudgesThisWeek = 0;
  let responseRate = 0;

  try {
    const scoresResponse = (await browser.runtime.sendMessage({
      module: 'M3',
      action: 'get_scores_history',
      payload: { limit: 52 },
      timestamp: Date.now(),
    })) as Record<string, unknown> | null;

    if (
      scoresResponse?.['success'] === true &&
      Array.isArray((scoresResponse['data'] as Record<string, unknown>)?.['scores'])
    ) {
      scores = (scoresResponse['data'] as Record<string, unknown>)['scores'] as WeeklyScoreData[];
    }
  } catch {
    // Dégradation gracieuse : pas de scores
  }

  try {
    const quizResponse = (await browser.runtime.sendMessage({
      module: 'M6',
      action: 'get_quiz_sessions',
      payload: {},
      timestamp: Date.now(),
    })) as Record<string, unknown> | null;

    if (
      quizResponse?.['success'] === true &&
      Array.isArray((quizResponse['data'] as Record<string, unknown>)?.['sessions'])
    ) {
      quizSessions = (quizResponse['data'] as Record<string, unknown>)[
        'sessions'
      ] as QuizSessionData[];
    }
  } catch {
    // Dégradation gracieuse : pas de sessions quiz
  }

  try {
    const statsResponse = (await browser.runtime.sendMessage({
      module: 'M3',
      action: 'get_nudge_stats',
      payload: {},
      timestamp: Date.now(),
    })) as Record<string, unknown> | null;

    if (statsResponse?.['success'] === true && statsResponse['data']) {
      const data = statsResponse['data'] as Record<string, unknown>;
      nudgesThisWeek = typeof data['nudges_this_week'] === 'number' ? data['nudges_this_week'] : 0;
      responseRate = typeof data['response_rate'] === 'number' ? data['response_rate'] : 0;
    }
  } catch {
    // Dégradation gracieuse : stats à zéro
  }

  return { scores, quizSessions, nudgesThisWeek, responseRate };
}

/**
 * Point d'entrée principal : initialise le tableau de bord.
 *
 * @returns Promise<void>
 */
async function initDashboard(): Promise<void> {
  const root = document.getElementById('dashboard-root');
  if (!root) return;

  // En-tête
  const h1 = document.createElement('h1');
  h1.className = 'page-title';
  h1.textContent = browser.i18n.getMessage('dashboard_title') || 'Tableau de bord — Sentinel Nudge';
  root.appendChild(h1);

  // État de chargement
  const loadingEl = document.createElement('p');
  loadingEl.className = 'loading-text';
  loadingEl.setAttribute('aria-live', 'polite');
  loadingEl.textContent =
    browser.i18n.getMessage('dashboard_loading') || 'Chargement du tableau de bord…';
  root.appendChild(loadingEl);

  try {
    const data = await fetchDashboardData();

    root.removeChild(loadingEl);

    const main = document.createElement('main');
    main.className = 'dashboard-main';

    renderCurrentScore(main, data.scores);
    renderChart(main, data.scores);
    renderComponents(main, data.scores);
    renderNudgeStats(main, data.nudgesThisWeek, data.responseRate);
    renderQuizSection(main, data.quizSessions);
    renderSettingsButton(main);

    root.appendChild(main);
  } catch (err: unknown) {
    root.removeChild(loadingEl);

    const errorEl = document.createElement('p');
    errorEl.className = 'error-text';
    errorEl.setAttribute('role', 'alert');
    errorEl.textContent = 'Impossible de charger le tableau de bord.';
    root.appendChild(errorEl);

    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Dashboard: erreur initialisation',
        context: { error: message },
      }),
    );
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Appliquer le thème AVANT le rendu pour éviter le FOUC (TACHE-148)
  void initTheme();
  watchThemeChanges();
  initDashboard().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Dashboard: erreur inattendue',
        context: { error: message },
      }),
    );
  });
});
