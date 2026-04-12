/**
 * @file content-scripts/ui/toast-m7.ts
 * @description Composant Web Component — toast M7 (nudge réutilisation mot de passe).
 *
 * S'affiche après soumission d'un formulaire si un hash de mot de passe déjà connu
 * est détecté par le service worker (réutilisation inter-domaines).
 *
 * Actions proposées :
 * - "Voir comment" → ouvre la page d'explication des gestionnaires de mots de passe
 * - "OK compris"   → ferme le toast, enregistre l'action 'acknowledged'
 * - "Ne plus ce site" → ajoute le domaine à la suppression_list, ferme le toast
 *
 * Comportement :
 * - Timer auto-fermeture 8s, mis en pause au hover (prefers-reduced-motion ignoré pour timer)
 * - Position fixe en bas à droite de la page
 *
 * Accessibilité (WCAG 2.1 AA) :
 * - role="status", aria-live="polite", aria-atomic="true"
 * - Cibles min 44x44px (tokens CSS BaseNudge)
 * - Navigation clavier (Tab/Shift+Tab via trapFocus BaseNudge)
 *
 * Sécurité (D-SEC-003) :
 * - Aucun innerHTML — tout DOM via createElement/textContent/appendChild.
 *
 * Référence : SFD §2.5 (M7), DAT §11.3, §11.4
 */

import { BaseNudge } from './base-nudge';
import { browser } from '@/shared/browser/browser-adapter';

/** Durée d'affichage automatique en millisecondes */
const TOAST_DURATION_MS = 8000;

/** Actions utilisateur possibles sur le toast M7 */
export type ToastM7Action = 'learn_more' | 'acknowledged' | 'suppress_domain' | 'timeout';

/**
 * Web Component toast M7 — nudge d'adoption gestionnaire de mots de passe.
 *
 * Usage (déclenché depuis le content script) :
 *   const toast = document.createElement('sn-toast-m7') as ToastM7;
 *   document.body.appendChild(toast);
 *   toast.open(domainHash, (action) => { ... });
 */
export class ToastM7 extends BaseNudge {
  /** Callback appelé quand l'utilisateur interagit (action) */
  private onAction?: (action: ToastM7Action) => void;
  /** Hash salé du domaine courant (pour la suppression_list) */
  private currentDomainHash: string = '';
  /** ID du timer d'auto-fermeture */
  private timerId: ReturnType<typeof setTimeout> | null = null;
  /** Timestamp de début du timer (pour la pause hover) */
  private timerStart: number = 0;
  /** Temps restant au moment de la pause */
  private timeRemaining: number = TOAST_DURATION_MS;
  /** Conteneur principal du toast */
  private toastContainer!: HTMLDivElement;
  /** Barre de progression du timer */
  private timerBar!: HTMLDivElement;

  /**
   * Construit le DOM initial du toast.
   * Appelé par BaseNudge.connectedCallback() après initialisation du Shadow DOM.
   */
  render(): void {
    // Styles propres au toast
    const style = document.createElement('style');
    style.textContent = this.getToastStyles();
    this.shadow.appendChild(style);

    // Conteneur principal — role="status" pour les lecteurs d'écran
    this.toastContainer = document.createElement('div');
    this.toastContainer.setAttribute('id', 'sn-m7-toast');
    this.toastContainer.setAttribute('role', 'status');
    this.toastContainer.setAttribute('aria-live', 'polite');
    this.toastContainer.setAttribute('aria-atomic', 'true');

    // --- En-tête ---
    const header = document.createElement('div');
    header.setAttribute('id', 'sn-m7-header');

    const icon = document.createElement('span');
    icon.setAttribute('id', 'sn-m7-icon');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '🔐';

    const title = document.createElement('strong');
    title.setAttribute('id', 'sn-m7-title');
    title.textContent = 'Mot de passe déjà utilisé';

    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('id', 'sn-m7-close');
    closeBtn.setAttribute('type', 'button');
    closeBtn.setAttribute('aria-label', 'Fermer cette notification');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => {
      this.closeToast('acknowledged');
    });

