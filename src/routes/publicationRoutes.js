const { Router } = require("express");
const { crearValidator, editarValidator, cambiarEstadoValidator, reportarValidator, eliminarValidator } = require("../validators/publication.validator");
const validarCampos = require("../middlewares/validarCampos");
const authenticate = require("../middlewares/authenticate");
const optionalAuthenticate = require("../middlewares/optionalAuthenticate");
const { crear, editar, eliminar, cambiarEstado, verDetalle, listar, reportar } = require("../controllers/publicationController");

const router = Router();

router.get("/", listar);
// optionalAuthenticate permite identificar al owner para mostrarle sus publicaciones unavailable
router.get("/:id", optionalAuthenticate, verDetalle);

router.post("/", authenticate, crearValidator, validarCampos, crear);
router.patch("/:id", authenticate, editarValidator, validarCampos, editar);
router.delete("/:id", authenticate, eliminarValidator, validarCampos, eliminar);
router.patch("/:id/status", authenticate, cambiarEstadoValidator, validarCampos, cambiarEstado);
router.post("/:id/report", authenticate, reportarValidator, validarCampos, reportar);

module.exports = router;
