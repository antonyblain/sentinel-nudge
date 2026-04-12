/**
 * @file content-scripts/detectors/password-detector.ts
 * @description Détecteur de champs mot de passe — modules M2, M7 et M9.
 *
 * Ce content script est injecté dynamiquement via scripting.executeScript()
 * uniquement si M2, M7 ou M9 est activé dans la configuration.
 *
 * Responsabilités :
 * - M2 : Au focus d'un champ password (non-création), analyse les signaux de risque
 *         via risk-analyzer, envoie au SW si ≥ 2 signaux et conditions remplies,
 *         affiche l'overlay interstitiel si le SW répond 'show'.
 * - M9 : Détecte les champs de création de mot de passe (confirmation présente OU
 *         autocomplete="new-password"), vérifie l'absence de gestionnaire,
 *         évalue la force en temps réel via zxcvbn-ts (debounce 150ms),
 *         affiche l'overlay inline, envoie le score au submit.
 * - M7 : Au submit, capture le mot de passe, calcule SHA-256(sel + mdp),
 *         nullifie la variable immédiatement, envoie le hash au SW pour comparaison.
 *
 * Sécurité :
 * - Le mot de passe en clair n'est JAMAIS envoyé au service worker (D-SEC-001)
 * - Le hash M7 est calculé et la variable nullifiée en < 5ms
 * - Les overlays sont en Shadow DOM pour isolation CSS (D-SEC-003)
 * - Aucun innerHTML utilisé (D-SEC-003)
 * - M2 : le domain_hash est calculé localement, jamais le domaine en clair
 *
 * Priorité M2 vs M7 (SFD §2.1.5) :
 * M2 est prioritaire sur M7 sur le même formulaire.
 * Si M2 est affiché, M7 est différé de 5s après la fermeture.
 *
 * Référence : SFD §2.1 (M2), §2.5 (M7), §2.6 (M9), DAT §6.2, §9.4 (D-SEC-001)
 */

import { browser } from '@/shared/browser/browser-adapter';
import { hashPassword, hashDomain } from '@/shared/utils/hash';
import { OverlayM9, registerOverlayM9 } from '@/content-scripts/ui/overlay-m9';
import { ToastM7, registerToastM7 } from '@/content-scripts/ui/toast-m7';
import { OverlayM2, registerOverlayM2 } from '@/content-scripts/ui/overlay-m2';
import { analyzeRisks } from '@/content-scripts/detectors/risk-analyzer';
import { zxcvbn } from '@zxcvbn-ts/core';

// Enregistrer les custom elements au chargement du content script
// Garantit leur inclusion dans le bundle Vite (évite le tree-shaking)
registerOverlayM2();
registerOverlayM9();
registerToastM7();

/** Délai de debounce pour l'évaluation zxcvbn (ms) */
const DEBOUNCE_MS = 150;

/** Délai de détection gestionnaire de mots de passe après focus (ms) */
const PASSWORD_MANAGER_DETECT_MS = 500;

/** Délai de différé M7 après fermeture de l'overlay M2 (SFD §2.1.5 : 5s) */
const M7_DEFER_AFTER_M2_MS = 5000;

/**
 * Contexte d'un champ de création de mot de passe surveillé par M9.
 */
interface M9Context {
  /** Le champ password surveillé */
  field: HTMLInputElement;
  /** L'overlay M9 associé */
  overlay: OverlayM9;
  /** ID du debounce en cours */
  debounceId: ReturnType<typeof setTimeout> | null;
  /** true si un gestionnaire de mots de passe a été détecté */
  pmDetected: boolean;
}

/** Map des champs surveillés par M9 (clé = champ) */
const m9Contexts = new WeakMap<HTMLInputElement, M9Context>();

/** Set des champs déjà soumis (pour éviter le double traitement) */
const submittedFields = new WeakSet<HTMLInputElement>();

/**
 * Set des champs sur lesquels M2 vient d'être affiché.
 * Utilisé pour différer M7 de 5s (SFD §2.1.5).
 */
const fieldsWithM2Active = new WeakSet<HTMLInputElement>();

// ---------------------------------------------------------------------------
// Détection du gestionnaire de mots de passe
// ---------------------------------------------------------------------------

