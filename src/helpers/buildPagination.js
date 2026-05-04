const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const buildPagination = ({ page, limit } = {}, defaultLimit = DEFAULT_LIMIT) => {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit) || defaultLimit));

  return { page: p, limit: l, skip: (p - 1) * l };
};

module.exports = { buildPagination, DEFAULT_LIMIT, MAX_LIMIT };
