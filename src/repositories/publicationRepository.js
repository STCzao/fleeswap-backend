const Publication = require("../models/Publication");

const create = (data) => Publication.create(data);

// Populate limitado a campos públicos del dueño — nunca se expone email, password ni role.
const findById = (id) =>
  Publication.findById(id).populate("owner", "nombre apellido photo location");

// history y description excluidos del select — son campos pesados que solo se sirven en verDetalle.
// status excluido — siempre es 'available' en el listado público, no aporta información variable.
const findAll = (query, { skip, limit }) =>
  Publication.find(query)
    .select("title photos type category condition owner createdAt")
    .populate("owner", "nombre apellido location")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

// Función atómica separada de findAll — el service orquesta ambas en paralelo con Promise.all.
const countAll = (query) => Publication.countDocuments(query);

// Incluye publicaciones unavailable — el owner las necesita para poder reactivarlas desde su panel.
const findByOwner = (ownerId) =>
  Publication.find({ owner: ownerId })
    .select("title photos type status createdAt")
    .sort({ createdAt: -1 });

const updateById = (id, data) =>
  Publication.findByIdAndUpdate(id, data, { new: true, runValidators: true });

const deleteById = (id) => Publication.findByIdAndDelete(id);

module.exports = { create, findById, findAll, countAll, findByOwner, updateById, deleteById };
