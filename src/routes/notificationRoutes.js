const { Router } = require("express");
const authenticate = require("../middlewares/authenticate");
const validarCampos = require("../middlewares/validarCampos");
const {
  listarValidator,
  marcarLeidaValidator,
} = require("../validators/notification.validator");
const {
  listar,
  marcarLeida,
  marcarTodasLeidas,
} = require("../controllers/notificationController");

const router = Router();

router.get("/", authenticate, listarValidator, validarCampos, listar);
router.patch("/read-all", authenticate, marcarTodasLeidas);
router.patch("/:id/read", authenticate, marcarLeidaValidator, validarCampos, marcarLeida);

module.exports = router;
