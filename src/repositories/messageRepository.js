const mongoose = require("mongoose");
const Message = require("../models/Message");

const create = (data) => Message.create(data);

const findByExchangeId = async (exchangeId, { before, limit }) => {
  const filter = { exchangeId };

  if (before) {
    filter._id = { $lt: new mongoose.Types.ObjectId(before) };
  }

  return Message.find(filter)
    .populate("senderId", "nombre apellido photo")
    .sort({ _id: -1 })
    .limit(limit + 1);
};

module.exports = {
  create,
  findByExchangeId,
};
