const Publication = require("../models/Publication");

const create = (data) => Publication.create(data);

// Populate limitado a campos públicos del dueño; nunca se expone email, password ni role.
const findById = (id) =>
  Publication.findById(id).populate("owner", "nombre apellido photo location");

// history y description excluidos del select; son campos pesados que solo se sirven en verDetalle.
// status excluido; siempre es 'available' en el listado público, no aporta información variable.
const findAll = (query, { skip, limit }) =>
  Publication.find(query)
    .select("title photos type category condition price status owner createdAt")
    .populate("owner", "nombre apellido location")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

// Función atómica separada de findAll; el service orquesta ambas en paralelo con Promise.all.
const countAll = (query) => Publication.countDocuments(query);

// Incluye publicaciones unavailable; el owner las necesita para poder reactivarlas desde su panel.
const findByOwner = (ownerId) =>
  Publication.find({ owner: ownerId })
    .select("title photos type price status createdAt")
    .sort({ createdAt: -1 });

const findPublicAvailableByOwner = (ownerId, limit = 10) =>
  Publication.find({ owner: ownerId, status: "available" })
    .select("title photos type category condition price status createdAt")
    .sort({ createdAt: -1 })
    .limit(limit);

const findRecommendedByCategories = (ownerId, categories, limit) =>
  Publication.find({
    owner: { $ne: ownerId },
    status: "available",
    category: { $in: categories },
  })
    .select("title photos type category condition price status owner createdAt")
    .populate("owner", "nombre apellido location")
    .sort({ createdAt: -1 })
    .limit(limit);

const updateById = (id, data) =>
  Publication.findByIdAndUpdate(id, data, { returnDocument: "after", runValidators: true });

const incrementReportCount = (id) =>
  Publication.findByIdAndUpdate(id, { $inc: { reportCount: 1 } }, { returnDocument: "after" });

const deleteById = (id) => Publication.findByIdAndDelete(id);

module.exports = {
  create,
  findById,
  findAll,
  countAll,
  findByOwner,
  findPublicAvailableByOwner,
  findRecommendedByCategories,
  updateById,
  incrementReportCount,
  deleteById,
};
