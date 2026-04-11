/**
 * @file storage.ts
 * @description Interfaces des schémas de stockage Sentinel Nudge.
 *
 * Couvre :
 * - Les 5 stores IndexedDB chiffrés AES-256-GCM (sentinel-nudge-db)
 * - Le schéma chrome.storage.local (configuration et état volatile)
 * - L'interface d'export RGPD (portabilité des données, Art. 20)
 *
 * Référence : DAT §8.1 (IndexedDB), §8.3 (politique purge), §8.2 (chiffrement)
 */

import type { ModuleId } from './modules';

// ---------------------------------------------------------------------------
// Stores IndexedDB
// ---------------------------------------------------------------------------

/**
 * Enregistrement dans le store `events`.
 *
 * La valeur comportementale est chiffrée (AES-256-GCM) dans `value`.
 * L'`id`, le `timestamp` et le `module` restent en clair pour permettre l'indexation.
 * Rétention : 90 jours.
 *
 * @property id        - Clé primaire auto-incrémentée (en clair)
 * @property timestamp - Date.now() au moment de l'événement (en clair, indexé)
 * @property module    - Identifiant du module source (en clair, indexé)
 * @property value     - Contenu chiffré AES-256-GCM (EventPayload sérialisé)
 * @property iv        - IV de 12 bytes pour le déchiffrement AES-GCM
 */
export interface EventRecord {
  id: number;
  timestamp: number;
  module: string;
  value: ArrayBuffer;
  iv: Uint8Array;
}

/**
 * Contenu déchiffré du champ `value` d'un EventRecord.
 *
 * @property domain_hash  - SHA-256(installation_salt + domain) — jamais le domaine en clair
 * @property signals      - Signaux de risque détectés (M2)
 * @property action       - Action utilisateur sur le nudge (ex: 'dismissed', 'accepted')
 * @property score_delta  - Variation de score attribuée à cet événement (M3)
 * @property module_data  - Données additionnelles spécifiques au module
 */
export interface EventPayload {
  domain_hash?: string;
  signals?: string[];
  action?: string;
  score_delta?: number;
  module_data?: Record<string, unknown>;
}

/**
 * Enregistrement dans le store `password_hashes` (module M7 — réutilisation mot de passe).
 *
 * Le hash du mot de passe est stocké chiffré (AES-256-GCM) dans `value`.
 * L'index `tag` (4 premiers bytes du hash en clair, hex) permet une pré-filtration
 * efficace sans exposer le hash complet (NC-DPO-01).
 * Rétention : 90 jours + FIFO max 100 entrées.
 *
 * @property id          - Clé primaire auto-incrémentée (en clair)
 * @property tag         - 4 premiers bytes du SHA-256 en hex (ex: "a3f2c1b0") — en clair, indexé
 * @property value       - SHA-256(installation_salt + password) chiffré AES-256-GCM
 * @property iv          - IV 12 bytes pour déchiffrement
 * @property domain_hash - SHA-256(installation_salt + domain) — en clair, indexé
 * @property first_seen  - Date.now() de la première détection — en clair, indexé pour purge FIFO
 * @property count       - Nombre de fois détecté sur ce domaine
 */
export interface PasswordHashRecord {
  id: number;
  tag: string;
  value: ArrayBuffer;
  iv: Uint8Array;
  domain_hash: string;
  first_seen: number;
  count: number;
}

/**
 * Session de quiz M6 (spaced repetition).
 * Rétention : 52 semaines.
 *
 * @property id         - Clé primaire auto-incrémentée
 * @property module     - Toujours 'M6'
 * @property quiz_date  - Date ISO 8601 de la session
 * @property questions  - Questions posées lors de la session (chiffrées dans value)
 * @property value      - Contenu chiffré AES-256-GCM (détail questions + réponses + score)
 * @property iv         - IV 12 bytes pour déchiffrement
 */
export interface QuizSession {
  id: number;
  module: 'M6';
  quiz_date: string;
  value: ArrayBuffer;
  iv: Uint8Array;
}

/**
 * Score hebdomadaire M3.
 * Clé primaire = semaine ISO (ex: "2026-W15").
 * Rétention : 52 semaines.
 *
 * @property week_key    - Clé de semaine ISO (YYYY-Www), clé primaire
 * @property total_score - Score total sur 100 points
 * @property components  - Détail des 5 composantes du score M3
 * @property value       - Contenu chiffré AES-256-GCM (détail complet)
 * @property iv          - IV 12 bytes pour déchiffrement
 */
