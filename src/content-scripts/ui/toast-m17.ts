/**
 * @file content-scripts/ui/toast-m17.ts
 * @description Composant Web Component — toast M17 (alerte données sensibles presse-papiers).
 *
 * S'affiche après la détection d'un collage de données sensibles dans un champ
 * (numéro de carte bancaire, IBAN, clé API).
 *
 * Actions proposées :
 * - "Vider le presse-papiers" → navigator.clipboard.writeText('') < 10ms (D-SEC-002)
 * - "OK, merci"               → ferme le toast, action 'acknowledged'
 * - "En savoir plus"          → ouvre la page d'explication M17
 *
 * Comportement :
 * - Affiche le type détecté (carte/IBAN/clé API) sans la valeur sensible
 * - En cas d'échec du vidage clipboard (permissions refusées) :
 *   affiche un message alternatif (SFD §2.7.3 CA-M17-07)
 *
 * Accessibilité (WCAG 2.1 AA, SFD §4.3) :
 * - role="alert", aria-live="assertive" (urgence clipboard M17 — différent du polite de M7)
 * - aria-atomic="true"
 * - Cibles min 44x44px (tokens CSS BaseNudge)
 *
 * Sécurité (D-SEC-003) :
 * - Aucun innerHTML — tout DOM via createElement/textContent/appendChild.
 * - Les valeurs sensibles ne sont jamais affichées ni loguées.
 *
 * Référence : SFD §2.7 (M17), DAT §11.3, §11.4, §9.4 (D-SEC-002)
 */

import { BaseNudge } from './base-nudge';
import { browser } from '@/shared/browser/browser-adapter';

/** Actions utilisateur possibles sur le toast M17 */
export type ToastM17Action =
  | 'clipboard_cleared'
  | 'acknowledged'
  | 'learn_more'
  | 'clipboard_clear_failed';

/** Types de données sensibles détectables par M17 */
export type SensitiveDataType = 'credit_card' | 'iban' | 'api_key';

/** Libellés des types de données pour l'affichage */
const DATA_TYPE_LABELS: Record<SensitiveDataType, string> = {
  credit_card: 'numéro de carte bancaire',
  iban: 'IBAN',
  api_key: 'clé API',
};

/**
 * Web Component toast M17 — alerte données sensibles presse-papiers.
 *
 * Usage (déclenché depuis paste-detector.ts) :
 *   const toast = document.createElement('sn-toast-m17') as ToastM17;
 *   document.body.appendChild(toast);
 *   toast.open(dataType, (action) => { ... });
 */
export class ToastM17 extends BaseNudge {
  /** Callback appelé quand l'utilisateur interagit */
  private onAction?: (action: ToastM17Action) => void;
  /** Type de données détecté */
  private currentDataType: SensitiveDataType = 'credit_card';
  /** Conteneur principal du toast */
  private toastContainer!: HTMLDivElement;
  /** Zone des boutons d'action (pour afficher le message alternatif) */
  private actionsArea!: HTMLDivElement;

  /**
   * Construit le DOM initial du toast.
   * Appelé par BaseNudge.connectedCallback() après initialisation du Shadow DOM.
   */
  render(): void {
    // Styles propres au toast M17
    const style = document.createElement('style');
    style.textContent = this.getToastStyles();
    this.shadow.appendChild(style);

    // Conteneur principal — role="alert" aria-live="assertive" (urgence M17)
    this.toastContainer = document.createElement('div');
    this.toastContainer.setAttribute('id', 'sn-m17-toast');
    this.toastContainer.setAttribute('role', 'alert');
    this.toastContainer.setAttribute('aria-live', 'assertive');
    this.toastContainer.setAttribute('aria-atomic', 'true');

    // --- En-tête ---
    const header = document.createElement('div');
    header.setAttribute('id', 'sn-m17-header');

    const icon = document.createElement('span');
    icon.setAttribute('id', 'sn-m17-icon');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '🔒';

    const title = document.createElement('strong');
    title.setAttribute('id', 'sn-m17-title');
    title.textContent = 'Donnée sensible détectée';

    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('id', 'sn-m17-close');
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

    // --- Corps (mis à jour dans open()) ---
    const body = document.createElement('p');
    body.setAttribute('id', 'sn-m17-body');
    body.textContent = 'Vous venez de coller une donnée sensible dans un champ.';
    this.toastContainer.appendChild(body);

    // --- Zone des boutons d'action ---
    this.actionsArea = document.createElement('div');
    this.actionsArea.setAttribute('id', 'sn-m17-actions');
    this.buildActionButtons(this.actionsArea);
    this.toastContainer.appendChild(this.actionsArea);

    this.shadow.appendChild(this.toastContainer);
  }

