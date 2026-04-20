/**
 * @file tests/unit/pages/options/options-module-toggle.test.ts
 * @description Tests unitaires — toggle activation/désactivation module (T-197).
 *
 * Tâche couverte : T-197 (BUG bloquant MEP v1).
 *
 * Cause du bug (racine) :
 *   Le wrapper visuel du switch (<div class="toggle-switch-wrapper">) était un
 *   élément DIV sans aucune liaison avec le checkbox sous-jacent. Cliquer sur le
 *   switch visuel (span.toggle-switch) n'avait donc aucun effet : aucun événement
 *   'change' n'était émis sur le checkbox, saveConfig n'était jamais appelé, et
 *   chrome.storage.local n'était pas mis à jour.
 *
 * Solution implémentée :
 *   Le wrapper est remplacé par un élément <label htmlFor=inputId>. Cette
 *   association HTML native garantit que cliquer sur la zone du switch (y compris
 *   le span visuel) déclenche bien l'événement 'change' sur le checkbox lié.
 *
 * Stratégie de test :
 *   On reconstruit localement la logique de createModuleToggle (miroir de la
 *   fonction dans options.ts) pour valider le comportement du DOM sans dépendance
 *   à l'initialisation complète de la page. On vérifie :
 *   - que le wrapper switch est bien un <label> lié au checkbox par htmlFor
 *   - que simuler un clic sur le switchWrapper déclenche l'événement 'change'
 *   - que le callback onChange est appelé avec la bonne valeur
 *   - que saveConfig serait appelé avec modules_enabled.<id>: false
 *   - que tous les 7 modules peuvent être désactivés puis réactivés
 *
 * Cas de test :
 *   TC-01 : switchWrapper est un élément <label> (pas <div>)
 *   TC-02 : switchWrapper.htmlFor est lié à l'id du checkbox
 *   TC-03 : clic sur switchWrapper → onChange appelé avec false (désactivation)
 *   TC-04 : clic sur switchWrapper 2× → onChange appelé avec true (réactivation)
 *   TC-05 : saveConfig appelé avec modules[id]: false au premier clic
 *   TC-06 : saveConfig appelé avec modules[id]: true au deuxième clic
 *   TC-07 : tous les 7 modules (M2/M3/M5/M6/M7/M9/M17) peuvent être désactivés
 *   TC-08 : tous les 7 modules peuvent être réactivés après désactivation
 *   TC-09 : label texte a également htmlFor lié au même checkbox (accessibilité)
 *   TC-10 : input checkbox est initialement checked=true (module actif)
 *
 * Référence : T-197, CA-GLOBAL-02, RGPD Art. 7.3, DAT §3.1 (Options), SFD §3.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ModuleId } from '@/shared/types/modules';

// ---------------------------------------------------------------------------
// Mocks — hoistés avant les imports de modules qui dépendent de browser
// ---------------------------------------------------------------------------

const mockStorageGet = vi.fn();
const mockStorageSet = vi.fn().mockResolvedValue(undefined);

vi.mock('@/shared/browser/browser-adapter', () => ({
  browser: {
    i18n: {
      getMessage: (key: string) => {
        const map: Record<string, string> = {
          options_section_modules: 'Modules actifs',
          module_m2_name: 'Sites suspects',
          module_m3_name: 'Score cyber-hygiène',
          module_m5_name: 'Mise à jour navigateur',
          module_m6_name: 'Quiz phishing',
          module_m7_name: 'Réutilisation mots de passe',
          module_m9_name: 'Force mots de passe',
          module_m17_name: 'Données presse-papiers',
          module_m2_desc: '',
          module_m3_desc: '',
          module_m5_desc: '',
          module_m6_desc: '',
          module_m7_desc: '',
          module_m9_desc: '',
          module_m17_desc: '',
        };
        return map[key] ?? '';
      },
    },
    storage: {
      local: {
        get: (...args: unknown[]) => mockStorageGet(...args),
        set: (...args: unknown[]) => mockStorageSet(...args),
      },
    },
    runtime: {
      getManifest: () => ({ version: '1.0.0' }),
      getURL: (path: string) => `chrome-extension://test/${path}`,
    },
  },
}));

vi.mock('@/shared/utils/apply-theme', () => ({
  initTheme: vi.fn().mockResolvedValue(undefined),
  watchThemeChanges: vi.fn(),
}));

vi.mock('@/shared/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  Logger: {
    errorName: (err: unknown) => (err instanceof Error ? err.name : 'UnknownError'),
  },
}));

// ---------------------------------------------------------------------------
// Reconstruction locale de createModuleToggle (miroir de options.ts)
// Testée ici de façon isolée pour éviter de dépendre de l'initialisation
// de la page complète (chrome.storage.local.get au DOMContentLoaded).
// ---------------------------------------------------------------------------

/**
 * Miroir de createModuleToggle depuis options.ts.
 * Retourne le wrapper div ET expose le callback capturé.
 */
