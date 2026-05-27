// test/chat.socket.test.js

"use strict";

const http       = require("http");
const { io: ioClient } = require("socket.io-client");
const request    = require("supertest");
const { expect } = require("chai");
const mongoose   = require("mongoose");

const app         = require("../src/app");
const { initSocket } = require("../src/sockets");
const User        = require("../src/models/User");
const Publication = require("../src/models/Publication");
const Exchange    = require("../src/models/Exchange");
const Message     = require("../src/models/Message");

// ─── Helpers globales ─────────────────────────────────────────────────────────

let httpServer;
let serverAddress;

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
    apellido: "ChatTest",
    fechaNacimiento: "2000-01-01",
    email: `requester.${sufijo}@chat.test.com`,
    password: "Password123!",
    confirmPassword: "Password123!",
  });

  const ownerData = await registrarUsuario({
    nombre: "Owner",
    apellido: "ChatTest",
    fechaNacimiento: "2000-01-01",
    email: `owner.${sufijo}@chat.test.com`,
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

const limpiarEscenario = async ({ requesterData, ownerData, pubRequester, pubOwner, exchange }, mensajeIds = []) => {
  for (const id of mensajeIds) {
    await Message.deleteOne({ _id: id });
  }
  if (exchange?._id)         await Exchange.deleteOne({ _id: exchange._id });
  if (pubRequester?._id)     await Publication.deleteOne({ _id: pubRequester._id });
  if (pubOwner?._id)         await Publication.deleteOne({ _id: pubOwner._id });
  if (requesterData?.userId) await User.deleteOne({ _id: requesterData.userId });
  if (ownerData?.userId)     await User.deleteOne({ _id: ownerData.userId });
};

const crearSocket = (token) =>
  ioClient(serverAddress, {
    auth: { token },
    transports: ["websocket"],
    forceNew: true,
    autoConnect: false,
  });

const conectar = (socket) =>
  new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
    socket.connect();
  });

