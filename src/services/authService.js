const bcrypt = require("bcrypt");
const crypto = require("crypto");
const userRepository = require("../repositories/userRepository");
const { generateAccessToken } = require("../helpers/generateToken");
const sanitizarTexto = require("../helpers/sanitizarTexto");
const AppError = require("../helpers/AppError");

// Registra un nuevo usuario en la plataforma.
// Desestructura solo los campos necesarios — confirmPassword no llega al service.
// Mitiga timing attacks hasheando siempre, independientemente de si el email existe.
// Sanitiza nombre y apellido contra XSS antes de persistir.
// Genera un verificationToken (expira en 24hs) para la futura verificación via Resend.
const register = async ({ nombre, apellido, fechaNacimiento, email, password }) => {
  const existing = await userRepository.findByEmail(email);

  // Hash dummy para igualar el tiempo de respuesta independientemente del resultado
  if (existing) {
    await bcrypt.hash(password, 10);
    throw new AppError("El email ya está registrado", 409);
  }

  const hashed = await bcrypt.hash(password, 10);
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24hs

  const user = await userRepository.create({
    nombre: sanitizarTexto(nombre),
    apellido: sanitizarTexto(apellido),
    fechaNacimiento,
    email,
    password: hashed,
    verificationToken,
    verificationTokenExpiry,
  });

  // TODO: enviar email de verificación con Resend cuando se implemente la HU correspondiente

  const accessToken = generateAccessToken(user);

  return {
    accessToken,
    user: {
      id: user._id,
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
    },
  };
};

module.exports = { register };
