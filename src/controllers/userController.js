const userService = require("../services/userService");

// GET /api/users/me/publications
// Incluye publicaciones unavailable — el owner las necesita para poder reactivarlas (H2.4).
const obtenerMisPublicaciones = async (req, res, next) => {
  try {
    const publications = await userService.obtenerMisPublicaciones(req.user._id);
    res.status(200).json(publications);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/users/me/profile  — onboarding (campos opcionales, mínimo uno)
// PUT   /api/users/me          — edición completa post-onboarding
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

// GET /api/users/:id — ruta pública, sin autenticación
const obtenerPerfilPublico = async (req, res, next) => {
  try {
    const result = await userService.obtenerPerfilPublico(req.params.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/users/me
// Soft-delete — marca la cuenta como inactiva y revoca la sesión.
// Limpia la cookie httpOnly para que el browser no envíe un refresh token ya inválido.
const eliminarCuenta = async (req, res, next) => {
  try {
    await userService.eliminarCuenta(req.user._id, req.body.password);

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.status(200).json({ message: "Cuenta eliminada correctamente. Tenés 30 días para recuperarla iniciando sesión." });
  } catch (err) {
    next(err);
  }
};

module.exports = { obtenerPerfil, obtenerPerfilPublico, actualizarPerfil, eliminarCuenta, obtenerMisPublicaciones };
