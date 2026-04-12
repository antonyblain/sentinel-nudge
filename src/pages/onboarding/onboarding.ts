/**
 * @file pages/onboarding/onboarding.ts
 * @description Script d'onboarding obligatoire au premier lancement de Sentinel Nudge.
 *
 * L'onboarding comporte 4 étapes obligatoires :
 * 1. Bienvenue : présentation de l'extension, privacy by design
 * 2. Profil : radio buttons Débutant/Intermédiaire/Avancé + explication impact quiz M6
 * 3. Modules : 7 toggles pour activer/désactiver chaque module, M7 désactivé par défaut
 * 4. Consentement M7 : case à cocher explicite + lien politique de confidentialité
 *
 * Navigation :
 * - Boutons Précédent/Suivant + indicateur de progression (1/4, 2/4...)
 * - Focus replacé sur le premier élément de chaque étape (accessibilité)
 * - Si fermée avant complétion → reprend à l'étape en cours au prochain démarrage
 * - Sauvegarde la config dans chrome.storage.local
 * - Marque onboarding_complete: true à la fin
 *
 * Accessibilité :
 * - Navigation par étapes avec indicateur de progression visible
 * - Focus explicitement géré entre étapes (DAT §11.3)
 *
 * Sécurité :
 * - D-SEC-003 : Aucun innerHTML. Tout DOM via createElement/textContent/appendChild.
 *
 * Référence : DAT §3.1 (Onboarding), §8.1 (bases légales RGPD — M7 consentement),
 *              SFD §3.3
 */

import { browser } from '@/shared/browser/browser-adapter';
import type { ModuleId } from '@/shared/types/modules';

/** Nombre total d'étapes */
const TOTAL_STEPS = 4;

/** Clé de stockage de l'étape courante pour reprise au prochain démarrage */
const ONBOARDING_STEP_KEY = 'onboarding_current_step';

/**
 * Informations des 7 modules v1 pour l'affichage des toggles.
 */
const MODULE_INFOS: Array<{
  id: ModuleId;
  nameKey: string;
  descKey: string;
  defaultEnabled: boolean;
}> = [
  { id: 'M2', nameKey: 'module_m2_name', descKey: 'module_m2_desc', defaultEnabled: true },
  { id: 'M3', nameKey: 'module_m3_name', descKey: 'module_m3_desc', defaultEnabled: true },
  { id: 'M5', nameKey: 'module_m5_name', descKey: 'module_m5_desc', defaultEnabled: true },
  { id: 'M6', nameKey: 'module_m6_name', descKey: 'module_m6_desc', defaultEnabled: true },
  {
    id: 'M7',
    nameKey: 'module_m7_name',
    descKey: 'module_m7_desc',
    defaultEnabled: false, // M7 requiert consentement explicite
  },
  { id: 'M9', nameKey: 'module_m9_name', descKey: 'module_m9_desc', defaultEnabled: true },
  { id: 'M17', nameKey: 'module_m17_name', descKey: 'module_m17_desc', defaultEnabled: true },
];

/**
 * État courant de l'onboarding (en mémoire pour la durée de vie de la page).
 */
interface OnboardingState {
  currentStep: number;
  profile: 'beginner' | 'intermediate' | 'advanced' | null;
  modules: Record<ModuleId, boolean>;
  m7Consent: boolean;
}

const state: OnboardingState = {
  currentStep: 1,
  profile: null,
  modules: Object.fromEntries(MODULE_INFOS.map((m) => [m.id, m.defaultEnabled])) as Record<
    ModuleId,
    boolean
  >,
  m7Consent: false,
};

/**
 * Met à jour l'indicateur de progression dans l'en-tête.
 *
 * @param container  - Conteneur principal
 * @param step       - Étape courante (1-4)
 */