export interface WeeklyScore {
  week_key: string;
  total_score: number;
  components: Record<string, number>;
  value: ArrayBuffer;
  iv: Uint8Array;
}

/**
 * Entrée de la whitelist (domaines de confiance marqués par l'utilisateur — M2).
 * Rétention : permanent jusqu'à effacement par l'utilisateur.
 *
 * @property domain_hash - SHA-256(installation_salt + domain) — clé primaire (en clair)
 * @property added_at    - Date.now() de l'ajout à la whitelist
 */
export interface WhitelistEntry {
  domain_hash: string;
  added_at: number;
}

// ---------------------------------------------------------------------------
// chrome.storage.local
// ---------------------------------------------------------------------------

/**
 * Schéma de chrome.storage.local.
 *
 * Contient la configuration utilisateur, la clé de chiffrement IndexedDB,
 * l'état quota journalier et les données de session volatile.
 *
 * Référence : DAT §8.1 (ChromeStorageSchema)
 */
export interface ChromeStorageSchema {
  /** Configuration utilisateur persistante */
  config: {
    /** État d'activation de chaque module */
    modules: Record<ModuleId, boolean>;
    /** Limite de quota journalier (null = illimité) */
    quota_limit: 3 | 5 | 10 | null;
    /** Niveau de profil pour la personnalisation des nudges */
    profile: 'beginner' | 'intermediate' | 'advanced';
    /** true après complétion de l'onboarding obligatoire */
    onboarding_complete: boolean;
    /** Langue préférée de l'interface */
    language: 'fr' | 'en';
  };

  /**
   * Matériau exporté de la CryptoKey AES-256-GCM.
   * Stocké en clair dans chrome.storage.local — risque documenté D-SEC-004.
   */
  encryption_key_material: ArrayBuffer;

  /** État du quota journalier — réinitialisé à minuit */
  quota_state: {
    date: string;
    count: number;
  };

  /**
   * Domaines déjà nudgés dans la session Chrome courante (M2).
   * Évite de répéter le même nudge sur le même domaine dans la même session.
   * Contient des SHA-256(installation_salt + domain).
   */
  m2_session_domains: string[];

  /**
   * Sel d'installation unique (D-SEC-001).
   * 16 bytes (128 bits) générés via crypto.getRandomValues au premier lancement.
   * Stocké en représentation hexadécimale (32 caractères).
   * Utilisé pour : SHA-256(salt + password) et SHA-256(salt + domain).
   */
  installation_salt: string;
}

// ---------------------------------------------------------------------------
// Export RGPD (Art. 20 — portabilité des données)
// ---------------------------------------------------------------------------

/**
 * Structure du fichier d'export des données personnelles.
 *
 * Produit par la page Options (bouton "Exporter mes données").
 * Téléchargé localement via URL.createObjectURL() + <a download>.
 * Aucune donnée ne transite par le réseau.
 *
 * Note : les hashes de mots de passe ne sont PAS inclus en clair —
 * seules les métadonnées agrégées sont exportées (NC-DPO-01).
 *
 * Référence : DAT §8.3 — Politique de purge (export)
 */
export interface ExportPayload {
  /** Version du schéma d'export (SemVer) */
  version: string;
  /** Date d'export au format ISO 8601 */
  exported_at: string;
  /** Version de l'extension au moment de l'export */
  extension_version: string;
  /** Configuration utilisateur au moment de l'export */
  config: ChromeStorageSchema['config'];
  /** Données personnelles exportées */
  data: {
    /** Événements de nudge déchiffrés (90 derniers jours) */
    events: EventPayload[];
    /** Métadonnées agrégées des hashes de mots de passe (pas les hashes en clair) */
    password_hashes: {
      count: number;
      oldest: string;
      newest: string;
    };
    /** Sessions quiz déchiffrées (52 dernières semaines) */
    quiz_sessions: QuizSession[];
    /** Scores hebdomadaires déchiffrés (52 dernières semaines) */
    weekly_scores: WeeklyScore[];
    /** Domaines de la whitelist (hashes SHA-256, non réversibles) */
    whitelist: WhitelistEntry[];
  };
}
