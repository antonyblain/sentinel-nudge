/**
 * @file background/services/rate-limiter.ts
 * @description Rate-limiter SW-side par (tab.id, module) avec fenêtre glissante.
 *
 * Invariant INV-UC03-05 : 10 messages / 10s par (tab.id, module).
 * Au dépassement : drop + retour d'un flag qui déclenchera un incident
 * rate_limit_exceeded severity=warn côté appelant (coalescé par CM-DOS2).
 *
 * État : Map en mémoire SW (reset au wake SW, volatile — documenté comme
 * exception ADR-001 dans le mini-DAT TACHE-070).
 *
 * Référence : mini-DAT TACHE-070 §INV-UC03-05
 */
export class RateLimiter {
  /** Map<"tabId:module", timestamps[]> — timestamps en ms des messages autorisés */
  private readonly windows = new Map<string, number[]>();

  /** Durée de la fenêtre glissante en millisecondes */
  private readonly WINDOW_MS = 10_000;

  /** Nombre maximum de messages autorisés dans la fenêtre */
  private readonly MAX_MSGS = 10;

  /**
   * Vérifie si un message est autorisé. Si oui, enregistre le timestamp.
   *
   * @param tabId  - sender.tab.id (0 si undefined)
   * @param module - Identifiant du module ('M2' | 'M7' | ...)
   * @returns true si autorisé, false si rate-limit exceeded
   */
  check(tabId: number, module: string): boolean {
    // Note : tabId=0 regroupe tous les messages sans sender.tab (fallback `?? 0`).
    // Aujourd'hui cette voie n'est PAS traversée par les alarmes internes qui
    // dispatchent via getHandler() directement sans passer par handleValidatedMessage.
    // Si un futur refactor fait transiter les alarmes par le message-router, un
    // module critique pourrait se saturer lui-même via la clé partagée `0:module`.
    // Sécurité TACHE-070 UC-03 / revue Archi sécu 2026-04-17.
    const key = `${tabId}:${module}`;
    const now = Date.now();

    // Purger les timestamps expirés de la fenêtre glissante
    const timestamps = (this.windows.get(key) ?? []).filter((t) => now - t < this.WINDOW_MS);

    if (timestamps.length >= this.MAX_MSGS) {
      // Dépassement — ne pas enregistrer (sinon retry-in-flood impossible à sortir)
      this.windows.set(key, timestamps);
      return false;
    }

    timestamps.push(now);
    this.windows.set(key, timestamps);
    return true;
  }

  /**
   * Réinitialise tous les compteurs.
   * Utilisé uniquement dans les tests unitaires.
   */
  reset(): void {
    this.windows.clear();
  }
}
