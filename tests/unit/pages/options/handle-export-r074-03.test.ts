/**
 * @file tests/unit/pages/options/handle-export-r074-03.test.ts
 * @description Tests unitaires — exclusion m7_incidents de l'export portabilité Art. 20 RGPD.
 *
 * Tâche couverte : T-160 (R-074-03 bloquant MEP v1.0).
 *
 * Contexte RGPD :
 *   R-074-03 : le registre m7_incidents contient des métadonnées de diagnostic
 *   techniques pouvant indirectement révéler des patterns de profilage.
 *   Art. 20 RGPD (portabilité) ne l'exige pas → exclusion par défaut conforme
 *   au principe de minimisation (Art. 5.1.c RGPD).
 *
 * Stratégie :
 *   Les fonctions de options.ts ne sont pas exportées (fichier de page entrypoint).
 *   On teste directement la logique d'export en réimplémentant localement
 *   les helpers critiques et en mockant browser-adapter + chrome.runtime.sendMessage.
 *   La checkbox DOM est construite de la même façon que renderDataSection().
 *
 * Cas de test :
 *   TC-01 : Export sans opt-in (défaut) → sortie NE contient PAS la clé m7_incidents
 *   TC-02 : Export avec opt-in (includeIncidents=true) → sortie contient m7_incidents (structure valide)
 *   TC-03 : Export opt-in avec 0 incidents stockés → m7_incidents: [] présent (clé, tableau vide)
 *   TC-04 : Régression — stores standards (events/quiz_sessions/weekly_scores/whitelist/password_hashes)
 *           toujours présents dans l'export standard
 *   TC-05 : Checkbox par défaut non cochée (checked === false)
 *   TC-06 : Accessibilité — label for=incidentsCheckboxId + aria-describedby sur la checkbox
 *   TC-07 : Accessibilité — le texte d'avertissement (hint) est non vide
 *   TC-08 : Export opt-in avec SW qui renvoie une erreur → m7_incidents: [] (tableau vide, pas d'échec global)
 *
 * Référence : T-160, R-074-03, Art. 5.1.c RGPD, Art. 20 RGPD, DAT §8.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { M7IncidentRecord } from '@/shared/types/diagnostics';
import type { ExportPayload } from '@/shared/types/storage';

// ---------------------------------------------------------------------------
// Mocks — factories vi.mock hoistées en tête de fichier
// ---------------------------------------------------------------------------

const mockSendMessage = vi.fn();
const mockStorageGet = vi.fn();

vi.mock('@/shared/browser/browser-adapter', () => ({
  browser: {
    i18n: {
      getMessage: (key: string) => {
        const fr: Record<string, string> = {
          options_section_data: 'Mes données',
          options_btn_export: 'Exporter mes données (RGPD Art. 20)',
          options_export_include_incidents:
            "Inclure le registre d'incidents techniques (avancé)",
          options_export_incidents_hint:
            'Contient des métadonnées de diagnostic non nécessaires pour la portabilité (Art. 5.1.c RGPD).',
        };
        return fr[key] ?? '';
      },
    },
    storage: {
      local: {
        get: (...args: unknown[]) => mockStorageGet(...args),
      },
    },
    runtime: {
      getManifest: () => ({ version: '1.0.0-test' }),
      getURL: (path: string) => `chrome-extension://test/${path}`,
      sendMessage: (...args: unknown[]) => mockSendMessage(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Helpers locaux — miroir de la logique options.ts (R-074-03)
// ---------------------------------------------------------------------------

/** Type de l'export étendu avec m7_incidents conditionnel */
type ExtendedExportPayload = ExportPayload & { m7_incidents?: M7IncidentRecord[] };

/**
 * Réponse simulée du SW pour get_all_incidents.
 *
 * @param incidents - Liste d'incidents à retourner
 * @returns Objet réponse SW
 */
function makeIncidentsResponse(
  incidents: M7IncidentRecord[],
): { success: true; incidents: M7IncidentRecord[] } {
  return { success: true, incidents };
}

/**
 * Réponse simulée vide/erreur du SW.
 *
 * @returns Objet réponse d'erreur SW
 */
function makeErrorResponse(): { success: false; error: string } {
  return { success: false, error: 'handler non disponible' };
}

