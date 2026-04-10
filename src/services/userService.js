const userRepository = require("../repositories/userRepository");
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
    profileComplete: user.profileComplete,
  };
};

// Retorna el perfil público del usuario autenticado.
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

module.exports = { obtenerPerfil, actualizarPerfil };
