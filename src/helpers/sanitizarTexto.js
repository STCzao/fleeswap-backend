// Elimina tags HTML de un string para prevenir XSS en campos de texto libre.
// Retorna string vacío si el valor es null o undefined.
const sanitizarTexto = (texto) => (texto ?? "").replace(/<[^>]*>/g, "").trim();

module.exports = sanitizarTexto;
