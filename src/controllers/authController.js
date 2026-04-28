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
// Si la cuenta fue reactivada (soft-delete revertido), incluye reactivated:true en la respuesta.
const login = async (req, res, next) => {
  try {
    const { accessToken, refreshToken, reactivated, user } = await authService.login(req.body);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: Number(process.env.JWT_REFRESH_EXPIRES_IN_MS),
    });

    const response = { accessToken, user };
    if (reactivated) response.reactivated = true;

    res.status(200).json(response);
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

// PATCH /api/auth/change-password
// Cambia la contraseña y revoca la sesión — el frontend debe redirigir a login.
// Limpia la cookie httpOnly para que el browser no envíe un refresh token ya inválido.
const cambiarPassword = async (req, res, next) => {
  try {
    const { passwordActual, passwordNueva } = req.body;
    await authService.cambiarPassword(req.user._id, passwordActual, passwordNueva);

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.status(200).json({ message: "Contraseña actualizada correctamente" });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/forgot-password
// Responde 200 siempre — no revela si el email existe o no (previene enumeración).
const forgotPassword = async (req, res, next) => {
  try {
    await authService.solicitarResetPassword(req.body.email);
    res.status(200).json({ message: "Si el email está registrado, recibirás un enlace de recuperación" });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/reset-password
// Recibe el token del link de email y la nueva contraseña.
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    await authService.resetPassword(token, password);
    res.status(200).json({ message: "Contraseña restablecida correctamente" });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, refresh, logout, cambiarPassword, forgotPassword, resetPassword };
