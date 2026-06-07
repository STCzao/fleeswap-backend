const activeSearchRepository = require("../repositories/activeSearchRepository");
const userRepository = require("../repositories/userRepository");
const { normalizeKeywords, buildCriteriaSignature } = require("../helpers/activeSearchCriteria");
const AppError = require("../helpers/AppError");

const validarKeywordsNormalizadas = (keywords) => {
  const hasInvalidNormalizedKeyword = keywords.some(
    (keyword) => keyword.length < 2 || keyword.length > 50,
  );
  if (hasInvalidNormalizedKeyword) {
    throw new AppError("Cada palabra clave debe tener entre 2 y 50 caracteres", 400);
  }
};

const crear = async (userId, { category, keywords = [], type = "ambos" }) => {
  const user = await userRepository.findById(userId);
  if (!user) throw new AppError("Usuario no encontrado", 404);

  const normalizedKeywords = normalizeKeywords(keywords);
  validarKeywordsNormalizadas(normalizedKeywords);

  const criteriaSignature = buildCriteriaSignature({
    category,
    keywords: normalizedKeywords,
    type,
  });

  const existingSearch = await activeSearchRepository.findByUserAndCriteria(
    userId,
    criteriaSignature,
  );
  if (existingSearch) {
    throw new AppError("Ya existe un criterio de busqueda igual", 409);
  }

  return activeSearchRepository.create({
    user: userId,
    category,
    keywords: normalizedKeywords,
    type,
    criteriaSignature,
    isActive: true,
  });
};

const listarPorUsuario = (userId) => activeSearchRepository.findByUser(userId);

const editar = async (searchId, userId, fields) => {
  const activeSearch = await activeSearchRepository.findById(searchId);
  if (!activeSearch) throw new AppError("Criterio de busqueda no encontrado", 404);
  if (activeSearch.user.toString() !== userId.toString()) {
    throw new AppError("No autorizado", 403);
  }

  const hasUpdatableField = [
    "category",
    "keywords",
    "type",
    "isActive",
  ].some((field) => fields[field] !== undefined);
  if (!hasUpdatableField) throw new AppError("Solicitud invalida", 400);

  const nextCategory = fields.category ?? activeSearch.category;
  const nextKeywords = fields.keywords !== undefined
    ? normalizeKeywords(fields.keywords)
    : activeSearch.keywords;
  validarKeywordsNormalizadas(nextKeywords);
  const nextType = fields.type ?? activeSearch.type;
  const nextIsActive = fields.isActive ?? activeSearch.isActive;

  const criteriaSignature = buildCriteriaSignature({
    category: nextCategory,
    keywords: nextKeywords,
    type: nextType,
  });

  const existingSearch = await activeSearchRepository.findByUserAndCriteriaExcludingId(
    userId,
    criteriaSignature,
    searchId,
  );
  if (existingSearch) {
    throw new AppError("Ya existe un criterio de busqueda igual", 409);
  }

  return activeSearchRepository.updateById(searchId, {
    category: nextCategory,
    keywords: nextKeywords,
    type: nextType,
    isActive: nextIsActive,
    criteriaSignature,
  });
};

const eliminar = async (searchId, userId) => {
  const activeSearch = await activeSearchRepository.findById(searchId);
  if (!activeSearch) throw new AppError("Criterio de busqueda no encontrado", 404);
  if (activeSearch.user.toString() !== userId.toString()) {
    throw new AppError("No autorizado", 403);
  }

  await activeSearchRepository.deleteById(searchId);
};

module.exports = {
  crear,
  listarPorUsuario,
  editar,
  eliminar,
};
