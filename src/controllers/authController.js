const authService = require("../services/authService");

// POST /api/auth/register
// El middleware validate ya garantiza que los datos son válidos.
// Solo delega al service y propaga errores al errorHandler global via next(err).
const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = { register };
