import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';
import { resolve } from 'path';

/**
 * Configuration Vite pour Sentinel Nudge — Extension Chrome MV3.
 *
 * Le plugin vite-plugin-web-extension lit le manifest.json comme source de vérité
 * et génère automatiquement les entry points (Service Worker, pages UI, content scripts).
 *
 * Alias @/ → src/ pour éviter les chemins relatifs profonds dans les imports.
 */
export default defineConfig({
  root: resolve(__dirname, 'src'),
  plugins: [
    webExtension({
      manifest: resolve(__dirname, 'src/manifest.json'),
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
    tsconfig: resolve(__dirname, 'tsconfig.test.json'),
  },
});
