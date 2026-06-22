const mongoose = require("mongoose");
const dns = require("dns");
const logger = require("../helpers/logger")

// Fuerza la resolución DNS a través de Google/Cloudflare para evitar fallos de conexión
// en entornos con servidores DNS corporativos o ISP que bloquean MongoDB Atlas SRV.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    logger.info("MongoDB conectado");
  } catch (error) {
    logger.error("Error al conectar MongoDB", { message: error.message });
    process.exit(1);
  }
};

module.exports = connectDB;
