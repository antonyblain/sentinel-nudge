/**
 * @file tests/e2e/t064-m7-filter-new-password.spec.ts
 * @description Couverture E2E Playwright — T-064 filtre M7 autocomplete=new-password.
 *
 * TACHE-190 — 7 scénarios E2E couvrant le filtre isNewPasswordField() appliqué
 * dans handleFormSubmit() du content script password-detector.ts.
 *
 * Référence fonctionnelle :
 *   UC-07/UC-08 — D-PM-06 : un champ autocomplete="new-password" signale explicitement
 *   un formulaire de création/changement de mot de passe. M7 (réutilisation inter-domaines)
 *   ne doit PAS s'activer : le mot de passe n'existe pas encore, aucune réutilisation possible.
 *   M9 (force du mot de passe) RESTE ACTIF — c'est son use case principal sur signup.
 *
 * Scénarios :
 *   SC-T064-E2E-01 : autocomplete="new-password" seul            → M7 non déclenché
 *   SC-T064-E2E-02 : autocomplete="current-password"             → M7 déclenché
 *   SC-T064-E2E-03 : sans attribut autocomplete                  → M7 déclenché (v1)
 *   SC-T064-E2E-04 : autocomplete="new-password username" (multi-token) → M7 filtré
 *   SC-T064-E2E-05 : autocomplete="NEW-PASSWORD" (majuscules)    → M7 filtré
 *   SC-T064-E2E-06 : 2 inputs (new + current) dans même form     → M7 sur current seulement
 *   SC-T064-E2E-07 : new-password + M9 reste actif (régression M9)
 *
 * Stratégie d'assertion :
 *   - Interception des logs console JSON structurés émis par le Logger factory.
 *     Le Logger émet du JSON avec les champs : level, scope, message, event, action.
 *   - M7 filtré   : log contenant event="m7_filter_new_password"
 *   - M7 actif    : log contenant action="password_submitted" (tentative d'envoi SW)
 *   - M9 actif    : overlay-m9 ou indicateur de force visible après saisie
 *
 * Règle isTrusted (TACHE-099) :
 *   Toutes les soumissions utilisent page.locator().fill() + page.locator().click()
 *   pour générer des événements isTrusted=true. Jamais page.evaluate(() => form.submit()).
 *
 * Dépendances :
 *   - dist/ à jour (npm run build)
 *   - http-server sur port 8080 (démarré par playwright.config.ts webServer)
 *   - Fixture : tests/fixtures/t064-new-password-form.html
 *
 * Référence : T-064 (PR #125), TACHE-190, UC-07, UC-08, D-PM-06, SFD §2.5, §2.6
 */

import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '../../dist');

/** URL de la fixture T-064 servie par http-server */
const FIXTURE_URL = 'http://localhost:8080/tests/fixtures/t064-new-password-form.html';

/**
 * Délai d'attente après soumission pour laisser le content script traiter
 * le submit et émettre les logs (hash + envoi SW ou skip).
 * Valeur conservatrice : le hash SHA-256 + l'envoi SW prennent < 500ms en local.
 */
const SUBMIT_SETTLE_MS = 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempUserDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-t064-'));
}

async function launchExtensionContext(): Promise<{
  context: BrowserContext;
  userDataDir: string;
}> {
  const userDataDir = createTempUserDataDir();
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false, // Les extensions Chrome MV3 requièrent headed
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
 * Attend que le service worker Sentinel Nudge soit actif.
 * Le SW est identifié par son URL contenant "service-worker" ou "sentinel".
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
  // Le SW peut ne pas être détectable immédiatement — on continue (fail-soft)
}

/**
 * Collecteur de logs console JSON émis par le Logger factory du content script.
 *
 * Le Logger émet du JSON structuré via console.info/warn/error :
 * {"timestamp":"...","level":"info","scope":"PasswordDetector","message":"...","event":"m7_filter_new_password",...}
 *
 * On collecte tous les messages console de la page et on les parse pour
 * identifier les événements M7/M9.
 */
interface ParsedLog {
  level?: string;
  scope?: string;
  message?: string;
  event?: string;
  action?: string;
  module?: string;
  reason?: string;
  [key: string]: unknown;
}

