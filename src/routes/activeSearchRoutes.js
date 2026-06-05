const { Router } = require("express");
const authenticate = require("../middlewares/authenticate");
const validarCampos = require("../middlewares/validarCampos");
const { crearValidator } = require("../validators/activeSearch.validator");
const { crear, listar } = require("../controllers/activeSearchController");

const router = Router();

router.get("/", authenticate, listar);
router.post("/", authenticate, crearValidator, validarCampos, crear);

module.exports = router;
