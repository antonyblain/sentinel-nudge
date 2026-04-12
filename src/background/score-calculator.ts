/**
 * @file background/score-calculator.ts
 * @description Calcul du score de cyber-hygiène hebdomadaire (module M3).
 *
 * Le score est calculé sur 100 points, répartis en 5 composantes :
 *
 * | Composante             | Module source | Poids standard |
 * |------------------------|---------------|----------------|
 * | MAJ navigateur         | M5            | 20 pts         |
 * | Résistance phishing    | M6            | 25 pts         |
 * | Comportement sites     | M2            | 20 pts         |
 * | Diversité mots de passe| M7            | 20 pts         |
 * | Force mots de passe    | M9            | 15 pts         |
 *
 * Si un module est désactivé, ses points sont redistribués proportionnellement
 * aux autres modules actifs (SFD §2.2.3).
 *
 * L'action recommandée est sélectionnée sur la composante avec l'écart relatif
 * au maximum >= 50% (SFD §2.2.3 — algorithme de sélection).
 *
 * Performance cible : calcul < 200 ms (DAT §10.1).
 *
 * Référence : SFD §2.2 (M3), DAT §6.1 (ScoreCalculator), §6.2 (alarme lundi 09h)
 */

import { StorageService } from './storage-service';
import { browser } from '@/shared/browser/browser-adapter';
import { M5_UP_TO_DATE_KEY } from './handlers/m5-handler';
import type { WeeklyScore } from '@/shared/types/storage';
import type { EventPayload } from '@/shared/types/storage';

/** Durée de la fenêtre de calcul en millisecondes (7 jours) */
const SCORE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Seuil d'écart relatif pour déclencher une recommandation (50%) */
const RECOMMENDATION_THRESHOLD = 0.5;

/**
 * Poids standard de chaque composante (total = 100).
 * Les clés correspondent aux identifiants de module source.
 */
export const COMPONENT_WEIGHTS: Record<string, number> = {
  m5_update: 20,
  m6_phishing: 25,
  m2_risky_sites: 20,
  m7_password_diversity: 20,
  m9_password_strength: 15,
};

/**
 * Détail des 5 composantes du score M3.
 * Les noms de composantes sont des clés stables (utilisées dans l'export RGPD).
 */
export interface ScoreComponents {
  /** Score sur la MAJ navigateur (M5) — max variable après redistribution */
  m5_update: number;
  /** Score sur les quiz de phishing (M6) — max variable après redistribution */
  m6_phishing: number;
  /** Score sur le comportement sur sites risqués (M2) — max variable */
  m2_risky_sites: number;
  /** Score sur la diversité des mots de passe (M7) — max variable */
  m7_password_diversity: number;
  /** Score sur la force des mots de passe (M9) — max variable */
  m9_password_strength: number;
}

/**
 * Actions correctives par composante (SFD §2.2.3).
 */
