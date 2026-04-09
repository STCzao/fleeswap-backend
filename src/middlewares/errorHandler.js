const AppError = require("../helpers/AppError");
const logger = require("../helpers/logger");

// Middleware global de manejo de errores.
// Debe montarse al final de app.js, después de todas las rutas.
// Distingue entre errores operacionales (AppError) y errores inesperados.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    logger.warn(`[${req.method}] ${req.path} — ${err.status}: ${err.message}`);
    return res.status(err.status).json({ message: err.message });
  }

  // Error inesperado: logueamos el stack completo pero no lo exponemos al cliente
  logger.error(`[${req.method}] ${req.path} — 500: ${err.message}`, { stack: err.stack });
  res.status(500).json({ message: "Error interno del servidor" });
};

module.exports = errorHandler;
