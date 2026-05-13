const { Router } = require("express");
const authenticate = require("../middlewares/authenticate");
const validarRol = require("../middlewares/validarRol");
const validarCampos = require("../middlewares/validarCampos");
const {
  obtenerUsuarioAdminValidator,
  cambiarEstadoUsuarioValidator,
  cambiarRolUsuarioValidator,
  listarPublicacionesAdminValidator,
  cambiarEstadoPublicacionValidator,
  eliminarPublicacionAdminValidator,
  listarReportesValidator,
  resolverReporteValidator,
} = require("../validators/admin.validator");
const {
  obtenerStats,
  listarUsuarios,
  obtenerUsuarioPorId,
  cambiarEstadoUsuario,
  cambiarRolUsuario,
  listarReportes,
  listarPublicaciones,
  cambiarEstadoPublicacion,
  eliminarPublicacion,
  resolverReporte,
} = require("../controllers/adminController");

const router = Router();

router.get(
  "/reports",
  authenticate,
  validarRol("ADMIN_ROLE"),
  listarReportesValidator,
  validarCampos,
  listarReportes,
);
router.patch(
  "/reports/:id/resolve",
  authenticate,
  validarRol("ADMIN_ROLE"),
  resolverReporteValidator,
  validarCampos,
  resolverReporte,
);
router.get("/users", authenticate, validarRol("ADMIN_ROLE"), listarUsuarios);
router.get(
  "/users/:id",
  authenticate,
  validarRol("ADMIN_ROLE"),
  obtenerUsuarioAdminValidator,
  validarCampos,
  obtenerUsuarioPorId,
);
router.patch(
  "/users/:id/status",
  authenticate,
  validarRol("ADMIN_ROLE"),
  cambiarEstadoUsuarioValidator,
  validarCampos,
  cambiarEstadoUsuario,
);
router.patch(
  "/users/:id/role",
  authenticate,
  validarRol("ADMIN_ROLE"),
  cambiarRolUsuarioValidator,
  validarCampos,
  cambiarRolUsuario,
);
router.get(
  "/publications",
  authenticate,
  validarRol("ADMIN_ROLE"),
  listarPublicacionesAdminValidator,
  validarCampos,
  listarPublicaciones,
);
router.patch(
  "/publications/:id/status",
  authenticate,
  validarRol("ADMIN_ROLE"),
  cambiarEstadoPublicacionValidator,
  validarCampos,
  cambiarEstadoPublicacion,
);
router.delete(
  "/publications/:id",
  authenticate,
  validarRol("ADMIN_ROLE"),
  eliminarPublicacionAdminValidator,
  validarCampos,
  eliminarPublicacion,
);
router.get("/stats", authenticate, validarRol("ADMIN_ROLE"), obtenerStats);

module.exports = router;
