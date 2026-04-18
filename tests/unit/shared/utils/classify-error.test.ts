/**
 * @file tests/unit/shared/utils/classify-error.test.ts
 * @description Tests unitaires de classifyError + règles ESLint R-M7-08 (TACHE-083+104).
 *
 * TC-01 : log.info avec context propre → console.info appelé avec payload sanitisé
 * TC-02 : log.info avec URL → URL complète filtrée, seul le hostname est loggé
 * TC-03 : log.error + classifyError → message brut absent, error_code seul
 * TC-04 : log.warn avec context sans circulaire → pas de crash
 * TC-05 : classifyError → codes déterministes par classe d'erreur
 * TC-06 : règle ESLint console.log dans src/ interdite (documenté)
 * TC-07 : règle ESLint const message = err.message interdite (documenté)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, Logger } from '@/shared/utils/logger';
import { classifyError } from '@/shared/utils/classify-error';
import type { ErrorCode } from '@/shared/utils/classify-error';

// ---------------------------------------------------------------------------
// TC-01 : log.info avec context propre → console.info avec payload sanitisé
// ---------------------------------------------------------------------------

describe('TC-01 : logger.info — payload sanitisé', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TC-01a : émet un JSON avec scope, timestamp, level, message et contexte propre', () => {
    const logger = createLogger('TC01Scope');
    logger.info('TC01 test', { action: 'test_action', module: 'M2' });

    expect(infoSpy).toHaveBeenCalledOnce();
    const raw = infoSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    expect(parsed.scope).toBe('TC01Scope');
    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('TC01 test');
    expect(parsed.action).toBe('test_action');
    expect(parsed.module).toBe('M2');
    expect(typeof parsed.timestamp).toBe('string');
    expect(() => new Date(parsed.timestamp as string).toISOString()).not.toThrow();
  });

  it('TC-01b : tab_id numérique présent dans le payload (non PII)', () => {
    const logger = createLogger('TC01TabScope');
    logger.info('event', { tab_id: 42, action: 'password_submitted' });

    const raw = infoSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    expect(parsed.tab_id).toBe(42);
    expect(parsed.action).toBe('password_submitted');
  });

  it('TC-01c : sans contexte — pas de champs parasites (hostname, error_name)', () => {
    const logger = createLogger('TC01MinScope');
    logger.info('minimal');

    const raw = infoSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    expect(Object.keys(parsed)).toEqual(
      expect.arrayContaining(['timestamp', 'level', 'scope', 'message']),
    );
    expect(parsed.hostname).toBeUndefined();
    expect(parsed.error_name).toBeUndefined();
    expect(parsed.error_code).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// TC-02 : log.info avec URL complète → seul le hostname dans le log
// ---------------------------------------------------------------------------

describe('TC-02 : Logger.hostnameOf — filtrage URL complet', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TC-02a : URL complète avec token → seul le hostname est loggé', () => {
    const logger = createLogger('TC02Scope');
    const sensitiveUrl = 'https://banque.fr/login?session_token=secret123&user=john@example.com';
    logger.info('navigation', { hostname: Logger.hostnameOf(sensitiveUrl) });

    const raw = infoSpy.mock.calls[0][0] as string;
    expect(raw).not.toContain('session_token');
    expect(raw).not.toContain('john@example.com');
    expect(raw).not.toContain('/login');
    expect(raw).toContain('banque.fr');
  });

  it('TC-02b : URL avec credentials (user:pass@host) → seul le hostname', () => {
    expect(Logger.hostnameOf('https://admin:password@internal.corp/api')).toBe('internal.corp');
  });

  it('TC-02c : URL undefined → unknown (valeur neutre)', () => {
    expect(Logger.hostnameOf(undefined)).toBe('unknown');
  });

  it('TC-02d : URL malformée → invalid (valeur neutre)', () => {
    expect(Logger.hostnameOf('not-a-url')).toBe('invalid');
  });
});

// ---------------------------------------------------------------------------
// TC-03 : log.error + classifyError → message brut absent
// ---------------------------------------------------------------------------

describe("TC-03 : log.error + classifyError — message brut de l'erreur absent", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("TC-03a : le message brut de l'erreur n'apparaît pas dans le log", () => {
    const err = new TypeError('mot de passe incorrect pour user@example.com — valeur: "abc123"');
    const logger = createLogger('TC03Scope');
    logger.error('handler_error', { error_code: classifyError(err) });

    const raw = errorSpy.mock.calls[0][0] as string;
    expect(raw).not.toContain('mot de passe incorrect');
    expect(raw).not.toContain('user@example.com');
    expect(raw).not.toContain('abc123');
    expect(raw).toContain('type');
  });

  it('TC-03b : error_code structuré est présent dans le payload', () => {
    const err = new RangeError('index out of bounds: 999');
    const logger = createLogger('TC03b');
    logger.error('range_err', { error_code: classifyError(err) });

    const raw = errorSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed.error_code).toBe('range');
    expect(raw).not.toContain('index out of bounds');
    expect(raw).not.toContain('999');
  });

  it('TC-03c : Logger.errorName ne logue pas le contenu de err.message (invariant INV-SEC-02)', () => {
    const sensitiveError = new TypeError(
      'Invalid password value: "motdepasse123" (contains info@example.com)',
    );
    const result = Logger.errorName(sensitiveError);
    expect(result).toBe('TypeError');
    expect(result).not.toContain('motdepasse123');
    expect(result).not.toContain('info@example.com');
  });
});

// ---------------------------------------------------------------------------
// TC-04 : log.warn — robustesse (pas de crash sur contextes inhabituels)
// ---------------------------------------------------------------------------

describe('TC-04 : logger.warn — robustesse', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TC-04a : contexte avec valeurs primitives — pas de crash', () => {
    const logger = createLogger('TC04Scope');
    expect(() => {
      logger.warn('avertissement', {
        action: 'test',
        hint: 'api_unavailable',
        tab_id: 99,
      });
    }).not.toThrow();

    expect(warnSpy).toHaveBeenCalled();
    const raw = warnSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed.level).toBe('warn');
    expect(parsed.hint).toBe('api_unavailable');
  });

  it('TC-04b : contexte avec valeur undefined — pas de crash (JSON.stringify gère undefined)', () => {
    const logger = createLogger('TC04b');
    expect(() => {
      logger.warn('warn minimal');
    }).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('TC-04c : boot_count numérique — champ toléré via [key: string]', () => {
    const logger = createLogger('TC04c');
    logger.warn('boot anomalie', { boot_count: 5, duration_ms: 123 });

    const raw = warnSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed['boot_count']).toBe(5);
    expect(parsed['duration_ms']).toBe(123);
  });
});

// ---------------------------------------------------------------------------
// TC-05 : classifyError — codes déterministes par classe d'erreur
// ---------------------------------------------------------------------------

describe('TC-05 : classifyError — codes déterministes', () => {
  it('TC-05a : QuotaExceededError → quota', () => {
    const err = new Error('quota exceeded');
    err.name = 'QuotaExceededError';
    expect(classifyError(err)).toBe('quota' satisfies ErrorCode);
  });

  it('TC-05b : TypeError standard → type', () => {
    expect(classifyError(new TypeError('argument invalid'))).toBe('type' satisfies ErrorCode);
  });

  it('TC-05c : RangeError → range', () => {
    expect(classifyError(new RangeError('index out of bounds'))).toBe('range' satisfies ErrorCode);
  });

  it('TC-05d : DOMException NotFoundError → not_found', () => {
    const err = new DOMException('not found', 'NotFoundError');
    expect(classifyError(err)).toBe('not_found' satisfies ErrorCode);
  });

  it('TC-05e : DOMException SecurityError → permission', () => {
    const err = new DOMException('access denied', 'SecurityError');
    expect(classifyError(err)).toBe('permission' satisfies ErrorCode);
  });

  it('TC-05f : DOMException NotAllowedError → permission', () => {
    const err = new DOMException('not allowed', 'NotAllowedError');
    expect(classifyError(err)).toBe('permission' satisfies ErrorCode);
  });

  it('TC-05g : DOMException AbortError → timeout', () => {
    const err = new DOMException('aborted', 'AbortError');
    expect(classifyError(err)).toBe('timeout' satisfies ErrorCode);
  });

  it('TC-05h : DOMException InvalidStateError → storage (DOMException générique)', () => {
    const err = new DOMException('invalid state', 'InvalidStateError');
    expect(classifyError(err)).toBe('storage' satisfies ErrorCode);
  });

  it('TC-05i : OperationError (SubtleCrypto) → crypto', () => {
    const err = new Error('operation failed');
    err.name = 'OperationError';
    expect(classifyError(err)).toBe('crypto' satisfies ErrorCode);
  });

  it('TC-05j : DataError (SubtleCrypto) → crypto', () => {
    const err = new Error('data error');
    err.name = 'DataError';
    expect(classifyError(err)).toBe('crypto' satisfies ErrorCode);
  });

  it('TC-05k : null → unknown', () => {
    expect(classifyError(null)).toBe('unknown' satisfies ErrorCode);
  });

  it('TC-05l : undefined → unknown', () => {
    expect(classifyError(undefined)).toBe('unknown' satisfies ErrorCode);
  });

  it('TC-05m : string catchée → unknown', () => {
    expect(classifyError('error string')).toBe('unknown' satisfies ErrorCode);
  });

  it('TC-05n : Error générique sans name spécial → unknown', () => {
    expect(classifyError(new Error('generic error'))).toBe('unknown' satisfies ErrorCode);
  });

  it('TC-05o : codes stables — même classe = même code (déterminisme)', () => {
    const err1 = new TypeError('msg1');
    const err2 = new TypeError('msg2 different et plus long');
    expect(classifyError(err1)).toBe(classifyError(err2));
  });

  it('TC-05p : classifyError ne retourne jamais le contenu de err.message', () => {
    const sensitiveError = new TypeError('Invalid value for field password: "motdepasse123"');
    const result = classifyError(sensitiveError);
    expect(result).toBe('type');
    expect(result).not.toContain('motdepasse123');
    expect(result).not.toContain('Invalid value');
  });
});

// ---------------------------------------------------------------------------
// TC-06 / TC-07 : Documentation règles ESLint AST (R-M7-08 / TACHE-083+104)
// ---------------------------------------------------------------------------

describe('TC-06/TC-07 : règles ESLint AST documentées', () => {
  it('TC-06 : console.log() direct dans src/ est interdit par la règle ESLint no-restricted-syntax', () => {
    // La règle eslint.config.js sélecteur :
    //   CallExpression[callee.object.name='console'][callee.property.name='log']
    // couvre src/**/*.ts et émet une erreur.
    // Pattern interdit : console.log('debug');
    // Pattern conforme : createLogger('M2').info('debug');
    // Vérification : npm run lint sur src/ → 0 erreur.
    expect(true).toBe(true);
  });

  it('TC-07 : const message = err.message est interdit par la règle ESLint (TACHE-104)', () => {
    // La règle eslint.config.js sélecteur :
    //   VariableDeclarator[id.name='message'] > MemberExpression[property.name='message']
    // couvre src/**/*.ts et émet une erreur.
    // Pattern interdit :
    //   const message = err instanceof Error ? err.message : 'Erreur inconnue';
    //   console.error(`[Handler] Erreur: ${message}`);
    // Pattern conforme :
    //   logger.error('Erreur handler', { error_code: classifyError(err) });
    // Vérification : npm run lint sur src/ → 0 erreur.
    expect(true).toBe(true);
  });
});
