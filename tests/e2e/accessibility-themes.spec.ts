/**
 * @file tests/e2e/accessibility-themes.spec.ts
 * @description Audit axe-core automatisé — 4 pages × 3 thèmes = 12 combinaisons.
 *
 * TACHE-150 — Audit accessibilité WCAG 2.x sur les 3 thèmes retenus (TACHE-141) :
 *   - light  : Aegis Light    (data-theme="light")
 *   - dark   : Midnight Obsidian (data-theme="dark")
 *   - matrix : Cyberpunk Neon   (data-theme="matrix")
 *
 * 4 pages auditées (servies depuis le build dist/) :
 *   - popup       : /pages/popup/popup.html
 *   - dashboard   : /pages/dashboard/dashboard.html
 *   - options     : /pages/options/options.html
 *   - onboarding  : /pages/onboarding/onboarding.html
 *
 * Règles axe-core appliquées : wcag2a, wcag2aa, wcag21aa, wcag22aa.
 *
 * Violations classées :
 *   - critical / serious : bloquantes (doivent descendre à 0 avant merge)
 *   - moderate / minor   : documentées, correction en TACHE de suivi
 *
 * Dépendances :
 *   - dist/ à jour (npm run build)
 *   - @axe-core/playwright installé (^4.9.0)
 *   - Chrome headless=false (extensions MV3 requièrent headed)
 *
 * Référence : TACHE-150 (QA) + TACHE-145 (audit Expert accessibilité)
 */

import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.resolve(__dirname, '../../dist');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Theme = 'light' | 'dark' | 'matrix';
type PageId = 'popup' | 'dashboard' | 'options' | 'onboarding';

interface PageConfig {
  id: PageId;
  /** Chemin relatif dans dist/ (sans leading slash) */
  path: string;
  /** Sélecteur à attendre avant l'audit pour que le JS ait rendu le contenu */
  waitSelector: string;
  /** Timeout en ms pour l'attente du sélecteur */
  waitTimeout: number;
}

interface ViolationRecord {
  id: string;
  impact: string | null;
  description: string;
  nodes: number;
  helpUrl: string;
}

interface AuditResult {
  page: PageId;
  theme: Theme;
  violations: ViolationRecord[];
  passed: boolean;
  blockers: ViolationRecord[];
}

// ---------------------------------------------------------------------------
// Configuration des pages
// ---------------------------------------------------------------------------

const PAGES: PageConfig[] = [
  {
    id: 'popup',
    path: 'pages/popup/popup.html',
    // Le popup génère son contenu dynamiquement ; on attend soit le root peuplé,
    // soit un état d'erreur (role=alert) si le SW n'est pas accessible.
    waitSelector: '#popup-root',
    waitTimeout: 5000,
  },
  {
    id: 'dashboard',
    path: 'pages/dashboard/dashboard.html',
    waitSelector: '#dashboard-root',
    waitTimeout: 5000,
  },
  {
    id: 'options',
    path: 'pages/options/options.html',
    waitSelector: '#options-root',
    waitTimeout: 5000,
  },
  {
    id: 'onboarding',
    path: 'pages/onboarding/onboarding.html',
    waitSelector: '#onboarding-root',
    waitTimeout: 5000,
  },
];

const THEMES: Theme[] = ['light', 'dark', 'matrix'];

/** Impacts axe-core considérés comme bloquants (critical ou serious) */
const BLOCKING_IMPACTS = new Set(['critical', 'serious']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempUserDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-a11y-'));
}

async function launchExtensionContext(): Promise<{
  context: BrowserContext;
  userDataDir: string;
}> {
  const userDataDir = createTempUserDataDir();
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--disable-notifications',
      '--disable-infobars',
    ],
    viewport: { width: 1280, height: 800 },
  });
  return { context, userDataDir };
}

/**
 * Attend que le service worker de l'extension soit actif et retourne
 * l'ID de l'extension (nécessaire pour construire les URLs chrome-extension://).
 */