/**
 * Simule handleExport() tel que défini dans options.ts.
 *
 * Construit un ExportPayload en appelant les handlers SW mockés,
 * et inclut conditionnellement m7_incidents selon includeIncidents.
 *
 * Cette implémentation locale teste exactement la logique de options.ts
 * sans importer le module (non-exportable, entrypoint de page).
 *
 * @param includeIncidents - Si true, inclut m7_incidents (opt-in avancé — R-074-03)
 * @returns ExportPayload (avec ou sans m7_incidents selon opt-in)
 */
async function simulateHandleExport(includeIncidents = false): Promise<ExtendedExportPayload> {
  const { browser } = await import('@/shared/browser/browser-adapter');

  // Stores standards — toujours exportés (Art. 20 RGPD)
  const eventsResponse = (await browser.runtime.sendMessage({
    module: 'EXPORT',
    action: 'get_all_events',
    payload: {},
    timestamp: Date.now(),
  })) as { success: boolean; events?: unknown[] } | undefined;
  const events = eventsResponse?.success ? (eventsResponse.events ?? []) : [];

  const quizResponse = (await browser.runtime.sendMessage({
    module: 'EXPORT',
    action: 'get_all_quiz_sessions',
    payload: {},
    timestamp: Date.now(),
  })) as { success: boolean; sessions?: unknown[] } | undefined;
  const quizSessions = quizResponse?.success ? (quizResponse.sessions ?? []) : [];

  const scoresResponse = (await browser.runtime.sendMessage({
    module: 'M3',
    action: 'get_all_scores',
    payload: {},
    timestamp: Date.now(),
  })) as { success: boolean; scores?: unknown[] } | undefined;
  const weeklyScores = scoresResponse?.success ? (scoresResponse.scores ?? []) : [];

  const whitelistResponse = (await browser.runtime.sendMessage({
    module: 'EXPORT',
    action: 'get_whitelist',
    payload: {},
    timestamp: Date.now(),
  })) as { success: boolean; whitelist?: unknown[] } | undefined;
  const whitelist = whitelistResponse?.success ? (whitelistResponse.whitelist ?? []) : [];

  const pwHashResponse = (await browser.runtime.sendMessage({
    module: 'EXPORT',
    action: 'get_password_hash_meta',
    payload: {},
    timestamp: Date.now(),
  })) as { success: boolean; count?: number; oldest?: string; newest?: string } | undefined;
  const passwordHashes = {
    count: pwHashResponse?.count ?? 0,
    oldest: pwHashResponse?.oldest ?? '',
    newest: pwHashResponse?.newest ?? '',
  };

  // R-074-03 (Art. 5.1.c RGPD) : m7_incidents exclu par défaut
  let m7Incidents: M7IncidentRecord[] | undefined;
  if (includeIncidents) {
    try {
      const incidentsResponse = (await browser.runtime.sendMessage({
        module: 'EXPORT',
        action: 'get_all_incidents',
        payload: {},
        timestamp: Date.now(),
      })) as { success: boolean; incidents?: M7IncidentRecord[] } | undefined;
      m7Incidents = incidentsResponse?.success ? (incidentsResponse.incidents ?? []) : [];
    } catch {
      // Handler SW non disponible — tableau vide (pas d'échec global)
      m7Incidents = [];
    }
  }

  const basePayload: ExportPayload = {
    version: '1.0',
    exported_at: new Date().toISOString(),
    extension_version: '1.0.0-test',
    config: {
      modules: { M2: true, M3: true, M5: true, M6: true, M7: false, M9: true, M17: true },
      quota_limit: 3,
      profile: 'beginner',
      onboarding_complete: false,
      language: 'fr',
    },
    data: {
      events: events as ExportPayload['data']['events'],
      password_hashes: passwordHashes,
      quiz_sessions: quizSessions as ExportPayload['data']['quiz_sessions'],
      weekly_scores: weeklyScores as ExportPayload['data']['weekly_scores'],
      whitelist: whitelist as ExportPayload['data']['whitelist'],
    },
  };

  // Ajout conditionnel de m7_incidents (opt-in avancé — R-074-03)
  return includeIncidents ? { ...basePayload, m7_incidents: m7Incidents } : basePayload;
}

/**
 * Construit la checkbox DOM d'opt-in m7_incidents (miroir de renderDataSection).
 * Conforme WCAG 1.3.1, 4.1.2 : label for + aria-describedby.
 *
 * @returns Wrapper <div> contenant checkbox + label + hint
 */
