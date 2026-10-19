# Pruebas de login y tareas

## Alcance

Ejecuciones del 2026-10-19, limitadas a este componente y al flujo de [docs/ENDPOINTS.md](ENDPOINTS.md). La tanda previa amplio cuatro specs sin tocar produccion; la correccion actual implementa solo H-01 y sus pruebas/avisos. No cambia contratos HTTP, dependencias ni gates. La meta de [REGLAS.md](../REGLAS.md) es >=85% del codigo modificado.

Resultado actual tras corregir el apartado activo H-01 de PLAN.md: **106 pruebas, 106 aprobadas y 0 fallidas; codigo de salida 0**. Las dos regresiones siguen activas, ahora verdes, sin skip, todo ni fails. Cobertura ejecutable: **100%** en lineas, funciones y sentencias; **98.64%** en ramas globales y **93.75%** en ramas de dashboard, por encima del gate de 85% por archivo. Las cifras de 99/97/2 mas abajo son ejecuciones historicas anteriores a la correccion, no el resultado actual.

H-01 agrega limpieza independiente/protegida y advertencia publica en ambas vistas. No cambia HTTP, escritura de preferencias, atomicidad de sesion, timeout de tareas, dependencias ni gates. El navegador se verifico con getter denegado y limpieza parcial: login renderiza, el flujo login -> tareas -> logout funciona y el aviso permanece visible sin detalles sensibles.

Las pruebas de componentes ejecutan metodos y comprueban el estado de UI, sesion y navegacion mediante dobles; no renderizan DOM real. Las de transporte usan axios real con un servidor efimero o un puerto local cerrado. No llaman a los backends del workspace. CORS se simula como rechazo de red, no se acredita una politica real de navegador/servidor.

## Matriz de casos

La columna resultado esperado describe el contrato o, donde se indica regresion, el objetivo de correccion de un bug conocido. La seccion de fallos separa lo esperado de lo que hace hoy el codigo.

