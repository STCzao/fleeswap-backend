# Estado Tecnico del Proyecto

Fecha de referencia: 3 de junio de 2026.

## Objetivo de Este Documento

Este documento resume donde se encuentra hoy el backend desde una perspectiva tecnica y de producto. No intenta definir la solucion de los proximos problemas, sino dejar una fotografia clara, profesional y accionable del estado actual.

## Diagnostico General

El proyecto tiene una base de arquitectura correcta y expresa bien su dominio. No es un backend improvisado: hay estructura por capas, validaciones, reglas de negocio razonables, soporte de moderacion, autenticacion con rotacion de tokens, verificacion de email y una suite de tests pensada por modulos.

La conclusion principal es:

- la direccion tecnica es buena;
- el producto backend ya tiene forma real;
- la confiabilidad operativa mejoro, pero todavia no acompana completamente al diseno.

## Lectura Contra el Backlog MVP

Contrastado contra el Product Backlog del MVP, la foto mas precisa es esta:

- Epica 1: alineada.
- Epica 2: alineada.
- Epica 3: alineada.
- Epica 4: alineada.
- Epica 5: no implementada todavia.
- Epica 6: parcial.

Esto cambia una interpretacion importante del proyecto: el backend no esta atrasado en su nucleo transaccional, pero el MVP backlog completo aun no esta cerrado porque faltan las capacidades de descubrimiento, notificacion y reputacion.

## Lo Mas Solido Hoy

### 1. Modelado del dominio

El proyecto ya representa con claridad sus entidades principales:

- usuarios;
- publicaciones;
- intercambios/ventas;
- mensajes;
- reportes.

Esto hace que el codigo sea entendible y que las reglas de negocio no esten dispersas.

### 2. Separacion de responsabilidades

La estructura `routes -> controllers -> services -> repositories -> models` esta bien definida. En general:

- las rutas solo orquestan validaciones y middlewares;
- los controllers permanecen delgados;
- los services concentran decisiones de negocio;
- los repositories encapsulan queries y populates.

Esta base facilita mantenimiento, refactor y cobertura de tests.

### 3. Seguridad por encima del promedio de un CRUD basico

Puntos positivos observados:

- access token y refresh token separados;
- refresh token persistido como hash y no en claro;
- rotacion de refresh token;
- cookie `httpOnly`;
- uso de `helmet`;
- control de CORS;
- validacion de payloads;
- mitigacion de timing attacks en login;
- verificacion de email con token y expiracion;
- middleware de autorizacion por rol;
- soft-delete con revocacion de sesion.

### 4. Reglas de negocio ya maduras

Hay reglas que muestran criterio de producto:

- bloqueo de autointercambio y autocompra;
- doble confirmacion para trueques;
- rechazo automatico de solicitudes pendientes relacionadas tras completar una operacion;
- suspension automatica de publicaciones por reportes;
- chat habilitado solo cuando el intercambio realmente avanza.

### 5. Observabilidad basica ya presente

Hoy el backend ya cuenta con una base inicial de observabilidad:

- logging con Winston;
- `requestId` por request;
- header `X-Request-Id`;
- logs de request con duracion;
- errores logueados con contexto minimo.

No resuelve todo el frente operativo, pero ya no depende solo de `console.log`.

## Lo Que Esta Incompleto o Fragil

### 1. La suite de tests existe, pero sigue siendo costosa de operar

La base de tests ya no esta rota por imports relativos y cubre modulos reales del dominio. Aun asi, la confiabilidad de la corrida completa sigue dependiendo de un entorno externo de MongoDB y de tiempos de ejecucion altos.

Impacto:

- hay una base automatizada util para regresion;
- sigue habiendo friccion operacional para usarla como feedback rapido;
- conviene seguir trabajando en estabilidad y velocidad de la suite.

### 2. Perfil publico y reputacion todavia no muestran el enriquecimiento previsto para Epica 6

El backend ya puede devolver:

- datos basicos del usuario;
- fecha de alta;
- cantidad de intercambios completados.

Pero todavia no devuelve de forma real:

