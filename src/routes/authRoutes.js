const { Router } = require("express");
const { registerValidator } = require("../validators/auth.validator");
const validarCampos = require("../middlewares/validarCampos");
const validarMayorDeEdad = require("../middlewares/validarMayorDeEdad");
const { register } = require("../controllers/authController");

const router = Router();

router.post("/register", registerValidator, validarCampos, validarMayorDeEdad, register);

module.exports = router;
