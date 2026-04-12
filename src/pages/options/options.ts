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
import type {
  ExportPayload,
  EventPayload,
  QuizSession,
  WeeklyScore,
  WhitelistEntry,
} from '@/shared/types/storage';
import type { ModuleId } from '@/shared/types/modules';

/** Version de l'extension (lue depuis le manifest) */
const EXTENSION_VERSION = (browser.runtime.getManifest() as { version: string }).version;

/** URL GitHub du projet */
const GITHUB_URL = 'https://github.com/antonyblain/sentinel-nudge';

/** URL de la politique de confidentialité */
const PRIVACY_URL = browser.runtime.getURL('pages/static/privacy.html');

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
    explainPage: 'm2-explication.html',
  },
  {
    id: 'M3',
    nameKey: 'module_m3_name',
    descKey: 'module_m3_desc',
    explainPage: 'm3-explication.html',
  },
  {
    id: 'M5',
    nameKey: 'module_m5_name',
    descKey: 'module_m5_desc',
    explainPage: 'm5-explication.html',
  },
  {
    id: 'M6',
    nameKey: 'module_m6_name',
    descKey: 'module_m6_desc',
    explainPage: 'm6-explication.html',
  },
  {
    id: 'M7',
    nameKey: 'module_m7_name',
    descKey: 'module_m7_desc',
    explainPage: 'm7-explication.html',
  },
  {
    id: 'M9',
    nameKey: 'module_m9_name',
    descKey: 'module_m9_desc',
    explainPage: 'm9-explication.html',
  },
  {
    id: 'M17',
    nameKey: 'module_m17_name',
    descKey: 'module_m17_desc',
    explainPage: 'm17-explication.html',
  },
];

/**
 * Type de la configuration stockée dans chrome.storage.local.
 */
interface StoredConfig {
  modules: Record<ModuleId, boolean>;
  quota_limit: 3 | 5 | 10 | null;
  profile: 'beginner' | 'intermediate' | 'advanced';
  language: 'fr' | 'en';
  onboarding_complete: boolean;
  toast_auto_dismiss?: boolean;
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

  const switchWrapper = document.createElement('div');
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
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Options: échec sauvegarde config',
        context: { error: message },
      }),
    );
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
    saveConfig({ language: newLang }, feedbackEl).catch(() => undefined);
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
 * Lance le téléchargement du fichier d'export RGPD.
 *
 * Récupère les données réelles depuis le service worker via des messages structurés,
 * construit le ExportPayload complet, et déclenche un téléchargement local.
 * Les hashes de mots de passe ne sont PAS inclus — seulement count/oldest/newest (NC-DPO-01).
 *
 * @param config - Configuration courante
 */
async function handleExport(config: StoredConfig): Promise<void> {
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

    const exportPayload: ExportPayload = {
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
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Options: échec export données',
        context: { error: message },
      }),
    );
  }
}

/**
 * Affiche un dialogue de confirmation accessible (WCAG 2.1 AA) pour les actions destructives.
 *
 * - role="alertdialog", aria-modal="true", aria-labelledby, aria-describedby
 * - Focus trap actif (Tab / Shift+Tab circulent entre les 2 boutons)
 * - Premier focus sur "Annuler" (action sûre)
 * - Escape = annuler
 * - D-SEC-003 : aucun innerHTML
 *
 * @param titleText  - Texte du titre du dialogue
 * @param descText   - Texte de description (conséquence de l'action)
 * @param confirmText - Texte du bouton de confirmation (action danger)
 * @param cancelText  - Texte du bouton d'annulation
 * @returns Promise<boolean> — true si confirmé, false si annulé
 */
