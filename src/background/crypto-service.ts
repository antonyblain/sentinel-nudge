/**
 * @file background/crypto-service.ts
 * @description Service de chiffrement AES-256-GCM via SubtleCrypto (Web Crypto API native).
 *
 * Protège les données comportementales au repos dans IndexedDB.
 * La clé est générée une fois à l'installation et persistée dans chrome.storage.local
 * sous forme de matériau exporté (ArrayBuffer).
 *
 * Paramètres de chiffrement :
 * - Algorithme : AES-GCM
 * - Longueur de clé : 256 bits
 * - IV : 12 bytes (96 bits), généré aléatoirement par opération de chiffrement
 * - Tag d'authentification : 128 bits (défaut AES-GCM)
 *
 * Référence : DAT §8.2 (Chiffrement AES-256-GCM), §9.4 (D-SEC-004)
 */

/** Résultat d'une opération de chiffrement */
export interface EncryptResult {
  /** Données chiffrées */
  ciphertext: ArrayBuffer;
  /** IV de 12 bytes utilisé pour ce chiffrement (à stocker avec les données) */
  iv: Uint8Array;
}

/**
 * Service de chiffrement/déchiffrement AES-256-GCM.
 *
 * Toutes les méthodes sont async car SubtleCrypto est une API Promise-based.
 * Ce service est instancié dans le service worker et utilisé par StorageService.
 */
export class CryptoService {
  /**
   * Génère une nouvelle clé AES-256-GCM.
   *
   * Appelé une seule fois à l'installation (onInstalled).
   * La clé est exportable pour être persistée dans chrome.storage.local.
   *
   * @returns CryptoKey AES-256-GCM extractable
   * @throws DOMException si SubtleCrypto n'est pas disponible
   */
  async generateKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true, // extractable : nécessaire pour l'export et la persistance
      ['encrypt', 'decrypt'],
    );
  }

  /**
   * Exporte une CryptoKey en ArrayBuffer brut (format 'raw').
   *
   * Le matériau exporté est stocké dans chrome.storage.local.
   * Risque documenté D-SEC-004 : la clé est accessible à toute extension
   * ayant accès au profil Chrome. Mitigation PBKDF2 prévue en v2+.
   *
   * @param key - CryptoKey AES-256-GCM à exporter
   * @returns ArrayBuffer du matériau de clé brut (32 bytes)
   */
  async exportKey(key: CryptoKey): Promise<ArrayBuffer> {
    return crypto.subtle.exportKey('raw', key);
  }

  /**
   * Importe un matériau de clé brut en CryptoKey AES-256-GCM.
   *
   * Appelé à chaque réveil du Service Worker pour reconstruire la clé
   * depuis le matériau persisté dans chrome.storage.local.
   *
   * @param material - ArrayBuffer du matériau de clé brut (32 bytes)
   * @returns CryptoKey AES-256-GCM prête à l'emploi
   */
  async importKey(material: ArrayBuffer): Promise<CryptoKey> {
    return crypto.subtle.importKey(
      'raw',
      material,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false, // non extractable après import : limite la surface d'attaque en mémoire
      ['encrypt', 'decrypt'],
    );
  }

  /**
   * Chiffre un objet quelconque en AES-256-GCM.
   *
   * L'objet est sérialisé en JSON, encodé en UTF-8, puis chiffré.
   * Un IV de 12 bytes est généré aléatoirement pour chaque opération.
   *
   * @param key  - CryptoKey AES-256-GCM (importée depuis chrome.storage.local)
   * @param data - Objet à chiffrer (sera sérialisé en JSON)
   * @returns Résultat contenant le ciphertext et l'IV à stocker
   */
  async encrypt(key: CryptoKey, data: object): Promise<EncryptResult> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const plaintext = encoder.encode(JSON.stringify(data));

    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      plaintext,
    );

    return { ciphertext, iv };
  }

  /**
   * Déchiffre un ArrayBuffer chiffré en AES-256-GCM.
   *
   * @param key        - CryptoKey AES-256-GCM (importée depuis chrome.storage.local)
   * @param ciphertext - Données chiffrées (champ `value` du record IndexedDB)
   * @param iv         - IV de 12 bytes stocké avec les données chiffrées
   * @returns Objet déchiffré et désérialisé depuis JSON
   * @throws DOMException si le déchiffrement échoue (données corrompues ou mauvaise clé)
   */
  async decrypt(key: CryptoKey, ciphertext: ArrayBuffer, iv: Uint8Array): Promise<object> {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      ciphertext,
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(plaintext)) as object;
  }
}
