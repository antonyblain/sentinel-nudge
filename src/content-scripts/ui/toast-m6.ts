/**
 * @file content-scripts/ui/toast-m6.ts
 * @description Composant Web Component — toast M6 (notification "Quiz phishing disponible").
 *
 * S'affiche quand la date de quiz de spaced repetition est atteinte et que les conditions
 * sont réunies (quota disponible, pas de formulaire actif).
 *
 * Actions proposées :
 * - "Commencer maintenant" → ouvre l'overlay quiz M6
 * - "Plus tard"            → reporte la notification (accessible depuis le dashboard 7j)
 * - Fermeture (×)         → ferme la notification (même comportement que "Plus tard")
 *
 * Accessibilité (WCAG 2.1 AA, SFD §4.3) :
 * - role="status", aria-live="polite"
 * - aria-atomic="true"
 * - Cibles min 44x44px (tokens CSS BaseNudge)
 *
 * Sécurité (D-SEC-003) :
 * - Aucun innerHTML — tout DOM via createElement/textContent/appendChild.
 *
 * Référence : SFD §2.4 (M6), DAT §11.3, §11.4
 */

import { BaseNudge } from './base-nudge';
import { browser } from '@/shared/browser/browser-adapter';

/** Actions utilisateur possibles sur le toast M6 */
export type ToastM6Action = 'start_quiz' | 'later' | 'closed';

/**
 * Web Component toast M6 — notification quiz phishing disponible.
 *
 * Usage (déclenché par le message 'show_quiz_toast' du service worker) :
 *   const toast = document.createElement('sn-toast-m6') as ToastM6;
 *   document.body.appendChild(toast);
 *   toast.open((action) => { ... });
 */
export class ToastM6 extends BaseNudge {
  /** Callback appelé quand l'utilisateur interagit */
  private onAction?: (action: ToastM6Action) => void;
  /** Conteneur principal du toast */
  private toastContainer!: HTMLDivElement;

  /**
   * Construit le DOM initial du toast.
   * Appelé par BaseNudge.connectedCallback() après initialisation du Shadow DOM.
   */
  render(): void {
    // Styles propres au toast M6
    const style = document.createElement('style');
    style.textContent = this.getToastStyles();
    this.shadow.appendChild(style);

    // Conteneur principal — role="status" aria-live="polite"
    this.toastContainer = document.createElement('div');
    this.toastContainer.setAttribute('id', 'sn-m6-toast');
    this.toastContainer.setAttribute('role', 'status');
    this.toastContainer.setAttribute('aria-live', 'polite');
    this.toastContainer.setAttribute('aria-atomic', 'true');

    // --- En-tête ---
    const header = document.createElement('div');
    header.setAttribute('id', 'sn-m6-header');

    const icon = document.createElement('span');
    icon.setAttribute('id', 'sn-m6-icon');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '🎯';

    const title = document.createElement('strong');
    title.setAttribute('id', 'sn-m6-title');
    title.textContent = 'Quiz phishing disponible';

    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('id', 'sn-m6-close');
    closeBtn.setAttribute('type', 'button');
    closeBtn.setAttribute('aria-label', 'Fermer cette notification');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => {
      this.closeToast('closed');
    });

    header.appendChild(icon);
    header.appendChild(title);
    header.appendChild(closeBtn);
    this.toastContainer.appendChild(header);

    // --- Corps ---
    const body = document.createElement('p');
    body.setAttribute('id', 'sn-m6-body');
    body.textContent =
      'Votre prochain quiz de sensibilisation au phishing est disponible. ' +
      '3 questions pour tester et renforcer votre vigilance.';
    this.toastContainer.appendChild(body);

    // --- Zone des boutons d'action ---
    const actionsArea = document.createElement('div');
    actionsArea.setAttribute('id', 'sn-m6-actions');
    this.buildActionButtons(actionsArea);
    this.toastContainer.appendChild(actionsArea);

    this.shadow.appendChild(this.toastContainer);