const emitirConAck = (socket, event, payload) =>
  new Promise((resolve) => {
    socket.emit(event, payload, (ack) => resolve(ack));
  });

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("Chat Socket", () => {

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

  // ─── Test 1 ───────────────────────────────────────────────────────────────

  describe("chat:message — Envío en tiempo real", () => {

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

    it("mensaje del requester llega al owner por evento socket", async () => {
      escenario = await crearEscenarioActivo("realtime-01");
      const { requesterData, ownerData, exchange } = escenario;

      socketRequester = crearSocket(requesterData.token);
      socketOwner     = crearSocket(ownerData.token);

      await Promise.all([conectar(socketRequester), conectar(socketOwner)]);

      await emitirConAck(socketRequester, "chat:join", { exchangeId: exchange._id });
      await emitirConAck(socketOwner,     "chat:join", { exchangeId: exchange._id });

      // Registrar listener ANTES de emitir para no perder el evento
      const mensajeRecibido = new Promise((resolve) => {
        socketOwner.once("chat:message", resolve);
      });

      const ack = await emitirConAck(socketRequester, "chat:message", {
        exchangeId: exchange._id,
        content:    "Hola, ¿coordinamos el intercambio?",
      });

      expect(ack.ok).to.equal(true);
      expect(ack.message).to.have.property("_id");
      expect(ack.message).to.have.property("content", "Hola, ¿coordinamos el intercambio?");
      expect(ack.message).to.have.property("createdAt");
      expect(ack.message.sender).to.include.keys("_id", "nombre", "apellido", "photo");

      mensajeIds.push(ack.message._id);

      const eventoOwner = await mensajeRecibido;
      expect(eventoOwner).to.have.property("content", "Hola, ¿coordinamos el intercambio?");
      expect(eventoOwner.sender._id.toString()).to.equal(requesterData.userId.toString());
    });

  });
    // ─── Test 2 ───────────────────────────────────────────────────────────────

  describe("chat:message — Persistencia en base de datos", () => {

    let escenario;
    let socketRequester;
    let mensajeIds = [];

    afterEach(async () => {
      socketRequester?.disconnect();
      await limpiarEscenario(escenario ?? {}, mensajeIds);
      mensajeIds = [];
    });

    it("mensaje enviado por socket es recuperable vía GET /messages", async () => {
      escenario = await crearEscenarioActivo("persist-01");
      const { requesterData, exchange } = escenario;

      socketRequester = crearSocket(requesterData.token);
      await conectar(socketRequester);
      await emitirConAck(socketRequester, "chat:join", { exchangeId: exchange._id });

      const ack = await emitirConAck(socketRequester, "chat:message", {
        exchangeId: exchange._id,
        content:    "Mensaje que debe persistir",
      });

      expect(ack.ok).to.equal(true);
      mensajeIds.push(ack.message._id);

      // Verificar persistencia vía REST — sin depender del socket
      const res = await request(app)
        .get(`/api/exchanges/${exchange._id}/messages`)
        .set("Authorization", `Bearer ${requesterData.token}`);

      expect(res.status).to.equal(200);

      const encontrado = res.body.messages.find((m) => m._id === ack.message._id);
      expect(encontrado).to.exist;
      expect(encontrado).to.have.property("content", "Mensaje que debe persistir");
      expect(encontrado).to.have.property("createdAt");
      expect(encontrado.sender).to.include.keys("_id", "nombre", "apellido", "photo");
    });

  });
    // ─── Test 3 ───────────────────────────────────────────────────────────────

  describe("chat:message — Reconexión: historial disponible tras desconexión", () => {

    let escenario;
    let socketRequester;
    let mensajeIds = [];

    afterEach(async () => {
      socketRequester?.disconnect();
      await limpiarEscenario(escenario ?? {}, mensajeIds);
      mensajeIds = [];
    });

    it("mensajes enviados antes de desconectarse son recuperables al reconectarse", async () => {
      escenario = await crearEscenarioActivo("reconnect-01");
      const { requesterData, exchange } = escenario;

      // ── Primera sesión: enviar mensajes ───────────────────────────────────
      socketRequester = crearSocket(requesterData.token);
      await conectar(socketRequester);
      await emitirConAck(socketRequester, "chat:join", { exchangeId: exchange._id });

      const ack1 = await emitirConAck(socketRequester, "chat:message", {
        exchangeId: exchange._id,
        content:    "Primer mensaje antes de desconectarme",
      });
      const ack2 = await emitirConAck(socketRequester, "chat:message", {
        exchangeId: exchange._id,
        content:    "Segundo mensaje antes de desconectarme",
      });

      expect(ack1.ok).to.equal(true);
      expect(ack2.ok).to.equal(true);
      mensajeIds.push(ack1.message._id, ack2.message._id);

      // ── Desconexión explícita ─────────────────────────────────────────────
      socketRequester.disconnect();

      // ── Segunda sesión: reconexión y consulta de historial ────────────────
      socketRequester = crearSocket(requesterData.token);
      await conectar(socketRequester);

      const res = await request(app)
        .get(`/api/exchanges/${exchange._id}/messages`)
        .set("Authorization", `Bearer ${requesterData.token}`);

      expect(res.status).to.equal(200);
      expect(res.body.messages).to.be.an("array").with.lengthOf.at.least(2);

      const ids = res.body.messages.map((m) => m._id);
      expect(ids).to.include(ack1.message._id);
      expect(ids).to.include(ack2.message._id);

      // Verificar orden cronológico ascendente
      const timestamps = res.body.messages.map((m) => new Date(m.createdAt).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).to.be.at.least(timestamps[i - 1]);
      }
    });

  });
    // ─── Test 4 ───────────────────────────────────────────────────────────────

  describe("chat:message — Múltiples mensajes de ambos participantes", () => {

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

    it("ambos participantes envían mensajes, todos persisten con sender correcto", async () => {
      escenario = await crearEscenarioActivo("multi-01");
      const { requesterData, ownerData, exchange } = escenario;

      socketRequester = crearSocket(requesterData.token);
      socketOwner     = crearSocket(ownerData.token);

      await Promise.all([conectar(socketRequester), conectar(socketOwner)]);
      await emitirConAck(socketRequester, "chat:join", { exchangeId: exchange._id });
      await emitirConAck(socketOwner,     "chat:join", { exchangeId: exchange._id });

      // Capturar todos los eventos que llegan al owner
      const eventosRecibidos = [];
      socketOwner.on("chat:message", (msg) => eventosRecibidos.push(msg));

      // Requester envía 2 mensajes, owner envía 1
      const ackR1 = await emitirConAck(socketRequester, "chat:message", {
        exchangeId: exchange._id,
        content:    "Mensaje 1 del requester",
      });
      const ackO1 = await emitirConAck(socketOwner, "chat:message", {
        exchangeId: exchange._id,
        content:    "Respuesta del owner",
      });
      const ackR2 = await emitirConAck(socketRequester, "chat:message", {
        exchangeId: exchange._id,
        content:    "Mensaje 2 del requester",
      });

      expect(ackR1.ok).to.equal(true);
      expect(ackO1.ok).to.equal(true);
      expect(ackR2.ok).to.equal(true);
      mensajeIds.push(ackR1.message._id, ackO1.message._id, ackR2.message._id);

      // Dar tiempo al event loop para procesar los broadcasts pendientes
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Owner debió recibir los 3 mensajes por socket (incluyendo el suyo propio)
      expect(eventosRecibidos).to.have.lengthOf(3);

      // Verificar persistencia y sender correcto vía REST
      const res = await request(app)
        .get(`/api/exchanges/${exchange._id}/messages`)
        .set("Authorization", `Bearer ${requesterData.token}`);

      expect(res.status).to.equal(200);

      const mensajes = res.body.messages;
      const msgR1 = mensajes.find((m) => m._id === ackR1.message._id);
      const msgO1 = mensajes.find((m) => m._id === ackO1.message._id);
      const msgR2 = mensajes.find((m) => m._id === ackR2.message._id);

      expect(msgR1).to.exist;
      expect(msgO1).to.exist;
      expect(msgR2).to.exist;

      expect(msgR1.sender._id.toString()).to.equal(requesterData.userId.toString());
      expect(msgO1.sender._id.toString()).to.equal(ownerData.userId.toString());
      expect(msgR2.sender._id.toString()).to.equal(requesterData.userId.toString());

      expect(msgR1.content).to.equal("Mensaje 1 del requester");
      expect(msgO1.content).to.equal("Respuesta del owner");
      expect(msgR2.content).to.equal("Mensaje 2 del requester");
    });

  });
    // ─── Test 5 ───────────────────────────────────────────────────────────────

  describe("chat:message — Validaciones de contenido", () => {

    let escenario;
    let socketRequester;

    afterEach(async () => {
      socketRequester?.disconnect();
      await limpiarEscenario(escenario ?? {}, []);
    });

    it("content vacío ('') → ack con error, sin persistir", async () => {
      escenario = await crearEscenarioActivo("vacio-01");
      const { requesterData, exchange } = escenario;

      socketRequester = crearSocket(requesterData.token);
      await conectar(socketRequester);
      await emitirConAck(socketRequester, "chat:join", { exchangeId: exchange._id });

      const ack = await emitirConAck(socketRequester, "chat:message", {
        exchangeId: exchange._id,
        content:    "",
      });

      expect(ack.ok).to.equal(false);
      expect(ack.error).to.be.a("string").and.not.empty;

      const res = await request(app)
        .get(`/api/exchanges/${exchange._id}/messages`)
        .set("Authorization", `Bearer ${requesterData.token}`);

      expect(res.body.messages).to.have.lengthOf(0);
    });

    it("content solo espacios ('   ') → ack con error, sin persistir", async () => {
      escenario = await crearEscenarioActivo("vacio-02");
      const { requesterData, exchange } = escenario;

      socketRequester = crearSocket(requesterData.token);
      await conectar(socketRequester);
      await emitirConAck(socketRequester, "chat:join", { exchangeId: exchange._id });

      const ack = await emitirConAck(socketRequester, "chat:message", {
        exchangeId: exchange._id,
        content:    "     ",
      });

      expect(ack.ok).to.equal(false);
      expect(ack.error).to.be.a("string").and.not.empty;

      const res = await request(app)
        .get(`/api/exchanges/${exchange._id}/messages`)
        .set("Authorization", `Bearer ${requesterData.token}`);

      expect(res.body.messages).to.have.lengthOf(0);
    });

    it("content supera 1000 caracteres → ack con error, sin persistir", async () => {
      escenario = await crearEscenarioActivo("vacio-03");
      const { requesterData, exchange } = escenario;

      socketRequester = crearSocket(requesterData.token);
      await conectar(socketRequester);
      await emitirConAck(socketRequester, "chat:join", { exchangeId: exchange._id });

      const ack = await emitirConAck(socketRequester, "chat:message", {
        exchangeId: exchange._id,
        content:    "x".repeat(1001),
      });

      expect(ack.ok).to.equal(false);
      expect(ack.error).to.be.a("string").and.not.empty;

      const res = await request(app)
        .get(`/api/exchanges/${exchange._id}/messages`)
        .set("Authorization", `Bearer ${requesterData.token}`);

      expect(res.body.messages).to.have.lengthOf(0);
    });

    it("content ausente (campo no enviado) → ack con error, sin persistir", async () => {
      escenario = await crearEscenarioActivo("vacio-04");
      const { requesterData, exchange } = escenario;

      socketRequester = crearSocket(requesterData.token);
      await conectar(socketRequester);
      await emitirConAck(socketRequester, "chat:join", { exchangeId: exchange._id });

      const ack = await emitirConAck(socketRequester, "chat:message", {
        exchangeId: exchange._id,
        // content deliberadamente ausente
      });

      expect(ack.ok).to.equal(false);
      expect(ack.error).to.be.a("string").and.not.empty;

      const res = await request(app)
        .get(`/api/exchanges/${exchange._id}/messages`)
        .set("Authorization", `Bearer ${requesterData.token}`);

      expect(res.body.messages).to.have.lengthOf(0);
    });

  });

  // ─── Tests extra: Autorización ────────────────────────────────────────────

  describe("Autorización — Conexión sin token válido", () => {

    it("conectarse sin token → connect_error", async () => {
      const socket = ioClient(serverAddress, {
        auth: {},
        transports: ["websocket"],
        forceNew: true,
        autoConnect: false,
      });

      const error = await new Promise((resolve) => {
        socket.once("connect_error", resolve);
        socket.connect();
      });

      expect(error.message).to.be.a("string").and.not.empty;
      socket.disconnect();
    });

    it("conectarse con token malformado → connect_error", async () => {
      const socket = ioClient(serverAddress, {
        auth: { token: "esto.no.es.un.jwt" },
        transports: ["websocket"],
        forceNew: true,
        autoConnect: false,
      });

      const error = await new Promise((resolve) => {
        socket.once("connect_error", resolve);
        socket.connect();
      });

      expect(error.message).to.be.a("string").and.not.empty;
      socket.disconnect();
    });

  });

  describe("Autorización — chat:join con exchange inválido", () => {

    let escenario;
    let socketRequester;

    afterEach(async () => {
      socketRequester?.disconnect();
      await limpiarEscenario(escenario ?? {}, []);
    });

    it("join a exchange inexistente → ack con error", async () => {
      escenario = await crearEscenarioActivo("auth-join-01");
      const { requesterData } = escenario;

      socketRequester = crearSocket(requesterData.token);
      await conectar(socketRequester);

      const ack = await emitirConAck(socketRequester, "chat:join", {
        exchangeId: new mongoose.Types.ObjectId().toString(),
      });

      expect(ack.ok).to.equal(false);
      expect(ack.error).to.be.a("string").and.not.empty;
    });

    it("join sin enviar exchangeId → ack con error", async () => {
      escenario = await crearEscenarioActivo("auth-join-02");
      const { requesterData } = escenario;

      socketRequester = crearSocket(requesterData.token);
      await conectar(socketRequester);

      const ack = await emitirConAck(socketRequester, "chat:join", {});

      expect(ack.ok).to.equal(false);
      expect(ack.error).to.be.a("string").and.not.empty;
    });

    it("join a exchange donde no es participante → ack con error", async () => {
      escenario = await crearEscenarioActivo("auth-join-03");

      const tercero = await registrarUsuario({
        nombre: "Tercero",
        apellido: "ChatTest",
        fechaNacimiento: "2000-01-01",
        email: "tercero.auth@chat.test.com",
        password: "Password123!",
        confirmPassword: "Password123!",
      });

      socketRequester = crearSocket(tercero.token);
      await conectar(socketRequester);

      const ack = await emitirConAck(socketRequester, "chat:join", {
        exchangeId: escenario.exchange._id,
      });

      expect(ack.ok).to.equal(false);
      expect(ack.error).to.be.a("string").and.not.empty;

      await User.deleteOne({ _id: tercero.userId });
    });

    it("join a exchange con status pending → ack con error", async () => {
      escenario = await crearEscenarioActivo("auth-join-04");
      const { requesterData, exchange } = escenario;

      await Exchange.findByIdAndUpdate(exchange._id, { status: "pending" });

      socketRequester = crearSocket(requesterData.token);
      await conectar(socketRequester);

      const ack = await emitirConAck(socketRequester, "chat:join", {
        exchangeId: exchange._id,
      });

      expect(ack.ok).to.equal(false);
      expect(ack.error).to.be.a("string").and.not.empty;
    });

  });

  describe("Autorización — chat:message sin ser participante", () => {

    let escenario;
    let socketTercero;
    let tercero;

    afterEach(async () => {
      socketTercero?.disconnect();
      await limpiarEscenario(escenario ?? {}, []);
      if (tercero?.userId) await User.deleteOne({ _id: tercero.userId });
    });

    it("tercero autenticado envía mensaje a exchange ajeno → ack con error, sin persistir", async () => {
      escenario = await crearEscenarioActivo("auth-msg-01");

      tercero = await registrarUsuario({
        nombre: "Intruso",
        apellido: "ChatTest",
        fechaNacimiento: "2000-01-01",
        email: "intruso.msg@chat.test.com",
        password: "Password123!",
        confirmPassword: "Password123!",
      });

      socketTercero = crearSocket(tercero.token);
      await conectar(socketTercero);

      const ack = await emitirConAck(socketTercero, "chat:message", {
        exchangeId: escenario.exchange._id,
        content:    "Intento de intrusión",
      });

      expect(ack.ok).to.equal(false);
      expect(ack.error).to.be.a("string").and.not.empty;

      const res = await request(app)
        .get(`/api/exchanges/${escenario.exchange._id}/messages`)
        .set("Authorization", `Bearer ${escenario.requesterData.token}`);

      expect(res.body.messages).to.have.lengthOf(0);
    });

  });

});
