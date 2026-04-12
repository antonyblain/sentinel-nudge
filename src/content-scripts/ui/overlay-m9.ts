/**
 * @file content-scripts/ui/overlay-m9.ts
 * @description Composant Web Component — overlay inline M9 (indicateur de force mot de passe).
 *
 * Affiché sous le champ password de création via insertAdjacentElement('afterend', ...).
 * Isolé dans un Shadow DOM (mode open) pour éviter toute collision CSS avec la page hôte.
 *
 * Fonctionnalités :
 * - Barre de progression colorée (rouge / jaune / vert clair / vert foncé)
 * - Labels ANSSI : Très faible / Faible / Moyen / Fort / Très fort
 * - Marqueur ANSSI (Déconseillé / Acceptable / Recommandé)
 * - Suggestions textuelles dynamiques (mode password ou passphrase)
 * - Même largeur que le champ parent
 *
 * Accessibilité (WCAG 2.1 AA) :
 * - role="meter" sur la barre de progression
 * - aria-valuenow / aria-valuemin / aria-valuemax / aria-valuetext
 * - aria-live="polite" sur le conteneur de suggestion
 * - prefers-reduced-motion respecté via tokens CSS BaseNudge
 *
 * Sécurité (D-SEC-003) :
 * - Aucun innerHTML — tout le DOM est construit via createElement/textContent/appendChild.
 *
 * Référence : SFD §2.6 (M9), DAT §11.3 (Shadow DOM), §11.4 (design system)
 */

import { BaseNudge } from './base-nudge';
import { browser } from '@/shared/browser/browser-adapter';

/**
 * Couleurs de la barre de progression par score zxcvbn (0-4).
 * Référence : SFD §2.6.2 — tableau de mapping scores ANSSI
 */
const SCORE_COLORS: readonly string[] = [
  '#DC2626', // 0 — Très faible — Rouge (ratio 5.9:1 sur blanc)
  '#DC2626', // 1 — Faible     — Rouge
  '#D97706', // 2 — Moyen      — Jaune/Orange (ratio 4.6:1)
  '#16A34A', // 3 — Fort       — Vert clair (ratio 5.1:1)
  '#166534', // 4 — Très fort  — Vert foncé (ratio 7.6:1)
] as const;

/** Clés i18n pour les labels ANSSI par score zxcvbn (0-4) */
const SCORE_LABEL_KEYS: readonly string[] = [
  'm9_score_very_weak',
  'm9_score_weak',
  'm9_score_medium',
  'm9_score_strong',
  'm9_score_very_strong',
] as const;

/** Fallbacks pour les labels ANSSI */
const SCORE_LABEL_FALLBACKS: readonly string[] = [
  'Très faible',
  'Faible',
  'Moyen',
  'Fort',
  'Très fort',
] as const;

/** Clés i18n pour les marqueurs ANSSI par score zxcvbn (0-4) */
const ANSSI_MARKER_KEYS: readonly string[] = [
  'm9_anssi_not_recommended',
  'm9_anssi_not_recommended',
  'm9_anssi_acceptable',
  'm9_anssi_recommended',
  'm9_anssi_recommended',
] as const;

/** Fallbacks pour les marqueurs ANSSI */
const ANSSI_MARKER_FALLBACKS: readonly string[] = [
  "Déconseillé par l'ANSSI",
  "Déconseillé par l'ANSSI",
  'Acceptable',
  'Recommandé',
  'Recommandé',
] as const;

