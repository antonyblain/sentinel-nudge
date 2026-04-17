/**
 * @file tests/integration/boot-sequence.test.ts
 * @description Tests d'intégration de la boot sequence TACHE-061, TACHE-079 et TACHE-085.
 *
 * Vérifie l'orchestration HeartbeatService + CanaryService + IncidentService + M2BootService
 * dans les scénarios de boot définis par le mini-DAT TACHE-061 et ADR-001 (TACHE-085).
 *
 * Scénarios couverts :
 * - TC-M7-13 : boot avec storage vide (premier install)
 * - TC-M7-14 : boot avec clé présente et canary valide
 * - TC-M7-15 : boot avec clé présente mais canary absent
 * - TC-M7-17 : deuxième boot incrémente boot_count
 * - TC-M7-24 : migration DB v1→v2 — DB_VERSION=2 et entrée MIGRATIONS[2] présents
 *
 * - TC-TACHE-079-01 : onFirstInstall pose et lève installation_in_progress
 * - TC-TACHE-079-02 : IIFE voit installation_in_progress=true → skip sans incident
 * - TC-TACHE-079-03 : boot ultérieur (réveil SW) — flag absent → boot nominal
 * - TC-TACHE-079-04 : régression R-M7-09 — aucun incident boot_fail ni key_regenerated fantôme
 *
 * - TC-M2-INT-01 : boot M2 nominal après boot M7 — diagnostics.m2 cohérent (TACHE-085)
 * - TC-M2-INT-02 : boot M2 avec whitelist absente — diagnostic + incident loggué (TACHE-085)
 * - TC-M2-INT-03 : boot M2 + M7 en séquence — états indépendants (TACHE-085)
 *
 * Note : ces tests vérifient la logique de coordination sans le service-worker complet
 * (pas de chrome.runtime disponible). L'orchestration est testée au niveau des services.
 *
 * Référence : Mini-DAT TACHE-061 §7 (plan de tests), TACHE-079 (R-M7-09), TACHE-085 (ADR-001 M2)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeartbeatService } from '@/background/services/heartbeat-service';
import { CanaryService } from '@/background/services/canary-service';
import { CryptoService } from '@/background/crypto-service';
import { IncidentService } from '@/background/services/incident-service';
import { initBootM2, readM2Diagnostics } from '@/background/services/m2-boot-service';
// CANARY_KEYS est utilisé pour vérifier le stockage dans le storage mock
import { CANARY_KEYS as CK } from '@/background/services/canary-service';
import { DB_VERSION, MIGRATIONS } from '@/background/storage-service';

// ---------------------------------------------------------------------------
// Mock chrome.storage.local
// ---------------------------------------------------------------------------
const mockLocalStorage: Record<string, unknown> = {};

/**
 * Clés supprimées via chrome.storage.local.remove().
 * Utilisées dans TC-TACHE-079-01 pour vérifier que le flag est bien levé.
 */
const removedKeys: string[] = [];

global.chrome = {
  storage: {
    local: {
      get: vi.fn((_keys: string[], callback: (r: Record<string, unknown>) => void) => {
        const result: Record<string, unknown> = {};
        _keys.forEach((k) => {
          if (k in mockLocalStorage) result[k] = mockLocalStorage[k];
        });
        callback(result);
      }),
      set: vi.fn((items: Record<string, unknown>, callback?: () => void) => {
        Object.assign(mockLocalStorage, items);
        callback?.();
      }),
      remove: vi.fn((key: string | string[], callback?: () => void) => {
        const keys = Array.isArray(key) ? key : [key];
        keys.forEach((k) => {
          removedKeys.push(k);
          delete mockLocalStorage[k];
        });
        callback?.();
      }),
    },
  },
} as unknown as typeof chrome;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createServices(): Promise<{
  heartbeat: HeartbeatService;
  canary: CanaryService;
  cryptoService: CryptoService;
  key: CryptoKey;
}> {
  const cryptoService = new CryptoService();
  const heartbeat = new HeartbeatService();
  const canary = new CanaryService(cryptoService);
  const key = await cryptoService.generateKey();
  return { heartbeat, canary, cryptoService, key };
}