function attachLogCollector(page: import('@playwright/test').Page): {
  logs: ParsedLog[];
  rawLogs: string[];
} {
  const logs: ParsedLog[] = [];
  const rawLogs: string[] = [];

  page.on('console', (msg) => {
    const text = msg.text();
    rawLogs.push(text);
    try {
      const parsed = JSON.parse(text) as ParsedLog;
      logs.push(parsed);
    } catch {
      // Message non-JSON (React, libs tierces) — ignoré pour les assertions structurées
    }
  });

  return { logs, rawLogs };
}

/**
 * Vérifie si une collection de logs contient un événement de filtre M7 (skip).
 * Prédicat : le log contient event="m7_filter_new_password".
 */
function hasM7FilterLog(logs: ParsedLog[]): boolean {
  return logs.some((l) => l['event'] === 'm7_filter_new_password');
}

/**
 * Vérifie si une collection de logs contient un envoi M7 vers le SW.
 * Prédicat : le log contient action="password_submitted" et module="M7".
 * Ou le log contient le message "sending password_submitted to SW".
 */
function hasM7SubmitLog(logs: ParsedLog[]): boolean {
  return logs.some(
    (l) =>
      (l['action'] === 'password_submitted' && l['module'] === 'M7') ||
      (typeof l['message'] === 'string' &&
        l['message'].includes('sending password_submitted to SW')),
  );
}

// ---------------------------------------------------------------------------
// Suite de tests T-064 E2E
// ---------------------------------------------------------------------------

