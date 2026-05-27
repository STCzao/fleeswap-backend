const mongoose = require("mongoose");
const Message = require("../models/Message");

const create = (data) => Message.create(data);

// Paginación cursor-based: `before` es el _id del mensaje más antiguo ya cargado.
// Se pide limit+1 para detectar si hay más páginas sin un count extra; el service
// descarta el elemento extra y setea hasMore en consecuencia.
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
