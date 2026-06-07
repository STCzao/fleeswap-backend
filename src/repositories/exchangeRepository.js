const Exchange = require("../models/Exchange");

const create = (data) => Exchange.create(data);

const findById = (id) =>
  Exchange.findById(id)
    .populate("offeredPublication", "title photos")
    .populate("requestedPublication", "title photos owner category type")
    .populate("requester", "nombre apellido photo")
    .populate("owner", "nombre apellido photo")
    .select("+type");

const findByIdWithDetails = (id) =>
  Exchange.findById(id)
    .populate("offeredPublication", "title photos category condition")
    .populate("requestedPublication", "title photos category condition")
    .populate("requester", "nombre apellido photo")
    .populate("owner", "nombre apellido photo");

const findActiveByRequesterAndPublication = (requesterId, requestedPublicationId) =>
  Exchange.findOne({
    requester: requesterId,
    requestedPublication: requestedPublicationId,
    status: { $in: ["pending", "active"] },
  });

const updateStatusById = (id, status) =>
  Exchange.findByIdAndUpdate(id, { status }, { returnDocument: "after" });

const updateById = (id, data) =>
  Exchange.findByIdAndUpdate(id, data, { returnDocument: "after", runValidators: true });

// Al completarse un intercambio, rechaza automáticamente todas las solicitudes pendientes
// que involucren cualquiera de las publicaciones participantes, para evitar intercambios
// simultáneos sobre el mismo objeto. Excluye el propio intercambio que se está completando.
const rejectPendingByPublications = (publicationIds, excludeId) =>
  Exchange.updateMany(
    {
      _id: { $ne: excludeId },
      status: "pending",
      $or: [
        { offeredPublication: { $in: publicationIds } },
        { requestedPublication: { $in: publicationIds } },
      ],
    },
    { status: "rejected" },
  );

const findReceivedByOwner = (ownerId, statusFilter, { skip, limit }) =>
  Exchange.find({ owner: ownerId, ...statusFilter })
    .populate("offeredPublication", "title photos category condition")
    .populate("requester", "nombre apellido photo")
    .populate("requestedPublication", "title photos category type")
    .select("+type")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

const countReceived = (ownerId, statusFilter) =>
  Exchange.countDocuments({ owner: ownerId, ...statusFilter });

const findSentByRequester = (requesterId, statusFilter, { skip, limit }) =>
  Exchange.find({ requester: requesterId, ...statusFilter })
    .populate("offeredPublication", "title photos")
    .populate("requestedPublication", "title photos owner category type")
    .populate("owner", "nombre apellido photo")
    .select("+type")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

const countSent = (requesterId, statusFilter) =>
  Exchange.countDocuments({ requester: requesterId, ...statusFilter });

const countCompletedByUser = (userId) =>
  Exchange.countDocuments({
    status: "completed",
    $or: [{ requester: userId }, { owner: userId }],
  });

const countCompletedExchangesByUser = (userId) =>
  Exchange.countDocuments({
    status: "completed",
    type: "exchange",
    $or: [{ requester: userId }, { owner: userId }],
  });

const countCompletedSalesByUser = (userId) =>
  Exchange.countDocuments({
    status: "completed",
    type: "purchase",
    owner: userId,
  });

const countCompletedPurchasesByUser = (userId) =>
  Exchange.countDocuments({
    status: "completed",
    type: "purchase",
    requester: userId,
  });

module.exports = {
  create,
  findById,
  findByIdWithDetails,
  findActiveByRequesterAndPublication,
  updateStatusById,
  updateById,
  rejectPendingByPublications,
  findReceivedByOwner,
  countReceived,
  findSentByRequester,
  countSent,
  countCompletedByUser,
  countCompletedExchangesByUser,
  countCompletedSalesByUser,
  countCompletedPurchasesByUser,
};
