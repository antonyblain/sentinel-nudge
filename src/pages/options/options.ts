/**
 * @file pages/options/options.ts
 * @description Script de la page de configuration Sentinel Nudge.
 *
 * La page Options expose :
 * - Section Modules : 7 toggles on/off avec descriptions
 * - Section Quota : select (3 / 5 / 10 / Tous) + avertissement si Tous
 * - Section Profil : radio buttons (Débutant / Intermédiaire / Avancé)
 * - Section Langue : select FR/EN
 * - Section Accessibilité : toggle auto-dismiss des toasts (WCAG 2.2.1)
 * - Section Données : export RGPD Art. 20, suppression RGPD Art. 17, reset whitelist
 * - Section Transparence radicale : liens vers pages d'explication par module
 * - Section À propos : version, GitHub, licence GPL v3
 *
 * Technique :
 * - Charge la config depuis chrome.storage.local au démarrage
 * - Sauvegarde chaque changement immédiatement via browser.storage.local.set
 * - Export : récupère les données réelles via le service worker, télécharge via
 *   URL.createObjectURL + <a download>
 * - Suppression : dialogue HTML accessible (alertdialog) au lieu de window.confirm(),
 *   puis indexedDB.deleteDatabase + chrome.storage.local.clear
 *
 * Accessibilité :
 * - Labels associés à chaque input, fieldsets par section
 * - Cibles 44×44px, contraste 4.5:1
 * - Dialogue de suppression avec role="alertdialog", aria-modal, focus trap, Escape
 *
 * Sécurité :
 * - D-SEC-003 : Aucun innerHTML. Tout DOM via createElement/textContent/appendChild.
 * - Aucun window.confirm() — dialogue accessible à la place.
 *
 * Référence : DAT §3.1 (Options), §8.3 (RGPD), §9.4 (D-SEC), SFD §3.4
 */

import { browser } from '@/shared/browser/browser-adapter';
import { initTheme, watchThemeChanges } from '@/shared/utils/apply-theme';
import type {
  ExportPayload,
  EventPayload,
  QuizSession,
  WeeklyScore,
  WhitelistEntry,
} from '@/shared/types/storage';
import type { ModuleId } from '@/shared/types/modules';
import type { M7IncidentRecord } from '@/shared/types/diagnostics';
import { createLogger, Logger } from '@/shared/utils/logger';

/** Logger scopé — Options (INV-SEC-02 étendu) */
const logger = createLogger('Options');

/**
 * Wrapper de rechargement de page — extrait pour permettre le spy en test (T-198).
 *
 * En production, appelle window.location.reload().
 * En test, peut être remplacé par un vi.spyOn sur cet objet.
 *
 * @internal
 */
export const _reloadPage: { fn: () => void } = {
  fn: () => window.location.reload(),
};

/** Version de l'extension (lue depuis le manifest) */
const EXTENSION_VERSION = (browser.runtime.getManifest() as { version: string }).version;

/** URL GitHub du projet */
const GITHUB_URL = 'https://github.com/antonyblain/sentinel-nudge';

/** URL de la politique de confidentialité */
const PRIVACY_URL = browser.runtime.getURL('pages/static/politique-confidentialite.html');

/** Clés i18n et identifiants des 7 modules v1 */
const MODULE_INFOS: Array<{
  id: ModuleId;
  nameKey: string;
  descKey: string;
  explainPage: string;
}> = [
  {
    id: 'M2',
    nameKey: 'module_m2_name',
    descKey: 'module_m2_desc',
    explainPage: 'sites-suspects.html',
  },
  {
    id: 'M3',
    nameKey: 'module_m3_name',
    descKey: 'module_m3_desc',
    explainPage: 'score-cyber-hygiene.html',
  },
  {
    id: 'M5',
    nameKey: 'module_m5_name',
    descKey: 'module_m5_desc',
    explainPage: 'mise-a-jour-navigateur.html',
  },
  {
    id: 'M6',
    nameKey: 'module_m6_name',
    descKey: 'module_m6_desc',
    explainPage: 'quiz-phishing.html',
  },
  {
    id: 'M7',
    nameKey: 'module_m7_name',
    descKey: 'module_m7_desc',
    explainPage: 'reutilisation-mots-de-passe.html',
  },
  {
    id: 'M9',
    nameKey: 'module_m9_name',
    descKey: 'module_m9_desc',
    explainPage: 'force-mots-de-passe.html',
  },
  {
    id: 'M17',
    nameKey: 'module_m17_name',
    descKey: 'module_m17_desc',
    explainPage: 'donnees-sensibles-presse-papiers.html',
  },
];

/**
 * Type de la configuration stockée dans chrome.storage.local.
 */
/** Type de valeur du thème de l'interface (TACHE-147). */
type ThemeValue = 'auto' | 'light' | 'dark' | 'matrix';

interface StoredConfig {
  modules: Record<ModuleId, boolean>;
  quota_limit: 3 | 5 | 10 | null;
  profile: 'beginner' | 'intermediate' | 'advanced';
  language: 'fr' | 'en';
  onboarding_complete: boolean;
  toast_auto_dismiss?: boolean;
  /** Thème retenu par l'utilisateur ('auto' = suit l'OS). */
  theme?: ThemeValue;
}

/**
 * Réponse du SW pour l'export des scores hebdomadaires.
 */
interface GetAllScoresResponse {
  success: boolean;
  scores?: WeeklyScore[];
  error?: string;
}

/**
 * Réponse du SW pour l'export des événements.
 */
interface GetAllEventsResponse {
  success: boolean;
  events?: EventPayload[];
  error?: string;
}

