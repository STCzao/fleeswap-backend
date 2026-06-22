const exchangeRepository = require("../repositories/exchangeRepository");
const reviewRepository = require("../repositories/reviewRepository");
const publicationRepository = require("../repositories/publicationRepository");
const userRepository = require("../repositories/userRepository");
const notificationService = require("./notificationService");
const { buildPagination } = require("../helpers/buildPagination");
const AppError = require("../helpers/AppError");
const logger = require("../helpers/logger");
const { getIO } = require("../sockets");

const BLOQUEO_PUBLICACION = "suspended";

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

const tienePublicacionBloqueada = (exchange) =>
  exchange.requestedPublication?.status === BLOQUEO_PUBLICACION ||
  exchange.offeredPublication?.status === BLOQUEO_PUBLICACION;

const validarPublicacionesNoBloqueadas = (exchange) => {
  if (tienePublicacionBloqueada(exchange)) {
    throw new AppError("La publicación está bloqueada por revisión", 409);
  }
};

const attachHasRated = async (exchanges, reviewerId) => {
  if (exchanges.length === 0) return exchanges;

  const reviews = await reviewRepository.findByExchangesAndReviewer(
    exchanges.map((exchange) => exchange._id),
    reviewerId,
  );
  const ratedExchangeIds = new Set(reviews.map((review) => review.exchange.toString()));

  return exchanges.map((exchange) => ({
    ...exchange.toObject(),
    hasRated: ratedExchangeIds.has(exchange._id.toString()),
  }));
};

// Crear solicitud de INTERCAMBIO o COMPRA
const enviarSolicitud = async (
  requesterId,
  { offeredPublicationId, requestedPublicationId, complementaryAmount, type = "exchange" },
) => {
  const requestedPublication = await publicationRepository.findById(requestedPublicationId);
  if (!requestedPublication) throw new AppError("Publicación no encontrada", 404);
  if (requestedPublication.status !== "available") {
    throw new AppError("La publicación no está disponible", 400);
  }
  if (requestedPublication.owner._id.toString() === requesterId.toString()) {
    throw new AppError("No podés comprar/solicitar tu propia publicación", 400);
  }

  const activeExchange = await exchangeRepository.findActiveByRequesterAndPublication(
    requesterId,
    requestedPublicationId,
  );
  if (activeExchange) {
    throw new AppError("Ya tenés una solicitud activa para esta publicación", 409);
  }

  const requester = await userRepository.findById(requesterId);

  if (type === "purchase") {
    if (requestedPublication.type === "trueque") {
      throw new AppError("Esta publicación solo acepta intercambios, no ventas", 400);
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
  if (!offeredPublication) throw new AppError("Publicación no encontrada", 404);
  if (offeredPublication.owner._id.toString() !== requesterId.toString()) {
    throw new AppError("No podés ofrecer una publicación que no es tuya", 403);
  }
  if (offeredPublication.status !== "available") {
    throw new AppError("Tu publicación no está disponible", 400);
  }
  if (offeredPublication._id.toString() === requestedPublication._id.toString()) {
    throw new AppError("No podés intercambiar un objeto por sí mismo", 400);
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
    exchanges: await attachHasRated(exchanges, ownerId),
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
    exchanges: await attachHasRated(exchanges, requesterId),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const buildHistoryEntry = (exchange, userId) => {
  const requesterId = exchange.requester?._id?.toString() || exchange.requester?.toString();
  const isRequester = requesterId === userId.toString();
  const object = isRequester
    ? exchange.requestedPublication
    : exchange.offeredPublication || exchange.requestedPublication;
  const counterpart = isRequester ? exchange.owner : exchange.requester;

  return {
    id: exchange._id,
    type: exchange.type,
    status: exchange.status,
    role: isRequester ? "requester" : "owner",
    object,
    counterpart,
    createdAt: exchange.createdAt,
    updatedAt: exchange.updatedAt,
    detailUrl: `/api/exchanges/${exchange._id}`,
  };
};

const obtenerHistorial = async (userId, query = {}) => {
  const { page, limit, skip } = buildPagination(query);
  const allowedStatuses = ["pending", "active", "completed", "cancelled"];
  const filter = query.status
    ? { status: query.status }
    : { status: { $in: allowedStatuses } };

  const [exchanges, total] = await Promise.all([
    exchangeRepository.findHistoryByUser(userId, filter, { skip, limit }),
    exchangeRepository.countHistoryByUser(userId, filter),
  ]);

  return {
    exchanges: exchanges.map((exchange) => buildHistoryEntry(exchange, userId)),
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
    throw new AppError("No participás en este intercambio/venta", 403);
  }

  return exchange;
};

const aceptarSolicitud = async (ownerId, exchangeId) => {
  const exchange = await exchangeRepository.findById(exchangeId);
  if (!exchange) throw new AppError("Solicitud no encontrada", 404);
  const exchangeOwnerId = exchange.owner?._id?.toString() || exchange.owner?.toString();
  if (exchangeOwnerId !== ownerId.toString()) throw new AppError("No autorizado", 403);
  if (exchange.status !== "pending") {
    throw new AppError("La solicitud no está en estado pendiente", 400);
  }

  validarPublicacionesNoBloqueadas(exchange);

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
    throw new AppError("La solicitud no está en estado pendiente", 400);
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
    throw new AppError("No participás en este intercambio/venta", 403);
  }
  if (exchange.status !== "active") {
    throw new AppError("El intercambio/venta no está en curso", 400);
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
      completedAt: new Date(),
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
    data.completedAt = new Date();
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
    throw new AppError("No participás en este intercambio/venta", 403);
  }

  if (exchange.status === "pending") {
    if (!esRequester) {
      throw new AppError("Como dueño, debes rechazar la solicitud en lugar de cancelarla", 400);
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
  obtenerHistorial,
  obtenerPorId,
  aceptarSolicitud,
  rechazarSolicitud,
  confirmarIntercambio,
  cancelarIntercambio,
};
