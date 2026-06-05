# Fleeswap Backend

Backend de Fleeswap, una plataforma orientada a publicaciones de objetos, trueques entre usuarios, compras directas, mensajeria contextual y moderacion administrativa.

Fecha de esta documentacion: 5 de junio de 2026.

## Resumen Ejecutivo

Este proyecto implementa una API REST sobre Node.js y Express, persistencia con MongoDB a traves de Mongoose, autenticacion basada en JWT con refresh token en cookie httpOnly, verificacion de email y chat en tiempo real con Socket.IO.

Hoy el backend ya expresa con claridad el dominio principal del producto:

- Gestion de usuarios con perfil publico y privado.
- Publicaciones con filtros, estados y reporte por moderacion.
- Solicitudes de trueque y compra directa.
- Flujo de aceptacion, rechazo, confirmacion y cancelacion de intercambios.
- Chat en tiempo real limitado al contexto de un intercambio activo.
- Panel administrativo para usuarios, publicaciones, reportes y metricas.

La base arquitectonica es buena: hay separacion por capas, reglas de negocio visibles en services, validaciones consistentes y varias decisiones correctas de seguridad. Al mismo tiempo, el proyecto todavia presenta deuda operativa y funcional que conviene tener explicitada. El detalle esta en [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md).

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

- publicar objetos con historia, categoria y estado;
- permitir propuestas entre usuarios sobre publicaciones disponibles;
- soportar tanto trueque como compra directa;
- habilitar comunicacion en tiempo real cuando una solicitud se activa;
- moderar contenido y comportamiento mediante reportes y herramientas de admin.

## Estado Actual del Producto

### Funcionalidades implementadas

- Registro y login de usuarios.
- Verificacion de email y reenvio de verificacion.
- Refresh token por cookie y cierre de sesion.
- Cambio y recuperacion de contrasena.
- Perfil propio y perfil publico.
- Actualizacion de perfil con foto, biografia y localidad.
- Soft-delete de cuenta con ventana de recuperacion.
- Alta, edicion, eliminacion, listado y detalle de publicaciones.
- Reporte de publicaciones y suspension automatica por volumen de reportes.
- Solicitudes de intercambio y compra.
- Gestion de bandeja de solicitudes recibidas y enviadas.
- Confirmacion y cancelacion de intercambios.
- Chat por Socket.IO para intercambios activos.
- Endpoints administrativos para usuarios, publicaciones, reportes y metricas.
- Logging con `requestId` y trazabilidad basica por request.

### Funcionalidades parciales o pendientes

- Perfil publico completo: hoy devuelve datos basicos e intercambios completados, pero no expone todavia publicaciones activas del usuario ni una reputacion real.
- Sistema de reputacion: no existe aun el flujo de calificaciones, comentarios ni promedio real post-intercambio.
- Preferencias de categorias y recomendaciones para Home: implementadas como HU complementaria de descubrimiento dentro de la Epica 5.
- Busqueda activa y notificaciones persistentes: existe ya la base de `H5.1` para crear criterios, pero siguen pendientes matching automatico, persistencia de notificaciones y centro de notificaciones.
- Suite de tests: existe una base amplia y funcional, pero sigue dependiendo de un entorno externo y tiene tiempos de corrida altos.
- Observabilidad y endurecimiento operativo: existe trazabilidad basica, pero no todavia una estrategia completa de metricas, alertas y auditoria.

## Alineacion con el Backlog MVP

Tomando como referencia el Product Backlog MVP, el backend actual se alinea de esta forma:

- Epica 1 - Gestion de Usuarios y Perfiles: alineacion alta.
- Epica 2 - Gestion de Publicaciones: alineacion alta.
- Epica 3 - Sistema de Intercambio: alineacion alta.
- Epica 4 - Chat en Tiempo Real: alineacion alta.
- Epica 5 - Busqueda Activa y Notificaciones: implementacion inicial.
- Epica 6 - Sistema de Reputacion: implementacion parcial.

### Detalle por epica

#### Epica 1 - Gestion de Usuarios y Perfiles

Cobertura actual:

- registro, login, refresh y logout;
- verificacion y reenvio de verificacion de email;
- cambio y recuperacion de contrasena;
- perfil propio;
- edicion de perfil;
- soft-delete con reactivacion en periodo de gracia.

Desfasajes frente al backlog:

- el perfil publico ya esta operativo como base funcional;
- su enriquecimiento reputacional depende de la Epica 6.

#### Epica 2 - Gestion de Publicaciones

Cobertura actual:

- crear, editar, eliminar y cambiar estado;
- ver detalle y listado publico;
- filtros por categoria, tipo, condicion y texto;
- reporte de publicaciones con bloqueo de duplicados;
- suspension automatica por umbral de reportes.

