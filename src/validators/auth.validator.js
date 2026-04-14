const { body } = require("express-validator");

// Reglas de validación para el registro de usuario.
// Todos los campos requeridos usan exists({ checkFalsy: true }) como primera validación
// para garantizar presencia antes de validar formato y longitud.
// La verificación de mayoría de edad se delega al middleware validarMayorDeEdad.
const registerValidator = [
  body("nombre")
    .exists({ checkFalsy: true }).withMessage("El nombre es requerido")
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage("El nombre debe tener entre 2 y 50 caracteres")
    // Solo letras (con tildes y ñ), espacios y guiones — evita números y símbolos
    .matches(/^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s\-]+$/).withMessage("El nombre solo puede contener letras, espacios y guiones"),

  body("apellido")
    .exists({ checkFalsy: true }).withMessage("El apellido es requerido")
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage("El apellido debe tener entre 2 y 50 caracteres")
    // Solo letras (con tildes y ñ), espacios y guiones — evita números y símbolos
    .matches(/^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s\-]+$/).withMessage("El apellido solo puede contener letras, espacios y guiones"),

  body("fechaNacimiento")
    .exists({ checkFalsy: true }).withMessage("La fecha de nacimiento es requerida")
    .isISO8601().withMessage("La fecha de nacimiento debe tener el formato YYYY-MM-DD")
    // Verifica que la fecha sea en el pasado — evita fechas futuras absurdas
    .custom((value) => {
      if (new Date(value) >= new Date()) throw new Error("La fecha de nacimiento debe ser en el pasado");
      return true;
    })
    .toDate(), // convierte el string ISO a objeto Date antes de llegar al middleware

  body("email")
    .exists({ checkFalsy: true }).withMessage("El email es requerido")
    .isEmail().withMessage("El email no tiene un formato válido")
    .isLength({ min: 5, max: 100 }).withMessage("El email debe tener entre 5 y 100 caracteres")
    .normalizeEmail(), // normaliza a lowercase y elimina alias (ej: TEST+alias@Gmail.com → test@gmail.com)

  body("password")
    .exists({ checkFalsy: true }).withMessage("La contraseña es requerida")
    .isLength({ min: 8, max: 64 }).withMessage("La contraseña debe tener entre 8 y 64 caracteres")
    // max 64 — bcrypt trunca entradas mayores a 72 bytes
    .matches(/[A-Z]/).withMessage("La contraseña debe tener al menos una mayúscula")
    .matches(/\d/).withMessage("La contraseña debe tener al menos un número")
    .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/).withMessage("La contraseña debe tener al menos un carácter especial"),

  body("confirmPassword")
    .exists({ checkFalsy: true }).withMessage("La confirmación de contraseña es requerida")
    // Verifica coherencia entre password y confirmPassword — no se almacena
    .custom((value, { req }) => {
      if (value !== req.body.password) throw new Error("Las contraseñas no coinciden");
      return true;
    }),
];

// Reglas de validación para el login de usuario.
// Mismas restricciones de formato que register — las contraseñas fueron creadas con estas reglas.
// La verificación de credenciales (usuario existe, password correcta) se delega al service.
const loginValidator = [
  body("email")
    .exists({ checkFalsy: true }).withMessage("El email es requerido")
    .isEmail().withMessage("El email no tiene un formato válido")
    .isLength({ min: 5, max: 100 }).withMessage("El email debe tener entre 5 y 100 caracteres")
    .normalizeEmail(),

  body("password")
    .exists({ checkFalsy: true }).withMessage("La contraseña es requerida")
    .isLength({ min: 8, max: 64 }).withMessage("La contraseña debe tener entre 8 y 64 caracteres")
    .matches(/[A-Z]/).withMessage("La contraseña debe tener al menos una mayúscula")
    .matches(/\d/).withMessage("La contraseña debe tener al menos un número")
    .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/).withMessage("La contraseña debe tener al menos un carácter especial"),
];

// Reglas de validación para el cambio de contraseña.
// passwordActual se valida solo por presencia — la verificación real la hace el service contra bcrypt.
// passwordNueva tiene las mismas reglas de fortaleza que el registro.
const changePasswordValidator = [
  body("passwordActual")
    .exists({ checkFalsy: true }).withMessage("La contraseña actual es requerida"),

  body("passwordNueva")
    .exists({ checkFalsy: true }).withMessage("La nueva contraseña es requerida")
    .isLength({ min: 8, max: 64 }).withMessage("La nueva contraseña debe tener entre 8 y 64 caracteres")
    .matches(/[A-Z]/).withMessage("La nueva contraseña debe tener al menos una mayúscula")
    .matches(/\d/).withMessage("La nueva contraseña debe tener al menos un número")
    .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/).withMessage("La nueva contraseña debe tener al menos un carácter especial")
    // No permitir que la nueva contraseña sea igual a la actual
    .custom((value, { req }) => {
      if (value === req.body.passwordActual) throw new Error("La nueva contraseña debe ser diferente a la actual");
      return true;
    }),

  body("confirmPassword")
    .exists({ checkFalsy: true }).withMessage("La confirmación de contraseña es requerida")
    .custom((value, { req }) => {
      if (value !== req.body.passwordNueva) throw new Error("Las contraseñas no coinciden");
      return true;
    }),
];

// Validación para solicitar recuperación de contraseña.
// Solo se valida formato de email — no se revela si existe o no en DB.
const forgotPasswordValidator = [
  body("email")
    .exists({ checkFalsy: true }).withMessage("El email es requerido")
    .isEmail().withMessage("El email no tiene un formato válido")
    .isLength({ min: 5, max: 100 }).withMessage("El email debe tener entre 5 y 100 caracteres")
    .normalizeEmail(),
];

// Validación para resetear la contraseña con token.
// El token viene del link enviado por email — se valida como hex string de 64 chars (32 bytes).
const resetPasswordValidator = [
  body("token")
    .exists({ checkFalsy: true }).withMessage("El token es requerido")
    .isHexadecimal().withMessage("Token inválido")
    .isLength({ min: 64, max: 64 }).withMessage("Token inválido"),

  body("password")
    .exists({ checkFalsy: true }).withMessage("La contraseña es requerida")
    .isLength({ min: 8, max: 64 }).withMessage("La contraseña debe tener entre 8 y 64 caracteres")
    .matches(/[A-Z]/).withMessage("La contraseña debe tener al menos una mayúscula")
    .matches(/\d/).withMessage("La contraseña debe tener al menos un número")
    .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/).withMessage("La contraseña debe tener al menos un carácter especial"),

  body("confirmPassword")
    .exists({ checkFalsy: true }).withMessage("La confirmación de contraseña es requerida")
    .custom((value, { req }) => {
      if (value !== req.body.password) throw new Error("Las contraseñas no coinciden");
      return true;
    }),
];

module.exports = { registerValidator, loginValidator, changePasswordValidator, forgotPasswordValidator, resetPasswordValidator };
