const AppError = require("../helpers/AppError");
const logger = require("../helpers/logger");

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const meta = req?.id ? { requestId: req.id } : {};

  if (err instanceof AppError) {
    logger.warn(`[${req.method}] ${req.path} - ${err.status}: ${err.message}`, meta);
    return res.status(err.status).json({ message: err.message });
  }

  if (err.name === "ValidationError") {
    const message = Object.values(err.errors)[0].message;
    logger.warn(`[${req.method}] ${req.path} - 400: ${message}`, meta);
    return res.status(400).json({ message });
  }

  if (err.name === "MongoServerError" && err.code === 11000) {
    logger.warn(`[${req.method}] ${req.path} - 409: duplicate key`, meta);
    if (err.keyPattern?.email) {
      return res.status(409).json({ message: "El email ya esta registrado" });
    }
    if (err.keyPattern?.user && err.keyPattern?.criteriaSignature) {
      return res.status(409).json({ message: "Ya existe un criterio de busqueda igual" });
    }
    return res.status(409).json({ message: "Recurso duplicado" });
  }

  if (err.name === "CastError" && err.kind === "ObjectId") {
    logger.warn(`[${req.method}] ${req.path} - 400: invalid ObjectId`, meta);
    return res.status(400).json({ message: "ID invalido" });
  }

  logger.error(`[${req.method}] ${req.path} - 500: ${err.message}`, {
    ...meta,
    stack: err.stack,
  });
  return res.status(500).json({ message: "Error interno del servidor" });
};

module.exports = errorHandler;
