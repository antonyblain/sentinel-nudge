/**
 * @file tests/unit/modules/m2.test.ts
 * @description Tests unitaires du module M2 — saisie en contexte risqué.
 *
 * Couvre :
 * - analyzeRisks : détection HTTP, HSTS, Levenshtein, exclusions localhost
 * - createM2Handler : validation payload, whitelist, session dedup, signaux insuffisants
 * - initBootM2 : boot happy path, whitelist absente, whitelist corrompue, diagnostics.m2 (TACHE-085)
 *
 * T-189 : mock inline remplacé par createMockChromeStorage() (wrapper JSON-strict P-018).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeRisks } from '@/content-scripts/detectors/risk-analyzer';
import { createM2Handler } from '@/background/handlers/m2-handler';
import { initBootM2, readM2Diagnostics } from '@/background/services/m2-boot-service';
import type { StorageService } from '@/background/storage-service';
import type { NudgeMessage } from '@/shared/types/messages';
import type { IncidentService } from '@/background/services/incident-service';
import { createMockChromeStorage } from '../../helpers/mock-chrome-storage';

// ---------------------------------------------------------------------------
// Mock chrome.storage.local — wrapper JSON-strict T-189 / P-018
// ---------------------------------------------------------------------------

const { storage, reset: resetStorage } = createMockChromeStorage();

global.chrome = {
  storage: {
    local: storage,
  },
  tabs: {
    create: vi.fn().mockResolvedValue({}),
  },
  runtime: {
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
    lastError: undefined,
  },
} as unknown as typeof chrome;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Hash de domaine valide (64 chars hex) */
const DOMAIN_HASH_VALID = 'a'.repeat(64);
const DOMAIN_HASH_OTHER = 'b'.repeat(64);

/** Construit un NudgeMessage M2 */
function buildM2Message(payload: Record<string, unknown>, action = 'risk_detected'): NudgeMessage {
  return {
    module: 'M2',
    action,
    payload,
    timestamp: Date.now(),
  };
}

/** Crée un mock de StorageService pour les tests M2 */
function createMockStorage(options: {
  isWhitelisted?: boolean;
  whitelistCount?: number;
}): Partial<StorageService> {
  return {
    isWhitelisted: vi.fn().mockResolvedValue(options.isWhitelisted ?? false),
    addToWhitelist: vi.fn().mockResolvedValue(undefined),
    countWhitelistEntries: vi.fn().mockResolvedValue(options.whitelistCount ?? 0),
    logEvent: vi.fn().mockResolvedValue(1),
  };
}

/** Crée une CryptoKey factice */
function createFakeKey(): CryptoKey {
  return {} as CryptoKey;
}

/**
 * Crée un mock d'IncidentService pour les tests initBootM2.
 * Capture les incidents loggués dans un tableau pour assertions.
 */
function createMockIncidentService(): {
  service: Partial<IncidentService>;
  incidents: Array<{ type: string; severity: string }>;
} {
  const incidents: Array<{ type: string; severity: string }> = [];
  const service: Partial<IncidentService> = {
    log: vi.fn(async (type, severity) => {
      incidents.push({ type, severity });
    }),
  };
  return { service, incidents };
}

// ---------------------------------------------------------------------------
// Tests : analyzeRisks
// ---------------------------------------------------------------------------

