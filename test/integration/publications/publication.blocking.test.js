// test/publication.blocking.test.js

"use strict";

require("dotenv").config();

const http             = require("http");
const { io: ioClient } = require("socket.io-client");
const request          = require("supertest");
const { expect }       = require("chai");
const mongoose         = require("mongoose");

const app            = require("../../../src/app");
const { initSocket } = require("../../../src/sockets");
const User           = require("../../../src/models/User");
const Publication    = require("../../../src/models/Publication");
const Exchange       = require("../../../src/models/Exchange");
const Report         = require("../../../src/models/Report");
const { generateAccessToken } = require("../../../src/helpers/generateToken");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const registrarUsuario = async (payload) => {
  const res = await request(app).post("/api/auth/register").send(payload);
  return { token: res.body.accessToken, userId: res.body.user._id };
};

const crearPublicacionPayload = (overrides = {}) => ({
  title:       "Objeto de prueba bloqueo",
  description: "Descripción de prueba para el test de bloqueo",
  history:     "Historia del objeto de prueba",
  category:    "electronica",
  condition:   "bueno",
  type:        "trueque",
  location:    "Buenos Aires",
  photos:      ["https://res.cloudinary.com/test/image/upload/v1/test.jpg"],
  ...overrides,
});

// Arma dos usuarios, dos pubs disponibles, sin crear el exchange todavía
const crearParUsuariosYPublicaciones = async (sufijo) => {
  const requesterData = await registrarUsuario({
    nombre:          "Requester",
    apellido:        "BlockingTest",
    fechaNacimiento: "2000-01-01",
    email:           `requester.${sufijo}@blocking.test.com`,
    password:        "Password123!",
    confirmPassword: "Password123!",
  });

  const ownerData = await registrarUsuario({
    nombre:          "Owner",
    apellido:        "BlockingTest",
    fechaNacimiento: "2000-01-01",
    email:           `owner.${sufijo}@blocking.test.com`,
    password:        "Password123!",
    confirmPassword: "Password123!",
  });

  const pubRequester = await Publication.create({
    ...crearPublicacionPayload({ title: `Pub Requester - ${sufijo}` }),
    owner: requesterData.userId,
  });

  const pubOwner = await Publication.create({
    ...crearPublicacionPayload({ title: `Pub Owner - ${sufijo}` }),
    owner: ownerData.userId,
  });

  return { requesterData, ownerData, pubRequester, pubOwner };
};

// Arma el mismo escenario y además acepta el exchange, dejándolo "active"
const crearEscenarioActivo = async (sufijo) => {
  const { requesterData, ownerData, pubRequester, pubOwner } =
    await crearParUsuariosYPublicaciones(sufijo);

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
  if (escenario.exchange?._id)         await Exchange.deleteOne({ _id: escenario.exchange._id });
  if (escenario.pubRequester?._id)     await Publication.deleteOne({ _id: escenario.pubRequester._id });
  if (escenario.pubOwner?._id)         await Publication.deleteOne({ _id: escenario.pubOwner._id });
  if (escenario.requesterData?.userId) await User.deleteOne({ _id: escenario.requesterData.userId });
  if (escenario.ownerData?.userId)     await User.deleteOne({ _id: escenario.ownerData.userId });
};

