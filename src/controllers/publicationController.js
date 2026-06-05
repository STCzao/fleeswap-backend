const publicationService = require("../services/publicationService");
const userService = require("../services/userService");

// POST /api/publications
// El ownership queda implícito en req.user._id; el usuario solo puede crear publicaciones propias.
const crear = async (req, res, next) => {
  try {
    const publication = await publicationService.crear(req.user._id, req.body);
    res.status(201).json(publication);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/publications/:id
// Se pasa req.user._id al service para que verifique ownership; el controller no toma esa decisión.
const editar = async (req, res, next) => {
  try {
    const publication = await publicationService.editar(req.params.id, req.user._id, req.body);
    res.status(200).json(publication);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/publications/:id
// El service verifica ownership y (futuro Sprint 3-4) intercambio activo antes de eliminar.
const eliminar = async (req, res, next) => {
  try {
    await publicationService.eliminar(req.params.id, req.user._id);
    res.status(200).json({ message: "Publicación eliminada correctamente" });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/publications/:id/status
// Ruta separada de PATCH /:id para que el cambio de estado sea un contrato explícito,
// no un campo editable más; reduce el riesgo de que un update genérico cambie el status.
const cambiarEstado = async (req, res, next) => {
  try {
    const publication = await publicationService.cambiarEstado(req.params.id, req.user._id, req.body.status);
    res.status(200).json(publication);
  } catch (err) {
    next(err);
  }
};

// GET /api/publications/:id
// req.user puede ser null si el visitante no está autenticado; el service maneja ambos casos.
const verDetalle = async (req, res, next) => {
  try {
    const publication = await publicationService.verDetalle(req.params.id, req.user?._id);
    res.status(200).json(publication);
  } catch (err) {
    next(err);
  }
};

// GET /api/publications
// req.query se pasa completo al service; el clamping de page/limit y la construcción
// del filtro son responsabilidad del service, no del controller.
const listar = async (req, res, next) => {
  try {
    const result = await publicationService.listar(req.query);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

// GET /api/publications/recommendations
// Usa las categorias preferidas del usuario autenticado para devolver sugerencias para Home.
const recomendar = async (req, res, next) => {
  try {
    const limit = req.query.limit;
    const result = await userService.obtenerRecomendaciones(req.user._id, limit);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

// POST /api/publications/:id/report
// 201 porque se crea un recurso Report, aunque no se devuelve en la respuesta.
const reportar = async (req, res, next) => {
  try {
    await publicationService.reportar(
      req.params.id,
      req.user._id,
      req.body.reason,
      req.body.details,
    );
    res.status(201).json({ message: "Reporte enviado correctamente" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  crear,
  editar,
  eliminar,
  cambiarEstado,
  verDetalle,
  listar,
  recomendar,
  reportar,
};
