// test/exchange.confirm.test.js

const request = require("supertest");
const { expect } = require("chai");
const mongoose = require("mongoose");
const app = require("../../../src/app");
const User = require("../../../src/models/User");
const Publication = require("../../../src/models/Publication");
const Exchange = require("../../../src/models/Exchange");

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  const ownerData = await registrarUsuario({
    nombre: "Owner",
    apellido: "ConfirmTest",
    fechaNacimiento: "2000-01-01",
    email: `owner.${sufijo}@confirm.test.com`,
    password: "Password123!",
    confirmPassword: "Password123!",
  });

  const requesterData = await registrarUsuario({
    nombre: "Requester",
    apellido: "ConfirmTest",
    fechaNacimiento: "2000-01-01",
    email: `requester.${sufijo}@confirm.test.com`,
    password: "Password123!",
    confirmPassword: "Password123!",
  });

  const pubOwner = await Publication.create({
    ...crearPublicacion({ title: `Pub Owner - ${sufijo}` }),
    owner: ownerData.userId,
  });

  const pubRequester = await Publication.create({
    ...crearPublicacion({ title: `Pub Requester - ${sufijo}` }),
    owner: requesterData.userId,
  });

  // Solicitud
  const envio = await request(app)
    .post("/api/exchanges")
    .set("Authorization", `Bearer ${requesterData.token}`)
    .send({
      offeredPublicationId: pubRequester._id.toString(),
      requestedPublicationId: pubOwner._id.toString(),
    });

  // Aceptación → status: active
  await request(app)
    .patch(`/api/exchanges/${envio.body._id}/accept`)
    .set("Authorization", `Bearer ${ownerData.token}`);

  return {
    ownerData,
    requesterData,
    pubOwner,
    pubRequester,
    exchange: envio.body,
  };
};

