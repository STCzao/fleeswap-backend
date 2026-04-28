const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const userRepository = require("../repositories/userRepository");
const { generateAccessToken, generateRefreshToken } = require("../helpers/generateToken");
const sanitizarTexto = require("../helpers/sanitizarTexto");
const enviarEmail = require("../helpers/enviarEmail");
const AppError = require("../helpers/AppError");

// Hash dummy generado una vez al iniciar el módulo.
// Se usa en login para que bcrypt.compare siempre ejecute su trabajo completo,
// igualando el tiempo de respuesta cuando el usuario no existe (mitiga timing attacks).
const DUMMY_HASH = bcrypt.hashSync(process.env.BCRYPT_DUMMY_SECRET, 10);

// Período de gracia para cuentas soft-deleted — 30 días en milisegundos.
// Usado en login (reactivación) y register (bloqueo de email).
const GRACIA_SOFT_DELETE_MS = 30 * 24 * 60 * 60 * 1000;

// Determina si el período de gracia de una cuenta eliminada ya expiró.
const graciaExpirada = (deletedAt) => Date.now() - deletedAt.getTime() > GRACIA_SOFT_DELETE_MS;

// Registra un nuevo usuario en la plataforma.
// Desestructura solo los campos necesarios — confirmPassword no llega al service.
// Mitiga timing attacks hasheando siempre, independientemente de si el email existe.
// Sanitiza nombre y apellido contra XSS antes de persistir.
// Genera un verificationToken (expira en 24hs) para la futura verificación via Resend.
// Verifica también usuarios inactivos (soft-deleted) para respetar la gracia de 30 días.
const register = async ({ nombre, apellido, fechaNacimiento, email, password }) => {
  // Buscar incluyendo inactivos para respetar el período de gracia
  const existing = await userRepository.findByEmailIncluyendoInactivos(email);

  if (existing) {
    // Si la cuenta está inactiva pero dentro de la gracia, el email no está disponible
    // Si la gracia expiró, el email se libera y se permite re-registrar
    if (!existing.isActive) {
      if (!graciaExpirada(existing.deletedAt)) {
        await bcrypt.compare(password, DUMMY_HASH);
        throw new AppError("El email no está disponible", 409);
      }
      // Gracia expirada — eliminar el documento viejo para liberar el email (unique index)
      await existing.deleteOne();
    } else {
      // Cuenta activa — email ya registrado
      await bcrypt.compare(password, DUMMY_HASH);
      throw new AppError("El email ya está registrado", 409);
    }
  }

  const hashed = await bcrypt.hash(password, 10);
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24hs

  const user = await userRepository.create({
    nombre: sanitizarTexto(nombre),
    apellido: sanitizarTexto(apellido),
    fechaNacimiento,
    email,
    password: hashed,
    verificationToken,
    verificationTokenExpiry,
  });

  // TODO: enviar email de verificación con Resend cuando se implemente la HU correspondiente

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  const hashedRefresh = await bcrypt.hash(refreshToken, 10);
  const refreshTokenExpiry = new Date(Date.now() + Number(process.env.JWT_REFRESH_EXPIRES_IN_MS));

  await userRepository.actualizarRefreshToken(user._id, hashedRefresh, refreshTokenExpiry);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      nombre: user.nombre,
      apellido: user.apellido,
      photo: user.photo,
      profileComplete: user.profileComplete,
    },
  };
};

// Autentica un usuario existente y emite tokens de acceso y refresco.
// Mitiga timing attacks comparando con bcrypt incluso cuando el usuario no existe.
// El refresh token se hashea con bcrypt antes de persistir — nunca se almacena en crudo.
// Si el usuario está soft-deleted y dentro del período de gracia (30 días), lo reactiva.
// Si el período de gracia expiró, la cuenta se considera eliminada definitivamente.
const login = async ({ email, password }) => {
  // Busca incluyendo usuarios inactivos para poder reactivar
  const user = await userRepository.findByEmailIncluyendoInactivos(email);

  // Hash dummy para igualar el tiempo de respuesta si el usuario no existe
  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw new AppError("Credenciales inválidas", 401);
  }

  // Cuenta eliminada — verificar si está dentro del período de gracia
  if (!user.isActive) {
    if (graciaExpirada(user.deletedAt)) {
      await bcrypt.compare(password, DUMMY_HASH);
      throw new AppError("Esta cuenta fue eliminada", 410);
    }
  }

  const passwordValida = await bcrypt.compare(password, user.password);
  if (!passwordValida) throw new AppError("Credenciales inválidas", 401);

  // Reactivar cuenta si estaba soft-deleted
  let reactivated = false;
  if (!user.isActive) {
    await userRepository.reactivarCuenta(user._id);
    reactivated = true;
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // El refresh token se almacena hasheado para que un leak de DB no permita reutilizarlos
  const hashedRefresh = await bcrypt.hash(refreshToken, 10);
  const refreshTokenExpiry = new Date(Date.now() + Number(process.env.JWT_REFRESH_EXPIRES_IN_MS));

  await userRepository.actualizarRefreshToken(user._id, hashedRefresh, refreshTokenExpiry);

  return {
    accessToken,
    refreshToken,
    reactivated,
    user: {
      id: user._id,
      nombre: user.nombre,
      apellido: user.apellido,
      photo: user.photo,
      profileComplete: user.profileComplete,
    },
  };
};

