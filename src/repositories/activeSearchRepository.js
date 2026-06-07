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

module.exports = {
  create,
  findByUser,
  findById,
  findByUserAndCriteria,
  findByUserAndCriteriaExcludingId,
  updateById,
  deleteById,
};
