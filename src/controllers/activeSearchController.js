const activeSearchService = require("../services/activeSearchService");

// POST /api/active-searches
// Crea un nuevo criterio de busqueda activa para el usuario autenticado.
const crear = async (req, res, next) => {
  try {
    const activeSearch = await activeSearchService.crear(req.user._id, req.body);
    res.status(201).json(activeSearch);
  } catch (err) {
    next(err);
  }
};

// GET /api/active-searches
// Devuelve los criterios de busqueda del usuario autenticado.
const listar = async (req, res, next) => {
  try {
    const activeSearches = await activeSearchService.listarPorUsuario(req.user._id);
    res.status(200).json(activeSearches);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  crear,
  listar,
};
