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

const categoryRule = body("category")
  .notEmpty()
  .withMessage("La categoría es requerida")
  .isIn(SEARCH_CATEGORIES)
  .withMessage("La categoría de búsqueda no es válida");

const keywordsRule = body("keywords")
  .optional()
  .isArray({ max: 10 })
  .withMessage("Las palabras clave deben enviarse como array");

const keywordItemRule = body("keywords.*")
  .optional()
  .isString()
  .withMessage("Cada palabra clave debe ser texto")
  .custom((value) => {
    const normalizedValue = sanitizarTexto(value);
    return normalizedValue.length >= 2 && normalizedValue.length <= 50;
  })
  .withMessage("Cada palabra clave debe tener entre 2 y 50 caracteres");

const typeRule = body("type")
  .optional()
  .isIn(SEARCH_TYPES)
  .withMessage("El tipo de búsqueda no es válido");

const crearValidator = [
  categoryRule,
  keywordsRule,
  keywordItemRule,
  typeRule,
];

const editarValidator = [
  body("category")
    .optional()
    .notEmpty()
    .withMessage("La categoría es requerida")
    .isIn(SEARCH_CATEGORIES)
    .withMessage("La categoría de búsqueda no es válida"),
  keywordsRule,
  keywordItemRule,
  typeRule,
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive debe ser booleano"),
];

module.exports = {
  crearValidator,
  editarValidator,
};
