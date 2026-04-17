/**
 * @file shared/types/diagnostics.ts
 * @description Types partagés pour l'instrumentation des modules SW (Heartbeat, Canary, Registre d'incidents).
 *
 * Ces types sont produits par :
 * - TACHE-061 (Heartbeat M7, Canary Hash, Registre d'incidents)
 * - TACHE-085 (initBoot M2, diagnostics.m2, incidents whitelist M2)
 * - TACHE-086 (diagnostics.m3, incident events_store_corrupted)
 * - TACHE-087 (initBoot M5, diagnostics.m5, incidents m5_snooze_corrupted / update_check_failed)
 * - TACHE-088 (initBoot M6, diagnostics.m6, incidents m6_install_date_corrupted / quiz_deferred_stale)
 *
 * Ils constituent le contrat d'interface entre les services de boot, les handlers
 * et les consommateurs (popup TACHE-062, page état santé TACHE-109, tests).
 *
 * Référence : Mini-DAT TACHE-061 §3 (Contrats d'interface TypeScript)
 *             ADR-001 R-BOOT-04 (diagnostics.<module>)
 *             TACHE-085 (M2IncidentType, M2Diagnostics)
 *             TACHE-086/087/088 (M3/M5/M6 Diagnostics)
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
// Diagnostics M2 (diagnostics.m2)
// ---------------------------------------------------------------------------

/**
 * Objet de santé M2 persisté sous la clé chrome.storage.local 'diagnostics.m2'.
 * Mis à jour à chaque boot SW via initBootM2().
 * Consommé par TACHE-062 (badge dégradé) et TACHE-109 (page état de santé).
 *
 * Produit par TACHE-085 — ADR-001 R-BOOT-04.
 *
 * Invariant INV-M2-01 : ready === true implique whitelist_size > 0.
 * Invariant INV-M2-02 : last_boot_ts mis à jour à chaque boot (succès ou échec).
 */
export interface M2Diagnostics {
  /**
   * true si la séquence de boot M2 s'est terminée avec une whitelist valide et non vide.
   * false si la whitelist était absente/corrompue et la régénération a échoué, ou si
   * la régénération a réussi mais le storage est dans un état dégradé.
   * En pratique : true après régénération réussie depuis typosquatting-targets.json.
   */
  ready: boolean;

  /**
   * Timestamp (ms since epoch) du dernier boot M2.
   * Mis à jour à chaque boot, même en cas d'incident (INV-M2-02).
   */
  last_boot_ts: number;

  /**
   * Nombre d'entrées dans la whitelist de typosquatting au dernier boot.
   * Invariant INV-M2-01 : si ready=true alors whitelist_size > 0.
   * 0 si la whitelist est absente ou corrompue et la régénération a échoué.
   */
  whitelist_size: number;

  /**
   * Dernier incident M2 enregistré au boot, ou absent si aucun incident.
   * Champ optionnel consommé par TACHE-109 pour l'affichage de l'état de santé.
   */
  last_incident?: {
    /** Type d'incident M2 */
    type: 'whitelist_corrupted' | 'whitelist_regenerated';
    /** Sévérité de l'incident */
    severity: 'info' | 'warn' | 'error';
    /** Timestamp de l'incident (ms since epoch) */
    ts: number;
  };
}

/** Clé chrome.storage.local utilisée pour diagnostics.m2 */
export const DIAGNOSTICS_M2_KEY = 'diagnostics.m2';

/** Clé chrome.storage.local utilisée pour la whitelist de typosquatting M2 */
export const WHITELIST_M2_STORAGE_KEY = 'whitelist_m2';

/** Valeur par défaut retournée si diagnostics.m2 est absent du storage (premier boot) */
export const M2_DIAGNOSTICS_DEFAULT: M2Diagnostics = {
  ready: false,
  last_boot_ts: 0,
  whitelist_size: 0,
};

// ---------------------------------------------------------------------------
// Diagnostics M3 (diagnostics.m3)
// ---------------------------------------------------------------------------

