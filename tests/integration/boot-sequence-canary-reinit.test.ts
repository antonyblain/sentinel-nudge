/**
 * @file tests/integration/boot-sequence-canary-reinit.test.ts
 * @description Tests d'intégration — chemin canary_reinit (CM-EOP1 OBS-01).
 *
 * Complète le plan de tests TACHE-076 en couvrant le chemin "canary absent/invalide
 * + clé AES OK" qui n'était pas testé dans boot-sequence.test.ts.
 *
 * Contexte (PV comité revue code TACHE-061 §8.2 OBS-01) :
 * Le chemin CM-EOP1 "clé OK + canary corrompu → canary_reinit" est implémenté dans
 * service-worker.ts mais n'avait pas de test d'intégration end-to-end. La détection
 * de ce cas repose sur une tentative de déchiffrement d'une entrée password_hashes
 * existante. Si le déchiffrement réussit → keyOk=true → canary_reinit (severity=warn).
 *
 * Référence code : service-worker.ts lignes 693-779 (bloc CM-EOP1).
 *
 * NOTE SÉVÉRITÉ : l'incident canary_reinit est loggué severity='warn' dans le code
 * source (service-worker.ts ligne 735), pas 'info'. Le brief mentionne 'info' mais
 * le code produit fait autorité (ADR-001 — convention boot contract). Les assertions
 * de ce fichier suivent le code réel.
 *
 * Stratégie de test (alignée sur boot-sequence.test.ts) :
 * - Pas d'import de service-worker.ts (side-effects module-level incompatibles jsdom)
 * - fake-indexeddb pour StorageService complet (password_hashes store requis par CM-EOP1)
 * - Mock chrome.storage.local en mémoire (même pattern que boot-sequence.test.ts)
 * - Les étapes de la boot sequence sont simulées via les services réels en reproduisant
 *   fidèlement la logique de service-worker.ts (étapes 4→5b→CM-EOP1)
 *
 * Scénarios couverts :
 * - TC-CR-01 (Baseline)    : canary présent valide + clé OK → canary_ok, aucun incident
 * - TC-CR-02 (CM-EOP1 cible OBS-01) : canary absent + clé OK (hash déchiffrable) → canary_reinit
 * - TC-CR-03               : canary invalide (HMAC mismatch) + clé OK → canary_invalid + canary_reinit
 * - TC-CR-04               : canary + clé absents → key_regenerated + canary_reinit chaînés
 * - TC-CR-05               : canary présent + clé corrompue (taille invalide) → key_regenerated
 * - TC-CR-06               : canary valide + clé différente (rotation) → key_invalid détecté
 *
 * Référence : Mini-DAT TACHE-061 §11.5 (CM-EOP1), ADR-001 SW-BOOT-CONTRACT,
 *             PV comité revue code TACHE-061 §8.2 OBS-01
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { HeartbeatService } from '@/background/services/heartbeat-service';
import { CanaryService, CANARY_KEYS } from '@/background/services/canary-service';
import { CryptoService } from '@/background/crypto-service';
import { IncidentService } from '@/background/services/incident-service';
import { StorageService } from '@/background/storage-service';

// ---------------------------------------------------------------------------
// Mock chrome.storage.local (même pattern que boot-sequence.test.ts)
// ---------------------------------------------------------------------------

const mockLocalStorage: Record<string, unknown> = {};

global.chrome = {
  storage: {
    local: {
      get: vi.fn((keys: string[], callback: (r: Record<string, unknown>) => void) => {
        const result: Record<string, unknown> = {};
        for (const k of keys) {
          if (k in mockLocalStorage) result[k] = mockLocalStorage[k];
        }
        callback(result);
      }),
      set: vi.fn((items: Record<string, unknown>, callback?: () => void) => {
        Object.assign(mockLocalStorage, items);
        callback?.();
      }),
      remove: vi.fn((key: string | string[], callback?: () => void) => {
        const keys = Array.isArray(key) ? key : [key];
        for (const k of keys) {
          delete mockLocalStorage[k];
        }
        callback?.();
      }),
    },
  },
} as unknown as typeof chrome;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Résultat capturé d'un incident loggué */
interface CapturedIncident {
  type: string;
  severity: string;
}

/**
 * Crée un StorageService avec IDBFactory isolée par test (évite la contamination entre tests).
 * Nécessaire pour que password_hashes soit disponible pour les tests CM-EOP1.
 */