Observacion:

- esta es una de las epicas mas alineadas con el backlog del MVP.

#### Epica 3 - Sistema de Intercambio

Cobertura actual:

- envio de solicitudes de trueque y compra;
- bandejas de recibidas y enviadas;
- aceptacion y rechazo;
- confirmacion de intercambio o venta;
- cancelacion de solicitudes pendientes o activas.

Reglas ya cubiertas:

- no autointercambio/autocompra;
- no duplicados activos por requester y publicacion;
- doble confirmacion en trueque;
- rechazo automatico de solicitudes pendientes relacionadas al cerrar una operacion.

#### Epica 4 - Chat en Tiempo Real

Cobertura actual:

- acceso al chat solo para participantes;
- habilitacion del chat solo cuando el intercambio esta `active`;
- mensajeria en tiempo real con Socket.IO;
- historial accesible por REST para intercambios cerrados;
- paso a modo solo lectura al completar o cancelar.

Observacion:

- la arquitectura de sockets esta centrada hoy exclusivamente en chat, no en notificaciones de producto.

#### Epica 5 - Busqueda Activa y Notificaciones

Estado actual:

- implementacion inicial en backend.

Lo observado en el codigo:

- ya existe una HU complementaria de descubrimiento basada en `preferredCategories` del usuario y `GET /api/publications/recommendations`.
- esa HU cubre sugerencias personalizadas para el carrusel del Home, pero no reemplaza la busqueda activa definida en backlog.
- siguen pendientes la entidad de busqueda activa, su gestion completa, el matching automatico por coincidencia, las notificaciones persistentes y los eventos de producto en tiempo real.

Lectura funcional sugerida:

- descubrimiento por preferencias de categorias;
- busqueda activa como interes puntual persistente;
- notificacion por coincidencia como consecuencia automatica de esa busqueda activa.

#### Epica 6 - Sistema de Reputacion

Cobertura actual:

- se cuenta la cantidad de intercambios completados por usuario;
- ese dato ya puede mostrarse en perfil.

Pendientes frente al backlog:

- calificacion de 1 a 5 y comentario;
- plazo de 7 dias post-intercambio;
- promedio real de reputacion;
- listado de calificaciones recibidas;
- cantidad de cancelaciones en perfil;
- historial completo de intercambios como funcionalidad dedicada de usuario.

## Arquitectura

La aplicacion sigue una estructura en capas:

- `src/routes`: define el contrato HTTP.
- `src/controllers`: adapta request/response y delega.
- `src/services`: contiene reglas de negocio.
- `src/repositories`: encapsula acceso a datos con Mongoose.
- `src/models`: esquemas y restricciones de persistencia.
- `src/middlewares`: autenticacion, autorizacion, validacion, contexto de request y manejo de errores.
- `src/helpers`: utilidades transversales.
- `src/sockets`: autenticacion socket y handlers de chat.
- `test`: suite automatizada por modulos funcionales.

### Flujo de request

1. La ruta aplica validaciones y middlewares.
2. El controller recibe datos ya normalizados.
3. El service ejecuta reglas de negocio.
4. El repository interactua con MongoDB.
5. Los errores operacionales se convierten en respuestas HTTP mediante `errorHandler`.

### Principios que ya se observan en el codigo

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
- sanitizacion basica de `req.body` frente a NoSQL injection;
- JWT para access token;
- refresh token en cookie `httpOnly`;
- refresh token hasheado en base;
- verificacion de email por token;
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

### Exchanges

- `GET /api/exchanges/received`
- `GET /api/exchanges/sent`
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

Autenticacion:

- el cliente debe enviar el access token en `handshake.auth.token`.

Eventos soportados:

- `chat:join`
- `chat:enabled`
- `chat:message`
- `chat:readonly`

## Variables de Entorno

Las variables observadas en el codigo son:

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

## Calidad y Testing

El proyecto cuenta con tests para:

- autenticacion;
- publicaciones;
- intercambios;
- chat;
- administracion.

La base ya no esta rota por imports inconsistentes. Aun asi, la corrida completa sigue dependiendo de un entorno externo de MongoDB y puede resultar lenta para feedback rapido.

## Situacion Actual

En terminos de madurez, el backend hoy se encuentra en una etapa intermedia-avanzada:

- el dominio principal ya esta construido;
- la arquitectura es saludable;
- la logica de negocio mas importante ya existe;
- todavia hay deuda tecnica y funcional que conviene atacar antes de considerar el backend como estable para produccion.

Para una lectura detallada del estado real del proyecto, ver [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md).