// Renueva el accessToken usando el refreshToken de la cookie httpOnly.
// Verifica firma JWT del refresh token y luego compara contra el hash en DB —
// doble validación: evita que tokens revocados (logout) sigan siendo válidos.
// Emite un nuevo par de tokens (rotation) e invalida el refresh token anterior.
const refresh = async (refreshToken) => {
  if (!refreshToken) throw new AppError("Refresh token no proporcionado", 401);

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError") throw new AppError("Sesión expirada, iniciá sesión nuevamente", 401);
    throw new AppError("Refresh token inválido", 401);
  }

  const user = await userRepository.findByIdConRefreshToken(decoded.id);
  if (!user || !user.refreshToken) throw new AppError("Sesión inválida", 401);

  // Segunda línea de defensa: verifica que el token no fue revocado en DB
  // cubre el caso de manipulación directa de DB o logout previo
  if (!user.refreshTokenExpiry || user.refreshTokenExpiry < new Date()) {
    throw new AppError("Sesión expirada, iniciá sesión nuevamente", 401);
  }

  // Verifica que el token recibido coincide con el hash almacenado en DB
  const tokenValido = await bcrypt.compare(refreshToken, user.refreshToken);
  if (!tokenValido) throw new AppError("Sesión inválida", 401);

  // Rotation: genera un nuevo par y reemplaza el refresh token en DB
  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);
  const hashedRefresh = await bcrypt.hash(newRefreshToken, 10);
  const refreshTokenExpiry = new Date(Date.now() + Number(process.env.JWT_REFRESH_EXPIRES_IN_MS));

  await userRepository.actualizarRefreshToken(user._id, hashedRefresh, refreshTokenExpiry);

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

// Invalida la sesión del usuario eliminando el refresh token de DB y limpiando la cookie.
// Usa el refresh token de la cookie para identificar al usuario — funciona aunque el
// accessToken haya expirado, evitando que el usuario quede "atrapado" sin poder cerrar sesión.
const logout = async (refreshToken) => {
  if (!refreshToken) return; // si no hay cookie, la sesión ya estaba cerrada

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    return; // token inválido o expirado — sesión ya no es válida, nada que limpiar
  }

  await userRepository.revocarRefreshToken(decoded.id);
};

// Cambia la contraseña del usuario autenticado.
// Verifica que la contraseña actual sea correcta antes de actualizar.
// Revoca el refresh token para forzar re-login en todos los dispositivos.
const cambiarPassword = async (userId, passwordActual, passwordNueva) => {
  const user = await userRepository.findByIdConPassword(userId);
  if (!user) throw new AppError("Usuario no encontrado", 404);

  const passwordValida = await bcrypt.compare(passwordActual, user.password);
  if (!passwordValida) throw new AppError("La contraseña actual es incorrecta", 401);

  const hashedPassword = await bcrypt.hash(passwordNueva, 10);
  await userRepository.actualizarPassword(userId, hashedPassword);
  await userRepository.revocarRefreshToken(userId);
};

// Genera un reset token y envía el email de recuperación.
// Responde siempre igual para no revelar si el email existe (enumeración de usuarios).
// El token se guarda como hash SHA-256 en DB — el plano solo viaja en el email.
const solicitarResetPassword = async (email) => {
  const user = await userRepository.findByEmail(email);

  // Si no existe, no hacemos nada — respuesta idéntica al caso exitoso
  if (!user) return;

  const resetTokenPlano = crypto.randomBytes(32).toString("hex");
  const resetTokenHash = crypto.createHash("sha256").update(resetTokenPlano).digest("hex");
  const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  await userRepository.actualizarResetToken(user._id, resetTokenHash, resetTokenExpiry);

  const frontendURL = process.env.FRONTEND_URL || "http://localhost:5173";
  const resetURL = `${frontendURL}/reset-password?token=${resetTokenPlano}`;

  await enviarEmail({
    to: user.email,
    subject: "Fleeswap — Recuperá tu contraseña",
    html: `
      <h2>Hola ${user.nombre},</h2>
      <p>Recibimos una solicitud para restablecer tu contraseña.</p>
      <p><a href="${resetURL}" style="display:inline-block;padding:12px 24px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:6px;">Restablecer contraseña</a></p>
      <p>Si no solicitaste este cambio, podés ignorar este email. El link expira en 1 hora.</p>
      <p>— El equipo de Fleeswap</p>
    `,
  });
};

// Resetea la contraseña usando el token enviado por email.
// Hashea el token recibido con SHA-256 y lo compara contra el hash guardado en DB.
// Si es válido y no expiró, actualiza la contraseña y revoca sesiones activas.
const resetPassword = async (token, password) => {
  const resetTokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const user = await userRepository.findByResetToken(resetTokenHash);

  if (!user) throw new AppError("Token inválido o expirado", 400);

  const hashedPassword = await bcrypt.hash(password, 10);
  await userRepository.actualizarPassword(user._id, hashedPassword);
  await userRepository.limpiarResetToken(user._id);
  await userRepository.revocarRefreshToken(user._id);
};

module.exports = { register, login, refresh, logout, cambiarPassword, solicitarResetPassword, resetPassword };
