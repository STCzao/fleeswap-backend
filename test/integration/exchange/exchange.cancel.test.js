// test/exchange.cancel.test.js

const request = require("supertest");
const { expect } = require("chai");
const mongoose = require("mongoose");
const app = require("../../../src/app");
const User = require("../../../src/models/User");
const Publication = require("../../../src/models/Publication");
const Exchange = require("../../../src/models/Exchange");

// ─── Helpers ─────────────────────────────────────────────────────────────────

const registrarUsuario = async (payload) => {
  const res = await request(app).post("/api/auth/register").send(payload);
  return { token: res.body.accessToken, userId: res.body.user._id };
};

const crearPublicacion = (overrides = {}) => ({
  title: "Objeto de prueba",
  description: "Descripción de prueba para el test",
  history: "Historia del objeto de prueba",
  category: "electronica",
  condition: "bueno",
  type: "trueque",
  photos: ["https://res.cloudinary.com/test/image/upload/v1/test.jpg"],
  ...overrides,
});

const crearEscenarioActivo = async (sufijo) => {
  const requesterData = await registrarUsuario({
    nombre: "Requester",
    apellido: "CancelTest",
    fechaNacimiento: "2000-01-01",
    email: `requester.${sufijo}@cancel.test.com`,
    password: "Password123!",
    confirmPassword: "Password123!",
  });

  const ownerData = await registrarUsuario({
    nombre: "Owner",
    apellido: "CancelTest",
    fechaNacimiento: "2000-01-01",
    email: `owner.${sufijo}@cancel.test.com`,
    password: "Password123!",
    confirmPassword: "Password123!",
  });

  const pubRequester = await Publication.create({
    ...crearPublicacion({ title: `Pub Requester - ${sufijo}` }),
    owner: requesterData.userId,
  });

  const pubOwner = await Publication.create({
    ...crearPublicacion({ title: `Pub Owner - ${sufijo}` }),
    owner: ownerData.userId,
  });

  const envio = await request(app)
    .post("/api/exchanges")
    .set("Authorization", `Bearer ${requesterData.token}`)
    .send({
      offeredPublicationId: pubRequester._id.toString(),
      requestedPublicationId: pubOwner._id.toString(),
    });

  // Aceptar → status: active + publicaciones unavailable
  await request(app)
    .patch(`/api/exchanges/${envio.body._id}/accept`)
    .set("Authorization", `Bearer ${ownerData.token}`);

  return { requesterData, ownerData, pubRequester, pubOwner, exchange: envio.body };
};

