const mongoose = require("mongoose");
const exchangeRepository = require("../repositories/exchangeRepository");
const messageRepository = require("../repositories/messageRepository");
const logger = require("../helpers/logger");

const MAX_MESSAGE_LENGTH = 1000;

const getParticipantIds = (exchange) => [
  (exchange.requester._id || exchange.requester).toString(),
  exchange.owner.toString(),
];

const esParticipante = (exchange, userId) =>
  getParticipantIds(exchange).includes(userId.toString());

const mapMessagePayload = (message, sender) => ({
  _id: message._id,
  content: message.content,
  sender: {
    _id: sender._id,
    nombre: sender.nombre,
    apellido: sender.apellido,
    photo: sender.photo,
  },
  createdAt: message.createdAt,
});

const withAck = (ack, payload) => {
  if (typeof ack === "function") {
    ack(payload);
  }
};

const registerChatHandlers = (io, socket) => {
  socket.on("chat:join", async ({ exchangeId } = {}, ack) => {
    try {
      if (!exchangeId) {
        return withAck(ack, { ok: false, error: "exchangeId es requerido" });
      }

      if (!mongoose.isValidObjectId(exchangeId)) {
        return withAck(ack, { ok: false, error: "exchangeId inválido" });
      }

      const exchange = await exchangeRepository.findById(exchangeId);

      if (!exchange) {
        return withAck(ack, { ok: false, error: "Solicitud no encontrada" });
      }

      if (!esParticipante(exchange, socket.user._id)) {
        return withAck(ack, { ok: false, error: "No autorizado" });
      }

      if (exchange.status !== "active") {
        return withAck(ack, { ok: false, error: "El chat no está disponible" });
      }

      socket.join(`chat:${exchangeId}`);
      socket.emit("chat:enabled", { exchangeId: exchangeId.toString() });

      return withAck(ack, { ok: true });
    } catch (err) {
      logger.error("chat:join error", { userId: socket.user._id, exchangeId, err });
      return withAck(ack, { ok: false, error: "No se pudo unir al chat" });
    }
  });

  socket.on("chat:message", async ({ exchangeId, content } = {}, ack) => {
    try {
      const normalizedContent = typeof content === "string" ? content.trim() : "";

      if (!exchangeId) {
        return withAck(ack, { ok: false, error: "exchangeId es requerido" });
      }

      if (!mongoose.isValidObjectId(exchangeId)) {
        return withAck(ack, { ok: false, error: "exchangeId inválido" });
      }

      if (!normalizedContent) {
        return withAck(ack, { ok: false, error: "El contenido es requerido" });
      }

      if (normalizedContent.length > MAX_MESSAGE_LENGTH) {
        return withAck(ack, { ok: false, error: "El contenido no puede superar los 1000 caracteres" });
      }

      const exchange = await exchangeRepository.findById(exchangeId);

      if (!exchange) {
        return withAck(ack, { ok: false, error: "Solicitud no encontrada" });
      }

      if (!esParticipante(exchange, socket.user._id)) {
        return withAck(ack, { ok: false, error: "No autorizado" });
      }

      if (exchange.status !== "active") {
        return withAck(ack, { ok: false, error: "El chat no está disponible" });
      }

      const message = await messageRepository.create({
        exchangeId,
        senderId: socket.user._id,
        content: normalizedContent,
      });
      await message.populate("senderId", "nombre apellido photo");

      const payload = mapMessagePayload(message, message.senderId);

      io.to(`chat:${exchangeId}`).emit("chat:message", payload);

      return withAck(ack, { ok: true, message: payload });
    } catch (err) {
      logger.error("chat:message error", { userId: socket.user._id, exchangeId, err });
      return withAck(ack, { ok: false, error: "No se pudo enviar el mensaje" });
    }
  });
};

module.exports = {
  registerChatHandlers,
};