/**
 * Objet de santé M3 persisté sous la clé chrome.storage.local 'diagnostics.m3'.
 *
 * Exception ADR-001 (Option B arbitrée en T-058) :
 * M3 n'implémente PAS initBootM3() complet. Le handler M3 est read-only sur les
 * events IDB — il ne dispose d'aucun état propre à initialiser au boot SW.
 * En revanche, diagnostics.m3 est publié via readM3Diagnostics() et mis à jour
 * au déclenchement de l'alarme score (check IDB accessible).
 *
 * Invariant INV-M3-01 : last_boot mis à jour à chaque exécution du handler score.
 */
export interface M3Diagnostics {
  /**
   * true si le dernier accès IDB du handler score s'est terminé sans incident.
   * false si events_store_corrupted a été détecté (IDB inaccessible au déclenchement alarme).
   */
  ready: boolean;

  /**
   * Timestamp (ms since epoch) du dernier déclenchement du handler score.
   * 0 si le handler ne s'est jamais exécuté.
   */
  last_boot: number;

  /**
   * Dernier incident M3 enregistré, ou absent si aucun.
   * Consommé par TACHE-109 pour l'affichage de l'état de santé.
   */
  last_incident?: {
    /** Type d'incident M3 */
    type: 'events_store_corrupted';
    /** Sévérité de l'incident */
    severity: 'info' | 'warn' | 'error';
    /** Timestamp de l'incident (ms since epoch) */
    ts: number;
  };
}

/** Clé chrome.storage.local utilisée pour diagnostics.m3 */
export const DIAGNOSTICS_M3_KEY = 'diagnostics.m3';

/** Valeur par défaut retournée si diagnostics.m3 est absent du storage */
export const M3_DIAGNOSTICS_DEFAULT: M3Diagnostics = {
  ready: false,
  last_boot: 0,
};

// ---------------------------------------------------------------------------
// Diagnostics M5 (diagnostics.m5)
// ---------------------------------------------------------------------------

/**
 * Objet de santé M5 persisté sous la clé chrome.storage.local 'diagnostics.m5'.
 * Mis à jour à chaque boot SW via initBootM5().
 *
 * Produit par TACHE-087 — ADR-001 R-BOOT-04 (Option A : initBoot complet).
 *
 * Invariant INV-M5-01 : last_boot_ts mis à jour à chaque boot (succès ou échec).
 * Invariant INV-M5-02 : snooze_count >= 0 après boot (réinitialisation à 0 si corrompu).
 */
export interface M5Diagnostics {
  /**
   * true si la séquence de boot M5 s'est terminée sans incident.
   * false si m5_snooze_count était corrompu ou si l'écriture du diagnostics a échoué.
   */
  ready: boolean;

  /**
   * Timestamp (ms since epoch) du dernier boot M5.
   * Mis à jour à chaque boot, même en cas d'incident (INV-M5-01).
   */
  last_boot_ts: number;

  /**
   * Valeur de m5_snooze_count lue (ou réinitialisée) au boot.
   * Invariant INV-M5-02 : toujours >= 0.
   */
  snooze_count: number;

  /**
   * Dernier incident M5 enregistré au boot, ou absent si aucun.
   * Consommé par TACHE-109 pour l'affichage de l'état de santé.
   */
  last_incident?: {
    /** Type d'incident M5 */
    type: 'm5_snooze_corrupted' | 'update_check_failed';
    /** Sévérité de l'incident */
    severity: 'info' | 'warn' | 'error';
    /** Timestamp de l'incident (ms since epoch) */
    ts: number;
  };
}

/** Clé chrome.storage.local utilisée pour diagnostics.m5 */
export const DIAGNOSTICS_M5_KEY = 'diagnostics.m5';

/** Clé chrome.storage.local pour le compteur de snoozes consécutifs M5 */
export const M5_SNOOZE_COUNT_STORAGE_KEY = 'm5_snooze_count';

/**
 * Clé chrome.storage.local pour le pending intent M5 update reminder (R-CLI-01).
 * Conforme à la convention pending_<module>_<action> de ADR-002.
 * Stocke un payload JSON-strict avec expires_at (R-CLI-03, TTL 30 minutes).
 */
