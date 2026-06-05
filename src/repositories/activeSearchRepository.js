const ActiveSearch = require("../models/ActiveSearch");

const create = (data) => ActiveSearch.create(data);

const findByUser = (userId) =>
  ActiveSearch.find({ user: userId }).sort({ createdAt: -1 });

const findByUserAndCriteria = (userId, criteriaSignature) =>
  ActiveSearch.findOne({ user: userId, criteriaSignature }).select("_id");

module.exports = {
  create,
  findByUser,
  findByUserAndCriteria,
};
