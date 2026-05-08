const mongoose = require("mongoose");
const LOCALIDADES_TUCUMAN = require("../helpers/localidadesTucuman");

// Modelo de usuario de la plataforma.
// password y resetToken tienen select:false para nunca exponerse en queries por defecto.
// photo almacena la URL publica de Cloudinary.
// profileComplete es un virtual que deriva su valor de los campos reales del perfil.
// NOTA: la fortaleza de la contrasena no se valida aqui porque el modelo recibe
// el hash bcrypt (60+ chars), no la contrasena original. La validacion de fortaleza
// vive en la ruta via express-validator.
const userSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, "El nombre es requerido"],
      minlength: [2, "El nombre debe tener al menos 2 caracteres"],
      maxlength: [50, "El nombre no puede superar los 50 caracteres"],
    },
    apellido: {
      type: String,
      required: [true, "El apellido es requerido"],
      minlength: [2, "El apellido debe tener al menos 2 caracteres"],
      maxlength: [50, "El apellido no puede superar los 50 caracteres"],
    },
    fechaNacimiento: {
      type: Date,
      required: [true, "La fecha de nacimiento es requerida"],
    },
    email: {
      type: String,
      required: [true, "El email es requerido"],
      unique: true,
      lowercase: true,
      minlength: [5, "El email debe tener al menos 5 caracteres"],
      maxlength: [100, "El email no puede superar los 100 caracteres"],
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "El email no tiene un formato valido"],
    },
    password: {
      type: String,
      required: [true, "La contrasena es requerida"],
      select: false,
    },
    role: {
      type: String,
      required: true,
      default: "USER_ROLE",
      enum: { values: ["USER_ROLE", "ADMIN_ROLE"], message: "Rol no valido" },
    },
    photo: {
      type: String,
      default: null,
      maxlength: [300, "La URL de la foto no puede superar los 300 caracteres"],
      match: [/^https:\/\/.+/, "La URL de la foto no es valida"],
    },
    bio: {
      type: String,
      default: null,
      trim: true,
      minlength: [3, "La biografia debe tener al menos 3 caracteres"],
      maxlength: [300, "La biografia no puede superar los 300 caracteres"],
    },
    location: {
      type: String,
      default: null,
      enum: {
        values: [null, ...LOCALIDADES_TUCUMAN],
        message: "La localidad seleccionada no es valida",
      },
    },
    isVerified: {
      type: Boolean,
      default: false, // true una vez que el usuario confirma su email
    },
    verificationToken: {
      type: String,
      default: null,
      select: false,
    },
    verificationTokenExpiry: {
      type: Date,
      default: null, // expira 24hs despues de generarse
    },
    refreshToken: {
      type: String,
      default: null,
      select: false, // almacenado como hash bcrypt
    },
    refreshTokenExpiry: {
      type: Date,
      default: null,
    },
    resetToken: {
      type: String,
      default: null,
      select: false,
    },
    resetTokenExpiry: {
      type: Date,
      default: null,
      validate: {
        validator: (value) => value === null || value > new Date(),
        message: "La fecha de expiracion del token debe ser futura",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true, // indexado para filtrar eficientemente en todas las queries
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Query middleware: filtra usuarios eliminados automaticamente en todas las queries.
// Las funciones que necesitan incluir usuarios inactivos (login, register) deben
// agregar explicitamente { isActive: { $exists: true } } o usar el Model directamente.
const filtrarInactivos = function () {
  if (!this.getFilter().hasOwnProperty("isActive")) {
    this.where({ isActive: { $ne: false } });
  }
};

userSchema.pre("find", filtrarInactivos);
userSchema.pre("findOne", filtrarInactivos);
userSchema.pre("findOneAndUpdate", filtrarInactivos);
userSchema.pre("countDocuments", filtrarInactivos);

// Virtual que indica si el perfil esta completo.
// Se considera completo cuando el usuario tiene bio, location y photo cargados.
userSchema.virtual("profileComplete").get(function () {
  return !!(this.bio && this.location && this.photo);
});

module.exports = mongoose.model("User", userSchema);
