/**
 * @file background/services/canary-service.ts
 * @description Service de gestion du canary hash M7.
 *
 * Le canary est un mécanisme de détection d'intégrité logicielle (NON adversariale) :
 * il détecte les états non-malveillants (clé absente, clé corrompue par bug P-018,
 * storage partiellement purgé). Il ne constitue PAS une protection contre un adversaire
 * qui possède la clé (CM-C1 — mini-DAT §11.1).
 *
 * Fonctionnement :
 * - init()   : chiffre CANARY_PLAINTEXT avec la clé AES donnée, persiste ciphertext + IV en
 *              Array<number> dans chrome.storage.local (règle P-018 / INV-06).
 * - verify() : déchiffre le canary stocké, compare au CANARY_PLAINTEXT.
 *              Retourne ok:true ou ok:false avec raison (absent/decrypt_failed/mismatch).
 *
 * CM-EOP1 (élévation de privilège §11.5) :
 * Avant de conclure "clé perdue → régénérer", le service worker doit tenter de
 * déchiffrer une entrée password_hashes existante. Si elle se déchiffre, seul le
 * canary est réinitialisé (canary_reinit). Ce contrôle est implémenté dans service-worker.ts,
 * pas ici — ce service expose uniquement init() et verify().
 *
 * Invariants :
 * - INV-04  : canary_ciphertext et canary_iv sont toujours écrits ensemble (set atomique)
 * - INV-06  : stockage en Array<number>, jamais ArrayBuffer ni Uint8Array (leçon P-018)
 * - INV-SEC-01 : IV généré par crypto.getRandomValues à chaque init() — jamais réutilisé
 *
 * Note compat (P-021) : globalThis.crypto est utilisé explicitement (pas la référence nue
 * `crypto`) pour garantir que le polyfill WebCrypto injecté dans les tests (tests/setup.ts)
 * est correctement résolu sur tous les runtimes Node.js (Node 20, 22, 24) et navigateurs.
 *
 * Référence : Mini-DAT TACHE-061 §3.2, §6 (INV-04/06), §6bis (INV-SEC-01), §11.1/11.5
 */

import type { CryptoService } from '@/background/crypto-service';
import { browser } from '@/shared/browser/browser-adapter';

/**
 * Plaintext de référence chiffré par le canary.
 *
 * AVERTISSEMENT : ne pas modifier cette valeur entre versions de l'extension.
 * Une modification invaliderait le canary de tous les utilisateurs existants
 * et provoquerait une régénération de clé inutile. Si modification inévitable,
 * la migration doit réinitialiser le canary explicitement.
 */
export const CANARY_PLAINTEXT = 'SN-CANARY-v1';

/** Clés chrome.storage.local pour les composants du canary */
export const CANARY_KEYS = {
  /** Ciphertext AES-GCM du canary, stocké en Array<number> (INV-06 / P-018) */
  CIPHERTEXT: 'canary_ciphertext',
  /** IV AES-GCM (12 bytes), stocké en Array<number> (INV-06 / P-018) */
  IV: 'canary_iv',
} as const;

/**
 * Résultat de la vérification du canary.
 *
 * - ok: true  → la clé est fonctionnelle et correspond au canary stocké
 * - ok: false, reason: 'absent'         → premier boot ou storage purgé → appeler init()
 * - ok: false, reason: 'decrypt_failed' → clé corrompue ou changée → appliquer CM-EOP1
 * - ok: false, reason: 'mismatch'       → déchiffrement réussi mais plaintext différent
 *                                          (ne devrait pas arriver — log error + appliquer CM-EOP1)
 */
export type CanaryVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'absent' | 'decrypt_failed' | 'mismatch' };

/**
 * Service de gestion du canary hash.
 *
 * Instancié dans service-worker.ts avec la référence CryptoService existante.
 * Dépend uniquement de CryptoService et de browser (chrome.storage.local).
 */
export class CanaryService {
  constructor(private readonly crypto: CryptoService) {}

