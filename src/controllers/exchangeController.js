const exchangeService = require("../services/exchangeService");

// POST /api/exchanges
const enviarSolicitud = async (req, res, next) => {
  try {
    const exchange = await exchangeService.enviarSolicitud(req.user._id, req.body);
    res.status(201).json(exchange);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  enviarSolicitud,
};
