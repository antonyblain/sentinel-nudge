/**
 * @file shared/utils/whitelist-merge.ts
 * @description Utilitaire de fusion des entrées whitelist — T-042 (Art. 20 RGPD).
 *
 * Garantit que l'export portabilité inclut l'intégralité de la whitelist de confiance
 * de l'utilisateur, indépendamment du stockage sous-jacent (migration transparente) :
 *
 *   - Source IDB      : store `whitelist` (domain_hash, module, added_at) — entrées actuelles
 *   - Source legacy   : chrome.storage.local['m2_whitelist'] (Array<string> plat de domain_hash)
 *                        Présent uniquement sur des installations antérieures à la migration IDB.
 *
 * Déduplication :
 *   - Clé composite `${domain_hash}|${module}`
 *   - En cas de doublon, l'entrée IDB est conservée (données plus complètes — added_at réel)
 *
 * Référence : T-042, Art. 20 RGPD (portabilité), DAT §8.3
 */

import type { WhitelistEntry } from '@/shared/types/storage';

/**
 * Fusionne les entrées whitelist provenant de deux sources et dédoublonne.
 *
 * Stratégie :
 * 1. Index les entrées IDB par clé composite — priorité absolue.
 * 2. Parcourt les entrées legacy ; seules les clés absentes sont ajoutées.
 * 3. Retourne la liste triée par `added_at` croissant.
 *
 * Les entrées legacy n'ont pas de `added_at` connu : 0 est utilisé comme sentinelle
 * (données migrées sans historique).
 *
 * @param idbEntries    - Entrées provenant d'IndexedDB via `getAllWhitelist()`
 * @param legacyDomains - Tableau plat de `domain_hash` depuis chrome.storage.local['m2_whitelist']
 *                        (peut être `undefined` ou `null` si la clé est absente — cas nominal)
 * @returns Union dédoublonnée, triée par `added_at` croissant
 */
export function mergeWhitelists(
  idbEntries: WhitelistEntry[],
  legacyDomains: string[] | undefined | null,
): WhitelistEntry[] {
  // Ensemble des clés composites déjà présentes (IDB prioritaire)
  const seen = new Set<string>();
  const result: WhitelistEntry[] = [];

  for (const entry of idbEntries) {
    const key = `${entry.domain_hash}|${entry.module}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(entry);
    }
  }

  // Intégration des entrées legacy (format plat : tableau de domain_hash strings)
  // Présent uniquement sur les installations pré-migration IDB.
  if (Array.isArray(legacyDomains)) {
    for (const domainHash of legacyDomains) {
      if (typeof domainHash !== 'string' || domainHash.length === 0) continue;
      const key = `${domainHash}|M2`;
      if (!seen.has(key)) {
        seen.add(key);
        // added_at = 0 : timestamp inconnu (entrée legacy sans métadonnées temporelles)
        result.push({ domain_hash: domainHash, module: 'M2', added_at: 0 });
      }
    }
  }

  // Tri croissant par added_at (entrées legacy à 0 en tête)
  return result.sort((a, b) => a.added_at - b.added_at);
}
