import '@angular/compiler';
import { Router } from '@angular/router';
import { ChangeDetectorRef, Injector, NgZone } from '@angular/core';
import axios from 'axios';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginComponent } from './login.component';
import { SessionService } from '../services/session.service';
import { AuthService } from '../services/auth.service';
import { TasksService } from '../services/tasks.service';
import { DashboardComponent } from '../dashboard/dashboard.component';

vi.mock('axios', () => ({ default: { post: vi.fn(), get: vi.fn() } }));

describe('LoginComponent characterization', () => {
  const navigate = vi.fn().mockResolvedValue(true);
  let component: LoginComponent;
  let values: Map<string, string>;
  let session: SessionService;
  const injector = Injector.create({ providers: [
    { provide: Router, useValue: { navigate } },
    { provide: NgZone, useValue: { run: vi.fn((action: () => unknown) => action()) } },
    { provide: ChangeDetectorRef, useValue: { detectChanges: vi.fn() } }
  ] });
  const router = injector.get(Router);
  const zone = injector.get(NgZone);
  const cdr = injector.get(ChangeDetectorRef);

  beforeEach(() => {
    vi.clearAllMocks();
    values = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, String(value)),
      removeItem: (key: string) => values.delete(key)
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    session = new SessionService();
    component = new LoginComponent(router, session, new AuthService(), zone, cdr);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([null, undefined, '', '   '])('rejects empty username %s before HTTP', async (username) => {
    component.username = username;
    await component.login();
    expect(component.message).toContain('Ingrese un usuario.');
    expect(axios.post).not.toHaveBeenCalled();
    expect(component.busy).toBe(false);
    expect(component.cleanupWarning).toBe('');
  });

  it.each([null, undefined, '', '   '])('rejects empty password %s before HTTP', async (password) => {
    component.username = 'student';
    component.password = password;
    await component.login();
    expect(component.message).toContain('Ingrese una');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('sends original credentials and saves memory session/preferences before navigating', async () => {
    component.username = ' student ';
    component.password = ' Workshop123! ';
    vi.mocked(axios.post).mockResolvedValue({ data: { token: 'test-token', user: { username: 'student' } } });
    navigate.mockImplementationOnce(async () => {
      expect([...values.keys()]).toEqual(['workshop_preferences']);
      expect(session.readSession()).toEqual({ token: 'test-token', user: { username: 'student' } });
      return true;
    });
    const pending = component.login();
    expect(component.busy).toBe(true);
    await pending;
    expect(axios.post).toHaveBeenCalledWith('http://localhost:8080/auth/login', {
      username: ' student ', password: ' Workshop123! ', client: 'angular-workshop'
    }, { timeout: 5000 });
    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(component.busy).toBe(false);
  });

  it('stays on login when the response has no token', async () => {
    component.username = 'student';
    component.password = 'password';
    vi.mocked(axios.post).mockResolvedValue({ data: {} });
    await component.login();
    expect(component.message).toContain('sin token');
    expect(navigate).not.toHaveBeenCalled();
    expect(values.size).toBe(0);
    expect(component.busy).toBe(false);
  });

  it('does not expose backend or transport details to the user', async () => {
    component.username = 'student';
    component.password = 'password';
    vi.mocked(axios.post).mockRejectedValue({ response: { data: { message: 'backend detail' } }, message: 'transport' });
    await component.login();
    expect(component.message).toBe('No se pudo autenticar a student. Intente nuevamente.');
    expect(component.message).not.toContain('backend detail');
    expect(component.message).not.toContain('transport');
    expect(navigate).not.toHaveBeenCalled();
    expect(component.busy).toBe(false);
  });

  it.each([
    [{ message: 'transport' }, 'transport'], [{}, 'Error desconocido']
  ])('uses a public message for all error shapes', async (error, _previousMessage) => {
    component.username = 'student';
    component.password = 'password';
    vi.mocked(axios.post).mockRejectedValue(error);
    await component.login();
    expect(component.message).toBe('No se pudo autenticar a student. Intente nuevamente.');
    expect(component.busy).toBe(false);
  });

  it('releases busy if navigation fails after persistence', async () => {
    component.username = 'student';
    component.password = 'password';
    vi.mocked(axios.post).mockResolvedValue({ data: { token: 'test-token', user: {} } });
    navigate.mockRejectedValueOnce(new Error('navigation'));
    await component.login();
    expect(session.readSession().token).toBe('test-token');
    expect(component.busy).toBe(false);
  });

  it.each([
    [{ compact: true }, { theme: 'light', showTips: true, compact: true }],
    [{ showTips: false, theme: '' }, { theme: '', showTips: false, compact: false }],
    [{ theme: null, extra: { nested: true } }, { theme: null, showTips: true, compact: false, extra: { nested: true } }],
    [null, { theme: 'light', showTips: true, compact: false }]
  ])('preserves preference merge semantics', (saved, expected) => {
    values.set('workshop_preferences', JSON.stringify(saved));
    const restored = new LoginComponent(router, new SessionService(), new AuthService(), zone, cdr);
    expect(restored.preferences).toEqual(expected);
  });

  it('keeps defaults when stored preferences contain invalid JSON', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    values.set('workshop_preferences', '{');
    const restored = new LoginComponent(router, new SessionService(), new AuthService(), zone, cdr);
    expect(restored.preferences).toEqual({ theme: 'light', showTips: true, compact: false });
  });

  it('binds messages as text rather than dynamic HTML', () => {
    const template = readFileSync(new URL('./login.component.html', import.meta.url), 'utf8');
    expect(template).not.toContain('[innerHTML]');
    expect(template).toContain('{{ message }}');
  });

  it('preserves the complete login -> tasks -> logout flow with a shared session', async () => {
    component.username = 'student';
    component.password = 'password';
    vi.mocked(axios.post).mockResolvedValue({ data: { token: 'flow-token', user: { username: 'student' } } });
    vi.mocked(axios.get).mockResolvedValue({ data: [{ title: 'Flow task', status: 'TODO' }] });
    await component.login();
    const dashboard = new DashboardComponent(router, cdr, zone, session, new TasksService());
    await dashboard.ngOnInit();
    expect(axios.get).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=student', {
      headers: { Authorization: 'Bearer flow-token' }
    });
    expect(dashboard.visibleTasks[0].title).toBe('Flow task');
    expect(dashboard.loading).toBe(false);
    await dashboard.logout();
    expect(session.readSession().token).toBeNull();
    expect([...values.keys()]).toEqual(['workshop_preferences']);
    expect(navigate).toHaveBeenLastCalledWith(['/login']);
  });

  it.each([
    { name: 'backend unavailable', error: { code: 'ECONNREFUSED' } },
    { name: 'login timeout', error: { code: 'ECONNABORTED' } },
    { name: 'network or CORS rejection', error: { code: 'ERR_NETWORK' } },
    { name: 'HTTP 400', error: { response: { status: 400 } } },
    { name: 'HTTP 401', error: { response: { status: 401 } } },
    { name: 'HTTP 403', error: { response: { status: 403 } } },
    { name: 'HTTP 500', error: { response: { status: 500 } } }
  ])('handles $name without leaking errors or leaving busy set', async ({ error }) => {
    component.username = 'student';
    component.password = 'password';
    vi.mocked(axios.post).mockRejectedValueOnce(error);
    await component.login();
    expect(component.message).toBe('No se pudo autenticar a student. Intente nuevamente.');
    expect(component.busy).toBe(false);
    expect(session.readSession().token).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(cdr.detectChanges).toHaveBeenCalledOnce();
    expect(axios.post).toHaveBeenCalledOnce();
  });

  it.each([
    { name: 'missing body', data: undefined },
    { name: 'null body', data: null },
    { name: 'empty response or HTTP 204', data: '' },
    { name: 'empty object', data: {} },
    { name: 'empty token', data: { token: '' } },
    { name: 'malformed JSON text', data: '{' }
  ])('does not establish a session with $name', async ({ data }) => {
    component.username = 'student';
    component.password = 'password';
    vi.mocked(axios.post).mockResolvedValueOnce({ data });
    await component.login();
    expect(component.message).toContain('sin token');
    expect(component.busy).toBe(false);
    expect(session.readSession().token).toBeNull();
    expect(values.size).toBe(0);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows a public error and releases busy when saving preferences fails', async () => {
    component.username = 'student';
    component.password = 'password';
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { token: 'test-token', user: { username: 'student' } } });
    vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('Storage unavailable', 'QuotaExceededError');
    });
    await component.login();
    expect(component.message).toBe('No se pudo autenticar a student. Intente nuevamente.');
    expect(component.busy).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    expect(cdr.detectChanges).toHaveBeenCalledOnce();
  });

  it('releases busy when the router resolves false instead of rejecting', async () => {
    component.username = 'student';
    component.password = 'password';
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { token: 'test-token', user: {} } });
    navigate.mockResolvedValueOnce(false);
    await component.login();
    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(component.busy).toBe(false);
  });

  it('reports an invalid token rejected by tasks after login without inventing automatic logout', async () => {
    component.username = 'student';
    component.password = 'password';
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { token: 'invalid-token', user: { username: 'student' } } });
    vi.mocked(axios.get).mockRejectedValueOnce({ response: { status: 401, data: { detail: 'expired token' } } });
    await component.login();
    navigate.mockClear();
    const dashboard = new DashboardComponent(router, cdr, zone, session, new TasksService());
    await dashboard.ngOnInit();
    expect(axios.get).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=student', {
      headers: { Authorization: 'Bearer invalid-token' }
    });
    expect(dashboard.error).toBe('No se pudo cargar el dashboard. Intente nuevamente.');
    expect(dashboard.loading).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    expect(session.readSession().token).toBe('invalid-token');
  });

  it('exposes a public cleanup warning at startup separately from login errors', async () => {
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new DOMException('Sensitive storage detail', 'SecurityError');
    });
    const failedSession = new SessionService();
    const login = new LoginComponent(router, failedSession, new AuthService(), zone, cdr);
    expect(login.cleanupWarning).toBe('No se pudo completar la limpieza de datos de una sesion anterior en este navegador.');
    expect(login.cleanupWarning).not.toContain('Sensitive storage detail');
    login.username = 'student';
    login.password = 'password';
    vi.mocked(axios.post).mockRejectedValueOnce({ response: { status: 401 } });
    await login.login();
    expect(login.message).toBe('No se pudo autenticar a student. Intente nuevamente.');
    expect(login.cleanupWarning).toBe('No se pudo completar la limpieza de datos de una sesion anterior en este navegador.');
    expect(login.busy).toBe(false);
  });

  it('preserves the cleanup warning when the login component is recreated after logout', () => {
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new DOMException('Storage unavailable', 'SecurityError');
    });
    session.clearSession();
    const returned = new LoginComponent(router, session, new AuthService(), zone, cdr);
    expect(returned.cleanupWarning).toBe('No se pudo completar la limpieza de datos de una sesion anterior en este navegador.');
    expect(session.cleanupFailed).toBe(true);
    expect(returned.message).toBe('');
  });
});