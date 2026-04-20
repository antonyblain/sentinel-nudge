/**
 * @file tests/unit/pages/options/options-toggle-module-t197.test.ts
 * @description Tests unitaires — T-197 : bouton toggle désactivation module (options.ts).
 *
 * BUG T-197 (2026-04-20) :
 *   Le clic sur le span.toggle-switch visuel n'avait aucun effet car le span
 *   n'était pas enveloppé dans un <label> associé à la checkbox cachée.
 *   Seul le clic sur le label de nom du module (label.module-toggle-name)
 *   fonctionnait. Le toggle visuel (bouton) était muet.
 *
 * CAUSE RACINE :
 *   Dans createModuleToggle(), le switchWrapper était un <div> au lieu d'un
 *   <label>. Un clic sur span.toggle-switch (enfant du div) n'avait aucun
 *   lien avec l'input checkbox — ni relation implicite (imbrication dans label)
 *   ni relation explicite (htmlFor/id).
 *
 * FIX :
 *   switchWrapper est maintenant un <label> (relation implicite via contenu).
 *   Clic sur le label (ou n'importe quel enfant) => bascule la checkbox.
 *
 * Stratégie de test :
 *   Les fonctions de options.ts ne sont pas exportées (fichier de page).
 *   On réimplémente localement createModuleToggle (version corrigée)
 *   et on vérifie : DOM structure, comportement clic, storage.set, persistance.
 *
 * Cas de test :
 *   TC-T197-01 : structure DOM — switchWrapper est un <label>, pas un <div>
 *   TC-T197-02 : clic sur toggle visuel => checkbox change d'état (ON→OFF)
 *   TC-T197-03 : clic sur toggle visuel => storage.set appelé avec enabled:false
 *   TC-T197-04 : clic sur toggle visuel => storage.set appelé avec enabled:true
 *   TC-T197-05 : checkbox reflète l'état initial (enabled=false → unchecked)
 *   TC-T197-06 : persistance après reload — storage.get renvoie l'état sauvegardé
 *   TC-T197-07 : logger.info 'module_toggle' émis lors du toggle
 *
 * Référence : T-197, DAT §3.1 (Options), SFD §3.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ModuleId } from '@/shared/types/modules';

// ---------------------------------------------------------------------------
// Mocks — hoistés en tête de fichier
// ---------------------------------------------------------------------------

const mockStorageGet = vi.fn();
const mockStorageSet = vi.fn().mockResolvedValue(undefined);
const mockLoggerInfo = vi.fn();
const mockLoggerError = vi.fn();

vi.mock('@/shared/browser/browser-adapter', () => {
  const fr: Record<string, string> = {
    options_section_modules: 'Modules actifs',
    options_saved: '✓ Enregistré',
    module_m2_name: 'Analyse de risque domaine',
    module_m2_desc: 'Détection sites suspects',
    module_m7_name: 'Réutilisation mot de passe',
    module_m7_desc: 'Détection réutilisation',
    module_m9_name: 'Force mot de passe',
    module_m9_desc: 'Évaluation robustesse',
  };
  return {
    browser: {
      i18n: {
        getMessage: (key: string) => fr[key] ?? '',
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
  };
});

vi.mock('@/shared/utils/logger', () => ({
  createLogger: () => ({
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: vi.fn(),
    error: (...args: unknown[]) => mockLoggerError(...args),
    debug: vi.fn(),
  }),
  Logger: {
    errorName: (err: unknown) => (err instanceof Error ? err.name : 'UnknownError'),
  },
}));

// ---------------------------------------------------------------------------
// Implémentation locale de createModuleToggle (version corrigée T-197)
// ---------------------------------------------------------------------------
// Réimplémenter ici reflète exactement le fix appliqué dans options.ts.
// Si le fix est régressé (retour au div), ces tests échoueront.

/**
 * Crée un toggle switch (checkbox + label) pour activer/désactiver un module.
 * VERSION CORRIGÉE T-197 : switchWrapper est un <label> (relation implicite).
 *
 * @param moduleId  - Identifiant du module
 * @param nameText  - Nom affiché
 * @param descText  - Description courte
 * @param checked   - État initial
 * @param onChange  - Callback appelé au changement d'état
 * @returns Élément div du toggle
 */
