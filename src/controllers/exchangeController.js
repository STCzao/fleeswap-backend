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

// GET /api/exchanges/received
const obtenerRecibidas = async (req, res, next) => {
  try {
    const exchanges = await exchangeService.obtenerRecibidas(req.user._id, req.query);
    res.status(200).json(exchanges);
  } catch (err) {
    next(err);
  }
};

// GET /api/exchanges/sent
const obtenerEnviadas = async (req, res, next) => {
  try {
    const exchanges = await exchangeService.obtenerEnviadas(req.user._id, req.query);
    res.status(200).json(exchanges);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  enviarSolicitud,
  obtenerRecibidas,
  obtenerEnviadas,
};
