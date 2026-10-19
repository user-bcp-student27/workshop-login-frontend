# Contrato HTTP del frontend actual

Actualizado el 2026-10-19 a partir del codigo del componente. Se describen las peticiones y expectativas reales del cliente, incluidos sus limites y defectos; no se presume que el backend implemente un contrato adicional. Esta actualizacion documental no ejecuta servicios externos ni modifica codigo.

Solo se consumen dos endpoints: POST `/auth/login` y GET `/api/tasks`. El flujo es login -> sesion compartida en memoria -> consulta de tareas -> logout local. No hay llamada HTTP de logout ni de renovacion del token.

Los ejemplos reproducen valores y estructuras de las pruebas del repositorio, no capturas de los servicios reales. Los tokens y claves de esos ejemplos son datos ficticios de prueba. Los tipos de las tablas proceden de las interfaces TypeScript: no constituyen validacion del JSON en runtime ni confirman obligatoriedad en el servidor.

Las URLs, client y timeout de login proceden de [src/environments/environment.ts:1](../src/environments/environment.ts#L1). Axios se usa sin sobreescribir validateStatus: acepta HTTP 200 a 299. Sus defaults actuales son Accept `application/json, text/plain, */*`, timeout 0 cuando no se configura y serializacion JSON de objetos. Verificado en la implementacion local instalada de axios 1.20.0; la version declarada esta en [package.json:20](../package.json#L20). Los headers que agrega el navegador, como Origin, no son campos configurados por estos servicios.

## POST /auth/login

### 1. Quien lo llama

LoginComponent.login(), al pulsar Ingresar, consume AuthService.login(username, password); AuthService realiza el POST a `http://localhost:8080/auth/login`. El componente no llama HTTP directamente.

Antes de enviar valida usuario y luego clave: rechaza null, undefined y cadenas vacias al aplicar trim. Esa comprobacion no recorta las credenciales enviadas. Con campos validos activa busy, deshabilita Ingresar y muestra el estado de ingreso hasta que termina la operacion.

Evidencia: [src/app/services/auth.service.ts:8](../src/app/services/auth.service.ts#L8), [src/app/login/login.component.ts:34](../src/app/login/login.component.ts#L34), [src/app/login/login.component.html:34](../src/app/login/login.component.html#L34).

### 2. Que envia

Metodo POST. Sin query params. Timeout configurado: **5000 ms**. No agrega Authorization ni configura withCredentials o renovacion de sesion.

| Ubicacion | Campo | Valor o tipo enviado | Origen y comportamiento |
|---|---|---|---|
| Destino HTTP | Host | `localhost:8080` | Autoridad de la URL configurada; el transporte genera el header. |
| Header | Accept | `application/json, text/plain, */*` | Default de axios, no asignado por AuthService. |
| Header | Content-Type | `application/json` | Axios serializa el objeto de request como JSON. |
| Header | Authorization | No se agrega | No se envia un Bearer desde este servicio. |
| Body JSON | username | string | Valor original del campo; no vacio tras trim para llegar a HTTP. |
| Body JSON | password | string | Valor original del campo; no vacio tras trim para llegar a HTTP. |
| Body JSON | client | `angular-workshop` | Constante environment.client, no un campo editable de la UI. |

Ejemplo de envio, con los espacios originales que la prueba de transporte comprueba que no se eliminan:

```http
POST /auth/login HTTP/1.1
Host: localhost:8080
Accept: application/json, text/plain, */*
Content-Type: application/json

{"username":" student ","password":" password ","client":"angular-workshop"}
```

Evidencia de campos y timeout: [src/app/models/api.models.ts:6](../src/app/models/api.models.ts#L6), [src/app/services/auth.service.ts:9](../src/app/services/auth.service.ts#L9). Ejemplo verificable: [src/app/services/auth.service.spec.ts:57](../src/app/services/auth.service.spec.ts#L57). Las pruebas usan un puerto efimero; el Host del ejemplo corresponde a la configuracion de la aplicacion.

### 3. Que espera recibir en exito

El transporte acepta **200-299**, no exclusivamente 200. El ejemplo del servidor local de pruebas responde **200 OK** con JSON; el componente no inspecciona response.status. Para considerar completo el login, ademas necesita response.data.token truthy. Un 2xx por si solo no autentica a la UI.

| Campo del body | Tipo esperado por el cliente | Necesidad y uso |
|---|---|---|
| token | string, opcional en LoginResponse | Necesario y truthy para guardar sesion y navegar. No se valida tipo, firma, formato ni caducidad en runtime. |
| user | objeto User, opcional | Se guarda en memoria. Si falta o es null, SessionService usa `{}`. |
| user.username | string, opcional | Se usa como owner de la consulta de tareas y como saludo si no hay displayName truthy. Si falta, owner es cadena vacia. |
| user.displayName | string, opcional | Nombre preferido para el saludo del dashboard; el fallback es username. |

Ejemplo de exito del servidor local de pruebas:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{"token":"transport-token","user":{"username":"student"}}
```

No es necesario que la respuesta incluya displayName para ese ejemplo. Content-Type es el utilizado por el servidor de pruebas; el codigo de la aplicacion no comprueba ese header de respuesta ni exige otros headers propios.

Con token aceptado, SessionService asigna token y usuario en memoria y escribe las preferencias en localStorage. Solo despues se solicita navegar a `/dashboard`. Si termina esa secuencia, finalmente busy vuelve a false; el componente actualiza Angular explicitamente.

Evidencia: [src/app/models/api.models.ts:1](../src/app/models/api.models.ts#L1), [src/app/models/api.models.ts:12](../src/app/models/api.models.ts#L12), [src/app/services/session.service.ts:24](../src/app/services/session.service.ts#L24), [src/app/login/login.component.ts:45](../src/app/login/login.component.ts#L45), [src/app/dashboard/dashboard.component.html:6](../src/app/dashboard/dashboard.component.html#L6). Ejemplo: [src/app/services/auth.service.spec.ts:29](../src/app/services/auth.service.spec.ts#L29), [src/app/services/auth.service.spec.ts:60](../src/app/services/auth.service.spec.ts#L60).

**Pregunta abierta:** que codigo exacto, campos obligatorios y headers promete el backend real. El cliente y sus fixtures no acreditan ese contrato remoto.

### 4. Como reacciona ante errores

El mensaje publico para excepciones es `No se pudo autenticar a <usuario>. Intente nuevamente.`. Se inserta el usuario del formulario, pero no error.response.data.message ni error.message. No hay reintento automatico.

| Caso | Peticion o tratamiento | Reaccion real de la UI y de la sesion |
|---|---|---|
| Usuario ausente o solo espacios | No envia HTTP; se evalua antes que la clave. | Muestra `Ingrese un usuario.` y no navega. |
| Clave ausente o solo espacios | No envia HTTP si el usuario ya es valido. | Muestra `Ingrese una contraseña.` y no navega. |
| Credenciales rechazadas, HTTP 401/403 | Axios rechaza el status; no existe rama especial para cada codigo. | Mensaje publico, busy=false, sin navegacion solicitada por esta respuesta y sin guardar una sesion nueva. No borra una sesion previa. |
| Otro status final fuera de 200-299, como 400 o 500 | Mismo catch. | Mismo mensaje publico y liberacion de busy; no muestra detalles del servidor. |
| Timeout de login, a los 5000 ms configurados | La promesa HTTP rechaza. | Mismo mensaje publico, busy=false y posibilidad de intentar de nuevo. |
| Red caida, conexion rechazada o CORS que impide completar la peticion | Si axios rechaza, se procesa igual que los demas errores. | Mismo mensaje publico; no distingue esas causas ni expone sus detalles. |
| 2xx con body vacio, `{}`, null, o sin token truthy, incluido un 204 vacio | El request puede resolver, pero falla la comprobacion de token. | Muestra `El backend respondió sin token.`, no guarda sesion ni solicita navegar; finally libera busy. |
| Token truthy pero invalido para el servidor, expirado o de tipo inesperado | El cliente no valida esos aspectos: puede guardarlo y solicitar dashboard. | No hay error local especifico; si tareas luego devuelve 401/403, se aplica la conducta del endpoint de tareas. |
| Otro body inesperado o JSON malformado | No hay validador de esquema. Un valor sin propiedad token util toma el camino sin token; una excepcion que alcance el try toma el catch. | Mensaje sin token o mensaje publico, respectivamente, y finally libera busy. No hay garantia de rechazo uniforme de todas las formas invalidas. |
| Falla escribir preferencias tras un token aceptado | saveSession asigna primero token/usuario en memoria y despues llama a setItem; la excepcion alcanza el catch de login. | Mensaje publico y busy=false; no solicita navegar, pero la sesion en memoria ya puede estar asignada. No hay rollback. |
| Router.navigate rechaza despues de guardar sesion | La excepcion alcanza el mismo catch. | Mensaje publico si la vista sigue activa, busy=false y sin rollback de sesion. Si navigate solo resuelve false, ese retorno se ignora y no se crea un error de autenticacion. |
| No puede acceder a localStorage al construir SessionService o borrar una clave antigua | SessionService vacia memoria e intenta borrar ambas claves de forma independiente, protegiendo tambien el acceso a localStorage. | Login se renderiza con sesion vacia y advertencia de limpieza incompleta; no muestra detalles sensibles ni afirma que se borraron claves. Esto no cambia el fallo posterior de setItem de preferencias si tambien esta bloqueado. |

Evidencia: [src/app/login/login.component.ts:34](../src/app/login/login.component.ts#L34), [src/app/services/session.service.ts:17](../src/app/services/session.service.ts#L17), [src/app/services/session.service.ts:29](../src/app/services/session.service.ts#L29), [src/app/services/session.service.ts:51](../src/app/services/session.service.ts#L51). Pruebas de error HTTP y timeout: [src/app/services/auth.service.spec.ts:81](../src/app/services/auth.service.spec.ts#L81), [src/app/services/auth.service.spec.ts:91](../src/app/services/auth.service.spec.ts#L91). El cierre del bloqueo de limpieza esta documentado en [HALLAZGOS.md](../HALLAZGOS.md).

### 5. Notas de seguridad relevantes

- Los mensajes usan interpolacion `{{ message }}`, no `[innerHTML]`. El usuario incluido en un error se muestra como texto literal, y los detalles internos del backend no se incorporan al mensaje.
- SessionService es el unico propietario de sesion y almacenamiento. Token y usuario no se escriben en localStorage/sessionStorage; viven en memoria del singleton raiz. Recargar, reiniciar la aplicacion o abrir otra pestana pierde la sesion, segun la aprobacion registrada en PLAN.md. Scripts activos del mismo origen siguen siendo un riesgo.
- Las preferencias permanecen en `workshop_preferences`; se cargan con JSON.parse y lodash/merge. Una lectura o parseo que falle devuelve defaults. La limpieza de legado tiene proteccion independiente; la escritura posterior de preferencias conserva su comportamiento y puede fallar.
- Al iniciar y al cerrar sesion se intenta borrar `workshop_token` y `workshop_user` antiguos. No se restauran para autenticar. Si falla cualquier clave, se intenta tambien la otra y se conserva cleanupFailed=true hasta una limpieza completa posterior.
- Login y dashboard muestran aparte de los errores HTTP: `No se pudo completar la limpieza de datos de una sesion anterior en este navegador.`. El aviso usa interpolacion y role status, no bloquea comandos, no incluye detalles del error y no promete borrado o revocacion. Leer sesion/preferencias o cambiar de vista no lo elimina.
- La URL actual es HTTP local. No hay implementacion cliente de firma, expiracion o refresh del token, ni un protocolo de cookies HttpOnly.

**Preguntas abiertas:** formato y vigencia del token, criterio del servidor para credenciales invalidas y politica CORS para el origen del frontend. No pueden determinarse desde este componente.

Evidencia: [src/app/login/login.component.html:39](../src/app/login/login.component.html#L39), [src/app/services/session.service.ts:12](../src/app/services/session.service.ts#L12), [src/app/services/session.service.ts:30](../src/app/services/session.service.ts#L30), [PLAN.md](../PLAN.md).

## GET /api/tasks

### 1. Quien lo llama

DashboardComponent.ngOnInit() lee la sesion de SessionService. Si hay token, consume TasksService.list(user.username || '', token); TasksService hace GET a `http://localhost:8000/api/tasks` con la query owner. Sin token solicita navegar a `/login` y no realiza HTTP, aunque se abra directamente `/dashboard`.

Mientras espera, loading=true hace visibles los indicadores de carga. Al completar el procesamiento o entrar al catch, loading pasa a false y NgZone/ChangeDetectorRef actualizan la vista. La consulta ocurre al inicializar el componente, no mediante polling ni un boton de reintento implementado en esa vista.

Evidencia: [src/app/dashboard/dashboard.component.ts:36](../src/app/dashboard/dashboard.component.ts#L36), [src/app/services/tasks.service.ts:8](../src/app/services/tasks.service.ts#L8), [src/app/dashboard/dashboard.component.html:12](../src/app/dashboard/dashboard.component.html#L12).

### 2. Que envia

Metodo GET. **Sin body** y sin timeout explicito en TasksService: aplica el default 0 de axios, sin limite finito de espera configurado por la aplicacion.

| Ubicacion | Campo | Valor o tipo enviado | Origen y comportamiento |
|---|---|---|---|
| Destino HTTP | Host | `localhost:8000` | Autoridad de environment.tasksUrl; lo genera el transporte. |
| Header | Accept | `application/json, text/plain, */*` | Default de axios. |
| Header | Authorization | `Bearer <token>` | Concatena Bearer, un espacio y el token de SessionService. No se valida su vigencia antes de enviarlo. |
| Header | Content-Type | No lo configura TasksService | No hay body que serializar; no se exige un header de contenido de request. |
| Query | owner | string | user.username o `''` si falta/es falsy. Se concatena a `?owner=` sin encodeURIComponent ni serializador de params. |
| Body | Ninguno | Ausente | No envia filtros ni datos JSON adicionales. |

Ejemplo verificado por la prueba del dashboard:

```http
GET /api/tasks?owner=student HTTP/1.1
Host: localhost:8000
Accept: application/json, text/plain, */*
Authorization: Bearer test-token
```

Si username falta, el destino termina literalmente en `?owner=`. Los caracteres especiales no se escapan en el servicio: la prueba de transporte comprueba que `student&extra=value` genera `?owner=student&extra=value`. Esto no define extra como parametro soportado; muestra el efecto actual de concatenar una entrada sin codificar.

Evidencia: [src/app/services/tasks.service.ts:8](../src/app/services/tasks.service.ts#L8), [src/app/dashboard/dashboard.component.spec.ts:52](../src/app/dashboard/dashboard.component.spec.ts#L52), [src/app/services/auth.service.spec.ts:68](../src/app/services/auth.service.spec.ts#L68).

### 3. Que espera recibir en exito

Axios acepta **200-299**. El ejemplo usa **200 OK** y JSON, como el servidor local de pruebas. El cliente no comprueba response.status; espera que response.data sea **un array plano de tareas**, no `{ tasks: [...] }` ni una pagina con metadatos.

| Campo del body | Tipo esperado por el cliente | Necesidad y uso |
|---|---|---|
| Raiz | Task[] | Lista requerida por prepareTasks, que invoca map. `[]` es un resultado valido. |
| [].title | string, opcional | Titulo visible de la tarjeta; si falta no se completa con otro campo. |
| [].description | string, opcional | Descripcion visible; no se inventa un valor si falta. |
| [].status | string, opcional | Filtra solo el valor exacto `ARCHIVED`; se usa tambien para el texto y la clase CSS del estado. |
| [].priority | string o number, opcional | Se utiliza para ordenar con comparacion de JavaScript y para la etiqueta. No hay escala semantica de prioridades. |
| [].owner | string, number o null, opcional | Solo etiqueta de tarea; no determina el header ni reemplaza owner de la query. |
| [].label | string, opcional en Task | No se requiere del servidor. Para tareas no archivadas el cliente lo calcula y reemplaza cualquier label recibido. |

Ejemplo de body exacto de la prueba del dashboard, presentado con status/header de exito del servidor de pruebas:

```http
HTTP/1.1 200 OK
Content-Type: application/json

[
	{"title":"low","status":"TODO","priority":"LOW","owner":"student"},
	{"title":"archived","status":"ARCHIVED","priority":"HIGH"},
	{"title":"normal","status":"DONE","priority":"NORMAL"},
	{"title":"lowercase","status":"archived","priority":"HIGH"}
]
```

No son obligatorios description u owner en todos los elementos para que ese ejemplo funcione. La UI muestra `normal`, `low`, `lowercase`, en ese orden; oculta `archived` porque su status es exactamente ARCHIVED, pero conserva la tarea cuyo status esta en minusculas.

prepareTasks crea una lista completa y otra visible sin mutar la respuesta original. Para las no archivadas calcula label con prioridad/propietario en mayusculas, o NORMAL/SIN-ASIGNAR si los valores son falsy. Ordena las visibles con el comportamiento de `left.priority > right.priority ? -1 : 1`; si alguna prioridad es undefined devuelve 1. No devuelve 0 para prioridades iguales. Una lista visible vacia muestra el mensaje de lista vacia en lugar de tarjetas.

Los estados se presentan con estas traducciones; la busqueda pasa el valor a mayusculas, pero el filtro de archivadas no lo hace:

| Valor consultado en mayusculas | Texto mostrado |
|---|---|
| TODO | Por hacer |
| IN_PROGRESS | En progreso |
| DONE | Completado |
| RESUELTO | Resuelto |
| COMPLETED | Completado |
| Otro valor | Status original sin traduccion |

Estos son valores que el frontend reconoce, no un catalogo de estados permitido por el backend.

Evidencia: [src/app/models/api.models.ts:17](../src/app/models/api.models.ts#L17), [src/app/utils/prepare-tasks.ts:5](../src/app/utils/prepare-tasks.ts#L5), [src/app/utils/legacy-format.ts:3](../src/app/utils/legacy-format.ts#L3), [src/environments/environment.ts:8](../src/environments/environment.ts#L8), [src/app/dashboard/dashboard.component.html:20](../src/app/dashboard/dashboard.component.html#L20). Ejemplo y orden: [src/app/dashboard/dashboard.component.spec.ts:44](../src/app/dashboard/dashboard.component.spec.ts#L44). Status/header del servidor de pruebas: [src/app/services/auth.service.spec.ts:22](../src/app/services/auth.service.spec.ts#L22).

**Preguntas abiertas:** si el backend siempre responde lista plana con 200, que campos garantiza, que tipos reales admite priority y cual es su catalogo de estados. La interfaz cliente no valida ni acredita esas reglas remotas.

### 4. Como reacciona ante errores

El mensaje publico para fallos capturados es `No se pudo cargar el dashboard. Intente nuevamente.`. La UI no utiliza error.response.data.detail ni error.message. El catch libera loading, oculta la grilla mediante el estado error y conserva la sesion. No hay reintento automatico.

| Caso | Peticion o tratamiento | Reaccion real de la UI y de la sesion |
|---|---|---|
| No hay token, incluida recarga/nueva pestana | No envia GET y solicita `/login`. | Sale del dashboard; no muestra un mensaje especifico de token ausente. El componente retorna antes de poner loading=false. |
| Token invalido/expirado o acceso rechazado con 401/403 | Axios rechaza y entra al catch general. | Mensaje publico y loading=false. Permanece en dashboard, no borra token/usuario, no renueva token ni redirige automaticamente. El boton Cerrar sesion sigue disponible. |
| Otro status final fuera de 200-299, como 404 o 500 | Mismo catch. | Mismo mensaje publico, sin mostrar detalle interno; no muestra tarjetas ni el mensaje de lista vacia mientras error sea truthy. |
| Red caida, conexion rechazada o CORS que provoca rechazo de axios | Mismo catch. | Mensaje publico, se retiran indicadores de carga y se conserva la sesion. |
| Servidor o conexion que no completa la respuesta | No hay timeout finito configurado; la promesa puede seguir pendiente. | loading puede permanecer true indefinidamente. No hay mensaje automatico de timeout ni boton de reintento; se puede intentar cerrar sesion. |
| Rechazo de transporte clasificado como timeout | No hay rama propia, aunque el transporte llegara a rechazar por esa causa. | Al rechazar, usa el mismo mensaje publico y loading=false; no equivale a un timeout de tareas programado por esta aplicacion. |
| 2xx con body vacio/204, null, objeto envoltorio o valor sin map | prepareTasks no recibe el array esperado y puede lanzar al invocar map. | La excepcion dentro del try se captura: mensaje publico y loading=false, no una lista vacia valida. |
| Array con un elemento null/undefined o un procesamiento que lanza | La lectura de status o el procesamiento dentro del try puede lanzar. | Si la excepcion alcanza ese try, mismo mensaje publico y loading=false. No se descarta de forma individual una tarea invalida. |
| Array vacio o solo tareas ARCHIVED | No es error de transporte ni procesamiento. | loading=false y mensaje de lista vacia, sin error publico. |
| Tarea incompleta o con tipos no previstos | No hay validacion runtime. Los campos opcionales pueden quedar vacios; la etiqueta usa defaults. Otros tipos pueden fallar durante el procesamiento o el renderizado. | No hay rechazo uniforme ni mensaje dedicado a esquema invalido. Los errores capturados por el try usan el mensaje publico; no se garantiza ese manejo para todo error de template gestionado por Angular. |
| Falla localStorage al construir el servicio de sesion | La limpieza captura el fallo de cada clave/acceso; la memoria queda vacia. | No aborta ngOnInit: sin token solicita login, donde se muestra la advertencia publica de limpieza incompleta. No envia GET ni restaura credenciales antiguas. |
| Falla limpiar claves al pulsar Cerrar sesion | clearSession vacia memoria, intenta ambas claves y registra el fallo sin propagarlo. | La limpieza ya no impide solicitar login. La advertencia sigue visible alli; preferencias se conservan y una clave no borrable puede quedar en disco. No se cambia el tratamiento de un rechazo independiente de Router.navigate. |

Cerrar sesion llama SessionService.clearSession() y despues Router.navigate('/login'). En el camino sin excepcion vacia token y usuario, elimina sus claves antiguas, conserva preferencias y vuelve al login. No cancela explicitamente una peticion de tareas ya iniciada ni llama a un endpoint de logout.

Evidencia: [src/app/dashboard/dashboard.component.ts:36](../src/app/dashboard/dashboard.component.ts#L36), [src/app/dashboard/dashboard.component.ts:53](../src/app/dashboard/dashboard.component.ts#L53), [src/app/dashboard/dashboard.component.ts:61](../src/app/dashboard/dashboard.component.ts#L61), [src/app/services/session.service.ts:40](../src/app/services/session.service.ts#L40), [src/app/dashboard/dashboard.component.html:12](../src/app/dashboard/dashboard.component.html#L12). Prueba de rechazo HTTP: [src/app/services/auth.service.spec.ts:86](../src/app/services/auth.service.spec.ts#L86).

### 5. Notas de seguridad relevantes

- El Bearer se obtiene de SessionService, no de localStorage. La falta de token local solo evita la peticion; el frontend no determina si ese token autoriza ver las tareas de owner. La autorizacion efectiva depende del servicio remoto y no puede confirmarse aqui.
- El propietario se concatena sin codificacion. Caracteres como `&` pueden alterar la query resultante; el contrato descrito conserva ese comportamiento actual, no lo recomienda.
- Titulo, descripcion, saludo y errores se muestran por interpolacion. No se usa innerHTML para esos datos; los detalles internos de errores remotos se omiten del mensaje publico.
- El cierre es exclusivamente local. No demuestra revocacion del token en servidor ni cierre de otras sesiones; otra pestana tiene su propia sesion en memoria. La URL de tareas tambien es HTTP local.
- La advertencia de limpieza incompleta no revela token/usuario ni el error interno. La sesion queda vacia aunque una clave antigua siga en disco; el aviso no declara borrado exitoso. La correccion y sus pruebas se siguen solo en HALLAZGOS.md.

**Preguntas abiertas:** politica CORS para Authorization y el origen del frontend; relacion que exige el backend entre Bearer y owner; respuesta exacta ante token invalido; vigencia y revocacion; limite de espera deseado para tareas. El codigo cliente no resuelve estas preguntas.

Evidencia: [src/app/services/tasks.service.ts:8](../src/app/services/tasks.service.ts#L8), [src/app/services/session.service.ts:20](../src/app/services/session.service.ts#L20), [src/app/dashboard/dashboard.component.html:6](../src/app/dashboard/dashboard.component.html#L6), [src/app/dashboard/dashboard.component.html:18](../src/app/dashboard/dashboard.component.html#L18), [HALLAZGOS.md](../HALLAZGOS.md).

## Documentos consultados

- Version anterior de este documento para contrastar flujo y contratos descritos.
- [PLAN.md](../PLAN.md), aprobacion de sesion en memoria y limites de los cambios autorizados.
- [HALLAZGOS.md](../HALLAZGOS.md), evidencia de la correccion de limpieza y seguimiento vigente.

Las referencias de cada apartado identifican tambien los servicios, modelos, componentes, templates, configuracion y pruebas consultados. Los defaults HTTP se contrastaron con el axios instalado dentro de este repositorio. No se leyeron otros componentes del workspace ni se verifico la implementacion de los backends.