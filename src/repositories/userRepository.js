const User = require("../models/User");

// Única capa que interactúa con el modelo User de Mongoose.

// Busca un usuario por email. Retorna el documento o null.
const findByEmail = (email) => User.findOne({ email });

// Igual que findByEmail pero incluye el campo password (excluido por select:false en el schema).
// Solo usar en flujos de autenticación que necesitan comparar credenciales.
const findByEmailConPassword = (email) => User.findOne({ email }).select("+password");

// Busca un usuario por id. Retorna el documento o null.
const findById = (id) => User.findById(id);

// Igual que findById pero incluye refreshToken (excluido por select:false).
// Solo usar en el flujo de renovación de tokens.
const findByIdConRefreshToken = (id) => User.findById(id).select("+refreshToken");

// Crea y persiste un nuevo usuario con los datos recibidos.
const create = (data) => User.create(data);

// Actualiza los campos de perfil de un usuario por id.
// { new: true } retorna el documento actualizado en lugar del anterior.
// runValidators aplica las validaciones del schema de Mongoose al actualizar.
const updatePerfil = (id, data) =>
  User.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean({ virtuals: true });

// Retorna campos públicos de un usuario por id — excluye datos sensibles.
// Reutilizable en el perfil público sin autenticación.
const findPublicById = (id) =>
  User.findById(id).select("nombre apellido photo bio location createdAt");

// Actualiza el refresh token hasheado y su expiración — usado en login y refresh.
const actualizarRefreshToken = (id, refreshToken, refreshTokenExpiry) =>
  User.findByIdAndUpdate(id, { refreshToken, refreshTokenExpiry });

// Revoca el refresh token de un usuario — usado en logout.
const revocarRefreshToken = (id) =>
  User.findByIdAndUpdate(id, { refreshToken: null, refreshTokenExpiry: null });

module.exports = { findByEmail, findByEmailConPassword, findById, findByIdConRefreshToken, create, updatePerfil, findPublicById, actualizarRefreshToken, revocarRefreshToken };
