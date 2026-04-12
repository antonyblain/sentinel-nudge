/**
 * @file content-scripts/ui/toast-m5.ts
 * @description Composant Web Component — toast M5 (rappel de mise à jour navigateur).
 *
 * S'affiche quand une mise à jour navigateur est disponible ET que les conditions
 * de déclenchement sont réunies (délai 48h, hors plein écran, quota disponible).
 *
 * Actions proposées :
 * - "Mettre à jour maintenant" → ouvre chrome://settings/help (max 3 snoozed consécutifs)
 * - "Me rappeler dans 4 heures" → reporte le nudge (masqué après 3 reports consécutifs)
 * - "Pourquoi c'est important ?" → ouvre la page d'explication M5
 * - Fermeture (×) → action 'closed'
 *
 * Accessibilité (WCAG 2.1 AA, SFD §4.3) :
 * - role="status", aria-live="polite" (M5 — information non urgente)
 * - aria-atomic="true"
 * - Cibles min 44x44px (tokens CSS BaseNudge)
 *
 * Sécurité (D-SEC-003) :
 * - Aucun innerHTML — tout DOM via createElement/textContent/appendChild.
 *
 * Référence : SFD §2.3 (M5), DAT §11.3, §11.4
 */

import { BaseNudge } from './base-nudge';
import { browser } from '@/shared/browser/browser-adapter';

/** Actions utilisateur possibles sur le toast M5 */
export type ToastM5Action = 'update_now' | 'remind_4h' | 'why' | 'closed';

/**
 * Web Component toast M5 — rappel mise à jour navigateur.
 *
 * Usage (déclenché depuis le content script récepteur) :
 *   const toast = document.createElement('sn-toast-m5') as ToastM5;
 *   document.body.appendChild(toast);
 *   toast.open(snoozeCount, (action) => { ... });
 */
export class ToastM5 extends BaseNudge {
  /** Callback appelé quand l'utilisateur interagit */
  private onAction?: (action: ToastM5Action) => void;
  /** Nombre de reports consécutifs déjà effectués */
  private snoozeCount = 0;
  /** Conteneur principal du toast */
  private toastContainer!: HTMLDivElement;

  /**
   * Construit le DOM initial du toast.
   * Appelé par BaseNudge.connectedCallback() après initialisation du Shadow DOM.
   */
  render(): void {
    // Styles propres au toast M5
    const style = document.createElement('style');
    style.textContent = this.getToastStyles();
    this.shadow.appendChild(style);

    // Conteneur principal — role="status" aria-live="polite" (M5 non urgente — SFD §4.3)
    this.toastContainer = document.createElement('div');
    this.toastContainer.setAttribute('id', 'sn-m5-toast');
    this.toastContainer.setAttribute('role', 'status');
    this.toastContainer.setAttribute('aria-live', 'polite');
    this.toastContainer.setAttribute('aria-atomic', 'true');

    // --- En-tête ---
    const header = document.createElement('div');
    header.setAttribute('id', 'sn-m5-header');

    const icon = document.createElement('span');
    icon.setAttribute('id', 'sn-m5-icon');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '🔄';

    const title = document.createElement('strong');
    title.setAttribute('id', 'sn-m5-title');
    title.textContent = browser.i18n.getMessage('m5_toast_title') || 'Mise à jour disponible';

    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('id', 'sn-m5-close');
    closeBtn.setAttribute('type', 'button');
    closeBtn.setAttribute(
      'aria-label',
      browser.i18n.getMessage('m5_toast_btn_close_label') || 'Fermer cette notification',
    );
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
    body.setAttribute('id', 'sn-m5-body');
    body.textContent =
      browser.i18n.getMessage('m5_toast_body') ||
      'Une mise à jour de votre navigateur est disponible. ' +
        'Les mises à jour corrigent des failles de sécurité importantes.';
    this.toastContainer.appendChild(body);

    // --- Zone des boutons d'action ---
    const actionsArea = document.createElement('div');
    actionsArea.setAttribute('id', 'sn-m5-actions');
    this.toastContainer.appendChild(actionsArea);

    this.shadow.appendChild(this.toastContainer);
  }

  /**
   * Ouvre le toast avec le nombre de snoozés courants.
   *
   * Si snoozeCount >= 3, le bouton "Me rappeler dans 4 heures" n'est pas affiché
   * (SFD §2.3.4 CA-M5-06 — anti-snooze infini).
   *
   * @param snoozeCount - Nombre de reports consécutifs déjà effectués
   * @param onAction    - Callback appelé avec l'action choisie
   */
  open(snoozeCount: number, onAction: (action: ToastM5Action) => void): void {
    this.snoozeCount = snoozeCount;
    this.onAction = onAction;

    // Reconstruire les boutons selon le snoozeCount
    const actionsArea = this.shadow.getElementById('sn-m5-actions');
    if (actionsArea) {
      // Vider les boutons existants
      while (actionsArea.firstChild) {
        actionsArea.removeChild(actionsArea.firstChild);
      }
      this.buildActionButtons(actionsArea, snoozeCount);
    }

    // Afficher le toast
    this.toastContainer.style.display = 'flex';
  }

