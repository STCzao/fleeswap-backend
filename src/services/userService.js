const userRepository = require("../repositories/userRepository");
const bcrypt = require("bcrypt");
const sanitizarTexto = require("../helpers/sanitizarTexto");
const AppError = require("../helpers/AppError");

// Actualiza los campos de perfil del usuario autenticado.
// Solo permite modificar photo, bio y location — nunca campos sensibles como email, password o role.
// Sanitiza bio y location contra XSS antes de persistir.
// La URL de photo ya fue validada en el validator contra el cloud_name de Cloudinary.
const actualizarPerfil = async (userId, { photo, bio, location }) => {
  const data = {};
  if (photo !== undefined) data.photo = photo;
  if (bio !== undefined) data.bio = sanitizarTexto(bio);
  if (location !== undefined) data.location = sanitizarTexto(location);

  if (Object.keys(data).length === 0) throw new AppError("Solicitud inválida", 400);

  const user = await userRepository.updatePerfil(userId, data);
  if (!user) throw new AppError("Usuario no encontrado", 404);

  return {
    id: user._id,
    nombre: user.nombre,
    apellido: user.apellido,
    email: user.email,
    photo: user.photo,
    bio: user.bio,
    location: user.location,
    isVerified: user.isVerified,
    profileComplete: user.profileComplete,
  };
};

// Retorna el perfil propio del usuario autenticado — incluye datos privados como email e isVerified.
const obtenerPerfil = async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) throw new AppError("Usuario no encontrado", 404);

  return {
    id: user._id,
    nombre: user.nombre,
    apellido: user.apellido,
    email: user.email,
    photo: user.photo,
    bio: user.bio,
    location: user.location,
    isVerified: user.isVerified,
    profileComplete: user.profileComplete,
  };
};

// Retorna el perfil público de un usuario por id.
// Incluye datos de reputación con valores por defecto (0, []) hasta que
// los modelos Exchange, Review y Publication estén disponibles en Sprint 2.
const obtenerPerfilPublico = async (userId) => {
  const user = await userRepository.findPublicById(userId);
  if (!user) throw new AppError("Usuario no encontrado", 404);

  return {
    id: user._id,
    nombre: user.nombre,
    apellido: user.apellido,
    photo: user.photo,
    bio: user.bio,
    location: user.location,
    miembroDesde: user.createdAt,
    // TODO Sprint 2: reemplazar con datos reales de Exchange y Review
    calificacionPromedio: 0,
    intercambiosCompletados: 0,
    // TODO Sprint 2: reemplazar con publicaciones activas reales
    publicaciones: [],
  };
};

// Elimina la cuenta del usuario (soft-delete).
// Requiere la contraseña como verificación de identidad — previene eliminaciones accidentales
// o por un atacante que tenga un access token robado pero no la contraseña.
// La cuenta queda inactiva 30 días — durante ese período el login la reactiva.
// Después de 30 días, el email se libera para re-registro.
const eliminarCuenta = async (userId, password) => {
  const user = await userRepository.findByIdConPassword(userId);
  if (!user) throw new AppError("Usuario no encontrado", 404);

  const passwordValida = await bcrypt.compare(password, user.password);
  if (!passwordValida) throw new AppError("La contraseña es incorrecta", 401);

  await userRepository.softDelete(userId);
};

module.exports = { obtenerPerfil, obtenerPerfilPublico, actualizarPerfil, eliminarCuenta };
