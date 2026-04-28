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

// Busca un usuario por id incluyendo el campo password — usado en cambio de contraseña.
const findByIdConPassword = (id) => User.findById(id).select("+password");

// Actualiza el hash de la contraseña de un usuario — usado en cambio y reset de contraseña.
const actualizarPassword = (id, password) =>
  User.findByIdAndUpdate(id, { password });

// Guarda el hash SHA-256 del reset token y su expiración — usado en forgot-password.
// El token plano solo se envía por email, en DB se guarda el hash.
const actualizarResetToken = (id, resetToken, resetTokenExpiry) =>
  User.findByIdAndUpdate(id, { resetToken, resetTokenExpiry });

// Busca un usuario por el hash del reset token y verifica que no haya expirado.
// Incluye +resetToken para poder validar la coincidencia.
const findByResetToken = (resetTokenHash) =>
  User.findOne({ resetToken: resetTokenHash, resetTokenExpiry: { $gt: new Date() } }).select("+resetToken");

// Limpia el reset token después de un reset exitoso — invalida el link.
const limpiarResetToken = (id) =>
  User.findByIdAndUpdate(id, { resetToken: null, resetTokenExpiry: null });

// Marca un usuario como eliminado (soft-delete) — no borra el documento.
// El query middleware filtrará este usuario de todas las queries normales.
const softDelete = (id) =>
  User.findByIdAndUpdate(id, { isActive: false, deletedAt: new Date(), refreshToken: null, refreshTokenExpiry: null });

// Reactiva una cuenta eliminada dentro del período de gracia (30 días).
// Usa findOneAndUpdate con isActive en el filtro para bypassear el query middleware
// que normalmente excluye usuarios inactivos.
const reactivarCuenta = (id) =>
  User.findOneAndUpdate({ _id: id, isActive: { $exists: true } }, { isActive: true, deletedAt: null });

// Busca por email incluyendo usuarios inactivos — bypasea el query middleware.
// Usado en register (para respetar la gracia de 30 días) y login (para reactivación).
const findByEmailIncluyendoInactivos = (email) =>
  User.findOne({ email, isActive: { $exists: true } }).select("+password");

module.exports = { findByEmail, findByEmailConPassword, findById, findByIdConRefreshToken, findByIdConPassword, create, updatePerfil, findPublicById, actualizarRefreshToken, revocarRefreshToken, actualizarPassword, actualizarResetToken, findByResetToken, limpiarResetToken, softDelete, reactivarCuenta, findByEmailIncluyendoInactivos };
