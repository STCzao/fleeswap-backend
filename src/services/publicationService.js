const publicationRepository = require("../repositories/publicationRepository");
const reportRepository = require("../repositories/reportRepository");
const notificationService = require("./notificationService");
const buildPublicationQuery = require("../helpers/buildPublicationQuery");
const { buildPagination } = require("../helpers/buildPagination");
const sanitizarTexto = require("../helpers/sanitizarTexto");
const logger = require("../helpers/logger");
const AppError = require("../helpers/AppError");

// A partir de este numero de reportes la publicacion se suspende automaticamente,
// sin intervencion del admin. El admin puede reactivarla manualmente si lo considera necesario.
const REPORT_THRESHOLD = 5;

const crear = async (
  ownerId,
  { title, description, history, category, condition, type, photos },
) => {
  const publication = await publicationRepository.create({
    title: sanitizarTexto(title),
    description: sanitizarTexto(description),
    history: sanitizarTexto(history),
    category,
    condition,
    type,
    photos,
    owner: ownerId,
  });

  // H5.3: las notificaciones son un side effect del alta de la publicacion.
  // Si fallan, se loguea el problema pero no se revierte ni se rompe el 201.
  try {
    await notificationService.processPublicationMatches(publication);
  } catch (error) {
    logger.error("active_search_match processing failed", {
      publicationId: publication._id,
      ownerId,
      error: error.message,
      stack: error.stack,
    });
  }

  return publication;
};

const editar = async (publicationId, ownerId, fields) => {
  const publication = await publicationRepository.findById(publicationId);
  if (!publication) throw new AppError("Publicacion no encontrada", 404);
  if (publication.owner._id.toString() !== ownerId.toString()) throw new AppError("No autorizado", 403);

  const data = {};
  if (fields.title !== undefined) data.title = sanitizarTexto(fields.title);
  if (fields.description !== undefined) data.description = sanitizarTexto(fields.description);
  if (fields.history !== undefined) data.history = sanitizarTexto(fields.history);
  if (fields.category !== undefined) data.category = fields.category;
  if (fields.condition !== undefined) data.condition = fields.condition;
  if (fields.type !== undefined) data.type = fields.type;
  if (fields.photos !== undefined) data.photos = fields.photos;

  if (Object.keys(data).length === 0) throw new AppError("Solicitud invalida", 400);

  return publicationRepository.updateById(publicationId, data);
};

const eliminar = async (publicationId, ownerId) => {
  const publication = await publicationRepository.findById(publicationId);
  if (!publication) throw new AppError("Publicacion no encontrada", 404);
  if (publication.owner._id.toString() !== ownerId.toString()) throw new AppError("No autorizado", 403);
  if (publication.intercambioActivo) throw new AppError("No se puede eliminar una publicacion con un intercambio en curso", 409);

  await publicationRepository.deleteById(publicationId);
};

const cambiarEstado = async (publicationId, ownerId, status) => {
  const publication = await publicationRepository.findById(publicationId);
  if (!publication) throw new AppError("Publicacion no encontrada", 404);
  if (publication.owner._id.toString() !== ownerId.toString()) throw new AppError("No autorizado", 403);

  return publicationRepository.updateById(publicationId, { status });
};

// requesterId es opcional; viene del optionalAuthenticate middleware.
// Una publicacion unavailable o suspended solo es visible para su owner; para el resto es 404.
const verDetalle = async (publicationId, requesterId = null) => {
  const publication = await publicationRepository.findById(publicationId);
  if (!publication) throw new AppError("Publicacion no encontrada", 404);

  if (publication.status === "unavailable" || publication.status === "suspended") {
    const isOwner =
      requesterId &&
      publication.owner._id.toString() === requesterId.toString();
    if (!isOwner) throw new AppError("Publicacion no encontrada", 404);
  }

  return publication;
};

// page y limit se clampean en el service; no se confia en que el cliente envie valores razonables.
const listar = async (filtros) => {
  const { page, limit, skip } = buildPagination(filtros);

  const query = buildPublicationQuery({
    category: filtros.category,
    type: filtros.type,
    condition: filtros.condition,
    search: filtros.search,
    userId: filtros.userId,
  });

  // Promise.all orquesta ambas queries en paralelo; el repository expone operaciones atomicas.
  const [publications, total] = await Promise.all([
    publicationRepository.findAll(query, { skip, limit }),
    publicationRepository.countAll(query),
  ]);

  return {
    publications,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const reportar = async (publicationId, reporterId, reason, details) => {
  const publication = await publicationRepository.findById(publicationId);
  if (!publication) throw new AppError("Publicacion no encontrada", 404);

  // Bloqueamos el auto-reporte; un dueno no puede usar el sistema de reportes para inflar metricas falsas.
  if (publication.owner._id.toString() === reporterId.toString()) {
    throw new AppError("No podes reportar tu propia publicacion", 400);
  }

  const existente = await reportRepository.findByPublicationAndReporter(
    publicationId,
    reporterId,
  );
  if (existente) throw new AppError("Ya reportaste esta publicacion", 409);

  await reportRepository.create({ publicationId, reporterId, reason, details });

  const updatedPublication = await publicationRepository.incrementReportCount(publicationId);
  if (
    updatedPublication.reportCount >= REPORT_THRESHOLD &&
    updatedPublication.status !== "suspended"
  ) {
    await publicationRepository.updateById(publicationId, { status: "suspended" });
  }
};

module.exports = {
  crear,
  editar,
  eliminar,
  cambiarEstado,
  verDetalle,
  listar,
  reportar,
};
