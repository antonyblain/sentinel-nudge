/**
 * @file browser-adapter.ts
 * @description Couche d'abstraction navigateur pour Sentinel Nudge.
 *
 * Toute la codebase importe depuis ce module plutôt que d'appeler chrome.* directement.
 * L'implémentation v1 est 100% Chrome. La migration Firefox/Edge se fera en modifiant
 * uniquement ce fichier (ADR-008).
 *
 * Pourquoi ne pas utiliser webextension-polyfill (Mozilla) ?
 * Choix délibéré pour maîtriser les dépendances et éviter un intermédiaire dont
 * la maintenance dépend d'un tiers — cf. DAT ADR-008.
 *
 * Référence : DAT §7 — Couche d'abstraction navigateur
 */

/**
 * Interface unifiée de l'API navigateur utilisée par Sentinel Nudge.
 * En v1, tous les appels passent par l'API Chrome native.
 * En v2+, un adaptateur Firefox pourra implémenter cette interface
 * en wrappant l'API browser.* avec ses Promises.
 */
export interface BrowserAdapter {
  storage: {
    local: {
      /**
       * Lit des valeurs depuis chrome.storage.local.
       * @param keys - Tableau des clés à lire
       * @returns Dictionnaire clé → valeur (les clés absentes ne sont pas incluses)
       */
      get(keys: string[]): Promise<Record<string, unknown>>;
      /**
       * Écrit des valeurs dans chrome.storage.local.
       * @param items - Dictionnaire clé → valeur à persister
       */
      set(items: Record<string, unknown>): Promise<void>;
      /**
       * Supprime des clés de chrome.storage.local.
       * @param keys - Clés à supprimer
       */
      remove(keys: string[]): Promise<void>;
      /**
       * Efface toutes les données de chrome.storage.local.
       * Utilisé par la fonctionnalité de réinitialisation complète (options.ts).
       */
      clear(): Promise<void>;
    };
    /**
     * Listener pour les changements de chrome.storage.local.
     * Utilise pour le pattern pending_toast (M7) : notifie les content scripts
     * quand le SW depose une action a executer.
     */
    onChanged: {
      addListener(
        callback: (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>) => void,
      ): void;
    };
  };

  runtime: {
    /**
     * Envoie un message au service worker ou aux autres contextes de l'extension.
     * @param message - Payload du message (doit implémenter NudgeMessage)
     * @returns Réponse du récepteur
     */
    sendMessage(message: unknown): Promise<unknown>;
    onMessage: {
      /**
       * Enregistre un listener pour les messages entrants.
       * @param callback - Fonction appelée à chaque message reçu
       */
      addListener(
        callback: (msg: unknown, sender: unknown, respond: (r: unknown) => void) => void,
      ): void;
    };
    /**
     * Vérifie si une mise à jour de l'extension est disponible (module M5).
     * Utilise chrome.runtime.requestUpdateCheck — API native Chrome, pas de requête réseau externe.
     */
    requestUpdateCheck(): Promise<{ status: string }>;
    /** Identifiant unique de l'extension */
    id: string;
    /**
     * Retourne l'URL complète d'une ressource packagée dans l'extension.
     * @param path - Chemin relatif depuis la racine de l'extension
     * @returns URL chrome-extension://... de la ressource
     */
    getURL(path: string): string;
    /**
     * Retourne le manifest.json de l'extension sous forme d'objet.
     * @returns Objet manifest (version, name, permissions, etc.)
     */
    getManifest(): object;
  };

  tabs: {
    /**
     * Envoie un message à un content script dans un onglet spécifique.
     * @param tabId   - Identifiant de l'onglet cible
     * @param message - Payload du message
     */
    sendMessage(tabId: number, message: unknown): Promise<unknown>;
    /**
     * Requête sur les onglets ouverts.
     * @param queryInfo - Critères de filtrage
     * @returns Liste des onglets correspondants
     */
    query(queryInfo: object): Promise<chrome.tabs.Tab[]>;
    /**
     * Ouvre un nouvel onglet avec les propriétés données.
     * @param createProperties - Paramètres du nouvel onglet (url, active, etc.)
     */
    create(createProperties: chrome.tabs.CreateProperties): Promise<void>;
  };

  scripting: {
    /**
     * Injecte dynamiquement des scripts dans un onglet (injection conditionnelle par module).
     * @param injection - Paramètres d'injection
     */
    executeScript(
      injection: chrome.scripting.ScriptInjection,
    ): Promise<chrome.scripting.InjectionResult[]>;
  };