function updateProgressIndicator(container: HTMLElement, step: number): void {
  const indicator = container.querySelector('#progress-indicator');
  if (!indicator) return;
  const text =
    browser.i18n.getMessage('onboarding_step_of', [String(step), String(TOTAL_STEPS)]) ||
    `Étape ${step} sur ${TOTAL_STEPS}`;
  indicator.textContent = text;

  // Mise à jour des points de progression visuels
  const dots = container.querySelectorAll('.progress-dot');
  dots.forEach((dot, index) => {
    dot.classList.toggle('progress-dot-active', index + 1 === step);
    dot.classList.toggle('progress-dot-done', index + 1 < step);
    dot.setAttribute('aria-current', index + 1 === step ? 'step' : 'false');
  });
}

/**
 * Met à jour l'état des boutons Précédent / Suivant / Terminer.
 *
 * @param container - Conteneur principal
 * @param step      - Étape courante
 */
function updateNavigationButtons(container: HTMLElement, step: number): void {
  const btnPrev = container.querySelector<HTMLButtonElement>('#btn-prev');
  const btnNext = container.querySelector<HTMLButtonElement>('#btn-next');
  const btnFinish = container.querySelector<HTMLButtonElement>('#btn-finish');

  if (btnPrev) btnPrev.disabled = step === 1;
  if (btnNext) {
    btnNext.style.display = step < TOTAL_STEPS ? 'inline-flex' : 'none';
  }
  if (btnFinish) {
    btnFinish.style.display = step === TOTAL_STEPS ? 'inline-flex' : 'none';
  }
}

/**
 * Rend le contenu de l'étape 1 : Bienvenue.
 *
 * @param stepContainer - Conteneur de l'étape
 */
function renderStep1(stepContainer: HTMLElement): void {
  const h2 = document.createElement('h2');
  h2.className = 'step-title';
  h2.textContent =
    browser.i18n.getMessage('onboarding_step1_title') || 'Bienvenue sur Sentinel Nudge';
  stepContainer.appendChild(h2);

  const intro = document.createElement('p');
  intro.className = 'step-intro';
  intro.textContent =
    browser.i18n.getMessage('onboarding_step1_intro') ||
    'Sentinel Nudge est une extension de cyber-hygiène comportementale.';
  stepContainer.appendChild(intro);

  // Section privacy by design
  const privacyBox = document.createElement('div');
  privacyBox.className = 'privacy-box';

  const privacyTitle = document.createElement('h3');
  privacyTitle.className = 'privacy-title';
  privacyTitle.textContent =
    browser.i18n.getMessage('onboarding_step1_privacy_title') || 'Privacy by design';
  privacyBox.appendChild(privacyTitle);

  const privacyDesc = document.createElement('p');
  privacyDesc.className = 'privacy-desc';
  privacyDesc.textContent =
    browser.i18n.getMessage('onboarding_step1_privacy_desc') ||
    'Tout traitement est effectué localement sur votre ordinateur.';
  privacyBox.appendChild(privacyDesc);

  const opensourceEl = document.createElement('p');
  opensourceEl.className = 'opensource-badge';

  const opensourceText = document.createElement('span');
  opensourceText.textContent = 'Open source — licence GPL v3 — ';
  opensourceEl.appendChild(opensourceText);

  const githubLink = document.createElement('a');
  githubLink.href = 'https://github.com/antonyblain/sentinel-nudge';
  githubLink.target = '_blank';
  githubLink.rel = 'noopener noreferrer';
  githubLink.textContent = 'Voir le code sur GitHub';
  githubLink.className = 'github-link';
  opensourceEl.appendChild(githubLink);

  privacyBox.appendChild(opensourceEl);

  stepContainer.appendChild(privacyBox);
}

/**
 * Rend le contenu de l'étape 2 : Choix du profil.
 *
 * @param stepContainer - Conteneur de l'étape
 * @param errorEl       - Élément d'erreur (validation)
 */
