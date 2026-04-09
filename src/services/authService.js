const bcrypt = require("bcrypt");
const userRepository = require("../repositories/userRepository");
const generateToken = require("../helpers/generateToken");
const AppError = require("../helpers/AppError");

// Registra un nuevo usuario en la plataforma.
// Lanza AppError 400 si faltan campos, 409 si el email ya está en uso.
// Retorna el JWT y los datos públicos del usuario creado.
const register = async ({ email, password }) => {
  if (!email || !password) throw new AppError("Email y contraseña son requeridos", 400);

  const existing = await userRepository.findByEmail(email);
  if (existing) throw new AppError("El email ya está registrado", 409);

  const hashed = await bcrypt.hash(password, 10);
  const user = await userRepository.create({ email, password: hashed });

  const token = generateToken(user);

  return { token, user: { id: user._id, email: user.email, role: user.role } };
};

module.exports = { register };
