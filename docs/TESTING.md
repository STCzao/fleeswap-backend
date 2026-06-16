# Documentación de Tests

Fecha de referencia: 15 de junio de 2026.

## Propósito del Documento

Este documento deja una fotografia técnica y funcional de la estrategia de testing actual del backend de Fleeswap.

No reemplaza a un Test Plan formal. El proyecto no partio de un plan de pruebas definido previamente con alcance, responsables, matriz de riesgos, casos trazados por historia y criterios de salida. Por eso, este documento cumple una funcion intermedia:

- explicar que pruebas existen hoy;
- dejar claro que se válida y que no;
- documentar como se ejecutan las pruebas;
- describir convenciones reales de la suite;
- registrar limitaciones conocidas;
- servir como base para armar la documentación final del proyecto.

## Contexto General

Fleeswap es un backend Node.js + Express con persistencia en MongoDB mediante Mongoose. La aplicación cubre autenticación, usuarios, publicaciones, intercambios, chat, notificaciones, búsquedas activas, administración y reputación.

La suite automatizada actual prueba principalmente comportamiento funcional de API y de algunos flujos realtime. No existe todavía una separación formal entre tests unitarios, tests de integración, tests end-to-end y tests de contrato.

En la práctica, muchas pruebas ejercitan varias capas al mismo tiempo:

- rutas Express;
- middlewares de autenticación y validación;
- controllers;
- services;
- repositories;
- modelos Mongoose;
- base MongoDB de testing.

Por ese motivo, aunque no exista una categoría formal de "tests de integración" dentro del proyecto, varios tests actuales funcionan como pruebas funcionales con integracion real contra base de datos.

Además de la suite automatizada, el equipo también realiza pruebas manuales con Postman. Esas pruebas son relevantes para la validación del proyecto porque permiten recorrer casos reales de API, inspeccionar respuestas, validar contratos consumibles por frontend y documentar evidencia manual de flujos completos.

## Stack de Testing

La suite usa:

- Mocha como test runner;
- Chai para assertions;
- Supertest para requests HTTP contra `app`;
- socket.io-client para escenarios realtime;
- Mongoose para preparar y verificar datos;
- MongoDB externo como base de datos de test;
- dotenv para cargar variables de entorno.

Para pruebas manuales se usa:

- Postman para ejecutar requests HTTP;
- environments de Postman para manejar variables como `baseUrl`, access token e IDs;
- colecciones manuales o semiestructuradas por módulo funcional.

No hay configurado actualmente:

- coverage automatizado;
- mocks sistematicos por capa;
- test database in-memory;
- snapshots;
- reportes HTML/JUnit;
- pipeline CI documentado en este repositorio.

## Requisitos de Entorno

Los tests cargan variables con `dotenv/config` y luego `test/setup.js` asigna:

```js
process.env.MONGO_URI = process.env.TEST_MONGO_URI;
```

Por eso, para correr tests se requiere:

- archivo `.env` disponible;
- `TEST_MONGO_URI` apuntando a una base MongoDB de testing;
- conectividad hacia esa base;
- dependencias instaladas con `npm install`.

Importante: no usar una base productiva ni una base compartida con datos reales. Muchas suites limpian colecciones o documentos de prueba durante `afterEach` / `after`.

## Comandos

### Suite completa

```bash
npm test
```

Equivale a:

```bash
mocha --require dotenv/config --require test/setup.js test/**/*.test.js --timeout 10000
```

### Suite focalizada por archivo

```bash
npx mocha --require dotenv/config --require test/setup.js test/reviews/review.test.js --timeout 10000
```

### Suite focalizada por módulo

```bash
npx mocha --require dotenv/config --require test/setup.js test/exchange/*.test.js --timeout 10000
```

### Suite focalizada de Épica 6

```bash
npx mocha --require dotenv/config --require test/setup.js test/reviews/review.test.js test/exchange/exchange.history.test.js --timeout 10000
```

## Como Leer los Resultados

Cada test ejecutado por Mocha muestra:

- nombre del `describe`;
- nombre del caso `it`;
- resultado;
- tiempo de ejecucion.

Durante las pruebas también aparecen logs de la aplicación, porque el backend registra requests con Winston y `requestId`. Esto es esperado. Un ejemplo normal es:

```text
POST /api/auth/register -> 201
GET /api/exchanges/history -> 200
```

Los logs con nivel `warn` también pueden ser esperados cuando un caso prueba errores de negocio, por ejemplo:

