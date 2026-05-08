const mongoose = require("mongoose");

const exchangeSchema = new mongoose.Schema(
  {
    offeredPublication: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Publication",
      required: true,
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
    confirmedByRequester: {
      type: Boolean,
      default: false,
    },
    confirmedByOwner: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Exchange", exchangeSchema);
