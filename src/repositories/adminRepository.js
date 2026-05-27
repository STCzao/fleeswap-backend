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

// `isActive: { $exists: true }` asegura que solo se operen usuarios del modelo actual.
// Documentos legacy sin el campo quedan fuera del scope del panel de admin.
const findUsuarioById = (id) =>
  User.findOne({ _id: id, isActive: { $exists: true } })
    .select("nombre apellido email role isActive createdAt bio location photo isVerified")
    .lean();

const actualizarUsuarioById = (id, data, session) =>
  User.findOneAndUpdate(
    { _id: id, isActive: { $exists: true } },
    data,
    { new: true, runValidators: true, ...(session && { session }) },
  )
    .select("nombre apellido email role isActive createdAt bio location photo isVerified")
    .lean();

const listarReportes = (filtro, skip, limit) =>
  Report.find(filtro)
    .populate("publicationId", "title status reportCount owner photos")
    .populate("reporterId", "nombre apellido email photo")
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
    .populate("publicationId", "title status reportCount owner photos")
    .populate("reporterId", "nombre apellido email photo");

const suspenderPublicacion = (publicationId, session) =>
  Publication.findByIdAndUpdate(
    publicationId,
    { status: "suspended" },
    { new: true, ...(session && { session }) },
  );

const findPublicacionConOwner = (id) =>
  Publication.findById(id)
    .populate("owner", "nombre email")
    .lean();

// Solo suspende las publicaciones "available": las que ya están "unavailable" o "suspended"
// no se tocan para no perder su estado original si el usuario fuese reactivado más adelante.
const suspenderPublicacionesDisponiblesDeUsuario = (ownerId, session) =>
  Publication.updateMany(
    { owner: ownerId, status: "available" },
    { status: "suspended" },
    { ...(session && { session }) },
  );

const listarPublicaciones = (filtro, skip, limit) =>
  Publication.find(filtro)
    .populate("owner", "nombre apellido email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

const contarPublicaciones = (filtro) => Publication.countDocuments(filtro);

const actualizarPublicacionById = (id, data) =>
  Publication.findByIdAndUpdate(id, data, { new: true, runValidators: true })
    .populate("owner", "nombre apellido email");

const eliminarPublicacionById = (id, session) =>
  Publication.findByIdAndDelete(id, { ...(session && { session }) });

const eliminarReportesDePublicacion = (publicationId, session) =>
  Report.deleteMany({ publicationId }, { ...(session && { session }) });

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
  findUsuarioById,
  actualizarUsuarioById,
  listarReportes,
  contarReportes,
  findReporteById,
  actualizarEstadoReporte,
  suspenderPublicacion,
  findPublicacionConOwner,
  suspenderPublicacionesDisponiblesDeUsuario,
  listarPublicaciones,
  contarPublicaciones,
  actualizarPublicacionById,
  eliminarPublicacionById,
  eliminarReportesDePublicacion,
  contarPublicacionesActivas,
  contarReportesPendientes,
  contarIntercambiosActivos,
};
