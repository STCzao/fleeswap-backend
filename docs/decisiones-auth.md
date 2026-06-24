# Decisiones de Diseno — Autenticacion y Sesion

Este documento registra decisiones de diseno sobre el flujo de autenticacion que fueron acordadas pero **todavia no implementadas**, para que no se pierdan entre conversaciones y se apliquen consistentemente cuando llegue el momento.

---

## Pendiente: `register` no deberia devolver tokens

**Fecha:** 24 de junio de 2026.

**Estado actual del codigo (verificar antes de asumir que sigue igual):**

- `POST /api/auth/register` (`src/controllers/authController.js`) genera y devuelve `accessToken` + `refreshToken` (via cookie httpOnly), exactamente igual que `POST /api/auth/login`.
- `authService.login` (`src/services/authService.js`) no chequea `isVerified`: un usuario recien registrado, sin verificar su email, ya puede loguearse y usar la plataforma con normalidad.
- No existe ningun gate de `isVerified` en middlewares ni controllers.

### Decision

`register` no deberia emitir sesion (`accessToken`/`refreshToken`). El registro debe terminar en "revisa tu email", no en sesion iniciada. Es decir, debe comportarse mas parecido a `forgotPassword`/`resetPassword` (que solo devuelven `message`) que a `login`.

### Por que

La intencion del equipo es agregar verificacion de email obligatoria en el corto plazo, usando Resend (que ya se usa para el envio de los mails de verificacion y de recuperacion de contraseña). Si se deja que `register` auto-loguee al usuario como hace hoy, el dia que se agregue el gate de verificacion hay que volver a tocar `register` para sacarle los tokens — trabajo duplicado. Sacandolos desde ahora, el contrato de la API queda estable: cuando llegue la verificacion obligatoria, el gate (`if (!user.isVerified) throw ...`) se agrega unicamente en `login`, sin tener que tocar `register` de nuevo.

### Como implementarlo (cuando se decida avanzar)

1. `authService.register`: dejar de generar y persistir `accessToken`/`refreshToken`. Devolver solo `user` (sin tokens).
2. `authController.register`: responder `201` con `{ message, user }`, sin `res.cookie("refreshToken", ...)`.
3. Actualizar el test `"registro exitoso -> 201 + accessToken + user sin password"` en `test/integration/auth/auth.test.js` (la aserción sobre `accessToken` deja de aplicar).
4. **Frontend:** despues de un registro exitoso, seguir redirigiendo (a `/login` o a una pantalla de "verifica tu email"), nunca auto-loguear al usuario. Esto es lo opuesto a tratar la respuesta de `register` igual que la de `login` — aplicar el patron de sesion de Zustand (ver flujo de auth del frontend) solo a `login` real.
5. El gate de verificacion obligatoria (rechazar `login` si `!isVerified`) se agrega en `authService.login` recien cuando se integre Resend para ese flujo especifico — no antes, y no como parte de este cambio.

### Que NO cambia con esta decision

- `login` sigue sin requerir `isVerified` hasta que se implemente el punto 5 por separado.
- No se toca el flujo de `verify-email` / `resend-verification`, que ya existe y funciona independientemente de esto.
