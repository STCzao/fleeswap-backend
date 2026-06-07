const notificationCenterService = require("../services/notificationCenterService");

// GET /api/notifications
// Devuelve el historial del usuario autenticado ordenado por fecha descendente.
const listar = async (req, res, next) => {
  try {
    const result = await notificationCenterService.listarPorUsuario(req.user._id, req.query);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/notifications/:id/read
// Marca una notificacion puntual como leida si pertenece al usuario autenticado.
const marcarLeida = async (req, res, next) => {
  try {
    const notification = await notificationCenterService.marcarLeida(
      req.params.id,
      req.user._id,
    );
    res.status(200).json(notification);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/notifications/read-all
// Marca todas las notificaciones no leidas del usuario autenticado como leidas.
const marcarTodasLeidas = async (req, res, next) => {
  try {
    const result = await notificationCenterService.marcarTodasLeidas(req.user._id);
    res.status(200).json({
      message: "Notificaciones marcadas como leidas",
      ...result,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listar,
  marcarLeida,
  marcarTodasLeidas,
};
