const sanitizarTexto = require("./sanitizarTexto");

const normalizeKeywords = (keywords = []) =>
  [...new Set(
    keywords
      .map((keyword) => sanitizarTexto(keyword).toLowerCase())
      .filter(Boolean),
  )].sort();

const buildCriteriaSignature = ({ category, keywords = [], type }) =>
  JSON.stringify({
    category,
    keywords: normalizeKeywords(keywords),
    type,
  });

module.exports = {
  normalizeKeywords,
  buildCriteriaSignature,
};
