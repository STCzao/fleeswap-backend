const mongoose = require("mongoose");

const exchangeSchema = new mongoose.Schema(
  {
    offeredPublication: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Publication",
      // Opcional: null en compras directas (type === "purchase")
      default: null,
    },
    requestedPublication: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Publication",
      required: true,
    },
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "active", "completed", "cancelled", "rejected"],
      default: "pending",
    },
    complementaryAmount: {
      type: Number,
      default: 0,
      min: [0, "El monto complementario no puede ser negativo"],
    },
    // Patrón de doble confirmación: el intercambio se completa solo cuando ambas partes confirman.
    // El service verifica que ambos flags sean true antes de pasar el status a "completed".
    confirmedByRequester: {
      type: Boolean,
      default: false,
    },
    confirmedByOwner: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    // "exchange" = trueque clásico, "purchase" = compra directa
    type: {
      type: String,
      enum: ["exchange", "purchase"],
      default: "exchange",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Exchange", exchangeSchema);
