// Clase de error personalizada para errores operacionales de la aplicación.
// Extiende Error para mantener el stack trace y poder usar instanceof AppError.
class AppError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.name = "AppError";
  }
}

module.exports = AppError;