function renderStep2(stepContainer: HTMLElement, errorEl: HTMLElement): void {
  const h2 = document.createElement('h2');
  h2.className = 'step-title';
  h2.textContent = browser.i18n.getMessage('onboarding_step2_title') || 'Choisissez votre profil';
  stepContainer.appendChild(h2);

  const desc = document.createElement('p');
  desc.className = 'step-desc';
  desc.textContent =
    browser.i18n.getMessage('onboarding_step2_desc') ||
    'Votre profil influence la difficulté des quiz de sensibilisation.';
  stepContainer.appendChild(desc);

  stepContainer.appendChild(errorEl);

  const fieldset = document.createElement('fieldset');
  fieldset.className = 'profile-fieldset';

  const legend = document.createElement('legend');
  legend.className = 'sr-only';
  legend.textContent = 'Choisir votre profil';
  fieldset.appendChild(legend);

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
    const wrapper = document.createElement('div');
    wrapper.className = 'profile-option';

    const radioId = `onboarding-profile-${profile.value}`;

    const input = document.createElement('input');
    input.type = 'radio';
    input.id = radioId;
    input.name = 'onboarding-profile';
    input.value = profile.value;
    input.checked = state.profile === profile.value;
    input.className = 'radio-input';
    input.setAttribute('aria-describedby', `ob-profile-desc-${profile.value}`);
    input.addEventListener('change', () => {
      if (input.checked) {
        state.profile = profile.value;
        errorEl.style.display = 'none';
      }
    });

    const label = document.createElement('label');
    label.htmlFor = radioId;
    label.className = 'profile-label';
    label.textContent = browser.i18n.getMessage(profile.nameKey) || profile.value;

    const profileDesc = document.createElement('p');
    profileDesc.id = `ob-profile-desc-${profile.value}`;
    profileDesc.className = 'profile-desc';
    profileDesc.textContent = browser.i18n.getMessage(profile.descKey) || '';

    wrapper.appendChild(input);
    wrapper.appendChild(label);
    wrapper.appendChild(profileDesc);
    fieldset.appendChild(wrapper);
  }

  stepContainer.appendChild(fieldset);
}

/**
 * Rend le contenu de l'étape 3 : Activation des modules.
 *
 * @param stepContainer - Conteneur de l'étape
 */
function renderStep3(stepContainer: HTMLElement): void {
  const h2 = document.createElement('h2');
  h2.className = 'step-title';
  h2.textContent = browser.i18n.getMessage('onboarding_step3_title') || 'Activez les modules';
  stepContainer.appendChild(h2);

  const desc = document.createElement('p');
  desc.className = 'step-desc';
  desc.textContent =
    browser.i18n.getMessage('onboarding_step3_desc') ||
    'Chaque module surveille un aspect de votre cyber-hygiène.';
  stepContainer.appendChild(desc);

  const fieldset = document.createElement('fieldset');
  fieldset.className = 'modules-fieldset';

  const legend = document.createElement('legend');
  legend.className = 'sr-only';
  legend.textContent = 'Modules à activer';
  fieldset.appendChild(legend);

  for (const mod of MODULE_INFOS) {
    const wrapper = document.createElement('div');
    wrapper.className = 'module-row';

    const inputId = `onboarding-module-${mod.id}`;

    const labelWrapper = document.createElement('div');
    labelWrapper.className = 'module-row-label-wrapper';

    const label = document.createElement('label');
    label.htmlFor = inputId;
    label.className = 'module-row-name';
    label.textContent = browser.i18n.getMessage(mod.nameKey) || mod.id;
    labelWrapper.appendChild(label);

    const modDesc = document.createElement('p');
    modDesc.id = `ob-mod-desc-${mod.id}`;
    modDesc.className = 'module-row-desc';
    modDesc.textContent = browser.i18n.getMessage(mod.descKey) || '';
    labelWrapper.appendChild(modDesc);

    wrapper.appendChild(labelWrapper);

    // Toggle visuel
    const switchWrapper = document.createElement('div');
    switchWrapper.className = 'toggle-switch-wrapper';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = inputId;
    input.className = 'toggle-input sr-only';
    input.checked = state.modules[mod.id];
    input.setAttribute('aria-describedby', `ob-mod-desc-${mod.id}`);

    // M7 : désactivé dans cette étape (sera géré à l'étape 4)
    if (mod.id === 'M7') {
      input.disabled = true;
      input.checked = false;
      input.setAttribute(
        'aria-label',
        `${browser.i18n.getMessage(mod.nameKey)} (consentement requis à l'étape suivante)`,
      );

      // Indicateur visuel sous le toggle M7
      const m7Note = document.createElement('p');
      m7Note.className = 'module-row-m7-note';
      m7Note.textContent =
        "Ce module nécessite votre consentement explicite. Il sera proposé à l'étape suivante.";
      wrapper.appendChild(m7Note);
    }

    input.addEventListener('change', () => {
      state.modules[mod.id] = input.checked;
    });

    const switchVisual = document.createElement('span');
    switchVisual.className = 'toggle-switch';
    switchVisual.setAttribute('aria-hidden', 'true');

    switchWrapper.appendChild(input);
    switchWrapper.appendChild(switchVisual);
    wrapper.appendChild(switchWrapper);

    fieldset.appendChild(wrapper);
  }

  stepContainer.appendChild(fieldset);
}

