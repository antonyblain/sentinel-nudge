/**
 * @file background/handlers/m2-handler.ts
 * @description Handler service worker pour le module M2 (saisie en contexte risqué).
 *
 * Reçoit les signaux de risque envoyés par le content script au focus d'un champ password.
 * Orchestre la logique de décision et renvoie l'instruction d'affichage ou de skip.
 *
 * Algorithme principal (action 'risk_detected') :
 * 1. Validation du payload (signals, domain_hash)
 * 2. Vérification whitelist M2 (domaine de confiance)
 * 3. Vérification déduplication session (m2_session_domains dans chrome.storage.local)
 * 4. Vérification nombre de signaux (< 2 → skip)
 * 5. Quota géré par MessageRouter (M2 est critique, bypass quota — voir CRITICAL_MODULES)
 * 6. Enregistrement du domaine dans la session et log événement
 * 7. Réponse 'show' avec les signaux
 *
 * Action 'overlay_action' (retour du content script après interaction utilisateur) :
 * - 'trusted'   : ajoute le domaine en whitelist M2 + enregistre l'événement
 * - 'dismissed' : enregistre l'événement (action utilisateur ignorée)
 * - 'abandoned' : enregistre l'événement (meilleure action selon SFD)
 * - 'why'       : ouvre la page d'explication M2
 *
 * Note quota (SFD §2.1.5) :
 * M2 est un module critique (CRITICAL_MODULES). Le quota est géré par MessageRouter
 * qui bypasse automatiquement la limite pour les modules critiques.
 * Le handler M2 incrémente le quota via StorageService.logEvent() qui déclenche
 * l'incrément dans le flux normal.
 *
 * Référence : SFD §2.1 (M2), DAT §8.1 (whitelist store), §9.4 (D-SEC-003)
 */

import { StorageService } from '@/background/storage-service';
import { browser } from '@/shared/browser/browser-adapter';
import type { NudgeMessage, NudgeResponse } from '@/shared/types/messages';
import type { ModuleHandler } from '@/background/message-router';
import { createLogger } from '@/shared/utils/logger';
import { classifyError } from '@/shared/utils/classify-error';

/** Logger scopé M2Handler — mitigation R-M7-08 / TACHE-104 */
const logger = createLogger('M2Handler');

/** Clé chrome.storage.local pour les domaines déjà nudgés dans la session courante (M2) */
const M2_SESSION_KEY = 'm2_session_domains';

/** Nombre minimum de signaux pour déclencher l'overlay M2 (SFD §2.1) */
const MIN_SIGNALS_TO_SHOW = 2;

/** Payload attendu pour l'action 'risk_detected' */
interface M2RiskPayload {
  /** Signaux détectés (ex: ['http', 'hsts_miss']) */
  signals: string[];
  /** SHA-256(installation_salt + domain) */
  domain_hash: string;
}

/**
 * Lit la liste des domaines nudgés dans la session courante depuis chrome.storage.local.
 *
 * @returns Tableau de domain_hash déjà affichés dans cette session
 */
async function getSessionDomains(): Promise<string[]> {
  try {
    const result = await browser.storage.local.get([M2_SESSION_KEY]);
    const domains = result[M2_SESSION_KEY];
    if (!Array.isArray(domains)) return [];
    return domains as string[];
  } catch {
    return [];
  }
}

/**
 * Ajoute un domaine dans la liste de déduplication de session.
 *
 * @param domainHash - Hash salé du domaine à ajouter
 */
async function addDomainToSession(domainHash: string): Promise<void> {
  const domains = await getSessionDomains();
  if (!domains.includes(domainHash)) {
    domains.push(domainHash);
    await browser.storage.local.set({ [M2_SESSION_KEY]: domains });
  }
}

/**
 * Retire un domaine de la liste de déduplication de session.
 * Utilisé quand l'utilisateur abandonne la saisie : le domaine doit
 * pouvoir re-déclencher M2 si l'utilisateur reclique par erreur.
 *
 * @param domainHash - Hash salé du domaine à retirer
 */
