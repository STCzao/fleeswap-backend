const { Router } = require("express");
const authenticate = require("../middlewares/authenticate");
const validarCampos = require("../middlewares/validarCampos");
const { enviarSolicitudValidator } = require("../validators/exchange.validator");
const { enviarSolicitud } = require("../controllers/exchangeController");

const router = Router();

router.post("/", authenticate, enviarSolicitudValidator, validarCampos, enviarSolicitud);

module.exports = router;
