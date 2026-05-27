const exchangeRepository = require("../repositories/exchangeRepository");
const messageRepository = require("../repositories/messageRepository");
const { buildPagination } = require("../helpers/buildPagination");
const AppError = require("../helpers/AppError");

// El chat está disponible solo para intercambios que ya tuvieron contacto real entre las partes.
// "pending" y "rejected" se bloquean porque el intercambio nunca llegó a concretarse.
// "completed" y "cancelled" se permiten para preservar el historial de mensajes.
const BLOQUEADOS = ["pending", "rejected"];
const PERMITIDOS = ["active", "completed", "cancelled"];

const obtenerMensajes = async (userId, exchangeId, { before, limit }) => {
  const { limit: resolvedLimit } = buildPagination({ limit }, 20);
  const exchange = await exchangeRepository.findById(exchangeId);

  // TODO: eliminar una vez identificada la causa del bug de pertenencia al intercambio
  console.warn("[DEBUG messages] exchangeId:", exchangeId, typeof exchangeId);
  console.warn("[DEBUG messages] userId:", userId?.toString(), typeof userId);
  console.warn("[DEBUG messages] exchange found:", !!exchange);

  if (!exchange) throw new AppError("Solicitud no encontrada", 404);

  const requesterId = exchange.requester?._id?.toString() || exchange.requester?.toString();
  const ownerId = exchange.owner?._id?.toString() || exchange.owner?.toString();

  const esRequester = requesterId === userId.toString();
  const esOwner = ownerId === userId.toString();

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