- publicaciones activas del usuario en su perfil publico;
- reputacion promedio calculada;
- calificaciones recibidas;
- cantidad de cancelaciones.

Impacto:

- la Epica 1 puede considerarse cerrada como base funcional de perfiles;
- la Epica 6 todavia no puede considerarse implementada;
- la documentacion debe evitar dar a entender que la reputacion ya existe como funcionalidad cerrada.

### 3. Busqueda activa y notificaciones aun no arrancaron en backend

El backlog del MVP contempla wishlist/busqueda activa, matching automatico al crear publicaciones, entrega en tiempo real e historial persistente de notificaciones. Hoy no aparecen esos modulos en el codigo operativo.

Lo que si existe es una senal de intencion:

- referencias comentadas a rutas futuras de `wishlist` y `notifications`.

Impacto:

- la Epica 5 sigue pendiente de punta a punta;
- no conviene presentar el MVP como cerrado si esa epica sigue dentro del alcance acordado;
- el siguiente sprint puede encararse sobre una arquitectura sana, pero no sobre una base ya implementada.

### 4. Endurecimiento operacional todavia limitado

Si bien ya existe trazabilidad basica por request, todavia no se observa:

- monitoreo estructurado;
- alertas;
- metricas de negocio;
- auditoria mas robusta;
- tableros operativos.

Impacto:

- operar incidentes sigue siendo mas costoso de lo deseable;
- el proyecto todavia depende bastante del conocimiento del equipo.

### 5. Integraciones externas siguen siendo un riesgo operativo

El sistema depende de:

- MongoDB;
- Resend;
- Cloudinary.

La integracion esta encapsulada y hoy tiene mejores defaults de arranque, pero aun conviene endurecer manejo de errores, fallback y visibilidad operativa.

## Riesgos Tecnicos Relevantes

### Confiabilidad

El mayor riesgo de corto plazo ya no es la ausencia total de tests, sino la dificultad de correr la suite completa con feedback rapido y consistente.

### Consistencia transaccional

Algunos flujos criticos usan transacciones en admin, lo cual es positivo. Pero no todo el dominio principal parece blindado de la misma forma ante carreras o fallos parciales.

### Integraciones externas

La salud del sistema todavia depende fuertemente de infraestructura y proveedores externos.

## Nivel de Madurez Actual

Si hubiera que clasificar el backend en una escala practica:

- no esta en etapa inicial;
- no esta listo para llamarlo completamente estabilizado;
- si esta en una etapa funcional avanzada con deuda tecnica visible.

En otras palabras:

- ya sirve como base seria del producto;
- todavia necesita una ronda de consolidacion.

## Lectura Recomendada del Momento Actual

La forma mas honesta de describir donde estamos es esta:

1. El proyecto ya tiene arquitectura y dominio suficientemente claros como para crecer sin reescritura completa.
2. El backend soporta bien los casos nucleares de publicaciones, intercambio, chat y autenticacion.
3. El backlog MVP todavia no esta completamente materializado por la ausencia de Epica 5 y la parcialidad de Epica 6.
4. La siguiente etapa deberia combinar dos frentes: cerrar el alcance funcional faltante y consolidar confianza tecnica.

## Prioridades Naturales para la Proxima Etapa

Sin entrar todavia en plan de arreglos, la siguiente etapa del proyecto deberia enfocarse en:

- estabilizar y acelerar la suite automatizada;
- desarrollar Epica 5 sobre la arquitectura existente;
- cerrar los faltantes funcionales de Epica 6;
- fortalecer observabilidad y disciplina operativa;
- endurecer integraciones externas y fallback;
- limpiar pequenas inconsistencias documentales que sigan apareciendo.

## Conclusion

El backend de Fleeswap tiene una base tecnica real, decisiones de negocio coherentes y un nucleo funcional bien encaminado para el MVP. La lectura correcta no es que falte rehacer el producto, sino que falta cerrar de forma honesta el alcance comprometido del backlog y seguir consolidando su operacion.

Ese es exactamente el lugar en el que se encuentra hoy el proyecto.
