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

// GET /api/admin/reports
const listarReportes = async (req, res, next) => {
  try {
    const reportes = await adminService.listarReportes(req.query);
    res.status(200).json(reportes);
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
  listarReportes,
  resolverReporte,
};
