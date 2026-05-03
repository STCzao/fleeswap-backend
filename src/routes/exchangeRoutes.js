const { Router } = require("express");
const authenticate = require("../middlewares/authenticate");
const validarCampos = require("../middlewares/validarCampos");
const { enviarSolicitudValidator, listarValidator } = require("../validators/exchange.validator");
const {
  enviarSolicitud,
  obtenerRecibidas,
  obtenerEnviadas,
} = require("../controllers/exchangeController");

const router = Router();

router.get("/received", authenticate, listarValidator, validarCampos, obtenerRecibidas);
router.get("/sent", authenticate, listarValidator, validarCampos, obtenerEnviadas);
router.post("/", authenticate, enviarSolicitudValidator, validarCampos, enviarSolicitud);

module.exports = router;
