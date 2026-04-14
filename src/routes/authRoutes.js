const { Router } = require("express");
const { registerValidator, loginValidator, changePasswordValidator, forgotPasswordValidator, resetPasswordValidator } = require("../validators/auth.validator");
const validarCampos = require("../middlewares/validarCampos");
const validarMayorDeEdad = require("../middlewares/validarMayorDeEdad");
const authenticate = require("../middlewares/authenticate");
const { register, login, refresh, logout, cambiarPassword, forgotPassword, resetPassword } = require("../controllers/authController");

const router = Router();

router.post("/register", registerValidator, validarCampos, validarMayorDeEdad, register);
router.post("/login", loginValidator, validarCampos, login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.patch("/change-password", authenticate, changePasswordValidator, validarCampos, cambiarPassword);
router.post("/forgot-password", forgotPasswordValidator, validarCampos, forgotPassword);
router.post("/reset-password", resetPasswordValidator, validarCampos, resetPassword);

module.exports = router;
