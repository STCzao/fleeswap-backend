const exchangeRepository = require("../repositories/exchangeRepository");
const publicationRepository = require("../repositories/publicationRepository");
const userRepository = require("../repositories/userRepository");
const notificationService = require("./notificationService");
const { buildPagination } = require("../helpers/buildPagination");
const AppError = require("../helpers/AppError");
const logger = require("../helpers/logger");
const { getIO } = require("../sockets");

const notifyBestEffort = async (action, meta, fn) => {
  try {
    await fn();
  } catch (error) {
    logger.error(`${action} notification failed`, {
      ...meta,
      error: error.message,
      stack: error.stack,
    });
  }
};

// Crear solicitud de INTERCAMBIO o COMPRA
const enviarSolicitud = async (
  requesterId,
  { offeredPublicationId, requestedPublicationId, complementaryAmount, type = "exchange" },
) => {
  const requestedPublication = await publicationRepository.findById(requestedPublicationId);
  if (!requestedPublication) throw new AppError("Publicacion no encontrada", 404);
  if (requestedPublication.status !== "available") {
    throw new AppError("La publicacion no esta disponible", 400);
  }
  if (requestedPublication.owner._id.toString() === requesterId.toString()) {
    throw new AppError("No podes comprar/solicitar tu propia publicacion", 400);
  }

  const activeExchange = await exchangeRepository.findActiveByRequesterAndPublication(
    requesterId,
    requestedPublicationId,
  );
  if (activeExchange) {
    throw new AppError("Ya tenes una solicitud activa para esta publicacion", 409);
  }

  const requester = await userRepository.findById(requesterId);

  if (type === "purchase") {
    if (requestedPublication.type === "trueque") {
      throw new AppError("Esta publicacion solo acepta intercambios, no ventas", 400);
    }

    const exchange = await exchangeRepository.create({
      offeredPublication: null,
      requestedPublication: requestedPublication._id,
      requester: requesterId,
      owner: requestedPublication.owner._id,
      complementaryAmount: 0,
      type: "purchase",
    });

    await notifyBestEffort(
      "exchange_request_received",
      { exchangeId: exchange._id, ownerId: requestedPublication.owner._id, requesterId },
      () => notificationService.notifyExchangeRequestReceived({
        exchange,
        requester,
        requestedPublication,
        offeredPublication: null,
      }),
    );

    return exchange;
  }

  const offeredPublication = await publicationRepository.findById(offeredPublicationId);
  if (!offeredPublication) throw new AppError("Publicacion no encontrada", 404);
  if (offeredPublication.owner._id.toString() !== requesterId.toString()) {
    throw new AppError("No podes ofrecer una publicacion que no es tuya", 403);
  }
  if (offeredPublication.status !== "available") {
    throw new AppError("Tu publicacion no esta disponible", 400);
  }
  if (offeredPublication._id.toString() === requestedPublication._id.toString()) {
    throw new AppError("No podes intercambiar un objeto por si mismo", 400);
  }

  const exchange = await exchangeRepository.create({
    offeredPublication: offeredPublication._id,
    requestedPublication: requestedPublication._id,
    requester: requesterId,
    owner: requestedPublication.owner._id,
    complementaryAmount: complementaryAmount ?? 0,
    type: "exchange",
  });

  await notifyBestEffort(
    "exchange_request_received",
    { exchangeId: exchange._id, ownerId: requestedPublication.owner._id, requesterId },
    () => notificationService.notifyExchangeRequestReceived({
      exchange,
      requester,
      requestedPublication,
      offeredPublication,
    }),
  );

  return exchange;
};

