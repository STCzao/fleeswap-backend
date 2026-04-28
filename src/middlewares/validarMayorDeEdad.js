const AppError = require("../helpers/AppError");

const EDAD_MINIMA = 18;

// Middleware que verifica que el usuario sea mayor de edad.
// Calcula la edad real considerando día y mes de nacimiento.
// Debe usarse después de validarCampos para garantizar que fechaNacimiento es una fecha válida.
const validarMayorDeEdad = (req, _res, next) => {
  const { fechaNacimiento } = req.body;

  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);

  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const cumplioCumple =
    hoy.getMonth() > nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() >= nacimiento.getDate());

  if (!cumplioCumple) edad--;

  if (edad < EDAD_MINIMA)
    return next(new AppError(`Debés tener al menos ${EDAD_MINIMA} años para registrarte`, 400));

  next();
};

module.exports = validarMayorDeEdad;
