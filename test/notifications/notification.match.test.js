const { expect } = require("chai");
const mongoose = require("mongoose");
const User = require("../../src/models/User");
const Publication = require("../../src/models/Publication");
const ActiveSearch = require("../../src/models/ActiveSearch");
const Notification = require("../../src/models/Notification");
const notificationService = require("../../src/services/notificationService");

const crearUsuario = (overrides = {}) =>
  User.create({
    nombre: "Notification",
    apellido: "Test",
    fechaNacimiento: new Date("1994-05-10"),
    email: `notification_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`,
    password: "$2b$10$hashedpassword.placeholder.bcrypt.hash.here",
    role: "USER_ROLE",
    isVerified: true,
    isActive: true,
    ...overrides,
  });

const crearPublicacion = (ownerId, overrides = {}) =>
  Publication.create({
    title: "Nintendo Switch OLED",
    description: "Consola en excelente estado con dock y joycons.",
    history: "La use durante viajes cortos y ahora quiero cambiarla.",
    category: "electronica",
    condition: "como_nuevo",
    type: "venta",
    photos: ["https://res.cloudinary.com/demo/image/upload/foto1.jpg"],
    status: "available",
    owner: ownerId,
    ...overrides,
  });

describe("Notification matching service", function () {
  this.timeout(30000);

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  afterEach(async () => {
    await Notification.deleteMany({});
    await ActiveSearch.deleteMany({});
    await Publication.deleteMany({});
    await User.deleteMany({});
  });

  after(async () => {
    await mongoose.disconnect();
  });

  it("crea una notificacion cuando una publicacion coincide con una busqueda activa", async () => {
    const interestedUser = await crearUsuario();
    const owner = await crearUsuario();

    const activeSearch = await ActiveSearch.create({
      user: interestedUser._id,
      category: "electronica",
      keywords: ["switch", "nintendo"],
      type: "venta",
      isActive: true,
    });

    const publication = await crearPublicacion(owner._id);

    const notifications = await notificationService.processPublicationMatches(publication);

    expect(notifications).to.have.length(1);
    expect(notifications[0].user.toString()).to.equal(interestedUser._id.toString());
    expect(notifications[0].activeSearch.toString()).to.equal(activeSearch._id.toString());
    expect(notifications[0].publication.toString()).to.equal(publication._id.toString());
    expect(notifications[0].metadata).to.include({
      publicationTitle: "Nintendo Switch OLED",
      publicationCategory: "electronica",
      publicationType: "venta",
      publicationPhoto: "https://res.cloudinary.com/demo/image/upload/foto1.jpg",
      publicationOwnerName: "Notification Test",
    });

    const saved = await Notification.find({});
    expect(saved).to.have.length(1);
    expect(saved[0].type).to.equal("active_search_match");
  });

  it("no crea notificacion si solo coincide la categoria pero no las palabras clave", async () => {
    const interestedUser = await crearUsuario();
    const owner = await crearUsuario();

    await ActiveSearch.create({
      user: interestedUser._id,
      category: "electronica",
      keywords: ["playstation"],
      type: "venta",
      isActive: true,
    });

    const publication = await crearPublicacion(owner._id);

    const notifications = await notificationService.processPublicationMatches(publication);

    expect(notifications).to.have.length(0);
    expect(await Notification.countDocuments({})).to.equal(0);
  });

  it("tambien matchea cuando la palabra clave aparece solo en history", async () => {
    const interestedUser = await crearUsuario();
    const owner = await crearUsuario();

    await ActiveSearch.create({
      user: interestedUser._id,
      category: "electronica",
      keywords: ["viajes"],
      type: "venta",
      isActive: true,
    });

    const publication = await crearPublicacion(owner._id, {
      title: "Consola impecable",
      description: "Muy cuidada y completa.",
      history: "La use principalmente durante viajes largos y ahora quiero venderla.",
    });

    const notifications = await notificationService.processPublicationMatches(publication);

    expect(notifications).to.have.length(1);
    expect(await Notification.countDocuments({})).to.equal(1);
  });

  it("no crea notificacion para el owner de su propia publicacion", async () => {
    const owner = await crearUsuario();

    await ActiveSearch.create({
      user: owner._id,
      category: "electronica",
      keywords: ["switch"],
      type: "venta",
      isActive: true,
    });

    const publication = await crearPublicacion(owner._id);

    const notifications = await notificationService.processPublicationMatches(publication);

    expect(notifications).to.have.length(0);
    expect(await Notification.countDocuments({})).to.equal(0);
  });

  it("ignora duplicados si el matching corre mas de una vez para la misma publicacion", async () => {
    const interestedUser = await crearUsuario();
    const owner = await crearUsuario();

    await ActiveSearch.create({
      user: interestedUser._id,
      category: "electronica",
      keywords: ["switch"],
      type: "venta",
      isActive: true,
    });

    const publication = await crearPublicacion(owner._id);

    await notificationService.processPublicationMatches(publication);
    const secondRun = await notificationService.processPublicationMatches(publication);

    expect(secondRun).to.have.length(0);
    expect(await Notification.countDocuments({})).to.equal(1);
  });
});
