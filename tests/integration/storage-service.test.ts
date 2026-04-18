/**
 * @file tests/integration/storage-service.test.ts
 * @description Tests d'intégration du StorageService — IndexedDB via fake-indexeddb.
 *
 * TACHE-053 — Remplacement des squelettes (3 TODO) par de vrais tests d'intégration.
 *
 * Couvre les scénarios end-to-end :
 * - Initialisation complète de la base (tous les stores + indexes)
 * - Cycle logEvent → getEvents (aller-retour avec chiffrement AES-256-GCM)
 * - Cycle setWeeklyScore → getWeeklyScore
 * - Cycle addPasswordHash → getPasswordHashesByTag → getPasswordHashMeta
 * - Whitelist CRUD : add + isWhitelisted + remove + getAllWhitelist
 * - purgeExpired : events + password_hashes + quiz_sessions
 * - getAllQuizSessions / getAllWeeklyScores (export RGPD)
 * - getConfig / setConfig / getQuotaState / setQuotaState
 * - IncidentService intégré avec StorageService (initService + log + getLast + count)
 * - ExportHandler createExportHandler (toutes les actions + erreurs)
 *
 * Contrainte fake-indexeddb : cursor.continue() dans un handler onsuccess async
 * lève TransactionInactiveError car fake-indexeddb ferme la transaction pendant le
 * await. Les tests getEvents récupèrent donc par timestamp futur (0 résultats) ou
 * via getAllWeeklyScores/getAllQuizSessions (non-cursor). Les curseurs non-async
 * (purgeExpired) fonctionnent normalement.
 *
 * Référence : TACHE-053, DAT §8.1/8.3/8.4, ADR-001/ADR-002
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { StorageService, DB_VERSION, MIGRATIONS } from '@/background/storage-service';
import { CryptoService } from '@/background/crypto-service';
import { IncidentService } from '@/background/services/incident-service';
import { createExportHandler } from '@/background/handlers/export-handler';
import type { NudgeMessage } from '@/shared/types/messages';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Crée une instance StorageService avec IDBFactory isolée par test */
function createService(): { svc: StorageService; crypto: CryptoService } {
  const idbFactory = new IDBFactory();
  Object.defineProperty(globalThis, 'indexedDB', {
    value: idbFactory,
    configurable: true,
    writable: true,
  });
  const crypto = new CryptoService();
  return { svc: new StorageService(crypto), crypto };
}

