const DEFAULT_LIMIT = 10;
// Techo absoluto para evitar queries que devuelvan cientos de documentos en un solo request.
// Se exporta para que los validators puedan referenciar el mismo valor sin duplicarlo.
const MAX_LIMIT = 50;

const buildPagination = ({ page, limit } = {}, defaultLimit = DEFAULT_LIMIT) => {
  const p = Math.max(1, parseInt(page) || 1);
  // Clampea entre 1 y MAX_LIMIT; si limit no es un entero válido cae al defaultLimit.
  const l = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit) || defaultLimit));

  return { page: p, limit: l, skip: (p - 1) * l };
};

module.exports = { buildPagination, DEFAULT_LIMIT, MAX_LIMIT };
