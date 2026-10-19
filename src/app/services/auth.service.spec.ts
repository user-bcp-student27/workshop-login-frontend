import '@angular/compiler';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { TasksService } from './tasks.service';

describe('HTTP services with real axios and a local transport', () => {
  const original = { ...environment };
  const requests: { method?: string; url?: string; authorization?: string; body: string }[] = [];
  const server = createServer(async (request, response) => {
    request.setEncoding('utf8');
    let body = '';
    for await (const chunk of request) {
      body += chunk;
    }
    requests.push({ method: request.method, url: request.url, authorization: request.headers.authorization, body });
    if (request.url === '/timeout') {
      return;
    }
    response.setHeader('Content-Type', 'application/json');
    if (request.url?.startsWith('/reject')) {
      response.writeHead(401).end(JSON.stringify({ message: 'internal detail' }));
      return;
    }
    if (request.url === '/missing') {
      response.end('{}');
      return;
    }
    response.end(JSON.stringify(request.method === 'POST'
      ? { token: 'transport-token', user: { username: 'student' } }
      : [{ title: 'Transport task', status: 'TODO' }]));
  });
  let base: string;

  beforeAll(async () => {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected a local TCP address');
    }
    base = `http://127.0.0.1:${address.port}`;
  });

  afterEach(() => {
    Object.assign(environment, original);
    requests.length = 0;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it('sends original login JSON with no Authorization and consumes token/user', async () => {
    environment.loginUrl = base + '/auth/login';
    const result = await new AuthService().login(' student ', ' password ');
    expect(result).toEqual({ token: 'transport-token', user: { username: 'student' } });
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('POST');
    expect(requests[0].url).toBe('/auth/login');
    expect(requests[0].authorization).toBeUndefined();
    expect(JSON.parse(requests[0].body)).toEqual({ username: ' student ', password: ' password ', client: 'angular-workshop' });
  });

  it('sends GET owner verbatim with Bearer and no body', async () => {
    environment.tasksUrl = base + '/api/tasks';
    expect(await new TasksService().list('student&extra=value', 'transport-token')).toEqual([
      { title: 'Transport task', status: 'TODO' }
    ]);
    expect(requests[0]).toEqual({ method: 'GET', url: '/api/tasks?owner=student&extra=value', authorization: 'Bearer transport-token', body: '' });
  });

  it('preserves a successful response without token', async () => {
    environment.loginUrl = base + '/missing';
    expect(await new AuthService().login('student', 'password')).toEqual({});
  });

  it('rejects login HTTP errors', async () => {
    environment.loginUrl = base + '/reject';
    await expect(new AuthService().login('student', 'password')).rejects.toMatchObject({ response: { status: 401 } });
  });

  it('rejects tasks HTTP errors', async () => {
    environment.tasksUrl = base + '/reject';
    await expect(new TasksService().list('', 'token')).rejects.toMatchObject({ response: { status: 401 } });
  });

  it('enforces the configured login timeout using the actual adapter', async () => {
    environment.loginUrl = base + '/timeout';
    environment.loginTimeout = 30;
    await expect(new AuthService().login('student', 'password')).rejects.toMatchObject({ code: 'ECONNABORTED' });
  });

  it.each(['login', 'tasks'])('rejects a real unavailable backend for %s', async (endpoint) => {
    const unavailable = createServer();
    unavailable.listen(0, '127.0.0.1');
    await once(unavailable, 'listening');
    const address = unavailable.address();
    await new Promise<void>((resolve, reject) => unavailable.close((error) => error ? reject(error) : resolve()));
    if (!address || typeof address === 'string') {
      throw new Error('Expected a local TCP address');
    }
    const url = `http://127.0.0.1:${address.port}`;
    if (endpoint === 'login') {
      environment.loginUrl = url + '/auth/login';
      await expect(new AuthService().login('student', 'password')).rejects.toMatchObject({ code: 'ECONNREFUSED' });
      return;
    }
    environment.tasksUrl = url + '/api/tasks';
    await expect(new TasksService().list('student', 'token')).rejects.toMatchObject({ code: 'ECONNREFUSED' });
  });
});