/**
 * @file tests/unit/pages/options/handle-export-whitelist-fusion.test.ts
 * @description Tests unitaires — T-042 fusion whitelist chrome.storage.local + IDB.
 *
 * Contexte RGPD :
 *   T-042 (Art. 20 RGPD — portabilité) : l'export doit inclure l'intégralité de la
 *   whitelist de confiance de l'utilisateur, quelle que soit la source de stockage :
 *   - IndexedDB (source courante — WhitelistEntry avec domain_hash, module, added_at)
 *   - chrome.storage.local['m2_whitelist'] (source legacy — Array<string> de domain_hash)
 *
 * Stratégie de test :
 *   On teste directement `mergeWhitelists()` depuis le module utilitaire
 *   `src/shared/utils/whitelist-merge.ts`, puis on teste la logique de fusion
 *   intégrée dans `simulateHandleExport()` (miroir de handleExport dans options.ts)
 *   avec des mocks browser-adapter pour chrome.storage.local et browser.runtime.sendMessage.
 *
 * Cas de test :
 *   TC-01 : IDB seul (legacyDomains absent) → résultat = entrées IDB uniquement
 *   TC-02 : chrome.storage seul (IDB vide) → résultat = entrées legacy converties en WhitelistEntry
 *   TC-03 : Les deux sources avec doublons → dédoublonnage (IDB prioritaire, ajout legacy manquants)
 *   TC-04 : Les deux sources sans doublons → union complète des deux sources
 *   TC-05 : legacyDomains vide ou null → seules les entrées IDB sont retournées
 *   TC-06 : Entrées legacy avec valeur invalide (non-string, string vide) → ignorées
 *   TC-07 : Résultat trié par added_at croissant (legacy à 0 en tête)
 *   TC-08 : Export complet — whitelist fusionnée présente dans le payload final
 *
 * Référence : T-042, Art. 20 RGPD, DAT §8.3, whitelist-merge.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mergeWhitelists } from '@/shared/utils/whitelist-merge';
import type { WhitelistEntry, ExportPayload } from '@/shared/types/storage';

// ---------------------------------------------------------------------------
// Mocks — factories vi.mock hoistées en tête de fichier
// ---------------------------------------------------------------------------

const mockSendMessage = vi.fn();
const mockStorageGet = vi.fn();

vi.mock('@/shared/browser/browser-adapter', () => ({
  browser: {
    i18n: {
      getMessage: (key: string) => key,
    },
    storage: {
      local: {
        get: (...args: unknown[]) => mockStorageGet(...args),
      },
    },
    runtime: {
      getManifest: () => ({ version: '1.0.0-test' }),
      getURL: (path: string) => `chrome-extension://test/${path}`,
      sendMessage: (...args: unknown[]) => mockSendMessage(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Helpers de fixtures
// ---------------------------------------------------------------------------

/**
 * Crée une entrée whitelist IDB de test.
 *
 * @param domainHash - Hash du domaine
 * @param module     - Module propriétaire (défaut M2)
 * @param addedAt    - Timestamp d'ajout (défaut Date.now())
 * @returns WhitelistEntry
 */
function makeIdbEntry(domainHash: string, module = 'M2', addedAt = Date.now()): WhitelistEntry {
  return { domain_hash: domainHash, module, added_at: addedAt };
}

/**
 * Réponses SW standards pour les stores non-whitelist.
 * Évite de polluer les tests avec les autres stores.
 */
const SW_NON_WHITELIST_RESPONSES: Record<string, unknown> = {
  get_all_events: { success: true, events: [] },
  get_all_quiz_sessions: { success: true, sessions: [] },
  get_all_scores: { success: true, scores: [] },
  get_password_hash_meta: { success: true, count: 0, oldest: '', newest: '' },
};

/**
 * Simule handleExport() — miroir de la logique de fusion dans options.ts (T-042).
 *
 * Récupère la whitelist IDB via le SW + les entrées legacy depuis chrome.storage.local,
 * puis fusionne via mergeWhitelists. Conforme à la séquence implémentée dans
 * handleExport() de src/pages/options/options.ts.
 *
 * @returns ExportPayload avec whitelist fusionnée
 */
