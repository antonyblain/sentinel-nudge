/**
 * @file background/services/heartbeat-service.ts
 * @description Service de gestion du heartbeat M7 (état de santé du module de détection).
 *
 * Persiste l'objet M7Diagnostics dans chrome.storage.local sous la clé 'diagnostics.m7'.
 * Met à jour cet objet à chaque boot SW et à chaque détection de réutilisation.
 *
 * Contraintes :
 * - Sérialisation JSON-strict : pas d'ArrayBuffer ni d'objet non sérialisable (leçon P-018)
 * - Valeur par défaut si absent (premier boot ou storage purgé) — INV-TC-M7-21
 * - boot_count est monotone croissant — INV-02
 * - ready=true implique canary_verified=true — INV-01
 *
 * Référence : Mini-DAT TACHE-061 §3.1, §6 (invariants INV-01/02/05)
 */

import type { M7Diagnostics } from '@/shared/types/diagnostics';
import { DIAGNOSTICS_M7_KEY, M7_DIAGNOSTICS_DEFAULT } from '@/shared/types/diagnostics';
import { browser } from '@/shared/browser/browser-adapter';

/**
 * Service de lecture/écriture du heartbeat M7 dans chrome.storage.local.
 *
 * Instancié une fois dans service-worker.ts au même niveau que CryptoService.
 * Toutes les méthodes sont async (chrome.storage.local est asynchrone).
 */
export class HeartbeatService {
  /**
   * Lit le heartbeat courant depuis chrome.storage.local.
   *
   * Retourne un heartbeat vide (ready=false, boot_count=0, etc.) si absent —
   * premier boot ou storage purgé. Ne lève jamais d'exception.
   *
   * @returns M7Diagnostics courant ou valeur par défaut
   */
  async read(): Promise<M7Diagnostics> {
    try {
      const result = await browser.storage.local.get([DIAGNOSTICS_M7_KEY]);
      const stored = result[DIAGNOSTICS_M7_KEY];

      // Validation défensive : si l'objet stocké n'est pas un objet valide, retourner le défaut
      if (!stored || typeof stored !== 'object') {
        return { ...M7_DIAGNOSTICS_DEFAULT };
      }

      const raw = stored as Record<string, unknown>;

      // Validation des champs obligatoires — reset si corrompu (sérialisation cassée)
      if (
        typeof raw['ready'] !== 'boolean' ||
        typeof raw['last_boot_ts'] !== 'number' ||
        typeof raw['boot_count'] !== 'number' ||
        typeof raw['canary_verified'] !== 'boolean'
      ) {
        return { ...M7_DIAGNOSTICS_DEFAULT };
      }

      const lastDetection = raw['last_detection_ts'];

      return {
        ready: raw['ready'],
        last_boot_ts: raw['last_boot_ts'],
        last_detection_ts:
          lastDetection === null || typeof lastDetection === 'number' ? lastDetection : null,
        boot_count: raw['boot_count'],
        canary_verified: raw['canary_verified'],
      };
    } catch {
      // Storage inaccessible (ex. profil corrompu) — retourner le défaut sans crash
      return { ...M7_DIAGNOSTICS_DEFAULT };
    }
  }

  /**
   * Persiste le heartbeat dans chrome.storage.local.
   *
   * Sérialisation JSON-strict : M7Diagnostics ne contient que des types
   * primitifs JSON-compatibles (boolean, number, null) — conforme P-018.
   *
   * @param diagnostics - Objet M7Diagnostics à persister
   * @throws Error si chrome.storage.local.set échoue
   */
  async write(diagnostics: M7Diagnostics): Promise<void> {
    await browser.storage.local.set({
      [DIAGNOSTICS_M7_KEY]: diagnostics,
    });
  }

  /**
   * Début de séquence de boot : incrémente boot_count, met last_boot_ts=Date.now(),
   * remet ready=false et canary_verified=false (état conservatif avant vérification canary).
   *
   * Appelé en tout premier dans la boot sequence du SW.
   * Persiste immédiatement pour que last_boot_ts soit à jour même si le SW est tué
   * avant la fin du boot (INV-05 : durée mesurable pour le badge dégradé TACHE-062).
   *
   * @returns Nouvel objet M7Diagnostics pour enchaînement
   */
  async onBootStart(): Promise<M7Diagnostics> {
    const current = await this.read();

    const updated: M7Diagnostics = {
      ...current,
      boot_count: current.boot_count + 1,
      last_boot_ts: Date.now(),
      ready: false,
      canary_verified: false,
    };

    await this.write(updated);
    return updated;
  }

  /**
   * Boot réussi : marque ready=true, canary_verified=true.
   * Persiste immédiatement.
   *
   * Invariant INV-01 : ready=true est toujours associé à canary_verified=true.
   * Ne modifie pas boot_count (déjà incrémenté dans onBootStart).
   */
  async onBootSuccess(): Promise<void> {
    const current = await this.read();

    const updated: M7Diagnostics = {
      ...current,
      ready: true,
      canary_verified: true,
    };

    await this.write(updated);
  }

  /**
   * Échec de boot : marque ready=false.
   * Ne modifie pas boot_count ni last_boot_ts (déjà mis à jour dans onBootStart).
   * Persiste immédiatement.
   *
   * Garantit que le badge dégradé (TACHE-062) sera affiché si l'échec dure > 1h
   * grâce à last_boot_ts déjà positionné.
   */
  async onBootFailure(): Promise<void> {
    const current = await this.read();

    const updated: M7Diagnostics = {
      ...current,
      ready: false,
      canary_verified: false,
    };

    await this.write(updated);
  }

  /**
   * Détection de réutilisation confirmée : met à jour last_detection_ts=Date.now().
   * Persiste immédiatement.
   *
   * Appelé depuis m7-handler.ts après chaque détection confirmée (réutilisation inter-domaine).
   */
  async onDetection(): Promise<void> {
    const current = await this.read();

    const updated: M7Diagnostics = {
      ...current,
      last_detection_ts: Date.now(),
    };

    await this.write(updated);
  }

  /**
   * Positionne ready à la valeur donnée sans modifier les autres champs.
   * Méthode utilitaire pour les cas où ready doit être modifié indépendamment
   * de la séquence normale (onBootStart → onBootSuccess/onBootFailure).
   *
   * @param value - Nouvelle valeur de ready
   */
  async setReady(value: boolean): Promise<void> {
    const current = await this.read();

    const updated: M7Diagnostics = {
      ...current,
      ready: value,
      // Invariant INV-01 : si ready devient false, canary_verified doit aussi être false
      canary_verified: value ? current.canary_verified : false,
    };

    await this.write(updated);
  }
}