const crearSocket = (token, address) =>
  ioClient(address, {
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

async function crearAdminConToken() {
  const user = await User.create({
    nombre: "Admin",
    apellido: "BlockingTest",
    fechaNacimiento: new Date("1990-01-01"),
    email: `admin_${Date.now()}@blocking.test.com`,
    password: "$2b$10$hashedpassword.placeholder.bcrypt.hash.here",
    role: "ADMIN_ROLE",
    isVerified: true,
    isActive: true,
  });
  const token = generateAccessToken(user);
  return { user, token };
}

// ─── Setup global ─────────────────────────────────────────────────────────────

let httpServer;
let serverAddress;

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

// ─── Suite principal ──────────────────────────────────────────────────────────

describe("Bloqueo automático de interacciones — publicación reportada/suspended", () => {

  // ════════════════════════════════════════════════════════════════════════════
  // BLOQUE 1 — Bloqueo de creación de nuevas solicitudes
  // ════════════════════════════════════════════════════════════════════════════

  describe("Bloqueo de creación de solicitudes — publicación suspended", () => {

    let escenario;

    afterEach(async () => {
      await limpiarEscenario(escenario ?? {});
    });

    it("no permite crear una solicitud cuando la publicación solicitada está suspended", async () => {
      escenario = await crearParUsuariosYPublicaciones("block-create-req-01");
      const { requesterData, pubRequester, pubOwner } = escenario;

      await Publication.findByIdAndUpdate(pubOwner._id, { status: "suspended" });

      const res = await request(app)
        .post("/api/exchanges")
        .set("Authorization", `Bearer ${requesterData.token}`)
        .send({
          offeredPublicationId:   pubRequester._id.toString(),
          requestedPublicationId: pubOwner._id.toString(),
        });

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("message", "La publicación no está disponible");
    });

    it("no permite crear una solicitud cuando la publicación ofrecida está suspended", async () => {
      escenario = await crearParUsuariosYPublicaciones("block-create-off-01");
      const { requesterData, pubRequester, pubOwner } = escenario;

      await Publication.findByIdAndUpdate(pubRequester._id, { status: "suspended" });

      const res = await request(app)
        .post("/api/exchanges")
        .set("Authorization", `Bearer ${requesterData.token}`)
        .send({
          offeredPublicationId:   pubRequester._id.toString(),
          requestedPublicationId: pubOwner._id.toString(),
        });

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("message", "Tu publicación no está disponible");
    });

  });

  // ════════════════════════════════════════════════════════════════════════════
  // BLOQUE 2 — Bloqueo de aceptación de solicitudes existentes
  // ════════════════════════════════════════════════════════════════════════════

  describe("Bloqueo de aceptación de solicitudes — publicación suspended", () => {

    let escenario;
    let exchangeId;

    afterEach(async () => {
      await limpiarEscenario(escenario ?? {});
    });

    it("no permite aceptar una solicitud pendiente si la publicación solicitada pasó a suspended", async () => {
      escenario = await crearParUsuariosYPublicaciones("block-accept-01");
      const { requesterData, ownerData, pubRequester, pubOwner } = escenario;

      const envio = await request(app)
        .post("/api/exchanges")
        .set("Authorization", `Bearer ${requesterData.token}`)
        .send({
          offeredPublicationId:   pubRequester._id.toString(),
          requestedPublicationId: pubOwner._id.toString(),
        });

      exchangeId = envio.body._id;
      escenario.exchange = envio.body;

      await Publication.findByIdAndUpdate(pubOwner._id, { status: "suspended" });

      const res = await request(app)
        .patch(`/api/exchanges/${exchangeId}/accept`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      expect(res.status).to.equal(409);
      expect(res.body).to.have.property("message", "La publicación está bloqueada por revisión");

      const exchangeEnDB = await Exchange.findById(exchangeId);
      expect(exchangeEnDB.status).to.equal("pending");
    });

  });

  // ════════════════════════════════════════════════════════════════════════════
  // BLOQUE 3 — Bloqueo de chat por publicación suspendida
  // ════════════════════════════════════════════════════════════════════════════

  describe("Bloqueo de chat — publicación suspended", () => {

    let escenario;
    let socketRequester;

    afterEach(async () => {
      socketRequester?.disconnect();
      await limpiarEscenario(escenario ?? {});
    });

    it("rechaza chat:join si alguna publicación del exchange está suspended", async () => {
      escenario = await crearEscenarioActivo("block-chat-join-01");
      const { requesterData, pubOwner, exchange } = escenario;

      await Publication.findByIdAndUpdate(pubOwner._id, { status: "suspended" });

      socketRequester = crearSocket(requesterData.token, serverAddress);
      await conectar(socketRequester);

      const ackJoin = await emitirConAck(socketRequester, "chat:join", {
        exchangeId: exchange._id,
      });

      expect(ackJoin.ok).to.equal(false,
        "El join debe ser rechazado cuando una publicación del exchange está suspended");
      expect(ackJoin.error).to.equal("La publicación está bloqueada por revisión");
    });

    it("rechaza chat:message si la publicación se suspende después de unirse al chat", async () => {
      escenario = await crearEscenarioActivo("block-chat-msg-01");
      const { requesterData, pubOwner, exchange } = escenario;

      socketRequester = crearSocket(requesterData.token, serverAddress);
      await conectar(socketRequester);

      const ackJoin = await emitirConAck(socketRequester, "chat:join", {
        exchangeId: exchange._id,
      });
      expect(ackJoin.ok).to.equal(true, "El join debe ser exitoso mientras la publicación está available");

      await Publication.findByIdAndUpdate(pubOwner._id, { status: "suspended" });

      const ackMsg = await emitirConAck(socketRequester, "chat:message", {
        exchangeId: exchange._id,
        content:    "Intento de mensaje tras suspensión de la publicación",
      });

      expect(ackMsg.ok).to.equal(false,
        "El servidor debe rechazar mensajes cuando una publicación del exchange está suspended");
      expect(ackMsg.error).to.equal("La publicación está bloqueada por revisión");
    });

  });

  // ════════════════════════════════════════════════════════════════════════════
  // BLOQUE 4 — Flujo completo: reporte → bloqueo → desbloqueo por admin
  // ════════════════════════════════════════════════════════════════════════════

  describe("Flujo completo — reporte → bloqueo → desbloqueo por admin", () => {

    let ownerData;
    let reporterData;
    let publicacion;
    let reporte;
    let adminUser;
    let adminToken;

    afterEach(async () => {
      if (reporte?._id)            await Report.deleteOne({ _id: reporte._id });
      if (publicacion?._id)        await Publication.deleteOne({ _id: publicacion._id });
      if (ownerData?.userId)       await User.deleteOne({ _id: ownerData.userId });
      if (reporterData?.userId)    await User.deleteOne({ _id: reporterData.userId });
      if (adminUser?._id)          await User.deleteOne({ _id: adminUser._id });
      reporte = null;
      publicacion = null;
    });

    it("bloquea solicitudes tras suspender por reporte y las habilita de nuevo tras revertir el admin", async () => {
      ownerData = await registrarUsuario({
        nombre:          "Owner",
        apellido:        "FlowTest",
        fechaNacimiento: "2000-01-01",
        email:           "owner.flow-01@blocking.test.com",
        password:        "Password123!",
        confirmPassword: "Password123!",
      });

      reporterData = await registrarUsuario({
        nombre:          "Reporter",
        apellido:        "FlowTest",
        fechaNacimiento: "2000-01-01",
        email:           "reporter.flow-01@blocking.test.com",
        password:        "Password123!",
        confirmPassword: "Password123!",
      });

      publicacion = await Publication.create({
        ...crearPublicacionPayload({ title: "Pub Flow - block-flow-01", type: "venta" }),
        owner: ownerData.userId,
      });

      ({ user: adminUser, token: adminToken } = await crearAdminConToken());

      // 1. Reporter reporta la publicación
      const resReport = await request(app)
        .post(`/api/publications/${publicacion._id}/report`)
        .set("Authorization", `Bearer ${reporterData.token}`)
        .send({ reason: "objeto_falso" });

      expect(resReport.status).to.equal(201);

      reporte = await Report.findOne({ publicationId: publicacion._id });
      expect(reporte).to.not.be.null;

      // 2. Admin resuelve el reporte suspendiendo la publicación
      const resResolve = await request(app)
        .patch(`/api/admin/reports/${reporte._id}/resolve`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ action: "suspend_publication" });

      expect(resResolve.status).to.equal(200);
      expect(resResolve.body).to.have.property("status", "reviewed");

      const pubSuspendida = await Publication.findById(publicacion._id);
      expect(pubSuspendida.status).to.equal("suspended");

      // 3. Con la publicación suspendida, una solicitud sobre ella debe rechazarse
      const resSolicitudBloqueada = await request(app)
        .post("/api/exchanges")
        .set("Authorization", `Bearer ${reporterData.token}`)
        .send({ requestedPublicationId: publicacion._id.toString(), type: "purchase" });

      expect(resSolicitudBloqueada.status).to.equal(400);
      expect(resSolicitudBloqueada.body).to.have.property("message", "La publicación no está disponible");

      // 4. Admin revierte el bloqueo
      const resRevert = await request(app)
        .patch(`/api/admin/publications/${publicacion._id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "available" });

      expect(resRevert.status).to.equal(200);
      expect(resRevert.body).to.have.property("status", "available");

      // 5. Tras revertir, la solicitud vuelve a ser posible
      const resSolicitudOk = await request(app)
        .post("/api/exchanges")
        .set("Authorization", `Bearer ${reporterData.token}`)
        .send({ requestedPublicationId: publicacion._id.toString(), type: "purchase" });

      expect(resSolicitudOk.status).to.equal(201);

      await Exchange.deleteOne({ _id: resSolicitudOk.body._id });
    });

    it("un usuario no admin no puede revertir el bloqueo de una publicación", async () => {
      ownerData = await registrarUsuario({
        nombre:          "Owner",
        apellido:        "FlowTest",
        fechaNacimiento: "2000-01-01",
        email:           "owner.flow-02@blocking.test.com",
        password:        "Password123!",
        confirmPassword: "Password123!",
      });

      reporterData = await registrarUsuario({
        nombre:          "Reporter",
        apellido:        "FlowTest",
        fechaNacimiento: "2000-01-01",
        email:           "reporter.flow-02@blocking.test.com",
        password:        "Password123!",
        confirmPassword: "Password123!",
      });

      publicacion = await Publication.create({
        ...crearPublicacionPayload({ title: "Pub Flow - block-flow-02", status: "suspended" }),
        owner: ownerData.userId,
      });

      const res = await request(app)
        .patch(`/api/admin/publications/${publicacion._id}/status`)
        .set("Authorization", `Bearer ${reporterData.token}`)
        .send({ status: "available" });

      expect(res.status).to.equal(403);

      const pubEnDB = await Publication.findById(publicacion._id);
      expect(pubEnDB.status).to.equal("suspended");
    });

  });

});
