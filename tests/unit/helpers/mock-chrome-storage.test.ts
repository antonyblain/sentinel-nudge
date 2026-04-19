/**
 * @file tests/unit/helpers/mock-chrome-storage.test.ts
 * @description Tests unitaires du wrapper mock JSON-strict chrome.storage.local.
 *
 * Couvre (55 tests) :
 * - isJsonSafe : vérification unitaire de la fonction de validation
 * - JSON-strict : types interdits lèvent une TypeError immédiate (P-018)
 * - Types valides passent sans erreur
 * - Quota : dépassement lève QuotaExceededError, usage correct (P-020)
 * - get : keys string, string[], object (defaults), null (all)
 * - onChanged : déclenchement sur set/remove/clear, payload {oldValue, newValue}, addListener/removeListener
 * - SW kill : storage persistant conservé, listeners purgés (ADR-001 / ADR-002)
 * - Callbacks & Promises : les deux APIs marchent
 * - reset() : nettoyage complet
 *
 * Références : P-018, P-020, ADR-001, ADR-002, TACHE-060, TACHE-177
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockChromeStorage, isJsonSafe } from '../../helpers/mock-chrome-storage';

// ---------------------------------------------------------------------------
// Fixture partagée
// ---------------------------------------------------------------------------

let storage: ReturnType<typeof createMockChromeStorage>['storage'];
let simulateSWKill: ReturnType<typeof createMockChromeStorage>['simulateSWKill'];
let getQuotaUsage: ReturnType<typeof createMockChromeStorage>['getQuotaUsage'];
let reset: ReturnType<typeof createMockChromeStorage>['reset'];

beforeEach(() => {
  const mock = createMockChromeStorage();
  storage = mock.storage;
  simulateSWKill = mock.simulateSWKill;
  getQuotaUsage = mock.getQuotaUsage;
  reset = mock.reset;
});

// ---------------------------------------------------------------------------
// isJsonSafe — validation unitaire
// ---------------------------------------------------------------------------

describe('isJsonSafe()', () => {
  it('retourne true pour les types JSON natifs (string, number, boolean, null, array, plain object)', () => {
    expect(isJsonSafe('hello')).toBe(true);
    expect(isJsonSafe(42)).toBe(true);
    expect(isJsonSafe(3.14)).toBe(true);
    expect(isJsonSafe(true)).toBe(true);
    expect(isJsonSafe(false)).toBe(true);
    expect(isJsonSafe(null)).toBe(true);
    expect(isJsonSafe([1, 'two', true, null])).toBe(true);
    expect(isJsonSafe({ a: 1, b: 'deux', c: [true, null] })).toBe(true);
  });

  it('retourne false pour undefined', () => {
    expect(isJsonSafe(undefined)).toBe(false);
  });

  it('retourne false pour NaN et Infinity (non-finis)', () => {
    expect(isJsonSafe(NaN)).toBe(false);
    expect(isJsonSafe(Infinity)).toBe(false);
    expect(isJsonSafe(-Infinity)).toBe(false);
  });

  it('retourne false pour BigInt', () => {
    expect(isJsonSafe(BigInt(42))).toBe(false);
  });

  it('retourne false pour Symbol', () => {
    expect(isJsonSafe(Symbol('test'))).toBe(false);
  });

  it('retourne false pour function', () => {
    expect(isJsonSafe(() => {})).toBe(false);
    expect(isJsonSafe(function named() {})).toBe(false);
  });

  it('retourne false pour ArrayBuffer', () => {
    expect(isJsonSafe(new ArrayBuffer(8))).toBe(false);
  });

  it('retourne false pour Uint8Array et autres TypedArray', () => {
    expect(isJsonSafe(new Uint8Array([1, 2, 3]))).toBe(false);
    expect(isJsonSafe(new Int32Array([1, 2]))).toBe(false);
    expect(isJsonSafe(new Float64Array([1.1]))).toBe(false);
  });

  it('retourne false pour Map et Set', () => {
    expect(isJsonSafe(new Map([['a', 1]]))).toBe(false);
    expect(isJsonSafe(new Set([1, 2, 3]))).toBe(false);
  });

  it('retourne false pour Date', () => {
    expect(isJsonSafe(new Date())).toBe(false);
  });

  it('retourne false pour RegExp', () => {
    expect(isJsonSafe(/regex/gi)).toBe(false);
  });

  it('retourne false pour Error', () => {
    expect(isJsonSafe(new Error('oops'))).toBe(false);
  });

  it('retourne false pour CryptoKey (duck-typed)', () => {
    const fakeCryptoKey = {
      type: 'secret',
      algorithm: { name: 'AES-GCM', length: 256 },
      extractable: false,
      usages: ['encrypt', 'decrypt'],
    };
    expect(isJsonSafe(fakeCryptoKey)).toBe(false);
  });

  it('retourne false pour un objet imbriqué contenant un type non-JSON', () => {
    expect(isJsonSafe({ valid: 'ok', bad: new Uint8Array([0]) })).toBe(false);
    expect(isJsonSafe({ nested: { deeper: new ArrayBuffer(4) } })).toBe(false);
  });

  it('retourne false pour un tableau contenant un type non-JSON', () => {
    expect(isJsonSafe([1, 2, new Date()])).toBe(false);
    expect(isJsonSafe(['a', Symbol('x')])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// JSON-strict — set() lève TypeError sur types interdits
// ---------------------------------------------------------------------------

describe('storage.set() — JSON-strict (P-018)', () => {
  it('lève TypeError immédiate si la valeur est ArrayBuffer', async () => {
    await expect(storage.set({ key: new ArrayBuffer(8) })).rejects.toThrow(TypeError);
  });

  it('lève TypeError immédiate si la valeur est Uint8Array', async () => {
    await expect(storage.set({ key: new Uint8Array([1, 2, 3]) })).rejects.toThrow(TypeError);
  });

  it('lève TypeError immédiate si la valeur est Date', async () => {
    await expect(storage.set({ key: new Date() })).rejects.toThrow(TypeError);
  });

  it('lève TypeError immédiate si la valeur est Map', async () => {
    await expect(storage.set({ key: new Map() })).rejects.toThrow(TypeError);
  });

  it('lève TypeError immédiate si la valeur est une function', async () => {
    await expect(storage.set({ key: () => 42 })).rejects.toThrow(TypeError);
  });

  it('lève TypeError immédiate si la valeur est Symbol', async () => {
    await expect(
      storage.set({ key: Symbol('s') } as unknown as Record<string, unknown>),
    ).rejects.toThrow(TypeError);
  });

  it('lève TypeError immédiate si la valeur est BigInt', async () => {
    await expect(
      storage.set({ key: BigInt(99) } as unknown as Record<string, unknown>),
    ).rejects.toThrow(TypeError);
  });

  it('le message TypeError contient la clé et le type problématique', async () => {
    await expect(storage.set({ myKey: new ArrayBuffer(4) })).rejects.toThrow(/myKey/);
    await expect(storage.set({ myKey: new ArrayBuffer(4) })).rejects.toThrow(/ArrayBuffer/);
  });

  it('accepte les types JSON valides sans erreur', async () => {
    await expect(
      storage.set({
        str: 'hello',
        num: 42,
        bool: true,
        nul: null,
        arr: [1, 'two', false, null],
        obj: { nested: { value: 99 } },
      }),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Quota (P-020)
// ---------------------------------------------------------------------------

describe('Quota chrome.storage.local (P-020)', () => {
  it('getQuotaUsage retourne 0 sur un store vide', () => {
    expect(getQuotaUsage()).toBe(0);
  });

  it('getQuotaUsage augmente après un set', async () => {
    await storage.set({ key: 'valeur' });
    expect(getQuotaUsage()).toBeGreaterThan(0);
  });

  it('lève QuotaExceededError si le quota est dépassé', async () => {
    const tiny = createMockChromeStorage({ quotaBytes: 20 });
    // "key" (3) + JSON.stringify("valeur tres longue") > 20 octets = dépassement
    await expect(
      tiny.storage.set({ key: 'valeur suffisamment longue pour depasser le quota minimal' }),
    ).rejects.toMatchObject({ name: 'QuotaExceededError' });
  });

  it('le message QuotaExceededError contient les informations utiles', async () => {
    const tiny = createMockChromeStorage({ quotaBytes: 20 });
    await expect(tiny.storage.set({ key: 'valeur tres longue' })).rejects.toThrow(
      /QuotaExceededError/,
    );
  });

  it('getQuotaUsage diminue après remove', async () => {
    await storage.set({ a: 'hello', b: 'world' });
    const before = getQuotaUsage();
    await storage.remove('a');
    expect(getQuotaUsage()).toBeLessThan(before);
  });

  it('getQuotaUsage revient à 0 après clear', async () => {
    await storage.set({ a: 'x', b: 'y' });
    await storage.clear();
    expect(getQuotaUsage()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// storage.get() — modes de clés
// ---------------------------------------------------------------------------

describe('storage.get() — modes de clés', () => {
  beforeEach(async () => {
    await storage.set({ alpha: 'A', beta: 'B', gamma: 'C' });
  });

  it('get(string) retourne la valeur de la clé', async () => {
    const result = await storage.get('alpha');
    expect(result).toEqual({ alpha: 'A' });
  });

  it('get(string) retourne {} si la clé est absente', async () => {
    const result = await storage.get('absent');
    expect(result).toEqual({});
  });

  it('get(string[]) retourne les valeurs des clés demandées', async () => {
    const result = await storage.get(['alpha', 'gamma']);
    expect(result).toEqual({ alpha: 'A', gamma: 'C' });
  });

  it('get(string[]) ignore les clés absentes', async () => {
    const result = await storage.get(['alpha', 'inexistant']);
    expect(result).toEqual({ alpha: 'A' });
  });

  it('get(object) retourne la valeur stockée ou le défaut si absente', async () => {
    const result = await storage.get({ alpha: 'DEFAULT_A', delta: 'DEFAULT_D' });
    expect(result).toEqual({ alpha: 'A', delta: 'DEFAULT_D' });
  });

  it('get(null) retourne toutes les entrées', async () => {
    const result = await storage.get(null);
    expect(result).toEqual({ alpha: 'A', beta: 'B', gamma: 'C' });
  });
});

// ---------------------------------------------------------------------------
// onChanged — listeners
// ---------------------------------------------------------------------------

describe('storage.onChanged', () => {
  it("déclenche le listener avec {newValue} lors d'un set sur une nouvelle clé", async () => {
    const listener = vi.fn();
    storage.onChanged.addListener(listener);

    await storage.set({ foo: 'bar' });

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({
      foo: { oldValue: undefined, newValue: 'bar' },
    });
  });

  it("déclenche le listener avec {oldValue, newValue} lors d'un set sur une clé existante", async () => {
    await storage.set({ foo: 'old' });
    const listener = vi.fn();
    storage.onChanged.addListener(listener);

    await storage.set({ foo: 'new' });

    expect(listener).toHaveBeenCalledWith({
      foo: { oldValue: 'old', newValue: 'new' },
    });
  });

  it("déclenche le listener avec {oldValue} lors d'un remove", async () => {
    await storage.set({ foo: 'bar' });
    const listener = vi.fn();
    storage.onChanged.addListener(listener);

    await storage.remove('foo');

    expect(listener).toHaveBeenCalledWith({
      foo: { oldValue: 'bar', newValue: undefined },
    });
  });

  it("déclenche le listener pour chaque clé lors d'un clear", async () => {
    await storage.set({ a: 1, b: 2 });
    const listener = vi.fn();
    storage.onChanged.addListener(listener);

    await storage.clear();

    const call = listener.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(call)).toContain('a');
    expect(Object.keys(call)).toContain('b');
  });

  it('removeListener empêche les appels ultérieurs', async () => {
    const listener = vi.fn();
    storage.onChanged.addListener(listener);
    storage.onChanged.removeListener(listener);

    await storage.set({ x: 1 });

    expect(listener).not.toHaveBeenCalled();
  });

  it('plusieurs listeners sont tous notifiés', async () => {
    const l1 = vi.fn();
    const l2 = vi.fn();
    storage.onChanged.addListener(l1);
    storage.onChanged.addListener(l2);

    await storage.set({ k: 'v' });

    expect(l1).toHaveBeenCalledOnce();
    expect(l2).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Cycle de vie Service Worker — simulateSWKill() (ADR-001 / ADR-002)
// ---------------------------------------------------------------------------

describe('simulateSWKill() — cycle de vie SW', () => {
  it('les données persistantes survivent au kill SW', async () => {
    await storage.set({ persistent: 'survives' });

    simulateSWKill();

    const result = await storage.get('persistent');
    expect(result).toEqual({ persistent: 'survives' });
  });

  it('les listeners onChanged sont purgés après simulateSWKill', async () => {
    const listener = vi.fn();
    storage.onChanged.addListener(listener);

    simulateSWKill();

    // Après kill, un nouveau set ne doit pas appeler l'ancien listener
    await storage.set({ k: 'v' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('les _inMemoryFlags sont purgés après simulateSWKill', () => {
    storage._inMemoryFlags['flag1'] = true;
    storage._inMemoryFlags['counter'] = 42;

    simulateSWKill();

    expect(Object.keys(storage._inMemoryFlags)).toHaveLength(0);
  });

  it('le storage reste fonctionnel après simulateSWKill (set + get)', async () => {
    await storage.set({ before: 'kill' });
    simulateSWKill();

    await storage.set({ after: 'reboot' });
    const result = await storage.get(null);

    expect(result).toEqual({ before: 'kill', after: 'reboot' });
  });
});

// ---------------------------------------------------------------------------
// API Callbacks vs Promises
// ---------------------------------------------------------------------------

describe('API duale : Callbacks et Promises', () => {
  it('storage.set() fonctionne en style callback', () => {
    // Les méthodes du storage sont async et appellent le callback avant de résoudre.
    // On enveloppe dans une Promise pour éviter le done() déprécié dans Vitest 2.
    return new Promise<void>((resolve, reject) => {
      storage
        .set({ cb_key: 'cb_value' }, () => {
          storage
            .get('cb_key', (result) => {
              try {
                expect(result).toEqual({ cb_key: 'cb_value' });
                resolve();
              } catch (e) {
                reject(e);
              }
            })
            .catch(reject);
        })
        .catch(reject);
    });
  });

  it('storage.set() fonctionne en style Promise', async () => {
    await storage.set({ promise_key: 'promise_value' });
    const result = await storage.get('promise_key');
    expect(result).toEqual({ promise_key: 'promise_value' });
  });

  it('storage.remove() fonctionne en style callback', () => {
    return new Promise<void>((resolve, reject) => {
      storage
        .set({ to_remove: 'val' }, () => {
          storage
            .remove('to_remove', () => {
              storage
                .get('to_remove', (result) => {
                  try {
                    expect(result).toEqual({});
                    resolve();
                  } catch (e) {
                    reject(e);
                  }
                })
                .catch(reject);
            })
            .catch(reject);
        })
        .catch(reject);
    });
  });

  it('storage.remove() fonctionne en style Promise', async () => {
    await storage.set({ to_remove_p: 'val' });
    await storage.remove('to_remove_p');
    const result = await storage.get('to_remove_p');
    expect(result).toEqual({});
  });

  it('storage.clear() fonctionne en style callback', () => {
    return new Promise<void>((resolve, reject) => {
      storage
        .set({ a: 1, b: 2 }, () => {
          storage
            .clear(() => {
              storage
                .get(null, (result) => {
                  try {
                    expect(result).toEqual({});
                    resolve();
                  } catch (e) {
                    reject(e);
                  }
                })
                .catch(reject);
            })
            .catch(reject);
        })
        .catch(reject);
    });
  });

  it('storage.clear() fonctionne en style Promise', async () => {
    await storage.set({ a: 1, b: 2 });
    await storage.clear();
    const result = await storage.get(null);
    expect(result).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// reset()
// ---------------------------------------------------------------------------

describe('reset()', () => {
  it('vide le store persistant', async () => {
    await storage.set({ key: 'val' });
    reset();
    const result = await storage.get(null);
    expect(result).toEqual({});
  });

  it('vide les listeners', async () => {
    const listener = vi.fn();
    storage.onChanged.addListener(listener);
    reset();
    await storage.set({ k: 'v' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('remet le quota usage à 0', async () => {
    await storage.set({ large: 'x'.repeat(100) });
    reset();
    expect(getQuotaUsage()).toBe(0);
  });
});
