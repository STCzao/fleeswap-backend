const { Router } = require("express");
const authenticate = require("../middlewares/authenticate");
const validarRol = require("../middlewares/validarRol");
const validarCampos = require("../middlewares/validarCampos");
const {
  listarReportesValidator,
  resolverReporteValidator,
} = require("../validators/admin.validator");
const {
  obtenerStats,
  listarUsuarios,
  listarReportes,
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
router.get("/stats", authenticate, validarRol("ADMIN_ROLE"), obtenerStats);

module.exports = router;
