// test/chat.readonly.test.js

"use strict";

const http             = require("http");
const { io: ioClient } = require("socket.io-client");
const request          = require("supertest");
const { expect }       = require("chai");
const mongoose         = require("mongoose");

const app            = require("../../src/app");
const { initSocket } = require("../../src/sockets");
const User           = require("../../src/models/User");
const Publication    = require("../../src/models/Publication");
const Exchange       = require("../../src/models/Exchange");
const Message        = require("../../src/models/Message");

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

// Arma dos usuarios, dos pubs, y un exchange en estado "active"
const crearEscenarioActivo = async (sufijo) => {
  const requesterData = await registrarUsuario({
    nombre:          "Requester",
    apellido:        "ReadonlyTest",
    fechaNacimiento: "2000-01-01",
    email:           `requester.${sufijo}@readonly.test.com`,
    password:        "Password123!",
    confirmPassword: "Password123!",
  });

  const ownerData = await registrarUsuario({
    nombre:          "Owner",
    apellido:        "ReadonlyTest",
    fechaNacimiento: "2000-01-01",
    email:           `owner.${sufijo}@readonly.test.com`,
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

// ─── Setup global ─────────────────────────────────────────────────────────────

let httpServer;
let serverAddress;

// ─── Suite principal ──────────────────────────────────────────────────────────

describe("Chat — Modo Solo Lectura (readonly)", () => {

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

  // ════════════════════════════════════════════════════════════════════════════
  // TEST 1 — chat:message rechazado si exchange está en "cancelled"
  // ════════════════════════════════════════════════════════════════════════════

  describe("Bloqueo automático — exchange cancelled", () => {

    let escenario;
    let socketRequester;
    const mensajeIds = [];

    afterEach(async () => {
      socketRequester?.disconnect();
      await limpiarEscenario(escenario ?? {}, mensajeIds);
    });

    it("no permite enviar un mensaje si el exchange fue cancelado", async () => {
      // 1. Armar escenario con exchange en "active"
      escenario = await crearEscenarioActivo("ro-cancel-01");
      const { requesterData, exchange } = escenario;

      // 2. Conectar socket y unirse al chat (mientras aún está active)
      socketRequester = crearSocket(requesterData.token, serverAddress);
      await conectar(socketRequester);

      const ackJoin = await emitirConAck(socketRequester, "chat:join", {
        exchangeId: exchange._id,
      });
      expect(ackJoin.ok).to.equal(true, "El join debe ser exitoso mientras el exchange está active");

      // 3. Cancelar el exchange directamente en la BD (simula cancelación de la otra parte)
      await Exchange.findByIdAndUpdate(exchange._id, { status: "cancelled" });

      // 4. Intentar enviar un mensaje con el exchange ya cancelado
      const ackMsg = await emitirConAck(socketRequester, "chat:message", {
        exchangeId: exchange._id,
        content:    "Intento de mensaje post-cancelación",
      });

      // 5. El servidor debe rechazarlo
      expect(ackMsg.ok).to.equal(false,
        "El servidor debe rechazar mensajes cuando el exchange está cancelled");
      expect(ackMsg.error).to.be.a("string").and.have.length.greaterThan(0,
        "El ACK debe incluir un mensaje de error descriptivo");
    });

  });

  // ════════════════════════════════════════════════════════════════════════════
  // TEST 2 — chat:message rechazado si exchange está en "completed"
  // ════════════════════════════════════════════════════════════════════════════

  describe("Bloqueo automático — exchange completed", () => {

    let escenario;
    let socketRequester;
    const mensajeIds = [];

    afterEach(async () => {
      socketRequester?.disconnect();
      await limpiarEscenario(escenario ?? {}, mensajeIds);
    });

    it("no permite enviar un mensaje si el exchange fue completado", async () => {
      // 1. Armar escenario con exchange en "active"
      escenario = await crearEscenarioActivo("ro-completed-01");
      const { requesterData, exchange } = escenario;

      // 2. Conectar socket y unirse al chat mientras aún está active
      socketRequester = crearSocket(requesterData.token, serverAddress);
      await conectar(socketRequester);

      const ackJoin = await emitirConAck(socketRequester, "chat:join", {
        exchangeId: exchange._id,
      });
      expect(ackJoin.ok).to.equal(true, "El join debe ser exitoso mientras el exchange está active");

      // 3. Marcar el exchange como completed directamente en la BD
      //    (simula que ambas partes confirmaron el intercambio)
      await Exchange.findByIdAndUpdate(exchange._id, { status: "completed" });

      // 4. Intentar enviar un mensaje con el exchange ya completado
      const ackMsg = await emitirConAck(socketRequester, "chat:message", {
        exchangeId: exchange._id,
        content:    "Intento de mensaje post-completado",
      });

      // 5. El servidor debe rechazarlo con el mismo criterio que cancelled
      expect(ackMsg.ok).to.equal(false,
        "El servidor debe rechazar mensajes cuando el exchange está completed");
      expect(ackMsg.error).to.be.a("string").and.have.length.greaterThan(0,
        "El ACK debe incluir un mensaje de error descriptivo");
    });

  });

  // ════════════════════════════════════════════════════════════════════════════
  // TEST 3a — chat:join rechazado si exchange ya está en "cancelled"
  // ════════════════════════════════════════════════════════════════════════════

  describe("Bloqueo de acceso — chat:join rechazado con exchange cancelled", () => {

    let escenario;
    let socketRequester;

    afterEach(async () => {
      socketRequester?.disconnect();
      await limpiarEscenario(escenario ?? {});
    });

    it("no permite unirse al chat si el exchange ya estaba cancelado al conectarse", async () => {
      // 1. Escenario con exchange en "active"
      escenario = await crearEscenarioActivo("ro-join-cancel-01");
      const { requesterData, exchange } = escenario;

      // 2. Cancelar el exchange ANTES de que el usuario intente unirse
      await Exchange.findByIdAndUpdate(exchange._id, { status: "cancelled" });

      // 3. Conectar el socket (la conexión WebSocket en sí es válida —
      //    la auth JWT pasa— pero el JOIN al chat debe fallar)
      socketRequester = crearSocket(requesterData.token, serverAddress);
      await conectar(socketRequester);

      // 4. Intentar hacer join con el exchange ya cancelado
      const ackJoin = await emitirConAck(socketRequester, "chat:join", {
        exchangeId: exchange._id,
      });

      // 5. El servidor debe rechazar el join
      expect(ackJoin.ok).to.equal(false,
        "El join debe ser rechazado cuando el exchange ya está cancelled");
      expect(ackJoin.error).to.be.a("string").and.have.length.greaterThan(0,
        "El ACK de rechazo debe incluir un mensaje de error");
    });

  });

  // ════════════════════════════════════════════════════════════════════════════
  // TEST 3b — chat:join rechazado si exchange ya está en "completed"
  // ════════════════════════════════════════════════════════════════════════════

  describe("Bloqueo de acceso — chat:join rechazado con exchange completed", () => {

    let escenario;
    let socketRequester;

    afterEach(async () => {
      socketRequester?.disconnect();
      await limpiarEscenario(escenario ?? {});
    });

    it("no permite unirse al chat si el exchange ya estaba completado al conectarse", async () => {
      // 1. Escenario con exchange en "active"
      escenario = await crearEscenarioActivo("ro-join-completed-01");
      const { requesterData, exchange } = escenario;

      // 2. Completar el exchange ANTES de que el usuario intente unirse
      await Exchange.findByIdAndUpdate(exchange._id, { status: "completed" });

      // 3. Conectar el socket — la auth JWT sigue siendo válida
      socketRequester = crearSocket(requesterData.token, serverAddress);
      await conectar(socketRequester);

      // 4. Intentar hacer join con el exchange ya completado
      const ackJoin = await emitirConAck(socketRequester, "chat:join", {
        exchangeId: exchange._id,
      });

      // 5. El servidor debe rechazar el join
      expect(ackJoin.ok).to.equal(false,
        "El join debe ser rechazado cuando el exchange ya está completed");
      expect(ackJoin.error).to.be.a("string").and.have.length.greaterThan(0,
        "El ACK de rechazo debe incluir un mensaje de error");
    });

  });

  // ════════════════════════════════════════════════════════════════════════════
  // TEST 4 — Historial disponible vía HTTP con exchange "completed"
  // ════════════════════════════════════════════════════════════════════════════

  describe("Historial — exchange completed: acceso HTTP al historial", () => {

    let escenario;
    let terceroData;
    let pubTercero;
    let mensajeId;

    afterEach(async () => {
      if (mensajeId)         await Message.deleteOne({ _id: mensajeId });
      if (pubTercero?._id)   await Publication.deleteOne({ _id: pubTercero._id });
      if (terceroData?.userId) await User.deleteOne({ _id: terceroData.userId });
      await limpiarEscenario(escenario ?? {});
    });

    it("devuelve 200 con exchangeStatus 'completed' y los mensajes previos al cierre", async () => {
      // 1. Escenario con exchange en "active"
      escenario = await crearEscenarioActivo("ro-hist-comp-01");
      const { requesterData, ownerData, exchange } = escenario;

      // 2. Crear un mensaje en la BD directamente (sin socket)
      //    para tener historial previo al cierre
      const mensaje = await Message.create({
        exchangeId: exchange._id,
        senderId:   requesterData.userId,
        content:    "Mensaje enviado antes de que se completara el intercambio",
      });
      mensajeId = mensaje._id;

      // 3. Transicionar el exchange a "completed"
      await Exchange.findByIdAndUpdate(exchange._id, { status: "completed" });

      // 4. Requester consulta el historial — debe ser accesible
      const resRequester = await request(app)
        .get(`/api/exchanges/${exchange._id}/messages`)
        .set("Authorization", `Bearer ${requesterData.token}`);

      expect(resRequester.status).to.equal(200,
        "El requester debe poder leer el historial de un exchange completed");
      expect(resRequester.body).to.have.property("exchangeStatus", "completed",
        "La respuesta debe informar el estado actual del exchange");
      expect(resRequester.body).to.have.property("messages").that.is.an("array"),
      expect(resRequester.body.messages.map((m) => m._id.toString()))
        .to.include(mensajeId.toString(),
          "El mensaje creado antes del cierre debe aparecer en el historial");

      // 5. Owner también puede consultar el historial
      const resOwner = await request(app)
        .get(`/api/exchanges/${exchange._id}/messages`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      expect(resOwner.status).to.equal(200,
        "El owner también debe poder leer el historial de un exchange completed");
      expect(resOwner.body).to.have.property("exchangeStatus", "completed");
    });

    it("devuelve 403 si un tercero intenta leer el historial de un exchange completed", async () => {
      // 1. Escenario base
      escenario = await crearEscenarioActivo("ro-hist-comp-02");
      const { exchange } = escenario;

      // 2. Registrar un usuario que NO participa en el exchange
      terceroData = await registrarUsuario({
        nombre:          "Tercero",
        apellido:        "Intruso",
        fechaNacimiento: "2000-01-01",
        email:           "tercero.hist.comp@readonly.test.com",
        password:        "Password123!",
        confirmPassword: "Password123!",
      });

      pubTercero = await Publication.create({
        ...crearPublicacion({ title: "Pub Tercero - hist-comp-02" }),
        owner: terceroData.userId,
      });

      // 3. Completar el exchange
      await Exchange.findByIdAndUpdate(exchange._id, { status: "completed" });

      // 4. El tercero intenta leer — debe recibir 403
      const res = await request(app)
        .get(`/api/exchanges/${exchange._id}/messages`)
        .set("Authorization", `Bearer ${terceroData.token}`);

      expect(res.status).to.equal(403,
        "Un usuario ajeno al exchange no debe poder leer el historial aunque el exchange esté completed");
    });

  });

  // ════════════════════════════════════════════════════════════════════════════
  // TEST 5 — Historial disponible vía HTTP con exchange "cancelled"
  // ════════════════════════════════════════════════════════════════════════════

  describe("Historial — exchange cancelled: acceso HTTP al historial", () => {

    let escenarioCancelled;
    let escenarioPending;
    let mensajeIdCancelled;

    afterEach(async () => {
      if (mensajeIdCancelled) await Message.deleteOne({ _id: mensajeIdCancelled });
      await limpiarEscenario(escenarioCancelled ?? {});
      await limpiarEscenario(escenarioPending ?? {});
      mensajeIdCancelled = null;
      escenarioCancelled = null;
      escenarioPending   = null;
    });

    it("devuelve 200 con exchangeStatus 'cancelled' y los mensajes previos a la cancelación", async () => {
      // 1. Escenario con exchange en "active"
      escenarioCancelled = await crearEscenarioActivo("ro-hist-canc-01");
      const { requesterData, ownerData, exchange } = escenarioCancelled;

      // 2. Insertar un mensaje en la BD antes de cancelar
      const mensaje = await Message.create({
        exchangeId: exchange._id,
        senderId:   ownerData.userId,
        content:    "Último mensaje antes de que se cancelara el intercambio",
      });
      mensajeIdCancelled = mensaje._id;

      // 3. Transicionar a "cancelled"
      await Exchange.findByIdAndUpdate(exchange._id, { status: "cancelled" });

      // 4. Requester consulta el historial
      const resRequester = await request(app)
        .get(`/api/exchanges/${exchange._id}/messages`)
        .set("Authorization", `Bearer ${requesterData.token}`);

      expect(resRequester.status).to.equal(200,
        "El requester debe poder leer el historial de un exchange cancelled");
      expect(resRequester.body).to.have.property("exchangeStatus", "cancelled",
        "La respuesta debe informar que el exchange está cancelled");
      expect(resRequester.body.messages.map((m) => m._id.toString()))
        .to.include(mensajeIdCancelled.toString(),
          "El mensaje creado antes de la cancelación debe seguir en el historial");

      // 5. Owner también puede consultar el historial
      const resOwner = await request(app)
        .get(`/api/exchanges/${exchange._id}/messages`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      expect(resOwner.status).to.equal(200,
        "El owner también debe poder leer el historial de un exchange cancelled");
      expect(resOwner.body).to.have.property("exchangeStatus", "cancelled");
    });

    it("devuelve 403 si el exchange está en 'pending' (nunca fue aceptado)", async () => {
      // 1. Crear dos usuarios y dos publicaciones
      escenarioPending = await registrarUsuario({
        nombre:          "Requester",
        apellido:        "PendingTest",
        fechaNacimiento: "2000-01-01",
        email:           "requester.pending.hist@readonly.test.com",
        password:        "Password123!",
        confirmPassword: "Password123!",
      });

      const ownerPending = await registrarUsuario({
        nombre:          "Owner",
        apellido:        "PendingTest",
        fechaNacimiento: "2000-01-01",
        email:           "owner.pending.hist@readonly.test.com",
        password:        "Password123!",
        confirmPassword: "Password123!",
      });

      const pubReq = await Publication.create({
        ...crearPublicacion({ title: "Pub Req Pending" }),
        owner: escenarioPending.userId,
      });

      const pubOwn = await Publication.create({
        ...crearPublicacion({ title: "Pub Own Pending" }),
        owner: ownerPending.userId,
      });

      // 2. Crear el exchange pero NO aceptarlo — queda en "pending"
      const envio = await request(app)
        .post("/api/exchanges")
        .set("Authorization", `Bearer ${escenarioPending.token}`)
        .send({
          offeredPublicationId:   pubReq._id.toString(),
          requestedPublicationId: pubOwn._id.toString(),
        });

      // Guardamos en escenarioPending para el cleanup
      escenarioPending = {
        exchange:      envio.body,
        pubRequester:  pubReq,
        pubOwner:      pubOwn,
        requesterData: escenarioPending,
        ownerData:     ownerPending,
      };

      // 3. Requester intenta leer mensajes de un exchange en "pending"
      const res = await request(app)
        .get(`/api/exchanges/${envio.body._id}/messages`)
        .set("Authorization", `Bearer ${escenarioPending.requesterData.token}`);

      expect(res.status).to.equal(403,
        "Un exchange en estado 'pending' no debe permitir leer el historial");
    });

  });

  // ════════════════════════════════════════════════════════════════════════════
  // TEST 6a — chat:readonly emitido al cancelar un exchange activo vía API
  // ════════════════════════════════════════════════════════════════════════════

  describe("Evento en tiempo real — chat:readonly al cancelar exchange activo", () => {

    let escenario;
    let socketRequester;

    afterEach(async () => {
      socketRequester?.disconnect();
      await limpiarEscenario(escenario ?? {});
    });

    it("el cliente conectado al chat recibe chat:readonly con reason 'cancelled' cuando el owner cancela", async () => {
      // 1. Escenario con exchange en "active"
      escenario = await crearEscenarioActivo("ro-evt-cancel-01");
      const { requesterData, ownerData, exchange } = escenario;

      // 2. Requester se conecta y se une al chat
      socketRequester = crearSocket(requesterData.token, serverAddress);
      await conectar(socketRequester);

      const ackJoin = await emitirConAck(socketRequester, "chat:join", {
        exchangeId: exchange._id,
      });
      expect(ackJoin.ok).to.equal(true, "Precondición: join exitoso antes de la cancelación");

      // 3. Preparar la escucha del evento ANTES de disparar la acción
      //    (evita race condition donde el evento llega antes de registrar el listener)
      const readonlyPromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error("Timeout: chat:readonly no fue recibido en 3000ms"));
        }, 3000);

        socketRequester.once("chat:readonly", (payload) => {
          clearTimeout(timer);
          resolve(payload);
        });
      });

      // 4. Owner cancela el exchange vía API
      const resCancelacion = await request(app)
        .patch(`/api/exchanges/${exchange._id}/cancel`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      expect(resCancelacion.status).to.equal(200,
        "La cancelación vía API debe ser exitosa");

      // 5. Esperar y verificar el evento recibido por el socket
      const payload = await readonlyPromise;

      expect(payload).to.have.property("exchangeId", exchange._id.toString(),
        "El payload debe identificar el exchange cancelado");
      expect(payload).to.have.property("reason", "cancelled",
        "El reason debe ser 'cancelled'");
    });

  });

  // ════════════════════════════════════════════════════════════════════════════
  // TEST 6b — NO se emite chat:readonly al cancelar un exchange en "pending"
  // ════════════════════════════════════════════════════════════════════════════

  describe("Evento en tiempo real — sin chat:readonly al cancelar exchange pendiente", () => {

    let escenario;
    let socketRequester;

    afterEach(async () => {
      socketRequester?.disconnect();
      await limpiarEscenario(escenario ?? {});
    });

    it("cancelar un exchange en 'pending' no emite chat:readonly (no hubo chat activo)", async () => {
      // 1. Crear escenario activo y luego volver al estado pending
      //    Para tener un exchange en pending sin pasar por active,
      //    creamos un nuevo par de usuarios con un exchange sin aceptar
      const requesterData = await registrarUsuario({
        nombre:          "Requester",
        apellido:        "PendingCancel",
        fechaNacimiento: "2000-01-01",
        email:           "req.pending.cancel@readonly.test.com",
        password:        "Password123!",
        confirmPassword: "Password123!",
      });

      const ownerData = await registrarUsuario({
        nombre:          "Owner",
        apellido:        "PendingCancel",
        fechaNacimiento: "2000-01-01",
        email:           "own.pending.cancel@readonly.test.com",
        password:        "Password123!",
        confirmPassword: "Password123!",
      });

      const pubReq = await Publication.create({
        ...crearPublicacion({ title: "Pub Req PendingCancel" }),
        owner: requesterData.userId,
      });

      const pubOwn = await Publication.create({
        ...crearPublicacion({ title: "Pub Own PendingCancel" }),
        owner: ownerData.userId,
      });

      const envio = await request(app)
        .post("/api/exchanges")
        .set("Authorization", `Bearer ${requesterData.token}`)
        .send({
          offeredPublicationId:   pubReq._id.toString(),
          requestedPublicationId: pubOwn._id.toString(),
        });

      // Guardamos en escenario para el cleanup
      escenario = {
        exchange:      envio.body,
        pubRequester:  pubReq,
        pubOwner:      pubOwn,
        requesterData,
        ownerData,
      };

      // 2. Conectar socket (sin hacer join porque el exchange está pending
      //    y el join sería rechazado)
      socketRequester = crearSocket(requesterData.token, serverAddress);
      await conectar(socketRequester);

      // 3. Registrar si llega algún chat:readonly (no debería)
      let readonlyRecibido = false;
      socketRequester.on("chat:readonly", () => {
        readonlyRecibido = true;
      });

      // 4. Requester cancela su propia solicitud (retira la propuesta)
      const resCancelacion = await request(app)
        .patch(`/api/exchanges/${envio.body._id}/cancel`)
        .set("Authorization", `Bearer ${requesterData.token}`);

      expect(resCancelacion.status).to.equal(200,
        "El requester puede retirar su propia propuesta pendiente");

      // 5. Esperar un momento corto para detectar si el evento llega de todas formas
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(readonlyRecibido).to.equal(false,
        "No debe emitirse chat:readonly cuando se cancela un exchange en estado pending");
    });

  });

  // ════════════════════════════════════════════════════════════════════════════
  // TEST 6c — chat:readonly emitido al completar exchange vía doble confirmación
  // ════════════════════════════════════════════════════════════════════════════

  describe("Evento en tiempo real — chat:readonly al completar exchange", () => {

    let escenario;
    let socketRequester;

    afterEach(async () => {
      socketRequester?.disconnect();
      await limpiarEscenario(escenario ?? {});
    });

    it("el cliente recibe chat:readonly con reason 'completed' cuando ambas partes confirman", async () => {
      // 1. Escenario con exchange en "active"
      escenario = await crearEscenarioActivo("ro-evt-completed-01");
      const { requesterData, ownerData, exchange } = escenario;

      // 2. Requester se conecta y se une al chat
      socketRequester = crearSocket(requesterData.token, serverAddress);
      await conectar(socketRequester);

      const ackJoin = await emitirConAck(socketRequester, "chat:join", {
        exchangeId: exchange._id,
      });
      expect(ackJoin.ok).to.equal(true, "Precondición: join exitoso antes de las confirmaciones");

      // 3. Preparar la escucha del evento ANTES de las confirmaciones
      const readonlyPromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error("Timeout: chat:readonly no fue recibido en 3000ms"));
        }, 3000);

        socketRequester.once("chat:readonly", (payload) => {
          clearTimeout(timer);
          resolve(payload);
        });
      });

      // 4. Primera confirmación: requester confirma
      const resConfirm1 = await request(app)
        .patch(`/api/exchanges/${exchange._id}/confirm`)
        .set("Authorization", `Bearer ${requesterData.token}`);

      expect(resConfirm1.status).to.equal(200, "Primera confirmación debe ser exitosa");
      // Con una sola confirmación el exchange sigue "active" — no debe emitirse el evento aún
      
      // 5. Segunda confirmación: owner confirma — esto dispara el completed y el evento
      const resConfirm2 = await request(app)
        .patch(`/api/exchanges/${exchange._id}/confirm`)
        .set("Authorization", `Bearer ${ownerData.token}`);

      expect(resConfirm2.status).to.equal(200, "Segunda confirmación debe ser exitosa");
      expect(resConfirm2.body).to.have.property("status", "completed",
        "Tras ambas confirmaciones el exchange debe estar completed");

      // 6. Esperar y verificar el evento
      const payload = await readonlyPromise;

      expect(payload).to.have.property("exchangeId", exchange._id.toString(),
        "El payload debe identificar el exchange completado");
      expect(payload).to.have.property("reason", "completed",
        "El reason debe ser 'completed'");
    });

  });


});
