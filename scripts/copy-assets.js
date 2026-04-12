/**
 * @file scripts/copy-assets.js
 * @description Copie les assets statiques dans dist/ après le build Vite.
 *
 * Vite + vite-plugin-web-extension ne copient que les fichiers référencés
 * dans le manifest ou les entry points. Les assets statiques (icônes,
 * _locales, data JSON, pages HTML statiques) doivent être copiés manuellement.
 */

import { cpSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, '..', 'src');
const dist = resolve(__dirname, '..', 'dist');

const copies = [
  { from: 'assets/icons', to: 'assets/icons' },
  { from: 'assets/_locales', to: '_locales' },
  { from: 'assets/data', to: 'assets/data' },
  { from: 'pages/static', to: 'pages/static' },
];

for (const { from, to } of copies) {
  const srcPath = resolve(src, from);
  const distPath = resolve(dist, to);

  if (!existsSync(srcPath)) {
    console.warn(`[copy-assets] Source introuvable : ${srcPath}`);
    continue;
  }

  mkdirSync(dirname(distPath), { recursive: true });
  cpSync(srcPath, distPath, { recursive: true });
  console.log(`[copy-assets] ${from} → ${to}`);
}

console.log('[copy-assets] Copie terminée.');