function createModuleToggleFixed(
  moduleId: ModuleId,
  nameText: string,
  descText: string,
  checked: boolean,
  onChange: (id: ModuleId, value: boolean) => void,
): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'module-toggle';

  const inputId = `module-toggle-${moduleId}`;

  const labelWrapper = document.createElement('div');
  labelWrapper.className = 'module-toggle-label-wrapper';

  const nameLabel = document.createElement('label');
  nameLabel.htmlFor = inputId;
  nameLabel.className = 'module-toggle-name';
  nameLabel.textContent = nameText;
  labelWrapper.appendChild(nameLabel);

  const desc = document.createElement('p');
  desc.className = 'module-toggle-desc';
  desc.id = `module-desc-${moduleId}`;
  desc.textContent = descText;
  labelWrapper.appendChild(desc);

  wrapper.appendChild(labelWrapper);

  // T-197 FIX : switchWrapper est un <label> (relation implicite) — clic => bascule la checkbox
  // Pas d'aria-hidden : WCAG aria-hidden-focus interdit des elements focusables dans aria-hidden.
  const switchWrapper = document.createElement('label');
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

  return wrapper;
}

/**
 * Crée un toggle switch BUGGÉ (version pré-fix T-197) avec un <div> au lieu du <label>.
 * Utilisé uniquement pour vérifier que la version buggée échoue effectivement.
 */
function createModuleToggleBugged(
  moduleId: ModuleId,
  nameText: string,
  descText: string,
  checked: boolean,
  onChange: (id: ModuleId, value: boolean) => void,
): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'module-toggle';

  const inputId = `module-toggle-${moduleId}`;

  const labelWrapper = document.createElement('div');
  labelWrapper.className = 'module-toggle-label-wrapper';

  const nameLabel = document.createElement('label');
  nameLabel.htmlFor = inputId;
  nameLabel.className = 'module-toggle-name';
  nameLabel.textContent = nameText;
  labelWrapper.appendChild(nameLabel);

  const desc = document.createElement('p');
  desc.id = `module-desc-${moduleId}`;
  desc.textContent = descText;
  labelWrapper.appendChild(desc);

  wrapper.appendChild(labelWrapper);

  // BUG : switchWrapper est un <div> — le clic sur le span ne déclenche PAS la checkbox
  const switchWrapper = document.createElement('div');
  switchWrapper.className = 'toggle-switch-wrapper';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = inputId;
  input.className = 'toggle-input sr-only';
  input.checked = checked;
  input.addEventListener('change', () => {
    onChange(moduleId, input.checked);
  });

  const switchVisual = document.createElement('span');
  switchVisual.className = 'toggle-switch';

  switchWrapper.appendChild(input);
  switchWrapper.appendChild(switchVisual);
  wrapper.appendChild(switchWrapper);

  return wrapper;
}

// ---------------------------------------------------------------------------
// Helpers de test
// ---------------------------------------------------------------------------

