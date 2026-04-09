const jwt = require("jsonwebtoken");

// Genera un JWT firmado con el id y rol del usuario.
// Usa JWT_SECRET y JWT_EXPIRES_IN definidos en .env.
const generateToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

module.exports = generateToken;
