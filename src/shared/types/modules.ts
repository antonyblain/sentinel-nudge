/**
 * @file modules.ts
 * @description Types et interfaces relatifs aux modules de nudging Sentinel Nudge v1.
 *
 * Référence : DAT §3.3, §5 — Lotissement v1 : 7 modules (M2, M3, M5, M6, M7, M9, M17)
 */

/**
 * Identifiants des modules inclus dans la v1 de Sentinel Nudge.
 * Utilisé comme liste blanche pour la validation des messages entrants (NC-SEC-01).
 *
 * - M2  : Analyse de risque domaine (HTTP, HSTS, Levenshtein, certificat)
 * - M3  : Score de cyber-hygiène hebdomadaire (calcul lundi 09h)
 * - M5  : Détection mise à jour navigateur disponible
 * - M6  : Quiz de sensibilisation (spaced repetition)
 * - M7  : Détection réutilisation de mot de passe
 * - M9  : Évaluation force mot de passe (zxcvbn-ts)
 * - M17 : Détection de données sensibles dans le presse-papiers
 */
export type ModuleId = 'M2' | 'M3' | 'M5' | 'M6' | 'M7' | 'M9' | 'M17';

/**
 * Configuration individuelle d'un module.
 *
 * @property id - Identifiant du module
 * @property enabled - État d'activation (par défaut true à l'installation)
 * @property critical - true si le module bypass la limite de quota (M2 et M17)
 * @property name - Nom lisible pour l'affichage dans la page Options
 * @property description - Description courte pour l'onboarding et la page Options
 */
export interface ModuleConfig {
  id: ModuleId;
  enabled: boolean;
  critical: boolean;
  name: string;
  description: string;
}
