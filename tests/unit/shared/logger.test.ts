/**
 * @file tests/unit/shared/logger.test.ts
 * @description Tests unitaires de la factory Logger (TACHE-083 / R-M7-08).
 *
 * Vérifie :
 * - Logger.hostnameOf : filtrage URL → hostname uniquement
 * - Logger.errorName  : filtrage err → Error.name uniquement
 * - logger.info       : format JSON structuré + champs attendus
 * - logger.warn       : délégation à console.warn
 * - logger.error      : délégation à console.error
 * - logger.info       : délégation à console.info
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, Logger } from '@/shared/utils/logger';

// ---------------------------------------------------------------------------
// Logger.hostnameOf
// ---------------------------------------------------------------------------

describe('Logger.hostnameOf', () => {
  it('extrait le hostname depuis une URL complète avec path et query', () => {
    expect(Logger.hostnameOf('https://banque.fr/login?token=xxx&redirect=/dashboard')).toBe(
      'banque.fr',
    );
  });

  it("extrait le hostname depuis une URL avec credentials (filtre les données d'auth)", () => {
    expect(Logger.hostnameOf('https://user:pass@example.com/path')).toBe('example.com');
  });

  it('retourne invalid pour une URL malformée (pas un vrai URL)', () => {
    expect(Logger.hostnameOf('invalid')).toBe('invalid');
  });

  it('retourne invalid pour une chaîne vide non falsy qui échoue URL()', () => {
    // 'not-a-url' n'a pas de scheme valide
    expect(Logger.hostnameOf('not-a-url')).toBe('invalid');
  });

  it('retourne unknown pour undefined', () => {
    expect(Logger.hostnameOf(undefined)).toBe('unknown');
  });

  it('retourne unknown pour null', () => {
    expect(Logger.hostnameOf(null)).toBe('unknown');
  });

  it('retourne unknown pour chaîne vide', () => {
    expect(Logger.hostnameOf('')).toBe('unknown');
  });

  it('extrait correctement le hostname depuis une URL http (non HTTPS)', () => {
    expect(Logger.hostnameOf('http://example.com/page')).toBe('example.com');
  });
});

// ---------------------------------------------------------------------------
// Logger.errorName
// ---------------------------------------------------------------------------

describe('Logger.errorName', () => {
  it('retourne le name pour un TypeError', () => {
    expect(Logger.errorName(new TypeError('message sensible non loggé'))).toBe('TypeError');
  });

  it('retourne le name pour un RangeError', () => {
    expect(Logger.errorName(new RangeError('out of bounds'))).toBe('RangeError');
  });

  it('retourne le name pour une Error générique', () => {
    expect(Logger.errorName(new Error('whatever'))).toBe('Error');
  });

  it('retourne UnknownError pour null', () => {
    expect(Logger.errorName(null)).toBe('UnknownError');
  });

  it('retourne UnknownError pour undefined', () => {
    expect(Logger.errorName(undefined)).toBe('UnknownError');
  });

  it('retourne UnknownError pour une string (non-Error catchée)', () => {
    expect(Logger.errorName('string error')).toBe('UnknownError');
  });

  it('retourne UnknownError pour un objet non-Error', () => {
    expect(Logger.errorName({ message: 'not an error' })).toBe('UnknownError');
  });

  it('retourne UnknownError pour un nombre (ex: throw 42)', () => {
    expect(Logger.errorName(42)).toBe('UnknownError');
  });
});

// ---------------------------------------------------------------------------
// logger.info / warn / error — format de sortie et délégation console
// ---------------------------------------------------------------------------

describe('Logger instance — format JSON structuré', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logger.info émet un JSON avec scope, timestamp, level, message et contexte', () => {
    const logger = createLogger('TestScope');
    logger.info('msg test', { hostname: 'foo.com' });

    expect(infoSpy).toHaveBeenCalledOnce();
    const raw = infoSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    expect(parsed.scope).toBe('TestScope');
    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('msg test');
    expect(parsed.hostname).toBe('foo.com');
    expect(typeof parsed.timestamp).toBe('string');
    // timestamp doit être ISO 8601
    expect(() => new Date(parsed.timestamp as string).toISOString()).not.toThrow();
  });

  it('logger.warn délègue à console.warn avec level=warn', () => {
    const logger = createLogger('WarnScope');
    logger.warn('avertissement', { action: 'test_action' });

    expect(warnSpy).toHaveBeenCalledOnce();
    const raw = warnSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    expect(parsed.level).toBe('warn');
    expect(parsed.scope).toBe('WarnScope');
    expect(parsed.action).toBe('test_action');
  });

  it('logger.error délègue à console.error avec level=error', () => {
    const logger = createLogger('ErrorScope');
    logger.error('panne détectée', { error_name: 'TypeError', module: 'M9' });

    expect(errorSpy).toHaveBeenCalledOnce();
    const raw = errorSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    expect(parsed.level).toBe('error');
    expect(parsed.error_name).toBe('TypeError');
    expect(parsed.module).toBe('M9');
  });

  it('logger.info sans contexte ne génère pas de champs parasites', () => {
    const logger = createLogger('MinimalScope');
    logger.info('message minimal');

    const raw = infoSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // Champs attendus uniquement
    expect(Object.keys(parsed)).toEqual(
      expect.arrayContaining(['timestamp', 'level', 'scope', 'message']),
    );
    // Pas de champs undefined parasites
    expect(parsed.hostname).toBeUndefined();
    expect(parsed.error_name).toBeUndefined();
  });

  it("logger.error n'émet pas le message brut de l'erreur (INV-SEC-02)", () => {
    const err = new TypeError('mot de passe incorrect pour user@example.com');
    const logger = createLogger('SecScope');
    logger.error('logEvent failed', { error_name: Logger.errorName(err) });

    const raw = errorSpy.mock.calls[0][0] as string;
    // Le message brut de l'erreur NE DOIT PAS apparaître dans le log
    expect(raw).not.toContain('mot de passe incorrect');
    expect(raw).not.toContain('user@example.com');
    expect(raw).toContain('TypeError');
  });

  it('createLogger crée des instances indépendantes avec leur propre scope', () => {
    const logger1 = createLogger('Scope1');
    const logger2 = createLogger('Scope2');

    logger1.info('msg1');
    logger2.info('msg2');

    const raw1 = JSON.parse(infoSpy.mock.calls[0][0] as string) as Record<string, unknown>;
    const raw2 = JSON.parse(infoSpy.mock.calls[1][0] as string) as Record<string, unknown>;

    expect(raw1.scope).toBe('Scope1');
    expect(raw2.scope).toBe('Scope2');
  });

  it('logger.info avec tab_id numérique est correct (tolérance [key: string])', () => {
    const logger = createLogger('TabScope');
    logger.info('event', { tab_id: 123, action: 'password_submitted' });

    const raw = infoSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    expect(parsed.tab_id).toBe(123);
    expect(parsed.action).toBe('password_submitted');
  });
});
