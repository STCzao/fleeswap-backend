const ActiveSearch = require("../models/ActiveSearch");

const create = (data) => ActiveSearch.create(data);

const findByUser = (userId) =>
  ActiveSearch.find({ user: userId }).sort({ createdAt: -1 });

const findById = (id) => ActiveSearch.findById(id);

const findByUserAndCriteria = (userId, criteriaSignature) =>
  ActiveSearch.findOne({ user: userId, criteriaSignature }).select("_id");

const findByUserAndCriteriaExcludingId = (userId, criteriaSignature, excludedId) =>
  ActiveSearch.findOne({
    user: userId,
    criteriaSignature,
    _id: { $ne: excludedId },
  }).select("_id");

const updateById = (id, data) =>
  ActiveSearch.findByIdAndUpdate(id, data, {
    returnDocument: "after",
    runValidators: true,
  });

const deleteById = (id) => ActiveSearch.findByIdAndDelete(id);

// Filtra primero por owner/category/type/isActive para no evaluar palabras clave
// contra toda la colección cuando se crea una publicación nueva.
const findMatchingCandidates = ({ ownerId, category, compatibleTypes }) =>
  ActiveSearch.find({
    user: { $ne: ownerId },
    isActive: true,
    category,
    type: { $in: compatibleTypes },
  }).select("user category keywords type isActive");

module.exports = {
  create,
  findByUser,
  findById,
  findByUserAndCriteria,
  findByUserAndCriteriaExcludingId,
  updateById,
  deleteById,
  findMatchingCandidates,
};
