/**
 * @file shared/utils/logger.ts
 * @description Factory de logs minimisés — mitigation R-M7-08 / INV-SEC-02 étendu aux logs console.
 *
 * ## Invariant de sécurité INV-SEC-02 étendu
 *
 * INV-SEC-02 (origine : mini-DAT TACHE-061) impose que les données stockées en IndexedDB
 * ne contiennent jamais de valeurs utilisateur en clair. Cette factory étend cet invariant
 * aux sorties console du Service Worker et des content scripts.
 *
 * **Interdit dans tout argument passé à console.* :**
 * - URLs complètes (utiliser `Logger.hostnameOf(url)` qui ne conserve que le hostname)
 * - `err.message` brut (utiliser `Logger.errorName(err)` qui ne conserve que `Error.name`)
 * - `String(err)` (même motif)
 * - Valeurs utilisateur (mots de passe, tokens, contenu formulaire, PII)
 *
 * ## Format de sortie
 *
 * Chaque appel produit une ligne JSON structurée avec les champs suivants :
 * ```json
 * {
 *   "timestamp": "2026-04-17T10:00:00.000Z",
 *   "level": "info",
 *   "scope": "M7Handler",
 *   "message": "message recu",
 *   "action": "password_submitted",
 *   "tab_id": 42
 * }
 * ```
 *
 * ## Guide de migration (pattern avant/après)
 *
 * ### Avant (R-M7-08 — fuite potentielle)
 * ```typescript
 * const message = err instanceof Error ? err.message : 'Erreur inconnue';
 * console.error(`[M7Handler] Erreur traitement: ${message}`);
 * ```
 *
 * ### Après (conforme INV-SEC-02 étendu)
 * ```typescript
 * const logger = createLogger('M7Handler');
 * logger.error('Erreur traitement', { error_name: Logger.errorName(err) });
 * ```
 *
 * ### Avant (URL complète en log)
 * ```typescript
 * console.info(`Navigating to ${url}`);
 * ```
 *
 * ### Après
 * ```typescript
 * logger.info('Navigating', { hostname: Logger.hostnameOf(url) });
 * ```
 *
 * ## Référence
 * - R-M7-08 : Fuite d'information par console SW (comité revue code TACHE-069/072)
 * - INV-SEC-02 : Pas de données utilisateur en clair (mini-DAT TACHE-061)
 * - TACHE-083 : implémentation de cette factory
 */

/** Niveaux de log supportés */
export type LogLevel = 'info' | 'warn' | 'error';

/**
 * Champs autorisés dans le contexte d'un log.
 *
 * Cette interface constitue la whitelist des informations loggables.
 * Tout champ non listé ici doit être examiné avant ajout pour s'assurer
 * qu'il ne contient pas de PII ou de donnée sensible.
 *
 * Règles :
 * - `hostname` : jamais l'URL complète — utiliser `Logger.hostnameOf(url)`
 * - `tab_id` : identifiant onglet Chrome (numérique, non corrélable à un utilisateur)
 * - `error_name` : `Error.name` uniquement — jamais `err.message`
 * - `error_code` : code d'erreur structuré défini par le code métier
 * - `hint` : texte court indicatif (non PII, non user-controlled)
 * - `action` : nom d'action du message (ex: 'password_submitted')
 * - `module` : identifiant de module (ex: 'M7')
 * - `[key: string]` : tolérance pour contextes booléens/numériques (boot_count, duration_ms…)
 */
export interface LogContext {
  action?: string;
  module?: string;
  hostname?: string; // jamais URL complète
  tab_id?: number; // jamais sender.tab.url
  error_name?: string; // Error.name uniquement, jamais err.message
  error_code?: string; // code d'erreur structuré si applicable
  hint?: string; // texte court indicatif (pas PII)
  [key: string]: unknown; // tolérance pour booléens/numériques (boot_count, duration_ms…)
}

/**
 * Logger structuré pour le Service Worker et les content scripts Sentinel Nudge.
 *
 * Chaque instance est scopée à un composant (ex: 'M7Handler', 'ServiceWorker').
 * Toutes les sorties sont en JSON sur une seule ligne — compatible avec les outils
 * de parsing de logs (DevTools, cloud logging).
 *
 * @example
 * ```typescript
 * const logger = createLogger('M7Handler');
 * logger.info('message recu', { action: msg.action, tab_id: sender.tab?.id });
 * logger.error('Erreur traitement', { error_name: Logger.errorName(err) });
 * ```
 */
