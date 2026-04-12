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
import { analyzeRisks } from '@/content-scripts/detectors/risk-analyzer';
import { zxcvbn } from '@zxcvbn-ts/core';

// Note : les Custom Elements (customElements.define) ne fonctionnent PAS dans les
// content scripts Chrome MV3 (isolated world — "Illegal constructor").
// Les overlays M2, M9 et le toast M7 sont construits directement en DOM + Shadow DOM.

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
  /** Le host Shadow DOM de l'indicateur M9 inséré après le champ */
  overlayHost: HTMLDivElement | null;
  /** Fonctions de mise à jour et contrôle de l'overlay M9 */
  overlayControls: M9OverlayControls | null;
  /** ID du debounce en cours */
  debounceId: ReturnType<typeof setTimeout> | null;
  /** true si un gestionnaire de mots de passe a été détecté */
  pmDetected: boolean;
}

/** Contrôleurs de l'overlay M9 DOM direct */
interface M9OverlayControls {
  update: (score: number, value: string, mode: 'password' | 'passphrase', width: number) => void;
  show: () => void;
  hide: () => void;
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
  // Signal 1 : autocomplete="new-password" est un signal direct
  if (field.getAttribute('autocomplete') === 'new-password') return true;

  // Signal 2 : 2+ champs password dans le formulaire → création + confirmation
  const form = field.form ?? document;
  const allPasswords = Array.from(
    form.querySelectorAll<HTMLInputElement>('input[type="password"]'),
  );
  if (allPasswords.length >= 2) return true;

  // Signal 3 : heuristiques URL — mots-clés d'inscription dans l'URL
  const url = window.location.href.toLowerCase();
  const urlKeywords = [
    'register',
    'signup',
    'sign-up',
    'sign_up',
    'create-account',
    'create_account',
    'inscription',
    'registry',
    'enregistr',
    'new-account',
    'join',
    'onboarding',
  ];
  if (urlKeywords.some((kw) => url.includes(kw))) return true;

  // Signal 4 : heuristiques DOM — bouton submit contenant des mots-clés d'inscription
  const buttons = Array.from(
    form.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
      'button[type="submit"], input[type="submit"], button:not([type])',
    ),
  );
  const buttonKeywords = [
    'create',
    'register',
    'sign up',
    'signup',
    'inscription',
    'créer',
    'creer',
    "s'inscrire",
    'rejoindre',
  ];
  for (const btn of buttons) {
    const text = (btn.textContent ?? btn.value ?? '').toLowerCase();
    if (buttonKeywords.some((kw) => text.includes(kw))) return true;
  }

  // Signal 5 : présence d'un champ email/name sans champ "username" → inscription probable
  const hasEmailOrName = form.querySelector(
    'input[type="email"], input[name*="email"], input[name*="name"]:not([name*="user"])',
  );
  const hasNoLoginHint = !form.querySelector(
    'a[href*="forgot"], a[href*="reset"], a[href*="oubli"]',
  );
  if (hasEmailOrName && hasNoLoginHint) return true;

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
  // Si le sel n'est pas encore généré (SW pas encore initialisé), on utilise
  // un hash placeholder — M2 est critique, il doit s'afficher même sans sel
  const effectiveSalt = salt ?? 'sentinel-nudge-temp-salt';

  let domainHash: string;
  try {
    domainHash = await hashDomain(effectiveSalt, location.hostname);
  } catch {
    domainHash = 'hash-fallback-error';
  }

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
    // SW endormi — M2 est critique, afficher l'overlay directement (fail-open)
    return await showOverlayM2(field, signals, domainHash);
  }

  // Respecter les décisions de skip du SW (session_duplicate, whitelisted, quota)
  // Seuls les cas d'erreur/null/handler_not_registered → fail-open (M2 critique)
  if (swResponse?.success === true && swResponse?.action === 'skip') {
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
  return new Promise((resolve) => {
    createOverlayM2DOM(field, signals, domainHash, () => {
      // Libérer le guard anti-réentrance dans tous les cas.
      // Pour 'dismissed'/'trusted' : le SW a le domaine en session_duplicate → pas de réaffichage.
      // Pour 'abandoned' : le SW retire le domaine de la session → réaffichage au prochain focus.
      fieldsWithM2Active.delete(field);
      resolve(true);
    });
  });
}

