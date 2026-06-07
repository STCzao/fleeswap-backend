# Estado Tecnico del Proyecto

Fecha de referencia: 5 de junio de 2026.

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
- Epica 5: parcial.
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

### 3. Busqueda activa y notificaciones estan iniciadas, pero lejos de cerrarse

El backlog del MVP contempla busqueda activa, matching automatico al crear publicaciones, entrega en tiempo real e historial persistente de notificaciones. Hoy existe un primer slice complementario de descubrimiento: preferencias de categorias en perfil y recomendaciones para Home.

Lo que hoy existe de forma concreta es:

- preferencias de categorias persistidas en el usuario;
- endpoint de recomendaciones para carrusel Home.

Y lo que sigue pendiente es:

- busqueda activa como entidad propia;
- multiples criterios por usuario;
- activacion/desactivacion de criterios sin eliminarlos;
- matching automatico por categoria, palabras clave y tipo;
- notificaciones persistentes;
- entrega de notificaciones en tiempo real;
- centro de notificaciones con estado de lectura.

Impacto:

- la Epica 5 ya fue iniciada pero sigue lejos de cerrarse;
- no conviene presentar el MVP como cerrado si esa epica sigue dentro del alcance acordado;
- el siguiente sprint ya puede apoyarse sobre una primera base de descubrimiento;
- lo implementado hasta ahora no reemplaza la HU formal de busqueda activa, sino que la complementa.

## Detalle de Implementacion Prevista para Epica 5

Para evitar ambiguedades entre "buscar ahora", "descubrir sugerencias" y "recibir alertas", la Epica 5 se va a encarar en dos capas funcionales.

### Capa ya iniciada: descubrimiento personalizado

Esta parte ya tiene una base implementada:

- `preferredCategories` en perfil de usuario;
- recomendaciones para el Home basadas en categorias preferidas;
- exclusion de publicaciones propias y filtro de publicaciones disponibles.

Rol funcional:

- empujar contenido relevante al usuario;
- mejorar el carrusel del Home;
- complementar la exploracion general del catalogo.

### Capa a implementar: busqueda activa y notificaciones

Esta es la parte que corresponde al backlog formal de la epica y que todavia falta desarrollar.

#### HU complementaria incorporada a la epica

Se suma una HU nueva de descubrimiento:

- el usuario puede seleccionar categorias de interes en su perfil;
- el sistema usa esas preferencias para sugerir publicaciones en el Home.

Esta HU complementa la epica, pero no sustituye las historias originales del backlog.

#### HU formales a implementar

Sobre la base del Product Backlog, lo siguiente a desarrollar es:

1. Crear criterio de busqueda activa.
2. Gestionar busquedas activas.
3. Recibir notificacion por coincidencia.
4. Centro de notificaciones.

#### Desglose operativo de HU

Para implementarlas una por una sin mezclar responsabilidades, la Epica 5 queda detallada asi:

- `HU5.0` Descubrimiento por preferencias de categorias.
  Como usuario autenticado, quiero seleccionar categorias de interes en mi perfil para recibir sugerencias relevantes en el Home.
  Estado: base ya implementada.
- `HU5.1` Crear criterio de busqueda activa.
  Como usuario autenticado, quiero registrar un criterio de busqueda por categoria, palabras clave y tipo para ser notificado cuando aparezca una coincidencia.
  Estado: base implementada.
- `HU5.2` Gestionar busquedas activas.
  Como usuario autenticado, quiero listar, editar, activar, desactivar y eliminar mis criterios para mantener alertas relevantes.
  Estado: implementada en backend.
- `HU5.3` Recibir notificacion por coincidencia.
  Como usuario autenticado, quiero recibir una notificacion automatica cuando una nueva publicacion coincide con uno de mis criterios activos.
  Estado: pendiente.
- `HU5.4` Centro de notificaciones.
  Como usuario autenticado, quiero consultar el historial de notificaciones y su estado de lectura para revisar alertas recientes y pasadas.
  Estado: pendiente.

#### Alcance tecnico previsto

Lo que vamos a implementar para cubrir esas HU es:

- modelo propio para busquedas activas;
- criterios por categoria, palabras clave y tipo (`trade`, `sale` o ambos);
- multiples criterios por usuario;
- activacion y desactivacion sin borrado obligatorio;
- endpoints CRUD para administrar criterios;
- proceso de matching al crear una publicacion nueva;
- persistencia de notificaciones en base de datos;
- entrega en tiempo real al usuario conectado;
- listado de notificaciones ordenadas por fecha;
- marcado individual y masivo como leidas.

#### Orden de desarrollo previsto

El orden planeado para implementarlo es:

1. entidad y CRUD de busqueda activa;
2. matching automatico al alta de publicaciones;
3. persistencia de notificaciones;
4. eventos en tiempo real;
5. centro de notificaciones y estado de lectura.

#### Implementacion inmediata

Entrega tecnica ya aplicada para `HU5.1`:

- modelo dedicado para criterios de busqueda activa;
- persistencia de multiples criterios por usuario;
- validacion de categoria, palabras clave y tipo;
- estado `isActive` para dejar preparada la activacion/desactivacion;
- endpoint autenticado para crear criterios nuevos;
- endpoint autenticado para listar criterios del usuario como base de `HU5.2`;
- endpoint autenticado para editar criterios existentes;
- soporte de activacion y desactivacion por `PATCH`;
- endpoint autenticado para eliminar criterios;
- deduplicacion logica de criterios normalizados por usuario;
- compatibilidad con datos legacy mediante `criteriaSignature` canonica e indice parcial;
- script de backfill para completar criterios viejos si fuera necesario.

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
3. El backlog MVP todavia no esta completamente materializado por la parcialidad de Epica 5 y la parcialidad de Epica 6.
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
