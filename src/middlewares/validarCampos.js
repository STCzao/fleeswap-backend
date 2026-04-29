const { validationResult } = require("express-validator");

// Middleware que verifica el resultado de las validaciones de express-validator.
// Si hay errores, responde 400 con el detalle de todos los campos invalidados.
// Se coloca entre las reglas de validación y el controller en cada ruta.
const validarCampos = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      errors: errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
      })),
    });
  }
  next();
};

module.exports = validarCampos;