  /**
   * Chiffre CANARY_PLAINTEXT avec la clé fournie et persiste dans chrome.storage.local.
   *
   * Appelé :
   * - Une fois au premier boot après install (onFirstInstall)
   * - Après régénération de clé AES (chemin canary_failed)
   * - Après détection CM-EOP1 (canary corrompu mais clé OK → réinit sans régénération)
   *
   * Règles de stockage :
   * - Uint8Array → Array<number> (JSON-safe, INV-06 / leçon P-018)
   * - IV généré par crypto.getRandomValues — jamais réutilisé (INV-SEC-01)
   * - Écriture atomique des deux clés dans un seul set() — INV-04
   *
   * @param key - CryptoKey AES-256-GCM active
   * @throws Error si le chiffrement ou la persistance échoue
   */
  async init(key: CryptoKey): Promise<void> {
    const encoder = new TextEncoder();
    const plaintext = encoder.encode(CANARY_PLAINTEXT);

    // IV généré aléatoirement à chaque init — INV-SEC-01 (jamais réutilisé)
    // globalThis.crypto explicite pour compatibilité Node 20/22/24 avec polyfill jsdom (P-021)
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await globalThis.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      plaintext,
    );

    // Conversion ArrayBuffer → Array<number> (JSON-safe, INV-06 / leçon P-018)
    const ciphertextArray = Array.from(new Uint8Array(ciphertext));
    const ivArray = Array.from(iv);

    // Écriture atomique des deux composants — INV-04
    await browser.storage.local.set({
      [CANARY_KEYS.CIPHERTEXT]: ciphertextArray,
      [CANARY_KEYS.IV]: ivArray,
    });
  }

  /**
   * Déchiffre le canary stocké et compare au CANARY_PLAINTEXT.
   *
   * Algorithme :
   * 1. Lire canary_ciphertext + canary_iv depuis chrome.storage.local
   * 2. Si l'un des deux est absent → reason: 'absent' (INV-04 : absent = les deux absents)
   * 3. Convertir Array<number> → Uint8Array et ArrayBuffer (INV-06 inverse)
   * 4. Déchiffrer via SubtleCrypto.decrypt
   * 5. Comparer le plaintext déchiffré à CANARY_PLAINTEXT
   *
   * @param key - CryptoKey AES-256-GCM à vérifier
   * @returns CanaryVerifyResult
   */
  async verify(key: CryptoKey): Promise<CanaryVerifyResult> {
    const result = await browser.storage.local.get([CANARY_KEYS.CIPHERTEXT, CANARY_KEYS.IV]);

    const storedCiphertext = result[CANARY_KEYS.CIPHERTEXT];
    const storedIv = result[CANARY_KEYS.IV];

    // INV-04 : si l'un des deux est absent → considérer absent (état incohérent = absent)
    if (!Array.isArray(storedCiphertext) || !Array.isArray(storedIv)) {
      return { ok: false, reason: 'absent' };
    }

    // Reconstitution depuis Array<number> → Uint8Array / ArrayBuffer (INV-06 inverse)
    const ivBytes = new Uint8Array(storedIv as number[]);
    const ciphertextBuffer = new Uint8Array(storedCiphertext as number[]).buffer;

    try {
      // globalThis.crypto explicite pour compatibilité Node 20/22/24 avec polyfill jsdom (P-021)
      const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBytes },
        key,
        ciphertextBuffer,
      );

      const decoder = new TextDecoder();
      const decryptedText = decoder.decode(decryptedBuffer);

      if (decryptedText !== CANARY_PLAINTEXT) {
        // Déchiffrement réussi mais plaintext différent — ne devrait pas arriver
        return { ok: false, reason: 'mismatch' };
      }

      return { ok: true };
    } catch {
      // SubtleCrypto.decrypt lève DOMException si la clé est incompatible ou les données corrompues
      return { ok: false, reason: 'decrypt_failed' };
    }
  }
}
