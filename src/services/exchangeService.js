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

// Determina por qué una publicación del exchange no es operable, o null si está todo OK.
// Se distinguen dos motivos porque tienen mensajes (y semántica) distintos para el usuario:
//   - "eliminada": populate devolvió null → la publicación fue borrada (por el dueño o un admin).
//     requestedPublication siempre es obligatoria; offeredPublication es null por diseño en las
//     compras ("purchase"), pero en los intercambios ("exchange") también es obligatoria, así
//     que null ahí también significa borrada.
//   - "suspendida": la publicación sigue existiendo pero está en revisión de moderación.
// El mensaje "bloqueada por revisión" se mantiene alineado con el del socket de chat
// (ver chat.socket.js), para que el usuario reciba el mismo texto por ambas vías.
const motivoPublicacionNoOperable = (exchange) => {
  const requested = exchange.requestedPublication;
  const offered = exchange.offeredPublication;

  if (!requested) return "eliminada";
  if (exchange.type !== "purchase" && !offered) return "eliminada";

  if (requested.status === BLOQUEO_PUBLICACION || offered?.status === BLOQUEO_PUBLICACION) {
    return "suspendida";
  }

  return null;
};

const validarPublicacionesNoBloqueadas = (exchange) => {
  const motivo = motivoPublicacionNoOperable(exchange);

  if (motivo === "suspendida") {
    throw new AppError("La publicación está bloqueada por revisión", 409);
  }
  if (motivo === "eliminada") {
    throw new AppError("La publicación ya no está disponible", 409);
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

  validarPublicacionesNoBloqueadas(exchange);

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

  // A diferencia de aceptar/confirmar, cancelar NUNCA debe rechazarse por publicación
  // borrada o suspendida — cancelar es precisamente la vía de salida cuando algo de la
  // publicación ya no está bien. Por eso acá no se usa validarPublicacionesNoBloqueadas;
  // en cambio, liberarPublicacionTrasCancelar tolera null (borrada) sin romper, y respeta
  // el estado "suspended" (no lo pisa con "available") para no deshacer una moderación.
  const emitirChatReadonly = () => {
    const io = getIO();
    if (io) {
      io.to(`chat:${exchangeId}`).emit("chat:readonly", {
        exchangeId: exchangeId.toString(),
        reason: "cancelled",
      });
    } else {
      logger.warn("chat:readonly no emitido - socket no inicializado", { exchangeId });
    }
  };

  if (exchange.type === "purchase") {
    const [updatedExchange] = await Promise.all([
      exchangeRepository.updateById(exchangeId, { status: "cancelled" }),
      liberarPublicacionTrasCancelar(exchange.requestedPublication),
    ]);

    emitirChatReadonly();
    return updatedExchange;
  }

  const [updatedExchange] = await Promise.all([
    exchangeRepository.updateById(exchangeId, { status: "cancelled" }),
    liberarPublicacionTrasCancelar(exchange.offeredPublication),
    liberarPublicacionTrasCancelar(exchange.requestedPublication),
  ]);

  emitirChatReadonly();
  return updatedExchange;
};

// Libera una publicación que quedó "atada" a un exchange que se cancela.
// - publication null (fue borrada): no hay nada que actualizar, se devuelve sin romper.
// - publication suspended (moderación en curso): se apaga intercambioActivo pero el
//   status NO se toca, para no reactivar por accidente algo que un admin suspendió.
// - cualquier otro caso: vuelve a "available", como antes.
const liberarPublicacionTrasCancelar = (publication) => {
  if (!publication) return null;

  const data = { intercambioActivo: false };
  if (publication.status !== BLOQUEO_PUBLICACION) data.status = "available";

  return publicationRepository.updateById(publication._id, data);
};

// Se invoca cuando una publicación deja de estar disponible por una acción ajena a las
// partes del exchange (un admin la borra o la suspende por moderación). Cancela en cascada
// cualquier solicitud pending/active que la involucre, para que nunca quede un Exchange
// apuntando a una publicación inexistente o inválida (esa referencia rota es la causa de
// los 500 en accept/confirm/cancel y de que un intercambio nunca llegue a "completed" para
// poder calificarlo).
//
// Importante: esta función NUNCA toca el status de `publicationId` (la publicación que
// disparó la cascada) — si fue borrada no existe nada que tocar, y si fue suspendida debe
// seguir suspendida; revertirla es decisión exclusiva de la moderación (ver adminService),
// no de este flujo. Solo se libera la OTRA publicación involucrada en cada exchange.
const cancelarPorPublicacionNoDisponible = async (publicationId) => {
  const exchanges = await exchangeRepository.findActiveOrPendingByPublication(publicationId);

  await Promise.all(
    exchanges.map(async (exchange) => {
      const eraActive = exchange.status === "active";

      await exchangeRepository.updateById(exchange._id, { status: "cancelled" });

      if (!eraActive) return; // pending: nunca llegó a tocar publicaciones, nada que liberar

      const otraPublicacionId = [exchange.offeredPublication, exchange.requestedPublication]
        .filter(Boolean)
        .find((pub) => pub.toString() !== publicationId.toString());

      if (otraPublicacionId) {
        // No viene populada (findActiveOrPendingByPublication no hace populate), así que
        // hay que pedirla para saber su status — si la "otra" publicación también está
        // suspended por su lado, liberarPublicacionTrasCancelar evita reactivarla.
        const otraPublicacion = await publicationRepository.findById(otraPublicacionId);
        await liberarPublicacionTrasCancelar(otraPublicacion);
      }

      const io = getIO();
      if (io) {
        io.to(`chat:${exchange._id}`).emit("chat:readonly", {
          exchangeId: exchange._id.toString(),
          reason: "cancelled",
        });
      } else {
        logger.warn("chat:readonly no emitido - socket no inicializado", {
          exchangeId: exchange._id,
        });
      }
    }),
  );
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
  cancelarPorPublicacionNoDisponible,
};
