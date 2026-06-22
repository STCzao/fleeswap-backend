const { query, param } = require("express-validator");
const { MAX_LIMIT } = require("../helpers/buildPagination");

const obtenerMensajesValidator = [
  param("id")
    .isMongoId()
    .withMessage("ID de solicitud inválido"),
  // `before` es el cursor de paginación: el _id del mensaje más antiguo ya cargado.
  // Al ser un ObjectId de MongoDB, se puede usar directamente para comparar con $lt.
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
