const jwt = require("jsonwebtoken");
const userRepository = require("../repositories/userRepository");

// Igual que authenticate pero no rechaza si no hay token — permite rutas públicas
// que se comportan distinto según si el visitante está autenticado o no.
// Si hay token válido adjunta req.user; si no, continúa sin req.user.
const optionalAuthenticate = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return next();

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await userRepository.findById(decoded.id);
    if (user) req.user = user;

    next();
  } catch {
    // Token inválido o expirado — se trata como visitante anónimo, no como error
    next();
  }
};

module.exports = optionalAuthenticate;