const obtenerRecibidas = async (ownerId, query) => {
  const { page, limit, skip } = buildPagination(query);
  const filter = query.status ? { status: query.status } : {};

  const [exchanges, total] = await Promise.all([
    exchangeRepository.findReceivedByOwner(ownerId, filter, { skip, limit }),
    exchangeRepository.countReceived(ownerId, filter),
  ]);

  return {
    exchanges,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const obtenerEnviadas = async (requesterId, query) => {
  const { page, limit, skip } = buildPagination(query);
  const filter = query.status ? { status: query.status } : {};

  const [exchanges, total] = await Promise.all([
    exchangeRepository.findSentByRequester(requesterId, filter, { skip, limit }),
    exchangeRepository.countSent(requesterId, filter),
  ]);

  return {
    exchanges,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const obtenerPorId = async (userId, exchangeId) => {
  const exchange = await exchangeRepository.findById(exchangeId);
  if (!exchange) throw new AppError("Solicitud no encontrada", 404);

  const requesterId = exchange.requester?._id?.toString() || exchange.requester?.toString();
  const ownerId = exchange.owner?._id?.toString() || exchange.owner?.toString();

  const esRequester = requesterId === userId.toString();
  const esOwner = ownerId === userId.toString();

  if (!esRequester && !esOwner) {
    throw new AppError("No participas en este intercambio/venta", 403);
  }

  return exchange;
};

const aceptarSolicitud = async (ownerId, exchangeId) => {
  const exchange = await exchangeRepository.findById(exchangeId);
  if (!exchange) throw new AppError("Solicitud no encontrada", 404);
  const exchangeOwnerId = exchange.owner?._id?.toString() || exchange.owner?.toString();
  if (exchangeOwnerId !== ownerId.toString()) throw new AppError("No autorizado", 403);
  if (exchange.status !== "pending") {
    throw new AppError("La solicitud no esta en estado pendiente", 400);
  }

  const updatedExchange = await exchangeRepository.updateStatusById(exchangeId, "active");
  const requestedPublicationId = exchange.requestedPublication._id;

  if (exchange.type === "purchase") {
    await publicationRepository.updateById(requestedPublicationId, {
      intercambioActivo: true,
    });
  } else {
    const offeredPublicationId = exchange.offeredPublication._id;
    await Promise.all([
      publicationRepository.updateById(offeredPublicationId, {
        intercambioActivo: true,
      }),
      publicationRepository.updateById(requestedPublicationId, {
        intercambioActivo: true,
      }),
    ]);
  }

  await notifyBestEffort(
    "exchange_request_accepted",
    { exchangeId, ownerId, requesterId: exchange.requester._id || exchange.requester },
    () => notificationService.notifyExchangeRequestAccepted({
      exchange,
      owner: exchange.owner,
    }),
  );

  return updatedExchange;
};

const rechazarSolicitud = async (ownerId, exchangeId) => {
  const exchange = await exchangeRepository.findById(exchangeId);
  if (!exchange) throw new AppError("Solicitud no encontrada", 404);
  const exchangeOwnerId = exchange.owner?._id?.toString() || exchange.owner?.toString();
  if (exchangeOwnerId !== ownerId.toString()) throw new AppError("No autorizado", 403);
  if (exchange.status !== "pending") {
    throw new AppError("La solicitud no esta en estado pendiente", 400);
  }

  const updatedExchange = await exchangeRepository.updateStatusById(exchangeId, "rejected");

  await notifyBestEffort(
    "exchange_request_rejected",
    { exchangeId, ownerId, requesterId: exchange.requester._id || exchange.requester },
    () => notificationService.notifyExchangeRequestRejected({
      exchange,
      owner: exchange.owner,
    }),
  );

  return updatedExchange;
};

const confirmarIntercambio = async (userId, exchangeId) => {
  const exchange = await exchangeRepository.findById(exchangeId);
  if (!exchange) throw new AppError("Solicitud no encontrada", 404);

  const requesterId = exchange.requester?._id?.toString() || exchange.requester?.toString();
  const ownerId = exchange.owner?._id?.toString() || exchange.owner?.toString();

  const esRequester = requesterId === userId.toString();
  const esOwner = ownerId === userId.toString();

  if (!esRequester && !esOwner) {
    throw new AppError("No participas en este intercambio/venta", 403);
  }
  if (exchange.status !== "active") {
    throw new AppError("El intercambio/venta no esta en curso", 400);
  }

  if (exchange.type === "purchase") {
    if (!esOwner) throw new AppError("Solo el vendedor puede confirmar la venta", 403);
    if (exchange.confirmedByOwner) throw new AppError("Ya confirmaste esta venta", 400);

    await Promise.all([
      publicationRepository.updateById(exchange.requestedPublication._id, {
        status: "sold",
        intercambioActivo: false,
      }),
      exchangeRepository.rejectPendingByPublications([exchange.requestedPublication._id], exchangeId),
    ]);

    const updatedExchange = await exchangeRepository.updateById(exchangeId, {
      confirmedByOwner: true,
      status: "completed",
    });

    const io = getIO();
    if (!io) {
      logger.warn("chat:readonly no emitido - socket no inicializado", { exchangeId });
    } else {
      io.to(`chat:${exchangeId}`).emit("chat:readonly", {
        exchangeId: exchangeId.toString(),
        reason: "completed",
      });
    }

    return updatedExchange;
  }

  if ((esRequester && exchange.confirmedByRequester) || (esOwner && exchange.confirmedByOwner)) {
    throw new AppError("Ya confirmaste este intercambio", 400);
  }

  const data = esRequester
    ? { confirmedByRequester: true }
    : { confirmedByOwner: true };

  const ambasConfirmadas =
    (esRequester && exchange.confirmedByOwner) ||
    (esOwner && exchange.confirmedByRequester);

  if (ambasConfirmadas) {
    data.status = "completed";
    await Promise.all([
      publicationRepository.updateById(exchange.offeredPublication._id, {
        status: "exchanged",
        intercambioActivo: false,
      }),
      publicationRepository.updateById(exchange.requestedPublication._id, {
        status: "exchanged",
        intercambioActivo: false,
      }),
      exchangeRepository.rejectPendingByPublications(
        [exchange.offeredPublication._id, exchange.requestedPublication._id],
        exchangeId,
      ),
    ]);
  }

  const updatedExchange = await exchangeRepository.updateById(exchangeId, data);

  if (ambasConfirmadas) {
    const io = getIO();
    if (!io) {
      logger.warn("chat:readonly no emitido - socket no inicializado", { exchangeId });
    } else {
      io.to(`chat:${exchangeId}`).emit("chat:readonly", {
        exchangeId: exchangeId.toString(),
        reason: "completed",
      });
    }
  }

  return updatedExchange;
};

const cancelarIntercambio = async (userId, exchangeId) => {
  const exchange = await exchangeRepository.findById(exchangeId);
  if (!exchange) throw new AppError("Solicitud no encontrada", 404);

  const requesterId = exchange.requester?._id?.toString() || exchange.requester?.toString();
  const ownerId = exchange.owner?._id?.toString() || exchange.owner?.toString();

  const esRequester = requesterId === userId.toString();
  const esOwner = ownerId === userId.toString();

  if (!esRequester && !esOwner) {
    throw new AppError("No participas en este intercambio/venta", 403);
  }

  if (exchange.status === "pending") {
    if (!esRequester) {
      throw new AppError("Como dueno, debes rechazar la solicitud en lugar de cancelarla", 400);
    }
    return exchangeRepository.updateById(exchangeId, { status: "cancelled" });
  }

  if (exchange.status !== "active") {
    throw new AppError("No se puede cancelar una solicitud en este estado", 400);
  }

  if (exchange.type === "purchase") {
    const [updatedExchange] = await Promise.all([
      exchangeRepository.updateById(exchangeId, { status: "cancelled" }),
      publicationRepository.updateById(exchange.requestedPublication._id, {
        status: "available",
        intercambioActivo: false,
      }),
    ]);

    const io = getIO();
    if (io) {
      io.to(`chat:${exchangeId}`).emit("chat:readonly", {
        exchangeId: exchangeId.toString(),
        reason: "cancelled",
      });
    } else {
      logger.warn("chat:readonly no emitido - socket no inicializado", { exchangeId });
    }

    return updatedExchange;
  }

  const [updatedExchange] = await Promise.all([
    exchangeRepository.updateById(exchangeId, { status: "cancelled" }),
    publicationRepository.updateById(exchange.offeredPublication._id, {
      status: "available",
      intercambioActivo: false,
    }),
    publicationRepository.updateById(exchange.requestedPublication._id, {
      status: "available",
      intercambioActivo: false,
    }),
  ]);

  const io = getIO();
  if (!io) {
    logger.warn("chat:readonly no emitido - socket no inicializado", { exchangeId });
  } else {
    io.to(`chat:${exchangeId}`).emit("chat:readonly", {
      exchangeId: exchangeId.toString(),
      reason: "cancelled",
    });
  }

  return updatedExchange;
};

module.exports = {
  enviarSolicitud,
  obtenerRecibidas,
  obtenerEnviadas,
  obtenerPorId,
  aceptarSolicitud,
  rechazarSolicitud,
  confirmarIntercambio,
  cancelarIntercambio,
};
