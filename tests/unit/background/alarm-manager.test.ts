/**
 * @file tests/unit/background/alarm-manager.test.ts
 * @description Tests unitaires AlarmManager — TACHE-020.
 *
 * Couvre :
 * - setupAlarms : création des 4 alarmes avec les bons paramètres
 * - handleAlarm : dispatch vers le bon handler selon alarm.name
 * - Cas nominaux : m3_weekly, m5_update, m6_quiz, purge_daily
 * - Cas erreur : alarme inconnue ignorée silencieusement, handler absent
 *
 * Référence : DAT §6.2 (alarmes planifiées), §3.1 (SW éphémère)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlarmManager, ALARM_NAMES } from '@/background/alarm-manager';
import type { AlarmDispatcher } from '@/background/alarm-manager';

// ---------------------------------------------------------------------------
// Mock chrome.alarms
// ---------------------------------------------------------------------------

const createdAlarms: Array<{ name: string; info: chrome.alarms.AlarmCreateInfo }> = [];

global.chrome = {
  alarms: {
    create: vi.fn((name: string, info: chrome.alarms.AlarmCreateInfo) => {
      createdAlarms.push({ name, info });
    }),
    clear: vi.fn((_name: string, callback?: (wasCleared: boolean) => void) => {
      callback?.(true);
    }),
  },
} as unknown as typeof chrome;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDispatcher(overrides: Partial<AlarmDispatcher> = {}): AlarmDispatcher {
  return {
    onM3Weekly: vi.fn().mockResolvedValue(undefined),
    onM5Update: vi.fn().mockResolvedValue(undefined),
    onM6Quiz: vi.fn().mockResolvedValue(undefined),
    onPurgeDaily: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function buildAlarm(name: string): chrome.alarms.Alarm {
  return {
    name,
    scheduledTime: Date.now() + 60_000,
    periodInMinutes: 60,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  createdAlarms.length = 0;
  vi.clearAllMocks();
});

describe('AlarmManager — setupAlarms', () => {
  it('crée les 4 alarmes au démarrage', () => {
    const manager = new AlarmManager(buildDispatcher());
    manager.setupAlarms();

    const names = createdAlarms.map((a) => a.name);
    expect(names).toContain(ALARM_NAMES.M3_WEEKLY);
    expect(names).toContain(ALARM_NAMES.M5_UPDATE);
    expect(names).toContain(ALARM_NAMES.M6_QUIZ);
    expect(names).toContain(ALARM_NAMES.PURGE_DAILY);
    expect(createdAlarms).toHaveLength(4);
  });

  it('m5_update a un delayInMinutes de 1 (léger délai startup)', () => {
    const manager = new AlarmManager(buildDispatcher());
    manager.setupAlarms();

    const m5 = createdAlarms.find((a) => a.name === ALARM_NAMES.M5_UPDATE);
    expect(m5).toBeDefined();
    expect(m5!.info.delayInMinutes).toBe(1);
  });

  it('m5_update a une périodicité de 48h (2880 min)', () => {
    const manager = new AlarmManager(buildDispatcher());
    manager.setupAlarms();

    const m5 = createdAlarms.find((a) => a.name === ALARM_NAMES.M5_UPDATE);
    expect(m5!.info.periodInMinutes).toBe(48 * 60);
  });

  it('m3_weekly a une périodicité de 7 jours (10080 min)', () => {
    const manager = new AlarmManager(buildDispatcher());
    manager.setupAlarms();

    const m3 = createdAlarms.find((a) => a.name === ALARM_NAMES.M3_WEEKLY);
    expect(m3!.info.periodInMinutes).toBe(7 * 24 * 60);
  });

  it('purge_daily a une périodicité de 24h (1440 min)', () => {
    const manager = new AlarmManager(buildDispatcher());
    manager.setupAlarms();

    const purge = createdAlarms.find((a) => a.name === ALARM_NAMES.PURGE_DAILY);
    expect(purge!.info.periodInMinutes).toBe(24 * 60);
  });

  it('m6_quiz a une périodicité de 72h (4320 min)', () => {
    const manager = new AlarmManager(buildDispatcher());
    manager.setupAlarms();

    const m6 = createdAlarms.find((a) => a.name === ALARM_NAMES.M6_QUIZ);
    expect(m6!.info.periodInMinutes).toBe(72 * 60);
  });
});

describe('AlarmManager — handleAlarm dispatch', () => {
  it('dispatch m3_weekly → onM3Weekly()', async () => {
    const dispatcher = buildDispatcher();
    const manager = new AlarmManager(dispatcher);

    await manager.handleAlarm(buildAlarm(ALARM_NAMES.M3_WEEKLY));

    expect(dispatcher.onM3Weekly).toHaveBeenCalledOnce();
    expect(dispatcher.onM5Update).not.toHaveBeenCalled();
    expect(dispatcher.onM6Quiz).not.toHaveBeenCalled();
    expect(dispatcher.onPurgeDaily).not.toHaveBeenCalled();
  });

  it('dispatch m5_update → onM5Update()', async () => {
    const dispatcher = buildDispatcher();
    const manager = new AlarmManager(dispatcher);

    await manager.handleAlarm(buildAlarm(ALARM_NAMES.M5_UPDATE));

    expect(dispatcher.onM5Update).toHaveBeenCalledOnce();
    expect(dispatcher.onM3Weekly).not.toHaveBeenCalled();
  });

  it('dispatch m6_quiz → onM6Quiz()', async () => {
    const dispatcher = buildDispatcher();
    const manager = new AlarmManager(dispatcher);

    await manager.handleAlarm(buildAlarm(ALARM_NAMES.M6_QUIZ));

    expect(dispatcher.onM6Quiz).toHaveBeenCalledOnce();
    expect(dispatcher.onM3Weekly).not.toHaveBeenCalled();
  });

  it('dispatch purge_daily → onPurgeDaily()', async () => {
    const dispatcher = buildDispatcher();
    const manager = new AlarmManager(dispatcher);

    await manager.handleAlarm(buildAlarm(ALARM_NAMES.PURGE_DAILY));

    expect(dispatcher.onPurgeDaily).toHaveBeenCalledOnce();
    expect(dispatcher.onM3Weekly).not.toHaveBeenCalled();
  });

  it('alarme inconnue ignorée silencieusement — aucun handler appelé', async () => {
    const dispatcher = buildDispatcher();
    const manager = new AlarmManager(dispatcher);

    await expect(manager.handleAlarm(buildAlarm('unknown_alarm'))).resolves.not.toThrow();

    expect(dispatcher.onM3Weekly).not.toHaveBeenCalled();
    expect(dispatcher.onM5Update).not.toHaveBeenCalled();
    expect(dispatcher.onM6Quiz).not.toHaveBeenCalled();
    expect(dispatcher.onPurgeDaily).not.toHaveBeenCalled();
  });

  it('alarme vide (name="") ignorée silencieusement', async () => {
    const dispatcher = buildDispatcher();
    const manager = new AlarmManager(dispatcher);

    await expect(manager.handleAlarm(buildAlarm(''))).resolves.not.toThrow();

    expect(dispatcher.onM3Weekly).not.toHaveBeenCalled();
  });

  it('erreur dans un handler propagée sans masquage', async () => {
    const dispatcher = buildDispatcher({
      onM3Weekly: vi.fn().mockRejectedValue(new Error('Handler crash')),
    });
    const manager = new AlarmManager(dispatcher);

    await expect(manager.handleAlarm(buildAlarm(ALARM_NAMES.M3_WEEKLY))).rejects.toThrow(
      'Handler crash',
    );
  });
});

describe('AlarmManager — ALARM_NAMES constantes', () => {
  it('les constantes correspondent aux noms attendus', () => {
    expect(ALARM_NAMES.M3_WEEKLY).toBe('m3_weekly');
    expect(ALARM_NAMES.M5_UPDATE).toBe('m5_update');
    expect(ALARM_NAMES.M6_QUIZ).toBe('m6_quiz');
    expect(ALARM_NAMES.PURGE_DAILY).toBe('purge_daily');
  });
});
