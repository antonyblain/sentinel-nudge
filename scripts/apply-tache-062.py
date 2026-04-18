"""
Script complet TACHE-062 : applique toutes les modifications requises.
A executer depuis le repo principal avec la branche feature/p5-tache-062-badge-degrade-popup.
"""

import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(BASE)

def read_file(path):
    with open(path, encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

# ============================================================================
# 1. browser-adapter.ts — add runtime.reload()
# ============================================================================

print("=== 1. browser-adapter.ts ===")
ba_path = 'src/shared/browser/browser-adapter.ts'
ba = read_file(ba_path)

OLD_IFACE = '''\
    /**
     * Retourne le manifest.json de l'extension sous forme d'objet.
     * @returns Objet manifest (version, name, permissions, etc.)
     */
    getManifest(): object;
  };'''

NEW_IFACE = '''\
    /**
     * Retourne le manifest.json de l'extension sous forme d'objet.
     * @returns Objet manifest (version, name, permissions, etc.)
     */
    getManifest(): object;
    /**
     * Recharge l'extension (Service Worker + toutes les pages).
     * Utilise par le badge mode degrade (TACHE-062) pour permettre
     * a l'utilisateur de relancer manuellement les modules en echec.
     */
    reload(): void;
  };'''

OLD_IMPL = "    getManifest: (): object => chrome.runtime.getManifest(),\n  },"
NEW_IMPL = "    getManifest: (): object => chrome.runtime.getManifest(),\n    reload: (): void => chrome.runtime.reload(),\n  },"

if OLD_IFACE in ba:
    ba = ba.replace(OLD_IFACE, NEW_IFACE)
    print("  Interface: OK")
else:
    print("  Interface: NOT FOUND")
    sys.exit(1)

if OLD_IMPL in ba:
    ba = ba.replace(OLD_IMPL, NEW_IMPL)
    print("  Implementation: OK")
else:
    print("  Implementation: NOT FOUND")
    sys.exit(1)

write_file(ba_path, ba)
print("  Written: OK")

# ============================================================================
# 2. popup.ts — add imports, constants, functions, and initPopup calls
# ============================================================================

print("=== 2. popup.ts ===")
popup_path = 'src/pages/popup/popup.ts'
popup = read_file(popup_path)

# 2a. Add import for diagnostics keys after apply-theme import
OLD_IMPORT = "import { initTheme, watchThemeChanges } from '@/shared/utils/apply-theme';"
NEW_IMPORT = """\
import { initTheme, watchThemeChanges } from '@/shared/utils/apply-theme';
import {
  DIAGNOSTICS_M2_KEY,
  DIAGNOSTICS_M3_KEY,
  DIAGNOSTICS_M5_KEY,
  DIAGNOSTICS_M6_KEY,
  DIAGNOSTICS_M7_KEY,
  DIAGNOSTICS_M9_KEY,
  DIAGNOSTICS_M17_KEY,
} from '@/shared/types/diagnostics';"""

if OLD_IMPORT in popup:
    popup = popup.replace(OLD_IMPORT, NEW_IMPORT)
    print("  Import: OK")
else:
    print("  Import: NOT FOUND")
    sys.exit(1)

# 2b. Add constants after ICON_STATUS_QUOTA
ICON_QUOTA_LINE = "  'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z';"

NEW_CONSTS = """\

/** SVG path de l'icone d'avertissement (triangle attention, Material Design "warning", viewBox 24x24) */
const ICON_WARNING = 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z';

/**
 * Seuil de degradation en millisecondes (1 heure).
 * Si ready=false ET le dernier timestamp connu est anterieur a ce seuil,
 * le module est considere degrade (ADR-001 R-BOOT-04, TACHE-062).
 */
const DEGRADED_THRESHOLD_MS = 60 * 60 * 1000; // 3 600 000 ms

/**
 * Modules surveilles pour le badge degrade.
 * Chaque entree associe un label lisible a la cle de storage diagnostics.
 * Le champ `tsKey` identifie le champ timestamp pertinent selon le type de module :
 * - Modules avec initBoot (M2/M5/M6/M7) : `last_boot_ts`
 * - Module M3 (Option B) : `last_boot`
 * - Modules M9/M17 (Option B) : `last_action_ts`
 */
const MONITORED_MODULES: Array<{ label: string; storageKey: string; tsKey: string }> = [
  { label: 'M2', storageKey: DIAGNOSTICS_M2_KEY, tsKey: 'last_boot_ts' },
  { label: 'M3', storageKey: DIAGNOSTICS_M3_KEY, tsKey: 'last_boot' },
  { label: 'M5', storageKey: DIAGNOSTICS_M5_KEY, tsKey: 'last_boot_ts' },
  { label: 'M6', storageKey: DIAGNOSTICS_M6_KEY, tsKey: 'last_boot_ts' },
  { label: 'M7', storageKey: DIAGNOSTICS_M7_KEY, tsKey: 'last_boot_ts' },
  { label: 'M9', storageKey: DIAGNOSTICS_M9_KEY, tsKey: 'last_action_ts' },
  { label: 'M17', storageKey: DIAGNOSTICS_M17_KEY, tsKey: 'last_action_ts' },
];"""

if ICON_QUOTA_LINE in popup:
    popup = popup.replace(ICON_QUOTA_LINE + '\n', ICON_QUOTA_LINE + NEW_CONSTS + '\n')
    print("  Constants: OK")
else:
    print("  Constants: NOT FOUND")
    idx = popup.find('ICON_STATUS_QUOTA')
    print(repr(popup[max(0,idx):idx+300]))
    sys.exit(1)

# 2c. Add getDegradedModules and renderDegradedBadge before createInlineIcon JSDoc
OLD_CREATE_INLINE_JSDOC = """\
/**
 * Cree un SVG inline decoratif aria-hidden.
 * La couleur est heritee du parent via currentColor (fill="currentColor"),
 * ce qui permet la coherence automatique avec le dark/light mode.
 *
 * @param pathData - Donnee du path SVG (viewBox 0 0 24 24)
 * @param size     - Taille en px (defaut 16)
 * @returns Element SVGElement pret a inserer
 */
function createInlineIcon"""

NEW_FUNCS_PREFIX = """\
/**
 * Analyse les diagnostics lus depuis chrome.storage.local et retourne
 * la liste des labels de modules consideres degrades.
 *
 * Un module est degrade si et seulement si :
 * 1. Son objet diagnostics est present dans le storage.
 * 2. `ready === false`
 * 3. Le dernier timestamp connu (tsKey) est anterieur de plus de DEGRADED_THRESHOLD_MS.
 *
 * Les modules sans diagnostics publies (storage absent) sont ignores :
 * l'absence de diagnostics indique un premier boot, pas un etat degrade.
 *
 * @param storageResult - Resultat brut de chrome.storage.local.get sur les cles diagnostics
 * @param now           - Timestamp courant en ms (parametrable pour les tests)
 * @returns Tableau de labels de modules degrades (ex: ['M2', 'M7'])
 */
export function getDegradedModules(
  storageResult: Record<string, unknown>,
  now: number = Date.now(),
): string[] {
  const degraded: string[] = [];
  for (const mod of MONITORED_MODULES) {
    const diag = storageResult[mod.storageKey] as Record<string, unknown> | undefined;
    if (!diag) continue; // Absent = premier boot, pas degrade
    if (diag['ready'] !== false) continue; // ready=true ou absent : OK
    const ts = typeof diag[mod.tsKey] === 'number' ? (diag[mod.tsKey] as number) : 0;
    if (ts === 0) continue; // Jamais boote : pas encore degrade (encore en cours d'init)
    if (now - ts > DEGRADED_THRESHOLD_MS) {
      degraded.push(mod.label);
    }
  }
  return degraded;
}

/**
 * Construit et insere le badge "mode degrade" dans le conteneur donne.
 *
 * Le badge affiche :
 * - Une icone SVG attention (couleur --sn-color-warning)
 * - Le libelle i18n `popup_degraded_mode_badge`
 * - La liste des modules concernes
 * - Un bouton "En savoir plus" qui ouvre une tooltip explicative
 * - La tooltip contient une explication + un bouton "Recharger l'extension"
 *
 * Accessibilite :
 * - role="alert" + aria-live="polite" sur le badge (annonce aux lecteurs d'ecran)
 * - Bouton "En savoir plus" accessible au clavier (focus + Enter)
 * - Tooltip avec bouton fermer accessible
 *
 * Securite :
 * - D-SEC-003 : aucun innerHTML, tout DOM via createElement/textContent/appendChild
 *
 * @param container       - Element parent ou inserer le badge
 * @param degradedModules - Liste des labels de modules degrades
 */
export function renderDegradedBadge(container: HTMLElement, degradedModules: string[]): void {
  if (degradedModules.length === 0) return;

  const badge = document.createElement('div');
  badge.className = 'degraded-badge';
  badge.setAttribute('role', 'alert');
  badge.setAttribute('aria-live', 'polite');

  // Ligne principale : icone + libelle
  const badgeHeader = document.createElement('div');
  badgeHeader.className = 'degraded-badge-header';

  // Icone SVG warning (aria-hidden, couleur via CSS --sn-color-warning)
  const warnIcon = createInlineIcon(ICON_WARNING, 18);
  warnIcon.classList.add('degraded-badge-icon');
  badgeHeader.appendChild(warnIcon);

  const badgeLabel = document.createElement('span');
  badgeLabel.className = 'degraded-badge-label';
  badgeLabel.textContent =
    browser.i18n.getMessage('popup_degraded_mode_badge') || 'Mode degrade';
  badgeHeader.appendChild(badgeLabel);

  badge.appendChild(badgeHeader);

  // Liste des modules degrades
  const modulesLine = document.createElement('p');
  modulesLine.className = 'degraded-badge-modules';
  const modulesList = degradedModules.join(', ');
  modulesLine.textContent =
    browser.i18n.getMessage('popup_degraded_mode_modules', modulesList) ||
    `Modules affectes : ${modulesList}`;
  badge.appendChild(modulesLine);

  // Bouton "En savoir plus" + tooltip
  const learnMoreBtn = document.createElement('button');
  learnMoreBtn.type = 'button';
  learnMoreBtn.className = 'degraded-badge-learn-more';
  learnMoreBtn.textContent =
    browser.i18n.getMessage('popup_degraded_mode_learn_more') || 'En savoir plus';
  learnMoreBtn.setAttribute('aria-expanded', 'false');
  learnMoreBtn.setAttribute('aria-controls', 'degraded-tooltip');
  badge.appendChild(learnMoreBtn);

  // Tooltip (masquee par defaut)
  const tooltip = document.createElement('div');
  tooltip.className = 'degraded-tooltip';
  tooltip.id = 'degraded-tooltip';
  tooltip.setAttribute('role', 'region');
  tooltip.setAttribute(
    'aria-label',
    browser.i18n.getMessage('popup_degraded_mode_badge') || 'Mode degrade',
  );
  tooltip.hidden = true;

  const tooltipText = document.createElement('p');
  tooltipText.className = 'degraded-tooltip-text';
  tooltipText.textContent =
    browser.i18n.getMessage('popup_degraded_mode_tooltip') ||
    "Un ou plusieurs modules n'ont pas demarre correctement depuis plus d'une heure. L'extension fonctionne en mode degrade.";
  tooltip.appendChild(tooltipText);

  // Bouton recharger
  const reloadBtn = document.createElement('button');
  reloadBtn.type = 'button';
  reloadBtn.className = 'degraded-tooltip-reload';
  reloadBtn.textContent =
    browser.i18n.getMessage('popup_degraded_mode_reload') || "Recharger l'extension";
  reloadBtn.addEventListener('click', () => {
    void browser.runtime.reload();
  });
  tooltip.appendChild(reloadBtn);

  // Bouton fermer tooltip
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'degraded-tooltip-close';
  closeBtn.textContent =
    browser.i18n.getMessage('popup_degraded_mode_tooltip_close') || 'Fermer';
  closeBtn.addEventListener('click', () => {
    tooltip.hidden = true;
    learnMoreBtn.setAttribute('aria-expanded', 'false');
    learnMoreBtn.focus();
  });
  tooltip.appendChild(closeBtn);

  badge.appendChild(tooltip);

  // Toggle tooltip au clic sur "En savoir plus"
  learnMoreBtn.addEventListener('click', () => {
    const isOpen = !tooltip.hidden;
    tooltip.hidden = isOpen;
    learnMoreBtn.setAttribute('aria-expanded', String(!isOpen));
  });

  container.appendChild(badge);
}

/**
 * Cree un SVG inline decoratif aria-hidden.
 * La couleur est heritee du parent via currentColor (fill="currentColor"),
 * ce qui permet la coherence automatique avec le dark/light mode.
 *
 * @param pathData - Donnee du path SVG (viewBox 0 0 24 24)
 * @param size     - Taille en px (defaut 16)
 * @returns Element SVGElement pret a inserer
 */
function createInlineIcon"""

if OLD_CREATE_INLINE_JSDOC in popup:
    popup = popup.replace(OLD_CREATE_INLINE_JSDOC, NEW_FUNCS_PREFIX)
    print("  Functions: OK")
else:
    print("  Functions: NOT FOUND")
    idx = popup.find('function createInlineIcon')
    print(repr(popup[max(0,idx-400):idx+50]))
    sys.exit(1)

# 2d. Add diagnosticsKeys to storage get call in initPopup
OLD_STORAGE_GET = "    const storageData = await browser.storage.local.get(['config', 'quota_state']);"
NEW_STORAGE_GET = """\
    // Read config + quota + diagnostics for all monitored modules (TACHE-062)
    const diagnosticsKeys = MONITORED_MODULES.map((m) => m.storageKey);
    const storageData = await browser.storage.local.get([
      'config',
      'quota_state',
      ...diagnosticsKeys,
    ]);"""

if OLD_STORAGE_GET in popup:
    popup = popup.replace(OLD_STORAGE_GET, NEW_STORAGE_GET)
    print("  Storage get: OK")
else:
    print("  Storage get: NOT FOUND")
    sys.exit(1)

# 2e. Add renderDegradedBadge call in initPopup
OLD_RENDER = "    renderScoreSection(mainContent, currentScore);\n    renderStatusSection(mainContent, activeCount, quotaRemaining, quotaReached);"
NEW_RENDER = """\
    renderScoreSection(mainContent, currentScore);

    // Badge mode degrade (TACHE-062) : apres le score, avant le statut
    const degradedModules = getDegradedModules(storageData);
    renderDegradedBadge(mainContent, degradedModules);

    renderStatusSection(mainContent, activeCount, quotaRemaining, quotaReached);"""

if OLD_RENDER in popup:
    popup = popup.replace(OLD_RENDER, NEW_RENDER)
    print("  Render call: OK")
else:
    print("  Render call: NOT FOUND")
    idx = popup.find('renderScoreSection(mainContent')
    print(repr(popup[max(0,idx-20):idx+200]))
    sys.exit(1)

write_file(popup_path, popup)
print("  Written: OK")

# ============================================================================
# 3. popup.css — add degraded badge styles
# ============================================================================

print("=== 3. popup.css ===")
css_path = 'src/pages/popup/popup.css'
css = read_file(css_path)

OLD_CSS_MARKER = "/* Respect des pr\u00e9f\u00e9rences de mouvement r\u00e9duit \u2014 DAT \u00a711.2 */\n@media (prefers-reduced-motion: reduce) {"
NEW_CSS_CONTENT = """\
/* -------------------------------------------------------------------------- */
/* Badge mode degrade (TACHE-062)                                             */
/* -------------------------------------------------------------------------- */

/* Conteneur principal du badge */
.degraded-badge {
  background-color: var(--sn-color-warning-bg);
  border: 1px solid var(--sn-color-warning);
  border-radius: var(--sn-radius);
  padding: var(--sn-space-sm) var(--sn-space-md);
  margin-bottom: var(--sn-space-md);
  color: var(--sn-color-warning);
}

/* Ligne icone + libelle */
.degraded-badge-header {
  display: flex;
  align-items: center;
  gap: var(--sn-space-xs);
  margin-bottom: var(--sn-space-xs);
}

/* Icone SVG warning */
.degraded-badge-icon {
  flex-shrink: 0;
  color: var(--sn-color-warning);
}

/* Libelle "Mode degrade" */
.degraded-badge-label {
  font-weight: var(--sn-font-weight-bold);
  font-size: var(--sn-font-size-small);
  color: var(--sn-color-warning);
}

/* Ligne des modules affectes */
.degraded-badge-modules {
  font-size: var(--sn-font-size-small);
  color: var(--sn-color-warning);
  margin-bottom: var(--sn-space-xs);
}

/* Bouton "En savoir plus" */
.degraded-badge-learn-more {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: var(--sn-font-size-small);
  color: var(--sn-color-warning);
  text-decoration: underline;
  font-family: inherit;
}

.degraded-badge-learn-more:hover,
.degraded-badge-learn-more:focus {
  color: var(--sn-color-fg);
  outline: 2px solid var(--sn-color-warning);
  outline-offset: 2px;
  border-radius: 2px;
}

/* Tooltip explicative */
.degraded-tooltip {
  margin-top: var(--sn-space-sm);
  padding: var(--sn-space-sm);
  background-color: var(--sn-color-surface);
  border: 1px solid var(--sn-color-warning);
  border-radius: var(--sn-radius-sm);
}

/* Texte de la tooltip */
.degraded-tooltip-text {
  font-size: var(--sn-font-size-small);
  color: var(--sn-color-fg);
  margin-bottom: var(--sn-space-xs);
  line-height: 1.4;
}

/* Boutons de la tooltip */
.degraded-tooltip-reload,
.degraded-tooltip-close {
  background: none;
  border: 1px solid var(--sn-color-warning);
  border-radius: var(--sn-radius-sm);
  padding: 2px var(--sn-space-xs);
  cursor: pointer;
  font-size: var(--sn-font-size-small);
  color: var(--sn-color-warning);
  font-family: inherit;
  margin-right: var(--sn-space-xs);
  margin-top: var(--sn-space-xs);
}

.degraded-tooltip-reload:hover,
.degraded-tooltip-reload:focus,
.degraded-tooltip-close:hover,
.degraded-tooltip-close:focus {
  background-color: var(--sn-color-warning-bg);
  outline: 2px solid var(--sn-color-warning);
  outline-offset: 2px;
}

/* Respect des pr\u00e9f\u00e9rences de mouvement r\u00e9duit \u2014 DAT \u00a711.2 */
@media (prefers-reduced-motion: reduce) {"""

if OLD_CSS_MARKER in css:
    css = css.replace(OLD_CSS_MARKER, NEW_CSS_CONTENT)
    print("  CSS: OK")
else:
    print("  CSS: NOT FOUND")
    idx = css.find('prefers-reduced-motion')
    print(repr(css[max(0,idx-100):idx+50]))
    sys.exit(1)

write_file(css_path, css)
print("  Written: OK")

# ============================================================================
# 4. FR messages.json
# ============================================================================

print("=== 4. FR messages.json ===")
fr_path = 'src/assets/_locales/fr/messages.json'
fr = read_file(fr_path)

if 'popup_degraded_mode_badge' not in fr:
    FR_MARKER = '"popup_error": {\n    "message": "Impossible de r\u00e9cup\u00e9rer les donn\u00e9es",\n    "description": "Erreur de r\u00e9cup\u00e9ration des donn\u00e9es popup"\n  },'
    FR_NEW = '''"popup_error": {
    "message": "Impossible de r\u00e9cup\u00e9rer les donn\u00e9es",
    "description": "Erreur de r\u00e9cup\u00e9ration des donn\u00e9es popup"
  },
  "popup_degraded_mode_badge": {
    "message": "Mode d\u00e9grad\u00e9",
    "description": "Libell\u00e9 du badge mode d\u00e9grad\u00e9 dans la popup"
  },
  "popup_degraded_mode_modules": {
    "message": "Modules affect\u00e9s : $1",
    "description": "Liste des modules d\u00e9grad\u00e9s",
    "placeholders": {
      "1": {
        "content": "$1",
        "example": "M2, M7"
      }
    }
  },
  "popup_degraded_mode_learn_more": {
    "message": "En savoir plus",
    "description": "Bouton En savoir plus dans le badge d\u00e9grad\u00e9"
  },
  "popup_degraded_mode_tooltip": {
    "message": "Un ou plusieurs modules n\u2019ont pas d\u00e9marr\u00e9 correctement depuis plus d\u2019une heure. L\u2019extension fonctionne en mode d\u00e9grad\u00e9.",
    "description": "Texte de la tooltip explicative du mode d\u00e9grad\u00e9"
  },
  "popup_degraded_mode_reload": {
    "message": "Recharger l\u2019extension",
    "description": "Bouton de rechargement de l\u2019extension depuis le badge d\u00e9grad\u00e9"
  },
  "popup_degraded_mode_tooltip_close": {
    "message": "Fermer",
    "description": "Fermer la tooltip du badge d\u00e9grad\u00e9"
  },'''
    if FR_MARKER in fr:
        fr = fr.replace(FR_MARKER, FR_NEW)
        json.loads(fr)  # validate
        write_file(fr_path, fr)
        print("  Applied + JSON valid: OK")
    else:
        print("  FR MARKER not found")
        sys.exit(1)
else:
    print("  Already applied: OK")

# ============================================================================
# 5. EN messages.json
# ============================================================================

print("=== 5. EN messages.json ===")
en_path = 'src/assets/_locales/en/messages.json'
en = read_file(en_path)

if 'popup_degraded_mode_badge' not in en:
    EN_MARKER = '"popup_error": {\n    "message": "Unable to retrieve data",\n    "description": "Popup data retrieval error"\n  },'
    EN_NEW = '''"popup_error": {
    "message": "Unable to retrieve data",
    "description": "Popup data retrieval error"
  },
  "popup_degraded_mode_badge": {
    "message": "Degraded mode",
    "description": "Degraded mode badge label in popup"
  },
  "popup_degraded_mode_modules": {
    "message": "Affected modules: $1",
    "description": "Degraded modules list",
    "placeholders": {
      "1": {
        "content": "$1",
        "example": "M2, M7"
      }
    }
  },
  "popup_degraded_mode_learn_more": {
    "message": "Learn more",
    "description": "Learn more button in degraded badge"
  },
  "popup_degraded_mode_tooltip": {
    "message": "One or more modules failed to start correctly for more than one hour. The extension is running in degraded mode.",
    "description": "Tooltip text for degraded mode badge"
  },
  "popup_degraded_mode_reload": {
    "message": "Reload extension",
    "description": "Reload extension button in degraded badge"
  },
  "popup_degraded_mode_tooltip_close": {
    "message": "Close",
    "description": "Close the degraded badge tooltip"
  },'''
    if EN_MARKER in en:
        en = en.replace(EN_MARKER, EN_NEW)
        json.loads(en)  # validate
        write_file(en_path, en)
        print("  Applied + JSON valid: OK")
    else:
        print("  EN MARKER not found")
        sys.exit(1)
else:
    print("  Already applied: OK")

print("\n=== ALL DONE ===")