async function simulateHandleExportWithFusion(): Promise<ExportPayload> {
  const { browser } = await import('@/shared/browser/browser-adapter');

  // Stores standards
  const eventsResponse = (await browser.runtime.sendMessage({
    module: 'EXPORT',
    action: 'get_all_events',
    payload: {},
    timestamp: Date.now(),
  })) as { success: boolean; events?: unknown[] } | undefined;
  const events = eventsResponse?.success ? (eventsResponse.events ?? []) : [];

  const quizResponse = (await browser.runtime.sendMessage({
    module: 'EXPORT',
    action: 'get_all_quiz_sessions',
    payload: {},
    timestamp: Date.now(),
  })) as { success: boolean; sessions?: unknown[] } | undefined;
  const quizSessions = quizResponse?.success ? (quizResponse.sessions ?? []) : [];

  const scoresResponse = (await browser.runtime.sendMessage({
    module: 'M3',
    action: 'get_all_scores',
    payload: {},
    timestamp: Date.now(),
  })) as { success: boolean; scores?: unknown[] } | undefined;
  const weeklyScores = scoresResponse?.success ? (scoresResponse.scores ?? []) : [];

  const pwHashResponse = (await browser.runtime.sendMessage({
    module: 'EXPORT',
    action: 'get_password_hash_meta',
    payload: {},
    timestamp: Date.now(),
  })) as { success: boolean; count?: number; oldest?: string; newest?: string } | undefined;
  const passwordHashes = {
    count: pwHashResponse?.count ?? 0,
    oldest: pwHashResponse?.oldest ?? '',
    newest: pwHashResponse?.newest ?? '',
  };

  // T-042 — 1. Whitelist IDB via SW
  const whitelistResponse = (await browser.runtime.sendMessage({
    module: 'EXPORT',
    action: 'get_whitelist',
    payload: {},
    timestamp: Date.now(),
  })) as { success: boolean; whitelist?: WhitelistEntry[] } | undefined;
  const idbWhitelist: WhitelistEntry[] = whitelistResponse?.success
    ? (whitelistResponse.whitelist ?? [])
    : [];

  // T-042 — 2. Whitelist legacy depuis chrome.storage.local['m2_whitelist']
  const legacyStorage = await browser.storage.local.get(['m2_whitelist']);
  const legacyDomains = (legacyStorage as Record<string, unknown>)['m2_whitelist'] as
    | string[]
    | undefined;

  // T-042 — 3. Fusion
  const whitelist: WhitelistEntry[] = mergeWhitelists(idbWhitelist, legacyDomains);

  return {
    version: '1.0',
    exported_at: new Date().toISOString(),
    extension_version: '1.0.0-test',
    config: {
      modules: { M2: true, M3: true, M5: true, M6: true, M7: false, M9: true, M17: true },
      quota_limit: 3,
      profile: 'beginner',
      onboarding_complete: false,
      language: 'fr',
    },
    data: {
      events: events as ExportPayload['data']['events'],
      password_hashes: passwordHashes,
      quiz_sessions: quizSessions as ExportPayload['data']['quiz_sessions'],
      weekly_scores: weeklyScores as ExportPayload['data']['weekly_scores'],
      whitelist,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests unitaires — mergeWhitelists (logique pure)
// ---------------------------------------------------------------------------

describe('mergeWhitelists — logique pure', () => {
  // TC-01 : IDB seul, pas de legacy
  it('TC-01: IDB seul (legacyDomains absent) → résultat = entrées IDB uniquement', () => {
    const idb: WhitelistEntry[] = [
      makeIdbEntry('hash-alpha', 'M2', 1000),
      makeIdbEntry('hash-beta', 'M7', 2000),
    ];

    const result = mergeWhitelists(idb, undefined);

    expect(result).toHaveLength(2);
    expect(result[0].domain_hash).toBe('hash-alpha');
    expect(result[1].domain_hash).toBe('hash-beta');
    // Vérifie que les métadonnées IDB sont conservées
    expect(result[0].added_at).toBe(1000);
    expect(result[1].module).toBe('M7');
  });

  // TC-02 : chrome.storage seul, IDB vide
  it('TC-02: chrome.storage seul (IDB vide) → entrées legacy converties en WhitelistEntry', () => {
    const legacyDomains = ['hash-gamma', 'hash-delta'];

    const result = mergeWhitelists([], legacyDomains);

    expect(result).toHaveLength(2);
    expect(result.find((e) => e.domain_hash === 'hash-gamma')).toBeDefined();
    expect(result.find((e) => e.domain_hash === 'hash-delta')).toBeDefined();
    // Les entrées legacy ont module='M2' et added_at=0 (timestamp inconnu)
    expect(result[0].module).toBe('M2');
    expect(result[0].added_at).toBe(0);
  });

  // TC-03 : Les deux sources avec doublons → dédoublonnage IDB prioritaire
  it('TC-03: doublons entre IDB et legacy → dédoublonnage (IDB prioritaire)', () => {
    const idb: WhitelistEntry[] = [
      makeIdbEntry('hash-shared', 'M2', 5000), // même domaine que legacy
      makeIdbEntry('hash-idb-only', 'M2', 6000),
    ];
    const legacyDomains = [
      'hash-shared', // doublon — doit être ignoré (IDB prioritaire)
      'hash-legacy-only', // nouveau — doit être ajouté
    ];

    const result = mergeWhitelists(idb, legacyDomains);

    // 3 entrées : hash-shared(IDB), hash-idb-only, hash-legacy-only
    expect(result).toHaveLength(3);

    // L'entrée IDB de hash-shared est conservée (added_at réel)
    const shared = result.find((e) => e.domain_hash === 'hash-shared');
    expect(shared).toBeDefined();
    expect(shared!.added_at).toBe(5000); // IDB gagne
    expect(shared!.module).toBe('M2');

    // L'entrée legacy-only est ajoutée avec added_at=0
    const legacyOnly = result.find((e) => e.domain_hash === 'hash-legacy-only');
    expect(legacyOnly).toBeDefined();
    expect(legacyOnly!.added_at).toBe(0);
  });

  // TC-04 : Les deux sources sans doublons → union complète
  it('TC-04: deux sources sans doublons → union complète des deux sources', () => {
    const idb: WhitelistEntry[] = [
      makeIdbEntry('hash-idb-1', 'M2', 1000),
      makeIdbEntry('hash-idb-2', 'M7', 2000),
    ];
    const legacyDomains = ['hash-leg-1', 'hash-leg-2', 'hash-leg-3'];

    const result = mergeWhitelists(idb, legacyDomains);

    // 5 entrées au total (2 IDB + 3 legacy)
    expect(result).toHaveLength(5);

    const hashes = result.map((e) => e.domain_hash);
    expect(hashes).toContain('hash-idb-1');
    expect(hashes).toContain('hash-idb-2');
    expect(hashes).toContain('hash-leg-1');
    expect(hashes).toContain('hash-leg-2');
    expect(hashes).toContain('hash-leg-3');
  });

  // TC-05 : legacyDomains vide ou null → IDB seul
  it('TC-05: legacyDomains vide ou null → seules les entrées IDB retournées', () => {
    const idb: WhitelistEntry[] = [makeIdbEntry('hash-only', 'M2', 9000)];
    const expected = [{ domain_hash: 'hash-only', module: 'M2', added_at: 9000 }];

    expect(mergeWhitelists(idb, [])).toEqual(expected);
    expect(mergeWhitelists(idb, null)).toEqual(expected);
    expect(mergeWhitelists(idb, undefined)).toEqual(expected);
  });

  // TC-06 : Entrées legacy invalides (non-string, string vide) → ignorées
  it('TC-06: entrées legacy invalides (non-string, string vide) → ignorées sans erreur', () => {
    const legacyDomains = [
      'hash-valid',
      '', // vide → ignoré
      42 as unknown as string, // non-string → ignoré
      null as unknown as string, // null → ignoré
    ];

    const result = mergeWhitelists([], legacyDomains);

    // Seule l'entrée valide est intégrée
    expect(result).toHaveLength(1);
    expect(result[0].domain_hash).toBe('hash-valid');
  });

  // TC-07 : Résultat trié par added_at croissant
  it('TC-07: résultat trié par added_at croissant (entrées legacy à 0 en premier)', () => {
    const idb: WhitelistEntry[] = [
      makeIdbEntry('hash-late', 'M2', 5000),
      makeIdbEntry('hash-early', 'M2', 1000),
    ];
    const legacyDomains = ['hash-legacy']; // added_at = 0

    const result = mergeWhitelists(idb, legacyDomains);

    expect(result).toHaveLength(3);
    // Ordre attendu : legacy(0) → early(1000) → late(5000)
    expect(result[0].domain_hash).toBe('hash-legacy');
    expect(result[0].added_at).toBe(0);
    expect(result[1].domain_hash).toBe('hash-early');
    expect(result[1].added_at).toBe(1000);
    expect(result[2].domain_hash).toBe('hash-late');
    expect(result[2].added_at).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// Tests intégrés — fusion dans le payload d'export (simulateHandleExportWithFusion)
// ---------------------------------------------------------------------------

describe('handleExport — whitelist fusionnée dans le payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // SW : réponses standards pour les stores non-whitelist
    mockSendMessage.mockImplementation((msg: { action: string }) => {
      return SW_NON_WHITELIST_RESPONSES[msg.action] ?? undefined;
    });

    // chrome.storage.local : pas de m2_whitelist par défaut
    mockStorageGet.mockResolvedValue({});
  });

  // TC-08 : Export complet — whitelist fusionnée présente dans le payload final
  it('TC-08: whitelist fusionnée présente dans data.whitelist du payload final', async () => {
    const idbEntries: WhitelistEntry[] = [makeIdbEntry('hash-idb-export', 'M2', 3000)];
    const legacyEntries = ['hash-legacy-export'];

    // SW retourne les entrées IDB
    mockSendMessage.mockImplementation((msg: { action: string }) => {
      if (msg.action === 'get_whitelist') {
        return { success: true, whitelist: idbEntries };
      }
      return SW_NON_WHITELIST_RESPONSES[msg.action] ?? undefined;
    });

    // chrome.storage.local retourne les entrées legacy
    mockStorageGet.mockResolvedValue({ m2_whitelist: legacyEntries });

    const result = await simulateHandleExportWithFusion();

    // La whitelist fusionnée doit contenir les 2 entrées
    expect(result.data.whitelist).toHaveLength(2);

    const hashes = result.data.whitelist.map((e) => e.domain_hash);
    expect(hashes).toContain('hash-idb-export');
    expect(hashes).toContain('hash-legacy-export');

    // L'entrée IDB conserve son added_at réel
    const idbEntry = result.data.whitelist.find((e) => e.domain_hash === 'hash-idb-export');
    expect(idbEntry?.added_at).toBe(3000);

    // L'entrée legacy a added_at=0 et module='M2'
    const legacyEntry = result.data.whitelist.find((e) => e.domain_hash === 'hash-legacy-export');
    expect(legacyEntry?.added_at).toBe(0);
    expect(legacyEntry?.module).toBe('M2');

    // Stores obligatoires Art. 20 toujours présents
    expect(result).toHaveProperty('data.events');
    expect(result).toHaveProperty('data.quiz_sessions');
    expect(result).toHaveProperty('data.weekly_scores');
    expect(result).toHaveProperty('data.password_hashes');
    expect(result).toHaveProperty('version');
    expect(result).toHaveProperty('exported_at');
  });
});