function showConfirmDialog(
  titleText: string,
  descText: string,
  confirmText: string,
  cancelText: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    // Fond semi-transparent (backdrop)
    const backdrop = document.createElement('div');
    backdrop.className = 'confirm-dialog-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');

    // Dialogue
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'confirm-dialog-title');
    dialog.setAttribute('aria-describedby', 'confirm-dialog-desc');
    dialog.className = 'confirm-dialog';

    // Titre
    const title = document.createElement('h2');
    title.id = 'confirm-dialog-title';
    title.className = 'confirm-dialog-title';
    title.textContent = titleText;
    dialog.appendChild(title);

    // Description
    const desc = document.createElement('p');
    desc.id = 'confirm-dialog-desc';
    desc.className = 'confirm-dialog-desc';
    desc.textContent = descText;
    dialog.appendChild(desc);

    // Zone des boutons
    const actions = document.createElement('div');
    actions.className = 'confirm-dialog-actions';

    // Bouton Annuler — premier focus (action sûre)
    const btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.className = 'btn btn-secondary';
    btnCancel.textContent = cancelText;

    // Bouton Confirmer (action danger)
    const btnConfirm = document.createElement('button');
    btnConfirm.type = 'button';
    btnConfirm.className = 'btn btn-danger';
    btnConfirm.textContent = confirmText;

    actions.appendChild(btnCancel);
    actions.appendChild(btnConfirm);
    dialog.appendChild(actions);

    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    /**
     * Ferme le dialogue et résout la promesse.
     *
     * @param result - true si confirmé, false si annulé
     */
    function close(result: boolean): void {
      document.removeEventListener('keydown', handleKeydown);
      document.body.removeChild(backdrop);
      resolve(result);
    }

    /**
     * Gestion du focus trap et de la touche Escape.
     *
     * @param e - Événement clavier
     */
    function handleKeydown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(false);
        return;
      }

      // Focus trap : Tab / Shift+Tab circulent entre btnCancel et btnConfirm
      if (e.key === 'Tab') {
        const focused = document.activeElement;
        if (e.shiftKey) {
          // Shift+Tab : si focus sur Annuler → aller vers Confirmer
          if (focused === btnCancel) {
            e.preventDefault();
            btnConfirm.focus();
          }
        } else {
          // Tab : si focus sur Confirmer → aller vers Annuler
          if (focused === btnConfirm) {
            e.preventDefault();
            btnCancel.focus();
          }
        }
      }
    }

    btnCancel.addEventListener('click', () => close(false));
    btnConfirm.addEventListener('click', () => close(true));
    backdrop.addEventListener('click', (e) => {
      // Clic hors du dialogue = annuler
      if (e.target === backdrop) close(false);
    });

    document.addEventListener('keydown', handleKeydown);

    // Premier focus sur "Annuler" (action sûre — TACHE-015)
    requestAnimationFrame(() => {
      btnCancel.focus();
    });
  });
}

/**
 * Supprime toutes les données de l'utilisateur (RGPD Art. 17).
 *
 * Affiche un dialogue HTML accessible (alertdialog) avant d'agir.
 * Effectue :
 * - indexedDB.deleteDatabase('sentinel-nudge-db')
 * - chrome.storage.local.clear()
 *
 * @param statusEl - Élément où afficher le résultat
 */
async function handleDeleteAllData(statusEl: HTMLElement): Promise<void> {
  const confirmed = await showConfirmDialog(
    browser.i18n.getMessage('options_delete_confirm_title') || 'Supprimer toutes vos données ?',
    browser.i18n.getMessage('options_delete_confirm_desc') ||
      'Cette action est irréversible. Toutes vos données locales seront définitivement supprimées.',
    browser.i18n.getMessage('options_delete_confirm_btn') || 'Confirmer la suppression',
    browser.i18n.getMessage('options_delete_cancel_btn') || 'Annuler',
  );

  if (!confirmed) return;

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
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Options: échec suppression données',
        context: { error: message },
      }),
    );
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

    statusEl.textContent =
      browser.i18n.getMessage('options_whitelist_reset_success') ||
      'La liste de confiance a été réinitialisée.';
    statusEl.className = 'data-status data-status-success';
    statusEl.style.display = 'block';
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Options: échec reset whitelist',
        context: { error: message },
      }),
    );
  }
}

/**
 * Construit la section Données (export, suppression, whitelist).
 *
 * @param root    - Élément parent
 * @param config  - Configuration courante
 */
function renderDataSection(root: HTMLElement, config: StoredConfig): void {
  const [section, fieldset] = createSection(
    browser.i18n.getMessage('options_section_data') || 'Mes données',
  );

  // Message de statut pour les opérations
  const statusEl = document.createElement('p');
  statusEl.className = 'data-status';
  statusEl.setAttribute('role', 'status');
  statusEl.setAttribute('aria-live', 'polite');
  statusEl.style.display = 'none';

  // Bouton Export RGPD Art. 20
  const btnExport = document.createElement('button');
  btnExport.type = 'button';
  btnExport.className = 'btn btn-secondary data-btn';
  btnExport.textContent =
    browser.i18n.getMessage('options_btn_export') || 'Exporter mes données (RGPD Art. 20)';
  btnExport.addEventListener('click', () => {
    handleExport(config).catch(() => undefined);
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

  // Bouton Suppression RGPD Art. 17
  const btnDelete = document.createElement('button');
  btnDelete.type = 'button';
  btnDelete.className = 'btn btn-danger data-btn';
  btnDelete.textContent =
    browser.i18n.getMessage('options_btn_delete') || 'Supprimer toutes mes données (RGPD Art. 17)';
  btnDelete.addEventListener('click', () => {
    handleDeleteAllData(statusEl).catch(() => undefined);
  });
  fieldset.appendChild(btnDelete);

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
      ...config,
    };

    root.removeChild(loadingEl);

    renderModulesSection(root, effectiveConfig, feedbackEl);
    renderQuotaSection(root, effectiveConfig, feedbackEl);
    renderProfileSection(root, effectiveConfig, feedbackEl);
    renderLanguageSection(root, effectiveConfig, feedbackEl);
    renderAccessibilitySection(root, effectiveConfig, feedbackEl);
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

    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Options: échec initialisation',
        context: { error: message },
      }),
    );
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initOptions().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Options: erreur inattendue',
        context: { error: message },
      }),
    );
  });
});
