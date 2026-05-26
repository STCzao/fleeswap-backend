const exchangeRepository = require("../repositories/exchangeRepository");
const messageRepository = require("../repositories/messageRepository");
const { buildPagination } = require("../helpers/buildPagination");
const AppError = require("../helpers/AppError");

const BLOQUEADOS = ["pending", "rejected"];
const PERMITIDOS = ["active", "completed", "cancelled"];

const obtenerMensajes = async (userId, exchangeId, { before, limit }) => {
  const { limit: resolvedLimit } = buildPagination({ limit }, 20);
  const exchange = await exchangeRepository.findById(exchangeId);

  // DEBUG TEMPORAL - eliminar una vez identificada la causa
  console.warn("[DEBUG messages] exchangeId:", exchangeId, typeof exchangeId);
  console.warn("[DEBUG messages] userId:", userId?.toString(), typeof userId);
  console.warn("[DEBUG messages] exchange found:", !!exchange);

  if (!exchange) throw new AppError("Solicitud no encontrada", 404);

  const esRequester = exchange.requester._id.toString() === userId.toString();
  const esOwner = exchange.owner.toString() === userId.toString();

  if (!esRequester && !esOwner) {
    throw new AppError("No participás en este intercambio", 403);
  }

  if (BLOQUEADOS.includes(exchange.status)) {
    throw new AppError("El chat no está disponible para este intercambio", 403);
  }

  if (!PERMITIDOS.includes(exchange.status)) {
    throw new AppError("Estado de intercambio inválido", 400);
  }

  const rows = await messageRepository.findByExchangeId(exchangeId, {
    before,
    limit: resolvedLimit,
  });
  const hasMore = rows.length > resolvedLimit;
  const messages = (hasMore ? rows.slice(0, resolvedLimit) : rows)
    .reverse()
    .map((message) => ({
      _id: message._id,
      content: message.content,
      sender: {
        _id: message.senderId?._id ?? null,
        nombre: message.senderId?.nombre ?? null,
        apellido: message.senderId?.apellido ?? null,
        photo: message.senderId?.photo ?? null,
      },
      createdAt: message.createdAt,
    }));

  return {
    messages,
    hasMore,
    exchangeStatus: exchange.status,
  };
};

module.exports = {
  obtenerMensajes,
};
