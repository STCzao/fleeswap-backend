# Estado Tecnico del Proyecto

Fecha de referencia: 5 de junio de 2026.

## Objetivo de Este Documento

Este documento resume donde se encuentra hoy el backend desde una perspectiva técnica y de producto. No intenta definir la solucion de los proximos problemas, sino dejar una fotografia clara, profesional y accionable del estado actual.

## Diagnostico General

El proyecto tiene una base de arquitectura correcta y expresa bien su dominio. No es un backend improvisado: hay estructura por capas, validaciones, reglas de negocio razonables, soporte de moderación, autenticación con rotación de tokens, verificación de email y una suite de tests pensada por módulos.

La conclusion principal es:

- la dirección técnica es buena;
- el producto backend ya tiene forma real;
- la confiabilidad operativa mejoro, pero todavía no acompana completamente al diseño.

## Lectura Contra el Backlog MVP

Contrastado contra el Product Backlog del MVP, la foto más precisa es está:

- Épica 1: alineada.
- Épica 2: alineada.
- Épica 3: alineada.
- Épica 4: alineada.
- Épica 5: implementada en backend a nivel MVP.
- Épica 6: implementada en backend a nivel MVP.

Esto cambia una interpretación importante del proyecto: el backend no está atrasado en su núcleo transaccional y la Épica 6 ya tiene cobertura MVP. El cierre completo del proyecto depende ahora sobre todo de validación de contrato con frontend y de la deuda operativa alrededor de integraciones y entorno de test.

## Lo Mas Solido Hoy

### 1. Modelado del dominio

El proyecto ya representa con claridad sus entidades principales:

- usuarios;
- publicaciones;
- intercambios/ventas;
- mensajes;
- reportes.

Esto hace que el código sea entendible y que las reglas de negocio no esten dispersas.

### 2. Separación de responsabilidades

La estructura `routes -> controllers -> services -> repositories -> models` está bien definida. En general:

- las rutas solo orquestan validaciones y middlewares;
- los controllers permanecen delgados;
- los services concentran decisiones de negocio;
- los repositories encapsulan queries y populates.

Esta base facilita mantenimiento, refactor y cobertura de tests.

### 3. Seguridad por encima del promedio de un CRUD básico

Puntos positivos observados:

- access token y refresh token separados;
- refresh token persistido como hash y no en claro;
- rotacion de refresh token;
- cookie `httpOnly`;
- uso de `helmet`;
- control de CORS;
- validación de payloads;
- mitigacion de timing attacks en login;
- verificación de email con token y expiración;
- middleware de autorizacion por rol;
- soft-delete con revocacion de sesión.

### 4. Reglas de negocio ya maduras

Hay reglas que muestran criterio de producto:

- bloqueo de autointercambio y autocompra;
- doble confirmación para trueques;
- rechazo automático de solicitudes pendientes relacionadas tras completar una operación;
- suspensión automática de publicaciones por reportes;
- chat habilitado solo cuando el intercambio realmente avanza.

### 5. Observabilidad básica ya presente

Hoy el backend ya cuenta con una base inicial de observabilidad:

- logging con Winston;
- `requestId` por request;
- header `X-Request-Id`;
- logs de request con duracion;
- errores logueados con contexto mínimo.

No resuelve todo el frente operativo, pero ya no depende solo de `console.log`.

## Lo Que Esta Incompleto o Fragil

### 1. La suite de tests existe, pero sigue siendo costosa de operar

La base de tests ya no está rota por imports relativos y cubre módulos reales del dominio. Aun así, la confiabilidad de la corrida completa sigue dependiendo de un entorno externo de MongoDB y de tiempos de ejecucion altos.

Impacto:

- hay una base automatizada útil para regresion;
- sigue habiendo friccion operacional para usarla como feedback rápido;
- conviene seguir trabajando en estabilidad y velocidad de la suite.

### 2. Perfil público y reputación ya muestran el enriquecimiento previsto para Épica 6

El backend ya puede devolver:

- datos basicos del usuario;
- fecha de alta;
- cantidad de intercambios completados.

Hoy ya devuelve de forma real:

- publicaciones activas del usuario en su perfil público;
- reputación promedio calculada;
- calificaciones recibidas;
- cantidad de cancelaciones.

Impacto:

- la Épica 1 puede considerarse cerrada como base funcional de perfiles;
- la Épica 6 ya cuenta con una base backend coherente a nivel MVP;
- la documentación debe distinguir entre backend implementado y validación final de contrato con frontend.

### 3. Búsqueda activa y notificaciones están implementadas en backend a nivel MVP

El backlog del MVP contempla búsqueda activa, matching automático al crear publicaciones, entrega en tiempo real e historial persistente de notificaciones. Hoy esa base ya está implementada en backend y se apoya además en un slice complementario de descubrimiento: preferencias de categorías en perfil y recomendaciones para Home.

Cobertura actual:

- preferencias de categorías persistidas en el usuario;
- endpoint de recomendaciones para carrusel Home;
- búsqueda activa como entidad propia;
- multiples criterios por usuario;
- activacion y desactivacion de criterios sin eliminarlos;
- matching automático por categoría, palabras clave y tipo;
- notificaciones persistentes;
- entrega de notificaciones en tiempo real;
- centro de notificaciones con historial y estado de lectura;
- inclusión de eventos clave de intercambio dentro del mismo centro.

Impacto:

