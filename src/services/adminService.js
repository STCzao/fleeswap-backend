const adminRepository = require("../repositories/adminRepository");
const { buildPagination } = require("../helpers/buildPagination");
const AppError = require("../helpers/AppError");
const enviarEmail = require("../helpers/enviarEmail");
const mongoose = require("mongoose");

const USERS_PER_PAGE = 20;

// Escapa metacaracteres antes de construir el RegExp para evitar patrones costosos
// o comportamientos inesperados cuando la búsqueda viene desde query params.
const escaparRegex = (texto = "") => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ── Dashboard de métricas (H7.1) ──────────────────────────────────────────────
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

// ── Gestión de usuarios (H7.2 / H7.3) ────────────────────────────────────────
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

const obtenerUsuarioPorId = async (id) => {
  const usuario = await adminRepository.findUsuarioById(id);
  if (!usuario) throw new AppError("Usuario no encontrado", 404);

  return usuario;
};

const cambiarEstadoUsuario = async (targetUserId, currentUserId, isActive) => {
  if (targetUserId.toString() === currentUserId.toString()) {
    throw new AppError("El admin no puede operar sobre si mismo", 400);
  }

  // Transacción para garantizar que el usuario y sus publicaciones se actualicen atómicamente.
  // Si la suspensión de publicaciones falla, el usuario tampoco queda suspendido.
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const usuario = await adminRepository.actualizarUsuarioById(
      targetUserId,
      { isActive, ...(isActive ? { deletedAt: null } : { deletedAt: new Date() }) },
      session,
    );

    if (!usuario) throw new AppError("Usuario no encontrado", 404);

    if (!isActive) {
      await adminRepository.suspenderPublicacionesDisponiblesDeUsuario(targetUserId, session);
    }

    await session.commitTransaction();
    return usuario;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

const cambiarRolUsuario = async (targetUserId, currentUserId, role) => {
  if (targetUserId.toString() === currentUserId.toString()) {
    throw new AppError("El admin no puede operar sobre si mismo", 400);
  }

  const usuario = await adminRepository.actualizarUsuarioById(targetUserId, { role });
  if (!usuario) throw new AppError("Usuario no encontrado", 404);

  return usuario;
};

// ── Gestión de reportes (H7.5) ────────────────────────────────────────────────
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

// ── Gestión de publicaciones (H7.4) ──────────────────────────────────────────
const listarPublicaciones = async ({ status, category, page, limit }) => {
  const { page: pagina, limit: limite, skip } = buildPagination({ page, limit });
  const filtro = {};

  if (status) filtro.status = status;
  if (category) filtro.category = category;

  const [publicaciones, total] = await Promise.all([
    adminRepository.listarPublicaciones(filtro, skip, limite),
    adminRepository.contarPublicaciones(filtro),
  ]);

  return {
    publicaciones,
    total,
    pagina,
    totalPaginas: Math.ceil(total / limite),
  };
};

const cambiarEstadoPublicacion = async (id, status) => {
  const publicacion = await adminRepository.actualizarPublicacionById(id, { status });
  if (!publicacion) throw new AppError("Publicación no encontrada", 404);

  return publicacion;
};

const eliminarPublicacion = async (id) => {
  // Transacción para eliminar publicación y sus reportes asociados de forma atómica.
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const publicacion = await adminRepository.eliminarPublicacionById(id, session);
    if (!publicacion) throw new AppError("Publicación no encontrada", 404);

    await adminRepository.eliminarReportesDePublicacion(id, session);
    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

const resolverReporte = async (id, action) => {
  const reporte = await adminRepository.findReporteById(id);
  if (!reporte) throw new AppError("Reporte no encontrado", 404);
  if (reporte.status !== "pending") throw new AppError("El reporte ya fue resuelto", 400);

  if (action === "suspend_publication") {
    // Transacción para garantizar que la publicación se suspende y el reporte se marca
    // como reviewed en la misma operación. El email al dueño se envía fuera de la transacción
    // porque es una operación externa que no debe bloquear el commit.
    const session = await mongoose.startSession();
    let reporteActualizado;
    try {
      session.startTransaction();
      await adminRepository.suspenderPublicacion(reporte.publicationId, session);
      reporteActualizado = await adminRepository.actualizarEstadoReporte(
        id,
        "reviewed",
        session,
      );
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    const publicacion = await adminRepository.findPublicacionConOwner(reporte.publicationId);
    if (publicacion?.owner?.email) {
      await enviarEmail({
        to: publicacion.owner.email,
        subject: "Tu publicación fue suspendida en Fleeswap",
        html: `
          <p>Hola ${publicacion.owner.nombre},</p>
          <p>Tu publicación <strong>${publicacion.title}</strong> fue suspendida por nuestro equipo de moderación tras revisar un reporte.</p>
          <p>Si creés que se trata de un error, podés contactarnos respondiendo este email.</p>
          <p>El equipo de Fleeswap</p>
        `,
      });
    }

    return reporteActualizado;
  }

  return adminRepository.actualizarEstadoReporte(id, "dismissed");
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
