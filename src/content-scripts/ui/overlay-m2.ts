/**
 * @file content-scripts/ui/overlay-m2.ts
 * @description Composant Web Component — overlay interstitiel M2 (saisie en contexte risqué).
 *
 * S'affiche au focus sur un champ password lorsque ≥ 2 signaux de risque sont détectés.
 * Bloque la saisie via un overlay semi-transparent avec panel latéral droit (400px).
 *
 * Actions proposées :
 * - "Abandonner la saisie"    → focus barre d'adresse, fermeture, action 'abandoned'
 * - "Continuer quand même"    → fermeture, action 'dismissed'
 * - "Marquer comme confiance" → ajout whitelist, fermeture, action 'trusted'
 * - "Pourquoi ce message ?"   → bascule panneau d'explication inline, action 'why'
 *
 * Accessibilité (WCAG 2.1 AA, SFD §4.3) :
 * - role="alertdialog", aria-modal="true", aria-labelledby, aria-describedby
 * - Focus trap : premier focus sur "Abandonner la saisie" (bouton de sécurité principal)
 * - Escape = fermeture neutre (dismissed)
 * - Cibles min 44x44px (tokens CSS BaseNudge)
 *
 * Sécurité (D-SEC-003) :
 * - Aucun innerHTML — tout DOM via createElement/textContent/appendChild.
 * - Le nom du domaine dans les signaux est affiché via textContent uniquement.
 *
 * Référence : SFD §2.1 (M2), DAT §11.3 (focus trap), §11.4 (design system tokens CSS)
 */

import { BaseNudge } from './base-nudge';
import { browser } from '@/shared/browser/browser-adapter';

/** Actions utilisateur possibles sur l'overlay M2 */
export type OverlayM2Action = 'dismissed' | 'trusted' | 'abandoned' | 'why';

/** Clés i18n pour les libellés des signaux de risque */
const SIGNAL_LABEL_KEYS: Record<string, string> = {
  http: 'm2_signal_http',
  hsts_miss: 'm2_signal_hsts_miss',
  levenshtein: 'm2_signal_levenshtein',
  cert_invalid: 'm2_signal_cert_invalid',
};

/** Fallbacks en dur pour les libellés des signaux (si i18n indisponible) */
const SIGNAL_FALLBACKS: Record<string, string> = {
  http: 'Ce site utilise HTTP (non chiffré)',
  hsts_miss: "Ce site n'est pas dans la liste HSTS preload",
  levenshtein: 'Ce domaine ressemble à un site connu (typosquatting possible)',
  cert_invalid: "Le certificat TLS n'est pas valide",
};

/**
 * Web Component overlay interstitiel M2.
 *
 * Usage (déclenché depuis password-detector.ts) :
 *   const overlay = document.createElement('sn-overlay-m2') as OverlayM2;
 *   document.body.appendChild(overlay);
 *   overlay.open(signals, domainHash, (action) => { ... });
 */
export class OverlayM2 extends BaseNudge {
  /** Callback appelé quand l'utilisateur interagit */
  private onAction?: (action: OverlayM2Action) => void;
  /** Hash salé du domaine courant */
  private currentDomainHash: string = '';
  /** Signaux détectés à afficher */
  private detectedSignals: string[] = [];
  /** Conteneur du panel principal */
  private panelContainer!: HTMLDivElement;
  /** Section d'explication inline (bascule via "Pourquoi ce message ?") */
  private explanationSection!: HTMLDivElement;
  /** Handler Escape pour nettoyage */
  private escapeHandler: ((e: KeyboardEvent) => void) | null = null;

