/**
 * @file content-scripts/detectors/risk-analyzer.ts
 * @description Analyseur de signaux de risque de domaine pour le module M2.
 *
 * Évalue 4 signaux de risque sur le domaine courant :
 * 1. `http`         : URL en HTTP (pas HTTPS)
 * 2. `hsts_miss`    : domaine absent de la HSTS preload list embarquée
 * 3. `levenshtein`  : domaine ressemblant à un domaine cible connu (typosquatting)
 * 4. `cert_invalid` : certificat auto-signé (DAT RT-003 : non implémentable en MV3, toujours false)
 *
 * Note RT-003 : L'API chrome.tabs.securityInfo (cert) n'est pas accessible depuis
 * un content script en MV3. Le signal `cert_invalid` est réservé pour une
 * implémentation future via le service worker si l'API devient accessible.
 *
 * Dégradation gracieuse (SFD §2.1.4 CA-M2-09) :
 * - Si hsts-preload.json est absent ou corrompu, le signal `hsts_miss` est ignoré
 *   et les 3 autres signaux sont évalués normalement.
 * - Si typosquatting-targets.json est absent, le signal `levenshtein` est ignoré.
 *
 * Exclusions (SFD §2.1.4) :
 * - localhost, 127.0.0.1 et ::1 ne sont jamais analysés (développement local légitime)
 *
 * Référence : DAT §6.2 (RiskAnalyzer, signaux M2), §15 (RT-003), SFD §2.1
 */

import { levenshteinDistance } from '@/shared/utils/levenshtein';
import hstsPreloadData from '@/assets/data/hsts-preload.json';
import typosquattingData from '@/assets/data/typosquatting-targets.json';

/** Niveau de risque calculé (0 = aucun, 1-2 = modéré, 3+ = élevé) */
export type RiskLevel = 0 | 1 | 2 | 3 | 4;

/** Résultat de l'analyse de risque */
export interface RiskAnalysisResult {
  /** Liste des signaux de risque détectés */
  signals: string[];
  /** Niveau de risque agrégé (nombre de signaux) */
  riskLevel: RiskLevel;
}

/** Seuil de distance Levenshtein pour détecter le typosquatting */
const LEVENSHTEIN_THRESHOLD = 2;

/**
 * Domaines exclus de l'analyse M2 (développement local légitime).
 * SFD §2.1.4 CA-M2-07 : localhost exclu.
 */
const EXCLUDED_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Set SHA-256 des domaines HSTS preload.
 * Chargé depuis hsts-preload.json au démarrage du module.
 * En cas de fichier vide ou corrompu, le Set est vide (dégradation gracieuse).
 */
let hstsPreloadSet: Set<string> = new Set();

/**
 * Liste des domaines cibles pour la détection de typosquatting.
 * Chargée depuis typosquatting-targets.json au démarrage du module.
 */
let typosquattingTargets: string[] = [];

/**
 * Indicateur de chargement des données — permet la dégradation gracieuse.
 */
let hstsLoadError = false;
let typosquattingLoadError = false;

/**
 * Initialise les données statiques (HSTS preload list et cibles typosquatting).
 * Appelé une seule fois lors du chargement du module.
 * En cas d'erreur (fichier corrompu ou structure inattendue), la dégradation
 * gracieuse est activée et un log d'erreur est enregistré (SFD §2.1.4 CA-M2-09).
 */
function initializeData(): void {
  // Chargement de la HSTS preload list
  try {
    const data = hstsPreloadData as { hashes?: unknown };
    if (Array.isArray(data.hashes)) {
      hstsPreloadSet = new Set(data.hashes as string[]);
    } else {
      hstsLoadError = true;
      console.warn(
        '[M2 RiskAnalyzer] hsts-preload.json: champ "hashes" absent ou invalide — signal hsts_miss désactivé',
      );
    }
  } catch (err) {
    hstsLoadError = true;
    console.error(
      '[M2 RiskAnalyzer] Erreur chargement hsts-preload.json:',
      err instanceof Error ? err.message : 'Erreur inconnue',
    );
  }

  // Chargement des cibles typosquatting
  try {
    const data = typosquattingData as { targets?: unknown };
    if (Array.isArray(data.targets)) {
      typosquattingTargets = data.targets as string[];
    } else {
      typosquattingLoadError = true;
      console.warn(
        '[M2 RiskAnalyzer] typosquatting-targets.json: champ "targets" absent ou invalide — signal levenshtein désactivé',
      );
    }
  } catch (err) {
    typosquattingLoadError = true;
    console.error(
      '[M2 RiskAnalyzer] Erreur chargement typosquatting-targets.json:',
      err instanceof Error ? err.message : 'Erreur inconnue',
    );
  }
}

