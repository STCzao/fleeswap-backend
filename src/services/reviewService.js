const mongoose = require("mongoose");
const exchangeRepository = require("../repositories/exchangeRepository");
const reviewRepository = require("../repositories/reviewRepository");
const { buildPagination } = require("../helpers/buildPagination");
const AppError = require("../helpers/AppError");

const REVIEW_WINDOW_DAYS = 7;
const REVIEW_WINDOW_MS = REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;

const toObjectId = (value) => {
  const id = value._id || value;
  return new mongoose.Types.ObjectId(id);
};

const sameId = (left, right) => toObjectId(left).equals(toObjectId(right));

const resolveReviewedUser = (exchange, reviewerId) => {
  if (sameId(exchange.requester, reviewerId)) return toObjectId(exchange.owner);
  if (sameId(exchange.owner, reviewerId)) return toObjectId(exchange.requester);
  return null;
};

const ensureReviewWindowOpen = (exchange) => {
  const completedAt = exchange.updatedAt || exchange.createdAt;
  const deadline = new Date(completedAt).getTime() + REVIEW_WINDOW_MS;

  if (Date.now() > deadline) {
    throw new AppError("El plazo para calificar este intercambio ya venció", 400);
  }
};

const isCompletedByRequiredParticipants = (exchange) => {
  if (exchange.type === "purchase") return exchange.confirmedByOwner === true;
  return exchange.confirmedByRequester === true && exchange.confirmedByOwner === true;
};

const crear = async (reviewerId, { exchangeId, rating, comment }) => {
  const exchange = await exchangeRepository.findById(exchangeId);
  if (!exchange) throw new AppError("Intercambio no encontrado", 404);
  if (exchange.status !== "completed" || !isCompletedByRequiredParticipants(exchange)) {
    throw new AppError("Solo se pueden calificar intercambios completados", 400);
  }

  const reviewedUser = resolveReviewedUser(exchange, reviewerId);
  if (!reviewedUser) throw new AppError("No podés calificar un intercambio ajeno", 403);

  ensureReviewWindowOpen(exchange);

  const existingReview = await reviewRepository.findByExchangeAndReviewer(exchangeId, reviewerId);
  if (existingReview) throw new AppError("Ya calificaste este intercambio", 409);

  return reviewRepository.create({
    exchange: exchangeId,
    reviewer: reviewerId,
    reviewedUser,
    rating,
    comment,
  });
};

const listarRecibidas = async (userId, query = {}) => {
  const pagination = buildPagination(query);
  const [reviews, total] = await Promise.all([
    reviewRepository.findReceivedByUser(userId, pagination),
    reviewRepository.countReceivedByUser(userId),
  ]);

  return {
    reviews,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      pages: Math.ceil(total / pagination.limit),
    },
  };
};

module.exports = {
  crear,
  listarRecibidas,
  REVIEW_WINDOW_DAYS,
};
