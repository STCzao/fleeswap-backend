const User = require("../models/User");

// Única capa que interactúa con el modelo User de Mongoose.

// Busca un usuario por email. Retorna el documento o null.
const findByEmail = (email) => User.findOne({ email });

// Busca un usuario por id. Retorna el documento o null.
const findById = (id) => User.findById(id);

// Crea y persiste un nuevo usuario con los datos recibidos.
const create = (data) => User.create(data);

module.exports = { findByEmail, findById, create };
