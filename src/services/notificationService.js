const activeSearchRepository = require("../repositories/activeSearchRepository");
const notificationRepository = require("../repositories/notificationRepository");
const userRepository = require("../repositories/userRepository");
const sanitizarTexto = require("../helpers/sanitizarTexto");
const logger = require("../helpers/logger");
const { getIO, getUserRoom } = require("../sockets");

const NOTIFICATION_TYPES = {
  ACTIVE_SEARCH_MATCH: "active_search_match",
  EXCHANGE_REQUEST_RECEIVED: "exchange_request_received",
  EXCHANGE_REQUEST_ACCEPTED: "exchange_request_accepted",
  EXCHANGE_REQUEST_REJECTED: "exchange_request_rejected",
};

const buildCompatibleSearchTypes = (publicationType) => {
  if (publicationType === "ambos") return ["ambos", "trueque", "venta"];
  if (publicationType === "trueque") return ["ambos", "trueque"];
  return ["ambos", "venta"];
};

const buildSearchableText = (publication) =>
  `${sanitizarTexto(publication.title)} ${sanitizarTexto(publication.description)} ${sanitizarTexto(publication.history)}`
    .toLowerCase()
    .trim();

const matchesKeywords = (keywords, searchableText) => {
  if (!keywords || keywords.length === 0) return true;
  return keywords.some((keyword) => searchableText.includes(keyword));
};

const buildNotificationPayload = (notification) => ({
  _id: notification._id,
  type: notification.type,
  title: notification.title,
  message: notification.message,
  isRead: notification.isRead,
  publication: notification.publication,
  activeSearch: notification.activeSearch,
  exchange: notification.exchange,
  metadata: notification.metadata,
  createdAt: notification.createdAt,
});

const emitRealtimeNotification = (notification) => {
  const io = getIO();
  if (!io) {
    logger.warn("notification:new no emitido - socket no inicializado", {
      notificationId: notification._id,
    });
    return;
  }

  io.to(getUserRoom(notification.user)).emit(
    "notification:new",
    buildNotificationPayload(notification),
  );
};

const createAndEmitNotification = async (data) => {
  try {
    const notification = await notificationRepository.create(data);
    emitRealtimeNotification(notification);
    return notification;
  } catch (error) {
    if (error?.code === 11000) {
      logger.warn("notification duplicada ignorada", {
        userId: data.user,
        dedupeKey: data.dedupeKey,
        type: data.type,
      });
      return null;
    }

    throw error;
  }
};

const createActiveSearchMatch = async ({ activeSearch, publication }) => {
  const owner = await userRepository.findById(publication.owner);

  return createAndEmitNotification({
    user: activeSearch.user,
    type: NOTIFICATION_TYPES.ACTIVE_SEARCH_MATCH,
    title: "Nueva coincidencia para tu busqueda",
    message: `Se publico "${publication.title}" y coincide con uno de tus criterios activos.`,
    dedupeKey: `active_search_match:${activeSearch._id}:${publication._id}`,
    publication: publication._id,
    activeSearch: activeSearch._id,
    exchange: null,
    metadata: {
      publicationTitle: publication.title,
      publicationPhoto: publication.photos?.[0] || null,
      publicationCategory: publication.category,
      publicationType: publication.type,
      publicationOwnerId: publication.owner,
      publicationOwnerName: owner ? `${owner.nombre} ${owner.apellido}`.trim() : null,
      exchangeType: null,
      requesterId: null,
      requesterName: null,
    },
  });
};

const processPublicationMatches = async (publication) => {
  if (publication.status && publication.status !== "available") return [];

  const candidates = await activeSearchRepository.findMatchingCandidates({
    ownerId: publication.owner,
    category: publication.category,
    compatibleTypes: buildCompatibleSearchTypes(publication.type),
  });

  if (candidates.length === 0) return [];

  const searchableText = buildSearchableText(publication);
  const matchedSearches = candidates.filter((activeSearch) =>
    matchesKeywords(activeSearch.keywords, searchableText));

  if (matchedSearches.length === 0) return [];

  const createdNotifications = [];

  for (const activeSearch of matchedSearches) {
    const notification = await createActiveSearchMatch({
      activeSearch,
      publication,
    });
    if (notification) createdNotifications.push(notification);
  }

  return createdNotifications;
};

