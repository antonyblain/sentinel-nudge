/**
 * @file background/handlers/m7-handler.ts
 * @description Handler service worker pour le module M7 (réutilisation mot de passe).
 *
 * Reçoit les hashes de mots de passe envoyés par le content script au submit.
 * Effectue la détection de réutilisation inter-domaines et orchestre l'affichage du toast.
 *
 * Algorithme principal (action 'password_submitted') :
 * 1. Validation du hash (64 chars hex, domain_hash valide)
 * 2. Vérification de réutilisation AVANT stockage
 * 3. Stockage du nouveau hash (FIFO 100 max)
 * 4. Si réutilisation détectée : suppression_list + délai 30j + quota
 * 5. Si conditions remplies : renvoyer instruction d'affichage toast
 *
 * Action 'toast_action' (retour du content script après interaction utilisateur) :
 * - Enregistre l'action utilisateur, gère la suppression_list, ouvre la page d'explication
 *
 * Gestion suppression_list :
 * - Stockée dans IndexedDB store `whitelist` avec module='M7'
 * - Clé composite [domain_hash, module='M7'] (SFD §2.5.3)
 *
 * Sécurité (D-SEC-001) :
 * - Le hash de mot de passe est chiffré AES-256-GCM avant stockage
 * - Le tag en clair (8 chars hex) est acceptable (collision > 1/4 milliards)
 *
 * M7 est un module critique (CRITICAL_MODULES) : bypass quota automatique par MessageRouter.
 * Le rate-limit est assuré par le cooldown 30j par domaine + suppression_list.
 *
 * TACHE-091 (R-CLI-03) : migration pending_m7_toast timestamp → expires_at.
 * - writePendingM7Toast() écrit toujours en nouveau format (expires_at).
 * - readPendingM7Toast() accepte les deux shapes (legacy + nouveau) et migre à la lecture.
 * - Exception E-CLI-01 (ADR-002) supprimée : M7 est désormais conforme R-CLI-03.
 *
 * Référence : SFD §2.5 (M7), DAT §8.1 (store password_hashes), §9.4 (D-SEC-001)
 *             ADR-002 R-CLI-03 (expires_at — TACHE-091)
 */

import { StorageService } from '@/background/storage-service';
import { browser } from '@/shared/browser/browser-adapter';
import { extractTag } from '@/shared/utils/hash';
import { createLogger, Logger } from '@/shared/utils/logger';
import type { NudgeMessage, NudgeResponse } from '@/shared/types/messages';
import type { ModuleHandler } from '@/background/message-router';
import type { PasswordHashRecord } from '@/shared/types/storage';
import type { HeartbeatService } from '@/background/services/heartbeat-service';
import type { IncidentService } from '@/background/services/incident-service';
import type { PendingM7Toast, PendingM7ToastLegacy } from '@/shared/types/diagnostics';
import { PENDING_M7_TOAST_KEY, PENDING_M7_TOAST_TTL_MS } from '@/shared/types/diagnostics';

/** Logger scopé M7Handler — mitigation R-M7-08 / TACHE-083 */
const logger = createLogger('M7Handler');

/** Nombre maximum de hashes stockés en IndexedDB (FIFO) */
const MAX_HASHES = 100;

/** Délai minimum entre deux nudges M7 pour le même domaine (30 jours en ms) */
const NUDGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

/** Clé chrome.storage.local pour les timestamps des derniers nudges M7 par domaine */
const M7_LAST_NUDGE_KEY = 'm7_last_nudge_by_domain';

// ---------------------------------------------------------------------------
// INV-UC03-04 : déduplication (hash, domain_hash) sur fenêtre 2s
// Volatile — reset au wake SW, accepté (cf. mini-DAT TACHE-070 §INV-UC03-04)
// ---------------------------------------------------------------------------

/** Map<"hash|domain_hash", timestamp> des derniers submits reçus */
const recentSubmits = new Map<string, number>();

