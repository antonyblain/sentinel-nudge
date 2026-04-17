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
 * - TACHE-089 (diagnostics.m9, Option B — handler read-only, pas d'initBoot)
 * - TACHE-090 (pending_m17_toast cross-lifecycle, R-CLI-01 à 07 ADR-002)
 * - TACHE-091 (migration pending_m7_toast timestamp → expires_at, R-CLI-03)
 *
 * Ils constituent le contrat d'interface entre les services de boot, les handlers
 * et les consommateurs (popup TACHE-062, page état santé TACHE-109, tests).
 *
 * Référence : Mini-DAT TACHE-061 §3 (Contrats d'interface TypeScript)
 *             ADR-001 R-BOOT-04 (diagnostics.<module>)
 *             ADR-002 (pending intents cross-lifecycle, R-CLI-01 à 07)
 *             TACHE-085/086/087/088/089/090/091
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
// Pending M7 toast (cross-lifecycle) — TACHE-091 (migration R-CLI-03)
// ---------------------------------------------------------------------------

/**
 * Payload persisté dans chrome.storage.local sous la clé 'pending_m7_toast'.
 * Représente l'intention d'afficher le toast M7 après navigation post-submit.
 *
 * TACHE-091 (R-CLI-03) : migration de `timestamp` vers `expires_at`.
 * L'ancien format { domain_hash, timestamp } est accepté en lecture (backward compat)
 * et converti + ré-écrit en nouveau format par readPendingM7Toast().
 * Exception E-CLI-01 (ADR-002) supprimée : M7 est désormais conforme R-CLI-03.
 *
 * Cycle de vie :
 * - Écrit par m7-handler au moment de la détection de réutilisation.
 * - Consommé (lu + supprimé) par le content script via storage.onChanged.
 * - TTL : 10 minutes. Au-delà : toast_orphan incident (TACHE-061).
 *
 * R-CLI-07 : domain_hash uniquement (hash du domaine) — jamais d'URL en clair.
 */
export interface PendingM7Toast {
  /** Hash SHA-256 salé du domaine de détection (jamais l'URL en clair) */
  domain_hash: string;
  /**
   * Timestamp d'expiration (ms since epoch) — R-CLI-03.
   * Calculé : Date.now() + TTL au moment de l'écriture.
   */
  expires_at: number;
}

/**
 * Shape legacy du pending_m7_toast (format avant TACHE-091).
 * Utilisé uniquement pour la lecture backward-compatible dans readPendingM7Toast().
 * NE PAS utiliser pour l'écriture — toujours écrire en PendingM7Toast.
 *
 * @internal
 */
export interface PendingM7ToastLegacy {
  domain_hash: string;
  /** Timestamp de création (ms since epoch) — format pré-TACHE-091 */
  timestamp: number;
}

/** Clé chrome.storage.local pour le pending intent M7 toast */
export const PENDING_M7_TOAST_KEY = 'pending_m7_toast';

/** TTL du pending intent M7 toast en millisecondes (10 minutes) */
export const PENDING_M7_TOAST_TTL_MS = 10 * 60 * 1000;

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
// Diagnostics M9 (diagnostics.m9) — TACHE-089
// ---------------------------------------------------------------------------

/**
 * Objet de santé M9 persisté sous la clé chrome.storage.local 'diagnostics.m9'.
 *
 * Exception ADR-001 (Option B arbitrée — TACHE-089) :
 * M9 n'implémente PAS initBootM9() complet. Le handler M9 est read-only sur les
 * events IDB (écriture unique au submit) — il ne dispose d'aucun état propre à
 * valider/régénérer au boot SW.
 * Les diagnostics sont mis à jour à chaque action handler (à la demande).
 *
 * Rationale (voir JSDoc handler) : pas de storage métier critique à vérifier au boot.
 * Le seul storage M9 est le store events IDB — géré et vérifié par M3.
 *
 * Invariant INV-M9-01 : last_action_ts mis à jour à chaque appel au handler M9.
 */
export interface M9Diagnostics {
  /**
   * true si le dernier appel au handler M9 s'est terminé sans erreur de storage.
   * false si une exception logEvent a été levée (incident m9_handler_error).
   */
  ready: boolean;

  /**
   * Timestamp (ms since epoch) du dernier appel au handler M9.
   * 0 si le handler ne s'est jamais exécuté.
   */
  last_action_ts: number;

  /**
   * Dernier incident M9 enregistré, ou absent si aucun.
   * Consommé par TACHE-109 pour l'affichage de l'état de santé.
   */
  last_incident?: {
    /** Type d'incident M9 */
    type: 'm9_handler_error';
    /** Sévérité de l'incident */
    severity: 'info' | 'warn' | 'error';
    /** Timestamp de l'incident (ms since epoch) */
    ts: number;
  };
}

/** Clé chrome.storage.local utilisée pour diagnostics.m9 */
export const DIAGNOSTICS_M9_KEY = 'diagnostics.m9';

/** Valeur par défaut retournée si diagnostics.m9 est absent du storage */
export const M9_DIAGNOSTICS_DEFAULT: M9Diagnostics = {
  ready: false,
  last_action_ts: 0,
};

// ---------------------------------------------------------------------------
// Diagnostics M17 (diagnostics.m17) — TACHE-089
// ---------------------------------------------------------------------------

/**
 * Objet de santé M17 persisté sous la clé chrome.storage.local 'diagnostics.m17'.
 *
 * Exception ADR-001 (Option B arbitrée — TACHE-089) :
 * M17 n'implémente PAS initBootM17() complet. Le handler M17 est critique (bypass quota)
 * mais ne dispose d'aucun état propre à valider/régénérer au boot SW.
 * Les diagnostics sont mis à jour à chaque action handler (à la demande).
 *
 * Rationale (voir JSDoc handler) : pas de storage métier critique à vérifier au boot.
 * Le seul storage M17 métier est le store events IDB — géré par M3 — et pending_m17_toast
 * (géré par m17-handler + consommateur content script).
 *
 * Invariant INV-M17-01 : last_action_ts mis à jour à chaque appel au handler M17.
 */
export interface M17Diagnostics {
  /**
   * true si le dernier appel au handler M17 s'est terminé sans erreur de storage.
   * false si une exception a été levée (incident m17_handler_error).
   */
  ready: boolean;

  /**
   * Timestamp (ms since epoch) du dernier appel au handler M17.
   * 0 si le handler ne s'est jamais exécuté.
   */
  last_action_ts: number;

  /**
   * Dernier incident M17 enregistré, ou absent si aucun.
   * Consommé par TACHE-109 pour l'affichage de l'état de santé.
   */
  last_incident?: {
    /** Type d'incident M17 */
    type: 'm17_handler_error';
    /** Sévérité de l'incident */
    severity: 'info' | 'warn' | 'error';
    /** Timestamp de l'incident (ms since epoch) */
    ts: number;
  };
}

/** Clé chrome.storage.local utilisée pour diagnostics.m17 */
export const DIAGNOSTICS_M17_KEY = 'diagnostics.m17';

/** Valeur par défaut retournée si diagnostics.m17 est absent du storage */
export const M17_DIAGNOSTICS_DEFAULT: M17Diagnostics = {
  ready: false,
  last_action_ts: 0,
};

// ---------------------------------------------------------------------------
// Pending M17 toast (cross-lifecycle) — TACHE-090 (ADR-002 R-CLI-01 à 07)
// ---------------------------------------------------------------------------

/**
 * Types de données sensibles reconnus par M17 (enum strict ADR-002 R-CLI-07).
 *
 * IMPORTANT R-002 + R-CLI-07 : ce champ contient UNIQUEMENT le type détecté,
 * JAMAIS la valeur collée. La valeur du presse-papiers ne doit à aucun moment
 * être sérialisée dans chrome.storage.local.
 *
 * Note : 'cb' = carte bancaire (credit_card), abrégée pour réduire l'empreinte storage.
 * Le content script mappe 'cb' → 'credit_card' pour l'affichage.
 */
export type PendingM17DataType = 'cb' | 'iban' | 'ssn';

/**
 * Payload persisté dans chrome.storage.local sous la clé 'pending_m17_toast'.
 * Représente l'intention d'afficher le toast M17 au content script actif.
 *
 * Conforme ADR-002 R-CLI-01 à 07 :
 * - R-CLI-01 : convention de nommage pending_<module>_<action>
 * - R-CLI-02 : payload JSON-strict, aucun objet complexe
 * - R-CLI-03 : expires_at (jamais timestamp) pour la durée de vie
 * - R-CLI-04 : consommation = suppression atomique
 * - R-CLI-05 : survie au kill du SW (persisté dans chrome.storage.local)
 * - R-CLI-06 : tab_id optionnel pour cibler un onglet spécifique
 * - R-CLI-07 : data_type enum strict — JAMAIS la valeur collée (R-002 absolu)
 *
 * Cycle de vie :
 * - Écrit par m17-handler.handleSensitiveDataDetected().
 * - Consommé (lu + supprimé) par le content script via storage.onChanged.
 * - TTL : 5 minutes (chrome.storage.local quota limité, TTL court acceptable
 *   car le presse-papiers est en mémoire vive et le toast est urgency-high).
 *   Si le SW est killed après écriture et la page n'est jamais rechargée,
 *   le toast fantôme est évité par le TTL + vérification expires_at à la lecture.
 *
 * D-SEC-002 : AUCUNE valeur sensible n'est stockée — uniquement data_type (enum).
 */
export interface PendingM17Toast {
  /**
   * Type de donnée sensible détectée (enum strict).
   * R-CLI-07 + R-002 : JAMAIS la valeur collée, uniquement le type.
   */
  data_type: PendingM17DataType;
  /**
   * Timestamp d'expiration (ms since epoch) — R-CLI-03.
   * Calculé : Date.now() + PENDING_M17_TOAST_TTL_MS au moment de l'écriture.
   */
  expires_at: number;
  /**
   * Identifiant de l'onglet source de la détection (optionnel — R-CLI-06).
   * Permet au content script de n'afficher le toast que dans l'onglet concerné.
   */
  tab_id?: number;
}

/** Clé chrome.storage.local pour le pending intent M17 toast */
export const PENDING_M17_TOAST_KEY = 'pending_m17_toast';

/**
 * TTL du pending intent M17 toast en millisecondes (5 minutes).
 *
 * Justification du TTL court (5 min vs 10 min pour M7) :
 * - Le presse-papiers est une donnée éphémère (en mémoire vive) — le risque
 *   diminue rapidement dès que l'utilisateur colle autre chose.
 * - chrome.storage.local a un quota limité (5 MB) — les TTL courts préservent
 *   le quota pour les données persistentes (hashes, whitelist, diagnostics).
 * - Un toast après 5 min d'inactivité post-coller serait contextually irrelevant.
 * - Conforme à l'urgency-high de M17 (avertissement immédiat vs suivi long terme M7).
 */
export const PENDING_M17_TOAST_TTL_MS = 5 * 60 * 1000;

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
 * TACHE-089 : ajout de m9_handler_error et m17_handler_error (Option B M9/M17).
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
  | 'quiz_deferred_stale' // M6 — pending_m6_quiz dépassé son expires_at (TACHE-088)
  | 'm9_handler_error' // M9 — exception dans le handler (logEvent IDB inaccessible) (TACHE-089)
  | 'm17_handler_error'; // M17 — exception dans le handler (logEvent ou storage) (TACHE-089)

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
 * TACHE-089 : ajout de m9_handler_error et m17_handler_error (Option B M9/M17).
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
    }
  | {
      type: 'm9_handler_error';
      /**
       * Nom de l'erreur levée dans le handler M9 (logEvent IDB).
       * R-M7-08 : uniquement le nom, jamais le message.
       */
      error_name: string;
    }
  | {
      type: 'm17_handler_error';
      /**
       * Nom de l'erreur levée dans le handler M17 (logEvent ou storage).
       * R-M7-08 : uniquement le nom, jamais le message.
       * code_path : identifie la fonction source (handleSensitiveDataDetected | handleToastAction).
       */
      error_name: string;
      code_path: 'handleSensitiveDataDetected' | 'handleToastAction';
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
