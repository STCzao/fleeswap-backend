const Exchange = require("../models/Exchange");

const create = (data) => Exchange.create(data);

const findActiveByRequesterAndPublication = (requesterId, requestedPublicationId) =>
  Exchange.findOne({
    requester: requesterId,
    requestedPublication: requestedPublicationId,
    status: { $in: ["pending", "active"] },
  });

module.exports = {
  create,
  findActiveByRequesterAndPublication,
};