const limpiarEscenario = async ({ ownerData, requesterData, pubOwner, pubRequester, exchange }) => {
  if (exchange?._id)         await Exchange.deleteOne({ _id: exchange._id });
  if (pubOwner?._id)         await Publication.deleteOne({ _id: pubOwner._id });
  if (pubRequester?._id)     await Publication.deleteOne({ _id: pubRequester._id });
  if (ownerData?.userId)     await User.deleteOne({ _id: ownerData.userId });
  if (requesterData?.userId) await User.deleteOne({ _id: requesterData.userId });
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("Exchange Confirm API", () => {

  before(async () => {
    await mongoose.connect(process.env.MONGO_URI);
  });

  after(async () => {
    await mongoose.disconnect();
  });

  // ─── Test 1: Confirmación individual ────────────────────────────────────────

  describe("PATCH /api/exchanges/:id/confirm — Confirmación individual", () => {

    let escenario;

    afterEach(async () => {
      await limpiarEscenario(escenario ?? {});
    });

    it("requester confirma primero → 200 + confirmedByRequester true + status sigue active", async () => {
      escenario = await crearEscenarioActivo("confirm-individual");
      const { requesterData, exchange } = escenario;

      const res = await request(app)
        .patch(`/api/exchanges/${exchange._id}/confirm`)
        .set("Authorization", `Bearer ${requesterData.token}`);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("confirmedByRequester", true);
      expect(res.body).to.have.property("confirmedByOwner", false);
      expect(res.body).to.have.property("status", "active");
    });

  });

  describe("PATCH /api/exchanges/:id/confirm — Confirmación doble → completado", () => {

    let escenario;

    afterEach(async () => {
        await limpiarEscenario(escenario ?? {});
    });

    it("owner confirma primero, luego requester → 200 + status completed + ambos flags true", async () => {
        escenario = await crearEscenarioActivo("confirm-doble");
        const { ownerData, requesterData, exchange } = escenario;

        // Primera confirmación: owner
        const primeraConfirmacion = await request(app)
        .patch(`/api/exchanges/${exchange._id}/confirm`)
        .set("Authorization", `Bearer ${ownerData.token}`);

        expect(primeraConfirmacion.status).to.equal(200);
        expect(primeraConfirmacion.body).to.have.property("confirmedByOwner", true);
        expect(primeraConfirmacion.body).to.have.property("status", "active");

        // Segunda confirmación: requester → dispara completed
        const segundaConfirmacion = await request(app)
        .patch(`/api/exchanges/${exchange._id}/confirm`)
        .set("Authorization", `Bearer ${requesterData.token}`);

        expect(segundaConfirmacion.status).to.equal(200);
        expect(segundaConfirmacion.body).to.have.property("status", "completed");
        expect(segundaConfirmacion.body).to.have.property("confirmedByRequester", true);
        expect(segundaConfirmacion.body).to.have.property("confirmedByOwner", true);
    });

    it("al completarse → publicaciones quedan con intercambioActivo false y status 'exchanged'", async () => {
        escenario = await crearEscenarioActivo("confirm-doble-pubs");
        const { ownerData, requesterData, pubOwner, pubRequester, exchange } = escenario;

        await request(app)
        .patch(`/api/exchanges/${exchange._id}/confirm`)
        .set("Authorization", `Bearer ${ownerData.token}`);

        await request(app)
        .patch(`/api/exchanges/${exchange._id}/confirm`)
        .set("Authorization", `Bearer ${requesterData.token}`);

        const [pubA, pubB] = await Promise.all([
        Publication.findById(pubOwner._id),
        Publication.findById(pubRequester._id),
        ]);

        expect(pubA.status).to.equal("exchanged");
        expect(pubA.intercambioActivo).to.equal(false);
        expect(pubB.status).to.equal("exchanged");
        expect(pubB.intercambioActivo).to.equal(false);
    });

    });

  describe("PATCH /api/exchanges/:id/confirm — Caminos alternativos", () => {

        let escenario;

        afterEach(async () => {
            await limpiarEscenario(escenario ?? {});
        });

        it("tercero ajeno intenta confirmar → 403", async () => {
            escenario = await crearEscenarioActivo("confirm-tercero");

            const tercero = await registrarUsuario({
            nombre: "Tercero",
            apellido: "ConfirmTest",
            fechaNacimiento: "2000-01-01",
            email: "tercero.confirm@confirm.test.com",
            password: "Password123!",
            confirmPassword: "Password123!",
            });

            const res = await request(app)
            .patch(`/api/exchanges/${escenario.exchange._id}/confirm`)
            .set("Authorization", `Bearer ${tercero.token}`);

            await User.deleteOne({ _id: tercero.userId });

            expect(res.status).to.equal(403);
            expect(res.body).to.have.property("message");
        });

        it("owner intenta confirmar dos veces → 400", async () => {
            escenario = await crearEscenarioActivo("confirm-doble-mismo");
            const { ownerData, exchange } = escenario;

            // Primera confirmación — válida
            await request(app)
                .patch(`/api/exchanges/${exchange._id}/confirm`)
                .set("Authorization", `Bearer ${ownerData.token}`);

            // Segunda confirmación — debe ser bloqueada
            const res = await request(app)
                .patch(`/api/exchanges/${exchange._id}/confirm`)
                .set("Authorization", `Bearer ${ownerData.token}`);

            expect(res.status).to.equal(400);
            expect(res.body).to.have.property("message");
        });

        it("confirmar un exchange en estado pending → 400", async () => {
            escenario = await crearEscenarioActivo("confirm-pending");

            // Pisamos el status directamente en BD para simular estado pending
            await Exchange.findByIdAndUpdate(escenario.exchange._id, { status: "pending" });

            const res = await request(app)
                .patch(`/api/exchanges/${escenario.exchange._id}/confirm`)
                .set("Authorization", `Bearer ${escenario.requesterData.token}`);

            expect(res.status).to.equal(400);
            expect(res.body).to.have.property("message");
        });

        it("confirmar un exchange cancelado → 400", async () => {
            escenario = await crearEscenarioActivo("confirm-cancelled");
            const { requesterData, exchange } = escenario;

            // Cancelamos el exchange
            await request(app)
                .patch(`/api/exchanges/${exchange._id}/cancel`)
                .set("Authorization", `Bearer ${requesterData.token}`);

            // Intentamos confirmar
            const res = await request(app)
                .patch(`/api/exchanges/${exchange._id}/confirm`)
                .set("Authorization", `Bearer ${requesterData.token}`);

            expect(res.status).to.equal(400);
            expect(res.body).to.have.property("message");
        });

        it("sin token → 401", async () => {
            escenario = await crearEscenarioActivo("confirm-notoken");
            const { exchange } = escenario;

            const res = await request(app)
                .patch(`/api/exchanges/${exchange._id}/confirm`);

            expect(res.status).to.equal(401);
            expect(res.body).to.have.property("message");
        });

        it("ID de exchange inexistente → 404", async () => {
            escenario = await crearEscenarioActivo("confirm-404");
            const { requesterData } = escenario;

            const idInexistente = new mongoose.Types.ObjectId().toString();

            const res = await request(app)
                .patch(`/api/exchanges/${idInexistente}/confirm`)
                .set("Authorization", `Bearer ${requesterData.token}`);

            expect(res.status).to.equal(404);
            expect(res.body).to.have.property("message");
        });

    });

});
