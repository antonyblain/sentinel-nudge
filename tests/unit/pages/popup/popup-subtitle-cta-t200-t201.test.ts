/**
 * @file tests/unit/pages/popup/popup-subtitle-cta-t200-t201.test.ts
 * @description Tests T-200 + T-201 — Brand Book tagline et libellé CTA Tableau de bord.
 *
 * T-200 : Le sous-titre (tagline) du header popup doit être la tagline officielle Brand Book
 *         "Votre gardien discret de cyber-hygiène" (FR) / "Your discreet cyber-hygiene guardian" (EN).
 *         La clé popup_score_label (titre de la métrique score) ne doit PAS être modifiée.
 *
 * T-201 : Le libellé du bouton CTA principal doit être "Tableau de bord" (FR) / "Dashboard" (EN),
 *         sans préfixe "Voir le".
 *
 * Stratégie : import direct des fichiers messages.json via alias Vite (@/assets/_locales/…)
 * résolu en test (resolveJsonModule + alias @ → src/).
 *
 * Référence : TACHE-200, TACHE-201, Brand Book docs/p4-conception/brand-book-sentinel-nudge.md
 */

import { describe, it, expect } from 'vitest';
import frMessages from '@/assets/_locales/fr/messages.json';
import enMessages from '@/assets/_locales/en/messages.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type I18nEntry = { message: string; description?: string };
type I18nMessages = Record<string, I18nEntry>;

const fr = frMessages as I18nMessages;
const en = enMessages as I18nMessages;

// ---------------------------------------------------------------------------
// TC-T200 — Tagline header popup (Brand Book)
// ---------------------------------------------------------------------------

describe('TC-T200 — popup_tagline Brand Book', () => {
  it('TC-T200-FR-01 : FR popup_tagline vaut la tagline Brand Book officielle', () => {
    const tagline = fr['popup_tagline'];

    expect(tagline, 'La clé popup_tagline doit exister dans fr/messages.json').toBeDefined();
    expect(tagline.message).toContain('gardien discret');
    expect(tagline.message).toBe('Votre gardien discret de cyber-hygiène');
  });

  it('TC-T200-EN-01 : EN popup_tagline vaut la tagline Brand Book officielle', () => {
    const tagline = en['popup_tagline'];

    expect(tagline, 'La clé popup_tagline doit exister dans en/messages.json').toBeDefined();
    expect(tagline.message).toContain('discreet');
    expect(tagline.message).toBe('Your discreet cyber-hygiene guardian');
  });

  it('TC-T200-INTEGRITY-01 : popup_score_label FR reste intact (titre métrique score — hors scope T-200)', () => {
    const scoreLabel = fr['popup_score_label'];

    expect(scoreLabel, 'La clé popup_score_label doit exister').toBeDefined();
    expect(scoreLabel.message).toBe('Score de cyber-hygiène');
  });

  it('TC-T200-INTEGRITY-02 : popup_tagline FR ne contient plus l\'ancien libellé "Score de cyber-hygiene"', () => {
    const tagline = fr['popup_tagline'];

    expect(tagline.message).not.toBe('Score de cyber-hygiene');
    expect(tagline.message).not.toContain('Score de cyber-hygiene');
  });
});

// ---------------------------------------------------------------------------
// TC-T201 — Libellé bouton CTA Tableau de bord
// ---------------------------------------------------------------------------

describe('TC-T201 — popup_btn_dashboard CTA court', () => {
  it('TC-T201-FR-01 : FR popup_btn_dashboard vaut "Tableau de bord" sans préfixe "Voir"', () => {
    const btn = fr['popup_btn_dashboard'];

    expect(btn, 'La clé popup_btn_dashboard doit exister dans fr/messages.json').toBeDefined();
    expect(btn.message).toBe('Tableau de bord');
    expect(btn.message).not.toContain('Voir');
  });

  it('TC-T201-EN-01 : EN popup_btn_dashboard vaut "Dashboard"', () => {
    const btn = en['popup_btn_dashboard'];

    expect(btn, 'La clé popup_btn_dashboard doit exister dans en/messages.json').toBeDefined();
    expect(btn.message).toBe('Dashboard');
  });

  it('TC-T201-FR-02 : FR popup_btn_dashboard ne contient plus "Voir le tableau de bord"', () => {
    const btn = fr['popup_btn_dashboard'];

    expect(btn.message).not.toBe('Voir le tableau de bord');
    expect(btn.message).not.toContain('Voir le');
  });
});