/** Durée de la fenêtre de déduplication en millisecondes */
const DEDUP_WINDOW_MS = 2_000;

/**
 * Vérifie si un couple (hash, domainHash) est un doublon dans la fenêtre de 2s.
 * Si non-doublon, enregistre le timestamp.
 *
 * @param hash       - SHA-256 du mot de passe soumis
 * @param domainHash - SHA-256 du domaine source
 * @returns true si doublon (à dropper), false si nouveau
 */
function isDuplicateSubmit(hash: string, domainHash: string): boolean {
  const key = `${hash}|${domainHash}`;
  const now = Date.now();

  // Purge opportuniste des entrées expirées
  for (const [k, ts] of recentSubmits.entries()) {
    if (now - ts > DEDUP_WINDOW_MS) recentSubmits.delete(k);
  }

  const lastSeen = recentSubmits.get(key);
  if (lastSeen !== undefined && now - lastSeen < DEDUP_WINDOW_MS) {
    return true; // doublon, drop
  }
  recentSubmits.set(key, now);
  return false;
}

/** Payload attendu du content script pour l'action 'password_submitted' */
interface M7SubmitPayload {
  /** SHA-256(installation_salt + password_value) */
  hash: string;
  /** SHA-256(installation_salt + domain) */
  domain_hash: string;
}

/**
 * Lit le dictionnaire des derniers nudges M7 par domaine depuis chrome.storage.local.
 *
 * @returns Dictionnaire { domain_hash → timestamp } ou {} si absent
 */
async function getLastNudgeByDomain(): Promise<Record<string, number>> {
  try {
    const result = await browser.storage.local.get([M7_LAST_NUDGE_KEY]);
    const data = result[M7_LAST_NUDGE_KEY];
    if (!data || typeof data !== 'object') return {};
    return data as Record<string, number>;
  } catch {
    return {};
  }
}

/**
 * Enregistre le timestamp du dernier nudge M7 pour un domaine.
 *
 * @param domainHash - Hash salé du domaine
 */
async function setLastNudgeTimestamp(domainHash: string): Promise<void> {
  const current = await getLastNudgeByDomain();
  current[domainHash] = Date.now();
  await browser.storage.local.set({ [M7_LAST_NUDGE_KEY]: current });
}

/**
 * Vérifie si le domaine est dans la suppression_list M7 (IndexedDB store whitelist).
 *
 * @param storageService - Service de stockage IndexedDB
 * @param domainHash     - Hash salé du domaine à vérifier
 * @returns true si le domaine est supprimé
 */
async function isDomainSuppressed(
  storageService: StorageService,
  domainHash: string,
): Promise<boolean> {
  return storageService.isWhitelisted(domainHash, 'M7');
}

/**
 * Ajoute un domaine à la suppression_list M7 dans IndexedDB.
 *
 * @param storageService - Service de stockage IndexedDB
 * @param domainHash     - Hash salé du domaine à supprimer
 */
async function suppressDomain(storageService: StorageService, domainHash: string): Promise<void> {
  return storageService.addToWhitelist(domainHash, 'M7');
}

/**
 * Stocke un nouveau hash de mot de passe dans password_hashes (FIFO 100).
 *
 * @param storageService - Service de stockage IndexedDB
 * @param hash           - Hash hexadécimal du mot de passe
 * @param domainHash     - Hash salé du domaine source
 * @param cryptoKey      - Clé AES-256-GCM pour le chiffrement
 */
async function storePasswordHash(
  storageService: StorageService,
  hash: string,
  domainHash: string,
  cryptoKey: CryptoKey,
): Promise<void> {
  const tag = extractTag(hash);
  await storageService.addPasswordHash(hash, tag, domainHash, cryptoKey);
}