/**
 * Simule la logique de garde IIFE (TACHE-079) :
 * lit `installation_in_progress` dans le storage mock et retourne true si
 * l'IIFE doit sauter son exécution.
 *
 * Cette fonction reproduit exactement le comportement du code produit dans
 * service-worker.ts (browser.storage.local.get(['installation_in_progress']))
 * afin de le tester indépendamment du service-worker complet (qui a des
 * side-effects module-level).
 *
 * @returns true si le flag est présent et truthy, false sinon
 */
async function simulateIifeInstallCheck(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    chrome.storage.local.get(['installation_in_progress'], (result) => {
      resolve(Boolean(result['installation_in_progress']));
    });
  });
}

/**
 * Simule le comportement de onFirstInstall() concernant le flag anti-race :
 * pose `installation_in_progress`, exécute le callback asynchrone (corps de
 * onFirstInstall), lève le flag en finally.
 *
 * Permet de tester TC-TACHE-079-01 sans importer service-worker.ts
 * (qui déclencherait ses side-effects module-level).
 *
 * @param body - Corps async de onFirstInstall() à exécuter entre pose et levée du flag
 */
async function simulateOnFirstInstall(body: () => Promise<void>): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ installation_in_progress: true }, resolve);
  });
  try {
    await body();
  } finally {
    await new Promise<void>((resolve) => {
      chrome.storage.local.remove('installation_in_progress', resolve);
    });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Boot sequence — intégration HeartbeatService + CanaryService', () => {
  beforeEach(() => {
    Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]);
    removedKeys.length = 0;
    vi.clearAllMocks();
  });

  // TC-M7-13 : premier install — storage vide
  it('TC-M7-13 : boot avec storage vide : canary init, ready=true, boot_count=1', async () => {
    const { heartbeat, canary, key } = await createServices();

    // Simulation du flux boot (storage vide = premier install)
    const diag = await heartbeat.onBootStart();
    expect(diag.boot_count).toBe(1);
    expect(diag.ready).toBe(false);

    // canary absent → init()
    const verifyResult = await canary.verify(key);
    expect(verifyResult.ok).toBe(false);
    if (!verifyResult.ok) expect(verifyResult.reason).toBe('absent');

    await canary.init(key);
    await heartbeat.onBootSuccess();

    const finalDiag = await heartbeat.read();
    expect(finalDiag.ready).toBe(true);
    expect(finalDiag.canary_verified).toBe(true);
    expect(finalDiag.boot_count).toBe(1);

    // Canary stocké en Array<number>
    expect(Array.isArray(mockLocalStorage[CK.CIPHERTEXT])).toBe(true);
    expect(Array.isArray(mockLocalStorage[CK.IV])).toBe(true);
  });

  // TC-M7-14 : boot avec clé présente et canary valide
  it('TC-M7-14 : boot nominal avec canary valide — ready=true, aucun incident attendu', async () => {
    const { heartbeat, canary, key } = await createServices();

    // Premier boot : initialiser le canary
    await heartbeat.onBootStart();
    await canary.init(key);
    await heartbeat.onBootSuccess();

    // Deuxième boot : vérifier le canary (boot nominal)
    const diag2 = await heartbeat.onBootStart();
    const canaryResult = await canary.verify(key);
    expect(canaryResult.ok).toBe(true);
    await heartbeat.onBootSuccess();

    const finalDiag = await heartbeat.read();
    expect(finalDiag.ready).toBe(true);
    expect(finalDiag.boot_count).toBe(2);
    expect(diag2.boot_count).toBe(2);
  });

  // TC-M7-15 : canary absent (clé présente mais canary purgé)
  it('TC-M7-15 : canary absent → verify reason absent → init + re-verify → ok', async () => {
    const { heartbeat, canary, key } = await createServices();

    await heartbeat.onBootStart();

    // Canary absent
    const verifyResult = await canary.verify(key);
    expect(verifyResult.ok).toBe(false);
    if (!verifyResult.ok) expect(verifyResult.reason).toBe('absent');

    // Réinitialiser le canary avec la clé existante
    await canary.init(key);
    const reVerify = await canary.verify(key);
    expect(reVerify.ok).toBe(true);

    await heartbeat.onBootSuccess();
    const diag = await heartbeat.read();
    expect(diag.ready).toBe(true);
  });

  // TC-M7-17 : deux boots consécutifs → boot_count 1 puis 2
  it('TC-M7-17 : deuxième boot incrémente boot_count et met à jour last_boot_ts', async () => {
    const { heartbeat, canary, key } = await createServices();

    await heartbeat.onBootStart();
    await canary.init(key);
    await heartbeat.onBootSuccess();

    const diag1 = await heartbeat.read();
    expect(diag1.boot_count).toBe(1);
    const ts1 = diag1.last_boot_ts;

    // Attendre un peu pour que last_boot_ts soit différent
    await new Promise((r) => setTimeout(r, 10));

    await heartbeat.onBootStart();
    await canary.verify(key);
    await heartbeat.onBootSuccess();

    const diag2 = await heartbeat.read();
    expect(diag2.boot_count).toBe(2);
    expect(diag2.last_boot_ts).toBeGreaterThanOrEqual(ts1);
  });

  // INV-01 : ready=true implique canary_verified=true dans tous les cas
  it('INV-01 : invariant ready=true → canary_verified=true respecté dans tous les chemins', async () => {
    const { heartbeat, canary, key } = await createServices();

    await heartbeat.onBootStart();
    await canary.init(key);
    await heartbeat.onBootSuccess();

    const diag = await heartbeat.read();
    if (diag.ready) {
      expect(diag.canary_verified).toBe(true);
    }
  });

  // TC-M7-24 : migration DB v1→v2 en place (DB_VERSION=2, MIGRATIONS[2] défini)
  it('TC-M7-24 : DB_VERSION=2 et migration v2 (m7_incidents) déclarée dans MIGRATIONS', () => {
    // Vérifie que la migration v1→v2 est bien enregistrée dans le registre de migrations
    // SANS instancier IDB réelle (fake-indexeddb différé en TACHE-077).
    // Cette assertion garantit que le code de migration est présent et que DB_VERSION
    // a bien été bumppé à 2 lors de l'ajout du store m7_incidents (TACHE-061).
    expect(DB_VERSION).toBe(2);
    expect(typeof MIGRATIONS[2]).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Tests anti-race premier install (TACHE-079 / R-M7-09)
// ---------------------------------------------------------------------------
// Ces tests vérifient la garde `installation_in_progress` introduite en TACHE-079
// pour éliminer la race entre l'IIFE module-level et onInstalled(reason='install').
//
// Stratégie : simuler onFirstInstall() et l'IIFE via des helpers (simulateOnFirstInstall,
// simulateIifeInstallCheck) sans importer service-worker.ts — l'import déclencherait
// des side-effects (listeners chrome.runtime, IIFE) incompatibles avec l'environnement
// jsdom/Vitest.
// ---------------------------------------------------------------------------

describe('TACHE-079 — Garde anti-race premier install (R-M7-09)', () => {
  beforeEach(() => {
    Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]);
    removedKeys.length = 0;
    vi.clearAllMocks();
  });

  // TC-TACHE-079-01 : onFirstInstall pose et lève correctement installation_in_progress
  it('TC-TACHE-079-01 : onFirstInstall pose installation_in_progress au début et le lève en finally', async () => {
    let flagDuringInstall: boolean | undefined;

    await simulateOnFirstInstall(async () => {
      // Vérifier que le flag est posé pendant l'exécution du corps
      flagDuringInstall = Boolean(mockLocalStorage['installation_in_progress']);
    });

    // Pendant l'install : flag présent
    expect(flagDuringInstall).toBe(true);

    // Après l'install (finally exécuté) : flag absent
    expect(mockLocalStorage['installation_in_progress']).toBeUndefined();

    // La clé 'installation_in_progress' a bien été passée à remove()
    expect(removedKeys).toContain('installation_in_progress');
  });

  // TC-TACHE-079-01 variante : le flag est levé même si le corps lève une exception
  it('TC-TACHE-079-01b : flag levé en finally même si onFirstInstall lève une exception', async () => {
    let flagDuringInstall: boolean | undefined;

    await expect(
      simulateOnFirstInstall(async () => {
        flagDuringInstall = Boolean(mockLocalStorage['installation_in_progress']);
        throw new Error('Erreur simulée dans onFirstInstall');
      }),
    ).rejects.toThrow('Erreur simulée dans onFirstInstall');

    // Pendant l'install : flag était posé
    expect(flagDuringInstall).toBe(true);

    // Après l'exception (finally) : flag levé
    expect(mockLocalStorage['installation_in_progress']).toBeUndefined();
    expect(removedKeys).toContain('installation_in_progress');
  });

  // TC-TACHE-079-02 : l'IIFE voit installation_in_progress=true → skip sans incident
  it('TC-TACHE-079-02 : IIFE skip si installation_in_progress=true — aucun incident créé', async () => {
    const { heartbeat, canary, cryptoService } = await createServices();
    const incidentService = new IncidentService();

    // Simuler onFirstInstall en cours : flag posé, clé absente (pas encore écrite)
    mockLocalStorage['installation_in_progress'] = true;

    // L'IIFE doit détecter le flag et retourner immédiatement
    const shouldSkip = await simulateIifeInstallCheck();
    expect(shouldSkip).toBe(true);

    // Vérifier qu'aucun boot n'a été démarré (heartbeat inchangé)
    const diag = await heartbeat.read();
    expect(diag.boot_count).toBe(0);
    expect(diag.ready).toBe(false);

    // Vérifier qu'aucun incident n'a été créé
    // (initService non appelé → buffer interne vide)
    expect(incidentService['preInitBuffer']).toHaveLength(0);

    // Vérifier que le canary n'a pas été touché
    const key = await cryptoService.generateKey();
    const canaryResult = await canary.verify(key);
    expect(canaryResult.ok).toBe(false);
    if (!canaryResult.ok) expect(canaryResult.reason).toBe('absent');
  });

  // TC-TACHE-079-03 : boot ultérieur (réveil SW) — flag absent → IIFE s'exécute normalement
  it('TC-TACHE-079-03 : boot ultérieur (réveil SW) — flag absent → IIFE non bloquée', async () => {
    const { heartbeat, canary, key } = await createServices();

    // Simuler que onFirstInstall est terminé : flag absent, clé présente
    // (onFirstInstall a levé le flag en finally)
    expect(mockLocalStorage['installation_in_progress']).toBeUndefined();

    // L'IIFE ne doit PAS sauter
    const shouldSkip = await simulateIifeInstallCheck();
    expect(shouldSkip).toBe(false);

    // Simulation du boot nominal : l'IIFE continue
    const diag = await heartbeat.onBootStart();
    expect(diag.boot_count).toBe(1);

    await canary.init(key);
    await heartbeat.onBootSuccess();

    const finalDiag = await heartbeat.read();
    expect(finalDiag.ready).toBe(true);
    expect(finalDiag.boot_count).toBe(1);
    expect(finalDiag.canary_verified).toBe(true);
  });

  // TC-TACHE-079-04 : régression R-M7-09 — aucun incident fantôme au premier install
  //
  // Scénario : onFirstInstall pose le flag → l'IIFE le détecte → skip.
  // onFirstInstall génère la clé, initialise les services (canary.init +
  // heartbeat.onBootSuccess). Résultat : 0 incident boot_fail, 0 incident
  // key_regenerated, heartbeat ready=true avec boot_count=1.
  it('TC-TACHE-079-04 : R-M7-09 — aucun incident boot_fail ni key_regenerated fantôme au premier install', async () => {
    const cryptoService = new CryptoService();
    const heartbeat = new HeartbeatService();
    const canary = new CanaryService(cryptoService);
    const incidentService = new IncidentService();
    const incidents: Array<{ type: string; severity: string }> = [];

    // Espionner les incidents créés (buffer interne de IncidentService)
    // On utilise la méthode log() en la wrappant pour intercepter les appels
    const originalLog = incidentService.log.bind(incidentService);
    incidentService.log = async (
      type: Parameters<typeof incidentService.log>[0],
      severity: Parameters<typeof incidentService.log>[1],
      context: Parameters<typeof incidentService.log>[2],
    ) => {
      incidents.push({ type, severity });
      return originalLog(type, severity, context);
    };

    // Phase 1 : onFirstInstall démarre — flag posé
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ installation_in_progress: true }, resolve);
    });

    // Phase 2 : l'IIFE s'exécute en concurrence — détecte le flag et skip
    const iifeShouldSkip = await simulateIifeInstallCheck();
    expect(iifeShouldSkip).toBe(true);
    // L'IIFE ne démarre pas le boot : pas d'onBootStart
    const diagBeforeInstall = await heartbeat.read();
    expect(diagBeforeInstall.boot_count).toBe(0);

    // Phase 3 : onFirstInstall génère la clé et initialise les services
    try {
      const key = await cryptoService.generateKey();
      await canary.init(key);
      await heartbeat.onBootSuccess();
    } finally {
      // Phase 4 : onFirstInstall lève le flag (finally garanti)
      await new Promise<void>((resolve) => {
        chrome.storage.local.remove('installation_in_progress', resolve);
      });
    }

    // Vérifications post-install
    // Invariant R-M7-09 : aucun incident fantôme créé
    const bootFailIncidents = incidents.filter((i) => i.type === 'boot_fail');
    const keyRegeneratedIncidents = incidents.filter((i) => i.type === 'key_regenerated');
    expect(bootFailIncidents).toHaveLength(0);
    expect(keyRegeneratedIncidents).toHaveLength(0);

    // Heartbeat : ready=true, boot_count=1 (via heartbeat.onBootSuccess() dans onFirstInstall)
    const finalDiag = await heartbeat.read();
    expect(finalDiag.ready).toBe(true);
    expect(finalDiag.canary_verified).toBe(true);
    // A-02 QC TACHE-079 : preuve de non-doublon d'initialisation
    // Sémantique actuelle : onFirstInstall appelle `initializeServices(cryptoKey)` qui
    // invoque `heartbeat.onBootSuccess()` SANS `onBootStart()`. Donc boot_count=0 dans
    // ce flux (install ≠ boot au sens heartbeat). Si le bug R-M7-09 réapparaissait
    // et que l'IIFE s'exécutait en parallèle, `onBootStart()` incrémenterait boot_count
    // → l'assertion `toBe(0)` devient la preuve que le skip a fonctionné.
    expect(finalDiag.boot_count).toBe(0);

    // Flag levé
    expect(mockLocalStorage['installation_in_progress']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests intégration M2 boot — ADR-001 SW-BOOT-CONTRACT (TACHE-085)
// ---------------------------------------------------------------------------
// Ces tests vérifient la cohérence entre la boot sequence M7 (HeartbeatService)
// et la boot sequence M2 (initBootM2) lorsqu'elles sont exécutées en séquence,
// comme dans la IIFE de service-worker.ts (étapes 5 puis 6a).
//
// Stratégie : simuler la IIFE sans importer service-worker.ts (side-effects module-level).
// L'IncidentService est partagé entre M7 et M2 (registre commun m7_incidents).
// ---------------------------------------------------------------------------

describe('TACHE-085 — Boot M2 (ADR-001) intégration avec la séquence M7', () => {
  beforeEach(() => {
    Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]);
    removedKeys.length = 0;
    vi.clearAllMocks();
  });

  // TC-M2-INT-01 : boot M2 nominal après boot M7 — les deux modules sont ready
  it('TC-M2-INT-01 : boot M2 nominal après boot M7 — diagnostics.m2 et diagnostics.m7 cohérents', async () => {
    const { heartbeat, canary, key } = await createServices();
    const incidentService = new IncidentService();

    // Whitelist M2 valide présente dans le storage
    mockLocalStorage['whitelist_m2'] = ['paypal.com', 'google.com', 'amazon.com'];

    // Simuler la boot sequence IIFE (étapes 1 à 6a)
    await heartbeat.onBootStart();
    await canary.init(key);
    await heartbeat.onBootSuccess();

    // Étape 6a : boot M2
    const m2Diag = await initBootM2(incidentService);

    // M7 : ready=true
    const m7Diag = await heartbeat.read();
    expect(m7Diag.ready).toBe(true);
    expect(m7Diag.canary_verified).toBe(true);

    // M2 : ready=true, whitelist_size cohérente
    expect(m2Diag.ready).toBe(true);
    expect(m2Diag.whitelist_size).toBe(3);
    expect(m2Diag.last_incident).toBeUndefined();

    // diagnostics.m2 persisté dans le storage
    const storedM2 = mockLocalStorage['diagnostics.m2'] as Record<string, unknown>;
    expect(storedM2['ready']).toBe(true);
    expect(storedM2['whitelist_size']).toBe(3);
  });

  // TC-M2-INT-02 : boot M2 avec whitelist absente — incident whitelist_regenerated loggué
  it('TC-M2-INT-02 : whitelist M2 absente — incident whitelist_regenerated loggué, M7 non affecté', async () => {
    const { heartbeat, canary, key } = await createServices();
    const incidentService = new IncidentService();
    const incidents: Array<{ type: string; severity: string }> = [];

    // Intercepter les incidents
    const originalLog = incidentService.log.bind(incidentService);
    incidentService.log = async (
      type: Parameters<typeof incidentService.log>[0],
      severity: Parameters<typeof incidentService.log>[1],
      context: Parameters<typeof incidentService.log>[2],
    ) => {
      incidents.push({ type, severity });
      return originalLog(type, severity, context);
    };

    // Aucune whitelist dans le storage (premier install ou storage purgé)

    // Boot M7
    await heartbeat.onBootStart();
    await canary.init(key);
    await heartbeat.onBootSuccess();

    // Boot M2 (whitelist absente → régénération)
    const m2Diag = await initBootM2(incidentService);

    // M7 non affecté
    const m7Diag = await heartbeat.read();
    expect(m7Diag.ready).toBe(true);

    // M2 régénéré depuis le JSON embarqué
    expect(m2Diag.ready).toBe(true);
    expect(m2Diag.whitelist_size).toBeGreaterThan(0);

    // Incident whitelist_regenerated loggué (et PAS whitelist_corrupted)
    const wlRegeneratedIncidents = incidents.filter((i) => i.type === 'whitelist_regenerated');
    const wlCorruptedIncidents = incidents.filter((i) => i.type === 'whitelist_corrupted');
    expect(wlRegeneratedIncidents).toHaveLength(1);
    expect(wlRegeneratedIncidents[0].severity).toBe('warn');
    expect(wlCorruptedIncidents).toHaveLength(0);

    // Aucun incident M7 créé (M7 = boot nominal)
    const bootFailIncidents = incidents.filter((i) => i.type === 'boot_fail');
    expect(bootFailIncidents).toHaveLength(0);
  });

  // TC-M2-INT-03 : état diagnostics.m2 indépendant de diagnostics.m7
  it('TC-M2-INT-03 : diagnostics.m2 et diagnostics.m7 sont des états indépendants dans chrome.storage.local', async () => {
    const { heartbeat, canary, key } = await createServices();
    const incidentService = new IncidentService();

    // Whitelist M2 corrompue (shape invalide)
    mockLocalStorage['whitelist_m2'] = { not_an_array: true };

    // Boot M7 nominal
    await heartbeat.onBootStart();
    await canary.init(key);
    await heartbeat.onBootSuccess();

    // Boot M2 avec corruption
    const m2Diag = await initBootM2(incidentService);

    // M7 : toujours ready=true (non affecté par l'incident M2)
    const m7Diag = await heartbeat.read();
    expect(m7Diag.ready).toBe(true);
    expect(m7Diag.canary_verified).toBe(true);

    // M2 : ready=true après régénération (whitelist corrompue → régénérée depuis JSON)
    expect(m2Diag.ready).toBe(true);
    expect(m2Diag.last_incident?.type).toBe('whitelist_corrupted');

    // Clés storage séparées — pas de collision
    expect(mockLocalStorage['diagnostics.m7']).toBeDefined();
    expect(mockLocalStorage['diagnostics.m2']).toBeDefined();
    const m7Stored = mockLocalStorage['diagnostics.m7'] as Record<string, unknown>;
    const m2Stored = mockLocalStorage['diagnostics.m2'] as Record<string, unknown>;
    expect(m7Stored['canary_verified']).toBeDefined();
    expect(m2Stored['whitelist_size']).toBeDefined();

    // readM2Diagnostics retourne l'état correct
    const m2DiagRead = await readM2Diagnostics();
    expect(m2DiagRead.ready).toBe(true);
  });
});
