const Publication = require("../models/Publication");

const create = (data) => Publication.create(data);

// Populate limitado a campos públicos del dueño — nunca se expone email, password ni role.
const findById = (id) =>
  Publication.findById(id).populate("owner", "nombre apellido photo location");

// findOne con ambas condiciones en lugar de findById + comparación — una sola query a DB.
const findByIdAndOwner = (id, ownerId) =>
  Publication.findOne({ _id: id, owner: ownerId });

// Promise.all ejecuta la query y el count en paralelo — evita dos roundtrips secuenciales a MongoDB.
const findAll = ({ page = 1, limit = 12, category, type, condition, search } = {}) => {
  const query = { status: "available" };

  if (category) query.category = category;
  if (condition) query.condition = condition;

  // Una publicación 'ambos' debe aparecer al filtrar por 'trueque' o por 'venta'.
  if (type) query.type = type === "ambos" ? "ambos" : { $in: [type, "ambos"] };

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;

  return Promise.all([
    Publication.find(query)
      .select("title photos type category condition status owner createdAt")
      .populate("owner", "nombre apellido location")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Publication.countDocuments(query),
  ]);
};

const findByOwner = (ownerId) =>
  Publication.find({ owner: ownerId }).select("title photos type status createdAt").sort({ createdAt: -1 });

const updateById = (id, data) =>
  Publication.findByIdAndUpdate(id, data, { new: true, runValidators: true });

const deleteById = (id) => Publication.findByIdAndDelete(id);

module.exports = { create, findById, findByIdAndOwner, findAll, findByOwner, updateById, deleteById };
