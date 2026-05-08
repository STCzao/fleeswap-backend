const { query } = require("express-validator");
const { MAX_LIMIT } = require("../helpers/buildPagination");

const paginationRules = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("La página debe ser un número entero positivo"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: MAX_LIMIT })
    .withMessage(`El límite debe ser entre 1 y ${MAX_LIMIT}`),
];

module.exports = { paginationRules };
