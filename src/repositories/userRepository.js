const User = require("../models/User");

// Única capa que interactúa con el modelo User de Mongoose.

// Busca un usuario por email. Retorna el documento o null.
const findByEmail = (email) => User.findOne({ email });

// Crea y persiste un nuevo usuario con los datos recibidos.
const create = (data) => User.create(data);

module.exports = { findByEmail, create };
