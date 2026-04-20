import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';
import { resolve } from 'path';

/**
 * Configuration Vite pour Sentinel Nudge — Extension Chrome MV3.
 *
 * Le plugin vite-plugin-web-extension lit le manifest.json comme source de vérité
 * et génère automatiquement les entry points (Service Worker, pages UI, content scripts).
 *
 * Les pages dashboard et onboarding sont déclarées en additionalInputs car elles ne
 * correspondent à aucune propriété standard du manifest MV3 reconnue par le plugin.
 * Elles sont ouvertes uniquement via tabs.create({ url: chrome.runtime.getURL(...) })
 * depuis le service worker, ou via des liens internes depuis les pages d'extension
 * (contexte chrome-extension://) — aucune des deux situations ne nécessite leur
 * déclaration en web_accessible_resources (WAR ne sert qu'à autoriser les pages web
 * tierces à charger une ressource d'extension). Voir T-028 pour le resserrement WAR.
 *
 * Alias @/ → src/ pour éviter les chemins relatifs profonds dans les imports.
 */
export default defineConfig({
  root: resolve(__dirname, 'src'),
  plugins: [
    webExtension({
      manifest: resolve(__dirname, 'src/manifest.json'),
      additionalInputs: ['pages/dashboard/dashboard.html', 'pages/onboarding/onboarding.html', 'pages/whitelist/whitelist.html'],
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    // Cible ES2022 — compatible Chrome 120+ (MV3 minimum supporté)
    target: 'es2022',
    // Répertoire de sortie de la distribution (relatif à root)
    outDir: resolve(__dirname, 'dist'),
    // Vide le répertoire de sortie avant chaque build
    emptyOutDir: true,
  },
  // Configuration Vitest pour les tests unitaires
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['../tests/unit/**/*.test.ts', '../tests/integration/**/*.test.ts'],
    setupFiles: [resolve(__dirname, 'tests/setup.ts')],
    tsconfig: resolve(__dirname, 'tsconfig.test.json'),

    /**
     * Configuration de la couverture de code — TACHE-025 / TACHE-026.
     *
     * Périmètre : uniquement le code source TypeScript dans src/, avec exclusion
     * des modules non testables en environnement jsdom :
     *
     * Modules exclus du calcul de couverture (TACHE-026) :
     * - service-worker.ts   : entry point MV3 avec side-effects module-level
     *                         (chrome.runtime listeners, IIFE de boot). Testé
     *                         via des helpers extraits (boot-sequence.test.ts).
     * - pages/dashboard/    : page UI DOM-heavy, non testable sans browser réel.
     * - pages/onboarding/   : idem.
     * - pages/options/      : idem (1182 lignes de manipulation DOM).
     *
     * Ces exclusions sont documentées et justifiées. La couverture sur le périmètre
     * inclus (services, handlers, content-scripts, utils) atteint les seuils TACHE-026.
     *
     * Seuils activés (TACHE-026) :
     * - lines : 60% (seuil réaliste sur périmètre partiel — pages UI exclues)
     * - functions : 70%
     * - branches : 80%
     * - statements : 60%
     *
     * Note : les seuils 80% complets (TACHE-026 cible finale) nécessitent la couverture
     * des content-scripts password-detector.ts (18%) et paste-detector.ts (44%).
     * Ces tests seront produits dans la PR suivante (TACHE-017 à 024).
     */
    coverage: {
      // Fournisseur V8 natif Node.js — aucune instrumentation Babel requise
      provider: 'v8',
      // Rapports produits dans ./coverage/ (text=console, html=navigateur, json-summary=badge CI, lcov=SonarQube/Codecov)
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      // Répertoire de sortie relatif à la racine du projet (pas à src/)
      reportsDirectory: '../coverage',
      // Périmètre : uniquement le code source TypeScript dans src/
      // Chemins relatifs au root Vite (src/)
      include: ['**/*.ts'],
      exclude: [
        '**/*.d.ts',
        '**/*.test.ts',
        'assets/**',
        // Exclusions TACHE-026 — modules non testables en jsdom sans browser réel
        // service-worker.ts : entry point MV3 avec side-effects module-level (chrome.runtime)
        'background/service-worker.ts',
        // Pages UI DOM-heavy — manipulation DOM native sans abstraction testable
        'pages/dashboard/**',
        'pages/onboarding/**',
        'pages/options/**',
        'pages/whitelist/**',
      ],
      // -----------------------------------------------------------------------
      // TACHE-026 : seuils bloquants activés sur le périmètre couvert.
      // perFile: false = seuil global projet, pas par fichier individuel.
      //
      // Seuils conservateurs (60/70/80/60) car password-detector.ts (18%)
      // et paste-detector.ts (44%) tirent encore la moyenne.
      // Seuils 80% complets visés après TACHE-017 à 024.
      // -----------------------------------------------------------------------
      thresholds: {
        lines: 60,
        functions: 70,
        branches: 80,
        statements: 60,
        perFile: false,
      },
    },
  },
});
