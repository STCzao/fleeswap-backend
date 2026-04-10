const jwt = require("jsonwebtoken");
const userRepository = require("../repositories/userRepository");
const AppError = require("../helpers/AppError");

// Middleware de autenticación para rutas protegidas.
// Extrae el JWT del header Authorization (Bearer <token>).
// Verifica firma y expiración — jwt.verify lanza error si falla.
// Adjunta el usuario completo a req.user para que los siguientes middlewares lo consuman.
// No incluye password: findById usa el schema por defecto (select:false en password).
const authenticate = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(new AppError("Token no proporcionado", 401));
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await userRepository.findById(decoded.id);
    if (!user) return next(new AppError("Usuario no encontrado", 401));

    req.user = user;
    next();
  } catch (err) {
    // jwt.verify lanza JsonWebTokenError o TokenExpiredError
    if (err.name === "TokenExpiredError") return next(new AppError("Token expirado", 401));
    if (err.name === "JsonWebTokenError") return next(new AppError("Token inválido", 401));
    next(err);
  }
};

module.exports = authenticate;
