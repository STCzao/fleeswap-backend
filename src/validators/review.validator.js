const { body } = require("express-validator");
const { paginationRules } = require("./pagination.validator");

const crearValidator = [
  body("exchangeId")
    .notEmpty()
    .withMessage("El intercambio es requerido")
    .isMongoId()
    .withMessage("El intercambio debe ser un ID válido"),
  body("rating")
    .notEmpty()
    .withMessage("La calificación es requerida")
    .isInt({ min: 1, max: 5 })
    .withMessage("La calificación debe ser un entero entre 1 y 5"),
  body("comment")
    .optional({ nullable: true })
    .isString()
    .withMessage("El comentario debe ser texto")
    .isLength({ max: 500 })
    .withMessage("El comentario no puede superar los 500 caracteres"),
];

const listarRecibidasValidator = [...paginationRules];

module.exports = {
  crearValidator,
  listarRecibidasValidator,
};