/**
 * Crée et affiche l'overlay M2 directement en DOM + Shadow DOM.
 * Résout le bug "Illegal constructor" des Custom Elements en content script MV3.
 *
 * Reproduit la logique de overlay-m2.ts sans Custom Elements :
 * - Backdrop semi-transparent
 * - Panel latéral droit (400px) avec role="alertdialog"
 * - Signaux de risque listés, explication inline toggle, 4 boutons
 * - Focus trap (Tab / Shift+Tab) + Escape = dismissed
 * - First focus sur "Abandonner la saisie" (action sûre)
 *
 * Sécurité (D-SEC-003) : aucun innerHTML.
 *
 * @param signals    - Signaux de risque détectés
 * @param domainHash - Hash salé du domaine courant
 * @param onAction   - Callback avec l'action choisie
 */
function createOverlayM2DOM(
  field: HTMLInputElement,
  signals: string[],
  domainHash: string,
  onAction: (action: 'dismissed' | 'trusted' | 'abandoned' | 'why') => void,
): void {
  const SIGNAL_FALLBACKS: Record<string, string> = {
    http: 'Ce site utilise HTTP (non chiffré)',
    hsts_miss: "Ce site n'est pas dans la liste HSTS preload",
    levenshtein: 'Ce domaine ressemble à un site connu (typosquatting possible)',
    cert_invalid: "Le certificat TLS n'est pas valide",
  };
  const SIGNAL_KEYS: Record<string, string> = {
    http: 'm2_signal_http',
    hsts_miss: 'm2_signal_hsts_miss',
    levenshtein: 'm2_signal_levenshtein',
    cert_invalid: 'm2_signal_cert_invalid',
  };

  // Hôte fixe plein-écran
  const host = document.createElement('div');
  host.style.cssText =
    'all:initial; display:block; position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:2147483647; pointer-events:none;';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = [
    '#bd{position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,.3);pointer-events:all;animation:fi .2s ease-out}',
    '#pn{position:fixed;top:0;right:0;height:100vh;width:400px;max-width:100vw;background:#fff;box-shadow:-4px 0 20px rgba(0,0,0,.2);display:flex;flex-direction:column;padding:24px;overflow-y:auto;pointer-events:all;font:15px/1.5 system-ui,sans-serif;color:#111827;animation:si .2s ease-out;box-sizing:border-box}',
    '@keyframes fi{from{opacity:0}to{opacity:1}}',
    '@keyframes si{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}',
    '.ico{text-align:center;font-size:48px;margin-bottom:16px}',
    'h2{font-size:18px;font-weight:700;color:#DC2626;margin:0 0 8px}',
    '.desc{margin:0 0 16px;line-height:1.5;color:#111827}',
    'ul{list-style:none;padding:0;margin:0 0 16px;display:flex;flex-direction:column;gap:4px}',
    'li{background:#FEF2F2;border-left:3px solid #DC2626;padding:8px 12px;border-radius:0 6px 6px 0;font-size:13px}',
    '.expl{background:#F0F9FF;border:1px solid #BAE6FD;border-radius:6px;padding:16px;margin-bottom:16px}',
    '.expl h3{margin:0 0 8px;font-size:15px;font-weight:700;color:#2563EB}',
    '.expl p{margin:0 0 8px;font-size:13px;line-height:1.5}',
    '.acts{display:flex;flex-direction:column;gap:8px;margin-top:auto;padding-top:16px}',
    'button{width:100%;min-height:44px;border-radius:6px;cursor:pointer;font-size:15px;font-weight:700;border:none;text-align:center}',
    '#ba{background:#DC2626;color:#fff}#ba:hover{opacity:.9}',
    '#bc{background:#E5E7EB;color:#111827}#bc:hover{background:#D1D5DB}',
    '#bt{background:none;border:1px solid #16A34A!important;color:#16A34A}#bt:hover{background:#F0FDF4}',
    '#bw{background:none;border:1px solid #D1D5DB!important;color:#6B7280;font-weight:400;font-size:13px}#bw:hover{color:#111827;background:#F9FAFB}',
    '@media(max-width:440px){#pn{width:100vw}}',
    '@media(prefers-reduced-motion:reduce){#bd,#pn{animation:none}}',
  ].join('');
  shadow.appendChild(style);

  // Backdrop
  const backdrop = document.createElement('div');
  backdrop.id = 'bd';
  backdrop.setAttribute('aria-hidden', 'true');
  backdrop.addEventListener('click', () => closeM2('dismissed'));
  shadow.appendChild(backdrop);

  // Panel
  const panel = document.createElement('div');
  panel.id = 'pn';
  panel.setAttribute('role', 'alertdialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'sn-m2-ttl');
  panel.setAttribute('aria-describedby', 'sn-m2-dsc');

  const iconDiv = document.createElement('div');
  iconDiv.className = 'ico';
  iconDiv.setAttribute('aria-hidden', 'true');
  iconDiv.textContent = '⚠️';
  panel.appendChild(iconDiv);

  const titleEl = document.createElement('h2');
  titleEl.id = 'sn-m2-ttl';
  titleEl.textContent = browser.i18n.getMessage('m2_overlay_title') || 'Site à risque détecté';
  panel.appendChild(titleEl);

  const descEl = document.createElement('p');
  descEl.id = 'sn-m2-dsc';
  descEl.className = 'desc';
  descEl.textContent =
    browser.i18n.getMessage('m2_overlay_description') ||
    'Sentinel Nudge a détecté des signaux de risque sur ce site.';
  panel.appendChild(descEl);

  // Signaux
  const signalList = document.createElement('ul');
  signalList.setAttribute(
    'aria-label',
    browser.i18n.getMessage('m2_overlay_signals_label') || 'Signaux de risque détectés',
  );
  for (const sig of signals) {
    const li = document.createElement('li');
    const key = SIGNAL_KEYS[sig];
    const fallback = SIGNAL_FALLBACKS[sig] ?? 'Signal : ' + sig;
    li.textContent = key ? browser.i18n.getMessage(key) || fallback : fallback;
    signalList.appendChild(li);
  }
  panel.appendChild(signalList);

  // Section explication (masquée par défaut)
  const expl = document.createElement('div');
  expl.className = 'expl';
  expl.hidden = true;

  const explTitle = document.createElement('h3');
  explTitle.textContent =
    browser.i18n.getMessage('m2_explanation_title') || 'Pourquoi cette alerte ?';
  expl.appendChild(explTitle);

  const explP1 = document.createElement('p');
  explP1.textContent =
    browser.i18n.getMessage('m2_explanation_para1') ||
    "Les signaux détectés indiquent que ce site présente des caractéristiques couramment associées aux attaques de phishing et d'usurpation d'identité.";
  expl.appendChild(explP1);

  const explP2 = document.createElement('p');
  explP2.textContent =
    browser.i18n.getMessage('m2_explanation_para2') ||
    'Saisir un mot de passe sur un site non sécurisé ou imitant un site connu expose vos identifiants à des tiers malveillants.';
  expl.appendChild(explP2);

  const btnLearn = document.createElement('button');
  btnLearn.style.cssText =
    'margin-top:8px;background:none;border:1px solid #2563EB;color:#2563EB;font-size:13px;padding:6px 12px;min-height:44px;min-width:0;cursor:pointer;border-radius:6px;width:auto;font-weight:400;';
  btnLearn.textContent =
    browser.i18n.getMessage('m2_overlay_btn_learn') || 'En savoir plus sur les risques';
  btnLearn.addEventListener('click', () => {
    window.open(browser.runtime.getURL('pages/static/sites-suspects.html'), '_blank');
  });
  expl.appendChild(btnLearn);
  panel.appendChild(expl);

  // Boutons d'action
  const acts = document.createElement('div');
  acts.className = 'acts';

  const btnAbandon = document.createElement('button');
  btnAbandon.id = 'ba';
  btnAbandon.type = 'button';
  btnAbandon.textContent =
    browser.i18n.getMessage('m2_overlay_btn_abandon') || 'Abandonner la saisie';
  btnAbandon.addEventListener('click', () => closeM2('abandoned'));

  const btnContinue = document.createElement('button');
  btnContinue.id = 'bc';
  btnContinue.type = 'button';
  btnContinue.textContent =
    browser.i18n.getMessage('m2_overlay_btn_dismiss') || 'Continuer quand même';
  btnContinue.addEventListener('click', () => closeM2('dismissed'));

  const btnTrust = document.createElement('button');
  btnTrust.id = 'bt';
  btnTrust.type = 'button';
  btnTrust.textContent =
    browser.i18n.getMessage('m2_overlay_btn_trust') || 'Marquer comme de confiance';
  btnTrust.addEventListener('click', () => closeM2('trusted'));

  const btnWhy = document.createElement('button');
  btnWhy.id = 'bw';
  btnWhy.type = 'button';
  btnWhy.setAttribute('aria-expanded', 'false');
  btnWhy.textContent = browser.i18n.getMessage('m2_overlay_btn_why') || 'Pourquoi ce message ?';
  btnWhy.addEventListener('click', () => {
    const hidden = expl.hidden;
    expl.hidden = !hidden;
    btnWhy.setAttribute('aria-expanded', hidden ? 'true' : 'false');
  });

  acts.appendChild(btnAbandon);
  acts.appendChild(btnContinue);
  acts.appendChild(btnTrust);
  acts.appendChild(btnWhy);
  panel.appendChild(acts);

  shadow.appendChild(panel);

  // Focus trap + Escape
  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeM2('dismissed');
      return;
    }
    if (e.key === 'Tab') {
      const focusable = expl.hidden
        ? [btnAbandon, btnContinue, btnTrust, btnWhy]
        : [btnAbandon, btnContinue, btnTrust, btnWhy, btnLearn];
      const active = shadow.activeElement;
      const idx = focusable.indexOf(active as HTMLButtonElement);
      if (e.shiftKey) {
        if (idx <= 0) {
          e.preventDefault();
          focusable[focusable.length - 1]!.focus();
        }
      } else {
        if (idx === focusable.length - 1) {
          e.preventDefault();
          focusable[0]!.focus();
        }
      }
    }
  }
  document.addEventListener('keydown', handleKeydown);

  function closeM2(action: 'dismissed' | 'trusted' | 'abandoned' | 'why'): void {
    document.removeEventListener('keydown', handleKeydown);
    host.remove();

    // Envoyer l'action au SW (await pour fiabiliser whitelist/trusted)
    const sendAction = async (): Promise<void> => {
      try {
        await browser.runtime.sendMessage({
          module: 'M2',
          action: 'overlay_action',
          payload: { user_action: action, domain_hash: domainHash, signals },
          timestamp: Date.now(),
        });
      } catch {
        // SW endormi — non bloquant, l'action locale reste effective
      }
    };
    void sendAction();

    // Comportements spécifiques par action
    if (action === 'abandoned') {
      // Abandonner : blur le champ password original et vider la saisie
      field.value = '';
      field.blur();
    } else if (action === 'dismissed') {
      // Continuer : refocus le champ pour que l'utilisateur puisse reprendre la saisie
      field.focus();
    }

    onAction(action);
  }

  // Premier focus sur "Abandonner la saisie" (action sûre — SFD §2.1)
  requestAnimationFrame(() => btnAbandon.focus());
}

