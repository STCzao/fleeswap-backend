const mongoose = require("mongoose");

// Modelo de usuario de la plataforma.
// password y resetToken tienen select:false para nunca exponerse en queries por defecto.
// photo almacena la URL pública de Cloudinary.
// profileComplete es un virtual que deriva su valor de los campos reales del perfil.
// NOTA: la fortaleza de la contraseña no se valida aquí porque el modelo recibe
// el hash bcrypt (60+ chars), no la contraseña original. La validación de fortaleza
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
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "El email no tiene un formato válido"],
    },
    password: {
      type: String,
      required: [true, "La contraseña es requerida"],
      select: false,
    },
    role: {
      type: String,
      required: true,
      default: "USER_ROLE",
      enum: { values: ["USER_ROLE", "ADMIN_ROLE"], message: "Rol no válido" },
    },
    photo: {
      type: String,
      default: null,
      maxlength: [300, "La URL de la foto no puede superar los 300 caracteres"],
      match: [/^https?:\/\/.+/, "La URL de la foto no es válida"],
    },
    bio: {
      type: String,
      default: null,
      trim: true,
      minlength: [3, "La biografía debe tener al menos 3 caracteres"],
      maxlength: [300, "La biografía no puede superar los 300 caracteres"],
    },
    location: {
      type: String,
      default: null,
      trim: true,
      minlength: [2, "La ubicación debe tener al menos 2 caracteres"],
      maxlength: [100, "La ubicación no puede superar los 100 caracteres"],
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
      default: null, // expira 24hs después de generarse
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
        message: "La fecha de expiración del token debe ser futura",
      },
    },
  },
  { timestamps: true }
);

// Virtual que indica si el perfil está completo.
// Se considera completo cuando el usuario tiene bio, location y photo cargados.
userSchema.virtual("profileComplete").get(function () {
  return !!(this.bio && this.location && this.photo);
});

module.exports = mongoose.model("User", userSchema);
