const { expect } = require("chai");
const mongoose = require("mongoose");
const { buildNotificationDedupeKey } = require("../../../src/helpers/notificationDedupe");

describe("buildNotificationDedupeKey (unit)", () => {

  const activeSearchId = new mongoose.Types.ObjectId();
  const publicationId = new mongoose.Types.ObjectId();
  const exchangeId = new mongoose.Types.ObjectId();

  it("construye la key de active_search_match con activeSearch + publication", () => {
    const key = buildNotificationDedupeKey({
      type: "active_search_match",
      activeSearch: activeSearchId,
      publication: publicationId,
    });

    expect(key).to.equal(`active_search_match:${activeSearchId}:${publicationId}`);
  });

  it("devuelve null para active_search_match si falta publication", () => {
    const key = buildNotificationDedupeKey({
      type: "active_search_match",
      activeSearch: activeSearchId,
    });

    expect(key).to.equal(null);
  });

  it("construye la key de exchange_request_received con solo el exchange", () => {
    const key = buildNotificationDedupeKey({
      type: "exchange_request_received",
      exchange: exchangeId,
    });

    expect(key).to.equal(`exchange_request_received:${exchangeId}`);
  });

  it("construye la key de exchange_request_accepted con solo el exchange", () => {
    const key = buildNotificationDedupeKey({
      type: "exchange_request_accepted",
      exchange: exchangeId,
    });

    expect(key).to.equal(`exchange_request_accepted:${exchangeId}`);
  });

  it("construye la key de exchange_request_rejected con solo el exchange", () => {
    const key = buildNotificationDedupeKey({
      type: "exchange_request_rejected",
      exchange: exchangeId,
    });

    expect(key).to.equal(`exchange_request_rejected:${exchangeId}`);
  });

  it("devuelve null para un type desconocido", () => {
    const key = buildNotificationDedupeKey({ type: "tipo_inexistente", exchange: exchangeId });
    expect(key).to.equal(null);
  });

  it("acepta un documento populado (objeto con _id) en lugar de un ObjectId crudo", () => {
    const key = buildNotificationDedupeKey({
      type: "exchange_request_received",
      exchange: { _id: exchangeId },
    });

    expect(key).to.equal(`exchange_request_received:${exchangeId}`);
  });

});
