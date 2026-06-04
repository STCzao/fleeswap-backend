const { createLogger, format, transports } = require("winston");

const isProd = process.env.NODE_ENV === "production";

const devFormat = format.combine(
  format.colorize(),
  format.timestamp(),
  format.errors({ stack: true }),
  format.printf(({ timestamp, level, message, requestId, stack, ...meta }) => {
    const req = requestId ? ` [req:${requestId}]` : "";
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} ${level}${req}: ${stack || message}${extra}`;
  }),
);

const logger = createLogger({
  level: isProd ? "info" : "debug",
  format: isProd
    ? format.combine(format.timestamp(), format.errors({ stack: true }), format.json())
    : devFormat,
  transports: [new transports.Console()],
});

module.exports = logger;