async function removeDomainFromSession(domainHash: string): Promise<void> {
  const domains = await getSessionDomains();
  const filtered = domains.filter((d) => d !== domainHash);
  await browser.storage.local.set({ [M2_SESSION_KEY]: filtered });
}

/**
 * Traite l'action 'risk_detected' : évalue les conditions et décide d'afficher ou non.
 *
 * @param storageService - Service de stockage IndexedDB
 * @param payload        - Payload validé (signals + domain_hash)
 * @param cryptoKey      - Clé AES-256-GCM pour le chiffrement des événements
 * @returns Réponse NudgeResponse
 */
async function handleRiskDetected(
  storageService: StorageService,
  payload: M2RiskPayload,
  cryptoKey: CryptoKey,
): Promise<NudgeResponse> {
  const { signals, domain_hash: domainHash } = payload;

  try {
    // Étape 1 : Moins de 2 signaux → skip (SFD §2.1)
    if (signals.length < MIN_SIGNALS_TO_SHOW) {
      return { success: true, action: 'skip', reason: 'insufficient_signals' };
    }

    // Étape 2 : Vérification whitelist M2 (domaine de confiance)
    const isWhitelisted = await storageService.isWhitelisted(domainHash, 'M2');
    if (isWhitelisted) {
      return { success: true, action: 'skip', reason: 'whitelisted' };
    }

    // Étape 3 : Déduplication session (1 nudge M2 par domaine par session)
    const sessionDomains = await getSessionDomains();
    if (sessionDomains.includes(domainHash)) {
      return { success: true, action: 'skip', reason: 'session_duplicate' };
    }

    // Étape 4 : Toutes les conditions remplies → enregistrer et afficher
    // Le quota est géré par MessageRouter (M2 = critique, bypass automatique)

    // Enregistrer le domaine dans la session
    await addDomainToSession(domainHash);

    // Enregistrer l'événement pour M3 (signaux + domaine hashé)
    await storageService.logEvent(
      'M2',
      {
        domain_hash: domainHash,
        signals,
        action: 'shown',
        module_data: { signal_count: signals.length },
      },
      cryptoKey,
    );

    return {
      success: true,
      action: 'show',
      data: { signals, domain_hash: domainHash },
    };
  } catch (err: unknown) {
    // TACHE-104 / R-M7-08 : classifyError remplace err.message (INV-SEC-02 étendu)
    logger.error('erreur_risk_detected', { error_code: classifyError(err) });
    return { success: false, action: 'error', reason: 'internal_error' };
  }
}

/**
 * Traite les actions utilisateur sur l'overlay M2.
 *
 * Actions :
 * - 'trusted'   : ajoute le domaine en whitelist M2
 * - 'dismissed' : enregistre l'événement (-4 pts score M3 via SFD §2.1.5)
 * - 'abandoned' : enregistre l'événement (neutre pour M3)
 * - 'why'       : ouvre la page d'explication M2
 *
 * @param storageService - Service de stockage IndexedDB
 * @param payload        - Payload avec l'action et le domain_hash
 * @param cryptoKey      - Clé AES-256-GCM
 * @returns Réponse NudgeResponse
 */