    // Focus trap pour l'accessibilité
    this.trapFocus(this.toastContainer);
  }

  /**
   * Ouvre le toast.
   *
   * @param onAction - Callback appelé avec l'action choisie
   */
  open(onAction: (action: ToastM6Action) => void): void {
    this.onAction = onAction;
    this.toastContainer.style.display = 'flex';
  }

  /**
   * Construit les boutons d'action.
   *
   * @param container - Conteneur des boutons
   */
  private buildActionButtons(container: HTMLElement): void {
    // Bouton 1 : Commencer maintenant (action principale)
    const btnStart = document.createElement('button');
    btnStart.setAttribute('id', 'sn-m6-btn-start');
    btnStart.setAttribute('type', 'button');
    btnStart.textContent = 'Commencer maintenant';
    btnStart.addEventListener('click', () => {
      this.closeToast('start_quiz');
    });

    // Bouton 2 : Plus tard (defer 7j disponible depuis dashboard)
    const btnLater = document.createElement('button');
    btnLater.setAttribute('id', 'sn-m6-btn-later');
    btnLater.setAttribute('type', 'button');
    btnLater.textContent = 'Plus tard';
    btnLater.addEventListener('click', () => {
      this.closeToast('later');
    });

    container.appendChild(btnStart);
    container.appendChild(btnLater);
  }

  /**
   * Ferme le toast, envoie l'action au service worker, et supprime l'élément.
   *
   * @param action - Action sélectionnée
   */
  private closeToast(action: ToastM6Action): void {
    void browser.runtime.sendMessage({
      module: 'M6',
      action: 'toast_action',
      payload: { user_action: action },
      timestamp: Date.now(),
    });
    this.onAction?.(action);
    this.remove();
  }

  /**
   * Retourne les styles CSS propres au toast M6.
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

      #sn-m6-toast {
        display: none;
        flex-direction: column;
        background: var(--sn-color-bg);
        border: 2px solid var(--sn-color-success);
        border-radius: var(--sn-radius);
        box-shadow: var(--sn-shadow);
        padding: var(--sn-space-md);
        font-family: system-ui, sans-serif;
        font-size: var(--sn-font-size-body);
        color: var(--sn-color-fg);
        overflow: hidden;
        animation: sn-m6-slide-up 200ms ease-out;
      }

      @keyframes sn-m6-slide-up {
        from { transform: translateY(20px); opacity: 0; }
        to   { transform: translateY(0);    opacity: 1; }
      }

      #sn-m6-header {
        display: flex;
        align-items: center;
        gap: var(--sn-space-sm);
        margin-bottom: var(--sn-space-sm);
      }

      #sn-m6-icon {
        font-size: 20px;
        flex-shrink: 0;
      }

      #sn-m6-title {
        flex: 1;
        font-size: var(--sn-font-size-title);
        font-weight: var(--sn-font-weight-bold);
      }

      #sn-m6-close {
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

      #sn-m6-close:hover {
        color: var(--sn-color-fg);
        background: #F3F4F6;
      }

      #sn-m6-body {
        margin: 0 0 var(--sn-space-md) 0;
        line-height: var(--sn-line-height);
        color: var(--sn-color-fg);
        font-size: var(--sn-font-size-small);
      }

      #sn-m6-actions {
        display: flex;
        flex-direction: column;
        gap: var(--sn-space-sm);
      }

      #sn-m6-actions button {
        width: 100%;
        min-height: var(--sn-min-target);
        padding: var(--sn-space-sm) var(--sn-space-md);
        border: none;
        border-radius: var(--sn-radius);
        cursor: pointer;
        font-size: var(--sn-font-size-small);
        font-weight: var(--sn-font-weight-bold);
        text-align: center;
      }

      #sn-m6-btn-start {
        background: var(--sn-color-success);
        color: #ffffff;
      }

      #sn-m6-btn-start:hover {
        opacity: 0.9;
      }

      #sn-m6-btn-later {
        background: #E5E7EB;
        color: var(--sn-color-fg);
        font-weight: var(--sn-font-weight-normal);
      }

      #sn-m6-btn-later:hover {
        background: #D1D5DB;
      }
    `;
  }
}

/**
 * Enregistre le custom element sn-toast-m6 dans le DOM.
 * Appelé par le détecteur associé pour garantir l'inclusion dans le bundle Vite.
 */
export function registerToastM6(): void {
    if (typeof window !== "undefined" && window.customElements && !window.customElements.get('sn-toast-m6')) {
      window.customElements.define('sn-toast-m6', ToastM6);
    }
}
