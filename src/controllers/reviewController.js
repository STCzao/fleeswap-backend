const reviewService = require("../services/reviewService");

const crear = async (req, res, next) => {
  try {
    const review = await reviewService.crear(req.user._id, req.body);
    res.status(201).json(review);
  } catch (err) {
    next(err);
  }
};

const listarRecibidas = async (req, res, next) => {
  try {
    const result = await reviewService.listarRecibidas(req.user._id, req.query);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  crear,
  listarRecibidas,
};
