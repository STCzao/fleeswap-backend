const { Router } = require("express");
const { crearValidator, editarValidator, cambiarEstadoValidator, reportarValidator } = require("../validators/publication.validator");
const validarCampos = require("../middlewares/validarCampos");
const authenticate = require("../middlewares/authenticate");
const { crear, editar, eliminar, cambiarEstado, verDetalle, listar, reportar } = require("../controllers/publicationController");

const router = Router();

router.get("/", listar);
router.get("/:id", verDetalle);

router.post("/", authenticate, crearValidator, validarCampos, crear);
router.patch("/:id", authenticate, editarValidator, validarCampos, editar);
router.delete("/:id", authenticate, eliminar);
router.patch("/:id/status", authenticate, cambiarEstadoValidator, validarCampos, cambiarEstado);
router.post("/:id/report", authenticate, reportarValidator, validarCampos, reportar);

module.exports = router;
