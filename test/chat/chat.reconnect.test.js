// test/chat.reconnect.test.js

"use strict";

const http             = require("http");
const { io: ioClient } = require("socket.io-client");
const request          = require("supertest");
const { expect }       = require("chai");
const mongoose         = require("mongoose");

const app              = require("../../src/app");
const { initSocket }   = require("../../src/sockets");
const User             = require("../../src/models/User");
const Publication      = require("../../src/models/Publication");
const Exchange         = require("../../src/models/Exchange");
const Message          = require("../../src/models/Message");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const registrarUsuario = async (payload) => {
  const res = await request(app).post("/api/auth/register").send(payload);
  return { token: res.body.accessToken, userId: res.body.user._id };
};

const crearPublicacion = (overrides = {}) => ({
  title:       "Objeto de prueba",
  description: "Descripción de prueba para el test",
  history:     "Historia del objeto de prueba",
  category:    "electronica",
  condition:   "bueno",
  type:        "trueque",
  photos:      ["https://res.cloudinary.com/test/image/upload/v1/test.jpg"],
  ...overrides,
});

const crearEscenarioActivo = async (sufijo) => {
  const requesterData = await registrarUsuario({
    nombre:          "Requester",
    apellido:        "ReconTest",
    fechaNacimiento: "2000-01-01",
    email:           `requester.${sufijo}@reconnect.test.com`,
    password:        "Password123!",
    confirmPassword: "Password123!",
  });

  const ownerData = await registrarUsuario({
    nombre:          "Owner",
    apellido:        "ReconTest",
    fechaNacimiento: "2000-01-01",
    email:           `owner.${sufijo}@reconnect.test.com`,
    password:        "Password123!",
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

const limpiarEscenario = async (escenario, mensajeIds = []) => {
  for (const id of mensajeIds) {
    await Message.deleteOne({ _id: id });
  }
  if (escenario.exchange?._id)         await Exchange.deleteOne({ _id: escenario.exchange._id });
  if (escenario.pubRequester?._id)     await Publication.deleteOne({ _id: escenario.pubRequester._id });
  if (escenario.pubOwner?._id)         await Publication.deleteOne({ _id: escenario.pubOwner._id });
  if (escenario.requesterData?.userId) await User.deleteOne({ _id: escenario.requesterData.userId });
  if (escenario.ownerData?.userId)     await User.deleteOne({ _id: escenario.ownerData.userId });
};

const crearSocket = (token) =>
  ioClient(serverAddress, {
    auth:        { token },
    transports:  ["websocket"],
    forceNew:    true,
    autoConnect: false,
  });

const conectar = (socket) =>
  new Promise((resolve, reject) => {
    socket.once("connect",       resolve);
    socket.once("connect_error", reject);
    socket.connect();
  });

const emitirConAck = (socket, event, payload) =>
  new Promise((resolve) => {
    socket.emit(event, payload, (ack) => resolve(ack));
  });

// ─── Setup global ─────────────────────────────────────────────────────────────

let httpServer;
let serverAddress;

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("Chat Socket — Reconexión", () => {

  before(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    httpServer = http.createServer(app);
    initSocket(httpServer);
    await new Promise((resolve) => httpServer.listen(0, resolve));
    serverAddress = `http://localhost:${httpServer.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => httpServer.close(resolve));
    await mongoose.disconnect();
  });

  // ─── Caso 1 ───────────────────────────────────────────────────────────────

  describe("Reconexión — mensajes del otro participante son visibles al volver", () => {

    let escenario;
    let socketRequester;
    let socketOwner;
    let mensajeIds = [];

    afterEach(async () => {
      socketRequester?.disconnect();
      socketOwner?.disconnect();
      await limpiarEscenario(escenario ?? {}, mensajeIds);
      mensajeIds = [];
    });

    it("mensajes enviados por el owner mientras requester estaba offline aparecen al reconectarse", async () => {
      escenario = await crearEscenarioActivo("recon-otros-01");
      const { requesterData, ownerData, exchange } = escenario;

      // ── SESIÓN 1: requester envía un mensaje y se desconecta ──────────────
      socketRequester = crearSocket(requesterData.token);
      await conectar(socketRequester);
      await emitirConAck(socketRequester, "chat:join", { exchangeId: exchange._id });

      const ackR = await emitirConAck(socketRequester, "chat:message", {
        exchangeId: exchange._id,
        content:    "Mensaje del requester antes de desconectarse",
      });
      expect(ackR.ok).to.equal(true);
      mensajeIds.push(ackR.message._id);

      socketRequester.disconnect();

      // ── MIENTRAS REQUESTER ESTÁ OFFLINE: owner envía mensajes ─────────────
      socketOwner = crearSocket(ownerData.token);
      await conectar(socketOwner);
      await emitirConAck(socketOwner, "chat:join", { exchangeId: exchange._id });

      const ackO1 = await emitirConAck(socketOwner, "chat:message", {
        exchangeId: exchange._id,
        content:    "Respuesta del owner mientras requester estaba offline",
      });
      const ackO2 = await emitirConAck(socketOwner, "chat:message", {
        exchangeId: exchange._id,
        content:    "Segundo mensaje del owner offline",
      });

      expect(ackO1.ok).to.equal(true);
      expect(ackO2.ok).to.equal(true);
      mensajeIds.push(ackO1.message._id, ackO2.message._id);

      socketOwner.disconnect();

      // ── SESIÓN 2: requester se reconecta y consulta el historial ──────────
      socketRequester = crearSocket(requesterData.token);
      await conectar(socketRequester);

      const res = await request(app)
        .get(`/api/exchanges/${exchange._id}/messages`)
        .set("Authorization", `Bearer ${requesterData.token}`);

      expect(res.status).to.equal(200);
      expect(res.body.messages).to.have.lengthOf.at.least(3);

      const ids = res.body.messages.map((m) => m._id.toString());

      expect(ids).to.include(ackR.message._id.toString(),
        "El mensaje propio del requester debe estar en el historial");
      expect(ids).to.include(ackO1.message._id.toString(),
        "El primer mensaje del owner (enviado offline) debe estar en el historial");
      expect(ids).to.include(ackO2.message._id.toString(),
        "El segundo mensaje del owner (enviado offline) debe estar en el historial");

      const msgOwner = res.body.messages.find(
        (m) => m._id.toString() === ackO1.message._id.toString()
      );
      expect(msgOwner.sender._id.toString()).to.equal(ownerData.userId.toString(),
        "El sender del mensaje del owner debe ser el owner");
    });

  });

  // ─── Caso 4a ──────────────────────────────────────────────────────────────

  describe("Reconexión — exchange completed: historial accesible", () => {

    let escenario;
    let socketRequester;
    let mensajeIds = [];

    afterEach(async () => {
      socketRequester?.disconnect();
      await limpiarEscenario(escenario ?? {}, mensajeIds);
      mensajeIds = [];
    });

    it("exchange pasa a completed mientras requester estaba offline: historial sigue accesible", async () => {
      escenario = await crearEscenarioActivo("recon-completed-01");
      const { requesterData, exchange } = escenario;

      // ── SESIÓN 1: envía un mensaje y se desconecta ─────────────────────────
      socketRequester = crearSocket(requesterData.token);
      await conectar(socketRequester);
      await emitirConAck(socketRequester, "chat:join", { exchangeId: exchange._id });

      const ack1 = await emitirConAck(socketRequester, "chat:message", {
        exchangeId: exchange._id,
        content:    "Mensaje antes del cierre del intercambio",
      });
      expect(ack1.ok).to.equal(true);
      mensajeIds.push(ack1.message._id);

      socketRequester.disconnect();

      // ── MIENTRAS OFFLINE: el exchange pasa a completed ─────────────────────
      await Exchange.findByIdAndUpdate(exchange._id, { status: "completed" });

      // ── SESIÓN 2: reconexión y consulta de historial ───────────────────────
      socketRequester = crearSocket(requesterData.token);
      await conectar(socketRequester);

      const res = await request(app)
        .get(`/api/exchanges/${exchange._id}/messages`)
        .set("Authorization", `Bearer ${requesterData.token}`);

      expect(res.status).to.equal(200,
        "Un exchange completed debe permitir leer el historial");
      expect(res.body).to.have.property("exchangeStatus", "completed");

      const ids = res.body.messages.map((m) => m._id.toString());
      expect(ids).to.include(ack1.message._id.toString(),
        "El mensaje enviado antes del cierre debe estar en el historial");
    });

  });

  // ─── Caso 4b ──────────────────────────────────────────────────────────────

  describe("Reconexión — exchange cancelled: historial accesible", () => {

    let escenario;
    let socketRequester;
    let mensajeIds = [];

    afterEach(async () => {
      socketRequester?.disconnect();
      await limpiarEscenario(escenario ?? {}, mensajeIds);
      mensajeIds = [];
    });

    it("exchange pasa a cancelled mientras requester estaba offline: historial sigue accesible", async () => {
      escenario = await crearEscenarioActivo("recon-cancelled-01");
      const { requesterData, exchange } = escenario;

      // ── SESIÓN 1: envía un mensaje y se desconecta ─────────────────────────
      socketRequester = crearSocket(requesterData.token);
      await conectar(socketRequester);
      await emitirConAck(socketRequester, "chat:join", { exchangeId: exchange._id });

      const ack1 = await emitirConAck(socketRequester, "chat:message", {
        exchangeId: exchange._id,
        content:    "Mensaje antes de que cancelen el intercambio",
      });
      expect(ack1.ok).to.equal(true);
      mensajeIds.push(ack1.message._id);

      socketRequester.disconnect();

      // ── MIENTRAS OFFLINE: el exchange pasa a cancelled ─────────────────────
      await Exchange.findByIdAndUpdate(exchange._id, { status: "cancelled" });

      // ── SESIÓN 2: reconexión y consulta de historial ───────────────────────
      socketRequester = crearSocket(requesterData.token);
      await conectar(socketRequester);

      const res = await request(app)
        .get(`/api/exchanges/${exchange._id}/messages`)
        .set("Authorization", `Bearer ${requesterData.token}`);

      expect(res.status).to.equal(200,
        "Un exchange cancelled debe permitir leer el historial");
      expect(res.body).to.have.property("exchangeStatus", "cancelled");

      const ids = res.body.messages.map((m) => m._id.toString());
      expect(ids).to.include(ack1.message._id.toString(),
        "El mensaje enviado antes de la cancelación debe estar en el historial");
    });

  });

});