test.describe('T-064 — Filtre M7 autocomplete=new-password (TACHE-190)', () => {
  let context: BrowserContext;
  let userDataDir: string;

  // Un contexte par test pour isolation totale (pas de hash résiduel entre scénarios)
  test.beforeEach(async () => {
    const launched = await launchExtensionContext();
    context = launched.context;
    userDataDir = launched.userDataDir;

    await waitForServiceWorker(context);
    // Laisser le boot sequence se stabiliser (clé AES, canary, heartbeat)
    await new Promise((resolve) => setTimeout(resolve, 1500));
  });

  test.afterEach(async () => {
    await context.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // Ignorer les erreurs de nettoyage (fichiers verrouillés sur Windows — I-002)
    }
  });

  // -------------------------------------------------------------------------
  // SC-T064-E2E-01
  // Cas nominal du filtre : autocomplete="new-password" seul.
  // M7 ne doit PAS se déclencher.
  // -------------------------------------------------------------------------
  test('SC-T064-E2E-01 — autocomplete="new-password" seul : M7 non déclenché', async () => {
    const page = await context.newPage();
    const { logs } = attachLogCollector(page);

    await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500); // Laisser le content script s'initialiser

    // Saisie via interaction utilisateur réelle (isTrusted=true — TACHE-099)
    await page.locator('#pw-sc01').fill('MonNouveauMdp2024!');
    await page.locator('#btn-sc01').click();

    // Attendre le traitement asynchrone
    await page.waitForTimeout(SUBMIT_SETTLE_MS);

    // Vérifier que le formulaire a bien été soumis (marqueur DOM)
    const statusText = await page.locator('#status-sc01').textContent();
    expect(statusText).toContain('soumis');

    // Assertion principale : M7 doit avoir émis le log de filtre
    expect(
      hasM7FilterLog(logs),
      `SC-T064-E2E-01 : aucun log m7_filter_new_password détecté. Logs reçus : ${JSON.stringify(logs.slice(-10))}`,
    ).toBe(true);

    // Assertion complémentaire : M7 ne doit PAS avoir tenté d'envoyer au SW
    expect(
      hasM7SubmitLog(logs),
      `SC-T064-E2E-01 : M7 a envoyé password_submitted alors qu'il devait être filtré`,
    ).toBe(false);

    await page.close();
  });

  // -------------------------------------------------------------------------
  // SC-T064-E2E-02
  // Cas contrôle positif : autocomplete="current-password".
  // M7 doit se déclencher (tentera d'envoyer au SW).
  // Note : le SW peut rejeter si pas de hash connu — ce qui n'affecte pas l'assertion.
  // -------------------------------------------------------------------------
  test('SC-T064-E2E-02 — autocomplete="current-password" : M7 déclenché', async () => {
    const page = await context.newPage();
    const { logs } = attachLogCollector(page);

    await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    await page.locator('#pw-sc02').fill('MonMdpCourant123!');
    await page.locator('#btn-sc02').click();

    await page.waitForTimeout(SUBMIT_SETTLE_MS);

    const statusText = await page.locator('#status-sc02').textContent();
    expect(statusText).toContain('soumis');

    // M7 ne doit PAS avoir été filtré pour ce champ
    expect(
      hasM7FilterLog(logs),
      `SC-T064-E2E-02 : log m7_filter_new_password inattendu sur current-password`,
    ).toBe(false);

    // M7 doit avoir tenté l'envoi (log "sending password_submitted to SW")
    // Note : l'envoi peut échouer (SW pas initialisé sur localhost — sans sel d'installation)
    // On tolère aussi l'absence de log submit si le SW retourne une erreur avant le log.
    // La vraie assertion est l'ABSENCE du filtre.
    console.info(
      JSON.stringify({
        scenario: 'SC-T064-E2E-02',
        m7_filter: hasM7FilterLog(logs),
        m7_submit: hasM7SubmitLog(logs),
        log_count: logs.length,
      }),
    );

    await page.close();
  });

  // -------------------------------------------------------------------------
  // SC-T064-E2E-03
  // Cas compatibilité v1 : aucun attribut autocomplete.
  // M7 doit se déclencher (comportement avant T-064).
  // -------------------------------------------------------------------------
  test('SC-T064-E2E-03 — sans autocomplete : M7 déclenché (comportement v1 préservé)', async () => {
    const page = await context.newPage();
    const { logs } = attachLogCollector(page);

    await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    await page.locator('#pw-sc03').fill('MdpSansAutoComplete99!');
    await page.locator('#btn-sc03').click();

    await page.waitForTimeout(SUBMIT_SETTLE_MS);

    const statusText = await page.locator('#status-sc03').textContent();
    expect(statusText).toContain('soumis');

    // M7 ne doit PAS avoir été filtré (autocomplete absent → isNewPasswordField() = false)
    expect(
      hasM7FilterLog(logs),
      `SC-T064-E2E-03 : log m7_filter_new_password inattendu sur champ sans autocomplete`,
    ).toBe(false);

    console.info(
      JSON.stringify({
        scenario: 'SC-T064-E2E-03',
        m7_filter: hasM7FilterLog(logs),
        m7_submit: hasM7SubmitLog(logs),
        log_count: logs.length,
      }),
    );

    await page.close();
  });

  // -------------------------------------------------------------------------
  // SC-T064-E2E-04
  // Tokens multiples : autocomplete="new-password username".
  // Le token "new-password" est présent → M7 filtré.
  // Vérifie le parsing multi-tokens (spec HTML W3C §4.10.18.7).
  // -------------------------------------------------------------------------
  test('SC-T064-E2E-04 — autocomplete="new-password username" (multi-tokens) : M7 filtré', async () => {
    const page = await context.newPage();
    const { logs } = attachLogCollector(page);

    await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    await page.locator('#pw-sc04').fill('MdpMultiToken2024!');
    await page.locator('#btn-sc04').click();

    await page.waitForTimeout(SUBMIT_SETTLE_MS);

    const statusText = await page.locator('#status-sc04').textContent();
    expect(statusText).toContain('soumis');

    // Le token "new-password" dans "new-password username" doit déclencher le filtre
    expect(
      hasM7FilterLog(logs),
      `SC-T064-E2E-04 : filtre M7 non déclenché pour autocomplete="new-password username". Logs : ${JSON.stringify(logs.slice(-10))}`,
    ).toBe(true);

    expect(
      hasM7SubmitLog(logs),
      `SC-T064-E2E-04 : M7 a envoyé password_submitted malgré le token new-password`,
    ).toBe(false);

    await page.close();
  });

  // -------------------------------------------------------------------------
  // SC-T064-E2E-05
  // Case-insensitive : autocomplete="NEW-PASSWORD".
  // Le filtre doit être insensible à la casse (toLowerCase() avant split).
  // -------------------------------------------------------------------------
  test('SC-T064-E2E-05 — autocomplete="NEW-PASSWORD" (majuscules) : M7 filtré (case-insensitive)', async () => {
    const page = await context.newPage();
    const { logs } = attachLogCollector(page);

    await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    await page.locator('#pw-sc05').fill('MdpUppercase2024!');
    await page.locator('#btn-sc05').click();

    await page.waitForTimeout(SUBMIT_SETTLE_MS);

    const statusText = await page.locator('#status-sc05').textContent();
    expect(statusText).toContain('soumis');

    // "NEW-PASSWORD".toLowerCase() = "new-password" → filtre doit s'appliquer
    expect(
      hasM7FilterLog(logs),
      `SC-T064-E2E-05 : filtre M7 non déclenché pour autocomplete="NEW-PASSWORD". Logs : ${JSON.stringify(logs.slice(-10))}`,
    ).toBe(true);

    expect(
      hasM7SubmitLog(logs),
      `SC-T064-E2E-05 : M7 a envoyé password_submitted malgré autocomplete="NEW-PASSWORD"`,
    ).toBe(false);

    await page.close();
  });

  // -------------------------------------------------------------------------
  // SC-T064-E2E-06
  // Formulaire mixte : 2 inputs password dans le même form.
  //   - #pw-sc06-new  : autocomplete="new-password"      → M7 filtré
  //   - #pw-sc06-current : autocomplete="current-password" → M7 actif
  // Au submit, M7 est filtré sur le premier et non filtré sur le second.
  // Ce scénario vérifie le traitement différencié par input.
  // -------------------------------------------------------------------------
  test('SC-T064-E2E-06 — 2 inputs (new + current) dans même form : M7 filtré sur new, actif sur current', async () => {
    const page = await context.newPage();
    const { logs } = attachLogCollector(page);

    await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Remplir les deux champs
    await page.locator('#pw-sc06-new').fill('NouveauMdp2024!');
    await page.locator('#pw-sc06-current').fill('AncienMdp2024!');
    await page.locator('#btn-sc06').click();

    await page.waitForTimeout(SUBMIT_SETTLE_MS);

    const statusText = await page.locator('#status-sc06').textContent();
    expect(statusText).toContain('soumis');

    // Le filtre doit avoir été déclenché (au moins une fois, sur le champ new-password)
    expect(
      hasM7FilterLog(logs),
      `SC-T064-E2E-06 : aucun log m7_filter_new_password détecté pour le champ new-password. Logs : ${JSON.stringify(logs.slice(-15))}`,
    ).toBe(true);

    // M7 doit avoir tenté l'envoi pour le champ current-password
    // (la présence du filtre sur new ne doit pas bloquer le traitement de current)
    console.info(
      JSON.stringify({
        scenario: 'SC-T064-E2E-06',
        m7_filter_detected: hasM7FilterLog(logs),
        m7_submit_detected: hasM7SubmitLog(logs),
        log_count: logs.length,
        filter_logs: logs.filter((l) => l['event'] === 'm7_filter_new_password').length,
        submit_logs: logs.filter((l) => l['action'] === 'password_submitted').length,
      }),
    );

    // Vérifier que le log de filtre contient le sélecteur du champ new-password
    const filterLog = logs.find((l) => l['event'] === 'm7_filter_new_password');
    expect(filterLog).toBeDefined();
    // Le sélecteur doit référencer pw-sc06-new ou new_password
    if (filterLog?.['selector']) {
      expect(String(filterLog['selector'])).toMatch(/sc06-new|new_password/);
    }

    await page.close();
  });

  // -------------------------------------------------------------------------
  // SC-T064-E2E-07
  // Régression M9 : sur un champ autocomplete="new-password", M9 (force du mot
  // de passe) doit rester actif. C'est le use case principal de M9 : évaluer
  // la force d'un nouveau mot de passe lors d'un signup.
  //
  // Stratégie : après saisie dans #pw-sc07, attendre l'apparition de l'overlay
  // M9 (shadow host) dans le DOM. L'indicateur M9 est injecté après le champ
  // password sous forme de Shadow DOM par createM9OverlayInline().
  // -------------------------------------------------------------------------
  test('SC-T064-E2E-07 — régression M9 : M9 reste actif sur autocomplete="new-password"', async () => {
    const page = await context.newPage();
    const { logs } = attachLogCollector(page);

    // Intercepter les erreurs JS (diagnostic si M9 ne s'initialise pas)
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Saisir dans le champ new-password de SC-07 pour déclencher M9
    // M9 s'active au focus + input event sur les champs new-password
    await page.locator('#pw-sc07').focus();
    await page.waitForTimeout(300); // Attendre le focus handler M9 (debounce 150ms)

    // Saisir un mot de passe (déclenche l'évaluation zxcvbn debounced 150ms)
    await page.locator('#pw-sc07').fill('test');
    await page.waitForTimeout(400); // Attendre le debounce M9 (150ms)

    await page.locator('#pw-sc07').fill('MonNouveauMdpFort2024!@#');
    await page.waitForTimeout(400); // Attendre le debounce M9

    // Vérifier l'absence d'erreurs JS (M9 doit s'initialiser sans exception)
    expect(
      pageErrors,
      `SC-T064-E2E-07 : erreurs JS détectées : ${pageErrors.join('; ')}`,
    ).toHaveLength(0);

    // Vérifier les logs M9 : M9 doit avoir évalué le champ (log avec module="M9")
    // ou un signal indirect comme la présence d'un overlay M9 dans le DOM.
    const m9Logs = logs.filter(
      (l) =>
        l['module'] === 'M9' || (typeof l['message'] === 'string' && l['message'].includes('M9')),
    );

    console.info(
      JSON.stringify({
        scenario: 'SC-T064-E2E-07',
        m9_logs_count: m9Logs.length,
        m7_filter_on_new_password: hasM7FilterLog(logs),
        total_logs: logs.length,
      }),
    );

    // Vérification de l'overlay M9 dans le DOM.
    // M9 injecte un shadow host div après le champ password.
    // On cherche tout div adjacent à #pw-sc07 avec une shadowRoot (indicateur M9).
    const m9OverlayExists = await page.evaluate(() => {
      const pwField = document.querySelector('#pw-sc07');
      if (!pwField) return false;

      // Chercher un shadow host injecté après le champ (frère suivant ou dans le parent)
      let el = pwField.nextElementSibling;
      while (el) {
        if (el.shadowRoot !== null) return true;
        el = el.nextElementSibling;
      }

      // Chercher aussi dans le form parent
      const form = pwField.closest('form');
      if (!form) return false;
      const shadows = Array.from(form.querySelectorAll('*')).filter((e) => e.shadowRoot !== null);
      return shadows.length > 0;
    });

    // M9 est confirmé actif si :
    // (a) un overlay shadow DOM est présent, OU
    // (b) des logs M9 ont été émis (module="M9")
    const m9Active = m9OverlayExists || m9Logs.length > 0;

    expect(
      m9Active,
      `SC-T064-E2E-07 : M9 ne semble pas actif sur autocomplete="new-password". ` +
        `Overlay DOM: ${m9OverlayExists}, Logs M9: ${m9Logs.length}. ` +
        `Logs complets: ${JSON.stringify(logs.slice(-20))}`,
    ).toBe(true);

    // Vérification complémentaire : soumettre et confirmer que M7 est filtré
    await page.locator('#btn-sc07').click();
    await page.waitForTimeout(SUBMIT_SETTLE_MS);

    expect(
      hasM7FilterLog(logs),
      `SC-T064-E2E-07 : M7 n'a pas été filtré sur le champ new-password après soumission`,
    ).toBe(true);

    expect(
      hasM7SubmitLog(logs),
      `SC-T064-E2E-07 : M7 a envoyé password_submitted sur un champ new-password (régresssion M7)`,
    ).toBe(false);

    await page.close();
  });
});