/** Mots très courants français utilisés pour la détection de passphrase faible */
const COMMON_FRENCH_WORDS = new Set([
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

/**
 * Web Component overlay M9 — indicateur de force mot de passe.
 *
 * Usage :
 *   const overlay = document.createElement('sn-overlay-m9') as OverlayM9;
 *   passwordField.insertAdjacentElement('afterend', overlay);
 *   overlay.update(score, value, 'password');
 */
export class OverlayM9 extends BaseNudge {
  /** Barre de progression (meter) */
  private barFill!: HTMLDivElement;
  /** Conteneur de la barre de progression */
  private barContainer!: HTMLDivElement;
  /** Élément meter pour l'accessibilité */
  private meter!: HTMLDivElement;
  /** Label du score textuel */
  private labelEl!: HTMLSpanElement;
  /** Marqueur ANSSI */
  private anssiEl!: HTMLSpanElement;
  /** Zone de suggestion dynamique */
  private suggestionEl!: HTMLParagraphElement;

  /**
   * Construit le DOM initial de l'overlay.
   * Appelé par BaseNudge.connectedCallback() après initialisation du Shadow DOM.
   */
  render(): void {
    const container = document.createElement('div');
    container.setAttribute('id', 'sn-m9-container');

    // --- Barre de progression + labels ---
    const barRow = document.createElement('div');
    barRow.setAttribute('id', 'sn-m9-bar-row');

    // Barre de progression — role meter pour accessibilité
    this.meter = document.createElement('div');
    this.meter.setAttribute('role', 'meter');
    this.meter.setAttribute(
      'aria-label',
      browser.i18n.getMessage('m9_meter_label') || 'Force du mot de passe',
    );
    this.meter.setAttribute('aria-valuenow', '0');
    this.meter.setAttribute('aria-valuemin', '0');
    this.meter.setAttribute('aria-valuemax', '4');
    this.meter.setAttribute(
      'aria-valuetext',
      browser.i18n.getMessage(SCORE_LABEL_KEYS[0]!) || SCORE_LABEL_FALLBACKS[0]!,
    );
    this.meter.setAttribute('id', 'sn-m9-meter');

    this.barContainer = document.createElement('div');
    this.barContainer.setAttribute('id', 'sn-m9-bar-bg');

    this.barFill = document.createElement('div');
    this.barFill.setAttribute('id', 'sn-m9-bar-fill');

    this.barContainer.appendChild(this.barFill);
    this.meter.appendChild(this.barContainer);

    // Labels à droite de la barre
    const labelGroup = document.createElement('div');
    labelGroup.setAttribute('id', 'sn-m9-labels');

    this.labelEl = document.createElement('span');
    this.labelEl.setAttribute('id', 'sn-m9-label');
    this.labelEl.textContent = '';

    this.anssiEl = document.createElement('span');
    this.anssiEl.setAttribute('id', 'sn-m9-anssi');
    this.anssiEl.textContent = '';

    labelGroup.appendChild(this.labelEl);
    labelGroup.appendChild(this.anssiEl);

    barRow.appendChild(this.meter);
    barRow.appendChild(labelGroup);
    container.appendChild(barRow);

    // --- Zone de suggestion ---
    this.suggestionEl = document.createElement('p');
    this.suggestionEl.setAttribute('id', 'sn-m9-suggestion');
    this.suggestionEl.setAttribute('aria-live', 'polite');
    this.suggestionEl.setAttribute('aria-atomic', 'true');
    this.suggestionEl.textContent = '';
    container.appendChild(this.suggestionEl);

    // Injection des styles propres à cet overlay
    const style = document.createElement('style');
    style.textContent = this.getOverlayStyles();
    this.shadow.appendChild(style);

    this.shadow.appendChild(container);
  }

  /**
   * Met à jour l'overlay avec le nouveau score et la valeur du mot de passe.
   * Appelé à chaque événement input (debounce 150ms géré par le détecteur).
   *
   * @param score       - Score zxcvbn (0-4)
   * @param value       - Valeur courante du champ (pour les suggestions contextuelles)
   * @param mode        - 'password' ou 'passphrase' (détecté par le détecteur)
   * @param parentWidth - Largeur du champ parent en pixels
   */
  update(score: number, value: string, mode: 'password' | 'passphrase', parentWidth: number): void {
    // Adaptation de la largeur à celle du champ parent
    this.style.width = `${parentWidth}px`;
    this.style.display = 'block';

    const clampedScore = Math.max(0, Math.min(4, score));
    const color = SCORE_COLORS[clampedScore]!;

    const labelKey = SCORE_LABEL_KEYS[clampedScore]!;
    const labelFallback = SCORE_LABEL_FALLBACKS[clampedScore]!;
    const label = browser.i18n.getMessage(labelKey) || labelFallback;

    const anssiKey = ANSSI_MARKER_KEYS[clampedScore]!;
    const anssiFallback = ANSSI_MARKER_FALLBACKS[clampedScore]!;
    const anssi = browser.i18n.getMessage(anssiKey) || anssiFallback;

    // Mise à jour de la barre
    const percent = ((clampedScore + 1) / 5) * 100;
    this.barFill.style.width = `${percent}%`;
    this.barFill.style.backgroundColor = color;

    // Mise à jour des attributs ARIA
    this.meter.setAttribute('aria-valuenow', String(clampedScore));
    this.meter.setAttribute('aria-valuetext', label);

    // Mise à jour des labels
    this.labelEl.textContent = label;
    this.labelEl.style.color = color;
    this.anssiEl.textContent = anssi;

    // Mise à jour de la suggestion
    this.suggestionEl.textContent = this.getSuggestion(score, value, mode);
  }

  /**
   * Masque l'overlay (au submit ou au blur sans confirmation).
   */
  hide(): void {
    this.style.display = 'none';
  }

  /**
   * Affiche l'overlay (au focus sur le champ).
   */
  show(): void {
    this.style.display = 'block';
  }

  /**
   * Calcule la suggestion textuelle dynamique selon le mode et le score.
   *
   * Référence : SFD §2.6.2 — tableaux de suggestions
   *
   * @param score - Score zxcvbn (0-4)
   * @param value - Valeur courante du mot de passe
   * @param mode  - Mode détecté ('password' ou 'passphrase')
   * @returns Texte de suggestion à afficher
   */
  private getSuggestion(score: number, value: string, mode: 'password' | 'passphrase'): string {
    if (mode === 'passphrase') {
      return this.getPassphraseSuggestion(score, value);
    }
    return this.getPasswordSuggestion(score, value);
  }

  /**
   * Suggestions pour le mode mot de passe classique.
   *
   * @param score - Score zxcvbn (0-4)
   * @param value - Valeur courante
   * @returns Texte de suggestion
   */
  private getPasswordSuggestion(score: number, value: string): string {
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

    // Analyse contextuelle pour les scores faibles
    const hasDigit = /\d/.test(value);
    const hasSymbol = /[^a-zA-Z0-9]/.test(value);
    const hasSequence = /(?:123|234|345|456|567|678|789|890|abc|bcd|cde|qwerty|azerty)/i.test(
      value,
    );

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
   * Suggestions pour le mode phrase de passe.
   *
   * @param score - Score zxcvbn (0-4)
   * @param value - Valeur courante
   * @returns Texte de suggestion
   */
  private getPassphraseSuggestion(score: number, value: string): string {
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
      .split(/\s+/)
      .filter((w) => w.length > 0);
    const wordCount = words.length;

    // Détection de mots très courants
    const hasCommonWords = words.some((w) => COMMON_FRENCH_WORDS.has(w.toLowerCase()));

    if (wordCount < 4) {
      return (
        browser.i18n.getMessage('m9_suggestion_pp_too_short') ||
        'Ajoutez un ou deux mots pour renforcer votre phrase de passe.'
      );
    }
    if (hasCommonWords) {
      return (
        browser.i18n.getMessage('m9_suggestion_pp_common_words') ||
        'Remplacez les mots très courants par des mots plus originaux.'
      );
    }
    if (wordCount >= 4 && score < 3) {
      return (
        browser.i18n.getMessage('m9_suggestion_pp_unusual_words') ||
        'Essayez des mots moins courants ou sans lien logique entre eux.'
      );
    }
    return (
      browser.i18n.getMessage('m9_suggestion_pp_keep_going') || 'Bonne phrase de passe ! Continuez.'
    );
  }

  /**
   * Retourne les styles CSS propres à cet overlay.
   * Complète les tokens CSS injectés par BaseNudge.getDesignTokens().
   */
  private getOverlayStyles(): string {
    return `
      #sn-m9-container {
        font-family: system-ui, sans-serif;
        font-size: var(--sn-font-size-small);
        line-height: var(--sn-line-height);
        background: transparent;
        padding: var(--sn-space-xs) 0;
        box-sizing: border-box;
        width: 100%;
      }

      #sn-m9-bar-row {
        display: flex;
        align-items: center;
        gap: var(--sn-space-sm);
        margin-bottom: var(--sn-space-xs);
      }

      #sn-m9-meter {
        flex: 1;
        min-height: 0;
      }

      #sn-m9-bar-bg {
        background: #E5E7EB;
        border-radius: 4px;
        height: 6px;
        overflow: hidden;
        width: 100%;
      }

      #sn-m9-bar-fill {
        height: 100%;
        border-radius: 4px;
        width: 0%;
        transition: width 0.2s ease, background-color 0.2s ease;
      }

      #sn-m9-labels {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        min-width: 120px;
        flex-shrink: 0;
      }

      #sn-m9-label {
        font-weight: var(--sn-font-weight-bold);
        font-size: var(--sn-font-size-small);
      }

      #sn-m9-anssi {
        font-size: 11px;
        color: var(--sn-color-muted);
      }

      #sn-m9-suggestion {
        margin: 0;
        color: var(--sn-color-fg);
        font-size: var(--sn-font-size-small);
        min-height: 1.5em;
      }
    `;
  }
}

/**
 * Enregistre le custom element sn-overlay-m9 dans le DOM.
 * Appelé par le détecteur associé pour garantir l'inclusion dans le bundle Vite.
 */
export function registerOverlayM9(): void {
    if (typeof window !== "undefined" && window.customElements && !window.customElements.get('sn-overlay-m9')) {
      window.customElements.define('sn-overlay-m9', OverlayM9);
    }
}
