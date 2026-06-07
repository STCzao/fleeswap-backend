const { param } = require("express-validator");
const { paginationRules } = require("./pagination.validator");

const listarValidator = [
  ...paginationRules,
];

const marcarLeidaValidator = [
  param("id")
    .isMongoId()
    .withMessage("ID de notificacion invalido"),
];

module.exports = {
  listarValidator,
  marcarLeidaValidator,
};