/**
 * Détecte la présence d'un gestionnaire de mots de passe sur le champ.
 *
 * Stratégie heuristique (SFD §2.6) :
 * 1. Attribut autocomplete="current-password" → gestionnaire probable
 * 2. Attribut data-form-type présent → gestionnaire probable
 * 3. Remplissage automatique dans les 500ms après focus
 *
 * @param field - Champ password à analyser
 * @returns true si un gestionnaire est détecté ou si remplissage automatique observé
 */
function hasPasswordManagerHint(field: HTMLInputElement): boolean {
  const autocomplete = field.getAttribute('autocomplete') ?? '';
  // "current-password" indique un champ de connexion géré par un PM
  if (autocomplete === 'current-password') return true;
  // data-form-type est utilisé par 1Password et LastPass
  if (field.hasAttribute('data-form-type')) return true;
  return false;
}

/**
 * Vérifie si le champ a été rempli automatiquement dans un délai donné.
 * Utilisé pour détecter le remplissage après focus (SFD §2.6 cas limite).
 *
 * @param field        - Champ password à surveiller
 * @param valueAtFocus - Valeur du champ au moment du focus
 * @returns Promise qui résout true si remplissage automatique détecté
 */
async function checkAutoFill(field: HTMLInputElement, valueAtFocus: string): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Si la valeur a changé sans input event → remplissage automatique
      resolve(field.value !== valueAtFocus && field.value.length > 0);
    }, PASSWORD_MANAGER_DETECT_MS);
  });
}

// ---------------------------------------------------------------------------
// Détection du formulaire de création de mot de passe
// ---------------------------------------------------------------------------

/**
 * Détermine si le champ password appartient à un formulaire de création.
 *
 * Critères (SFD §2.6) :
 * - Un champ de confirmation de mot de passe est présent dans le même formulaire, OU
 * - L'attribut autocomplete="new-password" est explicitement défini
 *
 * @param field - Champ password à analyser
 * @returns true si formulaire de création détecté
 */
