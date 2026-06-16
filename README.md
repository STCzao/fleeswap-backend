# Fleeswap Backend

Backend de Fleeswap, una plataforma orientada a publicaciones de objetos, trueques entre usuarios, compras directas, mensajería contextual y moderación administrativa.

Fecha de esta documentación: 5 de junio de 2026.

## Resumen Ejecutivo

Este proyecto implementa una API REST sobre Node.js y Express, persistencia con MongoDB a traves de Mongoose, autenticación basada en JWT con refresh token en cookie httpOnly, verificación de email y chat en tiempo real con Socket.IO.

Hoy el backend ya expresa con claridad el dominio principal del producto:

- Gestión de usuarios con perfil público y privado.
- Publicaciones con filtros, estados y reporte por moderación.
- Solicitudes de trueque y compra directa.
- Flujo de aceptación, rechazo, confirmación y cancelación de intercambios.
- Chat en tiempo real limitado al contexto de un intercambio activo.
- Panel administrativo para usuarios, publicaciones, reportes y métricas.

La base arquitectónica es buena: hay separación por capas, reglas de negocio visibles en services, validaciones consistentes y varias decisiones correctas de seguridad. Al mismo tiempo, el proyecto todavía presenta deuda operativa y funcional que conviene tener explicitada. El detalle está en [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md).

## Stack Tecnologico

- Node.js
- Express 5
- MongoDB + Mongoose
- Socket.IO
- JWT
- bcrypt
- Resend
- Cloudinary
- Winston
- Mocha + Chai + Supertest

## Objetivo del Sistema

Fleeswap busca resolver un flujo de intercambio y/o venta de objetos entre personas, con foco en:

- publicar objetos con historia, categoría y estado;
- permitir propuestas entre usuarios sobre publicaciones disponibles;
- soportar tanto trueque como compra directa;
- habilitar comunicacion en tiempo real cuando una solicitud se activa;
- moderar contenido y comportamiento mediante reportes y herramientas de admin.

## Estado Actual del Producto

### Funcionalidades implementadas

- Registro y login de usuarios.
- Verificación de email y reenvio de verificación.
- Refresh token por cookie y cierre de sesión.
- Cambio y recuperación de contraseña.
- Perfil propio y perfil público.
- Actualizacion de perfil con foto, biografia y localidad.
- Soft-delete de cuenta con ventana de recuperación.
- Alta, edición, eliminación, listado y detalle de publicaciones.
- Reporte de publicaciones y suspensión automática por volumen de reportes.
- Solicitudes de intercambio y compra.
- Gestión de bandeja de solicitudes recibidas y enviadas.
- Confirmación y cancelación de intercambios.
- Chat por Socket.IO para intercambios activos.
- Endpoints administrativos para usuarios, publicaciones, reportes y métricas.
- Logging con `requestId` y trazabilidad básica por request.

### Funcionalidades parciales o pendientes

- Perfil público completo: ya expone publicaciones activas, reputación promedio, calificaciones recibidas y cancelaciones.
- Sistema de reputación: implementado con calificación post-intercambio, comentario, promedio real, ventana de 7 días e historial propio de intercambios.
- Preferencias de categorías y recomendaciones para Home: implementadas como HU complementaria de descubrimiento dentro de la Épica 5.
- Búsqueda activa y notificaciones: implementadas en backend a nivel MVP. El centro de notificaciones ya cubre coincidencias de búsqueda activa y eventos clave de intercambio.
- Suite de tests: existe una base amplia y funcional, pero sigue dependiendo de un entorno externo y tiene tiempos de corrida altos.
- Observabilidad y endurecimiento operativo: existe trazabilidad básica, pero no todavía una estrategia completa de métricas, alertas y auditoria.

## Alineación con el Backlog MVP

Tomando como referencia el Product Backlog MVP, el backend actual se alinea de esta forma:

- Épica 1 - Gestión de Usuarios y Perfiles: alineación alta.
- Épica 2 - Gestión de Publicaciones: alineación alta.
- Épica 3 - Sistema de Intercambio: alineación alta.
- Épica 4 - Chat en Tiempo Real: alineación alta.
- Épica 5 - Búsqueda Activa y Notificaciones: implementada en backend a nivel MVP.
- Épica 6 - Sistema de Reputación: implementada en backend a nivel MVP.

### Detalle por épica

#### Épica 1 - Gestión de Usuarios y Perfiles

Cobertura actual:

- registro, login, refresh y logout;
- verificación y reenvio de verificación de email;
- cambio y recuperación de contraseña;
- perfil propio;
- edición de perfil;
- soft-delete con reactivacion en periodo de gracia.

Desfasajes frente al backlog:

- el perfil público ya está operativo como base funcional;
- su enriquecimiento reputacional ya se apoya en la Épica 6.