/**
 * Recherche si un hash est déjà présent dans password_hashes.
 *
 * Algorithme (SFD §2.5.3) :
 * 1. Pré-filtration par index `tag` (8 chars hex)
 * 2. Déchiffrement AES-GCM de chaque candidat
 * 3. Comparaison exacte du hash déchiffré
 *
 * @param storageService - Service de stockage IndexedDB
 * @param hash           - Hash entrant (64 chars hex)
 * @param domainHash     - Hash du domaine courant (pour filtrer intra-domaine)
 * @param cryptoKey      - Clé AES-256-GCM pour le déchiffrement
 * @returns true si réutilisation inter-domaines détectée
 */
async function isPasswordReused(
  storageService: StorageService,
  hash: string,
  domainHash: string,
  cryptoKey: CryptoKey,
): Promise<boolean> {
  const tag = extractTag(hash);
  const candidates = await storageService.getPasswordHashesByTag(tag);

  for (const candidate of candidates) {
    // Ignorer les enregistrements du même domaine (réutilisation intra-domaine ignorée)
    if (candidate.domain_hash === domainHash) continue;

    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: candidate.iv },
        cryptoKey,
        candidate.value,
      );
      const decoder = new TextDecoder();
      const storedHash = decoder.decode(decrypted);
      if (storedHash === hash) {
        return true; // Réutilisation inter-domaines confirmée
      }
    } catch {
      // Enregistrement corrompu — on continue sans bloquer
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Pending M7 toast — TACHE-091 (migration timestamp → expires_at, R-CLI-03)
// ---------------------------------------------------------------------------

/**
 * Vérifie si un pending_m7_toast (nouveau format) est dans sa période de validité.
 *
 * @param toast - Objet PendingM7Toast à vérifier
 * @returns true si le toast est encore valide (expires_at dans le futur)
 */
export function verifyExpiresAt(toast: PendingM7Toast): boolean {
  return Date.now() < toast.expires_at;
}

/**
 * Écrit un pending_m7_toast en nouveau format (expires_at — R-CLI-03).
 *
 * TACHE-091 : toujours écrire en nouveau format, jamais avec `timestamp`.
 * TACHE-078 / OBS-04 : instrumentation storage_write_fail si incidentService fourni.
 * Pattern log-only : l'échec est loggué sans re-throw (le toast manquant est tolérable —
 * handlePasswordSubmitted retourne déjà { action: 'show' } et le content script
 * affichera un toast dès que possible via le prochain cycle de boot).
 *
 * @param domainHash      - Hash SHA-256 salé du domaine de détection (jamais l'URL)
 * @param incidentService - Service d'incidents (optionnel — si fourni, échec storage loggué)
 */
async function writePendingM7Toast(
  domainHash: string,
  incidentService?: IncidentService,
): Promise<void> {
  const payload: PendingM7Toast = {
    domain_hash: domainHash,
    expires_at: Date.now() + PENDING_M7_TOAST_TTL_MS,
  };
  // OBS-04 / TACHE-078 : instrumentation storage_write_fail — pattern log-only (toast manquant tolérable)
  try {
    await browser.storage.local.set({ [PENDING_M7_TOAST_KEY]: payload });
  } catch (writeErr: unknown) {
    logger.error('writePendingM7Toast: échec écriture storage', {
      error_name: Logger.errorName(writeErr),
    });
    if (incidentService) {
      await incidentService.log('storage_write_fail', 'error', {
        type: 'storage_write_fail',
        module: 'm7',
        site: 'pending_m7_toast',
        hint: (writeErr instanceof Error ? writeErr.message : String(writeErr)).slice(0, 100),
      });
    }
    // Ne pas re-throw : un toast manquant ne brise pas le flow principal (log-only pattern).
  }
}

/**
 * Lit pending_m7_toast depuis chrome.storage.local avec migration backward-compatible.
 *
 * TACHE-091 (R-CLI-03) — stratégie de migration :
 * - Format nouveau : { domain_hash, expires_at } → utilisé directement
 * - Format legacy  : { domain_hash, timestamp } → converti en expires_at puis ré-écrit
 * - Entrée expirée : supprimée silencieusement (purge passive)
 *
 * La migration est transparente : readPendingM7Toast() retourne toujours un
 * PendingM7Toast (nouveau format) ou null.
 *
 * @returns PendingM7Toast valide, ou null si absent/expiré/corrompu
 */
export async function readPendingM7Toast(): Promise<PendingM7Toast | null> {
  try {
    const result = await browser.storage.local.get([PENDING_M7_TOAST_KEY]);
    const stored = result[PENDING_M7_TOAST_KEY];

    if (!stored || typeof stored !== 'object') {
      return null;
    }

    const raw = stored as Record<string, unknown>;

    if (typeof raw['domain_hash'] !== 'string') {
      // Shape invalide : nettoyer silencieusement
      try {
        await browser.storage.local.remove(PENDING_M7_TOAST_KEY);
      } catch {
        // Ignorer l'erreur de suppression
      }
      return null;
    }

    let toast: PendingM7Toast;

    if (typeof raw['expires_at'] === 'number') {
      // Nouveau format — R-CLI-03 conforme
      toast = {
        domain_hash: raw['domain_hash'] as string,
        expires_at: raw['expires_at'] as number,
      };
    } else if (typeof raw['timestamp'] === 'number') {
      // Format legacy — migration : timestamp + TTL → expires_at
      const legacyTs = (raw as unknown as PendingM7ToastLegacy).timestamp;
      toast = {
        domain_hash: raw['domain_hash'] as string,
        expires_at: legacyTs + PENDING_M7_TOAST_TTL_MS,
      };
      // Ré-écriture en nouveau format (migration permanente)
      try {
        await browser.storage.local.set({ [PENDING_M7_TOAST_KEY]: toast });
        logger.info('readPendingM7Toast: migration legacy timestamp → expires_at effectuée');
      } catch (migrErr: unknown) {
        // Non bloquant — le toast converti est quand même retourné
        logger.error('readPendingM7Toast: erreur ré-écriture migration', {
          error_name: Logger.errorName(migrErr),
        });
      }
    } else {
      // Ni expires_at ni timestamp — shape invalide
      try {
        await browser.storage.local.remove(PENDING_M7_TOAST_KEY);
      } catch {
        // Ignorer l'erreur de suppression
      }
      return null;
    }

    // Vérification TTL — R-CLI-03
    if (!verifyExpiresAt(toast)) {
      // Toast expiré : purge passive
      try {
        await browser.storage.local.remove(PENDING_M7_TOAST_KEY);
      } catch {
        // Ignorer l'erreur de suppression
      }
      logger.info('readPendingM7Toast: toast expiré supprimé', {
        expires_at: toast.expires_at,
        overdue_ms: Date.now() - toast.expires_at,
      });
      return null;
    }

    return toast;
  } catch (err: unknown) {
    logger.error('readPendingM7Toast: erreur lecture storage', {
      error_name: Logger.errorName(err),
    });
    return null;
  }
}

/**
 * Traite les actions utilisateur sur le toast M7.
 *
 * @param storageService - Service de stockage IndexedDB
 * @param payload        - Payload avec l'action et le domain_hash
 * @param cryptoKey      - Clé AES-256-GCM pour le chiffrement
 * @returns Réponse NudgeResponse
 */
async function handleToastAction(
  storageService: StorageService,
  payload: Record<string, unknown>,
  cryptoKey: CryptoKey,
): Promise<NudgeResponse> {
  const user_action = payload['user_action'];
  const domain_hash = payload['domain_hash'];

  if (typeof user_action !== 'string' || typeof domain_hash !== 'string') {
    return { success: false, action: 'skip', reason: 'invalid_toast_payload' };
  }

  try {
    // Si l'utilisateur demande la suppression du site
    if (user_action === 'suppress_domain') {
      await suppressDomain(storageService, domain_hash);
    }

    // Enregistrement de l'action utilisateur pour M3
    await storageService.logEvent(
      'M7',
      {
        domain_hash,
        action: user_action,
        module_data: { nudge_shown: true },
      },
      cryptoKey,
    );

    // Ouvrir la page d'explication si "learn_more"
    if (user_action === 'learn_more') {
      await browser.tabs.create({
        url: browser.runtime.getURL('pages/static/reutilisation-mots-de-passe.html'),
      });
    }

    return { success: true, action: 'skip' };
  } catch (err: unknown) {
    // R-M7-08 / TACHE-083 : ne pas logger err.message — utiliser Error.name uniquement
    logger.error('Erreur toast action', { error_name: Logger.errorName(err) });
    return { success: false, action: 'error', reason: 'internal_error' };
  }
}

/**
 * Traite une soumission de formulaire avec mot de passe (action 'password_submitted').
 *
 * @param storageService - Service de stockage IndexedDB
 * @param payload        - Payload validé (hash + domain_hash)
 * @param cryptoKey      - Clé AES-256-GCM
 * @returns Réponse NudgeResponse
 */
async function handlePasswordSubmitted(
  storageService: StorageService,
  payload: M7SubmitPayload,
  cryptoKey: CryptoKey,
  heartbeatService: HeartbeatService,
  incidentService: IncidentService,
): Promise<NudgeResponse> {
  const { hash, domain_hash: domainHash } = payload;

  try {
    // INV-UC03-04 : déduplication — dropper le doublon sans appeler addPasswordHash
    if (isDuplicateSubmit(hash, domainHash)) {
      return { success: true, action: 'skip', reason: 'deduplicated' };
    }

    // Étape 1 : Vérifier la réutilisation AVANT de stocker (pour ne pas se comparer à soi-même)
    const reused = await isPasswordReused(storageService, hash, domainHash, cryptoKey);

    // Étape 2 : Stocker le hash (FIFO 100)
    await storePasswordHash(storageService, hash, domainHash, cryptoKey);

    if (!reused) {
      // Pas de réutilisation — pas de nudge
      return { success: true, action: 'skip', reason: 'no_reuse' };
    }

    // Réutilisation confirmée — instrumentation Heartbeat (TACHE-061)
    await heartbeatService.onDetection();

    // Étape 3 : Vérifier la suppression_list
    const suppressed = await isDomainSuppressed(storageService, domainHash);
    if (suppressed) {
      return { success: true, action: 'skip', reason: 'domain_suppressed' };
    }

    // Étape 4 : Vérifier le délai de 30 jours
    const lastNudgeMap = await getLastNudgeByDomain();
    const lastNudge = lastNudgeMap[domainHash] ?? 0;
    if (Date.now() - lastNudge < NUDGE_COOLDOWN_MS) {
      return { success: true, action: 'skip', reason: 'cooldown_active' };
    }

    // Étape 5 : Toutes les conditions sont remplies → déclencher le toast
    // Le quota est déjà vérifié par MessageRouter avant d'arriver ici.
    await setLastNudgeTimestamp(domainHash);

    // Enregistrer l'événement M7 (réutilisation détectée, nudge affiché)
    await storageService.logEvent(
      'M7',
      {
        domain_hash: domainHash,
        action: 'reuse_detected',
        module_data: { nudge_shown: true },
      },
      cryptoKey,
    );

    // Pattern pending_toast : stocker l'intention d'afficher le toast dans
    // chrome.storage.local pour qu'il survive à la navigation post-submit
    // (redirection après login). Le content script affiche le toast au
    // chargement de la page suivante via un listener storage.onChanged.
    // TACHE-091 (R-CLI-03) : expires_at, jamais timestamp.
    await writePendingM7Toast(domainHash, incidentService);

    return {
      success: true,
      action: 'show',
      data: { domain_hash: domainHash },
    };
  } catch (err: unknown) {
    // R-M7-08 / TACHE-083 : ne pas logger err.message — utiliser Error.name uniquement
    logger.error('Erreur traitement', { error_name: Logger.errorName(err) });
    // Instrumentation TACHE-061 : log incident submit_detect_fail (INV-SEC-02 : code_path, pas message brut)
    await incidentService.log('submit_detect_fail', 'error', {
      type: 'submit_detect_fail',
      code_path: 'handlePasswordSubmitted',
    });
    return { success: false, action: 'error', reason: 'internal_error' };
  }
}

/**
 * Handler M7 pour le Service Worker.
 *
 * Dispatche les messages selon leur action :
 * - 'password_submitted' : détection de réutilisation + stockage
 * - 'toast_action'       : traitement de l'interaction utilisateur sur le toast
 *
 * @param storageService   - Service de stockage IndexedDB
 * @param cryptoKey        - Clé AES-256-GCM pour le chiffrement
 * @param heartbeatService - Service de heartbeat M7 (TACHE-061)
 * @param incidentService  - Service de registre d'incidents M7 (TACHE-061)
 * @returns Handler conforme à l'interface ModuleHandler
 */
export function createM7Handler(
  storageService: StorageService,
  cryptoKey: CryptoKey,
  heartbeatService: HeartbeatService,
  incidentService: IncidentService,
): ModuleHandler {
  return async (
    msg: NudgeMessage,
    _sender: chrome.runtime.MessageSender,
  ): Promise<NudgeResponse> => {
    // Log diagnostic : tout message M7 recu (R-M7-08 / TACHE-083 — tab_id uniquement, pas url)
    logger.info('message recu', { action: msg.action, tab_id: _sender.tab?.id });

    // L'action 'toast_action' a un payload différent (user_action + domain_hash, pas de hash)
    // → traiter en premier, avant la validation du champ 'hash'
    if (msg.action === 'toast_action') {
      return handleToastAction(storageService, msg.payload, cryptoKey);
    }

    // Action de signalement d'un toast orphelin (pending_m7_toast non affiché) — TACHE-061
    if (msg.action === 'toast_orphan') {
      const p = msg.payload as Partial<{ domain_hash: string; ts: number }>;
      const domHash = typeof p.domain_hash === 'string' ? p.domain_hash.slice(0, 8) : 'unknown';
      const tsVal = typeof p.ts === 'number' ? p.ts : 0;
      await incidentService.log('toast_orphan', 'warn', {
        type: 'toast_orphan',
        domain_hash_prefix: domHash,
        age_ms: Date.now() - tsVal,
      });
      return { success: true, action: 'skip' };
    }

    // Action principale : password_submitted
    if (msg.action !== 'password_submitted') {
      return { success: false, action: 'skip', reason: 'unknown_action' };
    }

    // Validation du payload pour password_submitted
    const payload = msg.payload as Partial<M7SubmitPayload>;
    const hash = payload.hash;
    const domainHash = payload.domain_hash;

    if (typeof hash !== 'string' || hash.length !== 64 || !/^[0-9a-f]{64}$/.test(hash)) {
      return { success: false, action: 'skip', reason: 'invalid_hash' };
    }
    if (
      typeof domainHash !== 'string' ||
      domainHash.length !== 64 ||
      !/^[0-9a-f]{64}$/.test(domainHash)
    ) {
      return { success: false, action: 'skip', reason: 'invalid_domain_hash' };
    }

    return handlePasswordSubmitted(
      storageService,
      { hash, domain_hash: domainHash },
      cryptoKey,
      heartbeatService,
      incidentService,
    );
  };
}

// Exports pour les tests
export {
  isPasswordReused,
  storePasswordHash,
  isDomainSuppressed,
  isDuplicateSubmit,
  MAX_HASHES,
  recentSubmits,
};
export type { PasswordHashRecord };
