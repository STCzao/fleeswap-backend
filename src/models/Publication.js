const mongoose = require("mongoose");

// photos se valida con dos validators separados porque Mongoose ejecuta cada uno
// independientemente — un único validator con && no genera mensajes distintos por caso.
const publicationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "El título es requerido"],
      trim: true,
      maxlength: [100, "El título no puede superar los 100 caracteres"],
    },
    description: {
      type: String,
      required: [true, "La descripción es requerida"],
      maxlength: [1000, "La descripción no puede superar los 1000 caracteres"],
    },
    history: {
      type: String,
      required: [true, "La historia del objeto es requerida"],
      maxlength: [2000, "La historia no puede superar los 2000 caracteres"],
    },
    category: {
      type: String,
      required: [true, "La categoría es requerida"],
      enum: {
        values: ["electronica", "ropa_accesorios", "coleccionables", "libros_comics", "deportes", "hogar_deco", "juguetes", "arte", "musica", "otros"],
        message: "Categoría inválida",
      },
    },
    condition: {
      type: String,
      required: [true, "El estado del objeto es requerido"],
      enum: {
        values: ["nuevo", "como_nuevo", "bueno", "regular", "deteriorado"],
        message: "Estado del objeto inválido",
      },
    },
    type: {
      type: String,
      required: [true, "El tipo de publicación es requerido"],
      enum: {
        values: ["trueque", "venta", "ambos"],
        message: "Tipo de publicación inválido",
      },
    },
    photos: {
      type: [String],
      validate: [
        { validator: (arr) => arr.length >= 1, message: "Debe incluir al menos 1 foto" },
        { validator: (arr) => arr.length <= 5, message: "No puede incluir más de 5 fotos" },
      ],
    },
    status: {
      type: String,
      enum: ["available", "unavailable"],
      default: "available",
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Índice de texto para que $regex en búsqueda por palabras clave use el índice en lugar de hacer collection scan.
publicationSchema.index({ title: "text", description: "text" });

module.exports = mongoose.model("Publication", publicationSchema);