#### Épica 2 - Gestión de Publicaciones

Cobertura actual:

- crear, editar, eliminar y cambiar estado;
- ver detalle y listado público;
- filtros por categoría, tipo, condicion y texto;
- reporte de publicaciones con bloqueo de duplicados;
- suspensión automática por umbral de reportes.

Observacion:

- esta es una de las epicas más alineadas con el backlog del MVP.

#### Épica 3 - Sistema de Intercambio

Cobertura actual:

- envio de solicitudes de trueque y compra;
- bandejas de recibidas y enviadas;
- aceptación y rechazo;
- confirmación de intercambio o venta;
- cancelación de solicitudes pendientes o activas.

Reglas ya cubiertas:

- no autointercambio/autocompra;
- no duplicados activos por requester y publicación;
- doble confirmación en trueque;
- rechazo automático de solicitudes pendientes relacionadas al cerrar una operación.

#### Épica 4 - Chat en Tiempo Real

Cobertura actual:

- acceso al chat solo para participantes;
- habilitación del chat solo cuando el intercambio está `active`;
- mensajería en tiempo real con Socket.IO;
- historial accesible por REST para intercambios cerrados;
- paso a modo solo lectura al completar o cancelar.

Observacion:

- la arquitectura de sockets está centrada hoy exclusivamente en chat, no en notificaciones de producto.

#### Épica 5 - Búsqueda Activa y Notificaciones

Estado actual:

- implementada en backend a nivel MVP.

Cobertura actual:

- descubrimiento por categorías preferidas para Home;
- creación y gestión de búsquedas activas;
- matching automático por coincidencia al crear publicaciones;
- notificaciones persistentes y realtime;
- centro de notificaciones con historial y estado de lectura;
- inclusión de eventos de intercambio clave en el mismo centro.

Salvedad operativa:

- la suite automatizada que valida estos flujos sigue condicionada por el entorno externo de MongoDB, por lo que la verificación integrada completa no siempre queda disponible en esta instancia.

#### Épica 6 - Sistema de Reputación

Cobertura actual:

- se cuenta la cantidad de intercambios completados por usuario;
- se pueden registrar calificaciones de 1 a 5 con comentario sobre intercambios completados;
- cada participante puede calificar una sola vez por intercambio;
- existe una ventana de 7 días post-intercambio para calificar;
- el perfil público expone promedio real, total de calificaciones, calificaciones recibidas, publicaciones activas y cancelaciones;
- el usuario autenticado puede consultar su historial de intercambios pendientes, activos, completados y cancelados.

Pendientes frente al backlog:

- validar con frontend el contrato final de visualización del historial y reputación.

Historias correctivas incorporadas:

- `HU6.4` Historial completo de chat:
  asegurar visualización íntegra del historial con orden cronológico correcto, soporte de carga incremental y estabilidad de rendimiento en conversaciones extensas.
- `HU6.5` Bloqueo por publicación reportada:
  cuando una publicación entra en revisión, deben bloquearse temporalmente nuevas solicitudes, aceptación de solicitudes existentes y uso del chat asociado hasta resolución administrativa.

## Arquitectura

La aplicación sigue una estructura en capas:

- `src/routes`: define el contrato HTTP.
- `src/controllers`: adapta request/response y delega.
- `src/services`: contiene reglas de negocio.
- `src/repositories`: encapsula acceso a datos con Mongoose.
- `src/models`: esquemas y restricciones de persistencia.
- `src/middlewares`: autenticación, autorizacion, validación, contexto de request y manejo de errores.
- `src/helpers`: utilidades transversales.
- `src/sockets`: autenticación socket y handlers de chat.
- `test`: suite automatizada por módulos funcionales.

### Flujo de request

1. La ruta aplica validaciones y middlewares.
2. El controller recibe datos ya normalizados.
3. El service ejecuta reglas de negocio.
4. El repository interactua con MongoDB.
5. Los errores operacionales se convierten en respuestas HTTP mediante `errorHandler`.

### Principios que ya se observan en el código

- Controllers livianos.
- Services con responsabilidad de negocio.
- Repositories separados del contrato HTTP.
- Validaciones de entrada con `express-validator`.
- Reglas de seguridad centralizadas.
- Uso de `AppError` para errores operacionales esperados.

## Estructura del Repositorio

```text
src/
  app.js
  index.js
  config/
  controllers/
  helpers/
  middlewares/
  models/
  repositories/
  routes/
  services/
  sockets/
  validators/
test/
  admin/
  auth/
  chat/
  exchange/
  publications/
  setup.js
```

## Seguridad

La base de seguridad actual incluye:

- `helmet` para headers de seguridad;
- control de `cors` por lista de origenes permitidos;
- sanitizacion básica de `req.body` frente a NoSQL injection;
- JWT para access token;
- refresh token en cookie `httpOnly`;
- refresh token hasheado en base;
- verificación de email por token;
- validaciones exhaustivas en capa HTTP;
- middleware de rol para rutas administrativas;
- hash dummy en login para reducir timing attacks;
- manejo centralizado de errores.

## API Overview

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `PATCH /api/auth/change-password`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/verify-email`
- `POST /api/auth/resend-verification`

### Users

- `GET /api/users/me`
- `GET /api/users/me/publications`
- `PATCH /api/users/me/profile`
- `PUT /api/users/me`
- `DELETE /api/users/me`
- `GET /api/users/:id`

### Publications

- `GET /api/publications`
- `GET /api/publications/recommendations`
- `GET /api/publications/:id`
- `POST /api/publications`
- `PATCH /api/publications/:id`
- `DELETE /api/publications/:id`
- `PATCH /api/publications/:id/status`
- `POST /api/publications/:id/report`

### Active Searches

- `GET /api/active-searches`
- `POST /api/active-searches`
- `PATCH /api/active-searches/:id`
- `DELETE /api/active-searches/:id`

### Notifications

- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`
- `PATCH /api/notifications/read-all`

### Reviews

- `POST /api/reviews`
- `GET /api/reviews/received`

### Exchanges

- `GET /api/exchanges/received`
- `GET /api/exchanges/sent`
- `GET /api/exchanges/history`
- `GET /api/exchanges/:id`
- `GET /api/exchanges/:id/messages`
- `POST /api/exchanges`
- `PATCH /api/exchanges/:id/accept`
- `PATCH /api/exchanges/:id/reject`
- `PATCH /api/exchanges/:id/confirm`
- `PATCH /api/exchanges/:id/cancel`

### Admin

- `GET /api/admin/stats`
- `GET /api/admin/users`
- `GET /api/admin/users/:id`
- `PATCH /api/admin/users/:id/status`
- `PATCH /api/admin/users/:id/role`
- `GET /api/admin/publications`
- `PATCH /api/admin/publications/:id/status`
- `DELETE /api/admin/publications/:id`
- `GET /api/admin/reports`
- `PATCH /api/admin/reports/:id/resolve`

## Eventos de Socket.IO

Autenticación:

- el cliente debe enviar el access token en `handshake.auth.token`.

Eventos soportados:

- `chat:join`
- `chat:enabled`
- `chat:message`
- `chat:readonly`
- `notification:new`

Entrega actual de notificaciones:

- persistencia en base de datos para coincidencias de búsqueda activa;
- emision realtime a la room privada `user:<userId>` si el usuario está conectado.
- el matching actual se dispara solo al crear una publicación nueva disponible;
- las keywords se comparan contra `title`, `description` e `history`;
- una misma publicación notifica una sola vez por `user + activeSearch`.
- el centro de notificaciones permite listar por fecha descendente y marcar una o todas como leídas.

## Variables de Entorno

Las variables observadas en el código son:

```env
PORT=
NODE_ENV=
MONGO_URI=
TEST_MONGO_URI=
FRONTEND_URL=
JWT_SECRET=
JWT_EXPIRES_IN=
JWT_REFRESH_SECRET=
JWT_REFRESH_EXPIRES_IN=
JWT_REFRESH_EXPIRES_IN_MS=
BCRYPT_DUMMY_SECRET=
RESEND_API_KEY=
EMAIL_FROM=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

## Ejecucion Local

### Instalacion

```bash
npm install
```

### Desarrollo

```bash
npm run dev
```

### Produccion local

```bash
npm start
```

### Tests

```bash
npm test
```

### Mantenimiento de búsquedas activas

Si existen criterios legacy creados antes de `criteriaSignature`, se puede ejecutar:

```bash
npm run backfill:active-searches
```

Si existen notificaciones legacy creadas antes de `dedupeKey`, se puede ejecutar:

```bash
npm run backfill:notifications
```

## Calidad y Testing

El proyecto cuenta con tests para:

- autenticación;
- publicaciones;
- intercambios;
- chat;
- administración;
- búsquedas activas;
- notificaciones;
- reputación.

La base ya no está rota por imports inconsistentes. Aun así, la corrida completa sigue dependiendo de un entorno externo de MongoDB y puede resultar lenta para feedback rápido.

Para detalle de comandos, mapa de suites, pruebas manuales con Postman, convenciones y cobertura por épica, ver [docs/TESTING.md](docs/TESTING.md).

## Situacion Actual

En terminos de madurez, el backend hoy se encuentra en una etapa intermedia-avanzada:

- el dominio principal ya está construido;
- la arquitectura es saludable;
- la lógica de negocio más importante ya existe;
- todavía hay deuda técnica y funcional que conviene atacar antes de considerar el backend como estable para producción.

Para una lectura detallada del estado real del proyecto, ver [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md).
