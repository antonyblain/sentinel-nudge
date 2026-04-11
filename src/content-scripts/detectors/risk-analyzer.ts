/**
 * @file content-scripts/detectors/risk-analyzer.ts
 * @description Analyseur de signaux de risque de domaine pour le module M2.
 *
 * Évalue 4 signaux de risque sur le domaine courant :
 * 1. `http`         : URL en HTTP (pas HTTPS)
 * 2. `hsts_miss`    : domaine absent de la HSTS preload list embarquée
 * 3. `levenshtein`  : domaine ressemblant à un domaine cible connu (typosquatting)
 * 4. `cert_invalid` : certificat auto-signé (DAT RT-003 : signal dégradé en MV3, best-effort)
 *
 * Note RT-003 : L'API chrome.tabs.securityInfo (cert) n'est pas accessible depuis
 * un content script en MV3. Le signal `cert_invalid` est réservé pour une
 * implémentation future via le service worker si l'API devient accessible.
 *
 * Référence : DAT §6.2 (RiskAnalyzer, signaux M2), §15 (RT-003)
 */

import { levenshteinDistance } from '@/shared/utils/levenshtein';

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
 * Analyse les signaux de risque de l'URL courante.
 *
 * Appelé par password-detector.ts au moment du focus sur un champ mot de passe.
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

  // Signal 1 : HTTP (pas HTTPS)
  if (protocol === 'http:') {
    signals.push('http');
  }

  // Signal 2 : absence de la HSTS preload list
  // TODO(P4-M2) : charger hsts-preload.json et vérifier hostname dans le set
  // Pour l'instant : placeholder fonctionnel
  const isInHstsList = checkHstsPreload(hostname);
  if (!isInHstsList && protocol !== 'http:') {
    signals.push('hsts_miss');
  }

  // Signal 3 : typosquatting via Levenshtein
  // TODO(P4-M2) : charger typosquatting-targets.json
  const isTyposquatting = checkLevenshtein(hostname);
  if (isTyposquatting) {
    signals.push('levenshtein');
  }

  // Signal 4 : certificat auto-signé — RT-003 (dégradé en MV3)
  // Non implémenté en v1 — réservé pour v2+ avec accès API sécurité SW
  // signals.push('cert_invalid'); // TODO(P4-V2) : via chrome.tabs.getSecurityInfo()

  const riskLevel = Math.min(signals.length, 4) as RiskLevel;
  return { signals, riskLevel };
}

/**
 * Vérifie si un domaine est dans la HSTS preload list.
 * Implémentation partielle — le chargement du JSON sera fait en P4 M2.
 *
 * @param hostname - Nom de domaine à vérifier
 * @returns true si le domaine est dans la liste
 */
function checkHstsPreload(hostname: string): boolean {
  // TODO(P4-M2) : charger assets/data/hsts-preload.json (Set de hashes SHA-256)
  // La vérification est O(1) grâce au Set
  void hostname; // supprime le warning unused en attendant l'implémentation
  return false; // par défaut : domaine considéré absent (signal hsts_miss levé)
}

/**
 * Vérifie si un domaine ressemble à un domaine cible connu (typosquatting).
 * Implémentation partielle — la liste sera chargée en P4 M2.
 *
 * @param hostname - Nom de domaine à vérifier
 * @returns true si un domaine cible est à distance ≤ LEVENSHTEIN_THRESHOLD
 */
function checkLevenshtein(hostname: string): boolean {
  // TODO(P4-M2) : charger assets/data/typosquatting-targets.json
  // et comparer avec levenshteinDistance pour chaque cible
  const exampleTargets = ['paypal.com', 'google.com', 'amazon.com', 'microsoft.com'];

  for (const target of exampleTargets) {
    const distance = levenshteinDistance(hostname, target);
    if (distance > 0 && distance <= LEVENSHTEIN_THRESHOLD) {
      return true;
    }
  }
  return false;
}
