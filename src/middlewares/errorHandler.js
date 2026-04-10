const AppError = require("../helpers/AppError");
const logger = require("../helpers/logger");

// Middleware global de manejo de errores.
// Debe montarse al final de app.js, después de todas las rutas.
// Maneja tres tipos de error:
//   1. AppError — errores operacionales esperados (400, 409, etc.)
//   2. ValidationError — errores de esquema de Mongoose
//   3. MongoServerError 11000 — clave duplicada (race condition en emails únicos)
//   4. Cualquier otro — error inesperado, se loguea con stack pero no se expone
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    logger.warn(`[${req.method}] ${req.path} — ${err.status}: ${err.message}`);
    return res.status(err.status).json({ message: err.message });
  }

  if (err.name === "ValidationError") {
    const message = Object.values(err.errors)[0].message;
    logger.warn(`[${req.method}] ${req.path} — 400: ${message}`);
    return res.status(400).json({ message });
  }

  if (err.name === "MongoServerError" && err.code === 11000) {
    logger.warn(`[${req.method}] ${req.path} — 409: duplicate key`);
    return res.status(409).json({ message: "El email ya está registrado" });
  }

  logger.error(`[${req.method}] ${req.path} — 500: ${err.message}`, { stack: err.stack });
  res.status(500).json({ message: "Error interno del servidor" });
};

module.exports = errorHandler;