/**
 * Réponse du SW pour l'export des sessions quiz.
 */
interface GetAllQuizSessionsResponse {
  success: boolean;
  sessions?: QuizSession[];
  error?: string;
}

/**
 * Réponse du SW pour l'export des entrées whitelist.
 */
interface GetWhitelistResponse {
  success: boolean;
  whitelist?: WhitelistEntry[];
  error?: string;
}

/**
 * Réponse du SW pour les métadonnées des hashes de mots de passe.
 */
interface GetPasswordHashMetaResponse {
  success: boolean;
  count?: number;
  oldest?: string;
  newest?: string;
  error?: string;
}
/**
 * Réponse du SW pour l'export du registre d'incidents techniques (m7_incidents).
 *
 * R-074-03 (Art. 5.1.c RGPD — minimisation) : ce registre N'EST PAS exporté
 * par défaut (Art. 20 portabilité). Il est disponible uniquement via l'opt-in
 * utilisateur « avancé ».
 */
interface GetAllIncidentsResponse {
  success: boolean;
  incidents?: M7IncidentRecord[];
  error?: string;
}

/**
 * Crée un élément section avec fieldset + legend accessible.
 *
 * @param legendText - Texte de la légende (titre de section)
 * @returns Tuple [section, fieldset]
 */
function createSection(legendText: string): [HTMLElement, HTMLFieldSetElement] {
  const section = document.createElement('section');
  section.className = 'options-section';

  const fieldset = document.createElement('fieldset');
  fieldset.className = 'options-fieldset';

  const legend = document.createElement('legend');
  legend.className = 'options-legend';
  legend.textContent = legendText;
  fieldset.appendChild(legend);

  section.appendChild(fieldset);
  return [section, fieldset];
}

/**
 * Crée un toggle switch (checkbox + label) pour activer/désactiver un module.
 *
 * @param moduleId   - Identifiant du module
 * @param nameText   - Nom affiché
 * @param descText   - Description courte
 * @param checked    - État initial
 * @param onChange   - Callback appelé au changement d'état
 * @returns Élément div du toggle
 */
function createModuleToggle(
  moduleId: ModuleId,
  nameText: string,
  descText: string,
  checked: boolean,
  onChange: (id: ModuleId, value: boolean) => void,
): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'module-toggle';

  const inputId = `module-toggle-${moduleId}`;

  const labelWrapper = document.createElement('div');
  labelWrapper.className = 'module-toggle-label-wrapper';

  const label = document.createElement('label');
  label.htmlFor = inputId;
  label.className = 'module-toggle-name';
  label.textContent = nameText;
  labelWrapper.appendChild(label);

  const desc = document.createElement('p');
  desc.className = 'module-toggle-desc';
  desc.id = `module-desc-${moduleId}`;
  desc.textContent = descText;
  labelWrapper.appendChild(desc);

  wrapper.appendChild(labelWrapper);

  // T-197 : switchWrapper est un <label> lie au checkbox par htmlFor.
  // Cela garantit que cliquer sur le switch visuel (span.toggle-switch)
  // declenche bien le changement d'etat du checkbox -- contrairement a un <div>
  // qui ne propage pas le clic vers l'input associe.
  const switchWrapper = document.createElement('label');
  switchWrapper.htmlFor = inputId;
  switchWrapper.className = 'toggle-switch-wrapper';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = inputId;
  input.className = 'toggle-input sr-only';
  input.checked = checked;
  input.setAttribute('aria-describedby', `module-desc-${moduleId}`);
  input.addEventListener('change', () => {
    onChange(moduleId, input.checked);
  });

  const switchVisual = document.createElement('span');
  switchVisual.className = 'toggle-switch';
  switchVisual.setAttribute('aria-hidden', 'true');

  switchWrapper.appendChild(input);
  switchWrapper.appendChild(switchVisual);
  wrapper.appendChild(switchWrapper);

  return wrapper;
}

/**
 * Affiche brièvement un message de confirmation "Enregistré" dans l'élément donné.
 *
 * @param el - Élément où afficher la confirmation
 */
