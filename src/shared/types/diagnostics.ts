/**
 * @file shared/types/diagnostics.ts
 * @description Types partagés pour l'instrumentation M7 (Heartbeat, Canary, Registre d'incidents).
 *
 * Ces types sont produits par TACHE-061 (Heartbeat M7, Canary Hash, Registre d'incidents).
 * Ils constituent le contrat d'interface entre HeartbeatService, CanaryService,
 * IncidentService et les consommateurs (popup TACHE-062, tests).
 *
 * Référence : Mini-DAT TACHE-061 §3 (Contrats d'interface TypeScript)
 */

// ---------------------------------------------------------------------------
// Heartbeat (diagnostics.m7)
// ---------------------------------------------------------------------------

/**
 * Objet de santé M7 persisté sous la clé chrome.storage.local 'diagnostics.m7'.
 * Mis à jour à chaque boot SW et à chaque détection.
 * Consommé par TACHE-062 (badge dégradé si ready=false depuis > 1h).
 *
 * Invariant INV-01 : ready === true implique canary_verified === true.
 * Invariant INV-02 : boot_count est monotone croissant.
 * Invariant INV-05 : last_boot_ts mis à jour même en cas d'échec boot.
 */
export interface M7Diagnostics {
  /**
   * true si et seulement si la boot sequence s'est terminée sans erreur
   * ET le canary a été vérifié avec succès dans cette session SW.
   */
  ready: boolean;

  /**
   * Timestamp (ms since epoch) du dernier boot dont ready=true s'est propagé.
   * Utilisé par TACHE-062 : si Date.now() - last_boot_ts > 3600000 et ready=false → badge dégradé.
   * Mis à jour même en cas d'échec (INV-05) pour que la durée soit mesurable.
   */
  last_boot_ts: number;

  /**
   * Timestamp (ms since epoch) de la dernière détection de réutilisation.
   * null si aucune détection n'a eu lieu depuis l'installation.
   */
  last_detection_ts: number | null;

  /**
   * Nombre de boots du SW depuis l'installation (monotone croissant, jamais décrémenté).
   * Utile pour détecter les boucles de redémarrage anormales (boot_count > 50/heure = anomalie).
   */
  boot_count: number;

  /**
   * true si le canary a été vérifié avec succès lors de la session courante.
   * Invariant INV-01 : si ready=true alors canary_verified=true.
   */
  canary_verified: boolean;
}

/** Clé chrome.storage.local utilisée pour diagnostics.m7 */
export const DIAGNOSTICS_M7_KEY = 'diagnostics.m7';

/** Valeur par défaut retournée si diagnostics.m7 est absent du storage (premier boot) */
export const M7_DIAGNOSTICS_DEFAULT: M7Diagnostics = {
  ready: false,
  last_boot_ts: 0,
  last_detection_ts: null,
  boot_count: 0,
  canary_verified: false,
};

// ---------------------------------------------------------------------------
// Registre d'incidents (IndexedDB store m7_incidents)
// ---------------------------------------------------------------------------

/**
 * Types d'incidents tracés dans le registre M7.
 *
 * INV-SEC-05 : key_regenerated est inclus dans cette union (prérequis INV-SEC-03).
 * canary_reinit correspond au cas CM-EOP1 : canary corrompu mais clé AES fonctionnelle —
 * seul le canary est réinitialisé, la clé n'est PAS régénérée.
 */
export type M7IncidentType =
  | 'boot_fail' // Clé AES absente ou non importable au boot SW
  | 'canary_failed' // Canary non vérifié (absent, decrypt_failed, mismatch)
  | 'canary_reinit' // Canary corrompu mais clé AES OK (CM-EOP1) — réinitialisation sans régénération clé
  | 'submit_detect_fail' // Exception dans handlePasswordSubmitted
  | 'toast_orphan' // pending_m7_toast consommé mais toast non affiché
  | 'storage_write_fail' // Erreur lors d'un browser.storage.local.set critique
  | 'idb_write_fail' // Erreur lors d'une transaction IndexedDB M7
  | 'key_regenerated' // Régénération de la clé AES-256-GCM (INV-SEC-03 / INV-SEC-05)
  | 'rate_limit_exceeded'; // Dépassement du rate-limit par (tab.id, module) — INV-UC03-05

/** Sévérité d'un incident M7 */
export type M7IncidentSeverity = 'info' | 'warn' | 'error';

/**
 * Contexte typé pour chaque type d'incident.
 *
 * NOTE CM-ID2 : ce type union discriminée est la forme finale prescrite par la section 11.3
 * du mini-DAT TACHE-061 (CM-ID2). Il remplace le type libre `Record<string, unknown>`
 * initial et empêche à la compilation l'introduction de champs susceptibles de contenir
 * du plaintext sensible (INV-SEC-02).
 *
 * Règles de minimisation (INV-SEC-02) :
 * - Aucun mot de passe ni longueur exacte de mot de passe
 * - Aucun token/cookie/secret
 * - Aucune URL complète avec query string ou fragment
 * - Aucun domain_hash associé à un mot de passe saisi < 5s auparavant
 * - Seuls les champs structurés listés ci-dessous sont autorisés
 */
export type IncidentContext =
  | { type: 'boot_fail'; hint: 'key_absent' | 'import_failed'; boot_count: number }
  | { type: 'canary_failed'; reason: 'absent' | 'decrypt_failed' | 'mismatch' }
  | { type: 'canary_reinit'; reason: 'absent' | 'decrypt_failed' | 'mismatch' }
  | { type: 'submit_detect_fail'; code_path: string }
  | { type: 'toast_orphan'; domain_hash_prefix: string; age_ms: number }
  | { type: 'storage_write_fail'; key: string }
  | { type: 'idb_write_fail'; store: string }
  | {
      type: 'key_regenerated';
      trigger: 'boot_fail' | 'canary_failed' | 'decrypt_failed';
      previous_boot_count: number;
      hashes_purged_count: number;
    }
  | { type: 'rate_limit_exceeded'; module: string; tab_id: number };

/**
 * Entrée du registre d'incidents IndexedDB (store m7_incidents).
 *
 * INV-SEC-02 : le champ context est typé IncidentContext (union discriminée)
 * pour empêcher à la compilation l'introduction de données sensibles.
 * CM-ID2 : alignement sur la section 11.3 du mini-DAT.
 */
export interface M7IncidentRecord {
  /** Clé primaire autoIncrement (attribuée par IndexedDB) */
  id?: number;
  /** Timestamp de l'incident (ms since epoch) */
  ts: number;
  /** Type de l'incident */
  type: M7IncidentType;
  /** Sévérité */
  severity: M7IncidentSeverity;
  /**
   * Contexte structuré de l'incident — union discriminée par type (CM-ID2).
   * INV-SEC-02 : aucun plaintext sensible (mot de passe, token, URL complète).
   */
  context: IncidentContext;
}
