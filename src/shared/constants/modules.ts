/**
 * @file constants/modules.ts
 * @description Constantes relatives aux modules de nudging Sentinel Nudge v1.
 *
 * MODULE_IDS est utilisé comme liste blanche de validation dans message-validator.ts (NC-SEC-01).
 * CRITICAL_MODULES bypass la limite de quota — M2 (sécurité domaine), M7 (réutilisation mot de passe) et M17 (presse-papiers sensible).
 *
 * Référence : DAT §3.3 (validation messages), §6.2 (flux quota)
 */

import type { ModuleId } from '../types/modules';

/**
 * Liste exhaustive des identifiants de modules valides pour la v1.
 * Tout message dont le champ `module` n'est pas dans cette liste est rejeté silencieusement.
 */
export const MODULE_IDS: readonly ModuleId[] = ['M2', 'M3', 'M5', 'M6', 'M7', 'M9', 'M17'] as const;

/**
 * Modules critiques qui bypassen le quota journalier.
 *
 * - M2  : Risque de sécurité domaine — l'utilisateur doit toujours être alerté
 * - M7  : Réutilisation de mot de passe — alerte sécurité, pas un nudge éducatif.
 *         Le rate-limit propre à M7 (cooldown 30j par domaine + suppression_list)
 *         empêche déjà la sur-sollicitation — le quota global ferait double emploi.
 * - M17 : Données sensibles dans le presse-papiers — intervention immédiate requise
 *
 * Référence : DAT §6.2 (flux QuotaManager — quota KO + critique)
 */
export const CRITICAL_MODULES: readonly ModuleId[] = ['M2', 'M7', 'M17'] as const;
