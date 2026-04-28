const AppError = require("../helpers/AppError");

// Middleware de autorización por rol.
// Recibe los roles permitidos y verifica que el usuario autenticado tenga uno de ellos.
// Debe usarse después del middleware authenticate, que adjunta req.user.
// Uso: validarRol("ADMIN_ROLE") o validarRol("ADMIN_ROLE", "USER_ROLE")
const validarRol = (...rolesPermitidos) => (req, _res, next) => {
  if (!req.user) return next(new AppError("No autenticado", 401));
  if (!rolesPermitidos.includes(req.user.role)) {
    return next(new AppError("No tenés permisos para realizar esta acción", 403));
  }
  next();
};

module.exports = validarRol;