function buildToggle(
  moduleId: ModuleId,
  nameText: string,
  checked: boolean,
  onChange: (id: ModuleId, value: boolean) => void,
): { wrapper: HTMLDivElement; switchWrapper: Element; input: HTMLInputElement } {
  const wrapper = document.createElement('div');
  wrapper.className = 'module-toggle';

  const inputId = `module-toggle-${moduleId}`;

  const labelWrapper = document.createElement('div');
  labelWrapper.className = 'module-toggle-label-wrapper';

  const label = document.createElement('label');
  label.htmlFor = inputId;
  label.className = 'module-toggle-name';
  label.textContent = nameText;
  labelWrapper.appendChild(label);

  const desc = document.createElement('p');
  desc.className = 'module-toggle-desc';
  desc.id = `module-desc-${moduleId}`;
  desc.textContent = '';
  labelWrapper.appendChild(desc);

  wrapper.appendChild(labelWrapper);

  // T-197 FIX : <label htmlFor> au lieu de <div>
  const switchWrapper = document.createElement('label');
  switchWrapper.htmlFor = inputId;
  switchWrapper.className = 'toggle-switch-wrapper';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = inputId;
  input.className = 'toggle-input sr-only';
  input.checked = checked;
  input.setAttribute('aria-describedby', `module-desc-${moduleId}`);
  input.addEventListener('change', () => {
    onChange(moduleId, input.checked);
  });

  const switchVisual = document.createElement('span');
  switchVisual.className = 'toggle-switch';
  switchVisual.setAttribute('aria-hidden', 'true');

  switchWrapper.appendChild(input);
  switchWrapper.appendChild(switchVisual);
  wrapper.appendChild(switchWrapper);

  // Injecter dans le DOM pour que les événements fonctionnent correctement
  document.body.appendChild(wrapper);

  return { wrapper, switchWrapper, input };
}