const notifyExchangeRequestReceived = async ({
  exchange,
  requester,
  requestedPublication,
  offeredPublication,
}) =>
  createAndEmitNotification({
    user: exchange.owner,
    type: NOTIFICATION_TYPES.EXCHANGE_REQUEST_RECEIVED,
    title: "Recibiste una nueva solicitud",
    message: `${requester.nombre} ${requester.apellido} envio una solicitud sobre "${requestedPublication.title}".`,
    dedupeKey: `exchange_request_received:${exchange._id}`,
    publication: requestedPublication._id,
    activeSearch: null,
    exchange: exchange._id,
    metadata: {
      publicationTitle: requestedPublication.title,
      publicationPhoto: requestedPublication.photos?.[0] || null,
      publicationCategory: requestedPublication.category || null,
      publicationType: requestedPublication.type || null,
      publicationOwnerId: requestedPublication.owner?._id || requestedPublication.owner || null,
      publicationOwnerName: null,
      exchangeType: exchange.type,
      requesterId: requester._id,
      requesterName: `${requester.nombre} ${requester.apellido}`.trim(),
    },
  });

const notifyExchangeRequestAccepted = async ({
  exchange,
  owner,
}) =>
  createAndEmitNotification({
    user: exchange.requester._id || exchange.requester,
    type: NOTIFICATION_TYPES.EXCHANGE_REQUEST_ACCEPTED,
    title: "Aceptaron tu solicitud",
    message: `${owner.nombre} ${owner.apellido} acepto tu solicitud sobre "${exchange.requestedPublication.title}".`,
    dedupeKey: `exchange_request_accepted:${exchange._id}`,
    publication: exchange.requestedPublication._id,
    activeSearch: null,
    exchange: exchange._id,
    metadata: {
      publicationTitle: exchange.requestedPublication.title,
      publicationPhoto: exchange.requestedPublication.photos?.[0] || null,
      publicationCategory: exchange.requestedPublication.category || null,
      publicationType: exchange.type,
      publicationOwnerId: owner._id,
      publicationOwnerName: `${owner.nombre} ${owner.apellido}`.trim(),
      exchangeType: exchange.type,
      requesterId: exchange.requester._id || exchange.requester,
      requesterName: null,
    },
  });

const notifyExchangeRequestRejected = async ({
  exchange,
  owner,
}) =>
  createAndEmitNotification({
    user: exchange.requester._id || exchange.requester,
    type: NOTIFICATION_TYPES.EXCHANGE_REQUEST_REJECTED,
    title: "Rechazaron tu solicitud",
    message: `${owner.nombre} ${owner.apellido} rechazo tu solicitud sobre "${exchange.requestedPublication.title}".`,
    dedupeKey: `exchange_request_rejected:${exchange._id}`,
    publication: exchange.requestedPublication._id,
    activeSearch: null,
    exchange: exchange._id,
    metadata: {
      publicationTitle: exchange.requestedPublication.title,
      publicationPhoto: exchange.requestedPublication.photos?.[0] || null,
      publicationCategory: exchange.requestedPublication.category || null,
      publicationType: exchange.type,
      publicationOwnerId: owner._id,
      publicationOwnerName: `${owner.nombre} ${owner.apellido}`.trim(),
      exchangeType: exchange.type,
      requesterId: exchange.requester._id || exchange.requester,
      requesterName: null,
    },
  });

module.exports = {
  processPublicationMatches,
  notifyExchangeRequestReceived,
  notifyExchangeRequestAccepted,
  notifyExchangeRequestRejected,
};
