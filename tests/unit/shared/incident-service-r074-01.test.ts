/**
 * @file tests/unit/shared/incident-service-r074-01.test.ts
 * @description Tests unitaires T-158 — Réserve DPO R-074-01 (bloquant MEP v1.0).
 *
 * Valide l'assertion runtime assertNoDomainHashInContext() dans IncidentService.log().
 * Engagement formel d'absence de champs sensibles dans le registre m7_incidents.
 *
 * Champs interdits testés (INV-SEC-04b) :
 * - domain_hash (clé)
 * - password_hash (clé)
 * - installation_salt (clé)
 * - Valeur string matchant SHA-256 hex 64 chars
 * - Valeur string contenant une URL complète http/https
 *
 * Référence : R-074-01, T-158, INV-SEC-04b (mini-DAT TACHE-061 §11.3)
 *             Art. 5.1.c RGPD (minimisation des données)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  IncidentService,
  assertNoDomainHashInContext,
} from '@/background/services/incident-service';
import type { M7IncidentRecord, M7IncidentSeverity } from '@/shared/types/diagnostics';

// ---------------------------------------------------------------------------
// Fake IDBDatabase (inline minimal — réutilise le pattern de incident-service.test.ts)
// ---------------------------------------------------------------------------

class FakeStore {
  private records: M7IncidentRecord[] = [];
  private nextId = 1;

  add(record: M7IncidentRecord) {
    const id = this.nextId++;
    this.records.push({ ...record, id });
    const req = {
      onsuccess: null as ((e: { target: { result: number } }) => void) | null,
      onerror: null,
      result: id,
    };
    queueMicrotask(() => req.onsuccess?.({ target: { result: id } }));
    return req;
  }

  count() {
    const n = this.records.length;
    const req = {
      onsuccess: null as ((e: Event) => void) | null,
      onerror: null,
      result: n,
    };
    queueMicrotask(() => req.onsuccess?.({} as Event));
    return req;
  }

  index(_name: string) {
    return {
      openCursor: (_range: unknown, _dir: string) => {
        const req = {
          onsuccess: null as ((e: Event) => void) | null,
          onerror: null,
          result: null as null,
        };
        queueMicrotask(() => req.onsuccess?.({} as Event));
        return req;
      },
    };
  }

  getCount() {
    return this.records.length;
  }

  getRecords() {
    return [...this.records];
  }
}

function makeDB(store: FakeStore): IDBDatabase {
  return {
    transaction: (_name: string, _mode: string) => ({
      objectStore: () => store,
      onerror: null,
    }),
  } as unknown as IDBDatabase;
}

// ---------------------------------------------------------------------------
// Tests unitaires de assertNoDomainHashInContext (fonction exportée)
// ---------------------------------------------------------------------------

describe('assertNoDomainHashInContext (T-158 R-074-01)', () => {
  it('TC-R074-01-01 : context avec clé domain_hash → throw', () => {
    const ctx = {
      type: 'boot_fail' as const,
      hint: 'key_absent' as const,
      boot_count: 1,
      // Injection interdite — simulée via cast
      domain_hash: 'a'.repeat(64),
    };
    expect(() => assertNoDomainHashInContext(ctx as unknown)).toThrowError(
      "INV-SEC-04 violation: forbidden field in IncidentContext (key 'domain_hash' is not allowed)",
    );
  });

  it('TC-R074-01-02 : context avec valeur SHA-256 hex 64 chars (dans un champ quelconque) → throw', () => {
    // 64 chars hex : simule un hash SHA-256 brut stocké dans un champ arbitraire
    const sha256 = 'a1b2c3d4'.repeat(8); // 64 chars hex
    const ctx = { type: 'idb_write_fail' as const, store: sha256 };
    expect(() => assertNoDomainHashInContext(ctx as unknown)).toThrowError(
      /INV-SEC-04 violation.*SHA-256 hex/,
    );
  });

  it('TC-R074-01-03 : context avec clé password_hash → throw', () => {
    const ctx = {
      type: 'boot_fail' as const,
      hint: 'key_absent' as const,
      boot_count: 1,
      password_hash: 'some_hashed_password',
    };
    expect(() => assertNoDomainHashInContext(ctx as unknown)).toThrowError(
      "INV-SEC-04 violation: forbidden field in IncidentContext (key 'password_hash' is not allowed)",
    );
  });

  it('TC-R074-01-04 : context avec clé installation_salt → throw', () => {
    const ctx = {
      type: 'boot_fail' as const,
      hint: 'key_absent' as const,
      boot_count: 1,
      installation_salt: 'deadbeef'.repeat(4), // 32 chars hex
    };
    expect(() => assertNoDomainHashInContext(ctx as unknown)).toThrowError(
      "INV-SEC-04 violation: forbidden field in IncidentContext (key 'installation_salt' is not allowed)",
    );
  });

  it('TC-R074-01-05 : context avec URL complète https://example.com/login → throw', () => {
    const ctx = {
      type: 'submit_detect_fail' as const,
      code_path: 'https://example.com/login?user=test',
    };
    expect(() => assertNoDomainHashInContext(ctx as unknown)).toThrowError(
      /INV-SEC-04 violation.*URL/,
    );
  });

  it('TC-R074-01-06 : context légitime {type: boot_fail, hint: key_absent} → pas de throw', () => {
    const ctx = {
      type: 'boot_fail' as const,
      hint: 'key_absent' as const,
      boot_count: 3,
    };
    expect(() => assertNoDomainHashInContext(ctx)).not.toThrow();
  });

  it('TC-R074-01-07 : context vide {} → pas de throw', () => {
    expect(() => assertNoDomainHashInContext({})).not.toThrow();
  });

  it('TC-R074-01-08 : context avec domain_hash_prefix (tronqué) → pas de throw (whitelisté)', () => {
    // domain_hash_prefix est autorisé : c'est un préfixe 8 chars non-sensible
    const ctx = {
      type: 'toast_orphan' as const,
      domain_hash_prefix: 'abcd1234',
      age_ms: 5000,
    };
    expect(() => assertNoDomainHashInContext(ctx)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Tests d'intégration : assertNoDomainHashInContext appelé depuis log()
// ---------------------------------------------------------------------------

describe('IncidentService.log() — assertion R-074-01 (T-158)', () => {
  let service: IncidentService;
  let fakeStore: FakeStore;
  let fakeDb: IDBDatabase;

  beforeEach(async () => {
    vi.clearAllMocks();
    fakeStore = new FakeStore();
    fakeDb = makeDB(fakeStore);
    service = new IncidentService();
    await service.initService(fakeDb);
  });

  it('TC-R074-01-INT-01 : log() avec context contenant domain_hash → throw avant insertion', async () => {
    const badContext = {
      type: 'boot_fail' as const,
      hint: 'key_absent' as const,
      boot_count: 1,
      domain_hash: 'f'.repeat(64),
    };
    await expect(
      service.log(
        'boot_fail',
        'error',
        badContext as unknown as Parameters<IncidentService['log']>[2],
      ),
    ).rejects.toThrowError(/INV-SEC-04 violation/);
    // Aucune entrée insérée
    expect(fakeStore.getCount()).toBe(0);
  });

  it('TC-R074-01-INT-02 : log() avec context légitime → insertion réussie sans throw', async () => {
    await expect(
      service.log('boot_fail', 'error', {
        type: 'boot_fail',
        hint: 'key_absent',
        boot_count: 1,
      }),
    ).resolves.not.toThrow();
    expect(fakeStore.getCount()).toBe(1);
  });

  it('TC-R074-01-INT-03 : log() avec URL dans code_path → throw avant insertion', async () => {
    const badContext = {
      type: 'submit_detect_fail' as const,
      code_path: 'https://evil.com/exfiltrate',
    };
    await expect(
      service.log(
        'submit_detect_fail',
        'error',
        badContext as unknown as Parameters<IncidentService['log']>[2],
      ),
    ).rejects.toThrowError(/INV-SEC-04 violation.*URL/);
    expect(fakeStore.getCount()).toBe(0);
  });
});