async function handleOverlayAction(
  storageService: StorageService,
  payload: Record<string, unknown>,
  cryptoKey: CryptoKey,
): Promise<NudgeResponse> {
  const user_action = payload['user_action'];
  const domain_hash = payload['domain_hash'];
  const signals = payload['signals'];

  if (typeof user_action !== 'string' || typeof domain_hash !== 'string') {
    return { success: false, action: 'skip', reason: 'invalid_overlay_payload' };
  }

  try {
    // Ajout en whitelist si l'utilisateur fait confiance au domaine
    if (user_action === 'trusted') {
      await storageService.addToWhitelist(domain_hash, 'M2');
    }

    // Abandon : retirer le domaine de la session dedup pour permettre
    // le réaffichage si l'utilisateur reclique par erreur
    if (user_action === 'abandoned') {
      await removeDomainFromSession(domain_hash);
    }

    // Enregistrement de l'événement pour M3
    await storageService.logEvent(
      'M2',
      {
        domain_hash,
        signals: Array.isArray(signals) ? (signals as string[]) : [],
        action: user_action,
        module_data: { nudge_shown: true },
      },
      cryptoKey,
    );

    // Ouverture de la page d'explication si "why"
    if (user_action === 'why') {
      await browser.tabs.create({
        url: browser.runtime.getURL('pages/static/sites-suspects.html'),
      });
    }

    return { success: true, action: 'skip' };
  } catch (err: unknown) {
    // TACHE-104 / R-M7-08 : classifyError remplace err.message (INV-SEC-02 étendu)
    logger.error('erreur_overlay_action', { error_code: classifyError(err) });
    return { success: false, action: 'error', reason: 'internal_error' };
  }
}

/**
 * Ouvre la page d'explication M2.
 * Déclenché par l'action 'open_explanation' du composant UI (bouton "En savoir plus").
 *
 * @returns Réponse NudgeResponse
 */
async function handleOpenExplanation(): Promise<NudgeResponse> {
  try {
    await browser.tabs.create({
      url: browser.runtime.getURL('pages/static/sites-suspects.html'),
    });
    return { success: true, action: 'skip' };
  } catch (err: unknown) {
    // TACHE-104 / R-M7-08 : classifyError remplace err.message (INV-SEC-02 étendu)
    logger.error('erreur_open_explanation', { error_code: classifyError(err) });
    return { success: false, action: 'error', reason: 'internal_error' };
  }
}

/**
 * Handler M2 pour le Service Worker.
 *
 * Dispatche les messages selon leur action :
 * - 'risk_detected'  : évaluation des signaux + décision d'affichage
 * - 'overlay_action' : traitement de l'interaction utilisateur sur l'overlay
 * - 'open_explanation' : ouverture de la page d'explication statique
 *
 * @param storageService - Service de stockage IndexedDB
 * @param cryptoKey      - Clé AES-256-GCM pour le chiffrement
 * @returns Handler conforme à l'interface ModuleHandler
 */
export function createM2Handler(
  storageService: StorageService,
  cryptoKey: CryptoKey,
): ModuleHandler {
  return async (
    msg: NudgeMessage,
    _sender: chrome.runtime.MessageSender,
  ): Promise<NudgeResponse> => {
    // Action 'overlay_action' (retour UI après interaction)
    if (msg.action === 'overlay_action') {
      return handleOverlayAction(storageService, msg.payload, cryptoKey);
    }

    // Action 'open_explanation' (clic sur "En savoir plus" dans l'overlay)
    if (msg.action === 'open_explanation') {
      return handleOpenExplanation();
    }

    // Action principale : 'risk_detected'
    if (msg.action !== 'risk_detected') {
      return { success: false, action: 'skip', reason: 'unknown_action' };
    }

    // Validation du payload pour 'risk_detected'
    const payload = msg.payload as Partial<M2RiskPayload>;
    const signals = payload.signals;
    const domainHash = payload.domain_hash;

    if (!Array.isArray(signals)) {
      return { success: false, action: 'skip', reason: 'invalid_signals' };
    }

    if (
      typeof domainHash !== 'string' ||
      domainHash.length !== 64 ||
      !/^[0-9a-f]{64}$/.test(domainHash)
    ) {
      return { success: false, action: 'skip', reason: 'invalid_domain_hash' };
    }

    // Vérifier que chaque signal est une chaîne non vide
    const validSignals = signals.filter((s): s is string => typeof s === 'string' && s.length > 0);

    return handleRiskDetected(
      storageService,
      { signals: validSignals, domain_hash: domainHash },
      cryptoKey,
    );
  };
}

// Exports pour les tests
export { getSessionDomains, addDomainToSession, MIN_SIGNALS_TO_SHOW };
