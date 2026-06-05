const activeSearchRepository = require("../repositories/activeSearchRepository");
const userRepository = require("../repositories/userRepository");
const sanitizarTexto = require("../helpers/sanitizarTexto");
const AppError = require("../helpers/AppError");

const normalizarKeywords = (keywords = []) =>
  [...new Set(
    keywords
      .map((keyword) => sanitizarTexto(keyword).toLowerCase())
      .filter(Boolean),
  )].sort();

const buildCriteriaSignature = ({ category, keywords, type }) =>
  JSON.stringify({
    category,
    keywords,
    type,
  });

const crear = async (userId, { category, keywords = [], type = "ambos" }) => {
  const user = await userRepository.findById(userId);
  if (!user) throw new AppError("Usuario no encontrado", 404);

  const normalizedKeywords = normalizarKeywords(keywords);
  const hasInvalidNormalizedKeyword = normalizedKeywords.some(
    (keyword) => keyword.length < 2 || keyword.length > 50,
  );
  if (hasInvalidNormalizedKeyword) {
    throw new AppError("Cada palabra clave debe tener entre 2 y 50 caracteres", 400);
  }

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

module.exports = {
  crear,
  listarPorUsuario,
};
