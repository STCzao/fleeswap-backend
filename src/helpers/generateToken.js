const jwt = require("jsonwebtoken");

// Genera un access token JWT de corta duración (15m por defecto).
// Contiene el id y rol del usuario. Se almacena en memoria en el frontend (Zustand).
const generateAccessToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

// Genera un refresh token JWT de larga duración (controlado por JWT_REFRESH_EXPIRES_IN).
// Se envía como httpOnly cookie — nunca accesible desde JavaScript.
// Se almacena hasheado en la DB.
const generateRefreshToken = (user) =>
  jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN }
  );

module.exports = { generateAccessToken, generateRefreshToken };
