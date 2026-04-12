/**
 * @file content-scripts/ui/overlay-m6.ts
 * @description Composant Web Component — overlay quiz M6 (mini-quiz phishing).
 *
 * Affiche un quiz de 3 questions séquentielles sur le phishing avec feedback
 * post-réponse, sélection adaptative, et score final.
 *
 * Structure du quiz :
 * - Dialogue centré (max 480px) avec fond semi-transparent
 * - fieldset/legend/radio pour chaque question (accessibilité WCAG)
 * - Feedback détaillé après chaque réponse (correct / incorrect + explication)
 * - Résumé final avec score et lien vers la prochaine action
 *
 * Accessibilité (WCAG 2.1 AA, SFD §4.3) :
 * - role="dialog", aria-modal="true", aria-labelledby
 * - fieldset + legend pour les groupes radio
 * - Focus trap sur l'overlay (BaseNudge.trapFocus)
 * - Touches Escape pour fermer
 *
 * Sécurité (D-SEC-003) :
 * - Aucun innerHTML — tout DOM via createElement/textContent/appendChild.
 * - Le contenu des questions vient du corpus embarqué (pas de données utilisateur).
 *
 * Référence : SFD §2.4 (M6), DAT §11.3, §11.4
 */

import { BaseNudge } from './base-nudge';
import { browser } from '@/shared/browser/browser-adapter';

/** Structure d'une question telle que reçue du handler M6 */
export interface QuizQuestion {
  /** Identifiant unique de la question */
  id: string;
  /** Texte de la question */
  question: string;
  /** Options de réponse */
  options: string[];
  /** Index de la bonne réponse (0-based) */
  correct_index: number;
  /** Explication post-réponse */
  explanation: string;
  /** true si l'exemple est un phishing (pour le label "phishing" ou "légitime") */
  is_phishing: boolean;
}

/** Résultats renvoyés au service worker à la fin du quiz */
export interface QuizResults {
  /** Score en pourcentage (0-100) */
  score_pct: number;
  /** IDs des questions posées */
  question_ids: string[];
  /** Catégories échouées (pour la sélection adaptative suivante) */
  categories_failed: string[];
  /** true si le quiz a été complété normalement, false si fermé en cours */
  completed: boolean;
  /** Nombre de réponses données (pour le cas de fermeture partielle) */
  answers_given: number;
}

/** État interne du quiz */
interface QuizState {
  questions: QuizQuestion[];
  currentIndex: number;
  answers: Array<{ questionId: string; correct: boolean; category?: string }>;
}

/**
 * Web Component overlay quiz M6.
 *
 * Usage (déclenché depuis le content script récepteur) :
 *   const overlay = document.createElement('sn-overlay-m6') as OverlayM6;
 *   document.body.appendChild(overlay);
 *   overlay.open(questions, (results) => { ... });
 */
export class OverlayM6 extends BaseNudge {
  /** Callback appelé à la fin ou à la fermeture du quiz */
  private onComplete?: (results: QuizResults) => void;
  /** État interne du quiz */
  private state: QuizState = { questions: [], currentIndex: 0, answers: [] };
  /** Conteneur principal de l'overlay */
  private overlayContainer!: HTMLDivElement;
  /** Panneau du dialogue quiz */
  private dialogPanel!: HTMLDivElement;

