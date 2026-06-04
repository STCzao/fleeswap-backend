require("dotenv").config();
const http = require("http");
const app = require("./app");
const connectDB = require("./config/db");
const { initSocket } = require("./sockets");
const logger = require("./helpers/logger");

const PORT = process.env.PORT || 3000;

const start = async () => {
  await connectDB();
  const httpServer = http.createServer(app);
  initSocket(httpServer);

  httpServer.listen(PORT, () => {
    logger.info(`Servidor corriendo en puerto ${PORT}`);
  });
};

start();
