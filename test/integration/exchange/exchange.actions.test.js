const request = require("supertest");
const { expect } = require("chai");
const mongoose = require("mongoose");
const app = require("../../../src/app");
const User = require("../../../src/models/User");
const Publication = require("../../../src/models/Publication");
const Exchange = require("../../../src/models/Exchange");

// ─── Helpers de setup ────────────────────────────────────────────────────────

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

const crearEscenario = async (sufijo) => {
  const ownerData = await registrarUsuario({
    nombre: "Owner",
    apellido: "ActionsTest",
    fechaNacimiento: "2000-01-01",
    email: `owner.${sufijo}@actions.test.com`,
    password: "Password123!",
    confirmPassword: "Password123!",
  });

  const requesterData = await registrarUsuario({
    nombre: "Requester",
    apellido: "ActionsTest",
    fechaNacimiento: "2000-01-01",
    email: `requester.${sufijo}@actions.test.com`,
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

  const envio = await request(app)
    .post("/api/exchanges")
    .set("Authorization", `Bearer ${requesterData.token}`)
    .send({
      offeredPublicationId: pubRequester._id.toString(),
      requestedPublicationId: pubOwner._id.toString(),
    });

  return { ownerData, requesterData, pubOwner, pubRequester, exchange: envio.body };
};

const limpiarEscenario = async ({ ownerData, requesterData, pubOwner, pubRequester, exchange }) => {
  if (exchange?._id)         await Exchange.deleteOne({ _id: exchange._id });
  if (pubOwner?._id)         await Publication.deleteOne({ _id: pubOwner._id });
  if (pubRequester?._id)     await Publication.deleteOne({ _id: pubRequester._id });
  if (ownerData?.userId)     await User.deleteOne({ _id: ownerData.userId });
  if (requesterData?.userId) await User.deleteOne({ _id: requesterData.userId });
};

// ─── Lifecycle global ────────────────────────────────────────────────────────

describe("Exchange Actions API", () => {

  before(async () => {
    await mongoose.connect(process.env.MONGO_URI);
  });

  after(async () => {
    await mongoose.disconnect();
  });

  // ─── Test 1: Aceptar como owner ──────────────────────────────────────────

  describe("PATCH /api/exchanges/:id/accept — Aceptar solicitud", () => {

    let escenario;

    afterEach(async () => {
      await limpiarEscenario(escenario ?? {});
    });

    it("owner acepta solicitud pendiente → 200 + status active", async () => {
      escenario = await crearEscenario("accept-ok");
      const { ownerData, exchange } = escenario;

      const res = await request(app)
        .patch(`/api/exchanges/${exchange._id}/accept`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("status", "active");
      expect(res.body).to.have.property("_id", exchange._id);
    });

    it("al aceptar → ambas publicaciones siguen available pero con intercambioActivo true", async () => {
      escenario = await crearEscenario("accept-pubs");
      const { ownerData, pubOwner, pubRequester, exchange } = escenario;

      await request(app)
        .patch(`/api/exchanges/${exchange._id}/accept`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      const [pubA, pubB] = await Promise.all([
        Publication.findById(pubOwner._id),
        Publication.findById(pubRequester._id),
      ]);

      expect(pubA.status).to.equal("available");
      expect(pubA.intercambioActivo).to.equal(true);
      expect(pubB.status).to.equal("available");
      expect(pubB.intercambioActivo).to.equal(true);
    });

    it("sin token → 401", async () => {
      escenario = await crearEscenario("accept-notoken");
      const { exchange } = escenario;

      const res = await request(app)
        .patch(`/api/exchanges/${exchange._id}/accept`);

      expect(res.status).to.equal(401);
      expect(res.body).to.have.property("message");
    });

  });

  // ─── Test 2: Rechazar solicitud ──────────────────────────────────────────

  describe("PATCH /api/exchanges/:id/reject — Rechazar solicitud", () => {

    let escenario;

    afterEach(async () => {
      await limpiarEscenario(escenario ?? {});
    });

    it("owner rechaza solicitud pendiente → 200 + status rejected", async () => {
      escenario = await crearEscenario("reject-ok");
      const { ownerData, exchange } = escenario;

      const res = await request(app)
        .patch(`/api/exchanges/${exchange._id}/reject`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("status", "rejected");
      expect(res.body).to.have.property("_id", exchange._id);
    });

    it("al rechazar → publicaciones siguen available", async () => {
      escenario = await crearEscenario("reject-pubs");
      const { ownerData, pubOwner, pubRequester, exchange } = escenario;

      await request(app)
        .patch(`/api/exchanges/${exchange._id}/reject`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      const [pubA, pubB] = await Promise.all([
        Publication.findById(pubOwner._id),
        Publication.findById(pubRequester._id),
      ]);

      expect(pubA.status).to.equal("available");
      expect(pubB.status).to.equal("available");
    });

    it("sin token → 401", async () => {
      escenario = await crearEscenario("reject-notoken");
      const { exchange } = escenario;

      const res = await request(app)
        .patch(`/api/exchanges/${exchange._id}/reject`);

      expect(res.status).to.equal(401);
      expect(res.body).to.have.property("message");
    });

  });

  // ─── Test 3: Bloqueo no-owner ────────────────────────────────────────────

  describe("PATCH /api/exchanges/:id/accept|reject — Bloqueo no-owner", () => {

    let escenario;

    afterEach(async () => {
      await limpiarEscenario(escenario ?? {});
    });

    it("requester intenta aceptar su propia solicitud → 403", async () => {
      escenario = await crearEscenario("block-accept");
      const { requesterData, exchange } = escenario;

      const res = await request(app)
        .patch(`/api/exchanges/${exchange._id}/accept`)
        .set("Authorization", `Bearer ${requesterData.token}`);

      expect(res.status).to.equal(403);
      expect(res.body).to.have.property("message");
    });

    it("requester intenta rechazar su propia solicitud → 403", async () => {
      escenario = await crearEscenario("block-reject");
      const { requesterData, exchange } = escenario;

      const res = await request(app)
        .patch(`/api/exchanges/${exchange._id}/reject`)
        .set("Authorization", `Bearer ${requesterData.token}`);

      expect(res.status).to.equal(403);
      expect(res.body).to.have.property("message");
    });

    it("tercero ajeno al intercambio intenta aceptar → 403", async () => {
      escenario = await crearEscenario("block-tercero");
      const { exchange } = escenario;

      const tercero = await registrarUsuario({
        nombre: "Tercero",
        apellido: "ActionsTest",
        fechaNacimiento: "2000-01-01",
        email: "tercero.block@actions.test.com",
        password: "Password123!",
        confirmPassword: "Password123!",
      });

      const res = await request(app)
        .patch(`/api/exchanges/${exchange._id}/accept`)
        .set("Authorization", `Bearer ${tercero.token}`);

      await User.deleteOne({ _id: tercero.userId });

      expect(res.status).to.equal(403);
      expect(res.body).to.have.property("message");
    });

  });

  // ─── Test 4: Validar unicidad ────────────────────────────────────────────

  describe("PATCH /api/exchanges/:id/accept — Unicidad por publicación", () => {

    let ownerData, requesterAData, requesterBData;
    let pubOwner, pubRequesterA, pubRequesterB;
    let exchangeA, exchangeB;

    afterEach(async () => {
      for (const id of [exchangeA?._id, exchangeB?._id].filter(Boolean))
        await Exchange.deleteOne({ _id: id });
      for (const id of [pubOwner?._id, pubRequesterA?._id, pubRequesterB?._id].filter(Boolean))
        await Publication.deleteOne({ _id: id });
      for (const u of [ownerData, requesterAData, requesterBData].filter(Boolean))
        await User.deleteOne({ _id: u.userId });
    });

    it("aceptar una solicitud no rechaza las demás solicitudes pendientes, pero confirmarla (completarla) sí las rechaza", async () => {
      ownerData = await registrarUsuario({
        nombre: "Owner", apellido: "UniTest", fechaNacimiento: "2000-01-01",
        email: "owner.uni@actions.test.com", password: "Password123!", confirmPassword: "Password123!",
      });
      requesterAData = await registrarUsuario({
        nombre: "RequesterA", apellido: "UniTest", fechaNacimiento: "2000-01-01",
        email: "requesterA.uni@actions.test.com", password: "Password123!", confirmPassword: "Password123!",
      });
      requesterBData = await registrarUsuario({
        nombre: "RequesterB", apellido: "UniTest", fechaNacimiento: "2000-01-01",
        email: "requesterB.uni@actions.test.com", password: "Password123!", confirmPassword: "Password123!",
      });

      pubOwner = await Publication.create({
        ...crearPublicacion({ title: "Pub Owner - UniTest" }), owner: ownerData.userId,
      });
      pubRequesterA = await Publication.create({
        ...crearPublicacion({ title: "Pub RequesterA - UniTest" }), owner: requesterAData.userId,
      });
      pubRequesterB = await Publication.create({
        ...crearPublicacion({ title: "Pub RequesterB - UniTest" }), owner: requesterBData.userId,
      });

      const envioA = await request(app)
        .post("/api/exchanges")
        .set("Authorization", `Bearer ${requesterAData.token}`)
        .send({
          offeredPublicationId: pubRequesterA._id.toString(),
          requestedPublicationId: pubOwner._id.toString(),
        });

      const envioB = await request(app)
        .post("/api/exchanges")
        .set("Authorization", `Bearer ${requesterBData.token}`)
        .send({
          offeredPublicationId: pubRequesterB._id.toString(),
          requestedPublicationId: pubOwner._id.toString(),
        });

      expect(envioA.status).to.equal(201);
      expect(envioB.status).to.equal(201);
      exchangeA = envioA.body;
      exchangeB = envioB.body;

      // Aceptar la solicitud A
      const res = await request(app)
        .patch(`/api/exchanges/${exchangeA._id}/accept`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("status", "active");

      // La solicitud B debe seguir estando en pending
      let exchangeBActualizado = await Exchange.findById(exchangeB._id);
      expect(exchangeBActualizado.status).to.equal("pending");

      // Confirmar por ambas partes la solicitud A para completarla
      await request(app)
        .patch(`/api/exchanges/${exchangeA._id}/confirm`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      await request(app)
        .patch(`/api/exchanges/${exchangeA._id}/confirm`)
        .set("Authorization", `Bearer ${requesterAData.token}`);

      const exchangeACompletado = await Exchange.findById(exchangeA._id);
      expect(exchangeACompletado.status).to.equal("completed");

      // Ahora que la solicitud A está completed, la solicitud B debe haber sido rechazada
      exchangeBActualizado = await Exchange.findById(exchangeB._id);
      expect(exchangeBActualizado.status).to.equal("rejected");
    });

  });

  // ─── Test 5: Estado inválido — accept ────────────────────────────────────

  describe("PATCH /api/exchanges/:id/accept — Estado inválido", () => {

    let escenario;

    afterEach(async () => {
      await limpiarEscenario(escenario ?? {});
    });

    it("aceptar una solicitud ya active → 400", async () => {
      escenario = await crearEscenario("accept-already-active");
      const { ownerData, exchange } = escenario;

      await request(app)
        .patch(`/api/exchanges/${exchange._id}/accept`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      const res = await request(app)
        .patch(`/api/exchanges/${exchange._id}/accept`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("message");
    });

    it("aceptar una solicitud ya rejected → 400", async () => {
      escenario = await crearEscenario("accept-already-rejected");
      const { ownerData, exchange } = escenario;

      await request(app)
        .patch(`/api/exchanges/${exchange._id}/reject`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      const res = await request(app)
        .patch(`/api/exchanges/${exchange._id}/accept`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("message");
    });

  });

  // ─── Test 6: Estado inválido — reject ────────────────────────────────────

  describe("PATCH /api/exchanges/:id/reject — Estado inválido", () => {

    let escenario;

    afterEach(async () => {
      await limpiarEscenario(escenario ?? {});
    });

    it("rechazar una solicitud ya active → 400", async () => {
      escenario = await crearEscenario("reject-already-active");
      const { ownerData, exchange } = escenario;

      await request(app)
        .patch(`/api/exchanges/${exchange._id}/accept`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      const res = await request(app)
        .patch(`/api/exchanges/${exchange._id}/reject`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("message");
    });

    it("rechazar una solicitud ya rejected → 400", async () => {
      escenario = await crearEscenario("reject-already-rejected");
      const { ownerData, exchange } = escenario;

      await request(app)
        .patch(`/api/exchanges/${exchange._id}/reject`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      const res = await request(app)
        .patch(`/api/exchanges/${exchange._id}/reject`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("message");
    });

  });

  // ─── Test 7: ID inválido e inexistente ───────────────────────────────────

  describe("PATCH /api/exchanges/:id/accept|reject — ID inválido o inexistente", () => {

    let usuarioData;

    before(async () => {
      usuarioData = await registrarUsuario({
        nombre: "Usuario", apellido: "IDTest", fechaNacimiento: "2000-01-01",
        email: "usuario.idtest@actions.test.com",
        password: "Password123!", confirmPassword: "Password123!",
      });
    });

    after(async () => {
      if (usuarioData?.userId) await User.deleteOne({ _id: usuarioData.userId });
    });

    it("ID malformado en accept → 400 (falla en validador, no llega al service)", async () => {
      const res = await request(app)
        .patch("/api/exchanges/esto-no-es-un-id/accept")
        .set("Authorization", `Bearer ${usuarioData.token}`);

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("errors");
      expect(res.body.errors).to.be.an("array").that.is.not.empty;
    });

    it("ID malformado en reject → 400 (falla en validador, no llega al service)", async () => {
      const res = await request(app)
        .patch("/api/exchanges/esto-no-es-un-id/reject")
        .set("Authorization", `Bearer ${usuarioData.token}`);

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("errors");
      expect(res.body.errors).to.be.an("array").that.is.not.empty;
    });

    it("ID inexistente en accept → 404", async () => {
      const idInexistente = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .patch(`/api/exchanges/${idInexistente}/accept`)
        .set("Authorization", `Bearer ${usuarioData.token}`);

      expect(res.status).to.equal(404);
      expect(res.body).to.have.property("message");
    });

    it("ID inexistente en reject → 404", async () => {
      const idInexistente = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .patch(`/api/exchanges/${idInexistente}/reject`)
        .set("Authorization", `Bearer ${usuarioData.token}`);

      expect(res.status).to.equal(404);
      expect(res.body).to.have.property("message");
    });

  });

  // ─── Test 8: Estado inválido — cancelled y completed ─────────────────────

  describe("PATCH /api/exchanges/:id/accept|reject — Estado cancelled o completed", () => {

    let escenario;

    afterEach(async () => {
      await limpiarEscenario(escenario ?? {});
    });

    it("aceptar una solicitud cancelled → 400", async () => {
      escenario = await crearEscenario("accept-cancelled");
      const { requesterData, exchange } = escenario;

      // El requester cancela su propia solicitud
      await request(app)
        .patch(`/api/exchanges/${exchange._id}/cancel`)
        .set("Authorization", `Bearer ${requesterData.token}`);

      const res = await request(app)
        .patch(`/api/exchanges/${exchange._id}/accept`)
        .set("Authorization", `Bearer ${escenario.ownerData.token}`);

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("message");
    });

    it("rechazar una solicitud cancelled → 400", async () => {
      escenario = await crearEscenario("reject-cancelled");
      const { requesterData, exchange } = escenario;

      await request(app)
        .patch(`/api/exchanges/${exchange._id}/cancel`)
        .set("Authorization", `Bearer ${requesterData.token}`);

      const res = await request(app)
        .patch(`/api/exchanges/${exchange._id}/reject`)
        .set("Authorization", `Bearer ${escenario.ownerData.token}`);

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("message");
    });

    it("aceptar una solicitud completed → 400", async () => {
      escenario = await crearEscenario("accept-completed");
      const { ownerData, requesterData, exchange } = escenario;

      // Llevar el exchange a completed: accept → confirm x2
      await request(app)
        .patch(`/api/exchanges/${exchange._id}/accept`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      await request(app)
        .patch(`/api/exchanges/${exchange._id}/confirm`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      await request(app)
        .patch(`/api/exchanges/${exchange._id}/confirm`)
        .set("Authorization", `Bearer ${requesterData.token}`);

      const res = await request(app)
        .patch(`/api/exchanges/${exchange._id}/accept`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("message");
    });

    it("rechazar una solicitud completed → 400", async () => {
      escenario = await crearEscenario("reject-completed");
      const { ownerData, requesterData, exchange } = escenario;

      await request(app)
        .patch(`/api/exchanges/${exchange._id}/accept`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      await request(app)
        .patch(`/api/exchanges/${exchange._id}/confirm`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      await request(app)
        .patch(`/api/exchanges/${exchange._id}/confirm`)
        .set("Authorization", `Bearer ${requesterData.token}`);

      const res = await request(app)
        .patch(`/api/exchanges/${exchange._id}/reject`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("message");
    });

  });

});
