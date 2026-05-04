const { body, query, param } = require("express-validator");
const { paginationRules } = require("./pagination.validator");

const ESTADOS = ["pending", "active", "completed", "cancelled", "rejected"];

const enviarSolicitudValidator = [
  body("offeredPublicationId")
    .notEmpty()
    .withMessage("La publicación ofrecida es requerida")
    .isMongoId()
    .withMessage("La publicación ofrecida debe ser un ID válido"),
  body("requestedPublicationId")
    .notEmpty()
    .withMessage("La publicación solicitada es requerida")
    .isMongoId()
    .withMessage("La publicación solicitada debe ser un ID válido"),
  body("complementaryAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("El monto complementario debe ser un número positivo"),
];

const listarValidator = [
  ...paginationRules,
  query("status")
    .optional()
    .isIn(ESTADOS)
    .withMessage("Estado inválido"),
];

const accionSolicitudValidator = [
  param("id")
    .isMongoId()
    .withMessage("ID de solicitud inválido"),
];

module.exports = {
  enviarSolicitudValidator,
  listarValidator,
  accionSolicitudValidator,
};