  /**
   * Construit le DOM initial de l'overlay.
   * Appelé par BaseNudge.connectedCallback() après initialisation du Shadow DOM.
   */
  render(): void {
    // Styles propres à l'overlay M2
    const style = document.createElement('style');
    style.textContent = this.getOverlayStyles();
    this.shadow.appendChild(style);

    // --- Backdrop semi-transparent ---
    const backdrop = document.createElement('div');
    backdrop.setAttribute('id', 'sn-m2-backdrop');
    backdrop.setAttribute('aria-hidden', 'true');
    // Clic sur backdrop = fermeture neutre
    backdrop.addEventListener('click', () => this.closeOverlay('dismissed'));
    this.shadow.appendChild(backdrop);

    // --- Panel principal (role="alertdialog") ---
    this.panelContainer = document.createElement('div');
    this.panelContainer.setAttribute('id', 'sn-m2-panel');
    this.panelContainer.setAttribute('role', 'alertdialog');
    this.panelContainer.setAttribute('aria-modal', 'true');
    this.panelContainer.setAttribute('aria-labelledby', 'sn-m2-title');
    this.panelContainer.setAttribute('aria-describedby', 'sn-m2-description');

    // --- Icône d'alerte ---
    const iconWrapper = document.createElement('div');
    iconWrapper.setAttribute('id', 'sn-m2-icon-wrapper');
    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('id', 'sn-m2-icon');
    icon.textContent = '⚠️';
    iconWrapper.appendChild(icon);
    this.panelContainer.appendChild(iconWrapper);

    // --- Titre ---
    const title = document.createElement('h2');
    title.setAttribute('id', 'sn-m2-title');
    title.textContent = browser.i18n.getMessage('m2_overlay_title') || 'Site à risque détecté';
    this.panelContainer.appendChild(title);

    // --- Description ---
    const description = document.createElement('p');
    description.setAttribute('id', 'sn-m2-description');
    description.textContent =
      browser.i18n.getMessage('m2_overlay_description') ||
      'Sentinel Nudge a détecté des signaux de risque sur ce site.';
    this.panelContainer.appendChild(description);

    // --- Liste des signaux (construite dynamiquement dans open()) ---
    const signalsList = document.createElement('ul');
    signalsList.setAttribute('id', 'sn-m2-signals');
    signalsList.setAttribute(
      'aria-label',
      browser.i18n.getMessage('m2_overlay_signals_label') || 'Signaux de risque détectés',
    );
    this.panelContainer.appendChild(signalsList);

    // --- Section d'explication inline (masquée par défaut) ---
    this.explanationSection = document.createElement('div');
    this.explanationSection.setAttribute('id', 'sn-m2-explanation');
    this.explanationSection.setAttribute('hidden', '');
    this.buildExplanation(this.explanationSection);
    this.panelContainer.appendChild(this.explanationSection);

    // --- Boutons d'action ---
    const actions = document.createElement('div');
    actions.setAttribute('id', 'sn-m2-actions');

    // Bouton 1 : Abandonner (focus barre d'adresse) — premier focus (sécurité)
    const btnAbandon = document.createElement('button');
    btnAbandon.setAttribute('id', 'sn-m2-btn-abandon');
    btnAbandon.setAttribute('type', 'button');
    btnAbandon.textContent =
      browser.i18n.getMessage('m2_overlay_btn_abandon') || 'Abandonner la saisie';
    btnAbandon.addEventListener('click', () => this.closeOverlay('abandoned'));

    // Bouton 2 : Continuer quand même
    const btnContinue = document.createElement('button');
    btnContinue.setAttribute('id', 'sn-m2-btn-continue');
    btnContinue.setAttribute('type', 'button');
    btnContinue.textContent =
      browser.i18n.getMessage('m2_overlay_btn_dismiss') || 'Continuer quand même';
    btnContinue.addEventListener('click', () => this.closeOverlay('dismissed'));

    // Bouton 3 : Marquer comme de confiance
    const btnTrust = document.createElement('button');
    btnTrust.setAttribute('id', 'sn-m2-btn-trust');
    btnTrust.setAttribute('type', 'button');
    btnTrust.textContent =
      browser.i18n.getMessage('m2_overlay_btn_trust') || 'Marquer comme de confiance';
    btnTrust.addEventListener('click', () => this.closeOverlay('trusted'));

    // Bouton 4 : Pourquoi ce message ?
    const btnWhy = document.createElement('button');
    btnWhy.setAttribute('id', 'sn-m2-btn-why');
    btnWhy.setAttribute('type', 'button');
    btnWhy.setAttribute('aria-expanded', 'false');
    btnWhy.setAttribute('aria-controls', 'sn-m2-explanation');
    btnWhy.textContent = browser.i18n.getMessage('m2_overlay_btn_why') || 'Pourquoi ce message ?';
    btnWhy.addEventListener('click', () => this.toggleExplanation(btnWhy));

    actions.appendChild(btnAbandon);
    actions.appendChild(btnContinue);
    actions.appendChild(btnTrust);
    actions.appendChild(btnWhy);
    this.panelContainer.appendChild(actions);

    this.shadow.appendChild(this.panelContainer);

    // Handler Escape pour fermeture neutre (SFD §2.1 — Escape = dismissed)
    this.escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.closeOverlay('dismissed');
      }
    };
    document.addEventListener('keydown', this.escapeHandler);
  }

  /**
   * Ouvre l'overlay avec les signaux détectés et démarre le focus trap.
   * Le premier focus est positionné sur "Abandonner la saisie" (SFD §2.1).
   *
   * @param signals    - Signaux de risque détectés par risk-analyzer
   * @param domainHash - SHA-256(salt + domain) du domaine courant
   * @param onAction   - Callback appelé avec l'action choisie par l'utilisateur
   */
  open(signals: string[], domainHash: string, onAction: (action: OverlayM2Action) => void): void {
    this.detectedSignals = signals;
    this.currentDomainHash = domainHash;
    this.onAction = onAction;

    // Remplir la liste des signaux
    this.populateSignalsList(signals);

    // Afficher l'overlay
    this.panelContainer.removeAttribute('hidden');

    // Focus trap — premier focus sur "Abandonner la saisie" (bouton de sécurité principal)
    this.trapFocus(this.panelContainer);
  }

  /**
   * Remplit la liste des signaux dans le DOM.
   * Utilise textContent pour chaque item (D-SEC-003 : jamais innerHTML).
   *
   * @param signals - Signaux à afficher
   */
  private populateSignalsList(signals: string[]): void {
    const list = this.shadow.getElementById('sn-m2-signals');
    if (!list) return;

    // Vider la liste précédente
    while (list.firstChild) {
      list.removeChild(list.firstChild);
    }

    for (const signal of signals) {
      const item = document.createElement('li');
      item.setAttribute('class', 'sn-m2-signal-item');
      // Libellé i18n ou fallback en dur — jamais interpolation non-sécurisée
      const i18nKey = SIGNAL_LABEL_KEYS[signal];
      const fallback = SIGNAL_FALLBACKS[signal] ?? `Signal : ${signal}`;
      item.textContent = i18nKey ? browser.i18n.getMessage(i18nKey) || fallback : fallback;
      list.appendChild(item);
    }
  }

  /**
   * Construit la section d'explication inline avec les sources scientifiques.
   * Utilisé pour "Pourquoi ce message ?" (SFD §2.1.1 — afficher explication inline).
   *
   * @param section - Conteneur de l'explication
   */
  private buildExplanation(section: HTMLDivElement): void {
    const titleEl = document.createElement('h3');
    titleEl.textContent =
      browser.i18n.getMessage('m2_explanation_title') || 'Pourquoi cette alerte ?';
    section.appendChild(titleEl);

    const para1 = document.createElement('p');
    para1.textContent =
      browser.i18n.getMessage('m2_explanation_para1') ||
      'Les signaux détectés indiquent que ce site présente des caractéristiques ' +
        "couramment associées aux attaques de phishing et d'usurpation d'identité.";
    section.appendChild(para1);

    const para2 = document.createElement('p');
    para2.textContent =
      browser.i18n.getMessage('m2_explanation_para2') ||
      'Saisir un mot de passe sur un site non sécurisé ou imitant un site connu ' +
        'expose vos identifiants à des tiers malveillants.';
    section.appendChild(para2);

    // Bouton "En savoir plus" — ouvre la page d'explication statique
    const btnLearnMore = document.createElement('button');
    btnLearnMore.setAttribute('id', 'sn-m2-btn-learn');
    btnLearnMore.setAttribute('type', 'button');
    btnLearnMore.textContent =
      browser.i18n.getMessage('m2_overlay_btn_learn') || 'En savoir plus sur les risques';
    btnLearnMore.addEventListener('click', () => {
      void browser.runtime.sendMessage({
        module: 'M2',
        action: 'open_explanation',
        payload: { signals: this.detectedSignals },
        timestamp: Date.now(),
      });
    });
    section.appendChild(btnLearnMore);
  }

  /**
   * Bascule la visibilité de la section d'explication inline.
   *
   * @param btnWhy - Bouton déclencheur (pour mettre à jour aria-expanded)
   */
  private toggleExplanation(btnWhy: HTMLButtonElement): void {
    const isHidden = this.explanationSection.hasAttribute('hidden');
    if (isHidden) {
      this.explanationSection.removeAttribute('hidden');
      btnWhy.setAttribute('aria-expanded', 'true');
    } else {
      this.explanationSection.setAttribute('hidden', '');
      btnWhy.setAttribute('aria-expanded', 'false');
    }
  }

  /**
   * Ferme l'overlay, envoie l'action au service worker, retire l'élément du DOM.
   *
   * Actions spéciales :
   * - 'abandoned' : tente de focus la barre d'adresse via window.focus() + blur()
   *                 (MV3 ne permet pas d'accéder directement à l'omnibox depuis CS)
   * - 'trusted'   : envoie domain_hash pour ajout en whitelist M2
   *
   * @param action - Action sélectionnée
   */
  private closeOverlay(action: OverlayM2Action): void {
    // Nettoyage du handler Escape
    if (this.escapeHandler) {
      document.removeEventListener('keydown', this.escapeHandler);
      this.escapeHandler = null;
    }

    // Notification au service worker
    void browser.runtime.sendMessage({
      module: 'M2',
      action: 'overlay_action',
      payload: {
        user_action: action,
        domain_hash: this.currentDomainHash,
        signals: this.detectedSignals,
      },
      timestamp: Date.now(),
    });

    this.onAction?.(action);

    // Action "Abandonner" : rendre le focus à la barre d'adresse
    if (action === 'abandoned') {
      // En MV3, le content script ne peut pas focus l'omnibox directement.
      // On blur le champ actif pour aider l'utilisateur à reprendre le contrôle.
      const active = document.activeElement;
      if (active instanceof HTMLElement) {
        active.blur();
      }
    }

    this.remove();
  }

  /**
   * Retourne les styles CSS propres à l'overlay M2.
   * Respecte les tokens du design system BaseNudge.
   *
   * @returns Chaîne CSS pour l'overlay
   */
  private getOverlayStyles(): string {
    return `
      :host {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 2147483647;
        pointer-events: none;
      }

      #sn-m2-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.30);
        pointer-events: all;
        animation: sn-m2-fade-in 200ms ease-out;
      }

      #sn-m2-panel {
        position: fixed;
        top: 0;
        right: 0;
        height: 100vh;
        width: 400px;
        max-width: 100vw;
        background: var(--sn-color-bg);
        box-shadow: -4px 0 20px rgba(0, 0, 0, 0.20);
        display: flex;
        flex-direction: column;
        padding: var(--sn-space-lg);
        overflow-y: auto;
        pointer-events: all;
        font-family: system-ui, sans-serif;
        font-size: var(--sn-font-size-body);
        color: var(--sn-color-fg);
        animation: sn-m2-slide-in 200ms ease-out;
        box-sizing: border-box;
      }

      @keyframes sn-m2-fade-in {
        from { opacity: 0; }
        to   { opacity: 1; }
      }

      @keyframes sn-m2-slide-in {
        from { transform: translateX(100%); opacity: 0; }
        to   { transform: translateX(0);    opacity: 1; }
      }

      #sn-m2-icon-wrapper {
        text-align: center;
        margin-bottom: var(--sn-space-md);
      }

      #sn-m2-icon {
        font-size: 48px;
        display: block;
        line-height: 1;
      }

      #sn-m2-title {
        font-size: var(--sn-font-size-title);
        font-weight: var(--sn-font-weight-bold);
        color: var(--sn-color-danger);
        margin: 0 0 var(--sn-space-sm) 0;
        text-align: center;
      }

      #sn-m2-description {
        margin: 0 0 var(--sn-space-md) 0;
        line-height: var(--sn-line-height);
        color: var(--sn-color-fg);
      }

      #sn-m2-signals {
        list-style: none;
        padding: 0;
        margin: 0 0 var(--sn-space-md) 0;
        display: flex;
        flex-direction: column;
        gap: var(--sn-space-xs);
      }

      .sn-m2-signal-item {
        background: #FEF2F2;
        border-left: 3px solid var(--sn-color-danger);
        padding: var(--sn-space-sm) var(--sn-space-md);
        border-radius: 0 var(--sn-radius) var(--sn-radius) 0;
        font-size: var(--sn-font-size-small);
        color: var(--sn-color-fg);
      }

      #sn-m2-explanation {
        background: #F0F9FF;
        border: 1px solid #BAE6FD;
        border-radius: var(--sn-radius);
        padding: var(--sn-space-md);
        margin-bottom: var(--sn-space-md);
      }

      #sn-m2-explanation h3 {
        margin: 0 0 var(--sn-space-sm) 0;
        font-size: var(--sn-font-size-body);
        font-weight: var(--sn-font-weight-bold);
        color: var(--sn-color-accent);
      }

      #sn-m2-explanation p {
        margin: 0 0 var(--sn-space-sm) 0;
        font-size: var(--sn-font-size-small);
        line-height: var(--sn-line-height);
        color: var(--sn-color-fg);
      }

      #sn-m2-explanation p:last-of-type {
        margin-bottom: 0;
      }

      #sn-m2-btn-learn {
        margin-top: var(--sn-space-sm);
        background: none;
        border: 1px solid var(--sn-color-accent);
        color: var(--sn-color-accent);
        font-size: var(--sn-font-size-small);
        padding: var(--sn-space-xs) var(--sn-space-sm);
        min-height: var(--sn-min-target);
        min-width: 0;
        cursor: pointer;
        border-radius: var(--sn-radius);
      }

      #sn-m2-btn-learn:hover {
        background: #EFF6FF;
      }

      #sn-m2-actions {
        display: flex;
        flex-direction: column;
        gap: var(--sn-space-sm);
        margin-top: auto;
        padding-top: var(--sn-space-md);
      }

      #sn-m2-actions button {
        width: 100%;
        min-height: var(--sn-min-target);
        border-radius: var(--sn-radius);
        cursor: pointer;
        font-size: var(--sn-font-size-body);
        font-weight: var(--sn-font-weight-bold);
        border: none;
        text-align: center;
      }

      #sn-m2-btn-abandon {
        background: var(--sn-color-danger);
        color: #ffffff;
        order: 0;
      }

      #sn-m2-btn-abandon:hover {
        opacity: 0.9;
      }

      #sn-m2-btn-continue {
        background: #E5E7EB;
        color: var(--sn-color-fg);
        order: 1;
      }

      #sn-m2-btn-continue:hover {
        background: #D1D5DB;
      }

      #sn-m2-btn-trust {
        background: none;
        border: 1px solid var(--sn-color-success) !important;
        color: var(--sn-color-success);
        order: 2;
      }

      #sn-m2-btn-trust:hover {
        background: #F0FDF4;
      }

      #sn-m2-btn-why {
        background: none;
        border: 1px solid #D1D5DB !important;
        color: var(--sn-color-muted);
        font-weight: var(--sn-font-weight-normal);
        font-size: var(--sn-font-size-small);
        order: 3;
      }

      #sn-m2-btn-why:hover {
        color: var(--sn-color-fg);
        background: #F9FAFB;
      }

      @media (max-width: 440px) {
        #sn-m2-panel {
          width: 100vw;
        }
      }
    `;
  }
}

// Déclaration du custom element
if (!customElements.get('sn-overlay-m2')) {
  customElements.define('sn-overlay-m2', OverlayM2);
}