  /**
   * Construit les boutons d'action dans la zone actions.
   *
   * @param container - Conteneur des boutons
   */
  private buildActionButtons(container: HTMLDivElement): void {
    // Bouton 1 : Vider le presse-papiers (action principale)
    const btnClear = document.createElement('button');
    btnClear.setAttribute('id', 'sn-m17-btn-clear');
    btnClear.setAttribute('type', 'button');
    btnClear.textContent = 'Vider le presse-papiers';
    btnClear.addEventListener('click', () => {
      void this.clearClipboard();
    });

    // Bouton 2 : OK, merci
    const btnOk = document.createElement('button');
    btnOk.setAttribute('id', 'sn-m17-btn-ok');
    btnOk.setAttribute('type', 'button');
    btnOk.textContent = 'OK, merci';
    btnOk.addEventListener('click', () => {
      this.closeToast('acknowledged');
    });

    // Bouton 3 : En savoir plus
    const btnLearnMore = document.createElement('button');
    btnLearnMore.setAttribute('id', 'sn-m17-btn-learn');
    btnLearnMore.setAttribute('type', 'button');
    btnLearnMore.textContent = 'En savoir plus';
    btnLearnMore.addEventListener('click', () => {
      this.closeToast('learn_more');
    });

    container.appendChild(btnClear);
    container.appendChild(btnOk);
    container.appendChild(btnLearnMore);
  }

  /**
   * Ouvre le toast pour un type de donnée donné.
   * Met à jour le message du corps avec le type détecté (sans la valeur).
   *
   * @param dataType - Type de donnée détectée
   * @param onAction - Callback appelé avec l'action choisie
   */
  open(dataType: SensitiveDataType, onAction: (action: ToastM17Action) => void): void {
    this.currentDataType = dataType;
    this.onAction = onAction;

    // Mettre à jour le message du corps avec le type (pas la valeur — D-SEC-003)
    const body = this.shadow.getElementById('sn-m17-body');
    if (body) {
      const typeLabel = DATA_TYPE_LABELS[dataType] ?? 'donnée sensible';
      body.textContent =
        `Un ${typeLabel} vient d'être collé dans un champ. ` +
        'Assurez-vous que ce site est bien celui attendu et que ' +
        'votre presse-papiers ne reste pas accessible.';
    }

    // Afficher le toast
    this.toastContainer.style.display = 'flex';
  }

  /**
   * Vide le presse-papiers via navigator.clipboard.writeText('') (D-SEC-002).
   *
   * En cas d'échec (permissions refusées), affiche un message alternatif
   * (SFD §2.7.3 CA-M17-07) et enregistre l'action 'clipboard_clear_failed'.
   */
  private async clearClipboard(): Promise<void> {
    try {
      await navigator.clipboard.writeText('');
      this.closeToast('clipboard_cleared');
    } catch {
      // Permissions refusées — afficher le message alternatif (SFD CA-M17-07)
      this.showClipboardFallbackMessage();
      // Enregistrer l'échec
      void browser.runtime.sendMessage({
        module: 'M17',
        action: 'toast_action',
        payload: {
          user_action: 'clipboard_clear_failed',
          data_type: this.currentDataType,
        },
        timestamp: Date.now(),
      });
      this.onAction?.('clipboard_clear_failed');
    }
  }

  /**
   * Affiche le message alternatif quand le vidage du presse-papiers échoue.
   * Remplace les boutons par un message d'instruction manuelle + bouton OK.
   * (SFD §2.7.3 CA-M17-07)
   */
  private showClipboardFallbackMessage(): void {
    // Vider la zone d'actions actuelle
    while (this.actionsArea.firstChild) {
      this.actionsArea.removeChild(this.actionsArea.firstChild);
    }

    // Message d'instruction manuelle
    const fallbackMsg = document.createElement('p');
    fallbackMsg.setAttribute('id', 'sn-m17-fallback');
    fallbackMsg.setAttribute('role', 'alert');
    fallbackMsg.textContent =
      'Videz manuellement votre presse-papiers (copiez un texte vide ou appuyez Ctrl+C sur un espace vide).';
    this.actionsArea.appendChild(fallbackMsg);

    // Bouton OK pour fermer
    const btnClose = document.createElement('button');
    btnClose.setAttribute('id', 'sn-m17-btn-fallback-close');
    btnClose.setAttribute('type', 'button');
    btnClose.textContent = 'Compris';
    btnClose.addEventListener('click', () => {
      this.closeToast('acknowledged');
    });
    this.actionsArea.appendChild(btnClose);
  }

