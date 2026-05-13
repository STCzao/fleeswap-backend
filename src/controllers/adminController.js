const adminService = require("../services/adminService");

// GET /api/admin/stats
const obtenerStats = async (_req, res, next) => {
  try {
    const stats = await adminService.obtenerStats();
    res.status(200).json(stats);
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/users
const listarUsuarios = async (req, res, next) => {
  try {
    const usuarios = await adminService.listarUsuarios(req.query);
    res.status(200).json(usuarios);
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/users/:id
const obtenerUsuarioPorId = async (req, res, next) => {
  try {
    const usuario = await adminService.obtenerUsuarioPorId(req.params.id);
    res.status(200).json(usuario);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/users/:id/status
const cambiarEstadoUsuario = async (req, res, next) => {
  try {
    const usuario = await adminService.cambiarEstadoUsuario(
      req.params.id,
      req.user._id,
      req.body.isActive,
    );
    res.status(200).json(usuario);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/users/:id/role
const cambiarRolUsuario = async (req, res, next) => {
  try {
    const usuario = await adminService.cambiarRolUsuario(
      req.params.id,
      req.user._id,
      req.body.role,
    );
    res.status(200).json(usuario);
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/reports
const listarReportes = async (req, res, next) => {
  try {
    const reportes = await adminService.listarReportes(req.query);
    res.status(200).json(reportes);
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/publications
const listarPublicaciones = async (req, res, next) => {
  try {
    const publicaciones = await adminService.listarPublicaciones(req.query);
    res.status(200).json(publicaciones);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/publications/:id/status
const cambiarEstadoPublicacion = async (req, res, next) => {
  try {
    const publicacion = await adminService.cambiarEstadoPublicacion(
      req.params.id,
      req.body.status,
    );
    res.status(200).json(publicacion);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/publications/:id
const eliminarPublicacion = async (req, res, next) => {
  try {
    await adminService.eliminarPublicacion(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/reports/:id/resolve
const resolverReporte = async (req, res, next) => {
  try {
    const reporte = await adminService.resolverReporte(req.params.id, req.body.action);
    res.status(200).json(reporte);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  obtenerStats,
  listarUsuarios,
  obtenerUsuarioPorId,
  cambiarEstadoUsuario,
  cambiarRolUsuario,
  listarReportes,
  listarPublicaciones,
  cambiarEstadoPublicacion,
  eliminarPublicacion,
  resolverReporte,
};
