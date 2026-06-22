const { Router } = require("express");
const authenticate = require("../middlewares/authenticate");
const validarCampos = require("../middlewares/validarCampos");
const { crear, listarRecibidas } = require("../controllers/reviewController");
const { crearValidator, listarRecibidasValidator } = require("../validators/review.validator");

const router = Router();

router.post("/", authenticate, crearValidator, validarCampos, crear);
router.get("/received", authenticate, listarRecibidasValidator, validarCampos, listarRecibidas);

module.exports = router;
