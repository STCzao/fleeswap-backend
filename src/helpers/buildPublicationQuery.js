// Construye el objeto query para filtrar publicaciones.
// El $in en type garantiza que publicaciones 'ambos' aparezcan al filtrar por 'trueque' o 'venta'.
// El $regex en search opera case-insensitive sobre título y descripción.
const buildPublicationQuery = ({ category, type, condition, search } = {}) => {
  const query = { status: "available" };

  if (category) query.category = category;
  if (condition) query.condition = condition;
  if (type) query.type = type === "ambos" ? "ambos" : { $in: [type, "ambos"] };

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  return query;
};

module.exports = buildPublicationQuery;