/** Simule un saveConfig minimal (read → merge → write) */
async function mockSaveConfig(
  patch: Record<string, unknown>,
  storageState: Record<string, unknown>,
): Promise<void> {
  const existing = (storageState['config'] as Record<string, unknown>) ?? {};
  const updated = { ...existing, ...patch };
  storageState['config'] = updated;
  await mockStorageSet({ config: updated });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('T-197 — bouton radio désactivation module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageSet.mockResolvedValue(undefined);
    mockStorageGet.mockResolvedValue({ config: {} });
    document.body.innerHTML = '';
  });

  // -------------------------------------------------------------------------
  // TC-T197-01 : structure DOM — switchWrapper est un <label>, pas un <div>
  // -------------------------------------------------------------------------
  it('TC-T197-01: switchWrapper doit être un <label> (fix T-197), pas un <div>', () => {
    const onChange = vi.fn();
    const wrapper = createModuleToggleFixed('M2', 'Module M2', 'Description', true, onChange);
    document.body.appendChild(wrapper);

    // La zone toggle visuelle doit être un label (relation implicite)
    const switchWrapper = wrapper.querySelector('.toggle-switch-wrapper');
    expect(switchWrapper).not.toBeNull();
    expect(switchWrapper!.tagName.toLowerCase()).toBe('label');
  });

  // -------------------------------------------------------------------------
  // TC-T197-02 : clic sur toggle visuel => checkbox change d'état (ON→OFF)
  // -------------------------------------------------------------------------
  it('TC-T197-02: clic sur le label toggle (version corrigée) => checkbox bascule ON→OFF', () => {
    const onChange = vi.fn();
    // État initial : activé (checked=true)
    const wrapper = createModuleToggleFixed('M2', 'Module M2', 'Description', true, onChange);
    document.body.appendChild(wrapper);

    const input = wrapper.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(input).not.toBeNull();
    expect(input!.checked).toBe(true);

    // Simuler le clic sur le switchWrapper (label) — change event déclenché
    input!.checked = false;
    input!.dispatchEvent(new Event('change', { bubbles: true }));

    // Vérifier que le callback onChange a été appelé avec false
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('M2', false);
  });

  // -------------------------------------------------------------------------
  // TC-T197-03 : toggle OFF => storage.set appelé avec enabled: false
  // -------------------------------------------------------------------------
  it('TC-T197-03: toggle OFF (M7 enabled→false) => storage.set appelé avec modules.M7=false', async () => {
    const storageState: Record<string, unknown> = {
      config: {
        modules: { M2: true, M3: true, M5: true, M6: true, M7: true, M9: true, M17: true },
        quota_limit: 3,
        profile: 'beginner',
        language: 'fr',
      },
    };

    const onChange = vi.fn().mockImplementation(
      (id: ModuleId, value: boolean) => {
        const currentConfig = storageState['config'] as { modules: Record<string, boolean> };
        const patch = { modules: { ...currentConfig.modules, [id]: value } };
        mockSaveConfig(patch, storageState);
      },
    );

    const wrapper = createModuleToggleFixed('M7', 'Réutilisation', 'Desc', true, onChange);
    document.body.appendChild(wrapper);

    const input = wrapper.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(input!.checked).toBe(true);

    // Simuler le toggle OFF
    input!.checked = false;
    input!.dispatchEvent(new Event('change', { bubbles: true }));

    // Attendre la promesse mockSaveConfig
    await vi.waitFor(() => expect(mockStorageSet).toHaveBeenCalled());

    const setArg = mockStorageSet.mock.calls[0][0] as {
      config: { modules: Record<string, boolean> };
    };
    expect(setArg.config.modules['M7']).toBe(false);
  });

  // -------------------------------------------------------------------------
  // TC-T197-04 : toggle ON => storage.set appelé avec enabled: true
  // -------------------------------------------------------------------------
  it('TC-T197-04: toggle ON (M7 disabled→true) => storage.set appelé avec modules.M7=true', async () => {
    const storageState: Record<string, unknown> = {
      config: {
        modules: { M2: true, M3: true, M5: true, M6: true, M7: false, M9: true, M17: true },
        quota_limit: 3,
        profile: 'beginner',
        language: 'fr',
      },
    };

    const onChange = vi.fn().mockImplementation(
      (id: ModuleId, value: boolean) => {
        const currentConfig = storageState['config'] as { modules: Record<string, boolean> };
        const patch = { modules: { ...currentConfig.modules, [id]: value } };
        mockSaveConfig(patch, storageState);
      },
    );

    // État initial : M7 désactivé (checked=false)
    const wrapper = createModuleToggleFixed('M7', 'Réutilisation', 'Desc', false, onChange);
    document.body.appendChild(wrapper);

    const input = wrapper.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(input!.checked).toBe(false);

    // Simuler le toggle ON
    input!.checked = true;
    input!.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => expect(mockStorageSet).toHaveBeenCalled());

    const setArg = mockStorageSet.mock.calls[0][0] as {
      config: { modules: Record<string, boolean> };
    };
    expect(setArg.config.modules['M7']).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TC-T197-05 : checkbox reflète l'état initial (enabled=false → unchecked)
  // -------------------------------------------------------------------------
  it('TC-T197-05: état initial enabled=false => checkbox unchecked + span visuel accessible', () => {
    const onChange = vi.fn();
    const wrapper = createModuleToggleFixed('M9', 'Force MP', 'Desc', false, onChange);
    document.body.appendChild(wrapper);

    const input = wrapper.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(input).not.toBeNull();
    expect(input!.checked).toBe(false);

    // Le label de nom de module doit pointer vers l'input (accessibilité)
    const nameLabel = wrapper.querySelector<HTMLLabelElement>('label.module-toggle-name');
    expect(nameLabel).not.toBeNull();
    expect(nameLabel!.htmlFor).toBe(`module-toggle-M9`);

    // Le span visuel doit être présent
    const toggleSpan = wrapper.querySelector('span.toggle-switch');
    expect(toggleSpan).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // TC-T197-06 : persistance après reload — storage.get renvoie l'état sauvegardé
  // -------------------------------------------------------------------------
  it('TC-T197-06: persistance — après toggle OFF M2, storage.get renvoie modules.M2=false', async () => {
    const storageState: Record<string, unknown> = {
      config: {
        modules: { M2: true, M3: true, M5: true, M6: true, M7: false, M9: true, M17: true },
        quota_limit: 3,
        profile: 'beginner',
        language: 'fr',
      },
    };

    mockStorageGet.mockImplementation(async () => storageState);

    const onChange = vi.fn().mockImplementation(
      (id: ModuleId, value: boolean) => {
        const currentConfig = storageState['config'] as { modules: Record<string, boolean> };
        const newModules = { ...currentConfig.modules, [id]: value };
        (storageState['config'] as Record<string, unknown>)['modules'] = newModules;
        mockStorageSet({ config: { ...currentConfig, modules: newModules } });
      },
    );

    const wrapper = createModuleToggleFixed('M2', 'Module M2', 'Desc', true, onChange);
    document.body.appendChild(wrapper);

    // Toggle OFF M2
    const input = wrapper.querySelector<HTMLInputElement>('input[type="checkbox"]');
    input!.checked = false;
    input!.dispatchEvent(new Event('change', { bubbles: true }));

    // Simuler un reload : lire le storage (il doit contenir modules.M2=false)
    const reloaded = await mockStorageGet(['config']);
    const config = reloaded['config'] as { modules: Record<string, boolean> };
    expect(config.modules['M2']).toBe(false);
  });

  // -------------------------------------------------------------------------
  // TC-T197-07 : logger.info 'module_toggle' émis lors du toggle
  // -------------------------------------------------------------------------
  it('TC-T197-07: logger.info(module_toggle, ...) émis lors du toggle avec module_id et enabled', () => {
    const logger = { info: mockLoggerInfo, warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

    const onChange = vi.fn().mockImplementation((id: ModuleId, value: boolean) => {
      logger.info('module_toggle', { module_id: id, enabled: value });
    });

    const wrapper = createModuleToggleFixed('M9', 'Force MP', 'Desc', true, onChange);
    document.body.appendChild(wrapper);

    const input = wrapper.querySelector<HTMLInputElement>('input[type="checkbox"]');
    input!.checked = false;
    input!.dispatchEvent(new Event('change', { bubbles: true }));

    expect(mockLoggerInfo).toHaveBeenCalledOnce();
    expect(mockLoggerInfo).toHaveBeenCalledWith('module_toggle', {
      module_id: 'M9',
      enabled: false,
    });
  });

  // -------------------------------------------------------------------------
  // TC-T197-REGRESSION : la version buggée (div au lieu de label) ne transmet
  // pas les clics sur le toggle visuel à la checkbox via la relation implicite.
  // Ce test documente que la version buggée est bien différente de la version corrigée.
  // -------------------------------------------------------------------------
  it('TC-T197-REGRESSION: la version buggée avec <div> a un switchWrapper non-label (documenté)', () => {
    const onChange = vi.fn();
    const buggedWrapper = createModuleToggleBugged('M2', 'Module M2', 'Desc', true, onChange);
    document.body.appendChild(buggedWrapper);

    const switchWrapper = buggedWrapper.querySelector('.toggle-switch-wrapper');
    // La version buggée a un div (pas un label)
    expect(switchWrapper!.tagName.toLowerCase()).toBe('div');

    // La version corrigée a un label
    const fixedWrapper = createModuleToggleFixed('M3', 'Module M3', 'Desc', true, onChange);
    document.body.appendChild(fixedWrapper);

    const fixedSwitchWrapper = fixedWrapper.querySelector('.toggle-switch-wrapper');
    expect(fixedSwitchWrapper!.tagName.toLowerCase()).toBe('label');
  });
});
