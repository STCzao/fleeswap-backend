const { Router } = require("express");
const authenticate = require("../middlewares/authenticate");
const validarCampos = require("../middlewares/validarCampos");
const { crearValidator, editarValidator } = require("../validators/activeSearch.validator");
const { crear, listar, editar, eliminar } = require("../controllers/activeSearchController");

const router = Router();

router.get("/", authenticate, listar);
router.post("/", authenticate, crearValidator, validarCampos, crear);
router.patch("/:id", authenticate, editarValidator, validarCampos, editar);
router.delete("/:id", authenticate, eliminar);

module.exports = router;
