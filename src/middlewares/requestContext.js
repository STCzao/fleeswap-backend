const crypto = require("crypto");
const logger = require("../helpers/logger");

const requestContext = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();

  req.id = requestId;
  res.setHeader("X-Request-Id", requestId);

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    logger.info(`${req.method} ${req.originalUrl} -> ${res.statusCode}`, {
      requestId,
      durationMs: Number(durationMs.toFixed(2)),
    });
  });

  next();
};

module.exports = requestContext;
