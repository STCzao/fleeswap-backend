const { createLogger, format, transports } = require("winston");

// Logger centralizado. En desarrollo muestra colores en consola.
// En producción loguea en formato JSON para facilitar el parseo.
const logger = createLogger({
  level: process.env.NODE_ENV === "production" ? "warn" : "debug",
  format:
    process.env.NODE_ENV === "production"
      ? format.json()
      : format.combine(format.colorize(), format.simple()),
  transports: [new transports.Console()],
});

module.exports = logger;
