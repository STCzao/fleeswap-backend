const publicationRepository = require("../repositories/publicationRepository");
const reportRepository = require("../repositories/reportRepository");
const notificationService = require("./notificationService");
const buildPublicationQuery = require("../helpers/buildPublicationQuery");
const { buildPagination } = require("../helpers/buildPagination");
const sanitizarTexto = require("../helpers/sanitizarTexto");
const logger = require("../helpers/logger");
const AppError = require("../helpers/AppError");

// A partir de este número de reportes la publicación se suspende automáticamente,
// sin intervencion del admin. El admin puede reactivarla manualmente si lo considera necesario.
const REPORTED_STATUS = "suspended";
// Estado usado para bloquear una publicación apenas recibe un reporte pendiente.

// El precio no aplica a un trueque puro: aunque el validator no lo exige en ese caso,
// tampoco lo prohíbe explícitamente, así que se fuerza a 0 acá para que nunca quede un
// trueque con un price "fantasma" si algún cliente lo manda igual.
const TIPO_SIN_PRECIO = "trueque";
const resolverPrice = (type, price) => (type === TIPO_SIN_PRECIO ? 0 : price);

const crear = async (
  ownerId,
  // location no se acepta acá a propósito: vive en User.location, no se duplica por publicación.
  { title, description, history, category, condition, type, price, photos },
) => {
  const publication = await publicationRepository.create({
    title: sanitizarTexto(title),
    description: sanitizarTexto(description),
    history: sanitizarTexto(history),
    category,
    condition,
    type,
    price: resolverPrice(type, price),
    photos,
    owner: ownerId,
  });

  // H5.3: las notificaciones son un side effect del alta de la publicación.
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
  if (!publication) throw new AppError("Publicación no encontrada", 404);
  if (publication.owner._id.toString() !== ownerId.toString()) throw new AppError("No autorizado", 403);

  const data = {};
  if (fields.title !== undefined) data.title = sanitizarTexto(fields.title);
  if (fields.description !== undefined) data.description = sanitizarTexto(fields.description);
  if (fields.history !== undefined) data.history = sanitizarTexto(fields.history);
  if (fields.category !== undefined) data.category = fields.category;
  if (fields.condition !== undefined) data.condition = fields.condition;
  if (fields.type !== undefined) data.type = fields.type;
  // El type vigente tras este edit es el nuevo si vino en la request, o el que ya tenía.
  const tipoFinal = fields.type !== undefined ? fields.type : publication.type;
  if (fields.price !== undefined) {
    data.price = resolverPrice(tipoFinal, fields.price);
  } else if (fields.type !== undefined && tipoFinal === TIPO_SIN_PRECIO && publication.price !== 0) {
    // Cambia a trueque sin tocar price explícitamente: limpiar el precio que tenía antes.
    data.price = 0;
  }
  if (fields.photos !== undefined) data.photos = fields.photos;

  if (Object.keys(data).length === 0) throw new AppError("Solicitud inválida", 400);

  return publicationRepository.updateById(publicationId, data);
};

const eliminar = async (publicationId, ownerId) => {
  const publication = await publicationRepository.findById(publicationId);
  if (!publication) throw new AppError("Publicación no encontrada", 404);
  if (publication.owner._id.toString() !== ownerId.toString()) throw new AppError("No autorizado", 403);
  if (publication.intercambioActivo) throw new AppError("No se puede eliminar una publicación con un intercambio en curso", 409);

  await publicationRepository.deleteById(publicationId);
};

const cambiarEstado = async (publicationId, ownerId, status) => {
  const publication = await publicationRepository.findById(publicationId);
  if (!publication) throw new AppError("Publicación no encontrada", 404);
  if (publication.owner._id.toString() !== ownerId.toString()) throw new AppError("No autorizado", 403);

  return publicationRepository.updateById(publicationId, { status });
};

// requesterId es opcional; viene del optionalAuthenticate middleware.
// Una publicación unavailable o suspended solo es visible para su owner; para el resto es 404.
const verDetalle = async (publicationId, requesterId = null) => {
  const publication = await publicationRepository.findById(publicationId);
  if (!publication) throw new AppError("Publicación no encontrada", 404);

  if (publication.status === "unavailable" || publication.status === "suspended") {
    const isOwner =
      requesterId &&
      publication.owner._id.toString() === requesterId.toString();
    if (!isOwner) throw new AppError("Publicación no encontrada", 404);
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
  if (!publication) throw new AppError("Publicación no encontrada", 404);

  // Bloqueamos el auto-reporte; un dueño no puede usar el sistema de reportes para inflar métricas falsas.
  if (publication.owner._id.toString() === reporterId.toString()) {
    throw new AppError("No podés reportar tu propia publicación", 400);
  }

  const existente = await reportRepository.findByPublicationAndReporter(
    publicationId,
    reporterId,
  );
  if (existente) throw new AppError("Ya reportaste esta publicación", 409);

  await reportRepository.create({ publicationId, reporterId, reason, details });

  const updatedPublication = await publicationRepository.incrementReportCount(publicationId);
  if (updatedPublication.status !== REPORTED_STATUS) {
    await publicationRepository.updateById(publicationId, { status: REPORTED_STATUS });
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
