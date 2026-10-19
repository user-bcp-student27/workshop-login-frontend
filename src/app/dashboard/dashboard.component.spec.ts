import '@angular/compiler';
import { ChangeDetectorRef, Injector, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardComponent } from './dashboard.component';
import { SessionService } from '../services/session.service';
import { TasksService } from '../services/tasks.service';

vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

describe('DashboardComponent characterization', () => {
  const navigate = vi.fn().mockResolvedValue(true);
  const detectChanges = vi.fn();
  const run = vi.fn((action: () => void) => action());
  const injector = Injector.create({ providers: [
    { provide: Router, useValue: { navigate } },
    { provide: ChangeDetectorRef, useValue: { detectChanges } },
    { provide: NgZone, useValue: { run } }
  ] });
  let values: Map<string, string>;
  let component: DashboardComponent;
  let session: SessionService;

  beforeEach(() => {
    vi.clearAllMocks();
    values = new Map([
      ['workshop_token', 'test-token'],
      ['workshop_user', JSON.stringify({ username: 'student', displayName: 'Student' })],
      ['workshop_preferences', '{"compact":true}']
    ]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, String(value)),
      removeItem: (key: string) => values.delete(key)
    });
    session = new SessionService();
    session.saveSession('test-token', { username: 'student', displayName: 'Student' }, session.readPreferences());
    component = new DashboardComponent(injector.get(Router), injector.get(ChangeDetectorRef), injector.get(NgZone), session, new TasksService());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('queries exact owner and Bearer, filters and labels tasks, and updates Angular', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [
      { title: 'low', status: 'TODO', priority: 'LOW', owner: 'student' },
      { title: 'archived', status: 'ARCHIVED', priority: 'HIGH' },
      { title: 'normal', status: 'DONE', priority: 'NORMAL' },
      { title: 'lowercase', status: 'archived', priority: 'HIGH' }
    ] });
    await component.ngOnInit();
    expect(axios.get).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=student', {
      headers: { Authorization: 'Bearer test-token' }
    });
    expect(component.tasks).toHaveLength(4);
    expect(component.visibleTasks.map((task) => task.title)).toEqual(['normal', 'low', 'lowercase']);
    expect(component.visibleTasks[1].label).toBe('LOW · STUDENT');
    expect(component.loading).toBe(false);
    expect(run).toHaveBeenCalledOnce();
    expect(detectChanges).toHaveBeenCalledOnce();
  });

  it('redirects without querying when token is absent', async () => {
    session.clearSession();
    await component.ngOnInit();
    expect(navigate).toHaveBeenCalledWith(['/login']);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('supports empty owner and list', async () => {
    session.saveSession('test-token', undefined, session.readPreferences());
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    await component.ngOnInit();
    expect(axios.get).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=', {
      headers: { Authorization: 'Bearer test-token' }
    });
    expect(component.visibleTasks).toEqual([]);
    expect(component.loading).toBe(false);
  });

  it.each([
    [{ response: { data: { detail: 'backend detail' } }, message: 'transport' }, 'backend detail'],
    [{ message: 'transport' }, 'transport'],
    [{}, 'No se pudo cargar el dashboard']
  ])('uses public errors without removing the session', async (error, _previousMessage) => {
    vi.mocked(axios.get).mockRejectedValue(error);
    await component.ngOnInit();
    expect(component.error).toBe('No se pudo cargar el dashboard. Intente nuevamente.');
    expect(component.loading).toBe(false);
    expect(session.readSession().token).toBe('test-token');
    expect(detectChanges).toHaveBeenCalledOnce();
  });

  it('logs out locally while preserving preferences', async () => {
    await component.logout();
    expect([...values.keys()]).toEqual(['workshop_preferences']);
    expect(navigate).toHaveBeenCalledWith(['/login']);
    expect(axios.get).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it.each([
    ['TODO', 'Por hacer'], ['in_progress', 'En progreso'], ['DONE', 'Completado'],
    ['RESUELTO', 'Resuelto'], ['COMPLETED', 'Completado'], ['OTHER', 'OTHER'], ['', '']
  ])('labels status %s', (status, expected) => {
    expect(component.statusLabel(status)).toBe(expected);
  });

  it.each([
    { name: 'backend unavailable', error: { code: 'ECONNREFUSED' } },
    { name: 'transport timeout rejection', error: { code: 'ECONNABORTED' } },
    { name: 'network or CORS rejection', error: { code: 'ERR_NETWORK' } },
    { name: 'invalid token HTTP 401', error: { response: { status: 401 } } },
    { name: 'forbidden token HTTP 403', error: { response: { status: 403 } } },
    { name: 'HTTP 404', error: { response: { status: 404 } } },
    { name: 'HTTP 500', error: { response: { status: 500 } } }
  ])('handles $name with a public error and released loading', async ({ error }) => {
    vi.mocked(axios.get).mockRejectedValueOnce(error);
    await component.ngOnInit();
    expect(component.error).toBe('No se pudo cargar el dashboard. Intente nuevamente.');
    expect(component.loading).toBe(false);
    expect(component.visibleTasks).toEqual([]);
    expect(session.readSession().token).toBe('test-token');
    expect(navigate).not.toHaveBeenCalled();
    expect(detectChanges).toHaveBeenCalledOnce();
    expect(axios.get).toHaveBeenCalledOnce();
  });

  it.each([
    { name: 'missing body', data: undefined },
    { name: 'null body', data: null },
    { name: 'empty response or HTTP 204', data: '' },
    { name: 'object envelope', data: { tasks: [] } },
    { name: 'malformed JSON text', data: '{' },
    { name: 'null array element', data: [null] },
    { name: 'undefined array element', data: [undefined] }
  ])('rejects $name without treating it as a valid empty list', async ({ data }) => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data });
    await component.ngOnInit();
    expect(component.error).toBe('No se pudo cargar el dashboard. Intente nuevamente.');
    expect(component.loading).toBe(false);
    expect(session.readSession().token).toBe('test-token');
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'empty list', data: [] },
    { name: 'only archived tasks', data: [{ title: 'Hidden', status: 'ARCHIVED' }] }
  ])('accepts $name without a public error', async ({ data }) => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data });
    await component.ngOnInit();
    expect(component.visibleTasks).toEqual([]);
    expect(component.error).toBe('');
    expect(component.loading).toBe(false);
  });

  it('keeps loading while HTTP is pending and clears it when the request resolves', async () => {
    let finish = () => {};
    const response = new Promise<{ data: [] }>((resolve) => {
      finish = () => resolve({ data: [] });
    });
    vi.mocked(axios.get).mockReturnValueOnce(response);
    const pending = component.ngOnInit();
    expect(component.loading).toBe(true);
    expect(component.error).toBe('');
    expect(detectChanges).not.toHaveBeenCalled();
    finish();
    await pending;
    expect(component.loading).toBe(false);
    expect(component.error).toBe('');
  });

  it('prepares optional task fields with label defaults without requiring new server fields', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: [{}] });
    await component.ngOnInit();
    expect(component.visibleTasks).toHaveLength(1);
    expect(component.visibleTasks[0].title).toBeUndefined();
    expect(component.visibleTasks[0].label).toContain('NORMAL');
    expect(component.visibleTasks[0].label).toContain('SIN-ASIGNAR');
    expect(component.error).toBe('');
    expect(component.loading).toBe(false);
  });

  it('REGRESSION H-01: reaches login after logout even when legacy storage cleanup is denied', async () => {
    vi.spyOn(localStorage, 'removeItem').mockImplementationOnce(() => {
      throw new DOMException('Storage unavailable', 'SecurityError');
    });
    await expect(component.logout()).resolves.toBeUndefined();
    expect(navigate).toHaveBeenCalledWith(['/login']);
    expect(session.readSession().token).toBeNull();
    expect(component.cleanupWarning).toBe('No se pudo completar la limpieza de datos de una sesion anterior en este navegador.');
  });

  it('keeps cleanup warning separate from task errors and visible after logout', async () => {
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new DOMException('Sensitive storage detail', 'SecurityError');
    });
    session.clearSession();
    session.saveSession('test-token', { username: 'student' }, session.readPreferences());
    vi.mocked(axios.get).mockRejectedValueOnce({ response: { status: 500 } });
    await component.ngOnInit();
    expect(component.error).toBe('No se pudo cargar el dashboard. Intente nuevamente.');
    expect(component.cleanupWarning).toBe('No se pudo completar la limpieza de datos de una sesion anterior en este navegador.');
    expect(component.cleanupWarning).not.toContain('Sensitive storage detail');
    await component.logout();
    expect(navigate).toHaveBeenCalledWith(['/login']);
    expect(component.cleanupWarning).toBe('No se pudo completar la limpieza de datos de una sesion anterior en este navegador.');
  });
});