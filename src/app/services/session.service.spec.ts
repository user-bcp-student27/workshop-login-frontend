import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionService } from './session.service';

describe('SessionService approved in-memory session', () => {
  let values: Map<string, string>;
  const preferences = { theme: 'light', showTips: true, compact: true };

  beforeEach(() => {
    values = new Map([
      ['workshop_token', 'legacy-token'],
      ['workshop_user', '{"username":"legacy"}'],
      ['workshop_preferences', JSON.stringify(preferences)]
    ]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, String(value)),
      removeItem: (key: string) => values.delete(key)
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('cleans legacy credentials at startup while preserving preferences', () => {
    const session = new SessionService();
    expect([...values.keys()]).toEqual(['workshop_preferences']);
    expect(session.readSession()).toEqual({ token: null, user: {} });
    expect(session.readPreferences()).toEqual(preferences);
    expect(session.cleanupFailed).toBe(false);
  });

  it('shares the active session without persisting token or user', () => {
    const session = new SessionService();
    session.saveSession('memory-token', { username: 'student' }, preferences);
    expect(session.readSession()).toEqual({ token: 'memory-token', user: { username: 'student' } });
    expect(session.readSession().token).toBe('memory-token');
    expect([...values.keys()]).toEqual(['workshop_preferences']);
  });

  it('starts unauthenticated after the application service is recreated', () => {
    const session = new SessionService();
    session.saveSession('memory-token', { username: 'student' }, preferences);
    const restarted = new SessionService();
    expect(restarted.readSession()).toEqual({ token: null, user: {} });
    expect(restarted.readPreferences()).toEqual(preferences);
  });

  it('clears memory and any legacy keys at logout without removing preferences', () => {
    const session = new SessionService();
    session.saveSession('memory-token', { username: 'student' }, preferences);
    values.set('workshop_token', 'old-token');
    values.set('workshop_user', '{}');
    session.clearSession();
    expect(session.readSession()).toEqual({ token: null, user: {} });
    expect(values.get('workshop_preferences')).toBe(JSON.stringify(preferences));
    expect([...values.keys()]).toEqual(['workshop_preferences']);
  });

  it('allows an absent user without requiring an undocumented response field', () => {
    const session = new SessionService();
    session.saveSession('memory-token', undefined, preferences);
    expect(session.readSession()).toEqual({ token: 'memory-token', user: {} });
  });

  it('uses default preferences if reading stored preferences fails', () => {
    const session = new SessionService();
    vi.spyOn(localStorage, 'getItem').mockImplementationOnce(() => {
      throw new DOMException('Storage unavailable', 'SecurityError');
    });
    expect(session.readPreferences()).toEqual({ theme: 'light', showTips: true, compact: false });
  });

  it('REGRESSION H-01: initializes the memory session when legacy storage cleanup is denied', () => {
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new DOMException('Storage unavailable', 'SecurityError');
    });
    expect(() => new SessionService()).not.toThrow();
  });

  it('records cleanup failure without exposing the storage error', () => {
    const remove = vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new DOMException('Sensitive storage detail', 'SecurityError');
    });
    const session = new SessionService();
    expect(remove).toHaveBeenCalledTimes(2);
    expect(session.cleanupFailed).toBe(true);
    expect(session.readSession()).toEqual({ token: null, user: {} });
    expect(session.readPreferences()).toEqual(preferences);
    expect(session.cleanupFailed).toBe(true);
  });

  it.each(['workshop_token', 'workshop_user'])('attempts both keys when %s cannot be removed and only clears the warning after full success', (failedKey) => {
    const remove = vi.spyOn(localStorage, 'removeItem').mockImplementation((key: string) => {
      if (key === failedKey) throw new DOMException('Storage unavailable', 'SecurityError');
      values.delete(key);
    });
    const session = new SessionService();
    expect(remove).toHaveBeenCalledWith('workshop_token');
    expect(remove).toHaveBeenCalledWith('workshop_user');
    expect(session.cleanupFailed).toBe(true);
    expect(values.has(failedKey)).toBe(true);
    expect(values.has(failedKey === 'workshop_token' ? 'workshop_user' : 'workshop_token')).toBe(false);
    expect(session.readSession().token).toBeNull();
    expect(session.cleanupFailed).toBe(true);
    remove.mockRestore();
    session.clearSession();
    expect(session.cleanupFailed).toBe(false);
    expect([...values.keys()]).toEqual(['workshop_preferences']);
  });

  it('handles denial of the localStorage getter and keeps a cleanup warning', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => { throw new DOMException('Access denied', 'SecurityError'); }
    });
    const session = new SessionService();
    expect(session.cleanupFailed).toBe(true);
    expect(session.readSession()).toEqual({ token: null, user: {} });
    expect(session.readPreferences()).toEqual({ theme: 'light', showTips: true, compact: false });
    session.clearSession();
    expect(session.cleanupFailed).toBe(true);
  });
});