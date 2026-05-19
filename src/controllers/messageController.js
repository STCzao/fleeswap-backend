const messageService = require("../services/messageService");

// GET /api/exchanges/:id/messages
const obtenerMensajes = async (req, res, next) => {
  try {
    const result = await messageService.obtenerMensajes(req.user._id, req.params.id, req.query);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  obtenerMensajes,
};
