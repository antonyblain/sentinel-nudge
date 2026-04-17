/**
 * @file tests/setup.ts
 * @description Setup global Vitest — polyfill SubtleCrypto pour jsdom.
 *
 * jsdom ne fournit pas crypto.subtle (Web Crypto API).
 * Node.js 18+ expose le module 'crypto' avec webcrypto qui est compatible.
 * Ce setup injecte crypto.subtle dans globalThis pour que les tests
 * CryptoService fonctionnent dans l'environnement jsdom.
 *
 * IMPORTANT — Node 20 vs Node 24 (correctif P-021) :
 * jsdom expose `window.crypto` comme un getter sans setter (configurable: true).
 * Sur Node 20, l'assignation directe `(globalThis as any).crypto = webcrypto` échoue
 * silencieusement en mode non-strict car la propriété n'a pas de setter.
 * Sur Node 24, le comportement est différent (Node 24 expose nativement globalThis.crypto
 * dans le contexte VM avant que jsdom ne prenne le dessus).
 * La correction utilise Object.defineProperty pour contourner l'absence de setter.
 *
 * Référence : P-012 (PROBLEMES.md), P-021 (correctif Node 20 CI)
 */

import { webcrypto } from 'node:crypto';

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
    writable: true,
  });
}
