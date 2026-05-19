const { query, param } = require("express-validator");
const { MAX_LIMIT } = require("../helpers/buildPagination");

const obtenerMensajesValidator = [
  param("id")
    .isMongoId()
    .withMessage("ID de solicitud inválido"),
  query("before")
    .optional()
    .isMongoId()
    .withMessage("El cursor before debe ser un ID válido"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: MAX_LIMIT })
    .withMessage(`El límite debe ser entre 1 y ${MAX_LIMIT}`),
];

module.exports = {
  obtenerMensajesValidator,
};
