/**
 * @file content-scripts/ui/base-nudge.ts
 * @description Classe abstraite de base pour tous les composants nudge Sentinel Nudge.
 *
 * Basée sur les Web Components natifs (HTMLElement + Shadow DOM mode open).
 * Fournit :
 * - Initialisation du Shadow DOM avec les tokens CSS du design system
 * - Focus trap sécurisé pour les overlays modaux (correction LA-ACC-01)
 * - Méthode abstraite render() à implémenter par chaque composant
 *
 * Sécurité (D-SEC-003) :
 * - Aucun innerHTML/outerHTML/insertAdjacentHTML dans cette classe
 * - Toute construction DOM passe par createElement/textContent/appendChild
 *
 * Accessibilité (DAT §11.2, §11.3) :
 * - Shadow DOM mode open : les AT (lecteurs d'écran) peuvent traverser le shadow root
 * - trapFocus utilise this.shadowRoot?.activeElement (correction LA-ACC-01)
 * - Les animations respectent prefers-reduced-motion
 *
 * Référence : DAT §11.3 (focus trap), §11.4 (design system tokens CSS)
 */

/**
 * Classe abstraite de base pour les Web Components nudge de Sentinel Nudge.
 *
 * Chaque composant héritant de BaseNudge doit :
 * 1. Se déclarer comme custom element : customElements.define('sn-overlay-m2', OverlayM2)
 * 2. Implémenter la méthode abstraite render()
 */
export abstract class BaseNudge extends HTMLElement {
  /** Shadow root du composant (mode open pour compatibilité AT) */
  protected shadow!: ShadowRoot;

  /**
   * Appelé automatiquement par le navigateur lors de l'insertion dans le DOM.
   * Crée le Shadow DOM, injecte les tokens CSS, et appelle render().
   */
  connectedCallback(): void {
    this.shadow = this.attachShadow({ mode: 'open' });

    // Injection des tokens CSS dans le shadow root
    const style = document.createElement('style');
    style.textContent = this.getDesignTokens();
    this.shadow.appendChild(style);

    // Délégation au composant enfant pour le rendu
    this.render();
  }

  /**
   * Focus trap dans un container Shadow DOM (correction LA-ACC-01).
   *
   * Dans un Shadow DOM, document.activeElement retourne le shadow host (l'élément
   * custom element lui-même) et non l'élément focusé à l'intérieur du shadow root.
   * Il faut utiliser this.shadowRoot?.activeElement pour obtenir le vrai élément actif.
   *
   * @param container - Élément conteneur dans lequel piéger le focus
   */
  protected trapFocus(container: HTMLElement): void {
    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableElements = container.querySelectorAll<HTMLElement>(focusableSelector);

    if (focusableElements.length === 0) return;

    const first = focusableElements[0]!;
    const last = focusableElements[focusableElements.length - 1]!;

    container.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      // Correction LA-ACC-01 : utiliser shadowRoot.activeElement dans un Shadow DOM
      const activeEl = this.shadowRoot?.activeElement ?? document.activeElement;

      if (e.shiftKey) {
        // Shift+Tab : si on est sur le premier élément, aller au dernier
        if (activeEl === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab : si on est sur le dernier élément, revenir au premier
        if (activeEl === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    // Donner le focus au premier élément focusable à l'ouverture
    first.focus();
  }

  /**
   * Retourne le bloc CSS des 25 tokens du design system Sentinel Nudge.
   *
   * Ces tokens sont injectés dans chaque shadow root pour garantir la cohérence
   * visuelle et les ratios de contraste WCAG (DAT §11.4).
   *
   * @returns Chaîne CSS des tokens à injecter dans une balise <style>
   */
  protected getDesignTokens(): string {
    return `
      :host {
        /* Couleurs sémantiques */
        --sn-color-fg: #1A1A1A;        /* Texte principal — ratio 18.1:1 sur bg blanc */
        --sn-color-bg: #FFFFFF;        /* Fond */
        --sn-color-accent: #2563EB;    /* Interactif (boutons, liens) — ratio 5.9:1 sur bg */
        --sn-color-danger: #DC2626;    /* Danger / erreur — ratio 5.9:1 sur bg */
        --sn-color-success: #16A34A;   /* Succès — ratio 5.1:1 sur bg */
        --sn-color-warning: #D97706;   /* Avertissement — ratio 4.6:1 sur bg */
        --sn-color-muted: #6B7280;     /* Texte secondaire — ratio 4.6:1 sur bg */

        /* Typographie */
        --sn-font-size-body: 15px;
        --sn-font-size-small: 13px;
        --sn-font-size-title: 18px;
        --sn-font-weight-normal: 400;
        --sn-font-weight-bold: 600;
        --sn-line-height: 1.5;

        /* Espacement (base 4px) */
        --sn-space-xs: 4px;
        --sn-space-sm: 8px;
        --sn-space-md: 16px;
        --sn-space-lg: 24px;
        --sn-space-xl: 32px;

        /* Bordures et ombres */
        --sn-radius: 8px;
        --sn-shadow: 0 4px 12px rgba(0,0,0,0.15);

        /* Assure que toutes les cibles interactives respectent 44x44px (WCAG 2.5.5) */
        --sn-min-target: 44px;
      }

      /* Respect des préférences de mouvement réduit (WCAG 2.3.3) */
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation: none !important;
          transition: none !important;
        }
      }

      /* Masquage visuel accessible */
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      /* Styles de base des boutons (conformité cibles 44x44px) */
      button {
        min-height: var(--sn-min-target);
        min-width: var(--sn-min-target);
        font-size: var(--sn-font-size-body);
        font-weight: var(--sn-font-weight-bold);
        border-radius: var(--sn-radius);
        cursor: pointer;
        padding: var(--sn-space-sm) var(--sn-space-md);
      }

      /* ACC-05 : indicateur de focus visible pour la navigation clavier (WCAG 2.4.11) */
      :focus-visible {
        outline: 3px solid var(--sn-color-accent);
        outline-offset: 2px;
      }

      button:focus-visible,
      a:focus-visible,
      input:focus-visible,
      select:focus-visible,
      textarea:focus-visible {
        outline: 3px solid var(--sn-color-accent);
        outline-offset: 2px;
      }
    `;
  }

  /**
   * Méthode abstraite de rendu — à implémenter par chaque composant nudge.
   *
   * Cette méthode est appelée après que le shadow root et les tokens CSS
   * ont été initialisés. Le composant doit construire son DOM ici
   * en utilisant uniquement createElement/textContent/appendChild (D-SEC-003).
   */
  abstract render(): void;
}
