const publicationRepository = require("../repositories/publicationRepository");
const reportRepository = require("../repositories/reportRepository");
const buildPublicationQuery = require("../helpers/buildPublicationQuery");
const sanitizarTexto = require("../helpers/sanitizarTexto");
const AppError = require("../helpers/AppError");

const crear = async (ownerId, { title, description, history, category, condition, type, photos }) => {
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

// findByIdAndOwner resuelve ownership y existencia en una sola query — evita
// el patrón findById + comparación manual que es vulnerable a TOCTOU.
const editar = async (publicationId, ownerId, fields) => {
  const publication = await publicationRepository.findByIdAndOwner(publicationId, ownerId);
  if (!publication) throw new AppError("Publicación no encontrada o no autorizado", 404);

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
  const publication = await publicationRepository.findByIdAndOwner(publicationId, ownerId);
  if (!publication) throw new AppError("Publicación no encontrada o no autorizado", 404);

  // La verificación de Exchange activo se difiere a Sprint 3-4 cuando el modelo exista.
  // H2.3 exige bloquear el delete si hay intercambio en curso — ver Exchange.status pending/active.
  // if (await exchangeRepository.hasActive(publicationId)) throw new AppError(...)

  await publicationRepository.deleteById(publicationId);
};

const cambiarEstado = async (publicationId, ownerId, status) => {
  const publication = await publicationRepository.findByIdAndOwner(publicationId, ownerId);
  if (!publication) throw new AppError("Publicación no encontrada o no autorizado", 404);

  return publicationRepository.updateById(publicationId, { status });
};

// requesterId es opcional — viene del optionalAuthenticate middleware.
// Una publicación unavailable solo es visible para su owner; para el resto es 404.
const verDetalle = async (publicationId, requesterId = null) => {
  const publication = await publicationRepository.findById(publicationId);
  if (!publication) throw new AppError("Publicación no encontrada", 404);

  if (publication.status === "unavailable") {
    const isOwner = requesterId && publication.owner._id.toString() === requesterId.toString();
    if (!isOwner) throw new AppError("Publicación no encontrada", 404);
  }

  return publication;
};

// page y limit se clampean en el service — no se confía en que el cliente envíe valores razonables.
const listar = async (filtros) => {
  const page = Math.max(1, parseInt(filtros.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(filtros.limit) || 12));
  const skip = (page - 1) * limit;

  const query = buildPublicationQuery({
    category: filtros.category,
    type: filtros.type,
    condition: filtros.condition,
    search: filtros.search,
  });

  // Promise.all orquesta ambas queries en paralelo — el repository expone operaciones atómicas.
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

const reportar = async (publicationId, reporterId, reason) => {
  const publication = await publicationRepository.findById(publicationId);
  if (!publication) throw new AppError("Publicación no encontrada", 404);

  // Bloqueamos el auto-reporte — un dueño no puede usar el sistema de reportes para inflar métricas falsas.
  if (publication.owner._id.toString() === reporterId.toString()) {
    throw new AppError("No podés reportar tu propia publicación", 400);
  }

  const existente = await reportRepository.findByPublicationAndReporter(publicationId, reporterId);
  if (existente) throw new AppError("Ya reportaste esta publicación", 409);

  await reportRepository.create({ publicationId, reporterId, reason });
};

module.exports = { crear, editar, eliminar, cambiarEstado, verDetalle, listar, reportar };
