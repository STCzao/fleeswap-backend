const { Router } = require("express");
const { body } = require("express-validator");
const validate = require("../middlewares/validate");
const { register } = require("../controllers/authController");

const router = Router();

// POST /api/auth/register
// Valida que el email sea válido y la contraseña tenga al menos 6 caracteres.
router.post(
  "/register",
  [
    body("email").isEmail().withMessage("Email inválido"),
    body("password").isLength({ min: 6 }).withMessage("La contraseña debe tener al menos 6 caracteres"),
  ],
  validate,
  register
);

module.exports = router;
