const Report = require("../models/Report");

const create = (data) => Report.create(data);

const findByPublicationAndReporter = (publicationId, reporterId) =>
  Report.findOne({ publicationId, reporterId });

module.exports = { create, findByPublicationAndReporter };
