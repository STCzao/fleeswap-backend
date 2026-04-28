const cloudinary = require("cloudinary").v2;

// Configuración del SDK de Cloudinary.
// Las credenciales viven en .env — nunca se exponen al cliente.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = cloudinary;