export const PENDING_M5_UPDATE_REMINDER_KEY = 'pending_m5_update_reminder';

/** TTL du pending intent M5 update reminder en millisecondes (30 minutes — R-CLI-03) */
export const PENDING_M5_UPDATE_REMINDER_TTL_MS = 30 * 60 * 1000;

/** Valeur par défaut retournée si diagnostics.m5 est absent du storage (premier boot) */
export const M5_DIAGNOSTICS_DEFAULT: M5Diagnostics = {
  ready: false,
  last_boot_ts: 0,
  snooze_count: 0,
};

// ---------------------------------------------------------------------------
// Diagnostics M6 (diagnostics.m6)
// ---------------------------------------------------------------------------

/**
 * Objet de santé M6 persisté sous la clé chrome.storage.local 'diagnostics.m6'.
 * Mis à jour à chaque boot SW via initBootM6().
 *
 * Produit par TACHE-088 — ADR-001 R-BOOT-04 (Option A : initBoot complet).
 *
 * Invariant INV-M6-01 : last_boot_ts mis à jour à chaque boot (succès ou échec).
 * Invariant INV-M6-02 : install_date > 0 après boot (réinitialisé à Date.now() si absent/corrompu).
 *
 * Note sur m6_install_date absent/corrompu : la réinitialisation à Date.now() entraîne
 * une perte de l'historique de spaced repetition (les intervalles repartent de zéro).
 * Ce comportement est conservatif (pas de date fictive passée) et documenté dans TACHE-088.
 * Alternative non retenue : utiliser la date de premier quiz_session IDB (complexité élevée).
 */
export interface M6Diagnostics {
  /**
   * true si la séquence de boot M6 s'est terminée sans incident.
   * false si m6_install_date était absent/corrompu (réinitialisé à Date.now()).
   */
  ready: boolean;

  /**
   * Timestamp (ms since epoch) du dernier boot M6.
   * Mis à jour à chaque boot, même en cas d'incident (INV-M6-01).
   */
  last_boot_ts: number;

  /**
   * Valeur de m6_install_date lue (ou réinitialisée) au boot.
   * Invariant INV-M6-02 : toujours > 0.
   */
  install_date: number;

  /**
   * Dernier incident M6 enregistré au boot, ou absent si aucun.
   * Consommé par TACHE-109 pour l'affichage de l'état de santé.
   */
  last_incident?: {
    /** Type d'incident M6 */
    type: 'm6_install_date_corrupted' | 'quiz_deferred_stale';
    /** Sévérité de l'incident */
    severity: 'info' | 'warn' | 'error';
    /** Timestamp de l'incident (ms since epoch) */
    ts: number;
  };
}

/** Clé chrome.storage.local utilisée pour diagnostics.m6 */
export const DIAGNOSTICS_M6_KEY = 'diagnostics.m6';

/** Clé chrome.storage.local pour la date d'installation M6 (pivot spaced repetition) */
export const M6_INSTALL_DATE_STORAGE_KEY = 'm6_install_date';

/**
 * Clé chrome.storage.local pour le pending intent M6 quiz (R-CLI-01).
 * Renommée depuis `m6_quiz_deferred` (TACHE-088) pour conformité ADR-002 R-CLI-01.
 * Conforme à la convention pending_<module>_<action>.
 * Stocke un payload JSON-strict avec expires_at (R-CLI-03, TTL 7 jours).
 */
export const PENDING_M6_QUIZ_KEY = 'pending_m6_quiz';

/** TTL du pending intent M6 quiz en millisecondes (7 jours — R-CLI-03) */
export const PENDING_M6_QUIZ_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Valeur par défaut retournée si diagnostics.m6 est absent du storage (premier boot) */
export const M6_DIAGNOSTICS_DEFAULT: M6Diagnostics = {
  ready: false,
  last_boot_ts: 0,
  install_date: 0,
};

// ---------------------------------------------------------------------------
// Registre d'incidents partagé (IndexedDB store m7_incidents)
// ---------------------------------------------------------------------------