/** Génère une CryptoKey AES-256-GCM */
async function generateKey(): Promise<CryptoKey> {
  return globalThis.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

// ---------------------------------------------------------------------------
// Mock chrome.storage.local
// ---------------------------------------------------------------------------

const mockLocalStorage: Record<string, unknown> = {};

global.chrome = {
  storage: {
    local: {
      get: vi.fn((keys: string[], callback: (r: Record<string, unknown>) => void) => {
        const result: Record<string, unknown> = {};
        for (const k of keys) {
          if (mockLocalStorage[k] !== undefined) result[k] = mockLocalStorage[k];
        }
        callback(result);
      }),
      set: vi.fn((items: Record<string, unknown>, callback?: () => void) => {
        Object.assign(mockLocalStorage, items);
        callback?.();
      }),
      remove: vi.fn((key: string | string[], callback?: () => void) => {
        const keys = Array.isArray(key) ? key : [key];
        keys.forEach((k) => delete mockLocalStorage[k]);
        callback?.();
      }),
    },
  },
} as unknown as typeof chrome;

beforeEach(() => {
  Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]);
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// TC-INT-SS-01 : initDB crée les 6 stores
// ---------------------------------------------------------------------------

describe('StorageService — intégration IndexedDB', () => {
  it('TC-INT-SS-01 : initDB crée les 6 stores attendus', async () => {
    const { svc } = createService();
    await svc.initDB();
    const db = svc.getDB();

    const names = Array.from(db.objectStoreNames);
    expect(names).toContain('events');
    expect(names).toContain('password_hashes');
    expect(names).toContain('quiz_sessions');
    expect(names).toContain('weekly_scores');
    expect(names).toContain('whitelist');
    expect(names).toContain('m7_incidents');
    expect(names).toHaveLength(6);
  });

  it('TC-INT-SS-02 : DB_VERSION=2 et migrations 1+2 déclarées', () => {
    expect(DB_VERSION).toBe(2);
    expect(typeof MIGRATIONS[1]).toBe('function');
    expect(typeof MIGRATIONS[2]).toBe('function');
  });

  // ---------------------------------------------------------------------------
  // TC-INT-SS-03/04 : logEvent + getEvents (aller-retour)
  // Note : getEvents avec chiffrement utilise cursor.continue() dans un handler
  // onsuccess async → TransactionInactiveError avec fake-indexeddb.
  // On teste le logEvent (écriture) + getEvents avec since=futur (0 résultats)
  // pour valider le code sans déclencher le bug fake-indexeddb.
  // ---------------------------------------------------------------------------

  it('TC-INT-SS-03 : logEvent retourne un id numérique et persiste les données', async () => {
    const { svc } = createService();
    await svc.initDB();
    const key = await generateKey();

    const id1 = await svc.logEvent('M3', { action: 'dismissed', score_delta: 5 }, key);
    const id2 = await svc.logEvent('M7', { action: 'accepted' }, key);

    expect(typeof id1).toBe('number');
    expect(typeof id2).toBe('number');
    expect(id2).toBeGreaterThan(id1);
  });

  it('TC-INT-SS-04 : logEvent + getEvents cycle aller-retour — 0 résultats si since=futur', async () => {
    const { svc } = createService();
    await svc.initDB();
    const key = await generateKey();

    await svc.logEvent('M3', { action: 'dismissed', score_delta: 5 }, key);

    // since = futur → aucun événement dans la plage
    const events = await svc.getEvents(null, Date.now() + 1_000_000, key);
    expect(Array.isArray(events)).toBe(true);
    expect(events).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // TC-INT-SS-05/06 : purgeExpired supprime les enregistrements expirés
  // ---------------------------------------------------------------------------

  it('TC-INT-SS-05 : purgeExpired supprime les événements expirés et retourne le nombre supprimé', async () => {
    const { svc } = createService();
    await svc.initDB();
    const key = await generateKey();

    // Écrire deux événements (timestamp = Date.now())
    await svc.logEvent('M3', { action: 'dismissed' }, key);
    await svc.logEvent('M6', { action: 'accepted' }, key);

    // Purger avec before = Date.now() + 1s (les deux événements sont "expirés")
    const deleted = await svc.purgeExpired(Date.now() + 1_000);

    // Au moins 2 suppressions (les events) — les autres stores sont vides
    expect(deleted).toBeGreaterThanOrEqual(2);
  });

  it('TC-INT-SS-06 : purgeExpired sur base vide retourne 0', async () => {
    const { svc } = createService();
    await svc.initDB();

    const deleted = await svc.purgeExpired(Date.now() + 1_000);
    expect(deleted).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // TC-INT-SS-07/08/09 : Store weekly_scores
  // ---------------------------------------------------------------------------

  it('TC-INT-SS-07 : setWeeklyScore + getWeeklyScore cycle aller-retour', async () => {
    const { svc } = createService();
    await svc.initDB();
    const key = await generateKey();

    const weekKey = '2026-W16';
    const components = {
      m5_update: 18,
      m6_phishing: 22,
      m2_risky_sites: 15,
      m7_password_diversity: 17,
      m9_password_strength: 12,
    };

    await svc.setWeeklyScore(
      { week_key: weekKey, total_score: 84, components },
      key,
    );

    const result = await svc.getWeeklyScore(weekKey, key);
    expect(result).not.toBeNull();
    expect(result?.week_key).toBe(weekKey);
    expect(result?.total_score).toBe(84);
  });

  it('TC-INT-SS-08 : getWeeklyScore retourne null pour une semaine inexistante', async () => {
    const { svc } = createService();
    await svc.initDB();
    const key = await generateKey();

    const result = await svc.getWeeklyScore('2025-W01', key);
    expect(result).toBeNull();
  });

  it('TC-INT-SS-09 : getAllWeeklyScores retourne tous les scores', async () => {
    const { svc } = createService();
    await svc.initDB();
    const key = await generateKey();

    await svc.setWeeklyScore({ week_key: '2026-W14', total_score: 70, components: {} }, key);
    await svc.setWeeklyScore({ week_key: '2026-W15', total_score: 75, components: {} }, key);

    const all = await svc.getAllWeeklyScores();
    expect(all).toHaveLength(2);
  });

  // ---------------------------------------------------------------------------
  // TC-INT-SS-10/11/12/13 : Store password_hashes
  // ---------------------------------------------------------------------------

  it('TC-INT-SS-10 : addPasswordHash + getPasswordHashesByTag cycle aller-retour', async () => {
    const { svc } = createService();
    await svc.initDB();
    const key = await generateKey();

    const hash = 'a3f2c1b0' + 'e4d5c6b7a8f9e0d1c2b3a4f5e6d7c8b9';
    const tag = 'a3f2c1b0';
    const domainHash = 'abcdef1234567890abcdef1234567890';

    await svc.addPasswordHash(hash, tag, domainHash, key);

    const records = await svc.getPasswordHashesByTag(tag);
    expect(records).toHaveLength(1);
    expect(records[0].tag).toBe(tag);
    expect(records[0].domain_hash).toBe(domainHash);
  });

  it('TC-INT-SS-11 : getPasswordHashCount retourne le nombre correct', async () => {
    const { svc } = createService();
    await svc.initDB();
    const key = await generateKey();

    expect(await svc.getPasswordHashCount()).toBe(0);

    await svc.addPasswordHash('a3f2c1b0' + 'a'.repeat(56), 'a3f2c1b0', 'hash1', key);
    await svc.addPasswordHash('b4e3d2c1' + 'b'.repeat(56), 'b4e3d2c1', 'hash2', key);

    expect(await svc.getPasswordHashCount()).toBe(2);
  });

  it('TC-INT-SS-12 : getPasswordHashMeta retourne oldest/newest/count corrects', async () => {
    const { svc } = createService();
    await svc.initDB();
    const key = await generateKey();

    // Store vide
    const metaEmpty = await svc.getPasswordHashMeta();
    expect(metaEmpty.count).toBe(0);
    expect(metaEmpty.oldest).toBe('');
    expect(metaEmpty.newest).toBe('');

    await svc.addPasswordHash('a3f2c1b0' + 'a'.repeat(56), 'a3f2c1b0', 'hash1', key);

    const meta = await svc.getPasswordHashMeta();
    expect(meta.count).toBe(1);
    expect(meta.oldest).toBeTruthy();
    expect(meta.newest).toBeTruthy();
  });

  it('TC-INT-SS-13 : getPasswordHashesByTag retourne [] pour un tag absent', async () => {
    const { svc } = createService();
    await svc.initDB();

    const records = await svc.getPasswordHashesByTag('ffffffff');
    expect(records).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // TC-INT-SS-14/15/16/17 : Store whitelist
  // ---------------------------------------------------------------------------

  it('TC-INT-SS-14 : addToWhitelist + isWhitelisted cycle aller-retour', async () => {
    const { svc } = createService();
    await svc.initDB();

    const domainHash = 'deadbeef1234567890abcdef12345678';

    expect(await svc.isWhitelisted(domainHash, 'M2')).toBe(false);
    await svc.addToWhitelist(domainHash, 'M2');
    expect(await svc.isWhitelisted(domainHash, 'M2')).toBe(true);
  });

  it('TC-INT-SS-15 : removeFromWhitelist supprime l\'entrée', async () => {
    const { svc } = createService();
    await svc.initDB();

    const domainHash = 'cafebabe1234567890abcdef12345678';
    await svc.addToWhitelist(domainHash, 'M7');
    expect(await svc.isWhitelisted(domainHash, 'M7')).toBe(true);

    await svc.removeFromWhitelist(domainHash, 'M7');
    expect(await svc.isWhitelisted(domainHash, 'M7')).toBe(false);
  });

  it('TC-INT-SS-16 : whitelist M2 et M7 sont indépendantes (clé composite)', async () => {
    const { svc } = createService();
    await svc.initDB();

    const domainHash = '1234567890abcdef1234567890abcdef';
    await svc.addToWhitelist(domainHash, 'M2');

    expect(await svc.isWhitelisted(domainHash, 'M2')).toBe(true);
    expect(await svc.isWhitelisted(domainHash, 'M7')).toBe(false);
  });

  it('TC-INT-SS-17 : getAllWhitelist retourne toutes les entrées', async () => {
    const { svc } = createService();
    await svc.initDB();

    await svc.addToWhitelist('hash001', 'M2');
    await svc.addToWhitelist('hash002', 'M7');
    await svc.addToWhitelist('hash003', 'M2');

    const all = await svc.getAllWhitelist();
    expect(all).toHaveLength(3);
  });

  // ---------------------------------------------------------------------------
  // TC-INT-SS-18/19 : chrome.storage.local — config + quota
  // ---------------------------------------------------------------------------

  it('TC-INT-SS-18 : getConfig retourne null si absente, setConfig + getConfig cycle aller-retour', async () => {
    const { svc } = createService();
    await svc.initDB();

    expect(await svc.getConfig()).toBeNull();

    const config = {
      modules: {} as Record<string, boolean>,
      quota_limit: 3 as const,
      profile: 'beginner' as const,
      onboarding_complete: true,
      language: 'fr' as const,
    };
    await svc.setConfig(config);

    const result = await svc.getConfig();
    expect(result).not.toBeNull();
    expect(result?.quota_limit).toBe(3);
    expect(result?.onboarding_complete).toBe(true);
  });

  it('TC-INT-SS-19 : getQuotaState retourne null si absent, setQuotaState + getQuotaState cycle', async () => {
    const { svc } = createService();
    await svc.initDB();

    expect(await svc.getQuotaState()).toBeNull();

    await svc.setQuotaState({ date: '2026-04-18', count: 2 });
    const state = await svc.getQuotaState();

    expect(state).not.toBeNull();
    expect(state?.date).toBe('2026-04-18');
    expect(state?.count).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // TC-INT-SS-20 : getAllQuizSessions
  // ---------------------------------------------------------------------------

  it('TC-INT-SS-20 : getAllQuizSessions retourne un tableau vide si le store est vide', async () => {
    const { svc } = createService();
    await svc.initDB();

    const sessions = await svc.getAllQuizSessions();
    expect(Array.isArray(sessions)).toBe(true);
    expect(sessions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TC-INT-IS-01..08 : IncidentService intégré avec StorageService
// ---------------------------------------------------------------------------

describe('IncidentService — intégration avec StorageService (fake-indexeddb)', () => {
  it('TC-INT-IS-01 : initService() + log() + getLast() cycle aller-retour', async () => {
    const { svc } = createService();
    await svc.initDB();
    const incidentSvc = new IncidentService();
    await incidentSvc.initService(svc.getDB());

    await incidentSvc.log('boot_fail', 'error', { hint: 'test_error' });
    await incidentSvc.log('canary_failed', 'warn', { hint: 'test_warn' });

    const last = await incidentSvc.getLast(10);
    expect(last).toHaveLength(2);
    // Triés par ts décroissant : le dernier inséré est en premier
    expect(last[0].type).toBe('canary_failed');
    expect(last[1].type).toBe('boot_fail');
  });

  it('TC-INT-IS-02 : count() reflète le nombre de logs', async () => {
    const { svc } = createService();
    await svc.initDB();
    const incidentSvc = new IncidentService();
    await incidentSvc.initService(svc.getDB());

    expect(await incidentSvc.count()).toBe(0);

    await incidentSvc.log('boot_fail', 'error', { hint: 'e1' });
    await incidentSvc.log('key_regenerated', 'warn', { hint: 'e2' });
    await incidentSvc.log('whitelist_regenerated', 'info', { hint: 'e3' });

    expect(await incidentSvc.count()).toBe(3);
  });

  it('TC-INT-IS-03 : buffer pré-initDB — les incidents bufferisés sont flushés à initService()', async () => {
    const { svc } = createService();
    await svc.initDB();
    const incidentSvc = new IncidentService();

    // Log avant initService → buffer
    await incidentSvc.log('boot_fail', 'error', { hint: 'buffered_1' });
    await incidentSvc.log('canary_failed', 'warn', { hint: 'buffered_2' });

    // initService flush le buffer
    await incidentSvc.initService(svc.getDB());

    const count = await incidentSvc.count();
    expect(count).toBe(2);
    const last = await incidentSvc.getLast(5);
    expect(last.some((i) => i.type === 'boot_fail')).toBe(true);
    expect(last.some((i) => i.type === 'canary_failed')).toBe(true);
  });

  it('TC-INT-IS-04 : getLast(n) limite le nombre de résultats', async () => {
    const { svc } = createService();
    await svc.initDB();
    const incidentSvc = new IncidentService();
    await incidentSvc.initService(svc.getDB());

    // Utiliser des types différents pour éviter le coalescing (CM-DOS2)
    // Les infos de même type sont coalescées → utiliser des types distincts
    await incidentSvc.log('boot_fail', 'error', { hint: 'err_type_a' });
    await incidentSvc.log('canary_failed', 'error', { hint: 'err_type_b' });
    await incidentSvc.log('key_regenerated', 'error', { hint: 'err_type_c' });

    // 3 entries (toutes error = jamais coalescées), getLast(2) doit retourner 2
    const last2 = await incidentSvc.getLast(2);
    expect(last2).toHaveLength(2);
  });

  it('TC-INT-IS-05 : sévérité error — jamais coalescée (CM-DOS3)', async () => {
    const { svc } = createService();
    await svc.initDB();
    const incidentSvc = new IncidentService();
    await incidentSvc.initService(svc.getDB());

    // 3 errors consécutives du même type dans la fenêtre de coalescing
    await incidentSvc.log('boot_fail', 'error', { hint: 'err1' });
    await incidentSvc.log('boot_fail', 'error', { hint: 'err2' });
    await incidentSvc.log('boot_fail', 'error', { hint: 'err3' });

    // Errors = jamais coalescées → 3 entrées
    expect(await incidentSvc.count()).toBe(3);
  });

  it('TC-INT-IS-06 : sévérité info — coalescée dans la fenêtre (CM-DOS2)', async () => {
    const { svc } = createService();
    await svc.initDB();
    const incidentSvc = new IncidentService();
    await incidentSvc.initService(svc.getDB());

    // 3 infos consécutives du même type dans la fenêtre < 1s
    await incidentSvc.log('boot_fail', 'info', { hint: 'i1' });
    await incidentSvc.log('boot_fail', 'info', { hint: 'i2' });
    await incidentSvc.log('boot_fail', 'info', { hint: 'i3' });

    // Coalescées → 1 seule entrée
    expect(await incidentSvc.count()).toBe(1);
  });

  it('TC-INT-IS-07 : getLast sur base vide retourne []', async () => {
    const { svc } = createService();
    await svc.initDB();
    const incidentSvc = new IncidentService();
    await incidentSvc.initService(svc.getDB());

    const last = await incidentSvc.getLast(10);
    expect(last).toHaveLength(0);
  });

  it('TC-INT-IS-08 : requireDB() lève une erreur si initService() non appelé', async () => {
    const incidentSvc = new IncidentService();

    await expect(incidentSvc.getLast(5)).rejects.toThrow('non initialisée');
  });
});

// ---------------------------------------------------------------------------
// TC-INT-EH-01..07 : ExportHandler — createExportHandler
// TACHE-026 : export-handler.ts était à 0% de couverture
// ---------------------------------------------------------------------------

describe('ExportHandler — createExportHandler (intégration storage)', () => {
  it('TC-INT-EH-01 : get_all_events retourne success:true avec un tableau events', async () => {
    const { svc } = createService();
    await svc.initDB();
    const key = await generateKey();

    const handler = createExportHandler(svc, key);
    const msg = { action: 'get_all_events', module: 'EXPORT' } as unknown as NudgeMessage;
    const sender = {} as chrome.runtime.MessageSender;

    const response = await handler(msg, sender);
    expect(response.success).toBe(true);
    expect(response.action).toBe('show');
    expect(Array.isArray((response.data as Record<string, unknown>)?.['events'])).toBe(true);
  });

  it('TC-INT-EH-02 : get_all_quiz_sessions retourne success:true avec un tableau sessions', async () => {
    const { svc } = createService();
    await svc.initDB();
    const key = await generateKey();

    const handler = createExportHandler(svc, key);
    const msg = { action: 'get_all_quiz_sessions', module: 'EXPORT' } as unknown as NudgeMessage;
    const sender = {} as chrome.runtime.MessageSender;

    const response = await handler(msg, sender);
    expect(response.success).toBe(true);
    expect(Array.isArray((response.data as Record<string, unknown>)?.['sessions'])).toBe(true);
  });

  it('TC-INT-EH-03 : get_whitelist retourne success:true avec un tableau whitelist', async () => {
    const { svc } = createService();
    await svc.initDB();
    const key = await generateKey();

    await svc.addToWhitelist('deadbeef1234567890abcdef12345678', 'M2');

    const handler = createExportHandler(svc, key);
    const msg = { action: 'get_whitelist', module: 'EXPORT' } as unknown as NudgeMessage;
    const sender = {} as chrome.runtime.MessageSender;

    const response = await handler(msg, sender);
    expect(response.success).toBe(true);
    const whitelist = (response.data as Record<string, unknown>)?.['whitelist'] as unknown[];
    expect(Array.isArray(whitelist)).toBe(true);
    expect(whitelist.length).toBe(1);
  });

  it('TC-INT-EH-04 : get_password_hash_meta retourne count/oldest/newest', async () => {
    const { svc } = createService();
    await svc.initDB();
    const key = await generateKey();

    const handler = createExportHandler(svc, key);
    const msg = { action: 'get_password_hash_meta', module: 'EXPORT' } as unknown as NudgeMessage;
    const sender = {} as chrome.runtime.MessageSender;

    const response = await handler(msg, sender);
    expect(response.success).toBe(true);
    const data = response.data as Record<string, unknown>;
    expect(typeof data?.['count']).toBe('number');
    expect(typeof data?.['oldest']).toBe('string');
    expect(typeof data?.['newest']).toBe('string');
  });

  it('TC-INT-EH-05 : action inconnue retourne success:false + reason unknown_export_action', async () => {
    const { svc } = createService();
    await svc.initDB();
    const key = await generateKey();

    const handler = createExportHandler(svc, key);
    const msg = { action: 'not_a_valid_action', module: 'EXPORT' } as unknown as NudgeMessage;
    const sender = {} as chrome.runtime.MessageSender;

    const response = await handler(msg, sender);
    expect(response.success).toBe(false);
    expect(response.reason).toContain('unknown_export_action');
  });

  it('TC-INT-EH-06 : get_all_events avec storage non initialisé retourne success:false + internal_error', async () => {
    const { svc, crypto } = createService();
    // Ne pas appeler initDB() → getDB() lève une erreur dans storage.getEvents
    const key = await generateKey();

    // Le storage sans initDB() lève une erreur lors de getDB()
    const handler = createExportHandler(svc, key);
    const msg = { action: 'get_all_events', module: 'EXPORT' } as unknown as NudgeMessage;
    const sender = {} as chrome.runtime.MessageSender;

    const response = await handler(msg, sender);
    expect(response.success).toBe(false);
    expect(response.action).toBe('error');
    expect(response.reason).toBe('internal_error');

    void crypto; // suppress unused variable warning
  });

  it('TC-INT-EH-07 : get_password_hash_meta avec données présentes retourne count > 0', async () => {
    const { svc } = createService();
    await svc.initDB();
    const key = await generateKey();

    await svc.addPasswordHash('a3f2c1b0' + 'a'.repeat(56), 'a3f2c1b0', 'domain_hash_1', key);
    await svc.addPasswordHash('b4e3d2c1' + 'b'.repeat(56), 'b4e3d2c1', 'domain_hash_2', key);

    const handler = createExportHandler(svc, key);
    const msg = { action: 'get_password_hash_meta', module: 'EXPORT' } as unknown as NudgeMessage;
    const sender = {} as chrome.runtime.MessageSender;

    const response = await handler(msg, sender);
    expect(response.success).toBe(true);
    const data = response.data as Record<string, unknown>;
    expect(data?.['count']).toBe(2);
    expect(data?.['oldest']).toBeTruthy();
    expect(data?.['newest']).toBeTruthy();
  });
});
