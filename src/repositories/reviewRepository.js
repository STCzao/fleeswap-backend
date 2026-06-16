const Review = require("../models/Review");
const mongoose = require("mongoose");

const toObjectId = (id) => new mongoose.Types.ObjectId(id);
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const create = (data) => Review.create(data);

const findByExchangeAndReviewer = (exchangeId, reviewerId) =>
  Review.findOne({ exchange: exchangeId, reviewer: reviewerId });

const findReceivedByUser = (userId, { skip = 0, limit = 10 } = {}) =>
  isValidObjectId(userId)
    ? Review.find({ reviewedUser: userId })
        .populate("reviewer", "nombre apellido photo")
        .populate("exchange", "type updatedAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
    : [];

const countReceivedByUser = (userId) =>
  isValidObjectId(userId)
    ? Review.countDocuments({ reviewedUser: userId })
    : 0;

const getStatsByUser = async (userId) => {
  if (!isValidObjectId(userId)) {
    return {
      averageRating: 0,
      totalReviews: 0,
    };
  }

  const [stats] = await Review.aggregate([
    { $match: { reviewedUser: toObjectId(userId) } },
    {
      $group: {
        _id: "$reviewedUser",
        averageRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  return {
    averageRating: stats ? Math.round(stats.averageRating * 10) / 10 : 0,
    totalReviews: stats?.totalReviews || 0,
  };
};

module.exports = {
  create,
  findByExchangeAndReviewer,
  findReceivedByUser,
  countReceivedByUser,
  getStatsByUser,
};