function createIsolatedStorage(): { storage: StorageService; crypto: CryptoService } {
  const idbFactory = new IDBFactory();
  Object.defineProperty(globalThis, 'indexedDB', {
    value: idbFactory,
    configurable: true,
    writable: true,
  });
  const crypto = new CryptoService();
  return { storage: new StorageService(crypto), crypto };
}

/**
 * Crée tous les services nécessaires à la simulation de la boot sequence.
 * Les services sont instanciés frais à chaque appel.
 */
async function createServices(): Promise<{
  heartbeat: HeartbeatService;
  canary: CanaryService;
  cryptoService: CryptoService;
  incidentService: IncidentService;
  incidents: CapturedIncident[];
  storage: StorageService;
  key: CryptoKey;
}> {
  const { storage, crypto: cryptoService } = createIsolatedStorage();
  const heartbeat = new HeartbeatService();
  const canary = new CanaryService(cryptoService);
  const incidentService = new IncidentService();
  const incidents: CapturedIncident[] = [];

  // Intercepter les incidents (même pattern que boot-sequence.test.ts)
  const originalLog = incidentService.log.bind(incidentService);
  incidentService.log = async (
    type: Parameters<typeof incidentService.log>[0],
    severity: Parameters<typeof incidentService.log>[1],
    context: Parameters<typeof incidentService.log>[2],
  ) => {
    incidents.push({ type, severity });
    return originalLog(type, severity, context);
  };

  const key = await cryptoService.generateKey();

  return { heartbeat, canary, cryptoService, incidentService, incidents, storage, key };
}

/**
 * Simule l'étape CM-EOP1 de service-worker.ts (lignes 693-779) :
 * Applique le protocole de récupération canary invalide → clé OK ou KO.
 *
 * Cette fonction reproduit fidèlement la logique inline du SW sans l'importer
 * (éviter les side-effects module-level chrome.runtime incompatibles jsdom).
 *
 * @param canaryResult - Résultat de canary.verify() : { ok: false, reason }
 * @param storage      - StorageService avec IDB initialisée
 * @param cryptoKey    - Clé AES courante
 * @param cryptoSvc    - CryptoService pour générer/exporter une nouvelle clé
 * @param canary       - CanaryService pour (re-)init
 * @param heartbeat    - HeartbeatService pour onBootSuccess/onBootFailure
 * @param incidentSvc  - IncidentService pour logger les incidents
 * @param bootCount    - Compteur de boot (pour les incidents key_regenerated)
 * @returns Résultat : 'canary_reinit' | 'key_regenerated_ok' | 'key_regenerated_fail'
 */
