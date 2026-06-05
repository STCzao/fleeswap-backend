const mongoose = require("mongoose");

const SEARCH_CATEGORIES = [
  "electronica",
  "ropa_accesorios",
  "coleccionables",
  "libros_comics",
  "deportes",
  "hogar_deco",
  "juguetes",
  "arte",
  "musica",
  "otros",
];

const SEARCH_TYPES = ["trueque", "venta", "ambos"];

const activeSearchSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: [true, "La categoria es requerida"],
      enum: {
        values: SEARCH_CATEGORIES,
        message: "La categoria de busqueda no es valida",
      },
    },
    keywords: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 10,
        message: "No se pueden enviar mas de 10 palabras clave",
      },
    },
    type: {
      type: String,
      default: "ambos",
      enum: {
        values: SEARCH_TYPES,
        message: "El tipo de busqueda no es valido",
      },
    },
    criteriaSignature: {
      type: String,
      required: true,
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

activeSearchSchema.index({ user: 1, isActive: 1, createdAt: -1 });
activeSearchSchema.index({ user: 1, criteriaSignature: 1 }, { unique: true });

module.exports = mongoose.model("ActiveSearch", activeSearchSchema);
