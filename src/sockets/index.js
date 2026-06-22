const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const userRepository = require("../repositories/userRepository");
const logger = require("../helpers/logger");
const { registerChatHandlers } = require("./chat.socket");

let io;

const getUserRoom = (userId) => `user:${userId.toString()}`;

const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "http://localhost:5173",
  "https://fleeswap.vercel.app",
];

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, origin);
        callback(new Error("Not allowed by CORS"));
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      // El token viaja en handshake.auth y no en cookies porque Socket.IO
      // no tiene acceso confiable a las cookies httpOnly en todos los transportes.
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("No autorizado"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await userRepository.findById(decoded.id);

      if (!user || !user.isActive) {
        return next(new Error("No autorizado"));
      }

      socket.user = user;
      return next();
    } catch (err) {
      logger.error("socket auth error", { err });
      return next(new Error("No autorizado"));
    }
  });

  io.on("connection", (socket) => {
    // Cada usuario autenticado entra a su room privada para recibir
    // notificaciones de producto sin mezclarlas con las rooms de chat.
    socket.join(getUserRoom(socket.user._id));
    registerChatHandlers(io, socket);
  });

  return io;
};

const getIO = () => io;

module.exports = {
  initSocket,
  getIO,
  getUserRoom,
};