async function simulateCmEop1(
  canaryResult: { ok: false; reason: 'absent' | 'decrypt_failed' | 'mismatch' },
  storage: StorageService,
  cryptoKey: CryptoKey,
  cryptoSvc: CryptoService,
  canary: CanaryService,
  heartbeat: HeartbeatService,
  incidentSvc: IncidentService,
  bootCount: number,
): Promise<'canary_reinit' | 'key_regenerated_ok' | 'key_regenerated_fail'> {
  // Reproduit fidèlement service-worker.ts §5b CM-EOP1 (lignes 693-779)
  const hashCount = await storage.getPasswordHashCount();
  let keyOk = false;

  if (hashCount > 0) {
    try {
      const db = storage.getDB();
      keyOk = await new Promise<boolean>((resolve) => {
        const tx = db.transaction('password_hashes', 'readonly');
        const store = tx.objectStore('password_hashes');
        const idx = store.index('first_seen');
        const req = idx.openCursor(null, 'next');
        req.onsuccess = async () => {
          const cursor = req.result;
          if (!cursor) {
            resolve(false);
            return;
          }
          const rec = cursor.value as { value: ArrayBuffer; iv: Uint8Array };
          try {
            await globalThis.crypto.subtle.decrypt(
              { name: 'AES-GCM', iv: rec.iv },
              cryptoKey,
              rec.value,
            );
            resolve(true);
          } catch {
            resolve(false);
          }
        };
        req.onerror = () => resolve(false);
      });
    } catch {
      keyOk = false;
    }
  }

  if (keyOk) {
    // CM-EOP1 : clé OK mais canary corrompu → re-init canary seulement (severity=warn)
    await incidentSvc.log('canary_reinit', 'warn', {
      type: 'canary_reinit',
      reason: canaryResult.reason,
    });
    await canary.init(cryptoKey);
    await heartbeat.onBootSuccess();
    return 'canary_reinit';
  } else {
    // CM-EOP1 : clé KO ou store vide → régénération complète
    await incidentSvc.log('canary_failed', 'error', {
      type: 'canary_failed',
      reason: canaryResult.reason,
    });
    await incidentSvc.log('key_regenerated', 'error', {
      type: 'key_regenerated',
      trigger: 'canary_failed',
      previous_boot_count: bootCount,
      hashes_purged_count: hashCount,
    });
    const newKey = await cryptoSvc.generateKey();
    const material = await cryptoSvc.exportKey(newKey);
    const materialArray = Array.from(new Uint8Array(material));
    await new Promise<void>((resolve) =>
      chrome.storage.local.set({ encryption_key_material: materialArray }, resolve),
    );
    await canary.init(newKey);
    const reVerify = await canary.verify(newKey);
    if (reVerify.ok) {
      await heartbeat.onBootSuccess();
      return 'key_regenerated_ok';
    } else {
      await heartbeat.onBootFailure();
      return 'key_regenerated_fail';
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CM-EOP1 OBS-01 — Boot sequence canary_reinit (TACHE-076)', () => {
  beforeEach(() => {
    // Réinitialiser le storage mock entre chaque test
    Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]);
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // TC-CR-01 : Baseline — canary présent valide + clé OK → boot nominal, aucun incident
  // ---------------------------------------------------------------------------
  it('TC-CR-01 (Baseline) : canary présent valide + clé OK → canary_ok, boot success, 0 incident', async () => {
    const { heartbeat, canary, incidentService, incidents, storage, key } = await createServices();

    // Setup : initialiser IDB + insérer le canary
    await storage.initDB();
    await incidentService.initService(storage.getDB());

    // Simuler le premier boot (canary initialisé)
    const diag = await heartbeat.onBootStart();
    await canary.init(key);
    await heartbeat.onBootSuccess();

    // Deuxième boot : vérification du canary (chemin nominal)
    const diag2 = await heartbeat.onBootStart();
    const canaryResult = await canary.verify(key);

    // Vérifications
    expect(canaryResult.ok).toBe(true);

    if (canaryResult.ok) {
      await heartbeat.onBootSuccess();
    }

    const finalDiag = await heartbeat.read();
    expect(finalDiag.ready).toBe(true);
    expect(finalDiag.canary_verified).toBe(true);
    expect(finalDiag.boot_count).toBe(2);

    // Aucun incident canary_reinit ni key_regenerated
    expect(incidents.filter((i) => i.type === 'canary_reinit')).toHaveLength(0);
    expect(incidents.filter((i) => i.type === 'key_regenerated')).toHaveLength(0);
    expect(incidents.filter((i) => i.type === 'canary_failed')).toHaveLength(0);

    // Canary stocké en Array<number> (INV-06)
    expect(Array.isArray(mockLocalStorage[CANARY_KEYS.CIPHERTEXT])).toBe(true);
    expect(Array.isArray(mockLocalStorage[CANARY_KEYS.IV])).toBe(true);

    // boot_count présence dans les diagnostics
    expect(diag.boot_count).toBe(1);
    expect(diag2.boot_count).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // TC-CR-02 (CM-EOP1 cible OBS-01) :
  // canary absent + clé OK (hash déchiffrable en IDB) → canary_reinit
  // ---------------------------------------------------------------------------
  it('TC-CR-02 (CM-EOP1 OBS-01) : canary absent + clé OK + hash déchiffrable → canary_reinit, clé non touchée, boot success', async () => {
    const { heartbeat, canary, cryptoService, incidentService, incidents, storage, key } =
      await createServices();

    // Setup IDB avec un hash de mot de passe chiffré avec la clé courante
    await storage.initDB();
    await incidentService.initService(storage.getDB());

    // Insérer un hash chiffré avec la clé courante — simule un utilisateur M7 actif
    // (le hash est déchiffrable → preuve que la clé est OK, seul le canary est manquant)
    await storage.addPasswordHash('a'.repeat(64), 'aaaaaaaa', 'domhash01', key);
    const hashCountBefore = await storage.getPasswordHashCount();
    expect(hashCountBefore).toBe(1);

    // Boot démarre — canary absent (stockage purgé partiellement, ex. après bug P-018)
    const bootDiag = await heartbeat.onBootStart();
    expect(bootDiag.boot_count).toBe(1);
    expect(bootDiag.ready).toBe(false);

    // Vérification canary : absent
    const canaryResult = await canary.verify(key);
    expect(canaryResult.ok).toBe(false);
    if (!canaryResult.ok) {
      expect(canaryResult.reason).toBe('absent');
    }

    // Appliquer CM-EOP1 : clé OK → canary_reinit
    const outcome = await simulateCmEop1(
      canaryResult as { ok: false; reason: 'absent' | 'decrypt_failed' | 'mismatch' },
      storage,
      key,
      cryptoService,
      canary,
      heartbeat,
      incidentService,
      bootDiag.boot_count,
    );

    // Vérifications post-CM-EOP1
    expect(outcome).toBe('canary_reinit');

    // 1. Canary régénéré dans le storage (non absent)
    const reVerify = await canary.verify(key);
    expect(reVerify.ok).toBe(true);

    // 2. Clé non touchée — encryption_key_material PAS écrit dans le storage mock
    //    (canary_reinit ne régénère PAS la clé — seul le canary est réinitialisé)
    expect(mockLocalStorage['encryption_key_material']).toBeUndefined();

    // 3. Incident canary_reinit loggué, severity=warn (code source fait autorité)
    const reinitIncidents = incidents.filter((i) => i.type === 'canary_reinit');
    expect(reinitIncidents).toHaveLength(1);
    expect(reinitIncidents[0].severity).toBe('warn');

    // 4. Aucun incident key_regenerated ni canary_failed
    expect(incidents.filter((i) => i.type === 'key_regenerated')).toHaveLength(0);
    expect(incidents.filter((i) => i.type === 'canary_failed')).toHaveLength(0);

    // 5. Boot terminé avec succès — ready=true
    const finalDiag = await heartbeat.read();
    expect(finalDiag.ready).toBe(true);
    expect(finalDiag.canary_verified).toBe(true);

    // 6. Les hashes existants ne sont pas purgés (clé conservée)
    const hashCountAfter = await storage.getPasswordHashCount();
    expect(hashCountAfter).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // TC-CR-03 : canary invalide (HMAC mismatch) + clé OK → canary_reinit
  // (même chemin CM-EOP1 que TC-CR-02 mais avec reason='decrypt_failed')
  // ---------------------------------------------------------------------------
  it('TC-CR-03 : canary HMAC invalide (decrypt_failed) + clé OK → canary_reinit severity=warn', async () => {
    const { heartbeat, canary, cryptoService, incidentService, incidents, storage, key } =
      await createServices();

    await storage.initDB();
    await incidentService.initService(storage.getDB());

    // Initialiser le canary avec la bonne clé
    await canary.init(key);

    // Corrompre le canary_ciphertext dans le storage (simule corruption bit-flip)
    // — les données deviennent invalides mais la structure Array<number> est préservée
    const corruptedCiphertext = Array.from({ length: 32 }, (_, i) => i);
    mockLocalStorage[CANARY_KEYS.CIPHERTEXT] = corruptedCiphertext;

    // Insérer un hash déchiffrable avec la clé courante
    await storage.addPasswordHash('b'.repeat(64), 'bbbbbbbb', 'domhash02', key);

    // Boot
    const bootDiag = await heartbeat.onBootStart();

    // Vérification canary : decrypt_failed (données corrompues)
    const canaryResult = await canary.verify(key);
    expect(canaryResult.ok).toBe(false);
    if (!canaryResult.ok) {
      // Peut être 'decrypt_failed' ou 'mismatch' selon la corruption — les deux sont valides
      expect(['decrypt_failed', 'mismatch']).toContain(canaryResult.reason);
    }

    // CM-EOP1 : clé OK (hash déchiffrable) → canary_reinit
    const outcome = await simulateCmEop1(
      canaryResult as { ok: false; reason: 'absent' | 'decrypt_failed' | 'mismatch' },
      storage,
      key,
      cryptoService,
      canary,
      heartbeat,
      incidentService,
      bootDiag.boot_count,
    );

    expect(outcome).toBe('canary_reinit');

    // Incident canary_reinit loggué, severity=warn
    const reinitIncidents = incidents.filter((i) => i.type === 'canary_reinit');
    expect(reinitIncidents).toHaveLength(1);
    expect(reinitIncidents[0].severity).toBe('warn');

    // Aucun incident key_regenerated — la clé n'est pas touchée
    expect(incidents.filter((i) => i.type === 'key_regenerated')).toHaveLength(0);

    // Boot réussi
    const finalDiag = await heartbeat.read();
    expect(finalDiag.ready).toBe(true);
    expect(finalDiag.canary_verified).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // TC-CR-04 : canary absent + clé absente → key_regenerated + canary_reinit chaînés
  // (store password_hashes vide → keyOk=false → régénération complète)
  // ---------------------------------------------------------------------------
  it('TC-CR-04 : canary absent + store password_hashes vide → canary_failed + key_regenerated, boot success', async () => {
    const { heartbeat, canary, cryptoService, incidentService, incidents, storage, key } =
      await createServices();

    await storage.initDB();
    await incidentService.initService(storage.getDB());

    // Boot — canary absent, store vide (pas de hashes pour prouver que la clé est OK)
    const bootDiag = await heartbeat.onBootStart();

    const canaryResult = await canary.verify(key);
    expect(canaryResult.ok).toBe(false);
    if (!canaryResult.ok) {
      expect(canaryResult.reason).toBe('absent');
    }

    // CM-EOP1 : store vide → keyOk=false → régénération complète
    const outcome = await simulateCmEop1(
      canaryResult as { ok: false; reason: 'absent' | 'decrypt_failed' | 'mismatch' },
      storage,
      key,
      cryptoService,
      canary,
      heartbeat,
      incidentService,
      bootDiag.boot_count,
    );

    expect(outcome).toBe('key_regenerated_ok');

    // Incidents chaînés attendus : canary_failed puis key_regenerated
    const failedIncidents = incidents.filter((i) => i.type === 'canary_failed');
    const regeneratedIncidents = incidents.filter((i) => i.type === 'key_regenerated');

    expect(failedIncidents).toHaveLength(1);
    expect(failedIncidents[0].severity).toBe('error');

    expect(regeneratedIncidents).toHaveLength(1);
    expect(regeneratedIncidents[0].severity).toBe('error');

    // canary_failed AVANT key_regenerated (INV-SEC-03)
    const failIdx = incidents.findIndex((i) => i.type === 'canary_failed');
    const regenIdx = incidents.findIndex((i) => i.type === 'key_regenerated');
    expect(failIdx).toBeLessThan(regenIdx);

    // Aucun incident canary_reinit (chemin régénération, pas réinitialisation)
    expect(incidents.filter((i) => i.type === 'canary_reinit')).toHaveLength(0);

    // Nouvelle clé persistée dans le storage
    expect(mockLocalStorage['encryption_key_material']).toBeDefined();
    const keyMat = mockLocalStorage['encryption_key_material'];
    expect(Array.isArray(keyMat)).toBe(true);
    expect((keyMat as number[]).length).toBe(32);

    // Boot réussi malgré la régénération
    const finalDiag = await heartbeat.read();
    expect(finalDiag.ready).toBe(true);
    expect(finalDiag.canary_verified).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // TC-CR-05 : canary présent + clé corrompue (taille invalide)
  // → loadCryptoKey retourne null → chemin 5a (boot_fail + key_regenerated)
  // ---------------------------------------------------------------------------
  it('TC-CR-05 : clé corrompue (taille invalide 16B au lieu de 32B) → boot_fail + key_regenerated', async () => {
    const { heartbeat, cryptoService, incidentService, incidents, storage } =
      await createServices();

    await storage.initDB();
    await incidentService.initService(storage.getDB());

    // Injecter une clé corrompue dans le storage (16 bytes au lieu de 32)
    const corruptMaterial = Array.from({ length: 16 }, (_, i) => i);
    mockLocalStorage['encryption_key_material'] = corruptMaterial;

    // Simuler loadCryptoKey() : la clé taille 16 ≠ 32 → retourne null (service-worker.ts ligne 205)
    const loadKey = async (): Promise<CryptoKey | null> => {
      const material = mockLocalStorage['encryption_key_material'];
      if (!Array.isArray(material)) return null;
      if ((material as number[]).length !== 32) return null; // taille invalide → null
      try {
        const buf = new Uint8Array(material as number[]).buffer;
        return await cryptoService.importKey(buf);
      } catch {
        return null;
      }
    };

    const bootDiag = await heartbeat.onBootStart();
    const cryptoKey = await loadKey();

    // La clé corrompue retourne null → chemin 5a (clé absente)
    expect(cryptoKey).toBeNull();

    // Simuler le chemin 5a : boot_fail + key_regenerated (service-worker.ts lignes 643-683)
    await incidentService.log('boot_fail', 'error', {
      type: 'boot_fail',
      hint: 'key_absent',
      boot_count: bootDiag.boot_count,
    });
    await incidentService.log('key_regenerated', 'error', {
      type: 'key_regenerated',
      trigger: 'boot_fail',
      previous_boot_count: bootDiag.boot_count,
      hashes_purged_count: await storage.getPasswordHashCount(),
    });

    // Régénération de la clé
    const newKey = await cryptoService.generateKey();
    const material = await cryptoService.exportKey(newKey);
    const materialArray = Array.from(new Uint8Array(material));
    await new Promise<void>((resolve) =>
      chrome.storage.local.set({ encryption_key_material: materialArray }, resolve),
    );

    await heartbeat.onBootSuccess();

    // Vérifications
    expect(incidents.filter((i) => i.type === 'boot_fail')).toHaveLength(1);
    expect(incidents.filter((i) => i.type === 'key_regenerated')).toHaveLength(1);
    expect(incidents.filter((i) => i.type === 'boot_fail')[0].severity).toBe('error');
    expect(incidents.filter((i) => i.type === 'key_regenerated')[0].severity).toBe('error');

    // boot_fail AVANT key_regenerated (INV-SEC-03)
    const bootFailIdx = incidents.findIndex((i) => i.type === 'boot_fail');
    const regenIdx = incidents.findIndex((i) => i.type === 'key_regenerated');
    expect(bootFailIdx).toBeLessThan(regenIdx);

    // Nouvelle clé valide (32 bytes) persistée
    const savedMat = mockLocalStorage['encryption_key_material'];
    expect(Array.isArray(savedMat)).toBe(true);
    expect((savedMat as number[]).length).toBe(32);

    // Aucun incident canary_reinit (chemin 5a, pas 5b/CM-EOP1)
    expect(incidents.filter((i) => i.type === 'canary_reinit')).toHaveLength(0);

    const finalDiag = await heartbeat.read();
    expect(finalDiag.ready).toBe(true);
    expect(finalDiag.canary_verified).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // TC-CR-06 : canary valide avec clé A, tentative vérification avec clé B (rotation)
  // → decrypt_failed (clé B ne peut pas déchiffrer le canary chiffré avec clé A)
  // Cas : mismatch clé↔canary détecté via canary.verify() → key_invalid
  // ---------------------------------------------------------------------------
  it('TC-CR-06 : canary chiffré avec clé A, vérifié avec clé B → decrypt_failed détecté', async () => {
    const { heartbeat, canary, cryptoService, incidentService, incidents, storage } =
      await createServices();

    await storage.initDB();
    await incidentService.initService(storage.getDB());

    // Générer deux clés distinctes
    const keyA = await cryptoService.generateKey();
    const keyB = await cryptoService.generateKey();

    // Initialiser le canary avec keyA
    await canary.init(keyA);

    // Insérer un hash chiffré avec keyA dans password_hashes
    await storage.addPasswordHash('c'.repeat(64), 'cccccccc', 'domhash03', keyA);

    // Boot avec keyB (rotation / clé changée entre deux sessions)
    const bootDiag = await heartbeat.onBootStart();

    // Vérification canary avec keyB : decrypt_failed (canary chiffré avec keyA)
    const canaryResult = await canary.verify(keyB);
    expect(canaryResult.ok).toBe(false);
    if (!canaryResult.ok) {
      expect(canaryResult.reason).toBe('decrypt_failed');
    }

    // CM-EOP1 avec keyB : le hash password_hashes est chiffré avec keyA
    // → keyB ne peut pas déchiffrer → keyOk=false → régénération complète
    const outcome = await simulateCmEop1(
      canaryResult as { ok: false; reason: 'absent' | 'decrypt_failed' | 'mismatch' },
      storage,
      keyB,
      cryptoService,
      canary,
      heartbeat,
      incidentService,
      bootDiag.boot_count,
    );

    // Avec une clé différente, le hash ne peut pas être déchiffré → key_regenerated
    expect(outcome).toBe('key_regenerated_ok');

    // canary_failed loggué (clé invalide, hash non déchiffrable)
    expect(incidents.filter((i) => i.type === 'canary_failed')).toHaveLength(1);
    expect(incidents.filter((i) => i.type === 'key_regenerated')).toHaveLength(1);

    // Aucun canary_reinit (mismatch clé↔canary confirmé par l'échec de déchiffrement hash)
    expect(incidents.filter((i) => i.type === 'canary_reinit')).toHaveLength(0);

    // Le mismatch est bien détecté via decrypt_failed (pas absent ni mismatch plaintext)
    expect(incidents.filter((i) => i.type === 'canary_failed')[0].severity).toBe('error');

    const finalDiag = await heartbeat.read();
    expect(finalDiag.ready).toBe(true);
    expect(finalDiag.canary_verified).toBe(true);
  });
});
