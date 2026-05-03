const Exchange = require("../models/Exchange");

const create = (data) => Exchange.create(data);

const findActiveByRequesterAndPublication = (requesterId, requestedPublicationId) =>
  Exchange.findOne({
    requester: requesterId,
    requestedPublication: requestedPublicationId,
    status: { $in: ["pending", "active"] },
  });

const findReceivedByOwner = (ownerId, statusFilter, { skip, limit }) =>
  Exchange.find({ owner: ownerId, ...statusFilter })
    .populate("offeredPublication", "title photos category condition")
    .populate("requester", "nombre apellido photo")
    .populate("requestedPublication", "title photos")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

const countReceived = (ownerId, statusFilter) =>
  Exchange.countDocuments({ owner: ownerId, ...statusFilter });

const findSentByRequester = (requesterId, statusFilter, { skip, limit }) =>
  Exchange.find({ requester: requesterId, ...statusFilter })
    .populate("offeredPublication", "title photos")
    .populate("requestedPublication", "title photos owner")
    .populate("owner", "nombre apellido photo")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

const countSent = (requesterId, statusFilter) =>
  Exchange.countDocuments({ requester: requesterId, ...statusFilter });

module.exports = {
  create,
  findActiveByRequesterAndPublication,
  findReceivedByOwner,
  countReceived,
  findSentByRequester,
  countSent,
};