/**
 * Rend le contenu de l'étape 4 : Consentement M7.
 *
 * @param stepContainer - Conteneur de l'étape
 */
function renderStep4(stepContainer: HTMLElement): void {
  const h2 = document.createElement('h2');
  h2.className = 'step-title';
  h2.textContent =
    browser.i18n.getMessage('onboarding_step4_title') ||
    'Consentement M7 — Hachage de mots de passe';
  stepContainer.appendChild(h2);

  const desc = document.createElement('p');
  desc.className = 'step-desc';
  desc.textContent =
    browser.i18n.getMessage('onboarding_step4_desc') ||
    'Le module M7 détecte la réutilisation de mots de passe.';
  stepContainer.appendChild(desc);

  // Case à cocher consentement
  const consentWrapper = document.createElement('div');
  consentWrapper.className = 'consent-wrapper';

  const consentInput = document.createElement('input');
  consentInput.type = 'checkbox';
  consentInput.id = 'onboarding-m7-consent';
  consentInput.className = 'consent-checkbox';
  consentInput.checked = state.m7Consent;
  consentInput.addEventListener('change', () => {
    state.m7Consent = consentInput.checked;
    state.modules['M7'] = consentInput.checked;
  });

  const consentLabel = document.createElement('label');
  consentLabel.htmlFor = 'onboarding-m7-consent';
  consentLabel.className = 'consent-label';
  consentLabel.textContent =
    browser.i18n.getMessage('onboarding_step4_consent_label') ||
    "J'accepte que Sentinel Nudge calcule des empreintes locales de mes mots de passe";

  consentWrapper.appendChild(consentInput);
  consentWrapper.appendChild(consentLabel);
  stepContainer.appendChild(consentWrapper);

  // Lien politique de confidentialité
  const privacyLink = document.createElement('a');
  privacyLink.href = browser.runtime.getURL('pages/static/politique-confidentialite.html');
  privacyLink.target = '_blank';
  privacyLink.rel = 'noopener noreferrer';
  privacyLink.className = 'privacy-link';
  privacyLink.textContent =
    browser.i18n.getMessage('onboarding_step4_privacy_link') ||
    'Lire la politique de confidentialité';
  stepContainer.appendChild(privacyLink);

  // Note : module désactivé sans consentement
  const noteEl = document.createElement('p');
  noteEl.className = 'consent-note';
  noteEl.textContent =
    "Sans votre consentement, nous ne sommes pas autorisés à évaluer la réutilisation de vos mots de passe. Vous pourrez changer d'avis à tout moment dans les paramètres.";
  stepContainer.appendChild(noteEl);
}

/**
 * Affiche le contenu de l'étape donnée dans le conteneur de l'étape.
 *
 * @param stepArea  - Conteneur DOM de l'étape courante
 * @param step      - Numéro d'étape (1-4)
 * @param errorEl   - Élément d'erreur (utilisé étape 2)
 */
