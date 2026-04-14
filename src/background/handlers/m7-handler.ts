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
 * Référence : SFD §2.5 (M7), DAT §8.1 (store password_hashes), §9.4 (D-SEC-001)
 */

import { StorageService } from '@/background/storage-service';
import { browser } from '@/shared/browser/browser-adapter';
import { extractTag } from '@/shared/utils/hash';
import type { NudgeMessage, NudgeResponse } from '@/shared/types/messages';
import type { ModuleHandler } from '@/background/message-router';
import type { PasswordHashRecord } from '@/shared/types/storage';

/** Nombre maximum de hashes stockés en IndexedDB (FIFO) */
const MAX_HASHES = 100;

/** Délai minimum entre deux nudges M7 pour le même domaine (30 jours en ms) */
const NUDGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

/** Clé chrome.storage.local pour les timestamps des derniers nudges M7 par domaine */
const M7_LAST_NUDGE_KEY = 'm7_last_nudge_by_domain';

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
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error(`[M7Handler] Erreur toast action: ${message}`);
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
): Promise<NudgeResponse> {
  const { hash, domain_hash: domainHash } = payload;

  try {
    // Étape 1 : Vérifier la réutilisation AVANT de stocker (pour ne pas se comparer à soi-même)
    const reused = await isPasswordReused(storageService, hash, domainHash, cryptoKey);

    // Étape 2 : Stocker le hash (FIFO 100)
    await storePasswordHash(storageService, hash, domainHash, cryptoKey);

    if (!reused) {
      // Pas de réutilisation — pas de nudge
      return { success: true, action: 'skip', reason: 'no_reuse' };
    }

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

    return {
      success: true,
      action: 'show',
      data: { domain_hash: domainHash },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error(`[M7Handler] Erreur traitement: ${message}`);
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
 * @param storageService - Service de stockage IndexedDB
 * @param cryptoKey      - Clé AES-256-GCM pour le chiffrement
 * @returns Handler conforme à l'interface ModuleHandler
 */
export function createM7Handler(
  storageService: StorageService,
  cryptoKey: CryptoKey,
): ModuleHandler {
  return async (
    msg: NudgeMessage,
    _sender: chrome.runtime.MessageSender,
  ): Promise<NudgeResponse> => {
    // Log diagnostic : tout message M7 recu
    console.info(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'M7Handler: message recu',
        context: { action: msg.action, origin: _sender.tab?.url ?? 'unknown' },
      }),
    );

    // L'action 'toast_action' a un payload différent (user_action + domain_hash, pas de hash)
    // → traiter en premier, avant la validation du champ 'hash'
    if (msg.action === 'toast_action') {
      return handleToastAction(storageService, msg.payload, cryptoKey);
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

    return handlePasswordSubmitted(storageService, { hash, domain_hash: domainHash }, cryptoKey);
  };
}

// Exports pour les tests
export { isPasswordReused, storePasswordHash, isDomainSuppressed, MAX_HASHES };
export type { PasswordHashRecord };
