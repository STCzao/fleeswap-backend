const adminRepository = require("../repositories/adminRepository");
const { buildPagination } = require("../helpers/buildPagination");
const AppError = require("../helpers/AppError");
const mongoose = require("mongoose");

const USERS_PER_PAGE = 20;

// Escapa metacaracteres antes de construir el RegExp para evitar patrones costosos
// o comportamientos inesperados cuando la búsqueda viene desde query params.
const escaparRegex = (texto = "") => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const obtenerStats = async () => {
  const [
    usuariosActivos,
    publicacionesActivas,
    reportesPendientes,
    intercambiosActivos,
  ] = await Promise.all([
    adminRepository.contarUsuariosActivos(),
    adminRepository.contarPublicacionesActivas(),
    adminRepository.contarReportesPendientes(),
    adminRepository.contarIntercambiosActivos(),
  ]);

  return {
    usuariosActivos,
    publicacionesActivas,
    reportesPendientes,
    intercambiosActivos,
  };
};

const listarUsuarios = async ({ role, isActive, search, page }) => {
  const pagina = Math.max(1, parseInt(page, 10) || 1);
  const skip = (pagina - 1) * USERS_PER_PAGE;
  const filtro = { isActive: { $exists: true } };

  if (role) filtro.role = role;
  if (isActive === "true" || isActive === "false") filtro.isActive = isActive === "true";

  if (search) {
    const searchEscapado = escaparRegex(search.trim());
    if (searchEscapado) {
      filtro.$or = [
        { nombre: { $regex: searchEscapado, $options: "i" } },
        { apellido: { $regex: searchEscapado, $options: "i" } },
        { email: { $regex: searchEscapado, $options: "i" } },
      ];
    }
  }

  const [usuarios, total] = await Promise.all([
    adminRepository.listarUsuarios(filtro, skip, USERS_PER_PAGE),
    adminRepository.contarUsuarios(filtro),
  ]);

  return {
    usuarios,
    total,
    pagina,
    totalPaginas: Math.ceil(total / USERS_PER_PAGE),
  };
};

const listarReportes = async ({ status, reason, page, limit }) => {
  const { page: pagina, limit: limite, skip } = buildPagination({ page, limit });
  const filtro = {};

  if (status) filtro.status = status;
  if (reason) filtro.reason = reason;

  const [reportes, total] = await Promise.all([
    adminRepository.listarReportes(filtro, skip, limite),
    adminRepository.contarReportes(filtro),
  ]);

  return {
    reportes,
    total,
    pagina,
    totalPaginas: Math.ceil(total / limite),
  };
};

const resolverReporte = async (id, action) => {
  const reporte = await adminRepository.findReporteById(id);
  if (!reporte) throw new AppError("Reporte no encontrado", 404);
  if (reporte.status !== "pending") throw new AppError("El reporte ya fue resuelto", 400);

  if (action === "suspend_publication") {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await adminRepository.suspenderPublicacion(reporte.publicationId, session);
      const reporteActualizado = await adminRepository.actualizarEstadoReporte(
        id,
        "reviewed",
        session,
      );
      await session.commitTransaction();
      return reporteActualizado;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  return adminRepository.actualizarEstadoReporte(id, "dismissed");
};

module.exports = { obtenerStats, listarUsuarios, listarReportes, resolverReporte };
