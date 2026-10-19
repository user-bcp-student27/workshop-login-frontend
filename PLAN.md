# Plan de correccion del backlog actual

Propuesta del 2026-10-19. Seleccion expresa del usuario: **solo H-01**, actualmente Pendiente en [HALLAZGOS.md](HALLAZGOS.md). No se modifican codigo, tests, contratos ni estados en esta tarea. Este nuevo alcance requiere aprobacion humana antes de implementarse; la aprobacion del plan anterior se conserva como historial y no aprueba automaticamente esta propuesta.

## Item: H-01 - Arranque y logout bloqueados por limpieza de almacenamiento

### Item y problema

Corresponde a H-01, severidad alta, reabierto en [HALLAZGOS.md](HALLAZGOS.md). Token y usuario ya viven en memoria: no hay que repetir su migracion. El defecto pendiente es que SessionService llama clearSession en el constructor y removeItem puede lanzar antes de renderizar login. La misma excepcion impide llegar a Router.navigate al cerrar sesion.

Evidencia: [src/app/services/session.service.ts:16](src/app/services/session.service.ts#L16), [src/app/services/session.service.ts:40](src/app/services/session.service.ts#L40), [src/app/services/session.service.ts:43](src/app/services/session.service.ts#L43) y [src/app/dashboard/dashboard.component.ts:61](src/app/dashboard/dashboard.component.ts#L61). Las dos regresiones activas estan en [src/app/services/session.service.spec.ts:75](src/app/services/session.service.spec.ts#L75) y [src/app/dashboard/dashboard.component.spec.ts:187](src/app/dashboard/dashboard.component.spec.ts#L187).

### Alcance propio y limites

- Corregir exclusivamente la limpieza de las claves antiguas de token/usuario durante arranque y logout, incluida su notificacion. Mantener memoria vacia al iniciar y al salir aunque no sea posible acceder al almacenamiento.
- No restaurar token/usuario desde disco, no moverlos a sessionStorage ni agregar cookies, renovacion o revocacion remota. Conservar preferencias persistentes y la perdida de sesion al recargar, ya aprobadas.
- No corregir atomicidad del login: saveSession y sus errores al guardar preferencias o navegar conservan su comportamiento actual. No incluir cambios de dependencias, CI, timeout de tareas, esquema remoto, owner, comparador ni mejoras generales de accesibilidad.
- Conservar los mensajes publicos de autenticacion/tareas y los indicadores busy/loading. La unica UI nueva es la advertencia necesaria para no ocultar que fallo la limpieza de legado.
- No agregar archivos de produccion ni dependencias si los archivos existentes pueden alojar esa correccion.

### Cambio propuesto

1. Separar en SessionService el vaciado de token/usuario en memoria del intento de borrar sus claves antiguas. Constructor y clearSession reutilizan la misma operacion; no duplicar bloques ni claves en los componentes.
2. Intentar borrar cada clave de forma independiente, con control de excepciones que incluya el acceso a localStorage. Si falla la primera, intentar tambien la segunda. Mantener el control de flujo plano y usar unknown si se necesita recibir un error.
3. Una excepcion de limpieza no se propaga para bloquear la construccion del servicio o la navegacion de logout. No silenciarla: almacenar un estado tipado que indique limpieza incompleta. No registrar tokens, usuarios, preferencias ni detalles sensibles de errores.
4. Exponer ese estado a login y dashboard y mostrar una advertencia publica mediante interpolacion textual, por ejemplo: "No se pudo completar la limpieza de datos de una sesion anterior en este navegador." Centralizar el texto para no duplicarlo. No usar innerHTML ni presentar la sesion antigua como restaurada o revocada.
5. Mantener la advertencia mientras no se haya confirmado una limpieza completa en un intento posterior. Una navegacion o una limpieza parcial no se considera exito. No agregar reintentos automaticos, timers ni un nuevo flujo HTTP.
6. Los componentes siguen coordinando UI y navegacion; no acceden directamente al almacenamiento. Con memoria vacia, logout puede solicitar login aunque el borrado en disco haya fallado. Un rechazo de Router.navigate no cambia de politica como efecto lateral de este item.

### Archivos a tocar al implementar

| Archivo existente | Cambio limitado a H-01 |
|---|---|
| [src/app/services/session.service.ts](src/app/services/session.service.ts) | Limpieza independiente/protegida, vaciado de memoria y estado tipado de advertencia. |
| [src/app/services/session.service.spec.ts](src/app/services/session.service.spec.ts) | Conservar la regresion de constructor y probar fallo de una o ambas claves, acceso denegado y advertencia de limpieza parcial. |
| [src/app/dashboard/dashboard.component.spec.ts](src/app/dashboard/dashboard.component.spec.ts) | Conservar la regresion de logout y comprobar navegacion, sesion vacia y advertencia sin borrar preferencias. |
| [src/app/login/login.component.spec.ts](src/app/login/login.component.spec.ts) | Prueba de renderizado/estado de advertencia al iniciar y al volver desde logout; preservar los casos de login y errores actuales. |
| [src/app/login/login.component.ts](src/app/login/login.component.ts), [src/app/dashboard/dashboard.component.ts](src/app/dashboard/dashboard.component.ts) | Consumir y exponer solo el estado de advertencia si la vinculacion de las vistas lo requiere. No introducir HTTP ni almacenamiento directo. |
| [src/app/login/login.component.html](src/app/login/login.component.html), [src/app/dashboard/dashboard.component.html](src/app/dashboard/dashboard.component.html) | Advertencia textual de limpieza fallida, distinguible del error de autenticacion/tareas y sin bloquear comandos. |
| [src/environments/environment.ts](src/environments/environment.ts) | Solo si hace falta alojar el texto compartido en la configuracion ya existente; no variar URLs, client, timeout ni rutas. |
| [docs/ENDPOINTS.md](docs/ENDPOINTS.md), [docs/TESTING.md](docs/TESTING.md) | Actualizar unicamente el resultado de los errores de limpieza y su evidencia despues de corregir/verificar H-01. |
| [HALLAZGOS.md](HALLAZGOS.md) | Registrar la correccion y cambiar H-01 a Resuelto solo al cumplir las verificaciones; no alterar otros estados. |
| [docs/testing-results.json](docs/testing-results.json) | Regenerar con el comando real de pruebas; no editar resultados a mano. |

### Pruebas antes de tocar produccion

Primero ejecutar, sin cambiar expectativas, las dos regresiones existentes. El ultimo reporte conocido registra 99 pruebas: 97 aprobadas y dos fallidas por SecurityError; es evidencia previa, no una ejecucion de esta propuesta.

Antes de implementar, ampliar los specs para cubrir:

1. Constructor con removeItem rechazado para ambas claves: no debe lanzar, la sesion debe quedar vacia y el estado de limpieza debe indicar fallo. Mantener el test actual not.toThrow, sin skip, fails ni cambio a toThrow para aceptar el bug.
2. Logout con fallo en la primera clave: se intenta la segunda; se vacia token/usuario en memoria, se conservan preferencias y se solicita login. Mantener la regresion existente que exige que logout resuelva.
3. Fallo al acceder a localStorage, no solo al ejecutar removeItem: no debe bloquear la inicializacion ni eliminar la advertencia del estado de sesion.
4. Limpieza parcial: no declarar exito ni quitar advertencia por borrar una sola clave. Un intento posterior donde ambas se borran puede confirmar exito; comprobar que el mero cambio de vista no lo hace.
5. Camino sin fallo: borrar ambas claves antiguas, mantener preferencias y no mostrar advertencia. Conservar sesion en memoria y sus pruebas de recreacion, owner/Bearer y flujo normal.
6. Advertencia visible al arrancar y al llegar a login tras logout: texto literal, sin informacion sensible, sin innerHTML y sin ocultar el error de autenticacion/tareas. Si la infraestructura Node no renderiza DOM, comprobar estado en Vitest y ejecutar el renderizado con navegador disponible, registrandolo aparte; no afirmar una prueba DOM a partir de un mock.
7. No ampliar accidentalmente el tratamiento de escritura de preferencias ni errores de navegacion. Sus pruebas actuales permanecen y no se modifica la sesion para introducir rollback sin otro item aprobado.

### Contrato que se preserva

No hay cambios HTTP: POST `/auth/login` a localhost:8080 con username/password originales, client angular-workshop y timeout 5000 ms, sin Bearer; GET `/api/tasks` a localhost:8000 con owner concatenado y Authorization Bearer, sin nuevo timeout. Se conservan estados aceptados 200-299, respuesta sin token, filtrado/orden de tareas y tratamiento de 401/403 documentados.

H-01 pide explicitamente corregir dos defectos locales descritos en ENDPOINTS: pantalla vacia al limpiar en el constructor y logout rechazado antes de navegar. Solo esos casos pasan a continuidad del flujo con advertencia de limpieza incompleta. Actualizar esas filas al implementar y verificar; no editar el contrato ahora ni presentar esta excepcion como un cambio de endpoint. Preservar las demas conductas, incluidas las limitaciones de atomicidad y de almacenamiento de preferencias.

### Verificacion y cierre futuros

Desde la raiz del componente, ejecutar primero las pruebas enfocadas de sesion/dashboard/login; despues `npm test`, `npm run test:types`, `npm run build` y `npm run test:coverage -- --coverage.reportOnFailure --reporter=json --outputFile=docs/testing-results.json`.

Requerir que las dos regresiones de H-01 pasen sin ser desactivadas, que no haya nuevos fallos y que la cobertura del codigo tocado alcance >=85% en las metricas y gates existentes. Verificar en navegador el arranque y logout con almacenamiento denegado, el aviso visible y el camino feliz con APIs simuladas dentro del componente. No usar otros componentes del workspace ni atribuir resultados del backend real a mocks.

La aprobacion de esta propuesta, sus pruebas y la confirmacion del aviso son previas al cierre. Las alertas de dependencias y los otros items no seleccionados no quedan resueltos por este cambio. Este documento no ejecuta pruebas ni implementa la correccion.

## Historial del plan anterior

Se conserva a continuacion el plan inicial y su aprobacion humana del 2026-10-19, para no borrar el registro solicitado por el usuario. Sus alcances H-01 a H-09 describen la tanda anterior y **no forman parte de la propuesta activa de este archivo**. Las referencias y estados de aquella tanda son historicos; prevalece HALLAZGOS.md para el estado actual. Este historial no extiende la aprobacion a la nueva politica de limpieza/advertencia.

<details>
<summary>Plan inicial y aprobacion, conservados como historial</summary>

# Plan de correccion del frontend (historico)

## Aprobacion humana

- Aprobador: usuario solicitante de esta conversacion, por instruccion expresa ("registra como aprobador a mi").
- Fecha: 2026-10-19.
- Alcance aprobado: implementar las correcciones previstas para todos los hallazgos encontrados, H-01 a H-09, con pruebas de caracterizacion antes de modificar produccion, sin ampliar el ambito del repositorio ni introducir cambios ajenos al plan.
- Decision funcional H-01 aprobada expresamente: mantener token y usuario solo en memoria de SessionService; aceptar la perdida de sesion al recargar, reiniciar la aplicacion o abrir una nueva pestana. Conservar preferencias persistentes y limpiar las claves antiguas de token/usuario. Conservar los endpoints, cuerpos y cabecera Bearer; no agregar cookies ni endpoints de sesion.
- Se autoriza actualizar el contrato de persistencia en docs/ENDPOINTS.md junto con esa implementacion y sus pruebas. Esta es la excepcion aprobada a la persistencia original, no una autorizacion para cambiar el contrato HTTP.
- Esta aprobacion satisface las condiciones de aprobacion previa de H-01 mencionadas mas adelante. No declara hallazgos resueltos, no acredita pruebas ejecutadas ni autoriza cambios que muevan secretos al frontend. El riesgo de scripts activos en el mismo origen sigue existiendo aun con almacenamiento en memoria.

## Alcance y seleccion

Se incluyen H-01 a H-09, todos seleccionados por el usuario y actualmente Pendiente en [HALLAZGOS.md](HALLAZGOS.md). Este plan cuenta con la aprobacion humana registrada arriba; el registro por si solo no modifica codigo, dependencias, contratos ni estados. El seguimiento sigue exclusivamente en esa matriz.

Fuentes: [docs/ENDPOINTS.md](docs/ENDPOINTS.md), [docs/GOOD_PRACTICES.md](docs/GOOD_PRACTICES.md) y [REGLAS.md](REGLAS.md). Los nombres de archivos nuevos indicados abajo son propuestas, no convenciones adicionales atribuidas al repositorio. Reutilizar cada archivo compartido entre hallazgos; no crear un servicio distinto por cada fila.

Motivos de seleccion:

| ID | Motivo |
|---|---|
| H-01 | Prioridad alta por persistencia y acceso al token desde JavaScript; requiere resolver una decision funcional antes de sustituir el almacenamiento. |
| H-02 | Riesgo confirmado de interpretar HTML dinamico; cambio de presentacion acotado. |
| H-03 | Axios participa en ambos endpoints; evaluar seguridad sin romper su contrato. |
| H-04 | Uso de lodash limitado a preferencias; candidato acotado a sustitucion nativa si las pruebas lo permiten. |
| H-05 | Separar responsabilidades permite corregir sesion, configuracion y pruebas sin duplicar soluciones. |
| H-06 | Tipar los limites HTTP y el estado reduce errores al extraer servicios. |
| H-07 | Las pruebas de caracterizacion son requisito previo de las demas refactorizaciones. |
| H-08 | Simplificar login facilita verificar validaciones y liberacion de busy. |
| H-09 | Centralizar las claves evita lecturas, escrituras y borrados inconsistentes. |

## Contrato y limites comunes

- Conservar POST `http://localhost:8080/auth/login`, cuerpo `{ username, password, client: 'angular-workshop' }`, timeout de 5000 ms y ausencia de Authorization en login. Validar con trim sin recortar los valores enviados.
- Conservar GET `http://localhost:8000/api/tasks?owner=` seguido del propietario actual y cabecera `Authorization: Bearer <token>`. No introducir codificacion distinta, cuerpo, timeout nuevo, refresh, cookies, interceptor o endpoint adicional como efecto lateral del refactor.
- Conservar respuesta de login basada en token/user y respuesta de tareas como lista. No inventar campos obligatorios ni formatos adicionales a partir de tipos TypeScript.
- Conservar rutas, redireccion sin token, filtrado exacto de ARCHIVED, etiquetas, traducciones de estado, comparador de prioridades y actualizacion de loading. No aprovechar estos cambios para corregir el comparador o la codificacion del propietario.
- Caracterizar primero las claves actuales, persistencia entre recargas y orden de escrituras antes de navegar. En la implementacion de H-01, aplicar la excepcion aprobada: token/usuario en memoria y limpieza de sus claves antiguas; conservar preferencias persistentes y logout local sin llamadas de revocacion.
- H-02 propone cambiar deliberadamente la representacion del mensaje y ocultar detalles internos, no las peticiones HTTP ni el resultado del flujo. Caracterizar primero la precedencia actual de errores de login y tareas; los nuevos mensajes seguros son pruebas de aceptacion de la remediacion, no comportamiento actual.
- H-01 cuenta con aprobacion funcional expresa para cambiar persistencia segun el registro anterior. Actualizar y verificar ese contrato junto con la implementacion; mantener intacto el contrato HTTP y no considerar eliminado el riesgo de scripts activos en el origen.
- Las entradas corruptas, validaciones de esquema nuevas o cambios del manejo de 401/403 requieren pruebas y decision explicita; no incorporarlos silenciosamente en una extraccion de servicios.

Riesgos funcionales comunes: perder el token o el propietario, navegar antes de persistir, borrar preferencias al salir, variar el orden de tareas, ocultar errores sin liberar busy/loading o perder actualizaciones de UI al retirar NgZone/ChangeDetectorRef. Preservar estos ultimos hasta tener evidencia en navegador que permita cambiarlos.

## H-01: Token en localStorage

**Hallazgo y problema.** H-01, severidad alta. El token se guarda en [src/app/login/login.component.ts:47](src/app/login/login.component.ts#L47) y se recupera para la cabecera en [src/app/dashboard/dashboard.component.ts:36](src/app/dashboard/dashboard.component.ts#L36). Persiste entre sesiones y cualquier script del mismo origen puede leerlo. No hay explotacion demostrada.

**Cambio propuesto.** Primero encapsular token y usuario en un unico SessionService, compartido con H-05/H-09, sin variar almacenamiento ni claves. Esto reduce acoplamiento, pero no corrige la exposicion del token y no basta para cerrar H-01. Como alternativa acotada al laboratorio, proponer token y usuario solo en memoria de ese servicio: conserva POST, GET y Bearer, pero una recarga o nueva pestana pierde la sesion. Requiere aprobacion previa de ese cambio funcional; mientras no exista, no implementarlo. No proponer sessionStorage como solucion contra acceso JavaScript, ni cookies HttpOnly sin soporte del backend. La memoria tampoco elimina el riesgo de scripts activos en el origen.

**Archivos a tocar en una implementacion posterior.** [src/app/login/login.component.ts](src/app/login/login.component.ts), [src/app/dashboard/dashboard.component.ts](src/app/dashboard/dashboard.component.ts); nuevos propuestos `src/app/services/session.service.ts` y `src/app/services/session.service.spec.ts`. Usar tambien los specs de componentes propuestos en H-07. Solo si se aprueba la alternativa, acordar una revision posterior del contrato de persistencia; no editar ahora [docs/ENDPOINTS.md](docs/ENDPOINTS.md).

**Prueba de caracterizacion antes de tocar produccion.** Comprobar escrituras token/usuario/preferencias y su orden antes de navegar, lectura de una sesion tras recrear el componente, GET con Bearer, ausencia de GET sin token y logout que preserva preferencias. Si se aprueba memoria, agregar antes de implementarla pruebas de aceptacion distintas: sesion compartida entre componentes de la misma aplicacion, ausencia de token/usuario en almacenamiento persistente, limpieza de claves antiguas y perdida de sesion al reiniciar la aplicacion. No presentar estas ultimas como caracterizacion del estado actual.

## H-02: Mensaje con innerHTML

**Hallazgo y problema.** H-02, severidad media. [src/app/login/login.component.ts:56](src/app/login/login.component.ts#L56) concatena usuario y error externo; [src/app/login/login.component.html:39](src/app/login/login.component.html#L39) interpreta el resultado como HTML. Angular sanitiza el binding: no se afirma XSS ejecutable.

**Cambio propuesto.** Sustituir innerHTML por interpolacion textual y eliminar etiquetas HTML de los mensajes construidos. Conservar mensajes de validacion y respuesta sin token como texto. Para fallos HTTP, usar mensajes publicos consistentes de autenticacion y carga de tareas, sin concatenar detalles internos del backend. Compartir un resolvedor de errores pequeno solo si evita duplicacion real; recibir errores como unknown y distinguirlos sin any. Mantener el estado de carga y las decisiones de navegacion. No usar bypassSecurityTrustHtml ni agregar un sanitizador si el mensaje solo necesita texto.

**Archivos a tocar.** [src/app/login/login.component.ts](src/app/login/login.component.ts), [src/app/login/login.component.html](src/app/login/login.component.html), [src/app/dashboard/dashboard.component.ts](src/app/dashboard/dashboard.component.ts) para coherencia de errores publicos. Nuevos specs de componentes de H-07; proponer `src/app/utils/user-error.ts` y su spec solo si la implementacion necesita una politica compartida.

**Prueba de caracterizacion antes de tocar produccion.** Registrar validacion vacia, respuesta sin token, precedencia actual message/detail y fallback, no navegacion ante fallo y liberacion de busy/loading. Verificar el enlace actual en plantilla sin afirmar ejecucion de scripts. Luego escribir una prueba de aceptacion inicialmente fallida que renderice usuario con marcado inofensivo como texto literal, sin elementos inyectados, y que no muestre detalles internos del backend. Separar estas expectativas nuevas de las pruebas que preservan HTTP. La comprobacion de DOM requiere el medio de navegador descrito en H-07.

## H-03: Axios 0.31.0

**Hallazgo y problema.** H-03, severidad media. Version declarada en [package.json:19](package.json#L19), usada en ambos componentes. No hay una CVE ni su aplicabilidad acreditadas por esta revision.

**Cambio propuesto.** Antes de elegir version, registrar version resuelta, resultado real de `npm run audit:workshop` y avisos verificables del paquete, distinguiendo dependencias directas/transitivas y errores de consulta. No interpretar un fallo del registro como ausencia de vulnerabilidades. Mantener inicialmente axios al extraer los servicios de H-05; despues actualizarlo solo a una version disponible, compatible y contrastada contra avisos conocidos. Evaluar HttpClient ya disponible en Angular como alternativa si evita dependencia y supera las mismas pruebas, sin mezclar ambos cambios en una sola entrega ni asumir equivalencia de errores, timeout o query. No usar `npm audit fix --force` ni bajar gates.

**Archivos a tocar.** [package.json](package.json), [package-lock.json](package-lock.json) al actualizar; los servicios AuthService/TasksService y sus specs propuestos en H-05. Solo si la alternativa HttpClient resulta seleccionada, [src/main.ts](src/main.ts) para su proveedor. Los componentes no vuelven a contener HTTP.

**Prueba de caracterizacion antes de tocar produccion.** Capturar POST exacto con timeout/cuerpo, GET exacto con propietario y Bearer, respuesta sin token, timeout, rechazo HTTP y ausencia de token. Tras una actualizacion, agregar comprobacion del adaptador real con transporte simulado localmente: un mock exclusivo de axios no demuestra compatibilidad de la libreria nueva. Comparar resultados y build antes/despues; no llamar servicios externos del workspace.

## H-04: Lodash 4.17.21

**Hallazgo y problema.** H-04, severidad media. [package.json:20](package.json#L20) declara lodash y [src/app/login/login.component.ts:25](src/app/login/login.component.ts#L25) combina preferencias con merge. No se acredita CVE ni contaminacion de prototipos.

**Cambio propuesto.** Contrastar avisos y usos antes de declarar una vulnerabilidad. Extraer la lectura de preferencias al mismo limite de persistencia de H-05. Para preferencias validas planas theme/showTips/compact, evaluar una combinacion nativa de valores por defecto y propiedades conocidas, con tipo propio. No sustituir merge por spread sin probar diferencias de undefined, null, objetos anidados y propiedades extra. Si restringir al esquema cambia preferencias actualmente admitidas, documentar esa diferencia y pedir aprobacion; mientras tanto, elegir una actualizacion compatible y verificada en lugar de eliminar la dependencia por fuerza. Quitar lodash y @types/lodash solo tras comprobar ausencia de otros usos y equivalencia aprobada.

**Archivos a tocar.** Inicialmente [src/app/login/login.component.ts](src/app/login/login.component.ts) y SessionService con su spec propuesto en H-01; si se elimina o actualiza la dependencia, [package.json](package.json) y [package-lock.json](package-lock.json). No crear otro propietario del almacenamiento de preferencias.

**Prueba de caracterizacion antes de tocar produccion.** Defaults sin preferencias, personalizacion parcial, false en booleanos, cadenas vacias, null, propiedades desconocidas, valores anidados, JSON invalido y persistencia posterior al login. Distinguir los comportamientos hoy aceptados de los que una futura validacion rechazaria. Logout debe seguir conservando preferencias. Una sustitucion solo avanza cuando la equivalencia necesaria queda probada o las diferencias estan aprobadas.

## H-05: Separacion de responsabilidades

**Hallazgo y problema.** H-05, severidad media. [src/app/login/login.component.ts:31](src/app/login/login.component.ts#L31) y [src/app/dashboard/dashboard.component.ts:35](src/app/dashboard/dashboard.component.ts#L35) concentran UI, HTTP, almacenamiento y decisiones del flujo.

**Cambio propuesto.** AuthService realiza login HTTP; TasksService consulta tareas; SessionService es el unico lector/escritor de token, usuario y preferencias. Los componentes presentan estado y coordinan eventos y navegacion, sin axios ni localStorage directos. Una funcion pura de preparacion de tareas reutiliza formatTaskLabel y preserva filtrado/comparador. Centralizar URLs en environment.ts y constantes de protocolo/configuracion (client, timeout, rutas y estados utilizados), sin diseminar literales nuevos. Mantener la politica publica de errores de H-02 y los tipos de H-06. Extraer solo estas responsabilidades reales, sin introducir un framework adicional de estado ni una jerarquia generica de servicios.

**Archivos a tocar.** [src/app/login/login.component.ts](src/app/login/login.component.ts), [src/app/dashboard/dashboard.component.ts](src/app/dashboard/dashboard.component.ts), [src/app/utils/legacy-format.ts](src/app/utils/legacy-format.ts). Nuevos propuestos `src/app/services/auth.service.ts`, `src/app/services/tasks.service.ts`, SessionService ya propuesto, `src/environments/environment.ts`, `src/app/utils/prepare-tasks.ts` y sus specs pertinentes. Usar una configuracion compartida de rutas si evita repetirlas con [src/app/app.routes.ts](src/app/app.routes.ts); no cambiar definiciones de navegacion. Configurar variantes de ambiente solo cuando exista una necesidad real, sin inventar URLs de despliegue.

**Prueba de caracterizacion antes de tocar produccion.** Crear primero los tests de los componentes actuales con dobles de axios, almacenamiento, Router, NgZone y ChangeDetectorRef; verificar el flujo exitoso, ausencia de token, errores y logout. Registrar llamadas a run/detectChanges y el orden persistir/navegar. Tras extraer, conservar las expectativas observables y agregar tests de cada servicio y funcion pura; no limitarse a comprobar llamadas entre mocks.

## H-06: Tipado estricto

**Hallazgo y problema.** H-06, severidad media. Hay any en [src/app/login/login.component.ts:16](src/app/login/login.component.ts#L16), [src/app/dashboard/dashboard.component.ts:23](src/app/dashboard/dashboard.component.ts#L23) y [src/app/utils/legacy-format.ts:1](src/app/utils/legacy-format.ts#L1).

**Cambio propuesto.** Definir interfaces propias LoginRequest/LoginResponse, User, Task y Preferences en un archivo de modelos compartido. Tipar estado de UI como string/boolean y colecciones segun el uso confirmado. Recibir errores y datos no comprobados como unknown; estrechar tipos con guardas pequenas en el limite correspondiente, no con casts generales ni aserciones no nulas para silenciar fallos. No declarar prioridades numericas ni estados cerrados sin evidencia. Separar tipado estatico de validacion en runtime: endurecer la admision de respuestas malformadas es una decision funcional distinta, no un efecto accidental de este refactor.

**Archivos a tocar.** [src/app/login/login.component.ts](src/app/login/login.component.ts), [src/app/dashboard/dashboard.component.ts](src/app/dashboard/dashboard.component.ts), [src/app/utils/legacy-format.ts](src/app/utils/legacy-format.ts), sus specs y los servicios compartidos de H-05; nuevo propuesto `src/app/models/api.models.ts`. No desactivar opciones estrictas para conseguir compilar.

**Prueba de caracterizacion antes de tocar produccion.** Cubrir tarea ausente, prioridad/propietario faltantes, lista vacia, estados conocidos y desconocidos, login sin token y errores con distintas formas. Emplear fixtures representativos y dobles tipados sin any. Caracterizar datos inesperados como limites observados, no inventar un contrato remoto. Ademas de pruebas runtime, usar el build Angular y comprobacion TypeScript de las pruebas para detectar usos incompatibles; Vitest por si solo no acredita tipado correcto.

## H-07: Pruebas del flujo

**Hallazgo y problema.** H-07, severidad media. [src/app/utils/legacy-format.spec.ts:5](src/app/utils/legacy-format.spec.ts#L5) solo cubre el caso nominal de una utilidad. [vitest.config.ts:5](vitest.config.ts#L5) usa entorno node, no DOM.

**Cambio propuesto.** Ampliar primero el spec existente de la utilidad y agregar caracterizacion de los dos componentes, despues pruebas de servicios y transformacion pura conforme se extraigan. Usar Vitest existente, dobles controlados y limpieza de almacenamiento/mocks entre casos. Realizar una prueba piloto de instanciacion y compilacion Angular en el entorno Node actual antes de elegir soporte de DOM: no asumir que TestBed y templates funcionan sin configuracion. Separar tests de metodos/servicios en Node de comprobaciones de renderizado y navegacion en navegador. No agregar una dependencia de DOM o un runner nuevo sin justificar necesidad, compatibilidad y coste, y obtener aprobacion; si no hay medio disponible, declarar la validacion visual pendiente, nunca sustituirla por una afirmacion de exito.

**Archivos a tocar.** [src/app/utils/legacy-format.spec.ts](src/app/utils/legacy-format.spec.ts); nuevos propuestos `src/app/login/login.component.spec.ts`, `src/app/dashboard/dashboard.component.spec.ts` y specs junto a los servicios/funciones nuevos. [vitest.config.ts](vitest.config.ts) solo para incluir correctamente el codigo de produccion y umbrales de cobertura, sin excluir las rutas dificiles para elevar porcentajes. [package.json](package.json) y [package-lock.json](package-lock.json) solo si se aprueba soporte adicional imprescindible.

**Prueba de caracterizacion antes de tocar produccion.** Escribir y ejecutar en el codigo actual los casos de H-01/H-02/H-05/H-06/H-08/H-09. Agregar lista vacia, filtrado exacto de ARCHIVED, orden actual incluyendo prioridades iguales, etiquetas por defecto, traducciones y fallback de estado, errores HTTP y finalizacion de indicadores. Mantener pruebas de integracion simulada login -> persistencia -> tareas -> logout, no solo unidades independientes. Medir una linea base con cobertura antes de refactorizar y contrastar un caso exitoso y uno de error en navegador cuando el medio este disponible.

## H-08: Anidamiento en login

**Hallazgo y problema.** H-08, severidad baja. Las validaciones en [src/app/login/login.component.ts:33](src/app/login/login.component.ts#L33) y [src/app/login/login.component.ts:36](src/app/login/login.component.ts#L36) envuelven todo el camino HTTP y de sesion.

**Cambio propuesto.** Mantener prioridad de validacion usuario antes de clave y usar retornos anticipados para campos invalidos y respuesta sin token. Activar busy solo al empezar la operacion valida y liberarlo en finally. Consumir AuthService y SessionService, no mover el anidamiento a un servicio monolitico. Reutilizar validacion pequena solo si evita duplicacion real y conservar valores originales enviados al endpoint.

**Archivos a tocar.** [src/app/login/login.component.ts](src/app/login/login.component.ts), su spec propuesto en H-07 y AuthService solo en la extraccion coordinada de H-05.

**Prueba de caracterizacion antes de tocar produccion.** Tabla de casos: usuario y clave ausentes, vacios y espacios; ambos invalidos; credenciales validas; respuesta sin token; excepcion HTTP y navegacion rechazada. Verificar mensaje seleccionado, numero de llamadas HTTP, persistencia/navegacion solo tras exito, busy durante espera y busy false al finalizar. Confirmar que una credencial con espacios no vacia se envia sin recorte.

## H-09: Claves de sesion repetidas

**Hallazgo y problema.** H-09, severidad baja. Las mismas claves aparecen en [src/app/login/login.component.ts:47](src/app/login/login.component.ts#L47), [src/app/dashboard/dashboard.component.ts:36](src/app/dashboard/dashboard.component.ts#L36) y [src/app/dashboard/dashboard.component.ts:75](src/app/dashboard/dashboard.component.ts#L75). Se confirma duplicacion de literales, no de bloques completos.

**Cambio propuesto.** Concentrar las claves workshop_token/workshop_user/workshop_preferences en constantes privadas del unico SessionService. Exponer operaciones con significado (leer sesion, guardar sesion, leer/guardar preferencias, cerrar sesion), no acceso generico a claves desde componentes. Mantener valores y serializacion actuales. Reutilizar la extraccion de H-01/H-05 en lugar de agregar una segunda capa o un archivo de constantes por cada clave.

**Archivos a tocar.** [src/app/login/login.component.ts](src/app/login/login.component.ts), [src/app/dashboard/dashboard.component.ts](src/app/dashboard/dashboard.component.ts), SessionService y su spec propuestos en H-01; specs de componentes de H-07.

**Prueba de caracterizacion antes de tocar produccion.** Precargar almacenamiento con las claves actuales, iniciar dashboard y comprobar usuario/Bearer; ejecutar login y comprobar escrituras exactas y JSON; ejecutar logout y comprobar que se eliminan solo token/usuario. Repetir con ausencia de claves y preferencias existentes. Tras extraer, comprobar que ningun componente accede directamente al almacenamiento.

## Orden de ejecucion y verificacion futura

1. H-07: prueba piloto de Angular con Vitest Node, pruebas de caracterizacion y linea base; resolver requisitos de navegador antes de prometer cobertura de DOM.
2. H-02: interpolacion y mensajes publicos, con pruebas de aceptacion que distingan el cambio de presentacion de los contratos HTTP preservados.
3. H-05, H-09 y H-06: extraccion incremental con tipos y constantes en el mismo cambio acotado por responsabilidad; primero sesion/configuracion, despues autenticacion, despues tareas. Ejecutar pruebas enfocadas tras cada paso. Preparar H-01 sin cambiar persistencia.
4. H-08: retornos anticipados una vez protegido login por pruebas.
5. H-03 y H-04: auditoria verificable y decision de actualizacion/sustitucion por separado, con caracterizacion de compatibilidad. No elegir versiones sin consultar evidencia actual.
6. H-01: implementar la alternativa solo si se aprueba expresamente la perdida de persistencia y su contrato actualizado. Si no, mantener la implementacion compatible y el hallazgo sin resolver en la matriz.

Gates propuestos para la implementacion: tests enfocados tras cada cambio; `npm test`, `npm run build` y `npm run test:coverage` al integrar. Cobertura minima del codigo modificado: 85% en lineas, funciones, ramas y sentencias, con inclusion explicita del codigo tocado, conforme a la meta del laboratorio; no reducir gates existentes. Verificar tipos de los specs con una configuracion dedicada si el build actual no los incluye. Ejecutar la auditoria con su script existente sin ocultar fallos ni atribuir a este plan resultados todavia inexistentes.

La prueba integrada debe comprobar peticiones y datos exactos, carga posterior a login sin recarga, ruta sin token, logout y conservacion de preferencias. La prueba de navegador debe verificar mensajes como texto, estados busy/loading y renderizado tras respuestas HTTP; usar mocks locales sin ampliar el ambito ni depender de otros componentes. Si falta infraestructura, dejar constancia de la comprobacion no ejecutada y del requisito para habilitarla.

Al implementar, actualizar evidencia y estado solo en [HALLAZGOS.md](HALLAZGOS.md) despues de verificar cada hallazgo. No convertir una extraccion, una auditoria fallida o una propuesta condicionada en un hallazgo resuelto. Este plan no ejecuta pruebas, auditorias, instalaciones ni cambios de produccion.

</details>