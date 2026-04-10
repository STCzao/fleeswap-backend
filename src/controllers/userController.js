const userService = require("../services/userService");

// PATCH /api/users/me/profile
// req.user es inyectado por el middleware authenticate.
// Solo delega al service y propaga errores al errorHandler global via next(err).
const actualizarPerfil = async (req, res, next) => {
  try {
    const result = await userService.actualizarPerfil(req.user._id, req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

// GET /api/users/me
const obtenerPerfil = async (req, res, next) => {
  try {
    const result = await userService.obtenerPerfil(req.user._id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

// PUT /api/users/me
// Edición completa del perfil post-onboarding.
// Reutiliza la misma lógica que actualizarPerfil — mismos campos permitidos.
const editarPerfil = async (req, res, next) => {
  try {
    const result = await userService.actualizarPerfil(req.user._id, req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

// GET /api/users/:id — ruta pública, sin autenticación
const obtenerPerfilPublico = async (req, res, next) => {
  try {
    const result = await userService.obtenerPerfilPublico(req.params.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = { obtenerPerfil, obtenerPerfilPublico, actualizarPerfil, editarPerfil };
