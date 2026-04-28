const { body } = require("express-validator");

// Validaciones para la actualización del perfil de usuario.
// Todos los campos son opcionales — el usuario puede actualizar uno o varios a la vez.
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
      if (!regex.test(value)) throw new Error("La URL de la foto no es válida");
      return true;
    })
    .isLength({ max: 300 }).withMessage("La URL de la foto no puede superar los 300 caracteres"),

  body("bio")
    .optional()
    .trim()
    .isLength({ min: 3, max: 300 }).withMessage("La descripción debe tener entre 3 y 300 caracteres"),

  body("location")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage("La ubicación debe tener entre 2 y 100 caracteres"),
];

// Validación para eliminar cuenta — requiere la contraseña como confirmación de identidad.
const eliminarCuentaValidator = [
  body("password")
    .exists({ checkFalsy: true }).withMessage("La contraseña es requerida para confirmar la eliminación"),
];

module.exports = { actualizarPerfilValidator, eliminarCuentaValidator };