  /**
   * Construit les boutons d'action selon le nombre de reports consécutifs.
   *
   * @param container    - Conteneur des boutons
   * @param snoozeCount  - Nombre de reports consécutifs effectués
   */
  private buildActionButtons(container: HTMLElement, snoozeCount: number): void {
    // Bouton 1 : Mettre à jour maintenant (toujours présent)
    const btnUpdate = document.createElement('button');
    btnUpdate.setAttribute('id', 'sn-m5-btn-update');
    btnUpdate.setAttribute('type', 'button');
    btnUpdate.textContent =
      browser.i18n.getMessage('m5_toast_btn_update') || 'Mettre à jour maintenant';
    btnUpdate.addEventListener('click', () => {
      this.closeToast('update_now');
    });

    // Bouton 2 : Me rappeler dans 4 heures (masqué après 3 reports consécutifs)
    if (snoozeCount < 3) {
      const btnSnooze = document.createElement('button');
      btnSnooze.setAttribute('id', 'sn-m5-btn-snooze');
      btnSnooze.setAttribute('type', 'button');
      btnSnooze.textContent =
        browser.i18n.getMessage('m5_toast_btn_snooze') || 'Me rappeler dans 4 heures';
      btnSnooze.addEventListener('click', () => {
        this.closeToast('remind_4h');
      });
      container.appendChild(btnUpdate);
      container.appendChild(btnSnooze);
    } else {
      // Après 3 reports : seulement "Mettre à jour" et "Fermer"
      container.appendChild(btnUpdate);
    }

    // Bouton 3 : Pourquoi c'est important ?
    const btnWhy = document.createElement('button');
    btnWhy.setAttribute('id', 'sn-m5-btn-why');
    btnWhy.setAttribute('type', 'button');
    btnWhy.textContent =
      browser.i18n.getMessage('m5_toast_btn_why') || "Pourquoi c'est important ?";
    btnWhy.addEventListener('click', () => {
      this.closeToast('why');
    });
    container.appendChild(btnWhy);
  }

  /**
   * Ferme le toast, envoie l'action au service worker, et supprime l'élément.
   *
   * @param action - Action sélectionnée
   */
  private closeToast(action: ToastM5Action): void {
    void browser.runtime.sendMessage({
      module: 'M5',
      action: 'toast_action',
      payload: {
        user_action: action,
        snooze_count: this.snoozeCount,
      },
      timestamp: Date.now(),
    });
    this.onAction?.(action);
    this.remove();
  }

  /**
   * Retourne les styles CSS propres au toast M5.
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

      #sn-m5-toast {
        display: none;
        flex-direction: column;
        background: var(--sn-color-bg);
        border: 2px solid var(--sn-color-accent);
        border-radius: var(--sn-radius);
        box-shadow: var(--sn-shadow);
        padding: var(--sn-space-md);
        font-family: system-ui, sans-serif;
        font-size: var(--sn-font-size-body);
        color: var(--sn-color-fg);
        overflow: hidden;
        animation: sn-m5-slide-up 200ms ease-out;
      }

      @keyframes sn-m5-slide-up {
        from { transform: translateY(20px); opacity: 0; }
        to   { transform: translateY(0);    opacity: 1; }
      }

      #sn-m5-header {
        display: flex;
        align-items: center;
        gap: var(--sn-space-sm);
        margin-bottom: var(--sn-space-sm);
      }

      #sn-m5-icon {
        font-size: 20px;
        flex-shrink: 0;
      }

      #sn-m5-title {
        flex: 1;
        font-size: var(--sn-font-size-title);
        font-weight: var(--sn-font-weight-bold);
      }

      #sn-m5-close {
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

      #sn-m5-close:hover {
        color: var(--sn-color-fg);
        background: #F3F4F6;
      }

      #sn-m5-body {
        margin: 0 0 var(--sn-space-md) 0;
        line-height: var(--sn-line-height);
        color: var(--sn-color-fg);
        font-size: var(--sn-font-size-small);
      }

      #sn-m5-actions {
        display: flex;
        flex-direction: column;
        gap: var(--sn-space-sm);
      }

      #sn-m5-actions button {
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

      #sn-m5-btn-update {
        background: var(--sn-color-accent);
        color: #ffffff;
      }

      #sn-m5-btn-update:hover {
        opacity: 0.9;
      }

      #sn-m5-btn-snooze {
        background: #E5E7EB;
        color: var(--sn-color-fg);
      }

      #sn-m5-btn-snooze:hover {
        background: #D1D5DB;
      }

      #sn-m5-btn-why {
        background: none;
        border: 1px solid #D1D5DB !important;
        color: var(--sn-color-muted);
        font-weight: var(--sn-font-weight-normal);
      }

      #sn-m5-btn-why:hover {
        color: var(--sn-color-fg);
        background: #F9FAFB;
      }
    `;
  }
}

/**
 * Enregistre le custom element sn-toast-m5 dans le DOM.
 * Appelé par le détecteur associé pour garantir l'inclusion dans le bundle Vite.
 */
export function registerToastM5(): void {
  if (
    typeof window !== 'undefined' &&
    window.customElements &&
    !window.customElements.get('sn-toast-m5')
  ) {
    window.customElements.define('sn-toast-m5', ToastM5);
  }
}
