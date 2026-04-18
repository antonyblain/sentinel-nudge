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
 * Elles sont déclarées dans web_accessible_resources du manifest pour être accessibles
 * via chrome.runtime.getURL() depuis le service worker et les pages de l'extension.
 *
 * Alias @/ → src/ pour éviter les chemins relatifs profonds dans les imports.
 */
export default defineConfig({
  root: resolve(__dirname, 'src'),
  plugins: [
    webExtension({
      manifest: resolve(__dirname, 'src/manifest.json'),
      additionalInputs: [
        'pages/dashboard/dashboard.html',
        'pages/onboarding/onboarding.html',
      ],
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
     * Configuration de la couverture de code — TACHE-025.
     *
     * Mode reporter-only : les rapports sont générés (text, html, lcov, json-summary)
     * mais les seuils NE BLOQUENT PAS la CI.
     *
     * Seuils cibles : lines 80 %, functions 80 %, branches 80 %, statements 80 %.
     * Couverture actuelle (2026-04-18) : ~36 % statements / ~67 % functions / ~80 % branches.
     * Les seuils seront activés en TACHE-026 une fois TACHE-017 à 024 closes.
     *
     * Pour activer les seuils bloquants (TACHE-026) : décommenter la section thresholds
     * ci-dessous et supprimer ce commentaire explicatif.
     *
     * Note sur les chemins : root Vite étant src/, les patterns include/exclude
     * de coverage sont résolus depuis src/. '**\/*.ts' = src/**\/*.ts.
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
      ],
      // -----------------------------------------------------------------------
      // TACHE-026 : décommenter les thresholds ci-dessous pour activer les seuils
      // bloquants une fois TACHE-017 à 024 closes (objectif 80 % couverture globale).
      // perFile: false = seuil global projet, pas par fichier individuel.
      // -----------------------------------------------------------------------
      // thresholds: {
      //   lines: 80,
      //   functions: 80,
      //   branches: 80,
      //   statements: 80,
      //   perFile: false,
      // },
    },
  },
});
