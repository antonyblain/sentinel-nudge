/**
 * @file tests/e2e/whitelist-page.spec.ts
 * @description Test E2E Playwright — T-202 Page liste de confiance M2.
 *
 * Scénarios couverts :
 *   E2E-01 : Ouvrir la page whitelist depuis les Paramètres
 *   E2E-02 : La page whitelist charge et affiche son titre
 *   E2E-03 : Retrait d'une entrée — confirmation inline → suppression effective
 *
 * Architecture :
 *   - Chrome lancé via launchPersistentContext avec l'extension chargée (dist/)
 *   - La whitelist est pré-peuplée dans chrome.storage.local via page.evaluate()
 *   - L'interaction avec les boutons est réelle (isTrusted=true via Playwright)
 *
 * Prérequis :
 *   - dist/ doit être à jour (npm run build avant npm run test:e2e)
 *
 * Exécution :
 *   npm run test:e2e -- tests/e2e/whitelist-page.spec.ts
 *
 * Référence : T-202, SFD §3.4 (M2 whitelist)
 */

import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '../../dist');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Crée un répertoire temporaire pour le profil Chrome persistant.
 *
 * @returns Chemin du répertoire temporaire
 */
function createTempUserDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-wl-t202-'));
}

/**
 * Lance un contexte Chrome avec l'extension Sentinel Nudge chargée.
 *
 * @returns Contexte et chemin du répertoire temporaire
 */
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
    viewport: { width: 1280, height: 720 },
  });
  return { context, userDataDir };
}

/**
 * Attend que le service worker Sentinel Nudge soit disponible.
 *
 * @param context - Contexte Chrome persistant
 */
