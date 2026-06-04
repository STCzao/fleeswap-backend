const { Router } = require("express");
const {
  registerValidator,
  loginValidator,
  changePasswordValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  verifyEmailValidator,
} = require("../validators/auth.validator");
const validarCampos = require("../middlewares/validarCampos");
const validarMayorDeEdad = require("../middlewares/validarMayorDeEdad");
const authenticate = require("../middlewares/authenticate");
const {
  register,
  login,
  refresh,
  logout,
  cambiarPassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
} = require("../controllers/authController");

const router = Router();

// validarMayorDeEdad corre después de validarCampos para garantizar que fechaNacimiento
// ya fue validado como fecha válida antes de calcular la edad.
router.post("/register", registerValidator, validarCampos, validarMayorDeEdad, register);
router.post("/login", loginValidator, validarCampos, login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.patch("/change-password", authenticate, changePasswordValidator, validarCampos, cambiarPassword);
router.post("/forgot-password", forgotPasswordValidator, validarCampos, forgotPassword);
router.post("/reset-password", resetPasswordValidator, validarCampos, resetPassword);
router.post("/verify-email", verifyEmailValidator, validarCampos, verifyEmail);
router.post("/resend-verification", authenticate, resendVerification);

module.exports = router;