    header.appendChild(icon);
    header.appendChild(title);
    header.appendChild(closeBtn);
    this.toastContainer.appendChild(header);

    // --- Corps ---
    const body = document.createElement('p');
    body.setAttribute('id', 'sn-m7-body');
    body.textContent =
      'Ce mot de passe est utilisé sur un autre site. ' +
      "La réutilisation augmente le risque si l'un de vos comptes est compromis.";
    this.toastContainer.appendChild(body);

    // --- Boutons d'action ---
    const actions = document.createElement('div');
    actions.setAttribute('id', 'sn-m7-actions');

    const btnLearnMore = document.createElement('button');
    btnLearnMore.setAttribute('id', 'sn-m7-btn-learn');
    btnLearnMore.setAttribute('type', 'button');
    btnLearnMore.textContent = 'Voir comment';
    btnLearnMore.addEventListener('click', () => {
      this.closeToast('learn_more');
    });

    const btnOk = document.createElement('button');
    btnOk.setAttribute('id', 'sn-m7-btn-ok');
    btnOk.setAttribute('type', 'button');
    btnOk.textContent = 'OK, compris';
    btnOk.addEventListener('click', () => {
      this.closeToast('acknowledged');
    });

    const btnSuppress = document.createElement('button');
    btnSuppress.setAttribute('id', 'sn-m7-btn-suppress');
    btnSuppress.setAttribute('type', 'button');
    btnSuppress.textContent = 'Ne plus ce site';
    btnSuppress.addEventListener('click', () => {
      this.closeToast('suppress_domain');
    });

    actions.appendChild(btnLearnMore);
    actions.appendChild(btnOk);
    actions.appendChild(btnSuppress);
    this.toastContainer.appendChild(actions);

    // --- Barre de progression du timer ---
    const timerBg = document.createElement('div');
    timerBg.setAttribute('id', 'sn-m7-timer-bg');

    this.timerBar = document.createElement('div');
    this.timerBar.setAttribute('id', 'sn-m7-timer-bar');
    timerBg.appendChild(this.timerBar);
    this.toastContainer.appendChild(timerBg);

    this.shadow.appendChild(this.toastContainer);

