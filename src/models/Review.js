const mongoose = require("mongoose");
const sanitizarTexto = require("../helpers/sanitizarTexto");

const reviewSchema = new mongoose.Schema(
  {
    exchange: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exchange",
      required: true,
      index: true,
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reviewedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: [true, "La calificación es requerida"],
      min: [1, "La calificación mínima es 1"],
      max: [5, "La calificación máxima es 5"],
      validate: {
        validator: Number.isInteger,
        message: "La calificación debe ser un número entero",
      },
    },
    comment: {
      type: String,
      default: null,
      trim: true,
      maxlength: [500, "El comentario no puede superar los 500 caracteres"],
    },
  },
  { timestamps: true },
);

reviewSchema.index({ exchange: 1, reviewer: 1 }, { unique: true });
reviewSchema.index({ reviewedUser: 1, createdAt: -1 });

reviewSchema.pre("validate", function () {
  if (this.comment !== undefined && this.comment !== null) {
    const cleanComment = sanitizarTexto(this.comment);
    this.comment = cleanComment.length > 0 ? cleanComment : null;
  }
});

module.exports = mongoose.model("Review", reviewSchema);
