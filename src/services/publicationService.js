const publicationRepository = require("../repositories/publicationRepository");
const reportRepository = require("../repositories/reportRepository");
const buildPublicationQuery = require("../helpers/buildPublicationQuery");
const { buildPagination } = require("../helpers/buildPagination");
const sanitizarTexto = require("../helpers/sanitizarTexto");
const AppError = require("../helpers/AppError");

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

// page y limit se clampean en el service; no se confía en que el cliente envíe valores razonables.
const listar = async (filtros) => {
  const { page, limit, skip } = buildPagination(filtros);

  const query = buildPublicationQuery({
    category: filtros.category,
    type: filtros.type,
    condition: filtros.condition,
    search: filtros.search,
  });

  // Promise.all orquesta ambas queries en paralelo; el repository expone operaciones atómicas.
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