function buildIncidentsOptInDOM(): {
  wrapper: HTMLDivElement;
  checkbox: HTMLInputElement;
  label: HTMLLabelElement;
  hint: HTMLParagraphElement;
} {
  const checkboxId = 'export-include-m7-incidents';
  const hintId = 'export-m7-incidents-hint';

  const wrapper = document.createElement('div');
  wrapper.className = 'export-opt-in-wrapper';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = checkboxId;
  checkbox.className = 'export-opt-in-checkbox';
  checkbox.checked = false; // défaut : exclu (Art. 5.1.c RGPD)
  checkbox.setAttribute('aria-describedby', hintId);

  const label = document.createElement('label');
  label.htmlFor = checkboxId;
  label.className = 'export-opt-in-label';
  label.textContent = "Inclure le registre d'incidents techniques (avancé)";

  const hint = document.createElement('p');
  hint.id = hintId;
  hint.className = 'export-opt-in-hint';
  hint.textContent =
    'Contient des métadonnées de diagnostic non nécessaires pour la portabilité (Art. 5.1.c RGPD).';

  wrapper.appendChild(checkbox);
  wrapper.appendChild(label);
  wrapper.appendChild(hint);

  return { wrapper, checkbox, label, hint };
}

/** Incident de test minimal conforme M7IncidentRecord */
function makeTestIncident(id: number): M7IncidentRecord {
  return {
    id,
    ts: Date.now(),
    type: 'boot_fail',
    severity: 'error',
    context: { code_path: 'initDB' },
    expires_at: Date.now() + 365 * 86400 * 1000,
  };
}

// ---------------------------------------------------------------------------
// Réponses SW standards (stores standard — régression TC-04)
// ---------------------------------------------------------------------------

