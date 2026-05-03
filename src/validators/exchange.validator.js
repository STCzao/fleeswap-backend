const { body } = require("express-validator");

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

module.exports = {
  enviarSolicitudValidator,
};