- intento de duplicar una calificación;
- intento de calificar un intercambio no completado;
- token inválido;
- acceso no autorizado.

## Alcance Actual

La validación actual combina pruebas automatizadas y pruebas manuales con Postman.

La suite automatizada cubre los flujos principales del backend:

- registro, login, verificación y recuperación de cuenta;
- perfil propio y perfil público;
- publicaciones, filtros, cambios de estado, reportes y recomendaciones;
- solicitudes de intercambio y compra;
- aceptación, rechazo, confirmación y cancelación;
- mensajes y chat por contexto de intercambio;
- eventos realtime de chat y notificaciones;
- centro de notificaciones;
- búsquedas activas y matching;
- administración de usuarios, publicaciones y reportes;
- reputación y reviews post-intercambio;
- historial propio de intercambios.

Las pruebas manuales con Postman complementan esa cobertura para:

- verificar flujos completos desde una perspectiva más cercana al consumo real de API;
- confirmar estructura de respuestas;
- probar payloads alternativos rápidamente;
- validar headers, cookies y tokens;
- inspeccionar errores de validación;
- probar secuencias largas con IDs generados en runtime;
- registrar evidencia para presentación o documentación del proyecto.

## Fuera de Alcance Actual

La suite no cubre formalmente:

- pruebas unitarias aisladas de cada service/helper;
- pruebas de contrato entre backend y frontend;
- pruebas de performance o carga;
- pruebas de seguridad ofensiva;
- pruebas de compatibilidad entre navegadores;
- pruebas visuales;
- pruebas de migracion de datos completas;
- pruebas de resiliencia ante caida de proveedores externos;
- pruebas automatizadas de envio real de emails;
- pruebas automatizadas de carga real a Cloudinary.

Las pruebas con Postman no reemplazan la suite automatizada: sirven como validación manual, exploratoria y documental. Si un bug se descubre manualmente, lo ideal es convertirlo luego en un test automatizado cuando el caso sea estable.

## Pruebas Manuales con Postman

### Rol dentro del proyecto

Postman se usa como herramienta de validación manual de API. Su valor principal es permitir recorrer flujos de usuario de punta a punta sin depender del frontend.

Estas pruebas ayudan a responder preguntas como:

- el endpoint existe y responde con el status esperado;
- el payload esperado por backend es claro;
- la respuesta tiene la forma que necesita el frontend;
- los errores son comprensibles;
- el token se aplica correctamente;
- los IDs devueltos por un request sirven para continuar el flujo siguiente.

### Variables recomendadas

Un environment de Postman deberia incluir:

| Variable | Uso |
| --- | --- |
| `baseUrl` | URL base del backend, por ejemplo `http://localhost:3000/api` |
| `accessToken` | token JWT del usuario autenticado |
| `refreshToken` | si se decide inspeccionar refresh manualmente |
| `userId` | usuario autenticado o usuario objetivo |
| `otherUserId` | contraparte para intercambios |
| `publicationId` | publicación principal |
| `offeredPublicationId` | publicación ofrecida en trueque |
| `requestedPublicationId` | publicación solicitada |
| `exchangeId` | intercambio creado durante el flujo |
| `notificationId` | notificación usada en centro de notificaciones |
| `activeSearchId` | criterio de búsqueda activa |
| `reviewId` | review creada en Épica 6 |

### Colecciones sugeridas

Para documentación final del proyecto, conviene ordenar Postman por carpetas:

| Carpeta | Requests sugeridos |
| --- | --- |
| Auth | register, login, refresh, logout, verify-email, resend-verification, forgot-password, reset-password |
| Users | me, update profile, public profile, my publications, delete account |
| Publications | create, list, detail, update, change status, delete, report, recommendations |
| Exchanges | create exchange, create purchase, received, sent, history, detail, accept, reject, confirm, cancel |
| Messages | exchange messages |
| Active Searches | create, list, update, delete |
| Notifications | list, mark as read, read all |
| Reviews | create review, received reviews, public reputation check |
| Admin | stats, users, user status, user role, publications, reports |

### Flujo manual mínimo recomendado

Un recorrido manual completo puede ser:

1. Registrar usuario A.
2. Registrar usuario B.
3. Completar perfil de ambos usuarios.
4. Crear una publicación para usuario A.
5. Crear una publicación para usuario B.
6. Usuario B solicita intercambio por la publicación de A.
7. Usuario A acepta la solicitud.
8. Verificar detalle del intercambio.
9. Confirmar como una parte.
10. Confirmar como la otra parte.
11. Verificar que el intercambio queda `completed`.
12. Crear review desde una parte.
13. Intentar crear review duplicada y validar error.
14. Consultar perfil público del usuario calificado.
15. Verificar promedio, total de completados, reviews recibidas y cancelaciones.
16. Consultar historial propio con `GET /api/exchanges/history`.

