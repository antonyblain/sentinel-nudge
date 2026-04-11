/**
 * @file background/score-calculator.ts
 * @description Calcul du score de cyber-hygiène hebdomadaire (module M3).
 *
 * Le score est calculé sur 100 points, répartis en 5 composantes.
 * Ce fichier contient le squelette architectural — l'implémentation complète
 * des 5 composantes sera réalisée en P4 lors du développement du module M3.
 *
 * Les 5 composantes (à définir précisément en P4 M3) :
 * 1. Réponse aux nudges de domaine (M2)
 * 2. Quiz de sensibilisation (M6)
 * 3. Force des mots de passe (M9)
 * 4. Absence de réutilisation de mot de passe (M7)
 * 5. Réponse aux nudges presse-papiers (M17)
 *
 * Cible de performance : calcul < 200 ms (DAT §10.1)
 *
 * Référence : DAT §6.1 (ScoreCalculator), §6.2 (alarme lundi 09h)
 */

import { StorageService } from './storage-service';
import type { WeeklyScore } from '@/shared/types/storage';

/** Durée de la fenêtre de calcul en millisecondes (7 jours) */
const SCORE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Détail des 5 composantes du score M3.
 * Les noms de composantes sont des clés stables (utilisées dans l'export RGPD).
 */
export interface ScoreComponents {
  /** Score sur la réponse aux nudges de domaine M2 (max 20 pts) */
  domain_response: number;
  /** Score sur les quiz M6 (max 25 pts) */
  quiz_performance: number;
  /** Score sur la force des mots de passe M9 (max 20 pts) */
  password_strength: number;
  /** Score sur l'absence de réutilisation de mot de passe M7 (max 20 pts) */
  password_reuse: number;
  /** Score sur la réponse aux nudges presse-papiers M17 (max 15 pts) */
  clipboard_response: number;
}

/**
 * Calculateur du score hebdomadaire de cyber-hygiène.
 *
 * Instancié par le service worker lors du déclenchement de l'alarme m3_weekly.
 */
export class ScoreCalculator {
  private readonly storage: StorageService;

  constructor(storage: StorageService) {
    this.storage = storage;
  }

  /**
   * Calcule le score de cyber-hygiène pour la semaine courante.
   *
   * Lit les événements des 7 derniers jours depuis IndexedDB,
   * calcule chacune des 5 composantes, et retourne l'objet WeeklyScore.
   *
   * TODO(P4-M3) : implémenter les 5 composantes de scoring avec leur pondération exacte.
   * Entrée BACKLOG.md : BACKLOG-M3-SCORING
   *
   * @param cryptoKey - Clé AES-256-GCM pour déchiffrer les événements
   * @returns Score hebdomadaire calculé
   */
  async calculateWeeklyScore(cryptoKey: CryptoKey): Promise<WeeklyScore> {
    const weekKey = this.getCurrentWeekKey();
    const since = Date.now() - SCORE_WINDOW_MS;

    // Lecture des événements de la semaine pour chaque module pertinent
    const [m2Events, m6Events, m9Events, m7Events, m17Events] = await Promise.all([
      this.storage.getEvents('M2', since, cryptoKey),
      this.storage.getEvents('M6', since, cryptoKey),
      this.storage.getEvents('M9', since, cryptoKey),
      this.storage.getEvents('M7', since, cryptoKey),
      this.storage.getEvents('M17', since, cryptoKey),
    ]);

    // TODO(P4-M3) : algorithme de scoring complet avec pondération
    // Valeurs provisoires : score de départ à 50/100 si au moins un événement
    const hasActivity =
      m2Events.length + m6Events.length + m9Events.length + m7Events.length + m17Events.length > 0;

    const components: ScoreComponents = {
      domain_response: hasActivity ? 10 : 0,
      quiz_performance: 0,
      password_strength: 0,
      password_reuse: 0,
      clipboard_response: 0,
    };

    const totalScore = Object.values(components).reduce((acc, v) => acc + v, 0);

    // Squelette WeeklyScore — la persistance réelle sera faite par le service worker
    const score: Omit<WeeklyScore, 'value' | 'iv'> = {
      week_key: weekKey,
      total_score: totalScore,
      components,
    };

    // Persistence dans IndexedDB
    await this.storage.setWeeklyScore(score, cryptoKey);

    // Retour d'un objet partiel (value/iv seront remplis par setWeeklyScore)
    return {
      ...score,
      value: new ArrayBuffer(0),
      iv: new Uint8Array(0),
    };
  }

  /**
   * Retourne la clé ISO de la semaine courante au format YYYY-Www.
   *
   * @returns Clé de semaine ISO (ex: "2026-W15")
   */
  getCurrentWeekKey(): string {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const dayOfYear = Math.floor(
      (now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000),
    );
    const weekNumber = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
    return `${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
  }
}