const limpiarEscenario = async ({ requesterData, ownerData, pubRequester, pubOwner, exchange }) => {
  if (exchange?._id)          await Exchange.deleteOne({ _id: exchange._id });
  if (pubRequester?._id)      await Publication.deleteOne({ _id: pubRequester._id });
  if (pubOwner?._id)          await Publication.deleteOne({ _id: pubOwner._id });
  if (requesterData?.userId)  await User.deleteOne({ _id: requesterData.userId });
  if (ownerData?.userId)      await User.deleteOne({ _id: ownerData.userId });
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("Exchange Cancel API", () => {

  before(async () => {
    await mongoose.connect(process.env.MONGO_URI);
  });

  after(async () => {
    await mongoose.disconnect();
  });

  // ─── Test 1 ───────────────────────────────────────────────────────────────

  describe("PATCH /api/exchanges/:id/cancel — Owner cancela intercambio active", () => {

    let escenario;

    afterEach(async () => {
      await limpiarEscenario(escenario ?? {});
    });

    it("owner cancela intercambio active → 200 + status 'cancelled'", async () => {
      escenario = await crearEscenarioActivo("owner-cancela");
      const { ownerData, exchange } = escenario;

      const res = await request(app)
        .patch(`/api/exchanges/${exchange._id}/cancel`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("_id");
      expect(res.body).to.have.property("status", "cancelled");
    });

  });

  // ─── Test 2 ───────────────────────────────────────────────────────────────

  describe("PATCH /api/exchanges/:id/cancel — Requester cancela intercambio active", () => {

        let escenario;

        afterEach(async () => {
        await limpiarEscenario(escenario ?? {});
        });

        it("requester cancela intercambio active → 200 + status 'cancelled'", async () => {
        escenario = await crearEscenarioActivo("requester-cancela");
        const { requesterData, exchange } = escenario;

        const res = await request(app)
            .patch(`/api/exchanges/${exchange._id}/cancel`)
            .set("Authorization", `Bearer ${requesterData.token}`);

        expect(res.status).to.equal(200);
        expect(res.body).to.have.property("_id");
        expect(res.body).to.have.property("status", "cancelled");
        });

  });

  // ─── Test 3 ───────────────────────────────────────────────────────────────

  describe("PATCH /api/exchanges/:id/cancel — Publicaciones vuelven a available", () => {

    let escenario;

    afterEach(async () => {
      await limpiarEscenario(escenario ?? {});
    });

    it("al cancelar → ambas publicaciones quedan available + intercambioActivo false", async () => {
      escenario = await crearEscenarioActivo("pubs-available");
      const { ownerData, pubRequester, pubOwner, exchange } = escenario;

      await request(app)
        .patch(`/api/exchanges/${exchange._id}/cancel`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      const [pubA, pubB] = await Promise.all([
        Publication.findById(pubRequester._id),
        Publication.findById(pubOwner._id),
      ]);

      expect(pubA.status).to.equal("available");
      expect(pubA.intercambioActivo).to.equal(false);
      expect(pubB.status).to.equal("available");
      expect(pubB.intercambioActivo).to.equal(false);
    });

  });

  // ─── Test 4 ───────────────────────────────────────────────────────────────

  describe("PATCH /api/exchanges/:id/cancel — Requester cancela solicitud pending", () => {

    let escenario;

    afterEach(async () => {
      await limpiarEscenario(escenario ?? {});
    });

    it("requester cancela solicitud pending → 200 + status 'cancelled'", async () => {
      escenario = await crearEscenarioActivo("requester-cancela-pending");
      const { requesterData, exchange } = escenario;

      // Pisamos el status a pending para simular que el owner aún no aceptó
      await Exchange.findByIdAndUpdate(exchange._id, { status: "pending" });

      // También revertimos las publicaciones que el accept marcó como unavailable
      await Publication.findByIdAndUpdate(escenario.pubRequester._id, {
        status: "available",
        intercambioActivo: false,
      });
      await Publication.findByIdAndUpdate(escenario.pubOwner._id, {
        status: "available",
        intercambioActivo: false,
      });

      const res = await request(app)
        .patch(`/api/exchanges/${exchange._id}/cancel`)
        .set("Authorization", `Bearer ${requesterData.token}`);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("status", "cancelled");
    });

  });

  // ─── Test 5 ───────────────────────────────────────────────────────────────

  describe("PATCH /api/exchanges/:id/cancel — Owner no puede cancelar solicitud pending", () => {

    let escenario;

    afterEach(async () => {
      await limpiarEscenario(escenario ?? {});
    });

    it("owner intenta cancelar solicitud pending → 400", async () => {
      escenario = await crearEscenarioActivo("owner-cancela-pending");
      const { ownerData, exchange } = escenario;

      await Exchange.findByIdAndUpdate(exchange._id, { status: "pending" });
      await Publication.findByIdAndUpdate(escenario.pubRequester._id, {
        status: "available",
        intercambioActivo: false,
      });
      await Publication.findByIdAndUpdate(escenario.pubOwner._id, {
        status: "available",
        intercambioActivo: false,
      });

      const res = await request(app)
        .patch(`/api/exchanges/${exchange._id}/cancel`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("message");
    });

  });

  // ─── Test 6 ───────────────────────────────────────────────────────────────

  describe("PATCH /api/exchanges/:id/cancel — Tercero ajeno no puede cancelar", () => {

    let escenario;
    let tercero;

    afterEach(async () => {
      await limpiarEscenario(escenario ?? {});
      if (tercero?.userId) await User.deleteOne({ _id: tercero.userId });
    });

    it("tercero ajeno intenta cancelar intercambio active → 403", async () => {
      escenario = await crearEscenarioActivo("tercero-403");

      tercero = await registrarUsuario({
        nombre: "Tercero",
        apellido: "CancelTest",
        fechaNacimiento: "2000-01-01",
        email: "tercero@cancel.test.com",
        password: "Password123!",
        confirmPassword: "Password123!",
      });

      const res = await request(app)
        .patch(`/api/exchanges/${escenario.exchange._id}/cancel`)
        .set("Authorization", `Bearer ${tercero.token}`);

      expect(res.status).to.equal(403);
      expect(res.body).to.have.property("message");
    });

  });

  // ─── Test 7 ───────────────────────────────────────────────────────────────

  describe("PATCH /api/exchanges/:id/cancel — No se puede cancelar un exchange ya cancelado", () => {

    let escenario;

    afterEach(async () => {
      await limpiarEscenario(escenario ?? {});
    });

    it("cancelar exchange ya cancelado → 400", async () => {
      escenario = await crearEscenarioActivo("doble-cancel");
      const { ownerData, exchange } = escenario;

      // Primera cancelación — válida
      await request(app)
        .patch(`/api/exchanges/${exchange._id}/cancel`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      // Segunda cancelación — debe ser bloqueada
      const res = await request(app)
        .patch(`/api/exchanges/${exchange._id}/cancel`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("message");
    });

  });

  // ─── Test 8 ───────────────────────────────────────────────────────────────

  describe("PATCH /api/exchanges/:id/cancel — No se puede cancelar un exchange completado", () => {

    let escenario;

    afterEach(async () => {
      await limpiarEscenario(escenario ?? {});
    });

    it("cancelar exchange completed → 400", async () => {
      escenario = await crearEscenarioActivo("cancel-completed");
      const { ownerData, requesterData, exchange } = escenario;

      // Ambas partes confirman → status: completed
      await request(app)
        .patch(`/api/exchanges/${exchange._id}/confirm`)
        .set("Authorization", `Bearer ${requesterData.token}`);

      await request(app)
        .patch(`/api/exchanges/${exchange._id}/confirm`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      // Intento de cancelación sobre exchange completado
      const res = await request(app)
        .patch(`/api/exchanges/${exchange._id}/cancel`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("message");
    });

  });

  // ─── Tests 9 y 10 ─────────────────────────────────────────────────────────

  describe("PATCH /api/exchanges/:id/cancel — Errores de entrada", () => {

    let escenario;

    afterEach(async () => {
      await limpiarEscenario(escenario ?? {});
    });

    it("sin token → 401", async () => {
      escenario = await crearEscenarioActivo("sin-token");

      const res = await request(app)
        .patch(`/api/exchanges/${escenario.exchange._id}/cancel`);

      expect(res.status).to.equal(401);
      expect(res.body).to.have.property("message");
    });

    it("ID de exchange inexistente → 404", async () => {
      escenario = await crearEscenarioActivo("id-inexistente");
      const { ownerData } = escenario;

      const idInexistente = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .patch(`/api/exchanges/${idInexistente}/cancel`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      expect(res.status).to.equal(404);
      expect(res.body).to.have.property("message");
    });

  });

});
