const { body, query, param } = require("express-validator");
const { paginationRules } = require("./pagination.validator");

const ESTADOS = ["pending", "active", "completed", "cancelled", "rejected"];
const ESTADOS_HISTORIAL = ["pending", "active", "completed", "cancelled"];

const enviarSolicitudValidator = [
  body("type")
    .optional()
    .isIn(["exchange", "purchase"])
    .withMessage("Tipo de solicitud inválido"),
  // offeredPublicationId es obligatorio para intercambios y opcional para compras directas.
  // Se usan dos reglas separadas porque express-validator no soporta if/else en una sola cadena.
  body("offeredPublicationId")
    .if(body("type").not().equals("purchase"))
    .notEmpty()
    .withMessage("La publicación ofrecida es requerida para intercambios")
    .isMongoId()
    .withMessage("La publicación ofrecida debe ser un ID válido"),
  body("offeredPublicationId")
    .if(body("type").equals("purchase"))
    .optional(),
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

const historialValidator = [
  ...paginationRules,
  query("status")
    .optional()
    .isIn(ESTADOS_HISTORIAL)
    .withMessage("Estado inválido para historial"),
];

const accionSolicitudValidator = [
  param("id")
    .isMongoId()
    .withMessage("ID de solicitud inválido"),
];

const cancelarValidator = [
  body("confirmación")
    .custom((val) => val === true)
    .withMessage("Se requiere confirmación para cancelar"),
];

module.exports = {
  enviarSolicitudValidator,
  listarValidator,
  historialValidator,
  accionSolicitudValidator,
  cancelarValidator,
};
