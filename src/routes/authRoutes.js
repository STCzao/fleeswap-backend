const { Router } = require("express");
const { registerValidator, loginValidator } = require("../validators/auth.validator");
const validarCampos = require("../middlewares/validarCampos");
const validarMayorDeEdad = require("../middlewares/validarMayorDeEdad");
const { register, login, refresh } = require("../controllers/authController");

const router = Router();

router.post("/register", registerValidator, validarCampos, validarMayorDeEdad, register);
router.post("/login", loginValidator, validarCampos, login);
router.post("/refresh", refresh);

module.exports = router;