  /**
   * Ferme le toast, envoie l'action au service worker, et supprime l'élément.
   *
   * @param action - Action sélectionnée
   */
  private closeToast(action: ToastM17Action): void {
    // Notification au service worker pour enregistrement
    void browser.runtime.sendMessage({
      module: 'M17',
      action: 'toast_action',
      payload: {
        user_action: action,
        data_type: this.currentDataType,
      },
      timestamp: Date.now(),
    });
    this.onAction?.(action);
    this.remove();
  }

  /**
   * Retourne les styles CSS propres au toast M17.
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

      #sn-m17-toast {
        display: none;
        flex-direction: column;
        background: var(--sn-color-bg);
        border: 2px solid var(--sn-color-warning);
        border-radius: var(--sn-radius);
        box-shadow: var(--sn-shadow);
        padding: var(--sn-space-md);
        font-family: system-ui, sans-serif;
        font-size: var(--sn-font-size-body);
        color: var(--sn-color-fg);
        overflow: hidden;
        animation: sn-m17-slide-up 200ms ease-out;
      }

      @keyframes sn-m17-slide-up {
        from { transform: translateY(20px); opacity: 0; }
        to   { transform: translateY(0);    opacity: 1; }
      }

      #sn-m17-header {
        display: flex;
        align-items: center;
        gap: var(--sn-space-sm);
        margin-bottom: var(--sn-space-sm);
      }

      #sn-m17-icon {
        font-size: 20px;
        flex-shrink: 0;
      }

      #sn-m17-title {
        flex: 1;
        font-size: var(--sn-font-size-title);
        font-weight: var(--sn-font-weight-bold);
      }

      #sn-m17-close {
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

      #sn-m17-close:hover {
        color: var(--sn-color-fg);
        background: #F3F4F6;
      }

      #sn-m17-body {
        margin: 0 0 var(--sn-space-md) 0;
        line-height: var(--sn-line-height);
        color: var(--sn-color-fg);
        font-size: var(--sn-font-size-small);
      }

      #sn-m17-actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--sn-space-sm);
        flex-direction: column;
      }

      #sn-m17-actions button {
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

      #sn-m17-btn-clear {
        background: var(--sn-color-warning);
        color: #ffffff;
      }

      #sn-m17-btn-clear:hover {
        opacity: 0.9;
      }

      #sn-m17-btn-ok {
        background: #E5E7EB;
        color: var(--sn-color-fg);
      }

      #sn-m17-btn-ok:hover {
        background: #D1D5DB;
      }

      #sn-m17-btn-learn {
        background: none;
        border: 1px solid #D1D5DB !important;
        color: var(--sn-color-muted);
        font-weight: var(--sn-font-weight-normal);
      }

      #sn-m17-btn-learn:hover {
        color: var(--sn-color-fg);
        background: #F9FAFB;
      }

      #sn-m17-fallback {
        margin: 0 0 var(--sn-space-sm) 0;
        font-size: var(--sn-font-size-small);
        color: var(--sn-color-warning);
        line-height: var(--sn-line-height);
        font-style: italic;
      }

      #sn-m17-btn-fallback-close {
        width: 100%;
        min-height: var(--sn-min-target);
        background: #E5E7EB;
        color: var(--sn-color-fg);
        border: none;
        border-radius: var(--sn-radius);
        cursor: pointer;
        font-size: var(--sn-font-size-small);
        font-weight: var(--sn-font-weight-bold);
      }

      #sn-m17-btn-fallback-close:hover {
        background: #D1D5DB;
      }
    `;
  }
}

// Déclaration du custom element
if (!customElements.get('sn-toast-m17')) {
  customElements.define('sn-toast-m17', ToastM17);
}
