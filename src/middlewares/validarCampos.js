const { validationResult } = require("express-validator");
const AppError = require("../helpers/AppError");

// Middleware que verifica el resultado de las validaciones de express-validator.
// Si hay errores, lanza un AppError 400 con el primer mensaje de error.
// Se coloca entre las reglas de validación y el controller en cada ruta.
const validarCampos = (req, _res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new AppError(errors.array()[0].msg, 400));
  next();
};

module.exports = validarCampos;
