const { body } = require("express-validator");
const sanitizarTexto = require("../helpers/sanitizarTexto");

const SEARCH_CATEGORIES = [
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

const SEARCH_TYPES = ["trueque", "venta", "ambos"];

const crearValidator = [
  body("category")
    .notEmpty()
    .withMessage("La categoria es requerida")
    .isIn(SEARCH_CATEGORIES)
    .withMessage("La categoria de busqueda no es valida"),

  body("keywords")
    .optional()
    .isArray({ max: 10 })
    .withMessage("Las palabras clave deben enviarse como array"),

  body("keywords.*")
    .optional()
    .isString()
    .withMessage("Cada palabra clave debe ser texto")
    .custom((value) => {
      const normalizedValue = sanitizarTexto(value);
      return normalizedValue.length >= 2 && normalizedValue.length <= 50;
    })
    .withMessage("Cada palabra clave debe tener entre 2 y 50 caracteres"),

  body("type")
    .optional()
    .isIn(SEARCH_TYPES)
    .withMessage("El tipo de busqueda no es valido"),
];

module.exports = {
  crearValidator,
};