function renderStepContent(stepArea: HTMLElement, step: number, errorEl: HTMLElement): void {
  // Vider le contenu de l'étape précédente
  while (stepArea.firstChild) {
    stepArea.removeChild(stepArea.firstChild);
  }

  switch (step) {
    case 1:
      renderStep1(stepArea);
      break;
    case 2:
      renderStep2(stepArea, errorEl);
      break;
    case 3:
      renderStep3(stepArea);
      break;
    case 4:
      renderStep4(stepArea);
      break;
    default:
      break;
  }

  // Replacer le focus sur le premier élément focusable de l'étape (DAT §11.3)
  const firstFocusable = stepArea.querySelector<HTMLElement>(
    'button, input, a, select, textarea, [tabindex]:not([tabindex="-1"])',
  );
  if (firstFocusable) {
    firstFocusable.focus();
  } else {
    // Fallback : focus sur le conteneur de l'étape
    stepArea.setAttribute('tabindex', '-1');
    stepArea.focus();
  }
}

/**
 * Valide l'étape courante avant de passer à la suivante.
 *
 * @param step    - Étape à valider
 * @param errorEl - Élément d'erreur
 * @returns true si la validation passe
 */
function validateStep(step: number, errorEl: HTMLElement): boolean {
  if (step === 2 && !state.profile) {
    errorEl.textContent =
      browser.i18n.getMessage('onboarding_profile_required') ||
      'Veuillez sélectionner un profil avant de continuer.';
    errorEl.style.display = 'block';
    errorEl.setAttribute('role', 'alert');
    return false;
  }
  return true;
}

/**
 * Persiste l'étape courante dans chrome.storage.local pour reprise au prochain démarrage.
 *
 * @param step - Étape à persister
 */
async function persistCurrentStep(step: number): Promise<void> {
  try {
    await browser.storage.local.set({ [ONBOARDING_STEP_KEY]: step });
  } catch {
    // Non bloquant
  }
}

/**
 * Finalise l'onboarding :
 * - Sauvegarde la configuration complète
 * - Marque onboarding_complete: true
 * - Ferme l'onglet d'onboarding
 */
async function finishOnboarding(): Promise<void> {
  try {
    const config = {
      modules: state.modules,
      quota_limit: 3 as const,
      profile: state.profile ?? 'beginner',
      onboarding_complete: true,
      language: 'fr' as const,
      toast_auto_dismiss: true,
    };

    await browser.storage.local.set({
      config,
      m7_consent: state.m7Consent,
    });

    // Nettoyer la clé d'étape en cours
    await browser.storage.local.remove([ONBOARDING_STEP_KEY]);

    // Fermer l'onglet (ou ouvrir le dashboard)
    const currentTab = await browser.tabs.query({ active: true, currentWindow: true });
    if (currentTab.length > 0 && currentTab[0].id !== undefined) {
      chrome.tabs.remove(currentTab[0].id);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Onboarding: échec finalisation',
        context: { error: message },
      }),
    );
  }
}

/**
 * Point d'entrée : initialise la page d'onboarding.
 *
 * @returns Promise<void>
 */
