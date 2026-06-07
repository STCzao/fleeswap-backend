const toId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  if (value.toString) return value.toString();
  return null;
};

const buildNotificationDedupeKey = ({
  type,
  activeSearch,
  publication,
  exchange,
}) => {
  const activeSearchId = toId(activeSearch);
  const publicationId = toId(publication);
  const exchangeId = toId(exchange);

  switch (type) {
    case "active_search_match":
      return activeSearchId && publicationId
        ? `active_search_match:${activeSearchId}:${publicationId}`
        : null;
    case "exchange_request_received":
      return exchangeId ? `exchange_request_received:${exchangeId}` : null;
    case "exchange_request_accepted":
      return exchangeId ? `exchange_request_accepted:${exchangeId}` : null;
    case "exchange_request_rejected":
      return exchangeId ? `exchange_request_rejected:${exchangeId}` : null;
    default:
      return null;
  }
};

module.exports = {
  buildNotificationDedupeKey,
};