// ---------------------------------------------------------------------------
// Module M9 — initialisation et gestion de l'overlay
// ---------------------------------------------------------------------------

/**
 * Initialise l'indicateur de force M9 pour un champ de création de mot de passe.
 * Construction DOM directe + Shadow DOM (pas de Custom Elements — isolated world MV3).
 *
 * @param field - Champ password détecté comme formulaire de création
 */
function initM9ForField(field: HTMLInputElement): void {
  if (m9Contexts.has(field)) return; // Déjà initialisé

  const controls = createStrengthIndicator(field);

  const context: M9Context = {
    field,
    overlayHost: controls.host,
    overlayControls: controls,
    debounceId: null,
    pmDetected: false,
  };

  m9Contexts.set(field, context);

  // Listener input avec debounce 150ms
  field.addEventListener('input', () => {
    handlePasswordInput(field);
  });
}

/**
 * Synchronise la largeur de l'indicateur M9 avec celle du champ parent.
 *
 * @param field - Champ parent
 * @param host  - Élément host de l'indicateur
 */
function syncM9Width(field: HTMLInputElement, host: HTMLDivElement): void {
  const rect = field.getBoundingClientRect();
  host.style.width = `${rect.width}px`;
}

/**
 * Crée l'indicateur de force de mot de passe M9 directement en DOM + Shadow DOM.
 * Résout le bug "Illegal constructor" des Custom Elements en content script MV3.
 *
 * Structure : <div host> → Shadow DOM → styles + conteneur indicateur
 *
 * Accessibilité :
 * - role="meter", aria-valuenow, aria-valuemin="0", aria-valuemax="4", aria-valuetext
 * - aria-live="polite" sur la zone de suggestion
 *
 * @param field - Champ password après lequel insérer l'indicateur
 * @returns Objet host + contrôles (update/show/hide)
 */