function showSavedFeedback(_el: HTMLElement): void {
  // Toast fixe en bas de page, visible quel que soit le scroll
  const existingToast = document.getElementById('sn-options-toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.id = 'sn-options-toast';
  toast.className = 'options-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = browser.i18n.getMessage('options_saved') || '✓ Enregistré';
  document.body.appendChild(toast);

  // Animation d'entrée
  requestAnimationFrame(() => {
    toast.classList.add('options-toast-visible');
  });

  setTimeout(() => {
    toast.classList.remove('options-toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 1500);
}

/**
 * Sauvegarde immédiate de la configuration dans chrome.storage.local.
 *
 * @param patch       - Mise à jour partielle de la config
 * @param feedbackEl  - Élément de feedback visuel (optionnel)
 */
async function saveConfig(patch: Partial<StoredConfig>, feedbackEl?: HTMLElement): Promise<void> {
  try {
    const current = await browser.storage.local.get(['config']);
    const existing = (current['config'] as Partial<StoredConfig>) ?? {};
    const updated = { ...existing, ...patch };
    await browser.storage.local.set({ config: updated });
    if (feedbackEl) showSavedFeedback(feedbackEl);
  } catch (err: unknown) {
    logger.error('Options: échec sauvegarde config', {
      error_name: Logger.errorName(err),
    });
  }
}

/**
 * Construit la section Modules.
 *
 * @param root    - Élément parent
 * @param config  - Configuration courante
 * @param feedbackEl - Élément feedback global
 */
function renderModulesSection(
  root: HTMLElement,
  config: StoredConfig,
  feedbackEl: HTMLElement,
): void {
  const [section, fieldset] = createSection(
    browser.i18n.getMessage('options_section_modules') || 'Modules actifs',
  );

  for (const mod of MODULE_INFOS) {
    const nameText = browser.i18n.getMessage(mod.nameKey) || mod.id;
    const descText = browser.i18n.getMessage(mod.descKey) || '';
    const enabled = config.modules[mod.id] ?? mod.id !== 'M7';

    const toggle = createModuleToggle(mod.id, nameText, descText, enabled, (id, value) => {
      const patch: Partial<StoredConfig> = {
        modules: { ...config.modules, [id]: value },
      };
      config.modules[id] = value;
      saveConfig(patch, feedbackEl).catch(() => undefined);
    });
    fieldset.appendChild(toggle);
  }

  root.appendChild(section);
}

/**
 * Construit la section Quota.
 *
 * @param root    - Élément parent
 * @param config  - Configuration courante
 * @param feedbackEl - Élément feedback global
 */
function renderQuotaSection(
  root: HTMLElement,
  config: StoredConfig,
  feedbackEl: HTMLElement,
): void {
  const [section, fieldset] = createSection(
    browser.i18n.getMessage('options_section_quota') || 'Quota journalier',
  );

  const selectId = 'quota-select';
  const label = document.createElement('label');
  label.htmlFor = selectId;
  label.className = 'form-label';
  label.textContent = browser.i18n.getMessage('options_section_quota') || 'Quota journalier';
  fieldset.appendChild(label);

  const select = document.createElement('select');
  select.id = selectId;
  select.className = 'form-select';
  select.setAttribute('aria-label', 'Nombre maximum de nudges par jour');

  const options: Array<{ value: string; label: string }> = [
    { value: '3', label: '3 nudges / jour' },
    { value: '5', label: '5 nudges / jour' },
    { value: '10', label: '10 nudges / jour' },
    { value: 'unlimited', label: 'Tous (illimité)' },
  ];

  for (const opt of options) {
    const el = document.createElement('option');
    el.value = opt.value;
    el.textContent = opt.label;
    const currentValue = config.quota_limit === null ? 'unlimited' : String(config.quota_limit);
    if (opt.value === currentValue) el.selected = true;
    select.appendChild(el);
  }

  // Avertissement quota illimité
  const warning = document.createElement('p');
  warning.className = 'quota-warning';
  warning.setAttribute('role', 'alert');
  warning.textContent =
    browser.i18n.getMessage('options_quota_warning') ||
    'Attention : en mode Tous, les nudges ne sont pas limités.';
  warning.style.display = config.quota_limit === null ? 'block' : 'none';

  select.addEventListener('change', () => {
    const newValue =
      select.value === 'unlimited' ? null : (parseInt(select.value, 10) as 3 | 5 | 10);
    warning.style.display = newValue === null ? 'block' : 'none';
    config.quota_limit = newValue;
    saveConfig({ quota_limit: newValue }, feedbackEl).catch(() => undefined);
  });

  fieldset.appendChild(select);
  fieldset.appendChild(warning);
  root.appendChild(section);
}

/**
 * Construit la section Profil.
 *
 * @param root    - Élément parent
 * @param config  - Configuration courante
 * @param feedbackEl - Élément feedback global
 */
function renderProfileSection(
  root: HTMLElement,
  config: StoredConfig,
  feedbackEl: HTMLElement,
): void {
  const [section, fieldset] = createSection(
    browser.i18n.getMessage('options_section_profile') || 'Profil',
  );

  const profiles: Array<{
    value: 'beginner' | 'intermediate' | 'advanced';
    nameKey: string;
    descKey: string;
  }> = [
    {
      value: 'beginner',
      nameKey: 'options_profile_beginner',
      descKey: 'options_profile_beginner_desc',
    },
    {
      value: 'intermediate',
      nameKey: 'options_profile_intermediate',
      descKey: 'options_profile_intermediate_desc',
    },
    {
      value: 'advanced',
      nameKey: 'options_profile_advanced',
      descKey: 'options_profile_advanced_desc',
    },
  ];

  for (const profile of profiles) {
    const radioId = `profile-${profile.value}`;
    const wrapper = document.createElement('div');
    wrapper.className = 'radio-option';

    const input = document.createElement('input');
    input.type = 'radio';
    input.id = radioId;
    input.name = 'user-profile';
    input.value = profile.value;
    input.checked = config.profile === profile.value;
    input.className = 'radio-input';
    input.setAttribute('aria-describedby', `profile-desc-${profile.value}`);
    input.addEventListener('change', () => {
      if (input.checked) {
        config.profile = profile.value;
        saveConfig({ profile: profile.value }, feedbackEl).catch(() => undefined);
      }
    });

    const label = document.createElement('label');
    label.htmlFor = radioId;
    label.className = 'radio-label';
    label.textContent = browser.i18n.getMessage(profile.nameKey) || profile.value;

    const desc = document.createElement('p');
    desc.id = `profile-desc-${profile.value}`;
    desc.className = 'radio-desc';
    desc.textContent = browser.i18n.getMessage(profile.descKey) || '';

    wrapper.appendChild(input);
    wrapper.appendChild(label);
    wrapper.appendChild(desc);
    fieldset.appendChild(wrapper);
  }

  root.appendChild(section);
}

/**
 * Construit la section Langue.
 *
 * @param root    - Élément parent
 * @param config  - Configuration courante
 * @param feedbackEl - Élément feedback global
 */
function renderLanguageSection(
  root: HTMLElement,
  config: StoredConfig,
  feedbackEl: HTMLElement,
): void {
  const [section, fieldset] = createSection(
    browser.i18n.getMessage('options_section_language') || 'Langue',
  );

  const selectId = 'language-select';
  const label = document.createElement('label');
  label.htmlFor = selectId;
  label.className = 'form-label';
  label.textContent = browser.i18n.getMessage('options_section_language') || 'Langue';
  fieldset.appendChild(label);

  const select = document.createElement('select');
  select.id = selectId;
  select.className = 'form-select';

  const langs: Array<{ value: 'fr' | 'en'; key: string }> = [
    { value: 'fr', key: 'options_lang_fr' },
    { value: 'en', key: 'options_lang_en' },
  ];

  for (const lang of langs) {
    const opt = document.createElement('option');
    opt.value = lang.value;
    opt.textContent = browser.i18n.getMessage(lang.key) || lang.value;
    if (config.language === lang.value) opt.selected = true;
    select.appendChild(opt);
  }

  select.addEventListener('change', () => {
    const newLang = select.value as 'fr' | 'en';
    config.language = newLang;
    // T-198 : saveConfig puis reload pour que chrome.i18n.getMessage
    // ré-initialise depuis la nouvelle locale (l'API chrome.i18n est figée
    // au chargement du navigateur et ne réagit pas aux changements de storage).
    saveConfig({ language: newLang }, feedbackEl)
      .then(() => {
        logger.info('Options: langue changée, rechargement de la page', {
          language: newLang,
        });
        _reloadPage.fn();
      })
      .catch(() => undefined);
  });

  fieldset.appendChild(select);
  root.appendChild(section);
}

/**
 * Construit la section Accessibilité.
 *
 * @param root    - Élément parent
 * @param config  - Configuration courante
 * @param feedbackEl - Élément feedback global
 */
function renderAccessibilitySection(
  root: HTMLElement,
  config: StoredConfig,
  feedbackEl: HTMLElement,
): void {
  const [section, fieldset] = createSection(
    browser.i18n.getMessage('options_accessibility_section') || 'Accessibilité',
  );

  const inputId = 'toast-auto-dismiss';
  const wrapper = document.createElement('div');
  wrapper.className = 'toggle-row';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = inputId;
  input.className = 'toggle-checkbox';
  input.checked = config.toast_auto_dismiss !== false;
  input.addEventListener('change', () => {
    const newValue = input.checked;
    config.toast_auto_dismiss = newValue;
    saveConfig({ toast_auto_dismiss: newValue } as Partial<StoredConfig>, feedbackEl).catch(
      () => undefined,
    );
  });

  const label = document.createElement('label');
  label.htmlFor = inputId;
  label.className = 'toggle-label';
  label.textContent =
    browser.i18n.getMessage('options_toast_auto_dismiss') ||
    'Masquer automatiquement les notifications';

  wrapper.appendChild(input);
  wrapper.appendChild(label);
  fieldset.appendChild(wrapper);
  root.appendChild(section);
}

/**
 * Construit la section Apparence (sélecteur de thème 4 positions).
 *
 * Persiste la valeur dans `chrome.storage.local` clé `theme`.
 * Valeurs : 'auto' | 'light' | 'dark' | 'matrix'.
 * Applique immédiatement `data-theme` sur `<html>` (sauf 'auto').
 *
 * Accessibilité :
 * - radiogroup avec aria-label (WCAG 1.3.1, 4.1.2)
 * - focus visible via CSS
 * - navigation clavier flèches native (radiogroup behavior)
 *
 * @param root       - Élément parent
 * @param config     - Configuration courante (champ theme)
 * @param feedbackEl - Élément feedback global
 */
function renderAppearanceSection(
  root: HTMLElement,
  config: StoredConfig,
  feedbackEl: HTMLElement,
): void {
  const [section, fieldset] = createSection(
    browser.i18n.getMessage('options_section_appearance') || 'Apparence',
  );

  // Le fieldset fait office de radiogroup
  fieldset.setAttribute('role', 'radiogroup');
  fieldset.setAttribute(
    'aria-label',
    browser.i18n.getMessage('options_theme_label') || "Thème de l'interface",
  );

  const themeOptions: Array<{ value: ThemeValue; key: string; defaultLabel: string }> = [
    { value: 'auto', key: 'options_theme_auto', defaultLabel: 'Auto (OS)' },
    { value: 'light', key: 'options_theme_light', defaultLabel: 'Clair' },
    { value: 'dark', key: 'options_theme_dark', defaultLabel: 'Sombre' },
    { value: 'matrix', key: 'options_theme_matrix', defaultLabel: 'Matrix' },
  ];

  const currentTheme: ThemeValue = config.theme ?? 'auto';

  for (const opt of themeOptions) {
    const radioId = `theme-${opt.value}`;
    const wrapper = document.createElement('div');
    wrapper.className = 'radio-option theme-radio-option';

    const input = document.createElement('input');
    input.type = 'radio';
    input.id = radioId;
    input.name = 'ui-theme';
    input.value = opt.value;
    input.checked = currentTheme === opt.value;
    input.className = 'radio-input';

    input.addEventListener('change', () => {
      if (!input.checked) return;
      const newTheme = opt.value;
      config.theme = newTheme;

      // Application immédiate sur <html> (TACHE-148)
      if (newTheme === 'auto') {
        delete document.documentElement.dataset['theme'];
      } else {
        document.documentElement.dataset['theme'] = newTheme;
      }

      // Persistance dans chrome.storage.local (clé directe 'theme')
      browser.storage.local
        .set({ theme: newTheme })
        .then(() => showSavedFeedback(feedbackEl))
        .catch(() => undefined);
    });

    const label = document.createElement('label');
    label.htmlFor = radioId;
    label.className = 'radio-label';
    label.textContent = browser.i18n.getMessage(opt.key) || opt.defaultLabel;

    wrapper.appendChild(input);
    wrapper.appendChild(label);
    fieldset.appendChild(wrapper);
  }

  root.appendChild(section);
}

/**
 * Lance le téléchargement du fichier d'export RGPD.
 *
 * Récupère les données réelles depuis le service worker via des messages structurés,
 * construit le ExportPayload complet, et déclenche un téléchargement local.
 * Les hashes de mots de passe ne sont PAS inclus — seulement count/oldest/newest (NC-DPO-01).
 *
 * R-074-03 (Art. 5.1.c RGPD — minimisation) : le registre m7_incidents (données
 * techniques de diagnostic) N'EST PAS inclus par défaut dans l'export portabilité
 * Art. 20 RGPD. Il peut être inclus via opt-in explicite de l'utilisateur
 * (checkbox « avancé »). Cf. Art. 5.1.c : minimisation des données.
 *
 * @param config           - Configuration courante
 * @param includeIncidents - Si true, inclut m7_incidents dans l'export (opt-in avancé).
 *                           Par défaut false — conforme au principe de minimisation Art. 5.1.c.
 */
async function handleExport(config: StoredConfig, includeIncidents = false): Promise<void> {
  try {
    // Récupération des weekly_scores via le SW
    const scoresResponse = (await browser.runtime.sendMessage({
      module: 'M3',
      action: 'get_all_scores',
      payload: {},
      timestamp: Date.now(),
    })) as GetAllScoresResponse | undefined;

    const weeklyScores: WeeklyScore[] = scoresResponse?.success
      ? (scoresResponse.scores ?? [])
      : [];

    // Récupération des events via le SW
    const eventsResponse = (await browser.runtime.sendMessage({
      module: 'EXPORT',
      action: 'get_all_events',
      payload: {},
      timestamp: Date.now(),
    })) as GetAllEventsResponse | undefined;

    const events: EventPayload[] = eventsResponse?.success ? (eventsResponse.events ?? []) : [];

    // Récupération des sessions quiz via le SW
    const quizResponse = (await browser.runtime.sendMessage({
      module: 'EXPORT',
      action: 'get_all_quiz_sessions',
      payload: {},
      timestamp: Date.now(),
    })) as GetAllQuizSessionsResponse | undefined;

    const quizSessions: QuizSession[] = quizResponse?.success ? (quizResponse.sessions ?? []) : [];

    // Récupération de la whitelist via le SW
    const whitelistResponse = (await browser.runtime.sendMessage({
      module: 'EXPORT',
      action: 'get_whitelist',
      payload: {},
      timestamp: Date.now(),
    })) as GetWhitelistResponse | undefined;

    const whitelist: WhitelistEntry[] = whitelistResponse?.success
      ? (whitelistResponse.whitelist ?? [])
      : [];

    // Métadonnées hashes mots de passe (pas les hashes eux-mêmes — NC-DPO-01)
    const pwHashResponse = (await browser.runtime.sendMessage({
      module: 'EXPORT',
      action: 'get_password_hash_meta',
      payload: {},
      timestamp: Date.now(),
    })) as GetPasswordHashMetaResponse | undefined;

    const passwordHashesMeta = {
      count: pwHashResponse?.count ?? 0,
      oldest: pwHashResponse?.oldest ?? '',
      newest: pwHashResponse?.newest ?? '',
    };

    // R-074-03 (Art. 5.1.c RGPD) : m7_incidents exclu par defaut de l'export portabilite.
    // Inclus uniquement si l'utilisateur a coche l'option « avance » (opt-in explicite).
    // Si le handler SW n'est pas encore disponible (T-158/159 en deploiement),
    // on retourne un tableau vide plutot que d'echouer l'export global.
    let m7Incidents: M7IncidentRecord[] | undefined;
    if (includeIncidents) {
      try {
        const incidentsResponse = (await browser.runtime.sendMessage({
          module: 'EXPORT',
          action: 'get_all_incidents',
          payload: {},
          timestamp: Date.now(),
        })) as GetAllIncidentsResponse | undefined;
        m7Incidents = incidentsResponse?.success ? (incidentsResponse.incidents ?? []) : [];
      } catch {
        // Handler SW non disponible (T-158/159 pas encore deploye) — tableau vide
        m7Incidents = [];
        logger.warn('Options: handler get_all_incidents non disponible -- m7_incidents = []', {});
      }
    }

    // Construction du payload d'export standard (Art. 20 portabilite)
    const basePayload: ExportPayload = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      extension_version: EXTENSION_VERSION,
      config: {
        modules: config.modules,
        quota_limit: config.quota_limit,
        profile: config.profile,
        onboarding_complete: config.onboarding_complete,
        language: config.language,
      },
      data: {
        events,
        password_hashes: passwordHashesMeta,
        quiz_sessions: quizSessions,
        weekly_scores: weeklyScores,
        whitelist,
      },
    };

    // Ajout conditionnel de m7_incidents (opt-in avance — R-074-03)
    const exportPayload: ExportPayload & { m7_incidents?: M7IncidentRecord[] } = includeIncidents
      ? { ...basePayload, m7_incidents: m7Incidents }
      : basePayload;

    const json = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `sentinel-nudge-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err: unknown) {
    logger.error('Options: échec export données', {
      error_name: Logger.errorName(err),
    });
  }
}

/**
 * Supprime toutes les données de l'utilisateur (RGPD Art. 17).
 *
 * Effectue :
 * - indexedDB.deleteDatabase('sentinel-nudge-db')
 * - chrome.storage.local.clear()
 *
 * @param statusEl - Élément où afficher le résultat de l'opération
 */
async function handleDeleteAllData(statusEl: HTMLElement): Promise<void> {
  try {
    // Supprimer IndexedDB
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('sentinel-nudge-db');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error('Échec suppression IndexedDB'));
      req.onblocked = () => resolve(); // Résoudre même si bloqué (rechargement nécessaire)
    });

    // Vider chrome.storage.local (ADR-008 — via browser adapter)
    await browser.storage.local.clear();

    statusEl.textContent =
      browser.i18n.getMessage('options_delete_success') || 'Toutes vos données ont été supprimées.';
    statusEl.className = 'data-status data-status-success';
    statusEl.style.display = 'block';
  } catch (err: unknown) {
    logger.error('Options: échec suppression données', {
      error_name: Logger.errorName(err),
    });
  }
}

/**
 * Réinitialise la liste de confiance (store whitelist dans IndexedDB).
 *
 * @param statusEl - Élément où afficher le résultat
 */
async function handleResetWhitelist(statusEl: HTMLElement): Promise<void> {
  try {
    await new Promise<void>((resolve, reject) => {
      const openReq = indexedDB.open('sentinel-nudge-db');
      openReq.onerror = () => reject(new Error("Impossible d'ouvrir IndexedDB"));
      openReq.onsuccess = () => {
        const db = openReq.result;
        const tx = db.transaction(['whitelist'], 'readwrite');
        const store = tx.objectStore('whitelist');
        const clearReq = store.clear();
        clearReq.onsuccess = () => {
          db.close();
          resolve();
        };
        clearReq.onerror = () => {
          db.close();
          reject(new Error('Échec vidage whitelist'));
        };
      };
    });

    // Vider aussi la whitelist M2 du content script (chrome.storage.local)
    await browser.storage.local.remove('m2_trusted_domains');

    statusEl.textContent =
      browser.i18n.getMessage('options_whitelist_reset_success') ||
      'La liste de confiance a été réinitialisée.';
    statusEl.className = 'data-status data-status-success';
    statusEl.style.display = 'block';
  } catch (err: unknown) {
    logger.error('Options: échec reset whitelist', {
      error_name: Logger.errorName(err),
    });
  }
}

/**
 * Construit la section Données (export, suppression, whitelist).
 *
 * Le bouton de suppression affiche un encart intégré d'avertissement (fond rouge clair)
 * directement sous le bouton — pas d'overlay modal flottant.
 *
 * R-074-03 (Art. 5.1.c RGPD) : une checkbox opt-in « avancé » permet d'inclure
 * le registre m7_incidents dans l'export. Non cochée par défaut (minimisation).
 * Accessibilité : label for + aria-describedby (WCAG 1.3.1, 4.1.2).
 *
 * @param root    - Élément parent
 * @param config  - Configuration courante
 */
function renderDataSection(root: HTMLElement, config: StoredConfig): void {
  const [section, fieldset] = createSection(
    browser.i18n.getMessage('options_section_data') || 'Mes données',
  );

  // Message de statut pour les opérations (succès / erreur)
  const statusEl = document.createElement('p');
  statusEl.className = 'data-status';
  statusEl.setAttribute('role', 'status');
  statusEl.setAttribute('aria-live', 'polite');
  statusEl.style.display = 'none';

  // --- Opt-in m7_incidents (R-074-03 — Art. 5.1.c RGPD — minimisation) ---
  // Checkbox non cochee par defaut : le registre d'incidents techniques est EXCLU
  // de l'export portabilite Art. 20 RGPD. L'utilisateur peut l'inclure via cet opt-in.

  const incidentsCheckboxId = 'export-include-m7-incidents';
  const incidentsHintId = 'export-m7-incidents-hint';

  const checkboxWrapper = document.createElement('div');
  checkboxWrapper.className = 'export-opt-in-wrapper';

  const incidentsCheckbox = document.createElement('input');
  incidentsCheckbox.type = 'checkbox';
  incidentsCheckbox.id = incidentsCheckboxId;
  incidentsCheckbox.className = 'export-opt-in-checkbox';
  incidentsCheckbox.checked = false; // défaut : exclu (minimisation Art. 5.1.c)
  incidentsCheckbox.setAttribute('aria-describedby', incidentsHintId);

  const incidentsLabel = document.createElement('label');
  incidentsLabel.htmlFor = incidentsCheckboxId;
  incidentsLabel.className = 'export-opt-in-label';
  incidentsLabel.textContent =
    browser.i18n.getMessage('options_export_include_incidents') ||
    "Inclure le registre d'incidents techniques (avancé)";

  const incidentsHint = document.createElement('p');
  incidentsHint.id = incidentsHintId;
  incidentsHint.className = 'export-opt-in-hint';
  incidentsHint.textContent =
    browser.i18n.getMessage('options_export_incidents_hint') ||
    'Contient des métadonnées de diagnostic non nécessaires pour la portabilité (Art. 5.1.c RGPD).';

  checkboxWrapper.appendChild(incidentsCheckbox);
  checkboxWrapper.appendChild(incidentsLabel);
  checkboxWrapper.appendChild(incidentsHint);
  fieldset.appendChild(checkboxWrapper);

  // Bouton Export RGPD Art. 20
  const btnExport = document.createElement('button');
  btnExport.type = 'button';
  btnExport.className = 'btn btn-secondary data-btn';
  btnExport.textContent =
    browser.i18n.getMessage('options_btn_export') || 'Exporter mes données (RGPD Art. 20)';
  btnExport.addEventListener('click', () => {
    // Lit l'état de la checkbox au moment du clic (opt-in avancé — R-074-03)
    const includeIncidents = incidentsCheckbox.checked;
    handleExport(config, includeIncidents).catch(() => undefined);
  });
  fieldset.appendChild(btnExport);

  // Bouton Reset whitelist
  const btnResetWhitelist = document.createElement('button');
  btnResetWhitelist.type = 'button';
  btnResetWhitelist.className = 'btn btn-secondary data-btn';
  btnResetWhitelist.textContent =
    browser.i18n.getMessage('options_btn_reset_whitelist') || 'Réinitialiser la liste de confiance';
  btnResetWhitelist.addEventListener('click', () => {
    handleResetWhitelist(statusEl).catch(() => undefined);
  });
  fieldset.appendChild(btnResetWhitelist);

  // Bouton "Voir la liste de confiance" (T-202)
  const btnViewWhitelist = document.createElement('button');
  btnViewWhitelist.type = 'button';
  btnViewWhitelist.className = 'btn btn-secondary data-btn';
  btnViewWhitelist.textContent =
    browser.i18n.getMessage('options_btn_view_whitelist') || 'Voir la liste de confiance';
  btnViewWhitelist.addEventListener('click', () => {
    const whitelistUrl = browser.runtime.getURL('pages/whitelist/whitelist.html');
    chrome.tabs.create({ url: whitelistUrl });
  });
  fieldset.appendChild(btnViewWhitelist);

  // --- Bouton Suppression RGPD Art. 17 + encart inline ---

  const btnDelete = document.createElement('button');
  btnDelete.type = 'button';
  btnDelete.className = 'btn btn-danger data-btn';
  btnDelete.textContent =
    browser.i18n.getMessage('options_btn_delete') || 'Supprimer toutes mes données (RGPD Art. 17)';

  // Encart d'avertissement inline — s'affiche sous le bouton au clic (toggle)
  const inlineWarning = document.createElement('div');
  inlineWarning.id = 'delete-inline-warning';
  inlineWarning.className = 'delete-inline-warning';
  inlineWarning.setAttribute('role', 'alert');
  inlineWarning.setAttribute('aria-live', 'assertive');
  inlineWarning.style.cssText =
    'display:none; background:#FEE2E2; border:1px solid #DC2626; border-radius:6px; padding:12px 16px; margin-top:8px;';

  // Titre d'avertissement
  const warnTitle = document.createElement('p');
  warnTitle.style.cssText = 'font-weight:600; margin:0 0 4px 0; color:#991B1B;';
  warnTitle.textContent =
    browser.i18n.getMessage('options_delete_confirm_title') || '⚠️ Supprimer toutes vos données ?';
  inlineWarning.appendChild(warnTitle);

  // Description du risque
  const warnDesc = document.createElement('p');
  warnDesc.style.cssText = 'font-size:13px; margin:0 0 12px 0; color:#7F1D1D;';
  warnDesc.textContent =
    browser.i18n.getMessage('options_delete_confirm_desc') ||
    'Cette action est irréversible. Toutes vos données locales seront définitivement supprimées.';
  inlineWarning.appendChild(warnDesc);

  // Zone des boutons
  const warnActions = document.createElement('div');
  warnActions.style.cssText = 'display:flex; gap:8px; flex-wrap:wrap;';

  // Bouton Annuler (action sûre — reçoit le focus en premier)
  const btnCancelDelete = document.createElement('button');
  btnCancelDelete.type = 'button';
  btnCancelDelete.className = 'btn';
  btnCancelDelete.style.cssText =
    'background:#6B7280; color:#fff; border:none; border-radius:6px; padding:8px 16px; min-height:44px; cursor:pointer;';
  btnCancelDelete.textContent = browser.i18n.getMessage('options_delete_cancel_btn') || 'Annuler';
  btnCancelDelete.addEventListener('click', () => {
    inlineWarning.style.display = 'none';
    btnDelete.setAttribute('aria-expanded', 'false');
  });
  warnActions.appendChild(btnCancelDelete);

  // Bouton Confirmer (action danger)
  const btnConfirmDelete = document.createElement('button');
  btnConfirmDelete.type = 'button';
  btnConfirmDelete.className = 'btn btn-danger';
  btnConfirmDelete.style.cssText =
    'background:#DC2626; color:#fff; border:none; border-radius:6px; padding:8px 16px; min-height:44px; cursor:pointer;';
  btnConfirmDelete.textContent =
    browser.i18n.getMessage('options_delete_confirm_btn') || 'Confirmer la suppression';
  btnConfirmDelete.addEventListener('click', () => {
    inlineWarning.style.display = 'none';
    btnDelete.setAttribute('aria-expanded', 'false');
    handleDeleteAllData(statusEl).catch(() => undefined);
  });
  warnActions.appendChild(btnConfirmDelete);

  inlineWarning.appendChild(warnActions);

  // L'encart est lié au bouton par aria-expanded + aria-controls
  btnDelete.setAttribute('aria-expanded', 'false');
  btnDelete.setAttribute('aria-controls', 'delete-inline-warning');
  btnDelete.addEventListener('click', () => {
    const isVisible = inlineWarning.style.display !== 'none';
    inlineWarning.style.display = isVisible ? 'none' : 'block';
    btnDelete.setAttribute('aria-expanded', isVisible ? 'false' : 'true');
    if (!isVisible) {
      // Focus sur le bouton Annuler (action sûre) dès l'ouverture
      requestAnimationFrame(() => btnCancelDelete.focus());
    }
  });

  fieldset.appendChild(btnDelete);
  fieldset.appendChild(inlineWarning);
  fieldset.appendChild(statusEl);
  root.appendChild(section);
}

/**
 * Construit la section Transparence radicale.
 *
 * @param root - Élément parent
 */
function renderTransparencySection(root: HTMLElement): void {
  const [section, fieldset] = createSection(
    browser.i18n.getMessage('options_section_transparency') || 'Transparence radicale',
  );

  const desc = document.createElement('p');
  desc.className = 'section-desc';
  desc.textContent =
    browser.i18n.getMessage('options_transparency_desc') ||
    'Chaque module est documenté en détail.';
  fieldset.appendChild(desc);

  const list = document.createElement('ul');
  list.className = 'transparency-list';

  for (const mod of MODULE_INFOS) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = browser.runtime.getURL(`pages/static/${mod.explainPage}`);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'transparency-link';
    const modName = browser.i18n.getMessage(mod.nameKey) || mod.id;
    a.textContent =
      browser.i18n.getMessage('options_explain_link', modName) || `En savoir plus sur ${modName}`;
    li.appendChild(a);
    list.appendChild(li);
  }

  fieldset.appendChild(list);
  root.appendChild(section);
}

/**
 * Construit la section À propos.
 *
 * @param root - Élément parent
 */
function renderAboutSection(root: HTMLElement): void {
  const [section, fieldset] = createSection(
    browser.i18n.getMessage('options_section_about') || 'À propos',
  );

  // Version
  const versionEl = document.createElement('p');
  versionEl.className = 'about-info';
  versionEl.textContent =
    browser.i18n.getMessage('options_about_version', EXTENSION_VERSION) ||
    `Version : ${EXTENSION_VERSION}`;
  fieldset.appendChild(versionEl);

  // Licence
  const licenseEl = document.createElement('p');
  licenseEl.className = 'about-info';
  licenseEl.textContent = browser.i18n.getMessage('options_about_license') || 'Licence GPL v3';
  fieldset.appendChild(licenseEl);

  // Lien GitHub
  const githubLink = document.createElement('a');
  githubLink.href = GITHUB_URL;
  githubLink.target = '_blank';
  githubLink.rel = 'noopener noreferrer';
  githubLink.className = 'about-link';
  githubLink.textContent =
    browser.i18n.getMessage('options_about_github') || 'Code source sur GitHub';
  fieldset.appendChild(githubLink);

  // Lien politique de confidentialité
  const privacyLink = document.createElement('a');
  privacyLink.href = PRIVACY_URL;
  privacyLink.target = '_blank';
  privacyLink.rel = 'noopener noreferrer';
  privacyLink.className = 'about-link';
  privacyLink.textContent =
    browser.i18n.getMessage('onboarding_step4_privacy_link') ||
    'Lire la politique de confidentialité';
  fieldset.appendChild(privacyLink);

  root.appendChild(section);
}

/**
 * Point d'entrée : charge la configuration et rend la page Options.
 *
 * @returns Promise<void>
 */
async function initOptions(): Promise<void> {
  const root = document.getElementById('options-root');
  if (!root) return;

  // En-tête page
  const h1 = document.createElement('h1');
  h1.className = 'page-title';
  h1.textContent = browser.i18n.getMessage('options_title') || 'Paramètres — Sentinel Nudge';
  root.appendChild(h1);

  // Feedback de sauvegarde globale
  const feedbackEl = document.createElement('span');
  feedbackEl.className = 'save-feedback';
  feedbackEl.setAttribute('aria-live', 'polite');
  feedbackEl.style.display = 'none';
  root.appendChild(feedbackEl);

  // État de chargement
  const loadingEl = document.createElement('p');
  loadingEl.className = 'loading-text';
  loadingEl.textContent =
    browser.i18n.getMessage('options_loading') || 'Chargement de la configuration…';
  root.appendChild(loadingEl);

  try {
    const storageData = await browser.storage.local.get(['config']);
    const config = storageData['config'] as StoredConfig | undefined;

    // Configuration par défaut si absente
    const effectiveConfig: StoredConfig = {
      modules: {
        M2: true,
        M3: true,
        M5: true,
        M6: true,
        M7: false,
        M9: true,
        M17: true,
      },
      quota_limit: 3,
      profile: 'beginner',
      language: 'fr',
      onboarding_complete: false,
      toast_auto_dismiss: true,
      theme: 'auto' as ThemeValue,
      ...config,
    };

    root.removeChild(loadingEl);

    renderModulesSection(root, effectiveConfig, feedbackEl);
    renderQuotaSection(root, effectiveConfig, feedbackEl);
    renderProfileSection(root, effectiveConfig, feedbackEl);
    renderLanguageSection(root, effectiveConfig, feedbackEl);
    renderAccessibilitySection(root, effectiveConfig, feedbackEl);
    renderAppearanceSection(root, effectiveConfig, feedbackEl);
    renderDataSection(root, effectiveConfig);
    renderTransparencySection(root);
    renderAboutSection(root);
  } catch (err: unknown) {
    root.removeChild(loadingEl);

    const errorEl = document.createElement('p');
    errorEl.className = 'error-text';
    errorEl.setAttribute('role', 'alert');
    errorEl.textContent = 'Impossible de charger la configuration.';
    root.appendChild(errorEl);

    logger.error('Options: échec initialisation', {
      error_name: Logger.errorName(err),
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Appliquer le thème AVANT le rendu pour éviter le FOUC (TACHE-148)
  void initTheme();
  watchThemeChanges();
  initOptions().catch((err: unknown) => {
    logger.error('Options: erreur inattendue', {
      error_name: Logger.errorName(err),
    });
  });
});
