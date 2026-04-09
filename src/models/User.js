const mongoose = require("mongoose");

// Modelo de usuario de la plataforma.
// Los campos opcionales (photo, bio, location) se completan en el flujo de edición de perfil.
// photo almacena la URL pública de Cloudinary.
const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true }, // almacenada como hash bcrypt
    role: { type: String, enum: ["user", "admin"], default: "user" },
    photo: { type: String, default: null },
    bio: { type: String, default: null },
    location: { type: String, default: null },
    profileComplete: { type: Boolean, default: false }, // true cuando el usuario completa su perfil
    resetToken: { type: String, default: null },        // token para recuperación de contraseña
    resetTokenExpiry: { type: Date, default: null },    // expiración del token de recuperación
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
