/**
 * @file background/message-router.ts
 * @description Routeur centralisé des messages entrants dans le Service Worker.
 *
 * Reçoit tous les messages via chrome.runtime.onMessage, les valide via MessageValidator,
 * vérifie le quota, et dispatche vers le handler du module approprié.
 *
 * Sécurité :
 * - Tout message non conforme à NudgeMessage est rejeté silencieusement (NC-SEC-01)
 * - Aucune réponse envoyée aux messages invalides (évite la fuite d'info sur la surface d'attaque)
 * - La validation inclut le module contre la liste blanche MODULE_IDS
 *
 * Référence : DAT §3.3 (MessageRouter, usage dans service-worker.ts), §6.1 (diagramme composants)
 */

import { browser } from '@/shared/browser/browser-adapter';
import { validateNudgeMessage } from '@/shared/utils/message-validator';
import { CRITICAL_MODULES } from '@/shared/constants/modules';
import { QuotaManager } from './quota-manager';
import type { NudgeMessage, NudgeResponse } from '@/shared/types/messages';
import type { ModuleId } from '@/shared/types/modules';

/** Signature d'un handler de module */
export type ModuleHandler = (
  msg: NudgeMessage,
  sender: chrome.runtime.MessageSender,
) => Promise<NudgeResponse>;

/**
 * Routeur de messages du Service Worker.
 *
 * Enregistre les handlers par module et dispatche les messages validés.
 * Chaque module enregistre son handler via registerHandler() au démarrage du SW.
 */
export class MessageRouter {
  private readonly quotaManager: QuotaManager;
  private readonly handlers: Map<string, ModuleHandler> = new Map();

  constructor(quotaManager: QuotaManager) {
    this.quotaManager = quotaManager;
  }

  /**
   * Enregistre le handler d'un module.
   *
   * @param moduleId - Identifiant du module
   * @param handler  - Fonction asynchrone traitant les messages du module
   */
  registerHandler(moduleId: ModuleId | string, handler: ModuleHandler): void {
    this.handlers.set(moduleId, handler);
  }

  /**
   * Initialise le listener chrome.runtime.onMessage.
   *
   * Doit être appelé une seule fois au démarrage du Service Worker.
   * Le listener reste actif tant que le SW est éveillé.
   */
  listen(): void {
    browser.runtime.onMessage.addListener(
      (msg: unknown, sender: unknown, sendResponse: (r: unknown) => void) => {
        // Rejet silencieux des messages non conformes (NC-SEC-01)
        if (!validateNudgeMessage(msg)) {
          return false; // false = pas de réponse asynchrone
        }

        // Dispatch asynchrone vers le handler du module
        void this.handleValidatedMessage(msg, sender as chrome.runtime.MessageSender, sendResponse);

        return true; // Indique à Chrome qu'on répondra de manière asynchrone
      },
    );
  }

  /**
   * Traite un message validé : vérifie le quota puis dispatche au handler du module.
   *
   * L'incrément du quota (M-002) est effectué APRÈS la réponse du handler,
   * et uniquement si le handler répond avec action === 'show'. Cela évite d'incrémenter
   * le quota pour des messages qui n'aboutissent pas à l'affichage d'un nudge.
   *
   * @param msg          - Message validé NudgeMessage
   * @param sender       - Contexte d'émission (tabId, frameId)
   * @param sendResponse - Callback Chrome pour envoyer la réponse
   */
  private async handleValidatedMessage(
    msg: NudgeMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (r: unknown) => void,
  ): Promise<void> {
    const isCritical = (CRITICAL_MODULES as readonly string[]).includes(msg.module);

    // Vérification du quota (modules critiques bypassen)
    const quotaResult = await this.quotaManager.checkQuota(msg.module, isCritical);

    if (!quotaResult.allowed) {
      const response: NudgeResponse = {
        success: true,
        action: 'skip',
        reason: 'quota_exceeded',
        data: { remaining: quotaResult.remaining ?? 0 },
      };
      sendResponse(response);
      return;
    }

    // Dispatch vers le handler du module
    const handler = this.handlers.get(msg.module);
    if (!handler) {
      // Module sans handler enregistré — skip silencieux
      const response: NudgeResponse = {
        success: false,
        action: 'skip',
        reason: 'handler_not_registered',
      };
      sendResponse(response);
      return;
    }

    try {
      const response = await handler(msg, sender);
      sendResponse(response);

      // M-002 : incrémenter le quota APRÈS la réponse du handler,
      // uniquement si le nudge est effectivement affiché (action === 'show')
      // et que le module n'est pas critique (critiques bypassen le quota)
      if (!isCritical && response.action === 'show') {
        await this.quotaManager.incrementQuota();
      }
    } catch (err: unknown) {
      // Erreur technique — ne jamais exposer les détails à l'émetteur
      const response: NudgeResponse = {
        success: false,
        action: 'error',
        reason: 'internal_error',
      };
      sendResponse(response);
      // L'erreur est loguée côté service worker (pas ici pour ne pas polluer)
      throw err; // Re-throw pour que service-worker.ts puisse loguer
    }
  }

  /**
   * Envoie un message vers un content script dans un onglet spécifique.
   * Utilisé par les handlers de modules pour déclencher l'affichage des nudges.
   *
   * @param tabId   - Identifiant de l'onglet cible
   * @param message - Message à envoyer au content script UI
   * @returns Réponse du content script (optionnelle)
   */
  /**
   * Retourne le handler enregistré pour un module donné.
   * Utilisé par le service worker pour appeler directement un handler (alarmes internes).
   *
   * @param moduleId - Identifiant du module
   * @returns Handler ou undefined si non enregistré
   */
  getHandler(moduleId: ModuleId): ModuleHandler | undefined {
    return this.handlers.get(moduleId);
  }

  async sendToTab(tabId: number, message: NudgeMessage): Promise<NudgeResponse | null> {
    try {
      const response = await browser.tabs.sendMessage(tabId, message);
      return response as NudgeResponse;
    } catch {
      // L'onglet peut être fermé ou le content script non injecté — échec silencieux
      return null;
    }
  }
}