/**
 * Types d'incidents tracés dans le registre partagé (m7_incidents).
 *
 * Le store m7_incidents est le registre commun à tous les modules SW.
 * Son nom historique (m7) est conservé pour éviter une migration IDB.
 *
 * INV-SEC-05 : key_regenerated est inclus dans cette union (prérequis INV-SEC-03).
 * canary_reinit correspond au cas CM-EOP1 : canary corrompu mais clé AES fonctionnelle —
 * seul le canary est réinitialisé, la clé n'est PAS régénérée.
 *
 * TACHE-085 : ajout de whitelist_corrupted et whitelist_regenerated (incidents M2).
 * TACHE-086 : ajout de events_store_corrupted (incident M3).
 * TACHE-087 : ajout de m5_snooze_corrupted et update_check_failed (incidents M5).
 * TACHE-088 : ajout de m6_install_date_corrupted et quiz_deferred_stale (incidents M6).
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
  | 'rate_limit_exceeded' // Dépassement du rate-limit par (tab.id, module) — INV-UC03-05
  | 'whitelist_corrupted' // M2 — entrée JSON illisible ou shape invalide détectée (TACHE-085)
  | 'whitelist_regenerated' // M2 — régénération whitelist depuis typosquatting-targets.json (TACHE-085)
  | 'events_store_corrupted' // M3 — IDB inaccessible au déclenchement alarme score (TACHE-086)
  | 'm5_snooze_corrupted' // M5 — m5_snooze_count absent ou shape invalide au boot (TACHE-087)
  | 'update_check_failed' // M5 — chrome.runtime.requestUpdateCheck() a échoué (TACHE-087)
  | 'm6_install_date_corrupted' // M6 — m6_install_date absent ou invalide au boot (TACHE-088)
  | 'quiz_deferred_stale'; // M6 — pending_m6_quiz dépassé son expires_at (TACHE-088)

/** Sévérité d'un incident (M7 et autres modules SW) */
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
 *
 * TACHE-085 : ajout de whitelist_corrupted et whitelist_regenerated (incidents M2).
 * TACHE-086 : ajout de events_store_corrupted (M3).
 * TACHE-087 : ajout de m5_snooze_corrupted et update_check_failed (M5).
 * TACHE-088 : ajout de m6_install_date_corrupted et quiz_deferred_stale (M6).
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
  | { type: 'rate_limit_exceeded'; module: string; tab_id: number }
  | {
      type: 'whitelist_corrupted';
      /** Motif de la corruption : absent = clé absente, invalid_shape = structure JSON invalide */
      reason: 'absent' | 'invalid_shape';
      /** Nombre d'entrées dans la whitelist au moment de la détection (0 si absente) */
      entry_count: number;
    }
  | {
      type: 'whitelist_regenerated';
      /** Taille de la whitelist avant régénération (0 si absente) */
      previous_size: number;
      /** Taille de la whitelist après régénération depuis typosquatting-targets.json */
      new_size: number;
    }
  | {
      type: 'events_store_corrupted';
      /**
       * Motif d'inaccessibilité IDB au déclenchement alarme M3.
       * R-CLI-07 : aucun texte de question, uniquement un code d'erreur structuré.
       */
      error_name: string;
    }
  | {
      type: 'm5_snooze_corrupted';
      /**
       * Valeur lue dans le storage avant réinitialisation.
       * Sérialisée en string pour éviter tout type unexpected (INV-SEC-02).
       */
      stored_type: string;
    }
  | {
      type: 'update_check_failed';
      /**
       * Nom de l'erreur levée par chrome.runtime.requestUpdateCheck().
       * R-M7-08 : uniquement le nom, jamais le message (peut contenir des données techniques).
       */
      error_name: string;
    }
  | {
      type: 'm6_install_date_corrupted';
      /**
       * Motif de la corruption : 'absent' si clé manquante, 'invalid_type' si type incorrect.
       */
      reason: 'absent' | 'invalid_type';
    }
  | {
      type: 'quiz_deferred_stale';
      /**
       * Durée de dépassement en millisecondes au moment de la détection.
       * Permet de mesurer le délai de nettoyage (INV-SEC-02 : pas de données quiz).
       */
      overdue_ms: number;
    };

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