  /**
   * Construit le DOM initial de l'overlay.
   * Appelé par BaseNudge.connectedCallback() après initialisation du Shadow DOM.
   */
  render(): void {
    // Styles propres à l'overlay M6
    const style = document.createElement('style');
    style.textContent = this.getOverlayStyles();
    this.shadow.appendChild(style);

    // Fond semi-transparent (backdrop)
    this.overlayContainer = document.createElement('div');
    this.overlayContainer.setAttribute('id', 'sn-m6-backdrop');
    this.overlayContainer.setAttribute('aria-hidden', 'true');

    // Panneau dialogue — role="dialog", aria-modal, aria-labelledby
    this.dialogPanel = document.createElement('div');
    this.dialogPanel.setAttribute('id', 'sn-m6-dialog');
    this.dialogPanel.setAttribute('role', 'dialog');
    this.dialogPanel.setAttribute('aria-modal', 'true');
    this.dialogPanel.setAttribute('aria-labelledby', 'sn-m6-dialog-title');
    this.dialogPanel.setAttribute('aria-describedby', 'sn-m6-question-text');
    this.dialogPanel.setAttribute('tabindex', '-1');

    this.overlayContainer.appendChild(this.dialogPanel);
    this.shadow.appendChild(this.overlayContainer);

    // Fermeture par Escape
    this.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.closeQuiz(false);
      }
    });
  }

  /**
   * Ouvre l'overlay avec les questions fournies.
   *
   * @param questions  - Liste des 3 questions sélectionnées
   * @param onComplete - Callback appelé avec les résultats
   */
  open(questions: QuizQuestion[], onComplete: (results: QuizResults) => void): void {
    this.onComplete = onComplete;
    this.state = {
      questions,
      currentIndex: 0,
      answers: [],
    };

    this.renderQuestion(0);
    this.overlayContainer.style.display = 'flex';

    // Focus trap sur le dialogue
    this.trapFocus(this.dialogPanel);
  }

  /**
   * Rend la question à l'index donné dans le panneau dialogue.
   *
   * @param index - Index de la question à afficher (0-based)
   */
  private renderQuestion(index: number): void {
    const question = this.state.questions[index];
    if (!question) return;

    // Vider le panneau
    while (this.dialogPanel.firstChild) {
      this.dialogPanel.removeChild(this.dialogPanel.firstChild);
    }

    // En-tête avec titre et progression
    const header = document.createElement('div');
    header.setAttribute('id', 'sn-m6-dialog-header');

    const title = document.createElement('h2');
    title.setAttribute('id', 'sn-m6-dialog-title');
    title.textContent = 'Quiz phishing';

    const progress = document.createElement('span');
    progress.setAttribute('id', 'sn-m6-progress');
    progress.setAttribute('aria-label', `Question ${index + 1} sur ${this.state.questions.length}`);
    progress.textContent = `${index + 1} / ${this.state.questions.length}`;

    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('id', 'sn-m6-dialog-close');
    closeBtn.setAttribute('type', 'button');
    closeBtn.setAttribute('aria-label', 'Fermer le quiz');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => {
      this.closeQuiz(false);
    });

    header.appendChild(title);
    header.appendChild(progress);
    header.appendChild(closeBtn);
    this.dialogPanel.appendChild(header);

    // Corps — fieldset/legend/radio (accessibilité WCAG)
    const fieldset = document.createElement('fieldset');
    fieldset.setAttribute('id', 'sn-m6-fieldset');

    const legend = document.createElement('legend');
    legend.setAttribute('id', 'sn-m6-question-text');
    legend.textContent = question.question;
    fieldset.appendChild(legend);

    // Options radio
    question.options.forEach((option, optionIndex) => {
      const label = document.createElement('label');
      label.setAttribute('class', 'sn-m6-option-label');

      const radio = document.createElement('input');
      radio.setAttribute('type', 'radio');
      radio.setAttribute('name', `sn-m6-q${index}`);
      radio.setAttribute('value', String(optionIndex));
      radio.setAttribute('id', `sn-m6-opt-${optionIndex}`);

      const optionText = document.createElement('span');
      optionText.textContent = option;

      label.appendChild(radio);
      label.appendChild(optionText);
      fieldset.appendChild(label);
    });

    this.dialogPanel.appendChild(fieldset);

    // Bouton "Valider"
    const validateBtn = document.createElement('button');
    validateBtn.setAttribute('id', 'sn-m6-btn-validate');
    validateBtn.setAttribute('type', 'button');
    validateBtn.textContent = 'Valider';
    validateBtn.addEventListener('click', () => {
      this.handleValidation(index);
    });

    this.dialogPanel.appendChild(validateBtn);
  }

  /**
   * Traite la validation d'une réponse.
   * Affiche le feedback puis passe à la question suivante (ou au résumé final).
   *
   * @param questionIndex - Index de la question venant d'être répondue
   */
  private handleValidation(questionIndex: number): void {
    const question = this.state.questions[questionIndex];
    if (!question) return;

    // Récupérer la réponse sélectionnée
    const selectedRadio = this.shadow.querySelector<HTMLInputElement>(
      `input[name="sn-m6-q${questionIndex}"]:checked`,
    );

    if (!selectedRadio) {
      // Aucune sélection — indiquer à l'utilisateur
      const fieldset = this.shadow.getElementById('sn-m6-fieldset');
      if (fieldset) {
        // Afficher un message d'invitation à répondre
        let hint = fieldset.querySelector('#sn-m6-no-selection-hint');
        if (!hint) {
          hint = document.createElement('p');
          hint.setAttribute('id', 'sn-m6-no-selection-hint');
          hint.setAttribute('role', 'alert');
          (hint as HTMLElement).style.color = 'var(--sn-color-danger)';
          (hint as HTMLElement).style.fontSize = 'var(--sn-font-size-small)';
          hint.textContent = 'Veuillez sélectionner une réponse avant de valider.';
          fieldset.appendChild(hint);
        }
      }
      return;
    }

    const selectedIndex = parseInt(selectedRadio.value, 10);
    const isCorrect = selectedIndex === question.correct_index;

    // Enregistrer la réponse
    this.state.answers.push({
      questionId: question.id,
      correct: isCorrect,
    });

    // Afficher le feedback
    this.renderFeedback(question, selectedIndex, isCorrect, questionIndex);
  }

  /**
   * Rend le feedback post-réponse pour une question.
   *
   * @param question      - Question répondue
   * @param selectedIndex - Index de la réponse choisie
   * @param isCorrect     - true si la réponse est correcte
   * @param questionIndex - Index de la question (pour "Suivante" ou "Terminer")
   */
  private renderFeedback(
    question: QuizQuestion,
    selectedIndex: number,
    isCorrect: boolean,
    questionIndex: number,
  ): void {
    // Désactiver tous les boutons radio et marquer les réponses
    const radios = this.shadow.querySelectorAll<HTMLInputElement>(
      `input[name="sn-m6-q${questionIndex}"]`,
    );
    radios.forEach((radio, index) => {
      radio.setAttribute('disabled', 'true');
      const label = radio.parentElement;
      if (!label) return;

      if (index === question.correct_index) {
        label.setAttribute('class', 'sn-m6-option-label sn-m6-option-correct');
      } else if (index === selectedIndex && !isCorrect) {
        label.setAttribute('class', 'sn-m6-option-label sn-m6-option-wrong');
      }
    });

    // Zone de feedback
    const feedback = document.createElement('div');
    feedback.setAttribute('id', 'sn-m6-feedback');
    feedback.setAttribute('role', 'region');
    feedback.setAttribute('aria-label', 'Explication');

    const feedbackResult = document.createElement('p');
    feedbackResult.setAttribute('id', 'sn-m6-feedback-result');
    feedbackResult.textContent = isCorrect ? 'Bonne réponse !' : 'Réponse incorrecte.';
    (feedbackResult as HTMLElement).setAttribute(
      'style',
      `color: ${isCorrect ? 'var(--sn-color-success)' : 'var(--sn-color-danger)'}; font-weight: var(--sn-font-weight-bold);`,
    );

    const feedbackExplanation = document.createElement('p');
    feedbackExplanation.setAttribute('id', 'sn-m6-feedback-explanation');
    feedbackExplanation.textContent = question.explanation;

    feedback.appendChild(feedbackResult);
    feedback.appendChild(feedbackExplanation);
    this.dialogPanel.appendChild(feedback);

    // Remplacer le bouton "Valider" par "Suivante" ou "Terminer"
    const validateBtn = this.shadow.getElementById('sn-m6-btn-validate');
    if (validateBtn) {
      validateBtn.remove();
    }

    const isLastQuestion = questionIndex === this.state.questions.length - 1;
    const nextBtn = document.createElement('button');
    nextBtn.setAttribute('id', 'sn-m6-btn-next');
    nextBtn.setAttribute('type', 'button');
    nextBtn.textContent = isLastQuestion ? 'Voir mon score' : 'Question suivante';
    nextBtn.addEventListener('click', () => {
      if (isLastQuestion) {
        this.renderSummary();
      } else {
        this.renderQuestion(questionIndex + 1);
      }
    });

    this.dialogPanel.appendChild(nextBtn);

    // Donner le focus au bouton suivant pour l'accessibilité
    nextBtn.focus();
  }

  /**
   * Rend le résumé final avec le score et l'action recommandée.
   */
  private renderSummary(): void {
    const correctCount = this.state.answers.filter((a) => a.correct).length;
    const totalCount = this.state.questions.length;
    const scorePct = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

    // Vider le panneau
    while (this.dialogPanel.firstChild) {
      this.dialogPanel.removeChild(this.dialogPanel.firstChild);
    }

    // En-tête résumé
    const header = document.createElement('div');
    header.setAttribute('id', 'sn-m6-dialog-header');

    const title = document.createElement('h2');
    title.setAttribute('id', 'sn-m6-dialog-title');
    title.textContent = 'Résultats du quiz';
    header.appendChild(title);
    this.dialogPanel.appendChild(header);

    // Score
    const scoreSection = document.createElement('div');
    scoreSection.setAttribute('id', 'sn-m6-score-section');

    const scoreText = document.createElement('p');
    scoreText.setAttribute('id', 'sn-m6-score-text');
    scoreText.textContent = `${correctCount} / ${totalCount} bonnes réponses (${scorePct}%)`;

    const scoreComment = document.createElement('p');
    scoreComment.setAttribute('id', 'sn-m6-score-comment');
    if (scorePct === 100) {
      scoreComment.textContent = 'Excellent ! Vous avez tout bon.';
    } else if (scorePct >= 66) {
      scoreComment.textContent = 'Bien joué ! Continuez à vous entraîner.';
    } else {
      scoreComment.textContent =
        "Continuez à pratiquer — la vigilance s'améliore avec l'entraînement.";
    }

    scoreSection.appendChild(scoreText);
    scoreSection.appendChild(scoreComment);
    this.dialogPanel.appendChild(scoreSection);

    // Bouton de fermeture
    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('id', 'sn-m6-btn-finish');
    closeBtn.setAttribute('type', 'button');
    closeBtn.textContent = 'Fermer';
    closeBtn.addEventListener('click', () => {
      this.closeQuiz(true);
    });
    this.dialogPanel.appendChild(closeBtn);

    // Focus sur le bouton de fermeture
    closeBtn.focus();
  }

  /**
   * Ferme le quiz, envoie les résultats au service worker, et supprime l'élément.
   *
   * @param completed - true si le quiz a été complété jusqu'au résumé final
   */
  private closeQuiz(completed: boolean): void {
    const correctCount = this.state.answers.filter((a) => a.correct).length;
    const totalAnswered = this.state.answers.length;
    const totalQuestions = this.state.questions.length;
    const scorePct = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

    const results: QuizResults = {
      score_pct: completed ? scorePct : Math.round((correctCount / totalQuestions) * 100),
      question_ids: this.state.questions.map((q) => q.id),
      categories_failed: [],
      completed,
      answers_given: totalAnswered,
    };

    // Envoyer les résultats au service worker
    void browser.runtime.sendMessage({
      module: 'M6',
      action: 'quiz_completed',
      payload: {
        score_pct: results.score_pct,
        question_ids: results.question_ids,
        categories_failed: results.categories_failed,
        completed: results.completed,
        answers_given: results.answers_given,
      },
      timestamp: Date.now(),
    });

    this.onComplete?.(results);
    this.remove();
  }

  /**
   * Retourne les styles CSS propres à l'overlay M6.
   */
  private getOverlayStyles(): string {
    return `
      :host {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
      }

      #sn-m6-backdrop {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        align-items: center;
        justify-content: center;
        padding: var(--sn-space-md);
      }

      #sn-m6-dialog {
        background: var(--sn-color-bg);
        border-radius: var(--sn-radius);
        box-shadow: var(--sn-shadow);
        padding: var(--sn-space-lg);
        max-width: 480px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        font-family: system-ui, sans-serif;
        font-size: var(--sn-font-size-body);
        color: var(--sn-color-fg);
      }

      #sn-m6-dialog-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--sn-space-md);
      }

      #sn-m6-dialog-title {
        margin: 0;
        font-size: var(--sn-font-size-title);
        font-weight: var(--sn-font-weight-bold);
        color: var(--sn-color-fg);
      }

      #sn-m6-progress {
        font-size: var(--sn-font-size-small);
        color: var(--sn-color-muted);
        margin: 0 var(--sn-space-sm);
      }

      #sn-m6-dialog-close {
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

      #sn-m6-dialog-close:hover {
        color: var(--sn-color-fg);
        background: #F3F4F6;
      }

      #sn-m6-fieldset {
        border: 1px solid #E5E7EB;
        border-radius: var(--sn-radius);
        padding: var(--sn-space-md);
        margin: 0 0 var(--sn-space-md) 0;
      }

      #sn-m6-question-text {
        font-weight: var(--sn-font-weight-bold);
        font-size: var(--sn-font-size-body);
        margin-bottom: var(--sn-space-md);
        line-height: var(--sn-line-height);
      }

      .sn-m6-option-label {
        display: flex;
        align-items: flex-start;
        gap: var(--sn-space-sm);
        padding: var(--sn-space-sm) var(--sn-space-md);
        margin-bottom: var(--sn-space-xs);
        border: 1px solid #E5E7EB;
        border-radius: var(--sn-radius);
        cursor: pointer;
        min-height: var(--sn-min-target);
        font-size: var(--sn-font-size-body);
        transition: background 0.1s;
      }

      .sn-m6-option-label:hover {
        background: #F9FAFB;
      }

      .sn-m6-option-label input[type="radio"] {
        margin-top: 3px;
        flex-shrink: 0;
        width: 18px;
        height: 18px;
        cursor: pointer;
      }

      .sn-m6-option-correct {
        background: #F0FDF4 !important;
        border-color: var(--sn-color-success) !important;
      }

      .sn-m6-option-wrong {
        background: #FEF2F2 !important;
        border-color: var(--sn-color-danger) !important;
      }

      #sn-m6-feedback {
        background: #F9FAFB;
        border: 1px solid #E5E7EB;
        border-radius: var(--sn-radius);
        padding: var(--sn-space-md);
        margin-bottom: var(--sn-space-md);
      }

      #sn-m6-feedback-result {
        margin: 0 0 var(--sn-space-sm) 0;
        font-size: var(--sn-font-size-body);
      }

      #sn-m6-feedback-explanation {
        margin: 0;
        font-size: var(--sn-font-size-small);
        line-height: var(--sn-line-height);
        color: var(--sn-color-fg);
      }

      #sn-m6-btn-validate,
      #sn-m6-btn-next,
      #sn-m6-btn-finish {
        width: 100%;
        min-height: var(--sn-min-target);
        padding: var(--sn-space-sm) var(--sn-space-md);
        background: var(--sn-color-accent);
        color: #ffffff;
        border: none;
        border-radius: var(--sn-radius);
        cursor: pointer;
        font-size: var(--sn-font-size-body);
        font-weight: var(--sn-font-weight-bold);
        margin-top: var(--sn-space-sm);
      }

      #sn-m6-btn-validate:hover,
      #sn-m6-btn-next:hover,
      #sn-m6-btn-finish:hover {
        opacity: 0.9;
      }

      #sn-m6-score-section {
        text-align: center;
        padding: var(--sn-space-lg) 0;
      }

      #sn-m6-score-text {
        font-size: 24px;
        font-weight: var(--sn-font-weight-bold);
        margin: 0 0 var(--sn-space-sm) 0;
      }

      #sn-m6-score-comment {
        font-size: var(--sn-font-size-body);
        color: var(--sn-color-muted);
        margin: 0 0 var(--sn-space-lg) 0;
      }

      #sn-m6-no-selection-hint {
        margin: var(--sn-space-xs) 0 0 0;
        font-size: var(--sn-font-size-small);
      }
    `;
  }
}

// Déclaration du custom element
if (!customElements.get('sn-overlay-m6')) {
  customElements.define('sn-overlay-m6', OverlayM6);
}
