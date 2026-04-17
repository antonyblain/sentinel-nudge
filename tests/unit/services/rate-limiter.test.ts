/**
 * @file tests/unit/services/rate-limiter.test.ts
 * @description Tests unitaires du RateLimiter (INV-UC03-05).
 *
 * Verifie :
 * - TC-UC03-RL-01 : 10 messages dans 10s -> tous autorises
 * - TC-UC03-RL-02 : 11e message dans 10s -> check() retourne false
 * - TC-UC03-RL-03 : apres 10s, la fenetre se libere -> nouveaux messages autorises
 * - TC-UC03-RL-04 : isolation par (tab.id, module) — tab 1 sature n'impacte pas tab 2
 *
 * Reference : mini-DAT TACHE-070 §INV-UC03-05
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from '@/background/services/rate-limiter';

describe('RateLimiter — INV-UC03-05', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // TC-UC03-RL-01 : 10 messages dans 10s → tous autorisés
  // --------------------------------------------------------------------------
  it('TC-UC03-RL-01 : 10 messages dans 10s autorises', () => {
    const tabId = 1;
    const module = 'M7';

    for (let i = 0; i < 10; i++) {
      // Avance de 100ms entre chaque message (total 900ms < 10s)
      vi.advanceTimersByTime(100);
      expect(rateLimiter.check(tabId, module)).toBe(true);
    }
  });

  // --------------------------------------------------------------------------
  // TC-UC03-RL-02 : 11e message dans 10s → check() retourne false
  // --------------------------------------------------------------------------
  it('TC-UC03-RL-02 : 11e message dans 10s retourne false', () => {
    const tabId = 1;
    const module = 'M7';

    // 10 messages autorisés à t=0
    for (let i = 0; i < 10; i++) {
      expect(rateLimiter.check(tabId, module)).toBe(true);
    }

    // 11e message au même instant → refusé
    expect(rateLimiter.check(tabId, module)).toBe(false);
  });

  // --------------------------------------------------------------------------
  // TC-UC03-RL-03 : après 10s, la fenêtre se libère → nouveaux messages autorisés
  // --------------------------------------------------------------------------
  it('TC-UC03-RL-03 : apres 10s la fenetre glissante se libere', () => {
    const tabId = 1;
    const module = 'M7';

    // Saturer la fenêtre
    for (let i = 0; i < 10; i++) {
      expect(rateLimiter.check(tabId, module)).toBe(true);
    }
    // 11e est refusé
    expect(rateLimiter.check(tabId, module)).toBe(false);

    // Avancer de 10s + 1ms pour expirer tous les timestamps
    vi.advanceTimersByTime(10_001);

    // La fenêtre est maintenant vide → un nouveau message est autorisé
    expect(rateLimiter.check(tabId, module)).toBe(true);
  });

  // --------------------------------------------------------------------------
  // TC-UC03-RL-04 : isolation par (tab.id, module) — tab 1 saturé n'affecte pas tab 2
  // --------------------------------------------------------------------------
  it('TC-UC03-RL-04 : saturation tab1 nimpacte pas tab2', () => {
    const module = 'M7';

    // Saturer tab 1
    for (let i = 0; i < 10; i++) {
      rateLimiter.check(1, module);
    }
    // 11e refusé pour tab 1
    expect(rateLimiter.check(1, module)).toBe(false);

    // tab 2 est indépendant → autorisé
    expect(rateLimiter.check(2, module)).toBe(true);
  });

  // --------------------------------------------------------------------------
  // TC-UC03-RL-05 : isolation par module — M7 saturé n'affecte pas M17
  // --------------------------------------------------------------------------
  it('TC-UC03-RL-05 : saturation M7 nimpacte pas M17 pour le meme tab', () => {
    const tabId = 1;

    // Saturer M7 pour tab 1
    for (let i = 0; i < 10; i++) {
      rateLimiter.check(tabId, 'M7');
    }
    expect(rateLimiter.check(tabId, 'M7')).toBe(false);

    // M17 pour le même tab → indépendant, autorisé
    expect(rateLimiter.check(tabId, 'M17')).toBe(true);
  });

  // --------------------------------------------------------------------------
  // TC-UC03-RL-06 : reset() vide tous les compteurs
  // --------------------------------------------------------------------------
  it('TC-UC03-RL-06 : reset vide tous les compteurs', () => {
    for (let i = 0; i < 10; i++) {
      rateLimiter.check(1, 'M7');
    }
    expect(rateLimiter.check(1, 'M7')).toBe(false);

    rateLimiter.reset();

    // Après reset, le compteur repart de zéro
    expect(rateLimiter.check(1, 'M7')).toBe(true);
  });
});
