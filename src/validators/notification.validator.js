const { param } = require("express-validator");
const { paginationRules } = require("./pagination.validator");

const listarValidator = [
  ...paginationRules,
];

const marcarLeidaValidator = [
  param("id")
    .isMongoId()
    .withMessage("ID de notificación inválido"),
];

module.exports = {
  listarValidator,
  marcarLeidaValidator,
};
