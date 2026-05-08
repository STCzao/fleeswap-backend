const User = require("../models/User");
const Publication = require("../models/Publication");
const Report = require("../models/Report");
const Exchange = require("../models/Exchange");

const contarUsuariosActivos = () => User.countDocuments({ isActive: true });

const listarUsuarios = (filtro, skip, limit) =>
  User.find(filtro)
    .select("nombre apellido email role isActive createdAt")
    .skip(skip)
    .limit(limit)
    .lean();

const contarUsuarios = (filtro) => User.countDocuments(filtro);

const listarReportes = (filtro, skip, limit) =>
  Report.find(filtro)
    .populate("publicationId", "title status reportCount owner")
    .populate("reporterId", "nombre apellido email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

const contarReportes = (filtro) => Report.countDocuments(filtro);

const findReporteById = (id) => Report.findById(id);

const actualizarEstadoReporte = (id, status, session) =>
  Report.findByIdAndUpdate(
    id,
    { status },
    { new: true, ...(session && { session }) },
  )
    .populate("publicationId", "title status reportCount owner")
    .populate("reporterId", "nombre apellido email");

const suspenderPublicacion = (publicationId, session) =>
  Publication.findByIdAndUpdate(
    publicationId,
    { status: "suspended" },
    { new: true, ...(session && { session }) },
  );

const contarPublicacionesActivas = () =>
  Publication.countDocuments({ status: "available" });

const contarReportesPendientes = () =>
  Report.countDocuments({ status: "pending" });

const contarIntercambiosActivos = () =>
  Exchange.countDocuments({ status: "active" });

module.exports = {
  contarUsuariosActivos,
  listarUsuarios,
  contarUsuarios,
  listarReportes,
  contarReportes,
  findReporteById,
  actualizarEstadoReporte,
  suspenderPublicacion,
  contarPublicacionesActivas,
  contarReportesPendientes,
  contarIntercambiosActivos,
};