function createStrengthIndicator(
  field: HTMLInputElement,
): M9OverlayControls & { host: HTMLDivElement } {
  const SCORE_COLORS = ['#DC2626', '#DC2626', '#D97706', '#16A34A', '#166534'] as const;
  const SCORE_LABELS = ['Très faible', 'Faible', 'Moyen', 'Fort', 'Très fort'] as const;
  const ANSSI_MARKERS = [
    "Déconseillé par l'ANSSI",
    "Déconseillé par l'ANSSI",
    'Acceptable',
    'Recommandé',
    'Recommandé',
  ] as const;
  const SCORE_KEYS = [
    'm9_score_very_weak',
    'm9_score_weak',
    'm9_score_medium',
    'm9_score_strong',
    'm9_score_very_strong',
  ] as const;
  const ANSSI_KEYS = [
    'm9_anssi_not_recommended',
    'm9_anssi_not_recommended',
    'm9_anssi_acceptable',
    'm9_anssi_recommended',
    'm9_anssi_recommended',
  ] as const;

  // Conteneur hôte — display:block pour rester dans le flux
  const host = document.createElement('div');
  host.style.cssText = 'display:none; width:100%; box-sizing:border-box; margin-top:4px;';
  field.insertAdjacentElement('afterend', host);

  // Shadow DOM pour isolation CSS
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = [
    '.sn-m9{font:13px/1.4 system-ui,sans-serif;padding:4px 0;box-sizing:border-box;width:100%}',
    '.sn-m9-bar-row{display:flex;align-items:center;gap:8px;margin-bottom:4px}',
    '.sn-m9-meter{flex:1}',
    '.sn-m9-bar-bg{background:#E5E7EB;border-radius:4px;height:6px;overflow:hidden;width:100%}',
    '.sn-m9-bar-fill{height:100%;border-radius:4px;width:0%;transition:width .2s ease,background-color .2s ease}',
    '.sn-m9-labels{display:flex;flex-direction:column;align-items:flex-end;min-width:120px;flex-shrink:0}',
    '.sn-m9-label{font-weight:600;font-size:13px}',
    '.sn-m9-anssi{font-size:11px;color:#6B7280}',
    '.sn-m9-suggestion{margin:0;color:#111827;font-size:13px;min-height:1.5em}',
    '@media(prefers-reduced-motion:reduce){.sn-m9-bar-fill{transition:none}}',
  ].join('');
  shadow.appendChild(style);

  const containerEl = document.createElement('div');
  containerEl.className = 'sn-m9';
  containerEl.style.cssText =
    'background:#F9FAFB; border:1px solid #E5E7EB; border-radius:6px; padding:6px 8px; box-sizing:border-box;';

  const barRow = document.createElement('div');
  barRow.className = 'sn-m9-bar-row';

  const meter = document.createElement('div');
  meter.className = 'sn-m9-meter';
  meter.setAttribute('role', 'meter');
  meter.setAttribute(
    'aria-label',
    browser.i18n.getMessage('m9_meter_label') || 'Force du mot de passe',
  );
  meter.setAttribute('aria-valuenow', '0');
  meter.setAttribute('aria-valuemin', '0');
  meter.setAttribute('aria-valuemax', '4');
  meter.setAttribute('aria-valuetext', SCORE_LABELS[0]);

  const barBg = document.createElement('div');
  barBg.className = 'sn-m9-bar-bg';
  const barFill = document.createElement('div');
  barFill.className = 'sn-m9-bar-fill';
  barBg.appendChild(barFill);
  meter.appendChild(barBg);

  const labelGroup = document.createElement('div');
  labelGroup.className = 'sn-m9-labels';
  const labelEl = document.createElement('span');
  labelEl.className = 'sn-m9-label';
  const anssiEl = document.createElement('span');
  anssiEl.className = 'sn-m9-anssi';
  labelGroup.appendChild(labelEl);
  labelGroup.appendChild(anssiEl);

  barRow.appendChild(meter);
  barRow.appendChild(labelGroup);
  containerEl.appendChild(barRow);

  const suggestionEl = document.createElement('p');
  suggestionEl.className = 'sn-m9-suggestion';
  suggestionEl.setAttribute('aria-live', 'polite');
  suggestionEl.setAttribute('aria-atomic', 'true');
  containerEl.appendChild(suggestionEl);

  shadow.appendChild(containerEl);

  // Synchroniser la largeur initiale et au resize
  syncM9Width(field, host);
  window.addEventListener('resize', () => syncM9Width(field, host));

  const controls = {
    host,
    update(score: number, value: string, mode: 'password' | 'passphrase', width: number): void {
      host.style.width = `${width}px`;
      const clamped = Math.max(0, Math.min(4, score));
      const color = SCORE_COLORS[clamped]!;
      const label = browser.i18n.getMessage(SCORE_KEYS[clamped]!) || SCORE_LABELS[clamped]!;
      const anssi = browser.i18n.getMessage(ANSSI_KEYS[clamped]!) || ANSSI_MARKERS[clamped]!;

      const percent = ((clamped + 1) / 5) * 100;
      barFill.style.width = `${percent}%`;
      barFill.style.backgroundColor = color;
      meter.setAttribute('aria-valuenow', String(clamped));
      meter.setAttribute('aria-valuetext', label);
      labelEl.textContent = label;
      labelEl.style.color = color;
      anssiEl.textContent = anssi;
      suggestionEl.textContent = getM9Suggestion(score, value, mode);
    },
    show(): void {
      host.style.display = 'block';
    },
    hide(): void {
      host.style.display = 'none';
    },
  };

  return controls;
}

