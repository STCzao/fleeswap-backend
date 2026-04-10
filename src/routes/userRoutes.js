const { Router } = require("express");
const { actualizarPerfilValidator } = require("../validators/user.validator");
const validarCampos = require("../middlewares/validarCampos");
const authenticate = require("../middlewares/authenticate");
const { obtenerPerfil, actualizarPerfil, editarPerfil } = require("../controllers/userController");

const router = Router();

// Todas las rutas de usuario requieren autenticación
router.use(authenticate);

router.get("/me", obtenerPerfil);
router.patch("/me/profile", actualizarPerfilValidator, validarCampos, actualizarPerfil);
router.put("/me", actualizarPerfilValidator, validarCampos, editarPerfil);

module.exports = router;
