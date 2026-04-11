/**
 * @file background/quota-manager.ts
 * @description Gestion du quota journalier de nudges affichés.
 *
 * Le quota limite le nombre de nudges non critiques affichés par jour
 * pour éviter la fatigue d'alerte (SFD RG-QUOTA-01).
 *
 * Les modules critiques (M2 et M17) bypassen le quota :
 * - M2 : risque de sécurité domaine — alerte toujours affichée
 * - M17 : données sensibles détectées — intervention immédiate
 *
 * L'état quota est persisté dans chrome.storage.local pour survivre
 * aux redémarrages du Service Worker éphémère (RT-001).
 * Un cache mémoire de 60s évite un accès chrome.storage à chaque événement DOM.
 *
 * Référence : DAT §6.2 (flux QuotaManager), §3.1 (service worker éphémère)
 */

import { StorageService } from './storage-service';
import type { ChromeStorageSchema } from '@/shared/types/storage';
import { QUOTA_DEFAULT } from '@/shared/constants/quota';

/** Résultat d'une vérification de quota */
export interface QuotaCheckResult {
  /** true si le nudge peut être affiché */
  allowed: boolean;
  /** Nombre de nudges restants pour aujourd'hui (null si illimité) */
  remaining: number | null;
}

/** Durée du cache mémoire de l'état quota (60 secondes en ms) */
const QUOTA_CACHE_TTL_MS = 60_000;

/**
 * Gestionnaire du quota journalier de nudges.
 *
 * Instancié par le service worker à chaque réveil.
 * L'état est persisté dans chrome.storage.local après chaque modification.
 */
export class QuotaManager {
  private readonly storage: StorageService;
  private cachedState: ChromeStorageSchema['quota_state'] | null = null;
  private cacheTimestamp = 0;

  constructor(storage: StorageService) {
    this.storage = storage;
  }

  /**
   * Vérifie si un nudge peut être affiché en fonction du quota et de la criticité.
   *
   * Logique :
   * 1. Si le module est critique → toujours autorisé
   * 2. Si quota illimité (null) → toujours autorisé
   * 3. Si date différente → quota réinitialisé → autorisé
   * 4. Si count < limit → autorisé
   * 5. Sinon → refusé
   *
   * @param _module    - Identifiant du module demandant l'affichage (pour traçabilité future)
   * @param isCritical - true si le module est dans CRITICAL_MODULES (bypass quota)
   * @returns Résultat indiquant si l'affichage est autorisé et le quota restant
   */
  async checkQuota(_module: string, isCritical: boolean): Promise<QuotaCheckResult> {
    // Les modules critiques bypassen toujours le quota
    if (isCritical) {
      return { allowed: true, remaining: null };
    }

    const state = await this.getStateWithCache();
    const config = await this.storage.getConfig();
    const limit = config?.quota_limit ?? QUOTA_DEFAULT;

    // Quota illimité
    if (limit === null) {
      return { allowed: true, remaining: null };
    }

    // Vérifier si on est sur un nouveau jour (réinitialisation automatique)
    const today = new Date().toISOString().split('T')[0]!;
    if (state.date !== today) {
      // Le quota sera réinitialisé lors du prochain incrementQuota()
      return { allowed: true, remaining: limit };
    }

    const remaining = limit - state.count;
    return {
      allowed: remaining > 0,
      remaining: Math.max(0, remaining),
    };
  }

  /**
   * Incrémente le compteur de quota et persiste l'état.
   *
   * Doit être appelé après chaque nudge non critique affiché avec succès.
   * Réinitialise le compteur si la date a changé depuis la dernière incrémentation.
   */
  async incrementQuota(): Promise<void> {
    const today = new Date().toISOString().split('T')[0]!;
    const state = await this.getStateWithCache();

    const newState: ChromeStorageSchema['quota_state'] = {
      date: today,
      // Réinitialisation automatique si nouveau jour
      count: state.date === today ? state.count + 1 : 1,
    };

    await this.storage.setQuotaState(newState);
    // Mise à jour du cache
    this.cachedState = newState;
    this.cacheTimestamp = Date.now();
  }

  /**
   * Réinitialise le quota si la date a changé (nouveau jour).
   *
   * Méthode utilitaire appelée à chaque réveil du Service Worker
   * pour garantir la cohérence du quota même après une longue inactivité.
   */
  async resetIfNewDay(): Promise<void> {
    const today = new Date().toISOString().split('T')[0]!;
    const state = await this.getStateWithCache();

    if (state.date !== today) {
      const newState: ChromeStorageSchema['quota_state'] = { date: today, count: 0 };
      await this.storage.setQuotaState(newState);
      this.cachedState = newState;
      this.cacheTimestamp = Date.now();
    }
  }

  /**
   * Retourne l'état quota depuis le cache mémoire (60s TTL) ou chrome.storage.local.
   *
   * Évite un accès chrome.storage à chaque événement DOM (optimisation performance).
   * Référence : DAT §10.2 (cache quota 60s)
   *
   * @returns État quota courant
   */
  private async getStateWithCache(): Promise<ChromeStorageSchema['quota_state']> {
    const now = Date.now();
    const cacheValid =
      this.cachedState !== null && now - this.cacheTimestamp < QUOTA_CACHE_TTL_MS;

    if (cacheValid && this.cachedState) {
      return this.cachedState;
    }

    const state = await this.storage.getQuotaState();
    const today = new Date().toISOString().split('T')[0]!;

    // État par défaut si non initialisé (premier lancement)
    const resolved = state ?? { date: today, count: 0 };

    this.cachedState = resolved;
    this.cacheTimestamp = now;
    return resolved;
  }
}
