/**
 * @file utils/levenshtein.ts
 * @description Algorithme de distance de Levenshtein (Wagner-Fischer) pour la détection
 * de typosquatting dans le module M2.
 *
 * Complexité temporelle : O(m×n) où m et n sont les longueurs des chaînes comparées.
 * Complexité spatiale : O(m×n) — optimisable à O(min(m,n)) si nécessaire.
 *
 * Usage : comparaison de l'URL courante avec la liste `typosquatting-targets.json`
 * (~500 domaines cibles connus). Si la distance est ≤ 2, le signal 'levenshtein' est levé.
 *
 * Performance : sur les ~500 comparaisons de M2, avec des chaînes < 50 caractères,
 * le temps d'exécution est négligeable (< 1 ms total).
 *
 * Référence : DAT §10.2 (stratégie Levenshtein limité à ~500 cibles), §6.2 (signal M2)
 */

/**
 * Calcule la distance d'édition entre deux chaînes (algorithme Wagner-Fischer).
 *
 * La distance de Levenshtein représente le nombre minimal d'opérations élémentaires
 * (insertion, suppression, substitution d'un caractère) pour transformer `a` en `b`.
 *
 * @param a - Première chaîne (domaine de l'URL courante)
 * @param b - Deuxième chaîne (domaine cible de la liste de typosquatting)
 * @returns Distance d'édition (0 = chaînes identiques, plus grand = plus différentes)
 *
 * @example
 * levenshteinDistance('paypa1.com', 'paypal.com') // → 1
 * levenshteinDistance('g00gle.com', 'google.com') // → 2
 * levenshteinDistance('amazon.com', 'amazon.com') // → 0
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Cas triviaux pour optimiser les cas courants
  if (m === 0) return n;
  if (n === 0) return m;
  if (a === b) return 0;

  // Matrice dp[i][j] = distance entre a[0..i-1] et b[0..j-1]
  // Initialisation avec les tableaux de taille (m+1) × (n+1)
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => {
      if (i === 0) return j;
      if (j === 0) return i;
      return 0;
    }),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        // Caractères identiques — pas de coût supplémentaire
        dp[i]![j] = dp[i - 1]![j - 1]!;
      } else {
        dp[i]![j] =
          1 +
          Math.min(
            dp[i - 1]![j]!, // Suppression dans a
            dp[i]![j - 1]!, // Insertion dans a
            dp[i - 1]![j - 1]!, // Substitution
          );
      }
    }
  }

  return dp[m]![n]!;
}
