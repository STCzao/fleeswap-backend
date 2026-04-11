const authService = require("../services/authService");

// POST /api/auth/register
// El middleware validate ya garantiza que los datos son válidos.
// Solo delega al service y propaga errores al errorHandler global via next(err).
const register = async (req, res, next) => {
  try {
    const { accessToken, refreshToken, user } = await authService.register(req.body);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: Number(process.env.JWT_REFRESH_EXPIRES_IN_MS),
    });

    res.status(201).json({ accessToken, user });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
// Emite el refreshToken como cookie httpOnly (no accesible desde JS del cliente).
// secure:true solo en producción — en desarrollo HTTP no soporta Secure.
// sameSite:"strict" previene CSRF: el browser no envía la cookie en requests cross-site.
const login = async (req, res, next) => {
  try {
    const { accessToken, refreshToken, user } = await authService.login(req.body);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: Number(process.env.JWT_REFRESH_EXPIRES_IN_MS),
    });

    res.status(200).json({ accessToken, user });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/refresh
// El refreshToken llega automáticamente via cookie httpOnly — el cliente no lo maneja.
// Emite un nuevo accessToken y rota el refreshToken (cookie actualizada).
const refresh = async (req, res, next) => {
  try {
    const { refreshToken: oldToken } = req.cookies;
    const { accessToken, refreshToken } = await authService.refresh(oldToken);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: Number(process.env.JWT_REFRESH_EXPIRES_IN_MS),
    });

    res.status(200).json({ accessToken });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/logout
// Limpia el refresh token en DB y elimina la cookie httpOnly del browser.
// Responde 200 siempre — si la sesión ya estaba cerrada no es un error.
const logout = async (req, res, next) => {
  try {
    await authService.logout(req.cookies.refreshToken);

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.status(200).json({ message: "Sesión cerrada correctamente" });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, refresh, logout };
