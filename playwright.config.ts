/**
 * @file playwright.config.ts
 * @description Configuration Playwright pour les tests E2E Sentinel Nudge.
 *
 * Stratégie :
 * - Les tests E2E chargent l'extension Chrome réelle depuis dist/
 * - L'extension est chargée via launchPersistentContext (Chrome uniquement)
 * - playwright-crx ou launchPersistentContext avec --load-extension sont équivalents
 *
 * Important (I-002) : compatible Windows 11. Playwright télécharge ses binaires
 * dans %USERPROFILE%\AppData\Local\ms-playwright par défaut sur Windows.
 *
 * Isolation CI : les tests E2E NE sont PAS inclus dans `npm test` (Vitest).
 * Ils sont exécutés via `npm run test:e2e` (script séparé).
 * La CI GitHub Actions ne les inclut PAS dans cette PR (TACHE-073 scope).
 * Une TACHE dédiée (voir BACKLOG) intégrera les tests E2E à la CI.
 *
 * TACHE-099 (règle isTrusted) : tout test M7/M2 utilise page.locator().click()
 * et NON page.evaluate(() => form.submit()). Voir docs/p5-tests/p5-uc06-*.md §8.
 */

import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Chemin absolu vers le répertoire dist/ de l'extension buildée */
const EXTENSION_PATH = path.resolve(__dirname, 'dist');

export default defineConfig({
  /** Répertoire racine des tests E2E */
  testDir: './tests/e2e',

  /** Timeout par test (30s — les tests E2E avec extension sont plus lents) */
  timeout: 30_000,

  /** Timeout pour les assertions expect() */
  expect: {
    timeout: 10_000,
  },

  /** Pas de retries en local ; la CI pourra en ajouter si besoin */
  retries: 0,

  /** Un seul worker en local pour éviter les conflits de storage extension */
  workers: 1,

  /** Rapport HTML dans playwright-report/ (ignoré par .gitignore) */
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    /**
     * Les tests E2E Sentinel Nudge utilisent launchPersistentContext
     * (configurable dans chaque test via fixture ou directement).
     * La config globale `use.channel` est omise car le contexte persistant
     * est créé manuellement dans les tests pour charger l'extension.
     */
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium-extension',
      use: {
        ...devices['Desktop Chrome'],
        /**
         * launchOptions : charge l'extension depuis dist/
         * --disable-extensions-except : n'autorise que Sentinel Nudge
         * --load-extension : charge l'extension en mode développeur
         *
         * Note : ces flags ne fonctionnent qu'avec un contexte persistant.
         * Les tests utilisent donc chromium.launchPersistentContext()
         * via la fixture extensionContext définie dans chaque spec ou
         * dans tests/e2e/fixtures.ts (à créer si plusieurs tests partagent la fixture).
         */
        launchOptions: {
          args: [
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`,
          ],
          // Désactiver le sandbox pour les environnements CI Linux (no-op sur Windows)
          // chromiumSandbox: false,
        },
      },
    },
  ],

  /**
   * Serveur HTTP local pour servir les fixtures de test.
   * Démarré automatiquement avant les tests E2E.
   * npx http-server . -p 8080 depuis la racine du projet.
   */
  webServer: {
    command: 'npx http-server . -p 8080 --silent',
    port: 8080,
    reuseExistingServer: !process.env['CI'],
    timeout: 10_000,
  },
});

/** Export du chemin de l'extension pour réutilisation dans les fixtures */
export { EXTENSION_PATH };
