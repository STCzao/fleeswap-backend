const { Router } = require("express");
const authenticate = require("../middlewares/authenticate");
const validarCampos = require("../middlewares/validarCampos");
const {
  enviarSolicitudValidator,
  listarValidator,
  accionSolicitudValidator,
} = require("../validators/exchange.validator");
const {
  enviarSolicitud,
  obtenerRecibidas,
  obtenerEnviadas,
  obtenerPorId,
  aceptarSolicitud,
  rechazarSolicitud,
  confirmarIntercambio,
  cancelarIntercambio,
} = require("../controllers/exchangeController");
const { obtenerMensajes } = require("../controllers/messageController");
const { obtenerMensajesValidator } = require("../validators/message.validator");

const router = Router();

router.get("/received", authenticate, listarValidator, validarCampos, obtenerRecibidas);
router.get("/sent", authenticate, listarValidator, validarCampos, obtenerEnviadas);
router.get("/:id/messages", authenticate, obtenerMensajesValidator, validarCampos, obtenerMensajes);
router.patch("/:id/accept", authenticate, accionSolicitudValidator, validarCampos, aceptarSolicitud);
router.patch("/:id/reject", authenticate, accionSolicitudValidator, validarCampos, rechazarSolicitud);
router.patch("/:id/confirm", authenticate, accionSolicitudValidator, validarCampos, confirmarIntercambio);
router.patch(
  "/:id/cancel",
  authenticate,
  accionSolicitudValidator,
  validarCampos,
  cancelarIntercambio,
);
router.post("/", authenticate, enviarSolicitudValidator, validarCampos, enviarSolicitud);

module.exports = router;
