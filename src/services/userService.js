const userRepository = require("../repositories/userRepository");
const exchangeRepository = require("../repositories/exchangeRepository");
const publicationRepository = require("../repositories/publicationRepository");
const reviewRepository = require("../repositories/reviewRepository");
const bcrypt = require("bcrypt");
const sanitizarTexto = require("../helpers/sanitizarTexto");
const { buildPagination } = require("../helpers/buildPagination");
const AppError = require("../helpers/AppError");

// Actualiza los campos de perfil del usuario autenticado.
// Solo permite modificar photo, bio, location y preferredCategories: nunca campos sensibles como email, password o role.
// Sanitiza bio contra XSS antes de persistir.
// La URL de photo ya fue validada en el validator contra el cloud_name de Cloudinary.
// location proviene de un enum controlado, no de texto libre.
const actualizarPerfil = async (userId, { photo, bio, location, preferredCategories }) => {
  const data = {};
  if (photo !== undefined) data.photo = photo;
  if (bio !== undefined) data.bio = sanitizarTexto(bio);
  if (location !== undefined) data.location = location;
  if (preferredCategories !== undefined) data.preferredCategories = preferredCategories;

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
    preferredCategories: user.preferredCategories,
    isVerified: user.isVerified,
    profileComplete: user.profileComplete,
  };
};

// Retorna el perfil propio del usuario autenticado: incluye datos privados como email e isVerified.
const obtenerPerfil = async (userId) => {
  const [user, intercambiosCompletados, comprasCompletadas, ventasCompletadas] = await Promise.all([
    userRepository.findById(userId),
    exchangeRepository.countCompletedExchangesByUser(userId),
    exchangeRepository.countCompletedPurchasesByUser(userId),
    exchangeRepository.countCompletedSalesByUser(userId),
  ]);
  if (!user) throw new AppError("Usuario no encontrado", 404);

  return {
    id: user._id,
    nombre: user.nombre,
    apellido: user.apellido,
    email: user.email,
    photo: user.photo,
    bio: user.bio,
    location: user.location,
    preferredCategories: user.preferredCategories,
    isVerified: user.isVerified,
    profileComplete: user.profileComplete,
    intercambiosCompletados,
    comprasCompletadas,
    ventasCompletadas,
  };
};

const obtenerPerfilPublico = async (userId) => {
  const [
    user,
    totalIntercambiosCompletados,
    intercambiosCompletados,
    comprasCompletadas,
    ventasCompletadas,
    cancelaciones,
    reputation,
    calificacionesRecibidas,
    publicaciones,
  ] = await Promise.all([
    userRepository.findPublicById(userId),
    exchangeRepository.countCompletedByUser(userId),
    exchangeRepository.countCompletedExchangesByUser(userId),
    exchangeRepository.countCompletedPurchasesByUser(userId),
    exchangeRepository.countCompletedSalesByUser(userId),
    exchangeRepository.countCancelledByUser(userId),
    reviewRepository.getStatsByUser(userId),
    reviewRepository.findReceivedByUser(userId, { limit: 5 }),
    publicationRepository.findPublicAvailableByOwner(userId, 10),
  ]);
  if (!user) throw new AppError("Usuario no encontrado", 404);

  return {
    id: user._id,
    nombre: user.nombre,
    apellido: user.apellido,
    photo: user.photo,
    bio: user.bio,
    location: user.location,
    miembroDesde: user.createdAt,
    calificacionPromedio: reputation.averageRating,
    totalCalificaciones: reputation.totalReviews,
    calificacionesRecibidas,
    totalIntercambiosCompletados,
    intercambiosCompletados,
    comprasCompletadas,
    ventasCompletadas,
    cancelaciones,
    publicaciones,
  };
};

// Elimina la cuenta del usuario (soft-delete).
// Requiere la contraseña como verificación de identidad: previene eliminaciones accidentales
// o por un atacante que tenga un access token robado pero no la contraseña.
// La cuenta queda inactiva 30 días: durante ese periodo el login la reactiva.
// Despues de 30 días, el email se libera para re-registro.
const eliminarCuenta = async (userId, password) => {
  const user = await userRepository.findByIdConPassword(userId);
  if (!user) throw new AppError("Usuario no encontrado", 404);

  const passwordValida = await bcrypt.compare(password, user.password);
  if (!passwordValida) throw new AppError("La contraseña es incorrecta", 401);

  await userRepository.softDelete(userId);
};

// Devuelve todas las publicaciones del usuario autenticado: available y unavailable.
// A diferencia del listado público, el owner necesita ver sus publicaciones pausadas para gestionarlas.
const obtenerMisPublicaciones = (userId) => publicationRepository.findByOwner(userId);

const obtenerRecomendaciones = async (userId, limit = 10) => {
  const user = await userRepository.findById(userId);
  if (!user) throw new AppError("Usuario no encontrado", 404);
  const { limit: resolvedLimit } = buildPagination({ limit }, 10);

  const preferredCategories = user.preferredCategories || [];
  if (preferredCategories.length === 0) {
    return {
      publications: [],
      basedOnCategories: [],
    };
  }

  const publications = await publicationRepository.findRecommendedByCategories(
    userId,
    preferredCategories,
    resolvedLimit,
  );

  return {
    publications,
    basedOnCategories: preferredCategories,
  };
};

module.exports = {
  obtenerPerfil,
  obtenerPerfilPublico,
  actualizarPerfil,
  eliminarCuenta,
  obtenerMisPublicaciones,
  obtenerRecomendaciones,
};