const CORRECTIVE_ACTIONS: Record<keyof ScoreComponents, string> = {
  m5_update: 'Mettez à jour votre navigateur pour corriger les failles de sécurité',
  m6_phishing: 'Un quiz phishing est disponible — testez votre vigilance',
  m2_risky_sites: 'Soyez attentif aux alertes sur les sites suspects',
  m7_password_diversity: 'Diversifiez vos mots de passe avec un gestionnaire',
  m9_password_strength: 'Renforcez vos mots de passe lors de vos prochaines inscriptions',
};

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
   * calcule chacune des 5 composantes avec redistribution des modules désactivés,
   * sélectionne l'action recommandée, et persiste le résultat.
   *
   * @param cryptoKey          - Clé AES-256-GCM pour déchiffrer les événements
   * @param enabledModules     - Ensemble des modules actifs (issu de la config)
   * @returns Score hebdomadaire calculé
   */
  async calculateWeeklyScore(
    cryptoKey: CryptoKey,
    enabledModules?: Partial<Record<string, boolean>>,
  ): Promise<WeeklyScore> {
    const weekKey = this.getCurrentWeekKey();
    const since = Date.now() - SCORE_WINDOW_MS;

    // Lecture parallèle des événements de la semaine pour chaque module
    const [m2Events, m6Events, m9Events, m7Events, m5UpToDate] = await Promise.all([
      this.storage.getEvents('M2', since, cryptoKey).catch(() => [] as EventPayload[]),
      this.storage.getEvents('M6', since, cryptoKey).catch(() => [] as EventPayload[]),
      this.storage.getEvents('M9', since, cryptoKey).catch(() => [] as EventPayload[]),
      this.storage.getEvents('M7', since, cryptoKey).catch(() => [] as EventPayload[]),
      this.getM5UpToDateState(),
    ]);

    // Calcul des scores bruts de chaque composante sur leurs poids standard
    const rawComponents: ScoreComponents = {
      m5_update: this.calculateM5Component(m5UpToDate),
      m6_phishing: this.calculateM6Component(m6Events),
      m2_risky_sites: this.calculateM2Component(m2Events),
      m7_password_diversity: this.calculateM7Component(m7Events),
      m9_password_strength: this.calculateM9Component(m9Events),
    };

    // Redistribution des poids si des modules sont désactivés (SFD §2.2.3)
    const { components, maxWeights } = this.redistributeWeights(
      rawComponents,
      enabledModules,
    );

    // Score total = somme des composantes redistribuées
    const totalScore = Math.round(
      Object.values(components).reduce((acc, v) => acc + v, 0),
    );

    // Score de la semaine précédente pour calculer le delta
    const previousScore = await this.getPreviousScore(weekKey, cryptoKey);
    const delta = previousScore !== null ? totalScore - previousScore : 0;
    const isFirstWeek = previousScore === null;

    // Sélection de l'action recommandée (composante avec écart relatif >= 50%)
    const actionRecommandee = this.selectRecommendedAction(components, maxWeights, isFirstWeek);

    // Objet score complet
    const scoreData: Omit<WeeklyScore, 'value' | 'iv'> = {
      week_key: weekKey,
      total_score: Math.min(100, Math.max(0, totalScore)),
      components: components as unknown as Record<string, number>,
    };

    // Persistance dans IndexedDB (chiffré)
    await this.storage.setWeeklyScore(
      {
        ...scoreData,
        components: {
          ...components,
          delta,
          action_recommandee: actionRecommandee,
          is_first_week: isFirstWeek,
        } as unknown as Record<string, number>,
      },
      cryptoKey,
    );

    // Retour de l'objet score (value/iv seront remplis par setWeeklyScore)
    return {
      ...scoreData,
      value: new ArrayBuffer(0),
      iv: new Uint8Array(0),
    };
  }

  /**
   * Calcule la composante M5 — Mise à jour navigateur (0 ou 20 pts).
   *
   * SFD §2.2.3 : 20 si à jour, 0 sinon.
   *
   * @param isUpToDate - État de mise à jour lu depuis chrome.storage.local
   * @returns Score de la composante (0 ou 20)
   */
  calculateM5Component(isUpToDate: boolean): number {
    return isUpToDate ? COMPONENT_WEIGHTS['m5_update']! : 0;
  }

  /**
   * Calcule la composante M6 — Résistance phishing.
   *
   * SFD §2.2.3 : (somme(bonnes réponses) / somme(total)) × 25.
   * Si aucun quiz cette semaine : reprendre le dernier score_pct connu.
   * Si jamais de quiz : 0.
   *
   * @param m6Events - Événements M6 de la semaine
   * @returns Score de la composante (0 à 25)
   */
  calculateM6Component(m6Events: EventPayload[]): number {
    const quizEvents = m6Events.filter(
      (e) => e.action === 'quiz_completed' && typeof e.module_data?.['score_pct'] === 'number',
    );

    if (quizEvents.length === 0) {
      // Pas de quiz cette semaine — reprendre le dernier score_pct connu si disponible
      const lastScorePct = m6Events.find(
        (e) => typeof e.module_data?.['last_known_score_pct'] === 'number',
      );
      if (lastScorePct) {
        const pct = lastScorePct.module_data!['last_known_score_pct'] as number;
        return Math.round((pct / 100) * COMPONENT_WEIGHTS['m6_phishing']!);
      }
      return 0;
    }

    // Calculer la moyenne des score_pct de la semaine
    const totalPct = quizEvents.reduce((acc, e) => {
      return acc + (e.module_data!['score_pct'] as number);
    }, 0);
    const avgPct = totalPct / quizEvents.length;

    return Math.round((avgPct / 100) * COMPONENT_WEIGHTS['m6_phishing']!);
  }

  /**
   * Calcule la composante M2 — Comportement sites risqués.
   *
   * SFD §2.2.3 : 20 − (4 × nombre de dismissed), plancher 0.
   * Les actions 'silent' comptent aussi comme dismissed (SFD §2.1.5).
   *
   * @param m2Events - Événements M2 de la semaine
   * @returns Score de la composante (0 à 20)
   */
  calculateM2Component(m2Events: EventPayload[]): number {
    const dismissedCount = m2Events.filter(
      (e) => e.action === 'dismissed' || e.action === 'silent',
    ).length;

    return Math.max(0, COMPONENT_WEIGHTS['m2_risky_sites']! - 4 * dismissedCount);
  }

  /**
   * Calcule la composante M7 — Diversité mots de passe.
   *
   * SFD §2.2.3 : 20 − (4 × nombre de réutilisations détectées), plancher 0.
   *
   * @param m7Events - Événements M7 de la semaine (nudges affichés = réutilisations)
   * @returns Score de la composante (0 à 20)
   */
  calculateM7Component(m7Events: EventPayload[]): number {
    const reuseCount = m7Events.filter(
      (e) => e.action === 'shown' || e.action === 'silent',
    ).length;

    return Math.max(0, COMPONENT_WEIGHTS['m7_password_diversity']! - 4 * reuseCount);
  }

  /**
   * Calcule la composante M9 — Force des mots de passe.
   *
   * SFD §2.2.3 :
   * - Si 0 créations de mot de passe : 15/15 (indicateur 0/0)
   * - Sinon : (nombre de mots de passe forts (score >= 4) / total créations) × 15
   *
   * @param m9Events - Événements M9 de la semaine
   * @returns Score de la composante (0 à 15)
   */
  calculateM9Component(m9Events: EventPayload[]): number {
    // Filtrer les évaluations de création (action 'evaluated' avec score)
    const evaluations = m9Events.filter(
      (e) => e.action === 'evaluated' && typeof e.module_data?.['score'] === 'number',
    );

    if (evaluations.length === 0) {
      // Indicateur 0/0 → plein score (SFD §2.2.3)
      return COMPONENT_WEIGHTS['m9_password_strength']!;
    }

    const strongCount = evaluations.filter(
      (e) => (e.module_data!['score'] as number) >= 4,
    ).length;

    return Math.round((strongCount / evaluations.length) * COMPONENT_WEIGHTS['m9_password_strength']!);
  }

  /**
   * Redistribue les poids des modules désactivés proportionnellement aux modules actifs.
   *
   * SFD §2.2.3 :
   * Si module M désactivé :
   *   poids_redistribué = poids_M × (poids_module_actif / somme_poids_actifs)
   *
   * @param rawComponents   - Scores bruts calculés sur poids standards
   * @param enabledModules  - Carte des modules actifs (true = actif)
   * @returns Composantes et poids max redistribués
   */
  redistributeWeights(
    rawComponents: ScoreComponents,
    enabledModules?: Partial<Record<string, boolean>>,
  ): { components: ScoreComponents; maxWeights: Record<keyof ScoreComponents, number> } {
    // Correspondance entre clé composante et identifiant module
    const componentToModule: Record<keyof ScoreComponents, string> = {
      m5_update: 'M5',
      m6_phishing: 'M6',
      m2_risky_sites: 'M2',
      m7_password_diversity: 'M7',
      m9_password_strength: 'M9',
    };

    // Si pas de config modules, tout est actif
    if (!enabledModules) {
      return {
        components: rawComponents,
        maxWeights: { ...COMPONENT_WEIGHTS } as Record<keyof ScoreComponents, number>,
      };
    }

    // Identifier les modules actifs et désactivés
    const activeKeys = (Object.keys(rawComponents) as Array<keyof ScoreComponents>).filter(
      (key) => enabledModules[componentToModule[key]!] !== false,
    );

    const disabledKeys = (Object.keys(rawComponents) as Array<keyof ScoreComponents>).filter(
      (key) => enabledModules[componentToModule[key]!] === false,
    );

    // Cas extrême : tous les modules désactivés sauf M3 lui-même
    if (activeKeys.length === 0) {
      const zeroComponents: ScoreComponents = {
        m5_update: 0,
        m6_phishing: 0,
        m2_risky_sites: 0,
        m7_password_diversity: 0,
        m9_password_strength: 0,
      };
      const zeroWeights = { ...zeroComponents } as Record<keyof ScoreComponents, number>;
      return { components: zeroComponents, maxWeights: zeroWeights };
    }

    // Calculer la somme des poids désactivés à redistribuer
    const disabledWeightSum = disabledKeys.reduce(
      (acc, key) => acc + COMPONENT_WEIGHTS[key]!,
      0,
    );

    // Calculer la somme des poids actifs (base de redistribution)
    const activeWeightSum = activeKeys.reduce(
      (acc, key) => acc + COMPONENT_WEIGHTS[key]!,
      0,
    );

    // Calculer les nouveaux poids max pour chaque module actif
    const maxWeights: Record<keyof ScoreComponents, number> = {
      m5_update: 0,
      m6_phishing: 0,
      m2_risky_sites: 0,
      m7_password_diversity: 0,
      m9_password_strength: 0,
    };

    activeKeys.forEach((key) => {
      const baseWeight = COMPONENT_WEIGHTS[key]!;
      const redistribution = activeWeightSum > 0
        ? disabledWeightSum * (baseWeight / activeWeightSum)
        : 0;
      maxWeights[key] = baseWeight + redistribution;
    });

    // Recalculer les scores en appliquant les nouveaux poids max
    const redistributed: ScoreComponents = {
      m5_update: 0,
      m6_phishing: 0,
      m2_risky_sites: 0,
      m7_password_diversity: 0,
      m9_password_strength: 0,
    };

    activeKeys.forEach((key) => {
      const standardWeight = COMPONENT_WEIGHTS[key]!;
      const newWeight = maxWeights[key]!;
      // Ratio de performance brute sur poids standard, appliqué au nouveau poids max
      const ratio = standardWeight > 0 ? rawComponents[key] / standardWeight : 0;
      redistributed[key] = Math.round(ratio * newWeight * 100) / 100;
    });

    return { components: redistributed, maxWeights };
  }

  /**
   * Sélectionne l'action recommandée sur la composante avec le plus grand écart relatif.
   *
   * SFD §2.2.3 :
   *   ecart_relatif = (poids_max - score_composante) / poids_max
   *   Si ecart_relatif >= 0.5 → action corrective
   *   Sinon → "Continuez ainsi !"
   *
   * @param components    - Scores redistribués
   * @param maxWeights    - Poids max redistribués
   * @param isFirstWeek   - true si c'est la première semaine
   * @returns Message d'action recommandée
   */
  selectRecommendedAction(
    components: ScoreComponents,
    maxWeights: Record<keyof ScoreComponents, number>,
    isFirstWeek = false,
  ): string {
    if (isFirstWeek) {
      return 'Votre premier score !';
    }

    let maxEcart = 0;
    let worstComponent: keyof ScoreComponents | null = null;

    (Object.keys(components) as Array<keyof ScoreComponents>).forEach((key) => {
      const maxWeight = maxWeights[key] ?? 0;
      if (maxWeight === 0) return;

      const ecartRelatif = (maxWeight - components[key]) / maxWeight;
      if (ecartRelatif > maxEcart) {
        maxEcart = ecartRelatif;
        worstComponent = key;
      }
    });

    if (worstComponent && maxEcart >= RECOMMENDATION_THRESHOLD) {
      return CORRECTIVE_ACTIONS[worstComponent];
    }

    return 'Continuez ainsi !';
  }

  /**
   * Lit l'état de mise à jour navigateur depuis chrome.storage.local (produit par M5).
   *
   * @returns true si le navigateur est à jour, false sinon
   */
  private async getM5UpToDateState(): Promise<boolean> {
    try {
      const result = await browser.storage.local.get([M5_UP_TO_DATE_KEY]);
      return result[M5_UP_TO_DATE_KEY] === true;
    } catch {
      return false;
    }
  }

  /**
   * Lit le score total de la semaine précédente pour calculer le delta.
   *
   * @param currentWeekKey - Clé de la semaine courante
   * @param cryptoKey      - Clé AES-256-GCM
   * @returns Score total précédent ou null si inexistant (première semaine)
   */
  private async getPreviousScore(
    currentWeekKey: string,
    cryptoKey: CryptoKey,
  ): Promise<number | null> {
    try {
      const previousWeekKey = this.getPreviousWeekKey(currentWeekKey);
      const previousScore = await this.storage.getWeeklyScore(previousWeekKey, cryptoKey);
      return previousScore?.total_score ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Retourne la clé ISO de la semaine précédente.
   *
   * @param currentWeekKey - Clé courante au format YYYY-Www
   * @returns Clé de la semaine précédente
   */
  getPreviousWeekKey(currentWeekKey: string): string {
    // Parser YYYY-Www
    const match = /^(\d{4})-W(\d{2})$/.exec(currentWeekKey);
    if (!match) return currentWeekKey;

    const year = parseInt(match[1]!, 10);
    const week = parseInt(match[2]!, 10);

    if (week > 1) {
      return `${year}-W${String(week - 1).padStart(2, '0')}`;
    }

    // Semaine 1 → dernière semaine de l'année précédente
    const lastWeekOfPrevYear = this.getISOWeeksInYear(year - 1);
    return `${year - 1}-W${String(lastWeekOfPrevYear).padStart(2, '0')}`;
  }

  /**
   * Retourne le nombre de semaines ISO dans une année donnée (52 ou 53).
   *
   * @param year - Année civile
   * @returns Nombre de semaines ISO (52 ou 53)
   */
  private getISOWeeksInYear(year: number): number {
    // Une année a 53 semaines ISO si le 1er janvier est jeudi
    // ou si c'est une année bissextile dont le 1er janvier est mercredi.
    const jan1 = new Date(year, 0, 1).getDay(); // 0=dim
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return jan1 === 4 || (isLeap && jan1 === 3) ? 53 : 52;
  }

  /**
   * Retourne la clé ISO de la semaine courante au format YYYY-Www.
   *
   * Implémentation conforme à ISO 8601 : la semaine commence le lundi,
   * et la semaine 1 est celle qui contient le premier jeudi de l'année.
   *
   * @returns Clé de semaine ISO (ex: "2026-W15")
   */
  getCurrentWeekKey(): string {
    const now = new Date();

    // Calculer le jeudi de la semaine courante (ISO 8601 : la semaine appartient à l'année du jeudi)
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1=lun, 7=dim
    const thursday = new Date(now);
    thursday.setDate(now.getDate() + (4 - dayOfWeek)); // Jeudi = jour 4

    const year = thursday.getFullYear();

    // Calculer le lundi de la semaine 1 (premier lundi avant ou le 4 janvier)
    const jan4 = new Date(year, 0, 4);
    const jan4DayOfWeek = jan4.getDay() === 0 ? 7 : jan4.getDay();
    const week1Monday = new Date(jan4);
    week1Monday.setDate(jan4.getDate() - (jan4DayOfWeek - 1));

    // Calculer le lundi de la semaine courante
    const currentMonday = new Date(now);
    currentMonday.setDate(now.getDate() - (dayOfWeek - 1));

    // Numéro de semaine = nombre de semaines entre week1Monday et currentMonday
    const diffMs = currentMonday.getTime() - week1Monday.getTime();
    const weekNumber = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;

    return `${year}-W${String(weekNumber).padStart(2, '0')}`;
  }
}
