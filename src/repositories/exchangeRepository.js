const Exchange = require("../models/Exchange");

const create = (data) => Exchange.create(data);

const findById = (id) =>
  Exchange.findById(id)
    .populate("offeredPublication", "_id status")
    .populate("requestedPublication", "_id status")
    .populate("requester", "nombre apellido");

const findActiveByRequesterAndPublication = (requesterId, requestedPublicationId) =>
  Exchange.findOne({
    requester: requesterId,
    requestedPublication: requestedPublicationId,
    status: { $in: ["pending", "active"] },
  });

const updateStatusById = (id, status) =>
  Exchange.findByIdAndUpdate(id, { status }, { new: true });

const updateById = (id, data) =>
  Exchange.findByIdAndUpdate(id, data, { new: true, runValidators: true });

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
  findById,
  findActiveByRequesterAndPublication,
  updateStatusById,
  updateById,
  rejectPendingByPublications,
  findReceivedByOwner,
  countReceived,
  findSentByRequester,
  countSent,
};
