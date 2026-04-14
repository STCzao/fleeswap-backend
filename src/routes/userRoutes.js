const { Router } = require("express");
const { actualizarPerfilValidator, eliminarCuentaValidator } = require("../validators/user.validator");
const validarCampos = require("../middlewares/validarCampos");
const authenticate = require("../middlewares/authenticate");
const { obtenerPerfil, obtenerPerfilPublico, actualizarPerfil, eliminarCuenta } = require("../controllers/userController");

const router = Router();

// Rutas protegidas — authenticate aplicado por ruta para evitar conflicto con /:id
router.get("/me", authenticate, obtenerPerfil);
router.patch("/me/profile", authenticate, actualizarPerfilValidator, validarCampos, actualizarPerfil);
router.put("/me", authenticate, actualizarPerfilValidator, validarCampos, actualizarPerfil);
router.delete("/me", authenticate, eliminarCuentaValidator, validarCampos, eliminarCuenta);

// Ruta pública — debe ir después de /me para que Express no capture "me" como :id
router.get("/:id", obtenerPerfilPublico);

module.exports = router;
