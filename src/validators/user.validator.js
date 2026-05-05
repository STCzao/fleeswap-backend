const { body } = require("express-validator");
const LOCALIDADES_TUCUMAN = require("../helpers/localidadesTucuman");

// Validaciones para la actualizacion del perfil de usuario.
// Todos los campos son opcionales: el usuario puede actualizar uno o varios a la vez.
// La URL de foto debe pertenecer estrictamente a la cuenta de Cloudinary configurada,
// previniendo que se almacenen URLs arbitrarias o de terceros.
const actualizarPerfilValidator = [
  body("photo")
    .optional()
    .isURL({ protocols: ["https"], require_protocol: true })
    .withMessage("La URL de la foto debe ser https")
    .custom((value) => {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const regex = new RegExp(`^https://res\\.cloudinary\\.com/${cloudName}/.+`);
      if (!regex.test(value)) throw new Error("La URL de la foto no es valida");
      return true;
    })
    .isLength({ max: 300 }).withMessage("La URL de la foto no puede superar los 300 caracteres"),

  body("bio")
    .optional()
    .trim()
    .isLength({ min: 3, max: 300 }).withMessage("La descripcion debe tener entre 3 y 300 caracteres"),

  body("location")
    .optional()
    .isIn(LOCALIDADES_TUCUMAN).withMessage("La localidad seleccionada no es valida"),
];

// Validacion para eliminar cuenta: requiere la contrasena como confirmacion de identidad.
const eliminarCuentaValidator = [
  body("password")
    .exists({ checkFalsy: true }).withMessage("La contrasena es requerida para confirmar la eliminacion"),
];

module.exports = { actualizarPerfilValidator, eliminarCuentaValidator };
