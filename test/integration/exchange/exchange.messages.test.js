const request  = require("supertest");
const { expect } = require("chai");
const mongoose = require("mongoose");
const app         = require("../../../src/app");
const User        = require("../../../src/models/User");
const Publication = require("../../../src/models/Publication");
const Exchange    = require("../../../src/models/Exchange");
const Message     = require("../../../src/models/Message");

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
    apellido: "MsgTest",
    fechaNacimiento: "2000-01-01",
    email: `requester.${sufijo}@messages.test.com`,
    password: "Password123!",
    confirmPassword: "Password123!",
  });

  const ownerData = await registrarUsuario({
    nombre: "Owner",
    apellido: "MsgTest",
    fechaNacimiento: "2000-01-01",
    email: `owner.${sufijo}@messages.test.com`,
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
      offeredPublicationId:   pubRequester._id.toString(),
      requestedPublicationId: pubOwner._id.toString(),
    });

  await request(app)
    .patch(`/api/exchanges/${envio.body._id}/accept`)
    .set("Authorization", `Bearer ${ownerData.token}`);

  return { requesterData, ownerData, pubRequester, pubOwner, exchange: envio.body };
};

const limpiarEscenario = async ({ requesterData, ownerData, pubRequester, pubOwner, exchange }) => {
  if (exchange?._id)         await Exchange.deleteOne({ _id: exchange._id });
  if (pubRequester?._id)     await Publication.deleteOne({ _id: pubRequester._id });
  if (pubOwner?._id)         await Publication.deleteOne({ _id: pubOwner._id });
  if (requesterData?.userId) await User.deleteOne({ _id: requesterData.userId });
  if (ownerData?.userId)     await User.deleteOne({ _id: ownerData.userId });
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("Exchange Messages API", () => {

  before(async () => {
    await mongoose.connect(process.env.MONGO_URI);
  });

  after(async () => {
    await mongoose.disconnect();
  });

  // ─── Test 1 ───────────────────────────────────────────────────────────────

  describe("GET /api/exchanges/:id/messages — Sin token de autenticación", () => {

    let escenario;

    afterEach(async () => {
      await limpiarEscenario(escenario ?? {});
    });

    it("request sin Authorization header → 401", async () => {
      escenario = await crearEscenarioActivo("sin-token");

      const res = await request(app)
        .get(`/api/exchanges/${escenario.exchange._id}/messages`);

      expect(res.status).to.equal(401);
      expect(res.body).to.have.property("message");
    });

  });

    // ─── Test 2 ───────────────────────────────────────────────────────────────

  describe("GET /api/exchanges/:id/messages — Usuario no participante", () => {

    let escenario;
    let tercero;

    afterEach(async () => {
      await limpiarEscenario(escenario ?? {});
      if (tercero?.userId) await User.deleteOne({ _id: tercero.userId });
    });

    it("usuario autenticado ajeno al intercambio → 403", async () => {
      escenario = await crearEscenarioActivo("tercero-403");

      tercero = await registrarUsuario({
        nombre: "Tercero",
        apellido: "MsgTest",
        fechaNacimiento: "2000-01-01",
        email: "tercero@messages.test.com",
        password: "Password123!",
        confirmPassword: "Password123!",
      });

      const res = await request(app)
        .get(`/api/exchanges/${escenario.exchange._id}/messages`)
        .set("Authorization", `Bearer ${tercero.token}`);

      expect(res.status).to.equal(403);
      expect(res.body).to.have.property("message");
    });

  });

    // ─── Test 3 ───────────────────────────────────────────────────────────────

  describe("GET /api/exchanges/:id/messages — Exchange en estado pending", () => {

    let escenario;

    afterEach(async () => {
      await limpiarEscenario(escenario ?? {});
    });

    it("participante intenta acceder al chat con exchange pending → 403", async () => {
      escenario = await crearEscenarioActivo("pending-bloqueado");

      await Exchange.findByIdAndUpdate(escenario.exchange._id, { status: "pending" });

      const res = await request(app)
        .get(`/api/exchanges/${escenario.exchange._id}/messages`)
        .set("Authorization", `Bearer ${escenario.requesterData.token}`);

      expect(res.status).to.equal(403);
      expect(res.body).to.have.property("message");
    });

  });

    // ─── Test 4 ───────────────────────────────────────────────────────────────

  describe("GET /api/exchanges/:id/messages — Exchange en estado rejected", () => {

    let escenario;

    afterEach(async () => {
      await limpiarEscenario(escenario ?? {});
    });

    it("participante intenta acceder al chat con exchange rejected → 403", async () => {
      escenario = await crearEscenarioActivo("rejected-bloqueado");

      await Exchange.findByIdAndUpdate(escenario.exchange._id, { status: "rejected" });

      const res = await request(app)
        .get(`/api/exchanges/${escenario.exchange._id}/messages`)
        .set("Authorization", `Bearer ${escenario.ownerData.token}`);

      expect(res.status).to.equal(403);
      expect(res.body).to.have.property("message");
    });

  });

    // ─── Test 5 ───────────────────────────────────────────────────────────────

  describe("GET /api/exchanges/:id/messages — Exchange active sin mensajes", () => {

    let escenario;

    afterEach(async () => {
      await limpiarEscenario(escenario ?? {});
    });

    it("participante accede al chat de exchange active sin mensajes → 200 + messages vacío", async () => {
      escenario = await crearEscenarioActivo("active-sin-mensajes");

      const res = await request(app)
        .get(`/api/exchanges/${escenario.exchange._id}/messages`)
        .set("Authorization", `Bearer ${escenario.requesterData.token}`);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("messages").that.is.an("array").with.lengthOf(0);
      expect(res.body).to.have.property("hasMore", false);
      expect(res.body).to.have.property("exchangeStatus", "active");
    });

  });

    // ─── Test 6 ───────────────────────────────────────────────────────────────

  describe("GET /api/exchanges/:id/messages — Exchange active con mensajes", () => {

    let escenario;
    let mensajeId;

    afterEach(async () => {
      if (mensajeId) await Message.deleteOne({ _id: mensajeId });
      await limpiarEscenario(escenario ?? {});
    });

    it("participante accede al chat con mensajes → 200 + historial formateado", async () => {
      escenario = await crearEscenarioActivo("active-con-mensajes");

      const mensaje = await Message.create({
        exchangeId: escenario.exchange._id,
        senderId:   escenario.requesterData.userId,
        content:    "Hola, coordinamos el intercambio?",
      });
      mensajeId = mensaje._id;

      const res = await request(app)
        .get(`/api/exchanges/${escenario.exchange._id}/messages`)
        .set("Authorization", `Bearer ${escenario.requesterData.token}`);

      expect(res.status).to.equal(200);
      expect(res.body.messages).to.be.an("array").with.lengthOf(1);

      const msg = res.body.messages[0];
      expect(msg).to.have.property("_id");
      expect(msg).to.have.property("content", "Hola, coordinamos el intercambio?");
      expect(msg).to.have.property("createdAt");
      expect(msg).to.have.property("sender").that.is.an("object");
      expect(msg.sender).to.have.property("_id");
      expect(msg.sender).to.have.property("nombre");
      expect(msg.sender).to.have.property("apellido");
      expect(msg.sender).to.have.property("photo");

      expect(res.body).to.have.property("hasMore", false);
      expect(res.body).to.have.property("exchangeStatus", "active");
    });

  });

    // ─── Test 7 ───────────────────────────────────────────────────────────────

  describe("GET /api/exchanges/:id/messages — ID de exchange inexistente", () => {

    let usuario;

    afterEach(async () => {
      if (usuario?.userId) await User.deleteOne({ _id: usuario.userId });
    });

    it("ID válido pero sin exchange en BD → 404", async () => {
      usuario = await registrarUsuario({
        nombre: "Usuario",
        apellido: "MsgTest",
        fechaNacimiento: "2000-01-01",
        email: "inexistente@messages.test.com",
        password: "Password123!",
        confirmPassword: "Password123!",
      });

      const idInexistente = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .get(`/api/exchanges/${idInexistente}/messages`)
        .set("Authorization", `Bearer ${usuario.token}`);

      expect(res.status).to.equal(404);
      expect(res.body).to.have.property("message");
    });

  });

    // ─── Test 8 ───────────────────────────────────────────────────────────────

  describe("GET /api/exchanges/:id/messages — ID malformado", () => {

    let usuario;

    afterEach(async () => {
      if (usuario?.userId) await User.deleteOne({ _id: usuario.userId });
    });

    it("ID con formato inválido en la URL → 400", async () => {
      usuario = await registrarUsuario({
        nombre: "Usuario",
        apellido: "MsgTest",
        fechaNacimiento: "2000-01-01",
        email: "malformado@messages.test.com",
        password: "Password123!",
        confirmPassword: "Password123!",
      });

      const res = await request(app)
        .get("/api/exchanges/id-esto-no-es-un-objectid/messages")
        .set("Authorization", `Bearer ${usuario.token}`);

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("errors").that.is.an("array");

    });

  });

  describe("GET /api/exchanges/:id/messages - Historial paginado", () => {

    let escenario;
    let mensajeIds = [];

    afterEach(async () => {
      await Message.deleteMany({ _id: { $in: mensajeIds } });
      await limpiarEscenario(escenario ?? {});
      mensajeIds = [];
    });

    it("permite cargar mensajes antiguos con cursor sin perder el orden cronológico", async () => {
      escenario = await crearEscenarioActivo("historial-paginado");

      const mensajes = await Message.insertMany(
        Array.from({ length: 60 }, (_, index) => ({
          exchangeId: escenario.exchange._id,
          senderId: escenario.requesterData.userId,
          content: `Mensaje ${String(index + 1).padStart(2, "0")}`,
        })),
      );
      mensajeIds = mensajes.map((mensaje) => mensaje._id);

      const primeraPagina = await request(app)
        .get(`/api/exchanges/${escenario.exchange._id}/messages`)
        .query({ limit: 20 })
        .set("Authorization", `Bearer ${escenario.requesterData.token}`);

      expect(primeraPagina.status).to.equal(200);
      expect(primeraPagina.body.messages).to.have.lengthOf(20);
      expect(primeraPagina.body.hasMore).to.equal(true);
      expect(primeraPagina.body.messages[0].content).to.equal("Mensaje 41");
      expect(primeraPagina.body.messages[19].content).to.equal("Mensaje 60");

      const before = primeraPagina.body.messages[0]._id;
      const segundaPagina = await request(app)
        .get(`/api/exchanges/${escenario.exchange._id}/messages`)
        .query({ limit: 20, before })
        .set("Authorization", `Bearer ${escenario.requesterData.token}`);

      expect(segundaPagina.status).to.equal(200);
      expect(segundaPagina.body.messages).to.have.lengthOf(20);
      expect(segundaPagina.body.hasMore).to.equal(true);
      expect(segundaPagina.body.messages[0].content).to.equal("Mensaje 21");
      expect(segundaPagina.body.messages[19].content).to.equal("Mensaje 40");
    });

  });

});