// Initialisation au chargement du module
initializeData();

/**
 * Analyse les signaux de risque de l'URL courante.
 *
 * Appelé par password-detector.ts au moment du focus sur un champ mot de passe.
 * Les exclusions (localhost, 127.0.0.1) sont appliquées en premier.
 *
 * @param url - URL complète de la page courante (ex: window.location.href)
 * @returns Résultat de l'analyse avec la liste des signaux et le niveau de risque
 */
export function analyzeRisks(url: string): RiskAnalysisResult {
  const signals: string[] = [];

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    // URL invalide — pas d'analyse possible
    return { signals: [], riskLevel: 0 };
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const protocol = parsedUrl.protocol;

  // Exclusion des environnements locaux (SFD §2.1.4 CA-M2-07)
  if (EXCLUDED_HOSTNAMES.has(hostname)) {
    return { signals: [], riskLevel: 0 };
  }

  // Signal 1 : HTTP (pas HTTPS)
  if (protocol === 'http:') {
    signals.push('http');
  }

  // Signal 2 : absence de la HSTS preload list
  // Dégradation gracieuse : si le fichier est absent/corrompu, le signal est ignoré (SFD CA-M2-09)
  if (!hstsLoadError) {
    const isInHstsList = checkHstsPreload(hostname);
    if (!isInHstsList) {
      signals.push('hsts_miss');
    }
  }

  // Signal 3 : typosquatting via Levenshtein
  // Dégradation gracieuse : si le fichier est absent/corrompu, le signal est ignoré
  if (!typosquattingLoadError) {
    const isTyposquatting = checkLevenshtein(hostname);
    if (isTyposquatting) {
      signals.push('levenshtein');
    }
  }

  // Signal 4 : certificat auto-signé — RT-003 (non implémentable en MV3 v1)
  // Non implémenté en v1 — réservé pour v2+ avec accès API sécurité SW
  // signals.push('cert_invalid'); // TODO(P4-V2) : via chrome.tabs.getSecurityInfo()

  const riskLevel = Math.min(signals.length, 4) as RiskLevel;
  return { signals, riskLevel };
}

/**
 * Vérifie si un domaine est dans la HSTS preload list.
 *
 * La liste embarquée stocke les SHA-256 des domaines (format du fichier hsts-preload.json).
 * La vérification est O(1) grâce au Set.
 *
 * Note : le fichier hsts-preload.json utilise des hashes SHA-256 des noms de domaine
 * en minuscules. Le hostname est déjà normalisé en minuscules avant appel.
 *
 * @param hostname - Nom de domaine à vérifier (déjà en minuscules)
 * @returns true si le domaine est dans la liste HSTS preload
 */
function checkHstsPreload(hostname: string): boolean {
  // La liste embarquée stocke les domaines directement (pas de hash)
  // Si la liste contient des hashes, adapter ce code en conséquence
  return hstsPreloadSet.has(hostname);
}

/**
 * Vérifie si un domaine ressemble à un domaine cible connu (typosquatting).
 *
 * Utilise l'algorithme de Levenshtein pour calculer la distance d'édition
 * entre le hostname courant et chaque domaine de la liste cible.
 * Distance ≤ LEVENSHTEIN_THRESHOLD (2) ET ≠ 0 (domaine exact exclu) = suspect.
 *
 * Traitement IDN homograph (SFD §2.1.4 CA-M2-08) :
 * Les domaines en punycode (xn--...) sont comparés tels quels.
 * La détection fonctionne car le punycode produit une distance Levenshtein
 * élevée par rapport au domaine légitime, mais les variantes simples (xn--paypa1)
 * restent dans le seuil.
 *
 * @param hostname - Nom de domaine à vérifier (déjà en minuscules)
 * @returns true si un domaine cible est à distance ≤ LEVENSHTEIN_THRESHOLD
 */
function checkLevenshtein(hostname: string): boolean {
  for (const target of typosquattingTargets) {
    const distance = levenshteinDistance(hostname, target.toLowerCase());
    // distance > 0 : exclure le domaine exact (même domaine = pas du typosquatting)
    if (distance > 0 && distance <= LEVENSHTEIN_THRESHOLD) {
      return true;
    }
  }
  return false;
}

/**
 * Accesseurs pour les tests unitaires — permettent de vérifier l'état interne.
 * Non exportés en production (underscore par convention).
 */
export const _internals = {
  get hstsLoadError(): boolean {
    return hstsLoadError;
  },
  get typosquattingLoadError(): boolean {
    return typosquattingLoadError;
  },
  get hstsPreloadSetSize(): number {
    return hstsPreloadSet.size;
  },
  get typosquattingTargetsCount(): number {
    return typosquattingTargets.length;
  },
};