describe('analyzeRisks', () => {
  it('détecte le signal HTTP pour une URL en http://', () => {
    const result = analyzeRisks('http://example.com/login');
    expect(result.signals).toContain('http');
  });

  it('ne détecte pas le signal HTTP pour une URL en https://', () => {
    const result = analyzeRisks('https://example.com/login');
    expect(result.signals).not.toContain('http');
  });

  it('exclut localhost (SFD CA-M2-07)', () => {
    const result = analyzeRisks('http://localhost:8080/login');
    expect(result.signals).toHaveLength(0);
    expect(result.riskLevel).toBe(0);
  });

  it('exclut 127.0.0.1 (SFD CA-M2-07)', () => {
    const result = analyzeRisks('http://127.0.0.1:3000/login');
    expect(result.signals).toHaveLength(0);
    expect(result.riskLevel).toBe(0);
  });

  it('détecte le typosquatting pour paypa1.com (Levenshtein = 1)', () => {
    const result = analyzeRisks('https://paypa1.com/login');
    expect(result.signals).toContain('levenshtein');
  });

  it('détecte le typosquatting pour g00gle.com (Levenshtein = 2)', () => {
    const result = analyzeRisks('https://g00gle.com/search');
    expect(result.signals).toContain('levenshtein');
  });

  it('ne détecte pas de typosquatting pour un domaine très différent', () => {
    const result = analyzeRisks('https://xyz-sentinel-nudge-test-12345.com/');
    expect(result.signals).not.toContain('levenshtein');
  });

  it('ne détecte pas de typosquatting pour un domaine exact (distance = 0)', () => {
    const result = analyzeRisks('https://paypal.com/login');
    expect(result.signals).not.toContain('levenshtein');
  });

  it('retourne un résultat vide pour une URL invalide', () => {
    const result = analyzeRisks('not-a-valid-url');
    expect(result.signals).toHaveLength(0);
    expect(result.riskLevel).toBe(0);
  });

  it('retourne un riskLevel égal au nombre de signaux (max 4)', () => {
    const result = analyzeRisks('http://paypa1.com/login');
    expect(result.riskLevel).toBe(result.signals.length);
  });

  it('détecte HTTP + levenshtein pour une URL suspecte (≥ 2 signaux)', () => {
    // http:// → signal http, paypa1.com → levenshtein
    const result = analyzeRisks('http://paypa1.com/login');
    expect(result.signals).toContain('http');
    expect(result.signals).toContain('levenshtein');
    expect(result.riskLevel).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Tests : createM2Handler — validation du payload
// ---------------------------------------------------------------------------

describe('createM2Handler — validation du payload', () => {
  beforeEach(async () => {
    resetStorage();
    vi.clearAllMocks();
    // Pré-initialiser la session de déduplication vide
    await storage.set({ m2_session_domains: [] });
  });

  it('rejette une action inconnue', async () => {
    const mockStor = createMockStorage({});
    const handler = createM2Handler(mockStor as StorageService, createFakeKey());
    const msg = buildM2Message(
      { signals: ['http', 'hsts_miss'], domain_hash: DOMAIN_HASH_VALID },
      'unknown_action',
    );
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(false);
    expect(response.reason).toBe('unknown_action');
  });

  it('rejette un domain_hash invalide (format incorrect)', async () => {
    const mockStor = createMockStorage({});
    const handler = createM2Handler(mockStor as StorageService, createFakeKey());
    const msg = buildM2Message({ signals: ['http', 'hsts_miss'], domain_hash: 'invalid-hash' });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(false);
    expect(response.reason).toBe('invalid_domain_hash');
  });

  it("rejette si signals n'est pas un tableau", async () => {
    const mockStor = createMockStorage({});
    const handler = createM2Handler(mockStor as StorageService, createFakeKey());
    const msg = buildM2Message({ signals: 'http', domain_hash: DOMAIN_HASH_VALID });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(false);
    expect(response.reason).toBe('invalid_signals');
  });
});

// ---------------------------------------------------------------------------
// Tests : createM2Handler — logique métier
// ---------------------------------------------------------------------------

describe('createM2Handler — logique métier', () => {
  beforeEach(async () => {
    resetStorage();
    vi.clearAllMocks();
    await storage.set({ m2_session_domains: [] });
  });

  it('skip si moins de 2 signaux (SFD §2.1)', async () => {
    const mockStor = createMockStorage({});
    const handler = createM2Handler(mockStor as StorageService, createFakeKey());
    const msg = buildM2Message({
      signals: ['http'], // 1 seul signal
      domain_hash: DOMAIN_HASH_VALID,
    });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('skip');
    expect(response.reason).toBe('insufficient_signals');
  });

  it('skip si le domaine est en whitelist M2', async () => {
    const mockStor = createMockStorage({ isWhitelisted: true });
    const handler = createM2Handler(mockStor as StorageService, createFakeKey());
    const msg = buildM2Message({
      signals: ['http', 'hsts_miss'],
      domain_hash: DOMAIN_HASH_VALID,
    });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('skip');
    expect(response.reason).toBe('whitelisted');
  });

  it('skip si le domaine a déjà été nudgé dans cette session', async () => {
    await storage.set({ m2_session_domains: [DOMAIN_HASH_VALID] });
    const mockStor = createMockStorage({});
    const handler = createM2Handler(mockStor as StorageService, createFakeKey());
    const msg = buildM2Message({
      signals: ['http', 'hsts_miss'],
      domain_hash: DOMAIN_HASH_VALID,
    });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('skip');
    expect(response.reason).toBe('session_duplicate');
  });

  it('retourne show quand toutes les conditions sont remplies', async () => {
    const mockStor = createMockStorage({});
    const handler = createM2Handler(mockStor as StorageService, createFakeKey());
    const msg = buildM2Message({
      signals: ['http', 'hsts_miss'],
      domain_hash: DOMAIN_HASH_VALID,
    });
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(response.action).toBe('show');
    // Les signaux sont retournés dans data
    expect(response.data?.['signals']).toEqual(['http', 'hsts_miss']);
    expect(response.data?.['domain_hash']).toBe(DOMAIN_HASH_VALID);
  });

  it("enregistre le domaine en session après l'affichage", async () => {
    const mockStor = createMockStorage({});
    const handler = createM2Handler(mockStor as StorageService, createFakeKey());
    const msg = buildM2Message({
      signals: ['http', 'hsts_miss'],
      domain_hash: DOMAIN_HASH_VALID,
    });
    await handler(msg, {} as chrome.runtime.MessageSender);

    // La session doit contenir le domaine
    const session = (await storage.get('m2_session_domains'))['m2_session_domains'] as string[];
    expect(session).toContain(DOMAIN_HASH_VALID);
  });

  it("n'ajoute pas le domaine en session si skip (signaux insuffisants)", async () => {
    const mockStor = createMockStorage({});
    const handler = createM2Handler(mockStor as StorageService, createFakeKey());
    const msg = buildM2Message({
      signals: ['http'], // 1 signal → skip
      domain_hash: DOMAIN_HASH_VALID,
    });
    await handler(msg, {} as chrome.runtime.MessageSender);

    const session =
      ((await storage.get('m2_session_domains'))['m2_session_domains'] as string[]) ?? [];
    expect(session).not.toContain(DOMAIN_HASH_VALID);
  });

  it("logue l'événement pour M3 quand le nudge est affiché", async () => {
    const mockStor = createMockStorage({});
    const handler = createM2Handler(mockStor as StorageService, createFakeKey());
    const msg = buildM2Message({
      signals: ['http', 'hsts_miss'],
      domain_hash: DOMAIN_HASH_VALID,
    });
    await handler(msg, {} as chrome.runtime.MessageSender);

    expect(mockStor.logEvent).toHaveBeenCalledWith(
      'M2',
      expect.objectContaining({ action: 'shown', signals: ['http', 'hsts_miss'] }),
      expect.anything(),
    );
  });

  it('deux domaines différents dans la même session : les deux sont nudgés', async () => {
    const mockStor = createMockStorage({});
    const handler = createM2Handler(mockStor as StorageService, createFakeKey());

    // Premier domaine
    const msg1 = buildM2Message({
      signals: ['http', 'hsts_miss'],
      domain_hash: DOMAIN_HASH_VALID,
    });
    const resp1 = await handler(msg1, {} as chrome.runtime.MessageSender);
    expect(resp1.action).toBe('show');

    // Deuxième domaine différent
    const msg2 = buildM2Message({
      signals: ['http', 'levenshtein'],
      domain_hash: DOMAIN_HASH_OTHER,
    });
    const resp2 = await handler(msg2, {} as chrome.runtime.MessageSender);
    expect(resp2.action).toBe('show');
  });
});

// ---------------------------------------------------------------------------
// Tests : createM2Handler — action overlay_action
// ---------------------------------------------------------------------------

describe('createM2Handler — overlay_action', () => {
  beforeEach(async () => {
    resetStorage();
    vi.clearAllMocks();
    await storage.set({ m2_session_domains: [] });
  });

  it('ajoute le domaine en whitelist quand user_action=trusted', async () => {
    const mockStor = createMockStorage({});
    const handler = createM2Handler(mockStor as StorageService, createFakeKey());
    const msg = buildM2Message(
      { user_action: 'trusted', domain_hash: DOMAIN_HASH_VALID, signals: ['http', 'hsts_miss'] },
      'overlay_action',
    );
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(mockStor.addToWhitelist).toHaveBeenCalledWith(DOMAIN_HASH_VALID, 'M2');
  });

  it("enregistre l'événement pour dismissed", async () => {
    const mockStor = createMockStorage({});
    const handler = createM2Handler(mockStor as StorageService, createFakeKey());
    const msg = buildM2Message(
      { user_action: 'dismissed', domain_hash: DOMAIN_HASH_VALID, signals: ['http', 'hsts_miss'] },
      'overlay_action',
    );
    await handler(msg, {} as chrome.runtime.MessageSender);

    expect(mockStor.logEvent).toHaveBeenCalledWith(
      'M2',
      expect.objectContaining({ action: 'dismissed' }),
      expect.anything(),
    );
  });

  it('rejette un payload sans user_action', async () => {
    const mockStor = createMockStorage({});
    const handler = createM2Handler(mockStor as StorageService, createFakeKey());
    const msg = buildM2Message({ domain_hash: DOMAIN_HASH_VALID }, 'overlay_action');
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(false);
    expect(response.reason).toBe('invalid_overlay_payload');
  });
});

// ---------------------------------------------------------------------------
// Tests : initBootM2 — ADR-001 SW-BOOT-CONTRACT (TACHE-085)
// ---------------------------------------------------------------------------

describe('initBootM2 — boot happy path (whitelist valide présente)', () => {
  beforeEach(() => {
    resetStorage();
    vi.clearAllMocks();
  });

  it("TC-M2-BOOT-01 : whitelist valide présente → ready=true, pas d'incident", async () => {
    // Setup : whitelist valide dans le storage
    const validWhitelist = ['paypal.com', 'google.com', 'amazon.com'];
    await storage.set({ whitelist_m2: validWhitelist });

    const { service, incidents } = createMockIncidentService();
    const diag = await initBootM2(service as IncidentService);

    expect(diag.ready).toBe(true);
    expect(diag.whitelist_size).toBe(3);
    expect(diag.last_boot_ts).toBeGreaterThan(0);
    expect(diag.last_incident).toBeUndefined();
    expect(incidents).toHaveLength(0);
  });

  it('TC-M2-BOOT-02 : diagnostics.m2 persiste ready=true dans chrome.storage.local', async () => {
    await storage.set({ whitelist_m2: ['paypal.com', 'google.com'] });

    const { service } = createMockIncidentService();
    await initBootM2(service as IncidentService);

    const stored = (await storage.get('diagnostics.m2'))['diagnostics.m2'] as Record<
      string,
      unknown
    >;
    expect(stored).toBeDefined();
    expect(stored['ready']).toBe(true);
    expect(stored['whitelist_size']).toBe(2);
    expect(typeof stored['last_boot_ts']).toBe('number');
  });

  it('TC-M2-BOOT-03 : whitelist valide → whitelist_m2 non modifiée', async () => {
    const validWhitelist = ['paypal.com', 'amazon.com'];
    await storage.set({ whitelist_m2: validWhitelist });

    const { service } = createMockIncidentService();
    await initBootM2(service as IncidentService);

    // La whitelist ne doit pas être réécrite quand elle est valide
    const stored = (await storage.get('whitelist_m2'))['whitelist_m2'];
    expect(stored).toEqual(validWhitelist);
  });

  it("TC-M2-BOOT-04 : readM2Diagnostics retourne l'état persisté après boot", async () => {
    await storage.set({ whitelist_m2: ['paypal.com', 'google.com', 'amazon.com'] });

    const { service } = createMockIncidentService();
    await initBootM2(service as IncidentService);

    const diag = await readM2Diagnostics();
    expect(diag.ready).toBe(true);
    expect(diag.whitelist_size).toBe(3);
  });
});

describe('initBootM2 — whitelist absente (premier boot)', () => {
  beforeEach(() => {
    resetStorage();
    vi.clearAllMocks();
  });

  it('TC-M2-BOOT-05 : whitelist absente → régénération depuis typosquatting-targets.json', async () => {
    // Aucune whitelist dans le storage (premier install)

    const { service, incidents } = createMockIncidentService();
    const diag = await initBootM2(service as IncidentService);

    // La whitelist doit avoir été régénérée
    expect(diag.ready).toBe(true);
    expect(diag.whitelist_size).toBeGreaterThan(0);

    // La whitelist doit être présente dans le storage
    const stored = (await storage.get('whitelist_m2'))['whitelist_m2'];
    expect(Array.isArray(stored)).toBe(true);
    expect((stored as string[]).length).toBeGreaterThan(0);
  });

  it('TC-M2-BOOT-06 : whitelist absente → incident whitelist_regenerated (warn)', async () => {
    const { service, incidents } = createMockIncidentService();
    await initBootM2(service as IncidentService);

    // Doit y avoir un incident whitelist_regenerated
    const regeneratedIncident = incidents.find((i) => i.type === 'whitelist_regenerated');
    expect(regeneratedIncident).toBeDefined();
    expect(regeneratedIncident?.severity).toBe('warn');
  });

  it('TC-M2-BOOT-07 : whitelist absente → diagnostics.m2.last_incident reflète le warn', async () => {
    const { service } = createMockIncidentService();
    const diag = await initBootM2(service as IncidentService);

    expect(diag.last_incident).toBeDefined();
    expect(diag.last_incident?.type).toBe('whitelist_regenerated');
    expect(diag.last_incident?.severity).toBe('warn');
    expect(diag.last_incident?.ts).toBeGreaterThan(0);
  });

  it("TC-M2-BOOT-08 : whitelist absente → PAS d'incident whitelist_corrupted", async () => {
    const { service, incidents } = createMockIncidentService();
    await initBootM2(service as IncidentService);

    const corruptedIncident = incidents.find((i) => i.type === 'whitelist_corrupted');
    expect(corruptedIncident).toBeUndefined();
  });
});

describe('initBootM2 — whitelist corrompue (shape invalide)', () => {
  beforeEach(() => {
    resetStorage();
    vi.clearAllMocks();
  });

  it('TC-M2-BOOT-09 : whitelist = objet non-tableau → incident whitelist_corrupted (error)', async () => {
    // Corruption : l'entrée est un objet au lieu d'un tableau
    await storage.set({ whitelist_m2: { corrupted: true } });

    const { service, incidents } = createMockIncidentService();
    const diag = await initBootM2(service as IncidentService);

    const corruptedIncident = incidents.find((i) => i.type === 'whitelist_corrupted');
    expect(corruptedIncident).toBeDefined();
    expect(corruptedIncident?.severity).toBe('error');

    // Après corruption → régénération → ready=true
    expect(diag.ready).toBe(true);
  });

  it('TC-M2-BOOT-10 : whitelist corrompue → incident whitelist_regenerated (warn) après corruption', async () => {
    await storage.set({ whitelist_m2: 'not-an-array' });

    const { service, incidents } = createMockIncidentService();
    await initBootM2(service as IncidentService);

    const regeneratedIncident = incidents.find((i) => i.type === 'whitelist_regenerated');
    expect(regeneratedIncident).toBeDefined();
    expect(regeneratedIncident?.severity).toBe('warn');
  });

  it('TC-M2-BOOT-11 : whitelist = tableau vide → traitée comme invalide → régénération', async () => {
    // Un tableau vide ne satisfait pas l'invariant INV-M2-01 (whitelist_size > 0 si ready=true)
    await storage.set({ whitelist_m2: [] });

    const { service, incidents } = createMockIncidentService();
    const diag = await initBootM2(service as IncidentService);

    // Tableau vide = invalide (isValidWhitelist retourne false si length=0)
    // → régénération depuis le JSON embarqué
    expect(diag.whitelist_size).toBeGreaterThan(0);
    const regeneratedIncident = incidents.find((i) => i.type === 'whitelist_regenerated');
    expect(regeneratedIncident).toBeDefined();
  });

  it('TC-M2-BOOT-12 : whitelist corrompue → whitelist_m2 régénérée dans storage', async () => {
    await storage.set({ whitelist_m2: 42 }); // nombre = shape invalide

    const { service } = createMockIncidentService();
    await initBootM2(service as IncidentService);

    const stored = (await storage.get('whitelist_m2'))['whitelist_m2'];
    expect(Array.isArray(stored)).toBe(true);
    expect((stored as string[]).length).toBeGreaterThan(0);
    // Vérifier que ce sont bien des strings de domaines
    expect(typeof (stored as string[])[0]).toBe('string');
  });

  it('TC-M2-BOOT-13 : whitelist corrompue → diagnostics.m2.last_incident de type whitelist_corrupted', async () => {
    await storage.set({ whitelist_m2: { invalid: 'object' } });

    const { service } = createMockIncidentService();
    const diag = await initBootM2(service as IncidentService);

    expect(diag.last_incident).toBeDefined();
    expect(diag.last_incident?.type).toBe('whitelist_corrupted');
    expect(diag.last_incident?.severity).toBe('error');
  });

  it('TC-M2-BOOT-14 : whitelist avec entrées non-string → régénération', async () => {
    // Tableau avec entrées non conformes (nombres au lieu de strings)
    await storage.set({ whitelist_m2: [1, 2, 3] });

    const { service, incidents } = createMockIncidentService();
    const diag = await initBootM2(service as IncidentService);

    expect(diag.ready).toBe(true);
    const stored = (await storage.get('whitelist_m2'))['whitelist_m2'] as string[];
    expect(typeof stored[0]).toBe('string');
    expect(incidents.some((i) => i.type === 'whitelist_corrupted')).toBe(true);
  });
});

describe('initBootM2 — état initial conservatif', () => {
  beforeEach(() => {
    resetStorage();
    vi.clearAllMocks();
  });

  it('TC-M2-BOOT-15 : diagnostics.m2 posé à ready=false au début du boot (état conservatif)', async () => {
    // Whitelist valide — vérifie que l'état conservatif est posé avant la validation
    await storage.set({ whitelist_m2: ['paypal.com'] });

    let conservativeStateObserved = false;
    let callCount = 0;

    // Espionner storage.set pour intercepter le premier appel (état conservatif)
    const originalSet = storage.set.bind(storage);
    const spy = vi.spyOn(storage, 'set').mockImplementation(async (items, callback) => {
      callCount++;
      if (callCount === 1 && items['diagnostics.m2']) {
        const diag = items['diagnostics.m2'] as Record<string, unknown>;
        if (diag['ready'] === false) {
          conservativeStateObserved = true;
        }
      }
      return originalSet(items, callback);
    });

    const { service } = createMockIncidentService();
    await initBootM2(service as IncidentService);

    spy.mockRestore();
    expect(conservativeStateObserved).toBe(true);
  });

  it('TC-M2-BOOT-16 : readM2Diagnostics retourne défaut si diagnostics.m2 absent', async () => {
    // Aucun diagnostics dans le storage
    const diag = await readM2Diagnostics();

    expect(diag.ready).toBe(false);
    expect(diag.last_boot_ts).toBe(0);
    expect(diag.whitelist_size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests : createM2Handler — plafond whitelist M2 (T-043)
// ---------------------------------------------------------------------------

describe('createM2Handler — plafond whitelist M2 (T-043)', () => {
  beforeEach(async () => {
    resetStorage();
    vi.clearAllMocks();
    await storage.set({ m2_session_domains: [] });
  });

  it('TC-M2-WL-01 : ajout sous le plafond (count=1) → addToWhitelist appelé', async () => {
    // 1 entrée seulement → ajout autorisé (bien en dessous du plafond 10 000)
    const mockStor = createMockStorage({ whitelistCount: 1 });
    const { service } = createMockIncidentService();
    const handler = createM2Handler(
      mockStor as StorageService,
      createFakeKey(),
      service as IncidentService,
    );

    const msg = buildM2Message(
      { user_action: 'trusted', domain_hash: DOMAIN_HASH_VALID, signals: ['http', 'hsts_miss'] },
      'overlay_action',
    );
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(mockStor.addToWhitelist).toHaveBeenCalledWith(DOMAIN_HASH_VALID, 'M2');
  });

  it('TC-M2-WL-02 : ajout à la 9999e entrée (count=9999) → addToWhitelist appelé', async () => {
    // 9 999 entrées → encore sous le plafond de 10 000
    const mockStor = createMockStorage({ whitelistCount: 9999 });
    const { service } = createMockIncidentService();
    const handler = createM2Handler(
      mockStor as StorageService,
      createFakeKey(),
      service as IncidentService,
    );

    const msg = buildM2Message(
      { user_action: 'trusted', domain_hash: DOMAIN_HASH_VALID, signals: ['http', 'hsts_miss'] },
      'overlay_action',
    );
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(mockStor.addToWhitelist).toHaveBeenCalledWith(DOMAIN_HASH_VALID, 'M2');
  });

  it('TC-M2-WL-03 : plafond atteint (count=10000) → rejet + incident m2_whitelist_full severity=warn', async () => {
    // 10 000 entrées exactement → plafond atteint, ajout rejeté (Option A T-043)
    const mockStor = createMockStorage({ whitelistCount: 10000 });
    const { service, incidents } = createMockIncidentService();
    const handler = createM2Handler(
      mockStor as StorageService,
      createFakeKey(),
      service as IncidentService,
    );

    const msg = buildM2Message(
      { user_action: 'trusted', domain_hash: DOMAIN_HASH_VALID, signals: ['http', 'hsts_miss'] },
      'overlay_action',
    );
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    // Réponse OK côté utilisateur (pas d'erreur visible)
    expect(response.success).toBe(true);
    // addToWhitelist PAS appelé (Option A : rejet silencieux)
    expect(mockStor.addToWhitelist).not.toHaveBeenCalled();
    // Incident m2_whitelist_full (severity=warn) enregistré
    expect(incidents).toHaveLength(1);
    expect(incidents[0]).toEqual({ type: 'm2_whitelist_full', severity: 'warn' });
  });

  it('TC-M2-WL-04 : état legacy (count>10000) → rejet sans crash', async () => {
    // État legacy : whitelist déjà > 10 000 (migration depuis version sans limite)
    const mockStor = createMockStorage({ whitelistCount: 12345 });
    const { service, incidents } = createMockIncidentService();
    const handler = createM2Handler(
      mockStor as StorageService,
      createFakeKey(),
      service as IncidentService,
    );

    const msg = buildM2Message(
      { user_action: 'trusted', domain_hash: DOMAIN_HASH_VALID, signals: ['http', 'hsts_miss'] },
      'overlay_action',
    );
    // Ne doit pas lever d'exception même avec un count > plafond
    const response = await handler(msg, {} as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(mockStor.addToWhitelist).not.toHaveBeenCalled();
    expect(incidents).toHaveLength(1);
    expect(incidents[0].type).toBe('m2_whitelist_full');
  });
});