### Flujo manual de Épica 6

Para validar reputación con Postman:

1. Crear o reutilizar dos usuarios autenticados.
2. Crear dos publicaciones disponibles.
3. Crear una solicitud de intercambio.
4. Aceptar la solicitud.
5. Confirmar el intercambio con ambas partes.
6. Ejecutar `POST /api/reviews` con:

```json
{
  "exchangeId": "{{exchangeId}}",
  "rating": 5,
  "comment": "Excelente intercambio"
}
```

7. Verificar respuesta `201`.
8. Repetir el mismo request y verificar respuesta `409`.
9. Ejecutar `GET /api/reviews/received` con el usuario calificado.
10. Ejecutar `GET /api/users/{{userId}}` y verificar reputación publica.
11. Ejecutar `GET /api/exchanges/history` y verificar historial propio.

### Evidencia recomendada

Para que Postman sirva como soporte documental, conviene guardar:

- nombre del flujo probado;
- fecha;
- ambiente usado;
- usuario utilizado;
- endpoints recorridos;
- status codes obtenidos;
- capturas o export de respuestas clave;
- observaciones;
- errores encontrados;
- resultado final: aprobado, observado o rechazado.

Un formato simple de evidencia puede ser:

| Campo | Valor |
| --- | --- |
| Flujo | Épica 6 - Reputación post-intercambio |
| Fecha | 15/06/2026 |
| Ambiente | Local |
| Resultado | Aprobado |
| Endpoints | `POST /api/reviews`, `GET /api/users/:id`, `GET /api/exchanges/history` |
| Observaciones | El duplicado responde 409 y el perfil actualiza reputación |

### Buenas prácticas en Postman

- No hardcodear tokens en requests; usar variables de environment.
- Guardar IDs relevantes automáticamente cuando sea posible.
- Separar ambientes local, test y producción.
- Evitar correr flujos destructivos contra bases compartidas.
- Mantener nombres de requests alineados con historias o módulos.
- Registrar payloads de ejemplo estables.
- Convertir bugs descubiertos manualmente en tests automatizados cuando corresponda.

## Mapa de Suites

| Area | Archivos principales | Cobertura |
| --- | --- | --- |
| Autenticación | `test/auth/auth.test.js` | registro, login, verificación de email, recuperación y validación de credenciales |
| Publicaciones | `test/publications/*.test.js` | CRUD, filtros, perfil de publicaciones, recomendaciones y reportes |
| Intercambios | `test/exchange/*.test.js` | solicitudes, aceptación, rechazo, confirmación, cancelación, mensajes e historial |
| Chat realtime | `test/chat/*.test.js` | conexión socket, join, reconexión, mensajes y modo solo lectura |
| Notificaciones | `test/notifications/*.test.js` | centro de notificaciones, matching, eventos de intercambio y realtime |
| Búsquedas activas | `test/activeSearches/activeSearch.test.js` | creación, edición, duplicados, activación y eliminación |
| Administración | `test/admin/*.test.js` | usuarios, publicaciones, reportes, roles y métricas |
| Reputación | `test/reviews/review.test.js` | calificación post-intercambio, duplicados, ventana de 7 días, perfil público y reviews recibidas |

## Cobertura por Dominio

### Autenticación

Válida comportamientos centrales de identidad:

- registro con payload válido;
- bloqueo de email duplicado;
- errores por payload incompleto;
- login exitoso;
- errores por credenciales invalidas;
- generación y validación de tokens de verificación;
- reenvio de verificación;
- recuperación y reset de contraseña.

Riesgos cubiertos:

- exposicion accidental de password;
- credenciales incorrectas;
- flujos basicos de cuenta.

Riesgos no cubiertos completamente:

- ataques de fuerza bruta;
- expiración exhaustiva de todos los tokens;
- matriz completa de cookies por ambiente.

### Usuarios y Perfiles

Válida:

- perfil propio autenticado;
- actualizacion de perfil;
- perfil público;
- publicaciones propias;
- publicaciones activas en perfil público;
- datos reputacionales en perfil público.

Riesgos cubiertos:

- exposicion de datos sensibles;
- separación entre perfil propio y perfil público;
- consistencia de datos visibles.