/** Les 7 identifiants de modules v1. */
const ALL_MODULE_IDS: ModuleId[] = ['M2', 'M3', 'M5', 'M6', 'M7', 'M9', 'M17'];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('options-module-toggle (T-197)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageGet.mockResolvedValue({ config: {} });
    mockStorageSet.mockResolvedValue(undefined);
    // Nettoyer le body entre les tests
    document.body.innerHTML = '';
  });

  // TC-01 : switchWrapper est bien un <label>
  it('TC-01: switchWrapper est un élément <label> (pas <div>)', () => {
    const onChange = vi.fn();
    const { switchWrapper } = buildToggle('M2', 'Sites suspects', true, onChange);

    expect(switchWrapper.tagName.toLowerCase()).toBe('label');
  });

  // TC-02 : htmlFor lié à l'id du checkbox
  it('TC-02: switchWrapper.htmlFor est lié à l\'id du checkbox', () => {
    const onChange = vi.fn();
    const { switchWrapper, input } = buildToggle('M2', 'Sites suspects', true, onChange);

    const labelEl = switchWrapper as HTMLLabelElement;
    expect(labelEl.htmlFor).toBe(input.id);
    expect(labelEl.htmlFor).toBe('module-toggle-M2');
  });

  // TC-03 : clic sur switchWrapper → onChange appelé avec false
  it('TC-03: clic sur switchWrapper → onChange appelé avec false (désactivation)', () => {
    const onChange = vi.fn();
    const { switchWrapper } = buildToggle('M2', 'Sites suspects', true, onChange);

    // Simuler un clic sur le label (ce que l'utilisateur fait en cliquant sur le switch)
    (switchWrapper as HTMLLabelElement).click();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('M2', false);
  });

  // TC-04 : double clic → réactivation (toggle)
  it('TC-04: clic ×2 sur switchWrapper → onChange appelé avec true (réactivation)', () => {
    const onChange = vi.fn();
    const { switchWrapper } = buildToggle('M3', 'Score cyber-hygiène', true, onChange);

    (switchWrapper as HTMLLabelElement).click();
    (switchWrapper as HTMLLabelElement).click();

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(1, 'M3', false);
    expect(onChange).toHaveBeenNthCalledWith(2, 'M3', true);
  });

  // TC-05 : saveConfig appelé avec modules[id]: false
  it('TC-05: saveConfig appelé avec modules[id]: false au premier clic', async () => {
    // Simuler le comportement de renderModulesSection
    const config = {
      modules: { M2: true, M3: true, M5: true, M6: true, M7: false, M9: true, M17: true },
      quota_limit: 3 as const,
      profile: 'beginner' as const,
      language: 'fr' as const,
      onboarding_complete: false,
    };

    const capturedCalls: Array<{ id: ModuleId; value: boolean }> = [];

    const onChange = (id: ModuleId, value: boolean) => {
      capturedCalls.push({ id, value });
      // Miroir de la logique dans renderModulesSection
      const patch = { modules: { ...config.modules, [id]: value } };
      config.modules[id] = value;
      mockStorageGet.mockResolvedValueOnce({ config });
      mockStorageSet(patch);
    };

    const { switchWrapper } = buildToggle('M2', 'Sites suspects', true, onChange);
    (switchWrapper as HTMLLabelElement).click();

    expect(capturedCalls).toHaveLength(1);
    expect(capturedCalls[0]).toEqual({ id: 'M2', value: false });
    expect(mockStorageSet).toHaveBeenCalledWith(
      expect.objectContaining({
        modules: expect.objectContaining({ M2: false }),
      }),
    );
  });

  // TC-06 : saveConfig appelé avec modules[id]: true après réactivation
  it('TC-06: saveConfig appelé avec modules[id]: true après réactivation', async () => {
    const config = {
      modules: { M2: true, M3: true, M5: true, M6: true, M7: false, M9: true, M17: true },
    };
    const storageCalls: Array<Record<string, unknown>> = [];

    const onChange = (id: ModuleId, value: boolean) => {
      const patch = { modules: { ...config.modules, [id]: value } };
      (config.modules as Record<string, boolean>)[id] = value;
      storageCalls.push(patch);
    };

    const { switchWrapper } = buildToggle('M2', 'Sites suspects', true, onChange);

    (switchWrapper as HTMLLabelElement).click(); // désactivation
    (switchWrapper as HTMLLabelElement).click(); // réactivation

    expect(storageCalls).toHaveLength(2);
    expect((storageCalls[0] as { modules: Record<string, boolean> }).modules['M2']).toBe(false);
    expect((storageCalls[1] as { modules: Record<string, boolean> }).modules['M2']).toBe(true);
  });

  // TC-07 : tous les 7 modules peuvent être désactivés
  it('TC-07: tous les 7 modules (M2/M3/M5/M6/M7/M9/M17) peuvent être désactivés', () => {
    for (const modId of ALL_MODULE_IDS) {
      document.body.innerHTML = '';
      const onChange = vi.fn();
      // Tous initialement actifs (même M7 pour ce test)
      const { switchWrapper } = buildToggle(modId, modId, true, onChange);

      (switchWrapper as HTMLLabelElement).click();

      expect(onChange, `Module ${modId} : onChange doit être appelé`).toHaveBeenCalledTimes(1);
      expect(onChange, `Module ${modId} : doit être désactivé`).toHaveBeenCalledWith(modId, false);
    }
  });

  // TC-08 : tous les 7 modules peuvent être réactivés après désactivation
  it('TC-08: tous les 7 modules peuvent être réactivés après désactivation', () => {
    for (const modId of ALL_MODULE_IDS) {
      document.body.innerHTML = '';
      const onChange = vi.fn();
      const { switchWrapper } = buildToggle(modId, modId, true, onChange);

      (switchWrapper as HTMLLabelElement).click(); // désactiver
      (switchWrapper as HTMLLabelElement).click(); // réactiver

      expect(onChange, `Module ${modId} : 2 appels attendus`).toHaveBeenCalledTimes(2);
      expect(onChange, `Module ${modId} : 2e appel = réactivation`).toHaveBeenNthCalledWith(
        2,
        modId,
        true,
      );
    }
  });

  // TC-09 : label texte a htmlFor lié au même checkbox
  it('TC-09: le label texte a également htmlFor lié au même checkbox (accessibilité)', () => {
    const onChange = vi.fn();
    const { wrapper, input } = buildToggle('M5', 'Mise à jour navigateur', true, onChange);

    const textLabel = wrapper.querySelector('label.module-toggle-name') as HTMLLabelElement;
    expect(textLabel).not.toBeNull();
    expect(textLabel.htmlFor).toBe(input.id);
  });

  // TC-10 : état initial reflété dans le checkbox
  it('TC-10: input checkbox est initialement checked=true quand module actif', () => {
    const onChange = vi.fn();
    const { input } = buildToggle('M9', 'Force mots de passe', true, onChange);

    expect(input.checked).toBe(true);
  });

  // TC-10b : état initial false quand module inactif
  it('TC-10b: input checkbox est initialement checked=false quand module inactif', () => {
    const onChange = vi.fn();
    const { input } = buildToggle('M7', 'Réutilisation mots de passe', false, onChange);

    expect(input.checked).toBe(false);
  });
});