  alarms: {
    /**
     * Crée une alarme Chrome.
     * @param name      - Nom unique de l'alarme (ex: 'm3_weekly', 'm5_update_check', 'purge_daily')
     * @param alarmInfo - Paramètres de déclenchement
     */
    create(name: string, alarmInfo: chrome.alarms.AlarmCreateInfo): void;
    /**
     * Supprime une alarme existante.
     * @param name - Nom de l'alarme à supprimer
     */
    clear(name: string): Promise<boolean>;
    onAlarm: {
      /**
       * Enregistre un listener sur les déclenchements d'alarme.
       * @param callback - Fonction appelée à chaque alarme
       */
      addListener(callback: (alarm: chrome.alarms.Alarm) => void): void;
    };
  };

  i18n: {
    /**
     * Retourne la chaîne localisée pour la clé donnée.
     * @param messageName   - Clé de la chaîne dans _locales/messages.json
     * @param substitutions - Valeurs de substitution ($1, $2, ...)
     */
    getMessage(messageName: string, substitutions?: string | string[]): string;
  };
}

/**
 * Implémentation v1 Chrome de BrowserAdapter.
 *
 * Chaque méthode wrappant une API chrome.* callback est convertie en Promise
 * pour une utilisation uniforme en async/await dans toute la codebase.
 *
 * Note sur scripting.executeScript : l'API Chrome retourne déjà une Promise en MV3.
 */
export const browser: BrowserAdapter = {
  storage: {
    local: {
      get: (keys: string[]): Promise<Record<string, unknown>> =>
        new Promise((resolve) => chrome.storage.local.get(keys, resolve)),
      set: (items: Record<string, unknown>): Promise<void> =>
        new Promise((resolve) => chrome.storage.local.set(items, resolve)),
      remove: (keys: string[]): Promise<void> =>
        new Promise((resolve) => chrome.storage.local.remove(keys, resolve)),
      clear: (): Promise<void> => new Promise((resolve) => chrome.storage.local.clear(resolve)),
    },
    onChanged: {
      addListener: (
        callback: (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>) => void,
      ): void => {
        // chrome.storage.onChanged emet pour TOUS les areas (local, sync, session).
        // On filtre uniquement 'local' pour respecter la semantique de l'adapter.
        chrome.storage.onChanged.addListener((changes, areaName) => {
          if (areaName !== 'local') return;
          callback(changes);
        });
      },
    },
  },

  runtime: {
    sendMessage: (message: unknown): Promise<unknown> =>
      new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      }),
    onMessage: {
      addListener: (
        callback: (msg: unknown, sender: unknown, respond: (r: unknown) => void) => void,
      ): void => {
        chrome.runtime.onMessage.addListener(callback);
      },
    },
    requestUpdateCheck: (): Promise<{ status: string }> =>
      new Promise((resolve) => {
        chrome.runtime.requestUpdateCheck((status: chrome.runtime.RequestUpdateCheckStatus) => {
          resolve({ status });
        });
      }),
    get id(): string {
      return chrome.runtime.id;
    },
    getURL: (path: string): string => chrome.runtime.getURL(path),
    getManifest: (): object => chrome.runtime.getManifest(),
  },

  // Note : chrome.tabs, chrome.scripting et chrome.alarms ne sont PAS disponibles
  // dans les content scripts. Les accès sont défensifs (optional chaining) pour
  // éviter les crashes quand le browser-adapter est bundlé dans un content script.

  tabs: {
    sendMessage: (tabId: number, message: unknown): Promise<unknown> =>
      new Promise((resolve, reject) => {
        chrome.tabs?.sendMessage(tabId, message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      }),
    query: (queryInfo: object): Promise<chrome.tabs.Tab[]> =>
      new Promise((resolve) => chrome.tabs?.query(queryInfo, resolve) ?? resolve([])),
    create: (createProperties: chrome.tabs.CreateProperties): Promise<void> =>
      chrome.tabs?.create(createProperties).then(() => undefined) ?? Promise.resolve(),
  },

  scripting: {
    executeScript: (
      injection: chrome.scripting.ScriptInjection,
    ): Promise<chrome.scripting.InjectionResult[]> =>
      chrome.scripting?.executeScript(injection) ?? Promise.resolve([]),
  },

  alarms: {
    create: (name: string, alarmInfo: chrome.alarms.AlarmCreateInfo): void => {
      chrome.alarms?.create(name, alarmInfo);
    },
    clear: (name: string): Promise<boolean> =>
      new Promise((resolve) => chrome.alarms?.clear(name, resolve) ?? resolve(false)),
    onAlarm: {
      addListener: (callback: (alarm: chrome.alarms.Alarm) => void): void => {
        chrome.alarms?.onAlarm.addListener(callback);
      },
    },
  },

  i18n: {
    getMessage: (messageName: string, substitutions?: string | string[]): string =>
      chrome.i18n.getMessage(messageName, substitutions),
  },
};