async function initOnboarding(): Promise<void> {
  const root = document.getElementById('onboarding-root');
  if (!root) return;

  // Vérifier si une étape était en cours (reprise au prochain démarrage)
  const stored = await browser.storage.local.get([ONBOARDING_STEP_KEY]);
  const savedStep = stored[ONBOARDING_STEP_KEY];
  if (typeof savedStep === 'number' && savedStep >= 1 && savedStep <= TOTAL_STEPS) {
    state.currentStep = savedStep;
  }

  // En-tête avec titre et indicateur de progression
  const header = document.createElement('header');
  header.className = 'onboarding-header';

  const h1 = document.createElement('h1');
  h1.className = 'onboarding-main-title';
  h1.textContent = browser.i18n.getMessage('onboarding_title') || 'Sentinel Nudge';
  header.appendChild(h1);

  // Barre de progression accessible
  const progressBar = document.createElement('nav');
  progressBar.setAttribute('aria-label', 'Progression de la configuration');
  progressBar.className = 'progress-bar';

  const progressText = document.createElement('span');
  progressText.id = 'progress-indicator';
  progressText.className = 'progress-text sr-only';
  progressText.setAttribute('aria-live', 'polite');
  progressBar.appendChild(progressText);

  const dotsContainer = document.createElement('ol');
  dotsContainer.className = 'progress-dots';
  dotsContainer.setAttribute('aria-hidden', 'true');

  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const li = document.createElement('li');
    li.className = 'progress-dot';
    li.setAttribute('aria-current', i === state.currentStep ? 'step' : 'false');
    dotsContainer.appendChild(li);
  }

  progressBar.appendChild(dotsContainer);
  header.appendChild(progressBar);
  root.appendChild(header);

  // Zone de contenu de l'étape courante
  const stepArea = document.createElement('div');
  stepArea.id = 'step-area';
  stepArea.className = 'step-area';
  stepArea.setAttribute('aria-label', `Contenu de l'étape`);
  root.appendChild(stepArea);

  // Élément d'erreur partagé (étape 2)
  const errorEl = document.createElement('p');
  errorEl.className = 'step-error';
  errorEl.style.display = 'none';

  // Navigation
  const navDiv = document.createElement('div');
  navDiv.className = 'onboarding-nav';

  const btnPrev = document.createElement('button');
  btnPrev.type = 'button';
  btnPrev.id = 'btn-prev';
  btnPrev.className = 'btn btn-secondary';
  btnPrev.textContent = browser.i18n.getMessage('onboarding_btn_prev') || 'Précédent';
  btnPrev.disabled = state.currentStep === 1;

  const btnNext = document.createElement('button');
  btnNext.type = 'button';
  btnNext.id = 'btn-next';
  btnNext.className = 'btn btn-primary';
  btnNext.textContent = browser.i18n.getMessage('onboarding_btn_next') || 'Suivant';
  btnNext.style.display = state.currentStep < TOTAL_STEPS ? 'inline-flex' : 'none';

  const btnFinish = document.createElement('button');
  btnFinish.type = 'button';
  btnFinish.id = 'btn-finish';
  btnFinish.className = 'btn btn-primary';
  btnFinish.textContent = browser.i18n.getMessage('onboarding_btn_finish') || 'Terminer';
  btnFinish.style.display = state.currentStep === TOTAL_STEPS ? 'inline-flex' : 'none';

  // Événement Précédent
  btnPrev.addEventListener('click', () => {
    if (state.currentStep > 1) {
      state.currentStep -= 1;
      persistCurrentStep(state.currentStep).catch(() => undefined);
      updateProgressIndicator(root, state.currentStep);
      updateNavigationButtons(root, state.currentStep);
      renderStepContent(stepArea, state.currentStep, errorEl);
    }
  });

  // Événement Suivant
  btnNext.addEventListener('click', () => {
    if (!validateStep(state.currentStep, errorEl)) return;
    if (state.currentStep < TOTAL_STEPS) {
      state.currentStep += 1;
      persistCurrentStep(state.currentStep).catch(() => undefined);
      updateProgressIndicator(root, state.currentStep);
      updateNavigationButtons(root, state.currentStep);
      renderStepContent(stepArea, state.currentStep, errorEl);
    }
  });

  // Événement Terminer
  btnFinish.addEventListener('click', () => {
    finishOnboarding().catch(() => undefined);
  });

  navDiv.appendChild(btnPrev);
  navDiv.appendChild(btnNext);
  navDiv.appendChild(btnFinish);
  root.appendChild(navDiv);

  // Rendu initial
  updateProgressIndicator(root, state.currentStep);
  updateNavigationButtons(root, state.currentStep);
  renderStepContent(stepArea, state.currentStep, errorEl);
}

document.addEventListener('DOMContentLoaded', () => {
  initOnboarding().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Onboarding: erreur inattendue',
        context: { error: message },
      }),
    );
  });
});
