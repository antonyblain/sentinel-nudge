/**
 * @file background/alarm-manager.ts
 * @description Gestion des alarmes Chrome pour les tâches planifiées de Sentinel Nudge.
 *
 * Alarmes définies :
 * - `m3_weekly`    : Lundi 09h00 locale — déclenchement du calcul de score M3
 * - `m5_update`    : Au démarrage + toutes les 48h — vérification mise à jour navigateur (M5)
 * - `m6_quiz`      : Spaced repetition M6 — déclenchement du quiz selon fréquence config
 * - `purge_daily`  : Chaque jour à 02h00 locale — purge des données expirées (90j/52sem.)
 *
 * Le Service Worker éphémère MV3 est réveillé par les alarmes Chrome.
 * Sans alarmes, aucune tâche planifiée ne pourrait s'exécuter (pas de background persistant).
 *
 * Référence : DAT §6.2 (Alarmes planifiées), §3.1 (Service Worker éphémère)
 */

import { browser } from '@/shared/browser/browser-adapter';

/** Noms des alarmes — constantes pour éviter les typos */
export const ALARM_NAMES = {
  M3_WEEKLY: 'm3_weekly',
  M5_UPDATE: 'm5_update',
  M6_QUIZ: 'm6_quiz',
  PURGE_DAILY: 'purge_daily',
} as const;

/** Type des noms d'alarmes */
export type AlarmName = (typeof ALARM_NAMES)[keyof typeof ALARM_NAMES];

/** Interface du dispatcher d'alarmes (injectée pour faciliter les tests) */
export interface AlarmDispatcher {
  onM3Weekly(): Promise<void>;
  onM5Update(): Promise<void>;
  onM6Quiz(): Promise<void>;
  onPurgeDaily(): Promise<void>;
}

/**
 * Calcule le délai en minutes jusqu'au prochain lundi à 09h00 locale.
 *
 * @returns Délai en minutes (toujours positif, entre 0 et 10080 min = 7 jours)
 */
function minutesUntilNextMondayAt9(): number {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=dim, 1=lun, ..., 6=sam
  const daysUntilMonday = dayOfWeek === 1 ? 0 : (8 - dayOfWeek) % 7;

  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(9, 0, 0, 0);

  // Si on est lundi mais après 09h00, décaler d'une semaine
  if (nextMonday <= now) {
    nextMonday.setDate(nextMonday.getDate() + 7);
  }

  return Math.max(1, Math.round((nextMonday.getTime() - now.getTime()) / 60_000));
}

/**
 * Calcule le délai en minutes jusqu'à la prochaine 02h00 locale (purge quotidienne).
 *
 * @returns Délai en minutes
 */
function minutesUntilNext2AM(): number {
  const now = new Date();
  const next2AM = new Date(now);
  next2AM.setHours(2, 0, 0, 0);

  if (next2AM <= now) {
    next2AM.setDate(next2AM.getDate() + 1);
  }

  return Math.max(1, Math.round((next2AM.getTime() - now.getTime()) / 60_000));
}

/**
 * Gestionnaire des alarmes Chrome pour Sentinel Nudge.
 */
export class AlarmManager {
  private readonly dispatcher: AlarmDispatcher;

  constructor(dispatcher: AlarmDispatcher) {
    this.dispatcher = dispatcher;
  }

  /**
   * Initialise toutes les alarmes au démarrage du Service Worker (onInstalled + onStartup).
   *
   * Les alarmes sont idempotentes : Chrome ignore les doublons si une alarme
   * du même nom existe déjà.
   */
  setupAlarms(): void {
    // M3 : calcul du score hebdomadaire — lundi prochain à 09h00
    browser.alarms.create(ALARM_NAMES.M3_WEEKLY, {
      delayInMinutes: minutesUntilNextMondayAt9(),
      periodInMinutes: 7 * 24 * 60, // Toutes les semaines
    });

    // M5 : vérification mise à jour navigateur — maintenant + toutes les 48h
    browser.alarms.create(ALARM_NAMES.M5_UPDATE, {
      delayInMinutes: 1, // Léger délai pour éviter la surcharge au startup
      periodInMinutes: 48 * 60, // Toutes les 48h
    });

    // M6 : quiz spaced repetition — toutes les 72h par défaut
    // La fréquence exacte sera configurable dans les paramètres en P4 module M6
    browser.alarms.create(ALARM_NAMES.M6_QUIZ, {
      delayInMinutes: 72 * 60,
      periodInMinutes: 72 * 60,
    });

    // Purge quotidienne à 02h00
    browser.alarms.create(ALARM_NAMES.PURGE_DAILY, {
      delayInMinutes: minutesUntilNext2AM(),
      periodInMinutes: 24 * 60, // Tous les jours
    });
  }

  /**
   * Dispatche une alarme vers le handler approprié.
   *
   * Appelé depuis le listener chrome.alarms.onAlarm du service-worker.ts.
   *
   * @param alarm - Alarme Chrome déclenchée
   */
  async handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
    switch (alarm.name as AlarmName) {
      case ALARM_NAMES.M3_WEEKLY:
        await this.dispatcher.onM3Weekly();
        break;
      case ALARM_NAMES.M5_UPDATE:
        await this.dispatcher.onM5Update();
        break;
      case ALARM_NAMES.M6_QUIZ:
        await this.dispatcher.onM6Quiz();
        break;
      case ALARM_NAMES.PURGE_DAILY:
        await this.dispatcher.onPurgeDaily();
        break;
      default:
        // Alarme inconnue — ignorée silencieusement
        break;
    }
  }
}