### Publicaciones

Válida:

- creacion;
- edición;
- eliminación;
- cambio de estado;
- visibilidad publica;
- filtros;
- reportes;
- recomendaciones por categorías preferidas.

Riesgos cubiertos:

- ownership;
- validaciones de campos;
- visibilidad de publicaciones no disponibles;
- reporte duplicado.

### Intercambios y Compras

Válida:

- envio de solicitud;
- bloqueo de autointercambio y autocompra;
- bloqueo de duplicados activos;
- aceptación;
- rechazo;
- confirmación;
- doble confirmación para trueques;
- confirmación de ventas;
- cancelación;
- rechazo automático de pendientes relacionadas;
- historial propio.

Riesgos cubiertos:

- cambios invalidos de estado;
- permisos por participante;
- consistencia básica de publicaciones relacionadas;
- acceso al detalle solo por participantes.

### Chat

Válida:

- join al chat por intercambio;
- autorización de participantes;
- envio de mensajes;
- recepcion realtime;
- historial de mensajes;
- reconexión;
- modo solo lectura tras completar o cancelar.

Riesgos cubiertos:

- acceso de terceros a chats;
- escritura cuando el intercambio ya no está activo;
- continuidad del historial.

### Búsquedas Activas

Válida:

- creacion de criterios;
- normalizacion de keywords;
- bloqueo de duplicados;
- listado;
- edición;
- activacion/desactivacion;
- eliminación.

Riesgos cubiertos:

- criterios repetidos;
- payloads invalidos;
- separación por usuario.

### Notificaciones

Válida:

- notificaciones persistentes;
- lectura individual;
- lectura masiva;
- conteo de no leídas;
- matching por búsquedas activas;
- deduplicacion;
- eventos por intercambio;
- entrega realtime.

Riesgos cubiertos:

- notificaciones duplicadas;
- notificar al usuario incorrecto;
- payload incompleto para frontend.

### Administración

Válida:

- listado de usuarios;
- cambio de estado;
- cambio de rol;
- listado y moderación de publicaciones;
- gestión de reportes;
- métricas basicas.

Riesgos cubiertos:

- acceso administrativo;
- modificaciones invalidas;
- consistencia al suspender usuarios/publicaciones.

### Reputación

Válida:

- creacion de reviews;
- rating de 1 a 5;
- comentario opcional;
- una review por intercambio y reviewer;
- plazo de 7 días;
- intercambio completado por las partes requeridas;
- promedio real;
- listado de reviews recibidas;
- cancelaciones en perfil;
- historial propio de intercambios.

Riesgos cubiertos:

- manipulación de reputación desde intercambios ajenos;
- reviews duplicadas;
- reviews fuera de plazo;
- reputación falsa en perfil público.

## Cobertura de Épica 6

La Épica 6 queda cubierta por dos archivos focalizados:

- `test/reviews/review.test.js`
- `test/exchange/exchange.history.test.js`

### H6.1 - Calificar a la otra parte tras un intercambio

Criterios de aceptación:

- la calificación se habilita solo cuando el intercambio fue marcado como completado por ambas partes;
- el usuario puede dar puntuacion de 1 a 5 y comentario opcional;
- solo se puede calificar una vez por intercambio;
- el plazo para calificar es de 7 días tras la confirmación.

Tests asociados:

- permite calificar al otro participante de un intercambio completado;
- rechaza una segunda calificación del mismo usuario sobre el mismo intercambio;
- rechaza intercambios no completados;
- rechaza documentos inconsistentes con `status: completed` pero sin confirmación de ambas partes;
- rechaza calificaciones fuera del plazo de 7 días.

### H6.2 - Ver reputación en el perfil

Criterios de aceptación:

- muestra la calificación promedio;
- muestra el total de intercambios completados;
- muestra el listado de calificaciones recibidas con comentario y fecha;
- muestra la cantidad de cancelaciones registradas.

Tests asociados:

- el perfil público expone `calificacionPromedio`;
- expone `totalCalificaciones`;
- expone `totalIntercambiosCompletados`;
- expone `calificacionesRecibidas`;
- expone `cancelaciones`;
- mantiene publicaciones activas visibles en el perfil público.

### H6.3 - Historial de intercambios propio

Criterios de aceptación:

- muestra intercambios completados, en curso, pendientes y cancelados;
- cada entrada muestra objeto, contraparte y estado;
- permite acceder al detalle de cada intercambio.

Tests asociados:

- devuelve intercambios `pending`, `active`, `completed` y `cancelled`;
- excluye `rejected` del historial MVP;
- cada entrada incluye objeto, contraparte, estado y `detailUrl`;
- permite filtrar por estado con `status=...`.

## Datos de Prueba

Los tests crean datos directamente por API y por modelos Mongoose.

Patrones habituales:

- crear usuarios por `POST /api/auth/register`;
- crear publicaciones directamente con `Publication.create`;
- crear intercambios directamente con `Exchange.create` cuando el caso necesita un estado específico;
- crear reviews directamente con `Review.create` cuando el objetivo es validar lectura agregada;
- limpiar usuarios por patrones de email;
- limpiar colecciones relacionadas al terminar cada caso.

Este enfoque acelera la preparación de escenarios, pero también exige disciplina en la limpieza. Si un test falla antes del cleanup, puede dejar datos residuales en la base de test.

## Convenciones de Escritura

- Cada archivo conecta a MongoDB en `before` y desconecta en `after`.
- Los datos creados por tests deben limpiarse en `afterEach` o `after`.
- Preferir emails con dominios de prueba identificables, por ejemplo `@review.test.com`.
- Usar `request(app)` para pruebas HTTP y evitar levantar el servidor real.
- Las pruebas realtime pueden inicializar servidor/socket cuando el flujo lo exige.
- Para flujos complejos, crear helpers locales al archivo.
- El nombre del test debe describir comportamiento observable.
- Evitar depender de orden global entre archivos.
- Evitar que un test dependa de datos creados por otro test.
- Cuando se agregan estados nuevos de dominio, actualizar validators, tests y documentación juntos.

## Criterios Prácticos de Aceptación de Tests

Un cambio deberia incluir tests cuando:

- agrega una ruta nueva;
- modifica reglas de negocio;
- toca permisos u ownership;
- cambia estados de intercambio/publicación;
- afecta datos visibles para frontend;
- agrega indices o restricciones de unicidad;
- cambia comportamiento realtime;
- corrige un bug que podria reaparecer.

Un cambio documental o de configuracion puede no requerir tests, pero debe indicarse en el cierre del trabajo.

## Limitaciones Conocidas

- La suite completa depende de un MongoDB externo y puede ser lenta.
- Algunos archivos hacen limpiezas amplias de colecciones; conviene no correr tests contra bases compartidas.
- No hay medicion formal de coverage configurada.
- No hay test plan formal versionado previo a la implementacion.
- No hay separación formal por tipo de test.
- No hay fixtures globales reutilizables.
- No hay factories centralizadas.
- No hay pipeline CI documentado en este repositorio.
- El feedback rápido hoy se obtiene mejor con suites focalizadas por módulo.

## Riesgos de Testing

Los principales riesgos actuales son:

- falsos negativos por caidas o latencia de MongoDB externo;
- tiempos altos en suite completa;
- limpieza incompleta de datos si una prueba falla a mitad de camino;
- duplicacion de helpers entre archivos;
- mezcla de pruebas funcionales con preparación directa por modelo;
- ausencia de coverage que indique puntos ciegos.

## Recomendaciones Futuras

Para evolucionar hacia un Test Plan más formal, conviene:

- definir tipos de test: unitarios, funcionales/API, integracion, realtime y contrato;
- crear una matriz historia -> criterio -> test;
- agregar factories para usuarios, publicaciones, exchanges, reviews y notificaciones;
- evaluar MongoDB in-memory o contenedores efimeros para reducir dependencia externa;
- agregar coverage;
- documentar datos minimos de prueba;
- separar suites lentas y rapidas;
- generar reportes consumibles por CI;
- agregar una sección de criterios de salida para cada épica.

## Checklist Antes de Mergear

Para cambios chicos:

```bash
npx mocha --require dotenv/config --require test/setup.js <archivo-de-test> --timeout 10000
```

Para cambios de dominio compartido:

```bash
npm test
```

Para cambios sobre Épica 6:

```bash
npx mocha --require dotenv/config --require test/setup.js test/reviews/review.test.js test/exchange/exchange.history.test.js --timeout 10000
```

## Estado Actual

La suite actual es valiosa como red de regresión funcional, especialmente para los flujos principales de negocio. Sin embargo, todavía debe entenderse como una base práctica de validación automatizada, no como un sistema completo de aseguramiento de calidad.

El paso natural siguiente es convertir esta documentación en un Test Plan formal con matriz de trazabilidad, criterios de salida, riesgos y responsabilidades.