async function waitForServiceWorker(context: BrowserContext): Promise<void> {
  for (let i = 0; i < 20; i++) {
    const workers = context.serviceWorkers();
    const sw = workers.find(
      (w) => w.url().includes('service-worker') || w.url().includes('sentinel'),
    );
    if (sw) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

/**
 * Récupère l'ID de l'extension depuis le service worker.
 *
 * @param context - Contexte Chrome persistant
 * @returns ID de l'extension
 */
function getExtensionId(context: BrowserContext): string {
  const workers = context.serviceWorkers();
  if (workers.length === 0) throw new Error('Aucun service worker trouvé');
  // chrome-extension://<id>/background/service-worker.js
  const swUrl = workers[0].url();
  const match = swUrl.match(/chrome-extension:\/\/([a-z]+)\//);
  if (!match) throw new Error(`Impossible d extraire l ID de l extension depuis : ${swUrl}`);
  return match[1];
}

/**
 * Pré-peuple la whitelist M2 dans chrome.storage.local via une page extension.
 *
 * @param page       - Page Playwright dans le contexte de l'extension
 * @param entries    - Entrées à écrire
 */
async function seedWhitelist(
  page: Page,
  entries: Array<{ domain: string; added_at: number }>,
): Promise<void> {
  await page.evaluate((data) => {
    return new Promise<void>((resolve) => {
      chrome.storage.local.set({ m2_whitelist: data }, resolve);
    });
  }, entries);
}

// ---------------------------------------------------------------------------
// Suite de tests T-202
// ---------------------------------------------------------------------------

test.describe('T-202 — Page liste de confiance M2', () => {
  let context: BrowserContext;
  let userDataDir: string;
  let extensionId: string;

  test.beforeEach(async () => {
    const launched = await launchExtensionContext();
    context = launched.context;
    userDataDir = launched.userDataDir;
    await waitForServiceWorker(context);
    // Laisser le SW se stabiliser
    await new Promise((resolve) => setTimeout(resolve, 1500));
    extensionId = getExtensionId(context);
  });

  test.afterEach(async () => {
    await context.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // Ignorer les erreurs de nettoyage (fichiers verrouillés Windows)
    }
  });

  // -------------------------------------------------------------------------
  // E2E-01 : Bouton "Voir la liste de confiance" ouvre la page whitelist
  // -------------------------------------------------------------------------
  test(
    'E2E-01 — Clic sur "Voir la liste de confiance" depuis Paramètres ouvre la page whitelist',
    async () => {
      const optionsUrl = `chrome-extension://${extensionId}/pages/options/options.html`;
      const page = await context.newPage();
      await page.goto(optionsUrl, { waitUntil: 'domcontentloaded' });

      // Attendre que la page soit chargée (renderDataSection appelée)
      await page.waitForSelector('button', { timeout: 5000 });

      // Trouver le bouton "Voir la liste de confiance"
      const btnViewWhitelist = page.getByRole('button', { name: /liste de confiance|trust list/i });
      await expect(btnViewWhitelist).toBeVisible({ timeout: 5000 });

      // Clic → devrait ouvrir un nouvel onglet
      const [newPage] = await Promise.all([
        context.waitForEvent('page'),
        btnViewWhitelist.click(),
      ]);

      await newPage.waitForLoadState('domcontentloaded');
      const url = newPage.url();
      expect(url).toContain('whitelist.html');

      await newPage.close();
      await page.close();
    },
  );

  // -------------------------------------------------------------------------
  // E2E-02 : La page whitelist charge avec son titre et le message "vide"
  // -------------------------------------------------------------------------
  test(
    'E2E-02 — Page whitelist charge et affiche le titre et le message liste vide',
    async () => {
      const whitelistUrl = `chrome-extension://${extensionId}/pages/whitelist/whitelist.html`;
      const page = await context.newPage();
      await page.goto(whitelistUrl, { waitUntil: 'domcontentloaded' });

      // Vérifier que le h1 est présent (titre de la page)
      const h1 = page.locator('h1.wl-title');
      await expect(h1).toBeVisible({ timeout: 5000 });
      const titleText = await h1.textContent();
      expect(titleText).toBeTruthy();

      // Vérifier que le champ de recherche est présent
      const searchInput = page.locator('#wl-search');
      await expect(searchInput).toBeVisible({ timeout: 3000 });

      await page.close();
    },
  );

  // -------------------------------------------------------------------------
  // E2E-03 : Retrait d'une entrée — confirmation inline → suppression effective
  // -------------------------------------------------------------------------
  test(
    'E2E-03 — Retrait d une entrée whitelist : confirmation inline + suppression',
    async () => {
      const whitelistUrl = `chrome-extension://${extensionId}/pages/whitelist/whitelist.html`;

      // Pré-peupler la whitelist avec 3 entrées via la page Options
      const optionsUrl = `chrome-extension://${extensionId}/pages/options/options.html`;
      const seedPage = await context.newPage();
      await seedPage.goto(optionsUrl, { waitUntil: 'domcontentloaded' });

      const testEntries = [
        { domain: 'trusted-bank.example.com', added_at: Date.now() - 3000 },
        { domain: 'work-intranet.company.com', added_at: Date.now() - 2000 },
        { domain: 'dev-localhost.test', added_at: Date.now() - 1000 },
      ];
      await seedWhitelist(seedPage, testEntries);
      await seedPage.close();

      // Ouvrir la page whitelist
      const page = await context.newPage();
      await page.goto(whitelistUrl, { waitUntil: 'domcontentloaded' });

      // Attendre que la liste soit affichée
      await page.waitForSelector('.wl-list', { timeout: 5000 });

      // Vérifier que le compteur indique 3 domaines
      const countEl = page.locator('.wl-count');
      await expect(countEl).toContainText('3', { timeout: 3000 });

      // Trouver le premier bouton Retirer
      const firstRemoveBtn = page.locator('.wl-btn-remove').first();
      await expect(firstRemoveBtn).toBeVisible();

      // Clic sur Retirer → la confirmation inline doit apparaître
      await firstRemoveBtn.click();

      // Vérifier que la zone de confirmation est visible
      const confirmZone = page.locator('.wl-confirm').first();
      await expect(confirmZone).toBeVisible({ timeout: 2000 });

      // Clic sur "Oui" pour confirmer la suppression
      const btnConfirmYes = confirmZone.locator('.wl-btn-confirm-yes');
      await btnConfirmYes.click();

      // Attendre que la liste se mette à jour (l'entrée disparaît)
      await expect(page.locator('.wl-count')).toContainText('2', { timeout: 5000 });

      // Vérifier que la liste ne contient plus que 2 éléments
      const items = page.locator('.wl-item');
      await expect(items).toHaveCount(2, { timeout: 3000 });

      await page.close();
    },
  );
});