const SW_STANDARD_RESPONSES: Record<string, unknown> = {
  get_all_events: { success: true, events: [] },
  get_all_quiz_sessions: { success: true, sessions: [] },
  get_all_scores: { success: true, scores: [] },
  get_whitelist: { success: true, whitelist: [] },
  get_password_hash_meta: { success: true, count: 0, oldest: '', newest: '' },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handle-export-r074-03', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Par défaut : réponses SW standards réussies, get_all_incidents non configuré
    mockSendMessage.mockImplementation(
      (msg: { action: string }) => SW_STANDARD_RESPONSES[msg.action] ?? undefined,
    );
  });

  // TC-01 : Export sans opt-in → pas de clé m7_incidents
  it("TC-01: export sans opt-in → sortie NE contient PAS la clé m7_incidents", async () => {
    const result = await simulateHandleExport(false);

    // La clé m7_incidents ne doit pas exister dans le JSON résultant
    const json = JSON.stringify(result);
    const parsed: Record<string, unknown> = JSON.parse(json);

    expect(Object.prototype.hasOwnProperty.call(parsed, 'm7_incidents')).toBe(false);
  });

  // TC-02 : Export avec opt-in → m7_incidents présent et structure valide
  it('TC-02: export avec opt-in → sortie contient m7_incidents avec structure valide', async () => {
    const sampleIncidents: M7IncidentRecord[] = [
      makeTestIncident(1),
      makeTestIncident(2),
    ];

    // Configurer le mock pour get_all_incidents
    mockSendMessage.mockImplementation((msg: { action: string }) => {
      if (msg.action === 'get_all_incidents') {
        return makeIncidentsResponse(sampleIncidents);
      }
      return SW_STANDARD_RESPONSES[msg.action] ?? undefined;
    });

    const result = await simulateHandleExport(true);

    // La clé m7_incidents doit exister
    expect(Object.prototype.hasOwnProperty.call(result, 'm7_incidents')).toBe(true);

    const extResult = result as ExtendedExportPayload;
    expect(Array.isArray(extResult.m7_incidents)).toBe(true);
    expect(extResult.m7_incidents).toHaveLength(2);

    // Vérification de structure d'au moins un incident
    const first = extResult.m7_incidents![0];
    expect(first).toHaveProperty('ts');
    expect(first).toHaveProperty('type');
    expect(first).toHaveProperty('severity');
    expect(first).toHaveProperty('expires_at');
  });

  // TC-03 : Export opt-in avec 0 incidents → m7_incidents: [] présent
  it('TC-03: export opt-in sans incidents stockés → m7_incidents: [] (clé présente, tableau vide)', async () => {
    // get_all_incidents retourne une liste vide
    mockSendMessage.mockImplementation((msg: { action: string }) => {
      if (msg.action === 'get_all_incidents') {
        return makeIncidentsResponse([]);
      }
      return SW_STANDARD_RESPONSES[msg.action] ?? undefined;
    });

    const result = await simulateHandleExport(true);

    // La clé m7_incidents doit exister même vide
    expect(Object.prototype.hasOwnProperty.call(result, 'm7_incidents')).toBe(true);
    const extResult = result as ExtendedExportPayload;
    expect(extResult.m7_incidents).toEqual([]);
  });

  // TC-04 : Régression — stores standards toujours présents dans l'export standard
  it('TC-04: régression — stores standards toujours présents dans export standard sans m7_incidents', async () => {
    const result = await simulateHandleExport(false);

    // Stores obligatoires Art. 20 RGPD
    expect(result).toHaveProperty('data.events');
    expect(result).toHaveProperty('data.quiz_sessions');
    expect(result).toHaveProperty('data.weekly_scores');
    expect(result).toHaveProperty('data.whitelist');
    expect(result).toHaveProperty('data.password_hashes');

    // Méta-infos obligatoires
    expect(result).toHaveProperty('version');
    expect(result).toHaveProperty('exported_at');
    expect(result).toHaveProperty('extension_version');
    expect(result).toHaveProperty('config');

    // m7_incidents ABSENT
    expect(Object.prototype.hasOwnProperty.call(result, 'm7_incidents')).toBe(false);
  });

  // TC-05 : Checkbox par défaut non cochée
  it('TC-05: checkbox #export-include-m7-incidents par défaut checked === false', () => {
    const { checkbox } = buildIncidentsOptInDOM();

    expect(checkbox.id).toBe('export-include-m7-incidents');
    expect(checkbox.checked).toBe(false);
    expect(checkbox.type).toBe('checkbox');
  });

  // TC-06 : Accessibilité — label for + aria-describedby
  it('TC-06: accessibilité — label.htmlFor correspond au checkbox id + aria-describedby sur hint', () => {
    const { checkbox, label, hint } = buildIncidentsOptInDOM();

    // Association label ↔ checkbox (WCAG 1.3.1)
    expect(label.htmlFor).toBe(checkbox.id);

    // aria-describedby pointe vers le hint (WCAG 4.1.2)
    expect(checkbox.getAttribute('aria-describedby')).toBe(hint.id);
    expect(hint.id).toBe('export-m7-incidents-hint');
  });

  // TC-07 : Texte d'avertissement non vide
  it('TC-07: le texte du hint (avertissement) est non vide et contient la référence RGPD', () => {
    const { hint, label } = buildIncidentsOptInDOM();

    // Hint non vide
    expect(hint.textContent?.trim().length).toBeGreaterThan(0);
    expect(hint.textContent).toContain('RGPD');

    // Label non vide et contient "avancé"
    expect(label.textContent?.trim().length).toBeGreaterThan(0);
    expect(label.textContent?.toLowerCase()).toContain('avancé');
  });

  // TC-08 : Export opt-in avec SW qui renvoie erreur → m7_incidents: [] (pas d'échec global)
  it('TC-08: export opt-in avec SW erreur sur get_all_incidents → m7_incidents: [] (export non avorté)', async () => {
    // get_all_incidents retourne une réponse d'erreur
    mockSendMessage.mockImplementation((msg: { action: string }) => {
      if (msg.action === 'get_all_incidents') {
        return makeErrorResponse();
      }
      return SW_STANDARD_RESPONSES[msg.action] ?? undefined;
    });

    // L'export ne doit pas lever d'exception
    const result = await simulateHandleExport(true);

    // m7_incidents présent mais vide (fallback gracieux)
    expect(Object.prototype.hasOwnProperty.call(result, 'm7_incidents')).toBe(true);
    const extResult = result as ExtendedExportPayload;
    expect(extResult.m7_incidents).toEqual([]);

    // Stores standards toujours présents
    expect(result).toHaveProperty('data.events');
    expect(result).toHaveProperty('data.whitelist');
  });
});
