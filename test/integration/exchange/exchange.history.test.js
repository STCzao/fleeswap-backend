const request = require("supertest");
const { expect } = require("chai");
const mongoose = require("mongoose");
const app = require("../../../src/app");
const User = require("../../../src/models/User");
const Publication = require("../../../src/models/Publication");
const Exchange = require("../../../src/models/Exchange");

const registrarUsuario = async (email, overrides = {}) => {
  const payload = {
    nombre: "Historial",
    apellido: "Exchange",
    fechaNacimiento: "2000-01-01",
    email,
    password: "Password123!",
    confirmPassword: "Password123!",
    ...overrides,
  };

  const res = await request(app).post("/api/auth/register").send(payload);
  return { token: res.body.accessToken, userId: res.body.user._id };
};

const crearPublicacion = (owner, title) => ({
  title,
  description: "Descripción de prueba para historial",
  history: "Historia de prueba para historial",
  category: "electronica",
  condition: "bueno",
  type: "trueque",
  photos: ["https://res.cloudinary.com/test/image/upload/v1/history.jpg"],
  owner,
});

describe("GET /api/exchanges/history", () => {
  let requester;
  let owner;

  before(async () => {
    await mongoose.connect(process.env.MONGO_URI);
  });

  beforeEach(async () => {
    requester = await registrarUsuario("requester.history@exchange.test.com", { nombre: "Requester" });
    owner = await registrarUsuario("owner.history@exchange.test.com", { nombre: "Owner" });

    const statuses = ["pending", "active", "completed", "cancelled", "rejected"];
    for (const status of statuses) {
      const requestedPublication = await Publication.create(
        crearPublicacion(owner.userId, `Objeto solicitado ${status}`),
      );
      const offeredPublication = await Publication.create(
        crearPublicacion(requester.userId, `Objeto ofrecido ${status}`),
      );

      await Exchange.create({
        requestedPublication: requestedPublication._id,
        offeredPublication: offeredPublication._id,
        requester: requester.userId,
        owner: owner.userId,
        status,
        type: "exchange",
        confirmedByRequester: status === "completed",
        confirmedByOwner: status === "completed",
      });
    }
  });

  afterEach(async () => {
    await Exchange.deleteMany({});
    await Publication.deleteMany({});
    await User.deleteMany({ email: /history@exchange\.test\.com$/ });
  });

  after(async () => {
    await mongoose.disconnect();
  });

  it("devuelve historial propio con objeto, contraparte, estado y acceso al detalle", async () => {
    const res = await request(app)
      .get("/api/exchanges/history")
      .set("Authorization", `Bearer ${requester.token}`);

    expect(res.status).to.equal(200);
    expect(res.body.pagination.total).to.equal(4);
    expect(res.body.exchanges).to.have.length(4);

    const statuses = res.body.exchanges.map((exchange) => exchange.status);
    expect(statuses).to.have.members(["pending", "active", "completed", "cancelled"]);
    expect(statuses).to.not.include("rejected");

    const completed = res.body.exchanges.find((exchange) => exchange.status === "completed");
    expect(completed).to.include({ type: "exchange", role: "requester" });
    expect(completed.object).to.include({ title: "Objeto solicitado completed" });
    expect(completed.counterpart).to.include({ nombre: "Owner" });
    expect(completed.detailUrl).to.equal(`/api/exchanges/${completed.id}`);
  });

  it("permite filtrar el historial por estado", async () => {
    const res = await request(app)
      .get("/api/exchanges/history?status=cancelled")
      .set("Authorization", `Bearer ${requester.token}`);

    expect(res.status).to.equal(200);
    expect(res.body.pagination.total).to.equal(1);
    expect(res.body.exchanges).to.have.length(1);
    expect(res.body.exchanges[0].status).to.equal("cancelled");
  });

  ["pending", "active", "completed"].forEach((status) => {
    it(`permite filtrar el historial por estado ${status}`, async () => {
      const res = await request(app)
        .get(`/api/exchanges/history?status=${status}`)
        .set("Authorization", `Bearer ${requester.token}`);

      expect(res.status).to.equal(200);
      expect(res.body.pagination.total).to.equal(1);
      expect(res.body.exchanges).to.have.length(1);
      expect(res.body.exchanges[0].status).to.equal(status);
    });
  });

  it("devuelve el historial propio de la contraparte (owner) con el rol correcto", async () => {
    const res = await request(app)
      .get("/api/exchanges/history")
      .set("Authorization", `Bearer ${owner.token}`);

    expect(res.status).to.equal(200);
    expect(res.body.pagination.total).to.equal(4);
    expect(res.body.exchanges).to.have.length(4);

    const completed = res.body.exchanges.find((exchange) => exchange.status === "completed");
    expect(completed).to.include({ type: "exchange", role: "owner" });
    expect(completed.counterpart).to.include({ nombre: "Requester" });
  });

  it("no muestra en el historial intercambios de otros usuarios", async () => {
    const otro = await registrarUsuario("otro.history@exchange.test.com", { nombre: "Otro" });

    const res = await request(app)
      .get("/api/exchanges/history")
      .set("Authorization", `Bearer ${otro.token}`);

    expect(res.status).to.equal(200);
    expect(res.body.pagination.total).to.equal(0);
    expect(res.body.exchanges).to.have.length(0);
  });

  it("permite navegar al detalle del intercambio usando detailUrl", async () => {
    const historyRes = await request(app)
      .get("/api/exchanges/history?status=completed")
      .set("Authorization", `Bearer ${requester.token}`);

    const completed = historyRes.body.exchanges[0];

    const detailRes = await request(app)
      .get(completed.detailUrl)
      .set("Authorization", `Bearer ${requester.token}`);

    expect(detailRes.status).to.equal(200);
    expect(detailRes.body._id).to.equal(completed.id);
    expect(detailRes.body.status).to.equal("completed");
  });
});