    // Pause du timer au hover
    this.toastContainer.addEventListener('mouseenter', () => this.pauseTimer());
    this.toastContainer.addEventListener('mouseleave', () => this.resumeTimer());
  }

  /**
   * Ouvre le toast et démarre le timer d'auto-fermeture.
   *
   * @param domainHash - SHA-256(salt + domain) du domaine courant
   * @param onAction   - Callback appelé avec l'action choisie par l'utilisateur
   */
  open(domainHash: string, onAction: (action: ToastM7Action) => void): void {
    this.currentDomainHash = domainHash;
    this.onAction = onAction;
    this.timeRemaining = TOAST_DURATION_MS;
    this.toastContainer.style.display = 'flex';
    this.startTimer();
  }

  /**
   * Ferme le toast, envoie l'action au service worker, et supprime l'élément.
   *
   * @param action - Action sélectionnée par l'utilisateur
   */
  private closeToast(action: ToastM7Action): void {
    this.stopTimer();
    // Notification au service worker pour enregistrement
    void browser.runtime.sendMessage({
      module: 'M7',
      action: 'toast_action',
      payload: {
        user_action: action,
        domain_hash: this.currentDomainHash,
      },
      timestamp: Date.now(),
    });
    this.onAction?.(action);
    this.remove();
  }

  /**
   * Démarre le timer d'auto-fermeture avec animation de la barre.
   */
  private startTimer(): void {
    this.timerStart = Date.now();
    this.timerBar.style.transition = `width ${this.timeRemaining}ms linear`;
    this.timerBar.style.width = '0%';

    this.timerId = setTimeout(() => {
      this.closeToast('timeout');
    }, this.timeRemaining);
  }

  /**
   * Met en pause le timer au survol.
   */
  private pauseTimer(): void {
    if (this.timerId === null) return;
    clearTimeout(this.timerId);
    this.timerId = null;
    this.timeRemaining -= Date.now() - this.timerStart;
    // Figer la barre de progression
    const elapsed = TOAST_DURATION_MS - this.timeRemaining;
    const progressPct = (elapsed / TOAST_DURATION_MS) * 100;
    this.timerBar.style.transition = 'none';
    this.timerBar.style.width = `${progressPct}%`;
  }

  /**
   * Reprend le timer après la fin du survol.
   */
  private resumeTimer(): void {
    if (this.timeRemaining <= 0) return;
    this.startTimer();
  }

  /**
   * Arrête le timer sans fermer le toast.
   */
  private stopTimer(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Retourne les styles CSS propres au toast M7.
   */
  private getToastStyles(): string {
    return `
      :host {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483647;
        max-width: 380px;
        width: 100%;
      }

      #sn-m7-toast {
        display: none;
        flex-direction: column;
        background: var(--sn-color-bg);
        border: 2px solid var(--sn-color-danger);
        border-radius: var(--sn-radius);
        box-shadow: var(--sn-shadow);
        padding: var(--sn-space-md);
        font-family: system-ui, sans-serif;
        font-size: var(--sn-font-size-body);
        color: var(--sn-color-fg);
        overflow: hidden;
      }

      #sn-m7-header {
        display: flex;
        align-items: center;
        gap: var(--sn-space-sm);
        margin-bottom: var(--sn-space-sm);
      }

      #sn-m7-icon {
        font-size: 20px;
        flex-shrink: 0;
      }

      #sn-m7-title {
        flex: 1;
        font-size: var(--sn-font-size-title);
        font-weight: var(--sn-font-weight-bold);
      }

      #sn-m7-close {
        background: none;
        border: none;
        font-size: 22px;
        cursor: pointer;
        color: var(--sn-color-muted);
        min-height: var(--sn-min-target);
        min-width: var(--sn-min-target);
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--sn-radius);
        padding: 0;
      }

      #sn-m7-close:hover {
        color: var(--sn-color-fg);
        background: #F3F4F6;
      }

      #sn-m7-body {
        margin: 0 0 var(--sn-space-md) 0;
        line-height: var(--sn-line-height);
        color: var(--sn-color-fg);
      }

      #sn-m7-actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--sn-space-sm);
        margin-bottom: var(--sn-space-sm);
      }

      #sn-m7-actions button {
        flex: 1;
        min-width: 100px;
        padding: var(--sn-space-sm) var(--sn-space-sm);
        border: none;
        border-radius: var(--sn-radius);
        cursor: pointer;
        font-size: var(--sn-font-size-small);
        font-weight: var(--sn-font-weight-bold);
      }

      #sn-m7-btn-learn {
        background: var(--sn-color-accent);
        color: #ffffff;
      }

      #sn-m7-btn-learn:hover {
        opacity: 0.9;
      }

      #sn-m7-btn-ok {
        background: #E5E7EB;
        color: var(--sn-color-fg);
      }

      #sn-m7-btn-ok:hover {
        background: #D1D5DB;
      }

      #sn-m7-btn-suppress {
        background: none;
        color: var(--sn-color-muted);
        border: 1px solid #D1D5DB !important;
        font-weight: var(--sn-font-weight-normal);
      }

      #sn-m7-btn-suppress:hover {
        color: var(--sn-color-fg);
        background: #F9FAFB;
      }

      #sn-m7-timer-bg {
        height: 3px;
        background: #E5E7EB;
        border-radius: 2px;
        overflow: hidden;
        margin-top: var(--sn-space-xs);
      }

      #sn-m7-timer-bar {
        height: 100%;
        background: var(--sn-color-danger);
        border-radius: 2px;
        width: 100%;
      }
    `;
  }
}

// Déclaration du custom element
if (!customElements.get('sn-toast-m7')) {
  customElements.define('sn-toast-m7', ToastM7);
}
