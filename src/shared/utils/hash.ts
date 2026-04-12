/**
 * @file utils/hash.ts
 * @description Fonctions de hachage SHA-256 via SubtleCrypto (Web Crypto API native).
 *
 * Ces fonctions implémentent le schéma de hachage salé D-SEC-001 :
 * hash = SHA-256(installation_salt + valeur)
 *
 * Le sel est unique par installation et empêche la corrélation inter-utilisateurs.
 * La variable contenant la valeur en clair est implicitement libérée après le calcul.
 *
 * Référence : DAT §9.4 (D-SEC-001), §6.2 (domain_hash dans les flux)
 */

/**
 * Calcule le hash SHA-256 d'une chaîne de caractères via SubtleCrypto.
 *
 * @param input - Chaîne à hacher
 * @returns Représentation hexadécimale du hash SHA-256 (64 caractères)
 * @throws Error si SubtleCrypto n'est pas disponible (contexte non sécurisé)
 */
async function sha256Hex(input: string): Promise<string> {
  // SubtleCrypto n'est disponible que dans les contextes sécurisés (HTTPS, localhost).
  // Sur les pages HTTP, crypto.subtle est undefined.
  // M2 se déclenche précisément sur les sites HTTP — un fallback est nécessaire.
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback : hash non-cryptographique (FNV-1a 64 bits en hex)
  // Suffisant pour la déduplication et la whitelist M2 — pas pour la sécurité M7
  return fallbackHash(input);
}

/**
 * Hash non-cryptographique FNV-1a pour les contextes non sécurisés (HTTP).
 * Utilisé uniquement pour le domain_hash M2 sur les pages HTTP.
 * NE PAS utiliser pour le hachage de mots de passe (M7) — SHA-256 obligatoire.
 */
function fallbackHash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x01000193);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return (hex1 + hex2).padEnd(64, '0');
}

/**
 * Calcule le hash salé d'un mot de passe : SHA-256(installation_salt + password).
 *
 * Utilisé par le module M7 pour détecter la réutilisation de mot de passe sans
 * jamais stocker le mot de passe en clair.
 *
 * Sécurité : le mot de passe en clair ne doit pas être conservé après cet appel.
 * Le résultat est ensuite chiffré AES-256-GCM avant stockage dans IndexedDB (NC-DPO-01).
 *
 * @param salt     - Sel d'installation (installation_salt, 32 caractères hex)
 * @param password - Mot de passe en clair (à nullifier côté appelant après l'appel)
 * @returns Hash hexadécimal SHA-256 (64 caractères)
 */
export async function hashPassword(salt: string, password: string): Promise<string> {
  return sha256Hex(salt + password);
}

/**
 * Calcule le hash salé d'un domaine : SHA-256(installation_salt + domain).
 *
 * Utilisé dans tous les modules traitant des URL (M2, M7) pour ne jamais
 * stocker les domaines en clair dans IndexedDB ou chrome.storage.local.
 *
 * @param salt   - Sel d'installation (installation_salt, 32 caractères hex)
 * @param domain - Nom de domaine (ex: "example.com")
 * @returns Hash hexadécimal SHA-256 (64 caractères)
 */
export async function hashDomain(salt: string, domain: string): Promise<string> {
  return sha256Hex(salt + domain);
}

/**
 * Extrait les 4 premiers bytes du hash en hexadécimal (8 caractères).
 * Utilisé comme `tag` dans le store `password_hashes` pour la pré-filtration (NC-DPO-01).
 *
 * @param hash - Hash hexadécimal complet (64 caractères)
 * @returns Les 8 premiers caractères hexadécimaux du hash
 */
export function extractTag(hash: string): string {
  return hash.substring(0, 8);
}
