const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    publicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Publication",
      required: true,
    },
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      required: [true, "El motivo del reporte es requerido"],
      enum: {
        values: ["falso", "enganoso", "inapropiado", "otro"],
        message: "Motivo de reporte inválido",
      },
    },
  },
  { timestamps: true }
);

// Índice compuesto único — garantiza la restricción de un reporte por usuario/publicación
// a nivel de DB, como segunda línea de defensa tras el check en el service.
reportSchema.index({ publicationId: 1, reporterId: 1 }, { unique: true });

module.exports = mongoose.model("Report", reportSchema);