/**
 * Génère la suggestion textuelle pour l'indicateur M9 selon le score et le mode.
 *
 * @param score - Score zxcvbn (0-4)
 * @param value - Valeur courante du mot de passe
 * @param mode  - 'password' ou 'passphrase'
 * @returns Texte de suggestion
 */
function getM9Suggestion(score: number, value: string, mode: 'password' | 'passphrase'): string {
  if (mode === 'passphrase') {
    if (score >= 4) {
      return (
        browser.i18n.getMessage('m9_suggestion_pp_excellent') ||
        'Excellente phrase de passe ! Longue et imprévisible.'
      );
    }
    if (score >= 3) {
      return (
        browser.i18n.getMessage('m9_suggestion_pp_good') ||
        'Bonne phrase de passe ! Facile à retenir, difficile à deviner.'
      );
    }
    const words = value
      .trim()
      .split(/s+/)
      .filter((w) => w.length > 0);
    const COMMON_WORDS = new Set([
      'le',
      'la',
      'de',
      'un',
      'je',
      'et',
      'les',
      'des',
      'du',
      'en',
      'il',
      'est',
      'au',
      'ce',
      'sur',
      'que',
      'se',
      'ne',
      'sa',
      'ou',
    ]);
    if (words.length < 4) {
      return (
        browser.i18n.getMessage('m9_suggestion_pp_too_short') ||
        'Ajoutez un ou deux mots pour renforcer votre phrase de passe.'
      );
    }
    if (words.some((w) => COMMON_WORDS.has(w.toLowerCase()))) {
      return (
        browser.i18n.getMessage('m9_suggestion_pp_common_words') ||
        'Remplacez les mots très courants par des mots plus originaux.'
      );
    }
    return (
      browser.i18n.getMessage('m9_suggestion_pp_unusual_words') ||
      'Essayez des mots moins courants ou sans lien logique entre eux.'
    );
  }
  // Mode mot de passe classique
  if (score >= 4) {
    return (
      browser.i18n.getMessage('m9_suggestion_pw_excellent') ||
      'Excellent ! Ce mot de passe est très solide.'
    );
  }
  if (score >= 3) {
    return (
      browser.i18n.getMessage('m9_suggestion_pw_good') ||
      'Bon mot de passe ! Pensez aussi à la phrase de passe : plus longue, plus facile à retenir.'
    );
  }
  const hasDigit = /d/.test(value);
  const hasSymbol = /[^a-zA-Z0-9]/.test(value);
  const hasSequence = /(?:123|234|345|456|567|678|789|890|abc|bcd|cde|qwerty|azerty)/i.test(value);
  if (hasSequence) {
    return (
      browser.i18n.getMessage('m9_suggestion_pw_sequence') ||
      'Évitez les séquences prévisibles (123, abc, azerty…).'
    );
  }
  if (value.length < 12) {
    return (
      browser.i18n.getMessage('m9_suggestion_pw_too_short') ||
      'Ajoutez des caractères — visez au moins 12.'
    );
  }
  if (!hasDigit && !hasSymbol) {
    return (
      browser.i18n.getMessage('m9_suggestion_pw_no_special') ||
      'Ajoutez un chiffre ou un caractère spécial pour renforcer la force.'
    );
  }
  if (!hasSymbol && value.length >= 12) {
    return (
      browser.i18n.getMessage('m9_suggestion_pw_add_symbol') ||
      'Un caractère spécial (@, #, !) vous ferait passer à Fort.'
    );
  }
  return (
    browser.i18n.getMessage('m9_suggestion_pw_keep_going') ||
    'Continuez à améliorer votre mot de passe.'
  );
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
    ctx.overlayControls?.hide();
    return;
  }

  // Évaluation zxcvbn locale — la valeur ne quitte jamais ce contexte
  const result = zxcvbn(value);
  const mode = detectInputType(value);
  const rect = field.getBoundingClientRect();

  ctx.overlayControls?.show();
  ctx.overlayControls?.update(result.score, value, mode, rect.width);
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
  const pmHint = hasPasswordManagerHint(field);
  if (pmHint) return;

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
    // Guard anti-réentrance : empêche la boucle focus → overlay → close → refocus → overlay
    if (fieldsWithM2Active.has(field)) return;
    fieldsWithM2Active.add(field);

    const m2Shown = await handleM2OnFocus(field);

    if (!m2Shown) {
      // M2 n'a pas été affiché (signaux insuffisants, etc.) → libérer le guard
      fieldsWithM2Active.delete(field);
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
    m9Ctx.overlayControls?.hide();
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
 * Construction DOM directe + Shadow DOM (pas de Custom Elements — isolated world MV3).
 *
 * Reproduit la logique de toast-m7.ts :
 * - role="status", aria-live="polite"
 * - Timer auto-fermeture 8s, mis en pause au hover
 * - 3 boutons : "Voir comment", "OK, compris", "Ne plus ce site"
 * - Barre de progression du timer
 *
 * Sécurité (D-SEC-003) : aucun innerHTML.
 *
 * @param domainHash - Hash salé du domaine courant pour la suppression_list
 */
function showToastM7(domainHash: string): void {
  const TOAST_MS = 8000;

  const host = document.createElement('div');
  host.style.cssText =
    'all:initial; display:block; position:fixed; bottom:24px; right:24px; z-index:2147483647; max-width:380px; width:100%; pointer-events:auto;';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = [
    '.toast{display:flex;flex-direction:column;background:#fff;border:2px solid #DC2626;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.15);padding:16px;font:15px/1.5 system-ui,sans-serif;color:#111827;overflow:hidden}',
    '.hdr{display:flex;align-items:center;gap:8px;margin-bottom:8px}',
    '.ico{font-size:20px;flex-shrink:0}',
    '.ttl{flex:1;font-size:15px;font-weight:700}',
    '.cls{background:none;border:none;font-size:22px;cursor:pointer;color:#6B7280;min-height:44px;min-width:44px;display:flex;align-items:center;justify-content:center;border-radius:6px;padding:0}',
    '.cls:hover{color:#111827;background:#F3F4F6}',
    '.bdy{margin:0 0 16px;line-height:1.5;color:#111827}',
    '.acts{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}',
    '.acts button{flex:1;min-width:100px;padding:8px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:700;min-height:44px}',
    '.bl{background:#2563EB;color:#fff}.bl:hover{opacity:.9}',
    '.bo{background:#E5E7EB;color:#111827}.bo:hover{background:#D1D5DB}',
    '.bs{background:none;color:#6B7280;border:1px solid #D1D5DB!important;font-weight:400}.bs:hover{color:#111827;background:#F9FAFB}',
    '.tbg{height:3px;background:#E5E7EB;border-radius:2px;overflow:hidden;margin-top:4px}',
    '.tbar{height:100%;background:#DC2626;border-radius:2px;width:100%}',
    '@media(prefers-reduced-motion:reduce){.tbar{transition:none}}',
  ].join('');
  shadow.appendChild(style);

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('aria-atomic', 'true');

  const hdr = document.createElement('div');
  hdr.className = 'hdr';

  const ico = document.createElement('span');
  ico.className = 'ico';
  ico.setAttribute('aria-hidden', 'true');
  ico.textContent = '🔐';
  hdr.appendChild(ico);

  const ttl = document.createElement('strong');
  ttl.className = 'ttl';
  ttl.textContent = browser.i18n.getMessage('m7_toast_title') || 'Mot de passe déjà utilisé';
  hdr.appendChild(ttl);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'cls';
  closeBtn.type = 'button';
  closeBtn.setAttribute(
    'aria-label',
    browser.i18n.getMessage('m7_toast_btn_close_label') || 'Fermer cette notification',
  );
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => closeToast('acknowledged'));
  hdr.appendChild(closeBtn);
  toast.appendChild(hdr);

  const bdy = document.createElement('p');
  bdy.className = 'bdy';
  bdy.textContent =
    browser.i18n.getMessage('m7_toast_body') ||
    "Ce mot de passe est utilisé sur un autre site. La réutilisation augmente le risque si l'un de vos comptes est compromis.";
  toast.appendChild(bdy);

  const acts = document.createElement('div');
  acts.className = 'acts';

  const btnLearn = document.createElement('button');
  btnLearn.className = 'bl';
  btnLearn.type = 'button';
  btnLearn.textContent = browser.i18n.getMessage('m7_toast_btn_learn') || 'Voir comment';
  btnLearn.addEventListener('click', () => closeToast('learn_more'));
  acts.appendChild(btnLearn);

  const btnOk = document.createElement('button');
  btnOk.className = 'bo';
  btnOk.type = 'button';
  btnOk.textContent = browser.i18n.getMessage('m7_toast_btn_ok') || 'OK, compris';
  btnOk.addEventListener('click', () => closeToast('acknowledged'));
  acts.appendChild(btnOk);

  const btnSuppress = document.createElement('button');
  btnSuppress.className = 'bs';
  btnSuppress.type = 'button';
  btnSuppress.textContent = browser.i18n.getMessage('m7_toast_btn_suppress') || 'Ne plus ce site';
  btnSuppress.addEventListener('click', () => closeToast('suppress_domain'));
  acts.appendChild(btnSuppress);

  toast.appendChild(acts);

  const timerBg = document.createElement('div');
  timerBg.className = 'tbg';
  const timerBar = document.createElement('div');
  timerBar.className = 'tbar';
  timerBg.appendChild(timerBar);
  toast.appendChild(timerBg);

  shadow.appendChild(toast);

  // Timer auto-fermeture avec pause hover
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let timerStart = 0;
  let remaining = TOAST_MS;

  function startTimer(): void {
    timerStart = Date.now();
    timerBar.style.transition = `width ${remaining}ms linear`;
    timerBar.style.width = '0%';
    timerId = setTimeout(() => closeToast('timeout'), remaining);
  }

  function pauseTimer(): void {
    if (!timerId) return;
    clearTimeout(timerId);
    timerId = null;
    remaining -= Date.now() - timerStart;
    const elapsed = TOAST_MS - remaining;
    const pct = (elapsed / TOAST_MS) * 100;
    timerBar.style.transition = 'none';
    timerBar.style.width = `${pct}%`;
  }

  function resumeTimer(): void {
    if (remaining <= 0) return;
    startTimer();
  }

  toast.addEventListener('mouseenter', pauseTimer);
  toast.addEventListener('mouseleave', resumeTimer);

  function closeToast(action: string): void {
    if (timerId) clearTimeout(timerId);
    void browser.runtime.sendMessage({
      module: 'M7',
      action: 'toast_action',
      payload: { user_action: action, domain_hash: domainHash },
      timestamp: Date.now(),
    });
    host.remove();
  }

  startTimer();
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
  document.addEventListener(
    'focusin',
    (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.type !== 'password') return;

      void handleFocusOnPasswordField(target);
    },
    { capture: true },
  );

  // Attachement des listeners submit
  attachSubmitListeners();

  // Observation des mutations DOM pour les SPA
  observeDynamicForms();
}

// Démarrage du détecteur
initPasswordDetector();