| flujo | caso | tipo | resultado esperado |
|---|---|---|---|
| Login -> tareas -> logout | Credenciales validas y tareas disponibles | Camino feliz | Guardar sesion compartida, pedir tareas con owner/Bearer, poblar visibleTasks, liberar loading y volver a login al salir conservando preferencias. |
| Login HTTP | Credenciales con espacios no vacias | Camino feliz | Enviar valores originales, client angular-workshop y timeout 5000; no agregar Authorization. |
| Tareas HTTP | Consulta con owner y Bearer | Camino feliz | GET sin body, header y query exactos; consumir array plano. |
| Login | Usuario null, undefined, vacio o espacios | Caso borde | Priorizar validacion de usuario, mostrar mensaje y no enviar HTTP. |
| Login | Clave null, undefined, vacia o espacios | Caso borde | Con usuario valido, mostrar validacion y no enviar HTTP. |
| Login | Body undefined, null, vacio, objeto vacio, token vacio o texto JSON malformado | Caso borde | No establecer sesion ni navegar, mostrar respuesta sin token y liberar busy. |
| Tareas | No hay token | Caso borde | Solicitar login sin GET; no inventar un mensaje o logout remoto. |
| Tareas | Usuario ausente | Caso borde | Consultar con owner vacio y conservar el Bearer recibido. |
| Tareas | Lista vacia o solo ARCHIVED | Caso borde | No generar error; visibleTasks vacio y loading=false. |
| Tareas | Campos opcionales ausentes | Caso borde | Preparar la tarea sin exigir nuevos campos; usar NORMAL/SIN-ASIGNAR en etiqueta. |
| Tareas | Estados, prioridades iguales/ausentes y archivo exacto | Caso borde | Mantener traducciones y orden documentados; solo ARCHIVED exacto queda oculto. |
| Preferencias | Personalizacion parcial, false, cadena vacia, null, objeto anidado o JSON invalido | Caso borde | Conservar merge caracterizado o defaults cuando la lectura/parseo falla. |
| Sesion | Recrear servicio o logout normal | Caso borde | No restaurar token/usuario desde disco; conservar preferencias y quitar credenciales antiguas. |
| Login | Backend caido/conexion rechazada | Error | Error publico, busy=false y sin navegacion. Transporte real rechaza con ECONNREFUSED. |
| Tareas | Backend caido/conexion rechazada | Error | Error publico, loading=false, sesion conservada y sin redireccion. Transporte real rechaza con ECONNREFUSED. |
| Login | HTTP 400, 401, 403 o 500 | Error | Mensaje publico sin detalles, busy=false, sin sesion nueva ni reintento automatico. |
| Login | Timeout | Error | Rechazo de transporte y mensaje publico; busy=false. Se comprueba configuracion 5000 ms y adaptador real con limite reducido en el test. |
| Login y tareas | Rechazo de red/CORS simulado | Error | Aplicar el error publico correspondiente y liberar su indicador; no exponer detalle remoto. |
| Login -> tareas | Token aceptado en login y rechazado con 401 por tareas | Error | GET lleva ese token; dashboard muestra error y libera loading, sin borrar sesion ni inventar renovacion/redireccion automatica. |
| Tareas | HTTP 401/403, 404 o 500 | Error | Mensaje publico, loading=false y sesion conservada. |
| Tareas | Rechazo de transporte clasificado como timeout | Error | Mensaje publico y loading=false. Esto no prueba que exista un timeout finito configurado para tareas. |
| Tareas | Peticion todavia pendiente | Caso borde | loading=true mientras no termina; al resolver controladamente, liberar loading. No se afirma un limite maximo inexistente. |
| Tareas | Body undefined/null/vacio, envelope, texto malformado o elemento null/undefined | Error | Capturar fallo de procesamiento, mostrar error publico y liberar loading; no confundir con un array vacio valido. |
| Login | Fallo al escribir preferencias | Error | Verificar mensaje publico, busy=false y ausencia de navigate. La prueba no acredita rollback de la sesion; ver pendientes. |
| Login | Router rechaza o resuelve false | Error | Liberar busy; en rechazo mostrar error publico. No se declara corregida la atomicidad de sesion. |
| Preferencias | getItem rechaza despues de crear sesion | Error | Devolver defaults; la limpieza tiene su propia proteccion y advertencia. |
| Arranque de sesion | removeItem o getter lanza SecurityError | Error, regresion H-01 | Construir sesion vacia y renderizar login con aviso de limpieza incompleta. Ahora pasa. |
| Logout | removeItem lanza SecurityError | Error, regresion H-01 | Llegar a login tras vaciar memoria, intentar ambas claves y mantener aviso. Ahora pasa. |
| Limpieza | Falla solo una clave | Caso borde, H-01 | Intentar tambien la otra, no declarar exito parcial ni quitar advertencia al leer sesion/preferencias. |
| Limpieza | Intento posterior completamente exitoso | Caso borde, H-01 | Eliminar ambas claves, conservar preferencias y limpiar el estado de advertencia. |
| UI de sesion | Advertencia junto a error de login/tareas y al cambiar de vista | Error, H-01 | Texto publico literal separado del error, sin detalles sensibles y sin bloquear los comandos. |

## Codigo de los tests

Estos fragmentos son parte de los specs ejecutados, no pseudocodigo ni scripts autonomos. Los imports, Injector, mocks de Router/NgZone/ChangeDetectorRef, Map de almacenamiento y cleanup estan en los archivos enlazados. Ejecutar los archivos completos, no copiar fragmentos a un entorno sin fixtures.

### Camino feliz integrado

