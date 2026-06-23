const request = require("supertest");
const { expect } = require("chai");
const mongoose = require("mongoose");
const app = require("../../../src/app");
const User = require("../../../src/models/User");
const Publication = require("../../../src/models/Publication");
const Exchange = require("../../../src/models/Exchange");
const Notification = require("../../../src/models/Notification");

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

const crearEscenario = async (suffix) => {
  const owner = await registrarUsuario({
    nombre: "Owner",
    apellido: "NotifyTest",
    fechaNacimiento: "2000-01-01",
    email: `owner.${suffix}@notify.test.com`,
    password: "Password123!",
    confirmPassword: "Password123!",
  });

  const requester = await registrarUsuario({
    nombre: "Requester",
    apellido: "NotifyTest",
    fechaNacimiento: "2000-01-01",
    email: `requester.${suffix}@notify.test.com`,
    password: "Password123!",
    confirmPassword: "Password123!",
  });

  const pubOwner = await Publication.create({
    ...crearPublicacion({ title: `Pub Owner - ${suffix}` }),
    owner: owner.userId,
  });

  const pubRequester = await Publication.create({
    ...crearPublicacion({ title: `Pub Requester - ${suffix}` }),
    owner: requester.userId,
  });

  return { owner, requester, pubOwner, pubRequester };
};

describe("Exchange notification integration", function () {
  this.timeout(30000);

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  afterEach(async () => {
    await Notification.deleteMany({});
    await Exchange.deleteMany({});
    await Publication.deleteMany({});
    await User.deleteMany({});
  });

  after(async () => {
    await mongoose.disconnect();
  });

  it("crea una notificación para el owner cuando recibe una solicitud", async () => {
    const { owner, requester, pubOwner, pubRequester } = await crearEscenario("received");

    const res = await request(app)
      .post("/api/exchanges")
      .set("Authorization", `Bearer ${requester.token}`)
      .send({
        offeredPublicationId: pubRequester._id.toString(),
        requestedPublicationId: pubOwner._id.toString(),
      });

    expect(res.status).to.equal(201);

    const notification = await Notification.findOne({
      user: owner.userId,
      type: "exchange_request_received",
    });

    expect(notification).to.exist;
    expect(notification.exchange.toString()).to.equal(res.body._id);
    expect(notification.metadata.requesterName).to.equal("Requester NotifyTest");
  });

  it("crea una notificación para el requester cuando aceptan su solicitud", async () => {
    const { owner, requester, pubOwner, pubRequester } = await crearEscenario("accepted");

    const envio = await request(app)
      .post("/api/exchanges")
      .set("Authorization", `Bearer ${requester.token}`)
      .send({
        offeredPublicationId: pubRequester._id.toString(),
        requestedPublicationId: pubOwner._id.toString(),
      });

    const res = await request(app)
      .patch(`/api/exchanges/${envio.body._id}/accept`)
      .set("Authorization", `Bearer ${owner.token}`);

    expect(res.status).to.equal(200);

    const notification = await Notification.findOne({
      user: requester.userId,
      type: "exchange_request_accepted",
    });

    expect(notification).to.exist;
    expect(notification.exchange.toString()).to.equal(envio.body._id);
    expect(notification.metadata.publicationOwnerName).to.equal("Owner NotifyTest");
  });

  it("crea una notificación para el requester cuando rechazan su solicitud", async () => {
    const { owner, requester, pubOwner, pubRequester } = await crearEscenario("rejected");

    const envio = await request(app)
      .post("/api/exchanges")
      .set("Authorization", `Bearer ${requester.token}`)
      .send({
        offeredPublicationId: pubRequester._id.toString(),
        requestedPublicationId: pubOwner._id.toString(),
      });

    const res = await request(app)
      .patch(`/api/exchanges/${envio.body._id}/reject`)
      .set("Authorization", `Bearer ${owner.token}`);

    expect(res.status).to.equal(200);

    const notification = await Notification.findOne({
      user: requester.userId,
      type: "exchange_request_rejected",
    });

    expect(notification).to.exist;
    expect(notification.exchange.toString()).to.equal(envio.body._id);
    expect(notification.metadata.publicationOwnerName).to.equal("Owner NotifyTest");
  });
});
