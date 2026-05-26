const { body, query, param } = require("express-validator");
const { paginationRules } = require("./pagination.validator");
const Publication = require("../models/Publication");

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
const USER_ROLES = ["USER_ROLE", "ADMIN_ROLE"];
const PUBLICATION_STATUS = ["available", "unavailable", "suspended"];
const PUBLICATION_CATEGORIES = Publication.schema.path("category").enumValues;

const usuarioIdParamValidator = [
  param("id")
    .isMongoId()
    .withMessage("ID de usuario invalido"),
];

const obtenerUsuarioAdminValidator = [...usuarioIdParamValidator];

const cambiarEstadoUsuarioValidator = [
  ...usuarioIdParamValidator,
  body("isActive")
    .isBoolean()
    .withMessage("El estado de actividad debe ser booleano"),
];

const cambiarRolUsuarioValidator = [
  ...usuarioIdParamValidator,
  body("role")
    .isIn(USER_ROLES)
    .withMessage("Rol invalido"),
];

const listarUsuariosAdminValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("La página debe ser un número entero positivo"),
  query("role")
    .optional()
    .isIn(USER_ROLES)
    .withMessage("Rol inválido"),
  query("isActive")
    .optional()
    .isIn(["true", "false"])
    .withMessage("isActive debe ser 'true' o 'false'"),
  query("search")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("La búsqueda no puede superar los 100 caracteres"),
];

const listarPublicacionesAdminValidator = [
  ...paginationRules,
  query("status")
    .optional()
    .isIn(PUBLICATION_STATUS)
    .withMessage("Estado de publicacion invalido"),
  query("category")
    .optional()
    .isIn(PUBLICATION_CATEGORIES)
    .withMessage("Categoria invalida"),
];

const publicacionIdParamValidator = [
  param("id")
    .isMongoId()
    .withMessage("ID de publicacion invalido"),
];

const cambiarEstadoPublicacionValidator = [
  ...publicacionIdParamValidator,
  body("status")
    .isIn(PUBLICATION_STATUS)
    .withMessage("Estado de publicacion invalido"),
];

const eliminarPublicacionAdminValidator = [...publicacionIdParamValidator];

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

module.exports = {
  obtenerUsuarioAdminValidator,
  cambiarEstadoUsuarioValidator,
  cambiarRolUsuarioValidator,
  listarUsuariosAdminValidator,
  listarPublicacionesAdminValidator,
  cambiarEstadoPublicacionValidator,
  eliminarPublicacionAdminValidator,
  listarReportesValidator,
  resolverReporteValidator,
};