Fuente y fixtures: [src/app/login/login.component.spec.ts:150](../src/app/login/login.component.spec.ts#L150).

```typescript
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
```

### Bordes de validacion y respuesta

Fuente: [src/app/login/login.component.spec.ts](../src/app/login/login.component.spec.ts). Hay tambien cuatro casos equivalentes para password y seis cuerpos inesperados parametrizados en ese archivo.

```typescript
it.each([null, undefined, '', '   '])('rejects empty username %s before HTTP', async (username) => {
    component.username = username;
    await component.login();
    expect(component.message).toContain('Ingrese un usuario.');
    expect(axios.post).not.toHaveBeenCalled();
    expect(component.busy).toBe(false);
    expect(component.cleanupWarning).toBe('');
  });
```

```typescript
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
```

### Errores de la UI de login

Los codigos representan rechazos simulados. Fuente: [src/app/login/login.component.spec.ts:169](../src/app/login/login.component.spec.ts#L169).

```typescript
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
```

### Errores de tareas y token invalido

Fuente: [src/app/dashboard/dashboard.component.spec.ts:112](../src/app/dashboard/dashboard.component.spec.ts#L112). La integracion adicional login -> rechazo 401 se encuentra en [src/app/login/login.component.spec.ts:233](../src/app/login/login.component.spec.ts#L233).

```typescript
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
```

### Transporte real: backend caido y timeout

Fuente: [src/app/services/auth.service.spec.ts:91](../src/app/services/auth.service.spec.ts#L91). El puerto para backend caido se reserva y cierra dentro del test. El servidor de timeout recibe la peticion pero no responde, y se cierra al terminar la suite. Son recursos locales de prueba, no los componentes externos del workspace.

```typescript
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
```

```typescript
it('enforces the configured login timeout using the actual adapter', async () => {
    environment.loginUrl = base + '/timeout';
    environment.loginTimeout = 30;
    await expect(new AuthService().login('student', 'password')).rejects.toMatchObject({ code: 'ECONNABORTED' });
  });
```

El limite reducido de 30 ms solo acelera el test del adaptador y se restaura despues de cada caso. No se afirma haber esperado 5000 ms reales: el envio del valor 5000 se comprueba por separado en el spec de login. TasksService no recibe un timeout nuevo; su prueba de UI simula un rechazo de transporte, como permite el contrato.

### Regresiones H-01 conservadas, ahora verdes

No son caracterizaciones que acepten la excepcion como resultado correcto. Sus expectativas de continuidad se conservaron durante la correccion. La limpieza ahora captura cada fallo y expone cleanupFailed; ambos componentes muestran el texto compartido por interpolacion. Una advertencia no se quita por lectura o navegacion, solo por un intento completamente exitoso. No se afirma que se borraron claves inaccesibles.

Fuentes: [src/app/services/session.service.spec.ts:76](../src/app/services/session.service.spec.ts#L76) y [src/app/dashboard/dashboard.component.spec.ts:187](../src/app/dashboard/dashboard.component.spec.ts#L187). Limpieza parcial y getter denegado: [src/app/services/session.service.spec.ts:83](../src/app/services/session.service.spec.ts#L83). Advertencia en login: [src/app/login/login.component.spec.ts:252](../src/app/login/login.component.spec.ts#L252).

```typescript
it('REGRESSION H-01: initializes the memory session when legacy storage cleanup is denied', () => {
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new DOMException('Storage unavailable', 'SecurityError');
    });
    expect(() => new SessionService()).not.toThrow();
  });
```

```typescript
it('REGRESSION H-01: reaches login after logout even when legacy storage cleanup is denied', async () => {
    vi.spyOn(localStorage, 'removeItem').mockImplementationOnce(() => {
      throw new DOMException('Storage unavailable', 'SecurityError');
    });
    await expect(component.logout()).resolves.toBeUndefined();
    expect(navigate).toHaveBeenCalledWith(['/login']);
    expect(session.readSession().token).toBeNull();
    expect(component.cleanupWarning).toBe('No se pudo completar la limpieza de datos de una sesion anterior en este navegador.');
  });
```

## Comandos y resultados ejecutados

Directorio real de todas las ejecuciones: `C:\Users\Usuario\Documents\T09601-danny-mendoza-yenque\reqflow-workspace\workshop-login-frontend`. Fecha: 2026-10-19. Entorno observado: Windows, Node **v26.9.0**, Vitest **3.2.4**, cobertura V8. No se instalaron dependencias nuevas.

| Fase | Comando desde la raiz del componente | Codigo de salida | Resultado real |
|---|---|---|---|
| Login ampliado | `npm test -- src/app/login/login.component.spec.ts --reporter=dot` | 0 | 37/37 aprobadas. |
| Transporte ampliado | `npm test -- src/app/services/auth.service.spec.ts --reporter=dot` | 0 | 8/8 aprobadas; incluye ECONNREFUSED real para ambos endpoints y timeout real. |
| Base antes de agregar las dos regresiones | `npm run test:coverage -- --reporter=dot` | 0 | 97/97 aprobadas; 100% ejecutable medido. Es un resultado historico anterior a los dos tests rojos, no el resultado del estado final. |
| Regresiones y casos asociados | `npm test -- src/app/services/session.service.spec.ts src/app/dashboard/dashboard.component.spec.ts --reporter=dot` | 1 | 40 casos: 38 aprobados y 2 fallidos. |
| Suite final completa | `npm test -- --reporter=dot` | 1 | 99 casos: 97 aprobados y 2 fallidos, en seis archivos. |
| Suite final con cobertura y evidencia JSON | `npm run test:coverage -- --coverage.reportOnFailure --reporter=json --outputFile=docs/testing-results.json` | 1 | 99 casos, 97 aprobados, 2 fallidos, 0 pendientes, 0 todo; success=false. Cobertura ejecutable 100% en las cuatro metricas. |
| Tipado estricto final | `npm run test:types` | 0 | tsc termina sin diagnosticos para produccion y specs. |
| Entorno | `node -p "JSON.stringify({node:process.version,platform:process.platform})"` | 0 | node=v26.9.0, platform=win32. |
| H-01: antes de servicio | `npm test -- src/app/services/session.service.spec.ts src/app/dashboard/dashboard.component.spec.ts --reporter=dot` | 1 | 44 casos: 37 aprobados/7 fallidos. |
| H-01: despues de servicio | Mismo comando enfocado anterior | 0 | 44/44 aprobados. |
| H-01: antes de UI | `npm test -- src/app/login/login.component.spec.ts src/app/dashboard/dashboard.component.spec.ts --reporter=dot` | 1 | 73 casos: 65 aprobados/8 fallidos, con texto esperado exacto para evitar falsos positivos de undefined. |
| H-01: despues del item completo | `npm test -- src/app/services/session.service.spec.ts src/app/login/login.component.spec.ts src/app/dashboard/dashboard.component.spec.ts --reporter=dot` | 0 | 84/84 aprobados. |
| Actual: suite completa | `npm test -- --reporter=dot` | 0 | 106/106 aprobados en seis archivos, sin regresiones desactivadas. |
| Actual: cobertura y reporte | `npm run test:coverage -- --coverage.reportOnFailure --reporter=json --outputFile=docs/testing-results.json` | 0 | 106 aprobados, cero fallidos y success=true; 100% lineas/funciones/sentencias y 98.64% ramas globales. |
| Actual: tipos y compilacion | `npm run test:types` y, por separado, `npm run build` | 0 en ambos | Sin errores; build conserva warning CommonJS de lodash/merge. |

Las filas de 99/97/2 corresponden al historial previo a H-01. El reporte real actual esta en [docs/testing-results.json](testing-results.json), regenerado por Vitest con 106/106. `--coverage.reportOnFailure` solo permite emitir cobertura con fallos; no cambia resultados ni exit code. No se excluyeron regresiones ni se redujo el umbral.

Para reproducir el resultado final, desde ese directorio:

```powershell
npm test -- --reporter=dot
npm run test:coverage -- --coverage.reportOnFailure --reporter=json --outputFile=docs/testing-results.json
npm run test:types
```

Leer el codigo de salida de cada comando por separado; no interpretar el 0 del ultimo tsc como aprobacion de los anteriores.

### Cobertura

El gate existente de [vitest.config.ts:12](../vitest.config.ts#L12) exige >=85% por archivo en lineas, ramas, funciones y sentencias. El reporte actual mide 100% de lineas/funciones/sentencias y 98.64% de ramas globales. El minimo ejecutable por archivo en ramas es dashboard, 93.75%; SessionService alcanza 100% en todas las metricas. Las interfaces no emiten codigo; su fila 0 no representa lineas sin probar.

Los artefactos locales de cobertura se generan en coverage, incluido coverage-summary.json. Los specs y los archivos de arranque/rutas no modificados siguen excluidos segun la configuracion previa; no se agregaron exclusiones. Esta metrica por si sola no acredita correccion; el cierre de H-01 se apoya tambien en regresiones verdes y navegador.

## Fallos anteriores de H-01 y resultado despues de corregirlos

| Prueba | Esperado por la regresion | Resultado observado | Evidencia de produccion |
|---|---|---|---|
| Inicio de sesion con limpieza denegada | Construir el servicio sin abortar el arranque. | Antes: SecurityError no capturado. Ahora: regresion verde, login visible con aviso. | [src/app/services/session.service.ts:51](../src/app/services/session.service.ts#L51) protege cada clave y el getter; [src/app/login/login.component.html:40](../src/app/login/login.component.html#L40) muestra aviso. |
| Logout con limpieza denegada | Completar cierre en memoria y solicitar login. | Antes: promesa rechazada antes de navigate. Ahora: regresion verde y navegador vuelve a login manteniendo aviso. | [src/app/dashboard/dashboard.component.ts:62](../src/app/dashboard/dashboard.component.ts#L62), [src/app/services/session.service.ts:51](../src/app/services/session.service.ts#L51) y [src/app/dashboard/dashboard.component.html:19](../src/app/dashboard/dashboard.component.html#L19). |

Ambos fallos se corrigieron implementando unicamente H-01; el seguimiento y la nota de resolucion estan en [HALLAZGOS.md](../HALLAZGOS.md). Las regresiones no se cambiaron a toThrow ni se ocultaron con it.fails/it.skip. Se agregaron expectativas exactas de advertencia, limpieza parcial y getter denegado.

Navegador ejecutado despues de la correccion: getter de almacenamiento denegado no bloquea login; con solo workshop_token no borrable se elimina workshop_user, se conserva la clave bloqueada y las preferencias, y login -> tareas -> logout funciona. El aviso publico permanece en ambas vistas, sin detalles sensibles ni errores de pagina; a 390 px no hay overflow horizontal. Se usaron APIs simuladas y se cerraron las pestañas aisladas; no se verificaron backends reales.

## Pendientes

- No quedan fallos de H-01 en la suite actual. La limpieza inaccesible puede dejar una clave antigua en disco; el aviso lo comunica sin restaurarla para autenticar ni prometer revocacion remota.
- Resolver la politica de atomicidad si falla guardar preferencias o navegar: el codigo asigna token/usuario antes de esas operaciones y no hace rollback. La prueba de error de preferencias solo verifica mensaje, busy y ausencia de navigate, no certifica consistencia de sesion. Esta observacion procede de [src/app/services/session.service.ts:24](../src/app/services/session.service.ts#L24) y de [src/app/login/login.component.ts:51](../src/app/login/login.component.ts#L51), no de una supuesta correccion.
- Tareas no tiene timeout finito configurado. La prueba de peticion pendiente no promete recuperacion automatica ni un limite inexistente. Definir ese limite es una pregunta abierta de ENDPOINTS, no un flujo que estos tests puedan inventar.
- No se ejecutaron en esta tarea los backends reales, un lector de pantalla, CORS real ni pruebas DOM de todos los tipos de respuesta malformada. La comprobacion de template sin innerHTML es estatica y las verificaciones de mensajes en Node no sustituyen renderizado en navegador.

## Pruebas propuestas, no ejecutadas

- Las aserciones de almacenamiento fallido y notificacion antes propuestas ya se implementaron para H-01 y se ejecutaron con resultado verde; no se consideran propuestas pendientes. Las siguientes comprobaciones siguen fuera de su alcance.
- Cuando se decida atomicidad de sesion, probar el invariante elegido para errores de preferencias y navegacion. No escribir como contrato un rollback o un login exitoso sin persistir preferencias mientras esa decision siga abierta.
- Si se aprueba un timeout de tareas, usar reloj/control de transporte para probar su limite y la salida de loading. No exigir 5000 ms a tareas por analogia con login.
- Con servicios o fixtures de navegador autorizados, automatizar DOM y anuncios accesibles de mensajes, rechazo CORS real y errores de template por tipos invalidos, despues de definir las expectativas que el contrato deja abiertas.

No hay tests propuestos presentados como aprobados ni tests pendientes omitidos mediante skip. Los 0 pending/todo del reporte describen los tests registrados; no significan que estas decisiones o comprobaciones externas esten resueltas.

## Documentos consultados

- [docs/ENDPOINTS.md](ENDPOINTS.md): flujo y respuestas/errores permitidos, incluidos defectos actuales.
- [REGLAS.md](../REGLAS.md): meta >=85%, gates y cambios incrementales.
- [HALLAZGOS.md](../HALLAZGOS.md): seguimiento de H-01 y evidencia de la regresion de almacenamiento.

Tambien se contrastaron los seis specs existentes, componentes de login/dashboard, SessionService, AuthService, TasksService y la configuracion de Vitest. No se leyeron otros componentes del workspace.