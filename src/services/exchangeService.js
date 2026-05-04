const exchangeRepository = require("../repositories/exchangeRepository");
const publicationRepository = require("../repositories/publicationRepository");
const { buildPagination } = require("../helpers/buildPagination");
const AppError = require("../helpers/AppError");

const enviarSolicitud = async (
  requesterId,
  { offeredPublicationId, requestedPublicationId, complementaryAmount },
) => {
  const requestedPublication = await publicationRepository.findById(requestedPublicationId);
  if (!requestedPublication) throw new AppError("Publicación no encontrada", 404);
  if (requestedPublication.status !== "available") {
    throw new AppError("La publicación no está disponible", 400);
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
  if (requestedPublication.owner._id.toString() === requesterId.toString()) {
    throw new AppError("No podés solicitar intercambio por tu propia publicación", 400);
  }

  const activeExchange = await exchangeRepository.findActiveByRequesterAndPublication(
    requesterId,
    requestedPublicationId,
  );
  if (activeExchange) {
    throw new AppError("Ya tenés una solicitud activa para esta publicación", 409);
  }

  const exchange = await exchangeRepository.create({
    offeredPublication: offeredPublication._id,
    requestedPublication: requestedPublication._id,
    requester: requesterId,
    owner: requestedPublication.owner._id,
    complementaryAmount: complementaryAmount ?? 0,
  });

  // TODO: emitir notificación al owner (Sprint 5).
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

const aceptarSolicitud = async (ownerId, exchangeId) => {
  const exchange = await exchangeRepository.findById(exchangeId);
  if (!exchange) throw new AppError("Solicitud no encontrada", 404);
  if (exchange.owner.toString() !== ownerId.toString()) throw new AppError("No autorizado", 403);
  if (exchange.status !== "pending") {
    throw new AppError("La solicitud no está en estado pendiente", 400);
  }

  const updatedExchange = await exchangeRepository.updateStatusById(exchangeId, "active");
  const offeredPublicationId = exchange.offeredPublication._id;
  const requestedPublicationId = exchange.requestedPublication._id;

  await Promise.all([
    publicationRepository.updateById(offeredPublicationId, {
      status: "unavailable",
      intercambioActivo: true,
    }),
    publicationRepository.updateById(requestedPublicationId, {
      status: "unavailable",
      intercambioActivo: true,
    }),
    exchangeRepository.rejectPendingByPublications(
      [offeredPublicationId, requestedPublicationId],
      exchangeId,
    ),
  ]);

  // TODO: emitir evento socket chat:enabled a requester y owner (Sprint 5).
  // TODO: emitir notificación al requester (Sprint 5).
  return updatedExchange;
};

const rechazarSolicitud = async (ownerId, exchangeId) => {
  const exchange = await exchangeRepository.findById(exchangeId);
  if (!exchange) throw new AppError("Solicitud no encontrada", 404);
  if (exchange.owner.toString() !== ownerId.toString()) throw new AppError("No autorizado", 403);
  if (exchange.status !== "pending") {
    throw new AppError("La solicitud no está en estado pendiente", 400);
  }

  const updatedExchange = await exchangeRepository.updateStatusById(exchangeId, "rejected");

  // TODO: emitir notificación al requester (Sprint 5).
  return updatedExchange;
};

module.exports = {
  enviarSolicitud,
  obtenerRecibidas,
  obtenerEnviadas,
  aceptarSolicitud,
  rechazarSolicitud,
};
