const { body } = require("express-validator");

const CATEGORIAS = [
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
const CONDICIONES = ["nuevo", "como_nuevo", "bueno", "regular", "deteriorado"];
const TIPOS = ["trueque", "venta", "ambos"];
const MOTIVOS = [
  "spam",
  "contenido_inapropiado",
  "objeto_falso",
  "descripcion_enganosa",
  "precio_abusivo",
  "otro",
];

const crearValidator = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("El título es requerido")
    .isLength({ max: 100 })
    .withMessage("El título no puede superar los 100 caracteres"),
  body("description")
    .trim()
    .notEmpty()
    .withMessage("La descripción es requerida")
    .isLength({ max: 1000 })
    .withMessage("La descripción no puede superar los 1000 caracteres"),
  body("history")
    .trim()
    .notEmpty()
    .withMessage("La historia del objeto es requerida")
    .isLength({ max: 2000 })
    .withMessage("La historia no puede superar los 2000 caracteres"),
  body("category").isIn(CATEGORIAS).withMessage("Categoría inválida"),
  body("condition").isIn(CONDICIONES).withMessage("Estado del objeto inválido"),
  body("type").isIn(TIPOS).withMessage("Tipo de publicación inválido"),
  body("photos")
    .isArray({ min: 1, max: 5 })
    .withMessage("Debe incluir entre 1 y 5 fotos"),
  body("photos.*").isURL().withMessage("Cada foto debe ser una URL válida"),
];

const editarValidator = [
  body("title")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("El título no puede estar vacío")
    .isLength({ max: 100 })
    .withMessage("El título no puede superar los 100 caracteres"),
  body("description")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("La descripción no puede estar vacía")
    .isLength({ max: 1000 })
    .withMessage("La descripción no puede superar los 1000 caracteres"),
  body("history")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("La historia no puede estar vacía")
    .isLength({ max: 2000 })
    .withMessage("La historia no puede superar los 2000 caracteres"),
  body("category")
    .optional()
    .isIn(CATEGORIAS)
    .withMessage("Categoría inválida"),
  body("condition")
    .optional()
    .isIn(CONDICIONES)
    .withMessage("Estado del objeto inválido"),
  body("type")
    .optional()
    .isIn(TIPOS)
    .withMessage("Tipo de publicación inválido"),
  body("photos")
    .optional()
    .isArray({ min: 1, max: 5 })
    .withMessage("Debe incluir entre 1 y 5 fotos"),
  // Sin .optional(): si photos está presente, cada elemento debe ser URL válida sin excepción.
  body("photos.*").isURL().withMessage("Cada foto debe ser una URL válida"),
];

const cambiarEstadoValidator = [
  body("status")
    .isIn(["available", "unavailable"])
    .withMessage("Estado inválido"),
];

const eliminarValidator = [
  body("confirmacion")
    .custom((val) => val === true)
    .withMessage("Se requiere confirmación para eliminar"),
];

const reportarValidator = [
  body("reason").isIn(MOTIVOS).withMessage("Motivo de reporte inválido"),
  body("details")
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage("Los detalles no pueden superar los 500 caracteres"),
];

module.exports = {
  crearValidator,
  editarValidator,
  cambiarEstadoValidator,
  reportarValidator,
  eliminarValidator,
};
