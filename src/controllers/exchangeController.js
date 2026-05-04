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

// PATCH /api/exchanges/:id/accept
const aceptarSolicitud = async (req, res, next) => {
  try {
    const exchange = await exchangeService.aceptarSolicitud(req.user._id, req.params.id);
    res.status(200).json(exchange);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/exchanges/:id/reject
const rechazarSolicitud = async (req, res, next) => {
  try {
    const exchange = await exchangeService.rechazarSolicitud(req.user._id, req.params.id);
    res.status(200).json(exchange);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  enviarSolicitud,
  obtenerRecibidas,
  obtenerEnviadas,
  aceptarSolicitud,
  rechazarSolicitud,
};
