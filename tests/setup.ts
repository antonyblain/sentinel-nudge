/**
 * @file tests/setup.ts
 * @description Setup global Vitest — polyfill SubtleCrypto pour jsdom.
 *
 * jsdom ne fournit pas crypto.subtle (Web Crypto API).
 * Node.js 18+ expose le module 'crypto' avec webcrypto qui est compatible.
 * Ce setup injecte crypto.subtle dans globalThis pour que les tests
 * CryptoService fonctionnent dans l'environnement jsdom.
 *
 * Référence : P-012 (PROBLEMES.md)
 */

import { webcrypto } from 'node:crypto';

if (!globalThis.crypto?.subtle) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).crypto = webcrypto;
}
