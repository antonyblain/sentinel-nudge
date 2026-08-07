// @vitest-environment node
/**
 * @file tests/unit/pages/popup/popup-t199-css-body-transparent.test.ts
 * @description Régression T-199 — coins inférieurs popup arrondis.
 *
 * Directive @vitest-environment node : lecture de fichier CSS via fs/path Node natifs.
 * jsdom polyfille path et rendrait resolve() non fonctionnel.
 *
 * Problème : le body avait background-color: var(--sn-color-surface) (#ffffff en clair).
 * Comme #popup-root ne couvrait pas nécessairement toute la hauteur du body, le fond blanc
 * du body était visible sous #popup-root, masquant les coins inférieurs arrondis.
 *
 * Fix appliqué dans popup.css :
 *   - html          : height: 100%
 *   - body          : background: transparent  (plus de background-color surface)
 *   - body          : height: 100%
 *   - #popup-root   : min-height: 100%
 *
 * Ces tests vérifient que les règles CSS requises sont présentes dans popup.css.
 * Ils préviennent toute régression future (ex: retour accidentel du background-color).
 *
 * Référence : T-199 (BUG — coins inférieurs popup non arrondis)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// process.cwd() pointe vers la racine du projet (où est lancé npm run test, i.e. le worktree).
const cssPath = resolve(process.cwd(), 'src/pages/popup/popup.css');
const cssContent = readFileSync(cssPath, 'utf-8');

describe('T-199 — popup.css body transparent + popup-root min-height', () => {
  it('html doit avoir height: 100% (prerequis pour min-height: 100% sur #popup-root)', () => {
    // Cherche un bloc html { ... height: 100% ... }
    const htmlBlock = cssContent.match(/\bhtml\b\s*\{[^}]*height\s*:\s*100%[^}]*\}/s);
    expect(
      htmlBlock,
      'html { height: 100% } introuvable — requis pour que min-height: 100% sur #popup-root fonctionne',
    ).not.toBeNull();
  });

  it('body ne doit pas avoir background-color: var(--sn-color-surface) (cause du bug T-199)', () => {
    // On extrait le premier bloc body { ... }
    const bodyBlock = cssContent.match(/\bbody\b\s*\{([^}]*)\}/s);
    expect(bodyBlock, 'Bloc body { } introuvable dans popup.css').not.toBeNull();

    const bodyContent = bodyBlock![1];
    // La propriété incriminée ne doit plus être présente
    const hasBuggyBackground = /background-color\s*:\s*var\(\s*--sn-color-surface\s*\)/.test(
      bodyContent,
    );
    expect(
      hasBuggyBackground,
      'body contient background-color: var(--sn-color-surface) — cela masque les coins inférieurs arrondis de #popup-root (T-199)',
    ).toBe(false);
  });

  it('body doit avoir background: transparent', () => {
    const bodyBlock = cssContent.match(/\bbody\b\s*\{([^}]*)\}/s);
    expect(bodyBlock, 'Bloc body { } introuvable dans popup.css').not.toBeNull();

    const bodyContent = bodyBlock![1];
    const hasTransparent = /background\s*:\s*transparent/.test(bodyContent);
    expect(
      hasTransparent,
      'body doit avoir background: transparent pour que les coins arrondis de #popup-root soient visibles',
    ).toBe(true);
  });

  it('body doit avoir height: 100% (prerequis pour min-height: 100% sur #popup-root)', () => {
    const bodyBlock = cssContent.match(/\bbody\b\s*\{([^}]*)\}/s);
    expect(bodyBlock, 'Bloc body { } introuvable dans popup.css').not.toBeNull();

    const bodyContent = bodyBlock![1];
    const hasHeight = /\bheight\s*:\s*100%/.test(bodyContent);
    expect(
      hasHeight,
      'body doit avoir height: 100% pour que min-height: 100% sur #popup-root puisse couvrir toute la hauteur',
    ).toBe(true);
  });

  it('#popup-root doit avoir min-height: 100% pour couvrir tout le fond du body', () => {
    // Cherche le premier bloc #popup-root { ... }
    const rootBlock = cssContent.match(/#popup-root\s*\{([^}]*)\}/s);
    expect(rootBlock, 'Bloc #popup-root { } introuvable dans popup.css').not.toBeNull();

    const rootContent = rootBlock![1];
    const hasMinHeight = /min-height\s*:\s*100%/.test(rootContent);
    expect(
      hasMinHeight,
      '#popup-root doit avoir min-height: 100% pour couvrir tout le fond du body et rendre les 4 coins arrondis visibles',
    ).toBe(true);
  });
});
