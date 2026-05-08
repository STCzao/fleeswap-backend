const { body, query, param } = require("express-validator");
const { paginationRules } = require("./pagination.validator");

const REPORT_REASONS = [
  "spam",
  "contenido_inapropiado",
  "objeto_falso",
  "descripcion_enganosa",
  "precio_abusivo",
  "otro",
];

const REPORT_STATUS = ["pending", "reviewed", "dismissed"];
const REPORT_ACTIONS = ["suspend_publication", "dismiss"];

const listarReportesValidator = [
  ...paginationRules,
  query("status")
    .optional()
    .isIn(REPORT_STATUS)
    .withMessage("Estado de reporte invalido"),
  query("reason")
    .optional()
    .isIn(REPORT_REASONS)
    .withMessage("Motivo de reporte invalido"),
];

const resolverReporteValidator = [
  param("id")
    .isMongoId()
    .withMessage("ID de reporte invalido"),
  body("action")
    .exists({ checkFalsy: true })
    .withMessage("La accion es requerida")
    .isIn(REPORT_ACTIONS)
    .withMessage("Accion invalida"),
];

module.exports = { listarReportesValidator, resolverReporteValidator };
