const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    exchangeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exchange",
      required: [true, "El intercambio es requerido"],
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "El remitente es requerido"],
    },
    content: {
      type: String,
      required: [true, "El contenido es requerido"],
      trim: true,
      maxlength: [1000, "El contenido no puede superar los 1000 caracteres"],
    },
  },
  { timestamps: true },
);

messageSchema.index({ exchangeId: 1, _id: -1 });

module.exports = mongoose.model("Message", messageSchema);
