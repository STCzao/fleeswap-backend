const { body } = require("express-validator");
const LOCALIDADES_TUCUMAN = require("../helpers/localidadesTucuman");

const PREFERRED_CATEGORIES = [
  "electronica",
  "ropa_accesorios",
  "coleccionables",
  "libros_comics",
  "deportes",
  "hogar_deco",
  "juguetes",
  "arte",
  "musica",
  "otros",
];

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
    .isIn(LOCALIDADES_TUCUMAN).withMessage("La localidad seleccionada no es válida"),

  body("preferredCategories")
    .optional()
    .isArray({ max: PREFERRED_CATEGORIES.length })
    .withMessage("Las categorías preferidas deben enviarse como array"),

  body("preferredCategories.*")
    .optional()
    .isIn(PREFERRED_CATEGORIES)
    .withMessage("La categoría preferida no es válida"),
];

// Validación para eliminar cuenta: requiere la contraseña como confirmación de identidad.
const eliminarCuentaValidator = [
  body("password")
    .exists({ checkFalsy: true }).withMessage("La contraseña es requerida para confirmar la eliminación"),
];

module.exports = { actualizarPerfilValidator, eliminarCuentaValidator };