async function getExtensionId(context: BrowserContext): Promise<string> {
  // Attendre que le SW soit disponible
  let swUrl = '';
  for (let i = 0; i < 20; i++) {
    const workers = context.serviceWorkers();
    const sw = workers.find(
      (w) => w.url().includes('service-worker') || w.url().includes('sentinel'),
    );
    if (sw) {
      swUrl = sw.url();
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (!swUrl) {
    // Fallback : lire l'ID depuis la page chrome://extensions via une page dédiée
    // ou via le background page. On retourne une valeur vide et les tests
    // utiliseront http-server comme fallback.
    return '';
  }

  // Format : chrome-extension://<id>/background/service-worker.js
  const match = /chrome-extension:\/\/([^/]+)\//.exec(swUrl);
  return match?.[1] ?? '';
}

/**
 * Construit l'URL de la page à tester.
 * Priorité : chrome-extension://<id>/... si l'ID est disponible,
 * sinon http://localhost:8080/dist/... via le serveur de dev.
 */
function buildPageUrl(extensionId: string, pagePath: string): string {
  if (extensionId) {
    return `chrome-extension://${extensionId}/${pagePath}`;
  }
  // Fallback http (pages statiques depuis dist/ servi par http-server)
  return `http://localhost:8080/dist/${pagePath}`;
}

/**
 * Applique le thème en injectant data-theme sur <html>.
 * Attend 300ms pour que les transitions CSS soient terminées.
 */
async function applyTheme(page: Page, theme: Theme): Promise<void> {
  await page.evaluate((t) => {
    document.documentElement.dataset['theme'] = t;
  }, theme);
  // Laisser les transitions CSS et le re-rendu éventuel se stabiliser
  await page.waitForTimeout(300);
}

/**
 * Exécute l'audit axe-core sur la page courante avec les règles WCAG 2.x.
 * Retourne le résultat brut d'axe.
 */
async function runAxeAudit(page: Page) {
  return await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    // Exclure les nœuds injectés par axe-core lui-même
    .exclude('#axe-core')
    .analyze();
}

/**
 * Mappe une violation axe-core vers notre format simplifié.
 */
function mapViolation(v: {
  id: string;
  impact?: string | null;
  description: string;
  nodes: unknown[];
  helpUrl: string;
}): ViolationRecord {
  return {
    id: v.id,
    impact: v.impact ?? null,
    description: v.description,
    nodes: v.nodes.length,
    helpUrl: v.helpUrl,
  };
}

// ---------------------------------------------------------------------------
// Fixtures partagées au niveau describe
// ---------------------------------------------------------------------------

let sharedContext: BrowserContext;
let sharedUserDataDir: string;
let extensionId: string;

// ---------------------------------------------------------------------------
// Suite principale
// ---------------------------------------------------------------------------

test.describe('TACHE-150 — Audit axe-core automatisé (4 pages × 3 thèmes)', () => {
  /**
   * Résultats accumulés pour le rapport de synthèse affiché en fin de suite.
   * Chaque audit (page + theme) y ajoute son entrée.
   */
  const allResults: AuditResult[] = [];

  test.beforeAll(async () => {
    const launched = await launchExtensionContext();
    sharedContext = launched.context;
    sharedUserDataDir = launched.userDataDir;

    // Attendre que le SW démarre et récupérer l'ID d'extension
    extensionId = await getExtensionId(sharedContext);

    // Laisser le boot sequence se stabiliser (clé AES, canary, heartbeat)
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  test.afterAll(async () => {
    await sharedContext.close();
    try {
      fs.rmSync(sharedUserDataDir, { recursive: true, force: true });
    } catch {
      // Ignorer les erreurs de nettoyage (fichiers verrouillés sur Windows)
    }

    // Afficher la matrice de synthèse dans la sortie de test
    printSummaryMatrix(allResults);
  });

  // -------------------------------------------------------------------------
  // Génération dynamique des 12 cas de test (4 pages × 3 thèmes)
  // -------------------------------------------------------------------------

  for (const pageConfig of PAGES) {
    for (const theme of THEMES) {
      const testName = `TC-A11Y-${pageConfig.id.toUpperCase()}-${theme.toUpperCase()} — ${pageConfig.id} [theme=${theme}]`;

      test(testName, async () => {
        const page = await sharedContext.newPage();

        try {
          const url = buildPageUrl(extensionId, pageConfig.path);

          // Naviguer vers la page
          await page.goto(url, { waitUntil: 'domcontentloaded' });

          // Attendre que le JS ait rendu le contenu initial
          try {
            await page.waitForSelector(pageConfig.waitSelector, {
              timeout: pageConfig.waitTimeout,
            });
          } catch {
            // La page peut avoir son root vide si le SW n'a pas encore répondu.
            // On continue quand même l'audit : axe analysera l'état réel.
            console.warn(
              `[A11Y] Sélecteur ${pageConfig.waitSelector} non trouvé pour ${pageConfig.id} — audit sur état partiel`,
            );
          }

          // Laisser le JS se stabiliser (rendu dynamique, chrome.storage.local, etc.)
          await page.waitForTimeout(500);

          // Appliquer le thème via data-theme
          await applyTheme(page, theme);

          // Exécuter l'audit axe-core
          const axeResults = await runAxeAudit(page);

          // Mapper les violations
          const violations: ViolationRecord[] = axeResults.violations.map(mapViolation);
          const blockers = violations.filter((v) => BLOCKING_IMPACTS.has(v.impact ?? ''));

          // Stocker le résultat pour le rapport de synthèse
          const result: AuditResult = {
            page: pageConfig.id,
            theme,
            violations,
            passed: violations.length === 0,
            blockers,
          };
          allResults.push(result);

          // Vérifier le thème effectivement appliqué (diagnostic race condition)
          const appliedTheme = await page.evaluate(
            () => document.documentElement.dataset['theme'] ?? '(none)',
          );
          if (appliedTheme !== theme) {
            console.warn(
              JSON.stringify({
                diagnostic: 'theme_mismatch',
                page: pageConfig.id,
                expected: theme,
                actual: appliedTheme,
              }),
            );
          }

          // Loguer les violations avec détail des nœuds pour faciliter le diagnostic CI
          if (violations.length > 0) {
            // Log résumé
            console.info(
              JSON.stringify({
                audit: `${pageConfig.id}/${theme}`,
                applied_theme: appliedTheme,
                violations_count: violations.length,
                blockers_count: blockers.length,
                violations: violations.map((v) => ({
                  id: v.id,
                  impact: v.impact,
                  nodes: v.nodes,
                  helpUrl: v.helpUrl,
                })),
              }),
            );
            // Log détail des nœuds défaillants (cible CSS + couleurs)
            for (const rawViolation of axeResults.violations) {
              if (BLOCKING_IMPACTS.has(rawViolation.impact ?? '')) {
                for (const node of rawViolation.nodes) {
                  console.info(
                    JSON.stringify({
                      violation_node: rawViolation.id,
                      page: pageConfig.id,
                      theme,
                      target: node.target,
                      html: node.html?.substring(0, 200),
                      any: node.any?.map((c) => ({
                        id: c.id,
                        data: c.data,
                      })),
                    }),
                  );
                }
              }
            }
          }

          // Assertion principale : zéro violation bloquante (critical/serious)
          // Les violations moderate/minor sont documentées mais ne font pas échouer le test.
          const blockerDescriptions = blockers
            .map((v) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes} nœud(s))`)
            .join('\n');

          expect(
            blockers,
            `Violations bloquantes (critical/serious) sur ${pageConfig.id} [theme=${theme}] :\n${blockerDescriptions}`,
          ).toHaveLength(0);
        } finally {
          await page.close();
        }
      });
    }
  }
});

// ---------------------------------------------------------------------------
// Rapport de synthèse — matrice 4×3
// ---------------------------------------------------------------------------

function printSummaryMatrix(results: AuditResult[]): void {
  if (results.length === 0) return;

  const separator =
    '+' +
    '-'.repeat(18) +
    '+' +
    ['light', 'dark', 'matrix'].map(() => '-'.repeat(28)).join('+') +
    '+';

  console.info('\n===== RAPPORT AXECORE — MATRICE 4 PAGES × 3 THÈMES =====');
  console.info(separator);
  console.info(
    '| Page             | light (Aegis)              | dark (Obsidian)            | matrix (Cyberpunk)         |',
  );
  console.info(separator);

  const pages: PageId[] = ['popup', 'dashboard', 'options', 'onboarding'];
  const themes: Theme[] = ['light', 'dark', 'matrix'];

  for (const pageId of pages) {
    const cells = themes.map((theme) => {
      const r = results.find((x) => x.page === pageId && x.theme === theme);
      if (!r) return '? (non exécuté)             ';
      const total = r.violations.length;
      const blocking = r.blockers.length;
      if (total === 0) return 'PASS (0 violation)          ';
      if (blocking > 0) return `FAIL (${blocking} bloquant(s), ${total} total)   `.padEnd(28);
      return `WARN (0 bloquant, ${total} minor)  `.padEnd(28);
    });
    console.info(`| ${pageId.padEnd(16)} | ${cells.join(' | ')} |`);
  }

  console.info(separator);

  // Violations détaillées
  const allViolations = results.flatMap((r) =>
    r.violations.map((v) => ({ ...v, page: r.page, theme: r.theme })),
  );
  if (allViolations.length > 0) {
    console.info('\n--- Violations détaillées ---');
    const byId = new Map<string, typeof allViolations>();
    for (const v of allViolations) {
      if (!byId.has(v.id)) byId.set(v.id, []);
      byId.get(v.id)!.push(v);
    }
    for (const [id, occurrences] of byId) {
      const first = occurrences[0]!;
      const scope = occurrences.map((o) => `${o.page}/${o.theme}`).join(', ');
      console.info(
        `  [${(first.impact ?? 'unknown').toUpperCase().padEnd(8)}] ${id}\n` +
          `    Description : ${first.description}\n` +
          `    Scope       : ${scope}\n` +
          `    Référence   : ${first.helpUrl}`,
      );
    }
  } else {
    console.info('\nAucune violation détectée sur les 12 combinaisons.');
  }

  console.info('==========================================================\n');
}