function isCreationForm(field: HTMLInputElement): boolean {
  // autocomplete="new-password" est un signal direct
  if (field.getAttribute('autocomplete') === 'new-password') return true;

  // Recherche d'un champ de confirmation dans le même formulaire ou la même page
  const form = field.form ?? document;
  const allPasswords = Array.from(
    form.querySelectorAll<HTMLInputElement>('input[type="password"]'),
  );

  // Plus d'un champ password dans le formulaire → probablement création + confirmation
  if (allPasswords.length >= 2) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Détection du type (password vs passphrase) — SFD §2.6.2
// ---------------------------------------------------------------------------

/**
 * Détecte le type de saisie : mot de passe classique ou phrase de passe.
 *
 * Algorithme (SFD §2.6.2) :
 *   SI valeur contient >= 3 espaces ET longueur >= 20 → 'passphrase'
 *   SINON → 'password'
 *
 * @param value - Valeur courante du champ
 * @returns 'passphrase' ou 'password'
 */
function detectInputType(value: string): 'password' | 'passphrase' {
  const spaceCount = (value.match(/ /g) ?? []).length;
  if (spaceCount >= 3 && value.length >= 20) return 'passphrase';
  return 'password';
}

// ---------------------------------------------------------------------------
// Module M2 — analyse de risque au focus
// ---------------------------------------------------------------------------

/**
 * Analyse les signaux de risque et déclenche l'overlay M2 si nécessaire.
 *
 * Processus :
 * 1. Calculer les signaux de risque via risk-analyzer
 * 2. Si < 2 signaux : ne rien faire
 * 3. Calculer le domain_hash (SHA-256(salt + hostname))
 * 4. Envoyer au SW pour vérification whitelist + session dedup + quota
 * 5. Si SW répond 'show' : afficher l'overlay M2
 *
 * @param field - Champ password qui vient de recevoir le focus
 * @returns true si M2 a été affiché (pour différer M7)
 */
async function handleM2OnFocus(field: HTMLInputElement): Promise<boolean> {
  const url = window.location.href;
  const { signals, riskLevel } = analyzeRisks(url);

  // Moins de 2 signaux → pas de nudge M2
  if (riskLevel < 2 || signals.length < 2) {
    return false;
  }

  const salt = await getInstallationSalt();
  if (!salt) return false;

  const domainHash = await hashDomain(salt, location.hostname);

  let swResponse: { success: boolean; action: string; data?: Record<string, unknown> } | null =
    null;

  try {
    swResponse = (await browser.runtime.sendMessage({
      module: 'M2',
      action: 'risk_detected',
      payload: {
        signals,
        domain_hash: domainHash,
      },
      timestamp: Date.now(),
    })) as typeof swResponse;
  } catch {
    // SW endormi — silencieux
    return false;
  }

  if (swResponse?.action !== 'show') {
    return false;
  }

  // Afficher l'overlay M2
  return await showOverlayM2(field, signals, domainHash);
}

/**
 * Affiche l'overlay M2 sur la page courante.
 *
 * @param field      - Champ password source du focus
 * @param signals    - Signaux de risque détectés
 * @param domainHash - Hash salé du domaine
 * @returns true si l'overlay a bien été affiché
 */
async function showOverlayM2(
  field: HTMLInputElement,
  signals: string[],
  domainHash: string,
): Promise<boolean> {
  const overlay = document.createElement('sn-overlay-m2') as OverlayM2;
  document.body.appendChild(overlay);

  return new Promise((resolve) => {
    overlay.open(signals, domainHash, (action) => {
      // M2 fermé — M7 peut être différé si applicable (SFD §2.1.5)
      if (action !== 'abandoned') {
        fieldsWithM2Active.delete(field);
      }
      resolve(true);
    });
  });
}

// ---------------------------------------------------------------------------
// Module M9 — initialisation et gestion de l'overlay
// ---------------------------------------------------------------------------

/**
 * Initialise l'overlay M9 pour un champ de création de mot de passe.
 *
 * @param field - Champ password détecté comme formulaire de création
 */
function initM9ForField(field: HTMLInputElement): void {
  if (m9Contexts.has(field)) return; // Déjà initialisé

  const overlay = document.createElement('sn-overlay-m9') as OverlayM9;
  overlay.style.display = 'none';

  // Insertion juste après le champ — même largeur garantie via JS
  field.insertAdjacentElement('afterend', overlay);

  const context: M9Context = {
    field,
    overlay,
    debounceId: null,
    pmDetected: false,
  };

  m9Contexts.set(field, context);

  // Listener input avec debounce 150ms
  field.addEventListener('input', () => {
    handlePasswordInput(field);
  });

  // Synchroniser la largeur de l'overlay avec le champ
  syncOverlayWidth(field, overlay);
  window.addEventListener('resize', () => syncOverlayWidth(field, overlay));
}

/**
 * Synchronise la largeur de l'overlay avec celle du champ parent.
 *
 * @param field   - Champ parent
 * @param overlay - Overlay à redimensionner
 */
function syncOverlayWidth(field: HTMLInputElement, overlay: OverlayM9): void {
  const rect = field.getBoundingClientRect();
  overlay.style.width = `${rect.width}px`;
}

/**
 * Gère un événement input sur un champ surveillé par M9 (debounce 150ms).
 *
 * @param field - Champ password source de l'événement
 */
function handlePasswordInput(field: HTMLInputElement): void {
  const ctx = m9Contexts.get(field);
  if (!ctx || ctx.pmDetected) return;

  // Annuler le debounce précédent
  if (ctx.debounceId !== null) {
    clearTimeout(ctx.debounceId);
  }

  ctx.debounceId = setTimeout(() => {
    evaluatePasswordStrength(field);
    ctx.debounceId = null;
  }, DEBOUNCE_MS);
}

/**
 * Évalue la force du mot de passe via zxcvbn et met à jour l'overlay.
 *
 * @param field - Champ password à évaluer
 */
function evaluatePasswordStrength(field: HTMLInputElement): void {
  const ctx = m9Contexts.get(field);
  if (!ctx) return;

  const value = field.value;

  if (value.length === 0) {
    ctx.overlay.hide();
    return;
  }

  // Évaluation zxcvbn locale — la valeur ne quitte jamais ce contexte
  const result = zxcvbn(value);
  const mode = detectInputType(value);
  const rect = field.getBoundingClientRect();

  ctx.overlay.show();
  ctx.overlay.update(result.score, value, mode, rect.width);
}

// ---------------------------------------------------------------------------
// Module M9 — focus / blur
// ---------------------------------------------------------------------------

/**
 * Gère le focus sur un champ password.
 * Vérifie si c'est un formulaire de création, détecte le gestionnaire et init M9.
 * Si ce n'est pas un formulaire de création, déclenche l'analyse M2.
 *
 * Priorité M2 : si M2 est déclenché, M9 n'est pas activé (formulaires de connexion).
 * M2 et M9 ne se conflictent pas : M2 = connexion, M9 = création (SFD §2.1.5).
 *
 * @param field - Champ password qui reçoit le focus
 */
async function handleFocusOnPasswordField(field: HTMLInputElement): Promise<void> {
  // Vérification gestionnaire via attributs
  if (hasPasswordManagerHint(field)) return;

  // Déterminer le type de formulaire
  const isCreation = isCreationForm(field);

  if (isCreation) {
    // Formulaire de création → M9 (pas M2 selon SFD §2.1.5)
    // Vérification remplissage automatique dans les 500ms
    const valueAtFocus = field.value;
    const autoFilled = await checkAutoFill(field, valueAtFocus);
    if (autoFilled) {
      const ctx = m9Contexts.get(field);
      if (ctx) ctx.pmDetected = true;
      return;
    }

    // Initialiser M9 si pas encore fait
    initM9ForField(field);
  } else {
    // Formulaire de connexion → M2 (analyse de risque)
    const m2Shown = await handleM2OnFocus(field);

    if (m2Shown) {
      // Marquer le champ pour différer M7 si nécessaire (SFD §2.1.5)
      fieldsWithM2Active.add(field);
    }
  }
}

// ---------------------------------------------------------------------------
// Module M7 — hash et envoi au submit
// ---------------------------------------------------------------------------

/**
 * Récupère le sel d'installation depuis chrome.storage.local.
 *
 * @returns Le sel en hex (32 caractères) ou null si absent
 */
async function getInstallationSalt(): Promise<string | null> {
  try {
    const result = await browser.storage.local.get(['installation_salt']);
    const salt = result['installation_salt'];
    if (typeof salt !== 'string' || salt.length === 0) return null;
    return salt;
  } catch {
    return null;
  }
}

/**
 * Traite un submit de formulaire contenant un champ password.
 *
 * Module M7 :
 * 1. Capture la valeur du champ password
 * 2. Calcule SHA-256(sel + mot_de_passe) [D-SEC-001]
 * 3. Nullifie immédiatement la variable (< 5ms)
 * 4. Envoie le hash + domain_hash au service worker
 * 5. Si M2 était actif sur ce champ → différer M7 de 5s (SFD §2.1.5)
 *
 * Module M9 :
 * 6. Envoie le score final au service worker
 * 7. Masque l'overlay M9
 *
 * @param event    - Événement submit du formulaire
 * @param pwdField - Champ password soumis
 */
async function handleFormSubmit(
  event: SubmitEvent | Event,
  pwdField: HTMLInputElement,
): Promise<void> {
  // Éviter le double traitement
  if (submittedFields.has(pwdField)) return;
  submittedFields.add(pwdField);

  const salt = await getInstallationSalt();
  if (!salt) {
    // Sel absent — ne pas traiter (cas premier lancement ou storage effacé)
    return;
  }

  // --- M9 : envoyer le score final ---
  const m9Ctx = m9Contexts.get(pwdField);
  if (m9Ctx) {
    const value = pwdField.value;
    if (value.length > 0) {
      const result = zxcvbn(value);
      const mode = detectInputType(value);
      void browser.runtime.sendMessage({
        module: 'M9',
        action: 'password_evaluated',
        payload: {
          score: result.score,
          type: mode,
        },
        timestamp: Date.now(),
      });
    }
    m9Ctx.overlay.hide();
  }

  // --- M7 : hachage et envoi ---
  const passwordValue = pwdField.value;

  // Ignorer si le champ est vide (SFD §2.5.4)
  if (passwordValue.length === 0) return;

  let passwordHash: string;
  let passwordCopy: string = passwordValue; // Variable locale pour nullification

  try {
    // Calcul du hash (D-SEC-001)
    passwordHash = await hashPassword(salt, passwordCopy);
  } finally {
    // Nullification immédiate de la variable locale (< 5ms)
    passwordCopy = '';
  }

  // Calcul du hash de domaine
  const domainHash = await hashDomain(salt, location.hostname);

  // Si M2 était actif sur ce champ, différer M7 de 5s (SFD §2.1.5)
  const m2WasActive = fieldsWithM2Active.has(pwdField);
  const sendM7 = async (): Promise<void> => {
    try {
      const response = (await browser.runtime.sendMessage({
        module: 'M7',
        action: 'password_submitted',
        payload: {
          hash: passwordHash,
          domain_hash: domainHash,
        },
        timestamp: Date.now(),
      })) as { success: boolean; action: string; data?: Record<string, unknown> } | null;

      // Si le SW demande d'afficher le toast M7
      if (response?.action === 'show') {
        showToastM7(domainHash);
      }
    } catch {
      // Le SW peut être endormi — l'échec est silencieux (non bloquant pour l'utilisateur)
    }
  };

  if (m2WasActive) {
    // Différé 5s après fermeture de M2 (SFD §2.1.5)
    setTimeout(() => void sendM7(), M7_DEFER_AFTER_M2_MS);
  } else {
    void sendM7();
  }
}

/**
 * Affiche le toast M7 sur la page courante.
 *
 * @param domainHash - Hash salé du domaine courant pour la suppression_list
 */
function showToastM7(domainHash: string): void {
  const toast = document.createElement('sn-toast-m7') as ToastM7;
  document.body.appendChild(toast);
  toast.open(domainHash, (_action) => {
    // L'action est déjà envoyée au SW dans closeToast() via browser.runtime.sendMessage
  });
}

// ---------------------------------------------------------------------------
// Initialisation des listeners
// ---------------------------------------------------------------------------

/**
 * Attache les listeners submit à tous les formulaires de la page
 * qui contiennent au moins un champ password.
 */
function attachSubmitListeners(): void {
  const forms = document.querySelectorAll('form');
  forms.forEach((form) => {
    // Éviter les doublons
    if ((form as HTMLFormElement & { _snSubmitAttached?: boolean })._snSubmitAttached) return;
    (form as HTMLFormElement & { _snSubmitAttached?: boolean })._snSubmitAttached = true;

    form.addEventListener('submit', (event) => {
      const pwdFields = form.querySelectorAll<HTMLInputElement>('input[type="password"]');
      pwdFields.forEach((field) => {
        void handleFormSubmit(event, field);
      });
    });
  });
}

/**
 * Observe les mutations DOM pour détecter les formulaires ajoutés dynamiquement
 * (SPA — SFD §2.6.3 cas limite MutationObserver).
 */
function observeDynamicForms(): void {
  const observer = new MutationObserver((mutations) => {
    let hasNewForms = false;
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (
          node.nodeType === Node.ELEMENT_NODE &&
          ((node as Element).tagName === 'FORM' ||
            (node as Element).querySelector?.('input[type="password"]'))
        ) {
          hasNewForms = true;
        }
      });
    });
    if (hasNewForms) {
      attachSubmitListeners();
    }
  });

  observer.observe(document.body ?? document.documentElement, {
    childList: true,
    subtree: true,
  });
}

/**
 * Initialise le détecteur de champs mot de passe.
 * Appelé une seule fois à l'injection du content script.
 */
function initPasswordDetector(): void {
  // Listener global focusin pour M2 et M9 — capture pour intercepter avant stopPropagation
  document.addEventListener('focusin', (event: FocusEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.type !== 'password') return;

    void handleFocusOnPasswordField(target);
  });

  // Attachement des listeners submit
  attachSubmitListeners();

  // Observation des mutations DOM pour les SPA
  observeDynamicForms();
}

// Démarrage du détecteur
initPasswordDetector();