export class Logger {
  /**
   * @param scope - Identifiant du composant émetteur (ex: 'M7Handler', 'ServiceWorker')
   */
  constructor(private readonly scope: string) {}

  /**
   * Émet un log de niveau INFO.
   *
   * @param message - Message court décrivant l'événement (pas de PII)
   * @param context - Contexte whitelisté (voir LogContext)
   */
  info(message: string, context: LogContext = {}): void {
    this._emit('info', message, context);
  }

  /**
   * Émet un log de niveau WARN.
   *
   * @param message - Message court décrivant l'anomalie récupérable (pas de PII)
   * @param context - Contexte whitelisté (voir LogContext)
   */
  warn(message: string, context: LogContext = {}): void {
    this._emit('warn', message, context);
  }

  /**
   * Émet un log de niveau ERROR.
   *
   * @param message - Message court décrivant la panne (pas de PII)
   * @param context - Contexte whitelisté (voir LogContext)
   */
  error(message: string, context: LogContext = {}): void {
    this._emit('error', message, context);
  }

  /**
   * Helper sécurisé pour logger une URL : ne conserve que le hostname.
   *
   * Filtre l'URL complète (path, query, fragment, credentials) qui peut contenir
   * des données sensibles. Ne retourne que le hostname, inoffensif pour l'analyse.
   *
   * @param url - URL complète, partielle, undefined ou null
   * @returns hostname extrait, 'unknown' si url absente, 'invalid' si URL malformée
   *
   * @example
   * ```typescript
   * Logger.hostnameOf('https://banque.fr/login?token=xxx') // → 'banque.fr'
   * Logger.hostnameOf(undefined)                           // → 'unknown'
   * Logger.hostnameOf('not-a-url')                        // → 'invalid'
   * ```
   */
  static hostnameOf(url: string | undefined | null): string {
    if (!url) return 'unknown';
    try {
      return new URL(url).hostname;
    } catch {
      return 'invalid';
    }
  }

  /**
   * Helper sécurisé pour logger une Error : ne conserve que le name.
   *
   * `err.message` peut contenir des données utilisateur (ex: "Invalid password 'abc123'")
   * injectées par l'environnement ou des bibliothèques tierces. `err.name` est un
   * identifiant de type contrôlé par le code (TypeError, RangeError, etc.).
   *
   * @param err - Valeur catchée (Error, string, null, undefined, objet quelconque)
   * @returns `Error.name` si err est une instance d'Error, 'UnknownError' sinon
   *
   * @example
   * ```typescript
   * Logger.errorName(new TypeError('...')) // → 'TypeError'
   * Logger.errorName(null)                 // → 'UnknownError'
   * Logger.errorName('string error')       // → 'UnknownError'
   * ```
   */
  static errorName(err: unknown): string {
    if (err instanceof Error) return err.name;
    return 'UnknownError';
  }

  /**
   * Sérialise et émet l'entrée de log vers la console.
   *
   * @param level   - Niveau de log
   * @param message - Message descriptif
   * @param context - Contexte whitelisté
   */
  private _emit(level: LogLevel, message: string, context: LogContext): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      scope: this.scope,
      message,
      ...context,
    };

    switch (level) {
      case 'info':
        console.info(JSON.stringify(entry));
        break;
      case 'warn':
        console.warn(JSON.stringify(entry));
        break;
      case 'error':
        console.error(JSON.stringify(entry));
        break;
    }
  }
}

/**
 * Crée un Logger scopé à un composant.
 *
 * Factory function préférée à `new Logger()` pour permettre une éventuelle
 * évolution vers un singleton ou un système de configuration centralisée.
 *
 * @param scope - Identifiant du composant émetteur (ex: 'M7Handler', 'ServiceWorker')
 * @returns Instance Logger configurée pour ce scope
 *
 * @example
 * ```typescript
 * import { createLogger, Logger } from '@/shared/utils/logger';
 *
 * const logger = createLogger('M9Handler');
 * logger.info('logEvent ok', { module: 'M9' });
 * logger.error('logEvent failed', { error_name: Logger.errorName(err) });
 * ```
 */
export function createLogger(scope: string): Logger {
  return new Logger(scope);
}