- la Épica 5 ya no está en estado inicial;
- el alcance principal del backend ya fue implementado;
- el centro de notificaciones ya cubre coincidencias de búsqueda activa y eventos clave de intercambio;
- queda como un cierre backend coherente a nivel MVP.

Lectura de cierre sugerida:

- descubrimiento por categorías preferidas para Home;
- creación y gestión de búsquedas activas;
- matching automático por coincidencia al crear publicaciones;
- notificaciones persistentes y realtime;
- centro de notificaciones con historial y estado de lectura;
- inclusión de eventos de intercambio clave en el mismo centro.

Salvedad operativa:

- la suite automatizada que valida estos flujos sigue condicionada por el entorno externo de MongoDB, por lo que la verificación integrada completa no siempre queda disponible en esta instancia.

### Detalle actual de las HU de Épica 5

- `HU5.0` Descubrimiento por preferencias de categorías.
  Estado: implementada en backend.
- `HU5.1` Crear criterio de búsqueda activa.
  Estado: implementada en backend.
- `HU5.2` Gestionar búsquedas activas.
  Estado: implementada en backend.
- `HU5.3` Recibir notificación por coincidencia.
  Estado: implementada en backend.
- `HU5.4` Centro de notificaciones.
  Estado: implementada en backend.

Cobertura actual de `H5.3`:

- el matching corre solo al crear publicaciones nuevas;
- solo procesa publicaciones `available`;
- compara keywords contra `title`, `description` e `history`;
- no notifica al owner de su propia publicación;
- deduplica a una notificación por `user + activeSearch + publication + type`.

Cobertura actual de `H5.4`:

- `GET /api/notifications` devuelve historial paginado del usuario;
- incluye `unreadCount` para distinguir leídas y no leídas;
- `PATCH /api/notifications/:id/read` marca una notificación puntual como leida;
- `PATCH /api/notifications/read-all` marca todas las no leídas del usuario;
- el centro cubre `active_search_match`, `exchange_request_received`, `exchange_request_accepted` y `exchange_request_rejected`.

Endurecimientos finales aplicados:

- `dedupeKey` autogenerada para notificaciones nuevas cuando el evento lo permite;
- indice parcial para compatibilidad con datos legacy;
- script de backfill para completar `dedupeKey` en notificaciones existentes;
- payload de intercambio enriquecido con categoría y tipo reales de la publicación solicitada;
- test realtime adicional para `exchange_request_received`.

### 4. Endurecimiento operacional todavía limitado

Si bien ya existe trazabilidad básica por request, todavía no se observa:

- monitoreo estructurado;
- alertas;
- métricas de negocio;
- auditoria más robusta;
- tableros operativos.

Impacto:

- operar incidentes sigue siendo más costoso de lo deseable;
- el proyecto todavía depende bastante del conocimiento del equipo.

### 5. Integraciones externas siguen siendo un riesgo operativo

El sistema depende de:

- MongoDB;
- Resend;
- Cloudinary.

La integracion está encapsulada y hoy tiene mejores defaults de arranque, pero aún conviene endurecer manejo de errores, fallback y visibilidad operativa.

## Riesgos Tecnicos Relevantes

### Confiabilidad

El mayor riesgo de corto plazo ya no es la ausencia total de tests, sino la dificultad de correr la suite completa con feedback rápido y consistente.

### Consistencia transaccional

Algunos flujos criticos usan transacciones en admin, lo cual es positivo. Pero no todo el dominio principal parece blindado de la misma forma ante carreras o fallos parciales.

### Integraciones externas

La salud del sistema todavía depende fuertemente de infraestructura y proveedores externos.

## Nivel de Madurez Actual

Si hubiera que clasificar el backend en una escala practica:

- no está en etapa inicial;
- no está listo para llamarlo completamente estabilizado;
- si está en una etapa funcional avanzada con deuda técnica visible.

En otras palabras:

- ya sirve como base seria del producto;
- todavía necesita una ronda de consolidacion.

## Lectura Recomendada del Momento Actual

La forma más honesta de describir donde estamos es está:

1. El proyecto ya tiene arquitectura y dominio suficientemente claros como para crecer sin reescritura completa.
2. El backend soporta bien los casos nucleares de publicaciones, intercambio, chat y autenticación.
3. El backlog MVP backend ya cubre la Épica 6 a nivel funcional, y el foco pendiente pasa por validación de contrato y deuda operativa alrededor del entorno de validación.
4. La siguiente etapa deberia combinar dos frentes: cerrar el alcance funcional faltante y consolidar confianza técnica.

## Prioridades Naturales para la Proxima Etapa

Sin entrar todavía en plan de arreglos, la siguiente etapa del proyecto deberia enfocarse en:

- estabilizar y acelerar la suite automatizada;
- validar el contrato final de frontend para reputación e historial de Épica 6;
- fortalecer observabilidad y disciplina operativa;
- endurecer integraciones externas y fallback;
- limpiar pequenas inconsistencias documentales que sigan apareciendo.

## Conclusion

El backend de Fleeswap tiene una base técnica real, decisiones de negocio coherentes y un nucleo funcional bien encaminado para el MVP. La lectura correcta no es que falte rehacer el producto, sino que falta cerrar de forma honesta el alcance comprometido del backlog y seguir consolidando su operación.

Ese es exactamente el lugar en el que se encuentra hoy el proyecto.
