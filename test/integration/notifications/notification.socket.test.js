"use strict";

const http = require("http");
const { io: ioClient } = require("socket.io-client");
const request = require("supertest");
const { expect } = require("chai");
const mongoose = require("mongoose");

const app = require("../../../src/app");
const { initSocket } = require("../../../src/sockets");
const User = require("../../../src/models/User");
const Publication = require("../../../src/models/Publication");
const ActiveSearch = require("../../../src/models/ActiveSearch");
const Notification = require("../../../src/models/Notification");
const Exchange = require("../../../src/models/Exchange");

let httpServer;
let serverAddress;

const registrarUsuario = async (payload) => {
  const res = await request(app).post("/api/auth/register").send(payload);
  return { token: res.body.accessToken, userId: res.body.user._id };
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

describe("Notification Socket", function () {
  this.timeout(30000);

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

  afterEach(async () => {
    await Notification.deleteMany({});
    await Exchange.deleteMany({});
    await ActiveSearch.deleteMany({});
    await Publication.deleteMany({});
    await User.deleteMany({ email: /notification\.socket\.test\.com$/ });
  });

  it("emite notification:new al usuario conectado cuando aparece una coincidencia", async () => {
    const interestedUser = await registrarUsuario({
      nombre: "Ana",
      apellido: "Match",
      fechaNacimiento: "2000-01-01",
      email: "ana@notification.socket.test.com",
      password: "Password123!",
      confirmPassword: "Password123!",
    });

    const owner = await registrarUsuario({
      nombre: "Bruno",
      apellido: "Owner",
      fechaNacimiento: "2000-01-01",
      email: "bruno@notification.socket.test.com",
      password: "Password123!",
      confirmPassword: "Password123!",
    });

    await ActiveSearch.create({
      user: interestedUser.userId,
      category: "electronica",
      keywords: ["switch"],
      type: "venta",
      isActive: true,
    });

    const socket = crearSocket(interestedUser.token);
    await conectar(socket);

    const notificationReceived = new Promise((resolve) => {
      socket.once("notification:new", resolve);
    });

    const createPublicationResponse = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        title: "Nintendo Switch OLED",
        description: "Consola con dock y accesorios.",
        history: "La use durante viajes y sigue impecable.",
        category: "electronica",
        condition: "como_nuevo",
        type: "venta",
        photos: ["https://res.cloudinary.com/demo/image/upload/foto1.jpg"],
      });

    expect(createPublicationResponse.status).to.equal(201);

    const payload = await notificationReceived;
    expect(payload.type).to.equal("active_search_match");
    expect(payload.title).to.equal("Nueva coincidencia para tu búsqueda");
    expect(payload.metadata).to.include({
      publicationTitle: "Nintendo Switch OLED",
      publicationCategory: "electronica",
      publicationType: "venta",
      publicationPhoto: "https://res.cloudinary.com/demo/image/upload/foto1.jpg",
      publicationOwnerName: "Bruno Owner",
    });

    socket.disconnect();
  });

  it("emite notification:new al owner conectado cuando recibe una solicitud", async () => {
    const owner = await registrarUsuario({
      nombre: "Carla",
      apellido: "Owner",
      fechaNacimiento: "2000-01-01",
      email: "carla@notification.socket.test.com",
      password: "Password123!",
      confirmPassword: "Password123!",
    });

    const requester = await registrarUsuario({
      nombre: "Diego",
      apellido: "Requester",
      fechaNacimiento: "2000-01-01",
      email: "diego@notification.socket.test.com",
      password: "Password123!",
      confirmPassword: "Password123!",
    });

    const pubOwner = await Publication.create({
      title: "Camara analogica",
      description: "Objeto de prueba para notificaciones de exchange.",
      history: "La use poco y la quiero intercambiar.",
      category: "electronica",
      condition: "bueno",
      type: "trueque",
      photos: ["https://res.cloudinary.com/demo/image/upload/foto4.jpg"],
      status: "available",
      owner: owner.userId,
    });

    const pubRequester = await Publication.create({
      title: "Joystick retro",
      description: "Objeto de prueba ofrecido por el requester.",
      history: "Lo tengo repetido.",
      category: "electronica",
      condition: "bueno",
      type: "trueque",
      photos: ["https://res.cloudinary.com/demo/image/upload/foto5.jpg"],
      status: "available",
      owner: requester.userId,
    });

    const socket = crearSocket(owner.token);
    await conectar(socket);

    const notificationReceived = new Promise((resolve) => {
      socket.once("notification:new", resolve);
    });

    const createExchangeResponse = await request(app)
      .post("/api/exchanges")
      .set("Authorization", `Bearer ${requester.token}`)
      .send({
        offeredPublicationId: pubRequester._id.toString(),
        requestedPublicationId: pubOwner._id.toString(),
      });

    expect(createExchangeResponse.status).to.equal(201);

    const payload = await notificationReceived;
    expect(payload.type).to.equal("exchange_request_received");
    expect(payload.title).to.equal("Recibiste una nueva solicitud");
    expect(payload.metadata).to.include({
      publicationTitle: "Camara analogica",
      publicationCategory: "electronica",
      publicationType: "trueque",
      publicationPhoto: "https://res.cloudinary.com/demo/image/upload/foto4.jpg",
      requesterName: "Diego Requester",
    });

    socket.disconnect();
  });
});
