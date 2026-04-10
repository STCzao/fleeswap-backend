const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const userRepository = require("../repositories/userRepository");
const { generateAccessToken, generateRefreshToken } = require("../helpers/generateToken");
const sanitizarTexto = require("../helpers/sanitizarTexto");
const AppError = require("../helpers/AppError");

// Hash dummy generado una vez al iniciar el módulo.
// Se usa en login para que bcrypt.compare siempre ejecute su trabajo completo,
// igualando el tiempo de respuesta cuando el usuario no existe (mitiga timing attacks).
const DUMMY_HASH = bcrypt.hashSync(process.env.BCRYPT_DUMMY_SECRET, 10);

// Registra un nuevo usuario en la plataforma.
// Desestructura solo los campos necesarios — confirmPassword no llega al service.
// Mitiga timing attacks hasheando siempre, independientemente de si el email existe.
// Sanitiza nombre y apellido contra XSS antes de persistir.
// Genera un verificationToken (expira en 24hs) para la futura verificación via Resend.
const register = async ({ nombre, apellido, fechaNacimiento, email, password }) => {
  const existing = await userRepository.findByEmail(email);

  // Dummy para igualar el tiempo de respuesta independientemente del resultado
  if (existing) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw new AppError("El email ya está registrado", 409);
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

  return {
    accessToken,
    user: {
      id: user._id,
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
    },
  };
};

// Autentica un usuario existente y emite tokens de acceso y refresco.
// Mitiga timing attacks comparando con bcrypt incluso cuando el usuario no existe.
// El refresh token se hashea con bcrypt antes de persistir — nunca se almacena en crudo.
// Retorna el accessToken en el payload y el refreshToken para ser enviado como cookie httpOnly.
const login = async ({ email, password }) => {
  const user = await userRepository.findByEmailConPassword(email);

  // Hash dummy para igualar el tiempo de respuesta si el usuario no existe
  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw new AppError("Credenciales inválidas", 401);
  }

  const passwordValida = await bcrypt.compare(password, user.password);
  if (!passwordValida) throw new AppError("Credenciales inválidas", 401);

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // El refresh token se almacena hasheado para que un leak de DB no permita reutilizarlos
  const hashedRefresh = await bcrypt.hash(refreshToken, 10);
  const refreshTokenExpiry = new Date(Date.now() + Number(process.env.JWT_REFRESH_EXPIRES_IN_MS)); // 7 días

  user.refreshToken = hashedRefresh;
  user.refreshTokenExpiry = refreshTokenExpiry;
  await user.save();

  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
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

  user.refreshToken = hashedRefresh;
  user.refreshTokenExpiry = refreshTokenExpiry;
  await user.save();

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

module.exports = { register, login, refresh, logout };
