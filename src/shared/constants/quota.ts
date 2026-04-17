/**
 * @file constants/quota.ts
 * @description Constantes du système de quota de nudges journaliers.
 *
 * Le quota limite le nombre de nudges affichés par jour pour éviter la fatigue d'alerte.
 * L'utilisateur peut modifier la limite dans la page Options.
 * null = illimité (tous les nudges sont affichés).
 *
 * Référence : DAT §3.3 (ChromeStorageSchema.config.quota_limit), SFD §3.1 (RG-QUOTA-01)
 */

/**
 * Valeur par défaut du quota journalier (3 nudges/jour).
 * Définie dans les spécifications fonctionnelles (RG-QUOTA-01).
 */
export const QUOTA_DEFAULT = 3 as const;

/**
 * Options disponibles pour le quota journalier.
 * null = illimité (Tous).
 * Affiché dans la page Options comme liste de choix.
 *
 * Référence : SFD §3.1 — options de configuration quota
 */
export const QUOTA_OPTIONS: readonly (3 | 5 | 10 | null)[] = [3, 5, 10, null] as const;
