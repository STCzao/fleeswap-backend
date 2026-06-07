const request = require("supertest");
const { expect } = require("chai");
const mongoose = require("mongoose");
const app = require("../../src/app");
const User = require("../../src/models/User");
const Notification = require("../../src/models/Notification");
const ActiveSearch = require("../../src/models/ActiveSearch");
const Publication = require("../../src/models/Publication");
const { generateAccessToken } = require("../../src/helpers/generateToken");

const crearUsuarioConToken = async (overrides = {}) => {
  const user = await User.create({
    nombre: "Notifications",
    apellido: "ApiTest",
    fechaNacimiento: new Date("1992-04-18"),
    email: `notifications_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`,
    password: "$2b$10$hashedpassword.placeholder.bcrypt.hash.here",
    role: "USER_ROLE",
    isVerified: true,
    isActive: true,
    ...overrides,
  });

  return {
    user,
    token: generateAccessToken(user),
  };
};

const crearDependencias = async (ownerId, interestedUserId) => {
  const publication = await Publication.create({
    title: "Nintendo Switch OLED",
    description: "Consola con dock y accesorios.",
    history: "La use poco y ahora quiero venderla.",
    category: "electronica",
    condition: "como_nuevo",
    type: "venta",
    photos: ["https://res.cloudinary.com/demo/image/upload/foto1.jpg"],
    status: "available",
    owner: ownerId,
  });

  const activeSearch = await ActiveSearch.create({
    user: interestedUserId,
    category: "electronica",
    keywords: ["switch"],
    type: "venta",
    isActive: true,
  });

  return { publication, activeSearch };
};

const crearNotificacion = async (userId, publication, activeSearch, overrides = {}) =>
  Notification.create({
    user: userId,
    type: "active_search_match",
    title: "Nueva coincidencia para tu busqueda",
    message: `Se publico "${publication.title}" y coincide con uno de tus criterios activos.`,
    isRead: false,
    dedupeKey: `active_search_match:${activeSearch._id}:${publication._id}:${Math.random().toString(36).slice(2)}`,
    publication: publication._id,
    activeSearch: activeSearch._id,
    exchange: null,
    metadata: {
      publicationTitle: publication.title,
      publicationPhoto: publication.photos[0],
      publicationCategory: publication.category,
      publicationType: publication.type,
      publicationOwnerId: publication.owner,
      publicationOwnerName: "Owner Test",
      exchangeType: null,
      requesterId: null,
      requesterName: null,
    },
    ...overrides,
  });

describe("Notifications API", function () {
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

  describe("GET /api/notifications", () => {
    it("lista notificaciones ordenadas por fecha descendente e incluye unreadCount", async () => {
      const { user, token } = await crearUsuarioConToken();
      const { user: owner } = await crearUsuarioConToken();
      const { publication, activeSearch } = await crearDependencias(owner._id, user._id);

      const olderNotification = await crearNotificacion(user._id, publication, activeSearch, {
        createdAt: new Date("2026-06-01T10:00:00.000Z"),
        updatedAt: new Date("2026-06-01T10:00:00.000Z"),
      });
      const newerNotification = await crearNotificacion(user._id, publication, activeSearch, {
        publication: (await Publication.create({
          title: "Mario Kart",
          description: "Juego impecable.",
          history: "Lo tengo repetido.",
          category: "electronica",
          condition: "bueno",
          type: "venta",
          photos: ["https://res.cloudinary.com/demo/image/upload/foto2.jpg"],
          status: "available",
          owner: owner._id,
        }))._id,
        activeSearch: (await ActiveSearch.create({
          user: user._id,
          category: "electronica",
          keywords: ["mario"],
          type: "venta",
          isActive: true,
        }))._id,
        metadata: {
          publicationTitle: "Mario Kart",
          publicationPhoto: "https://res.cloudinary.com/demo/image/upload/foto2.jpg",
          publicationCategory: "electronica",
          publicationType: "venta",
          publicationOwnerId: owner._id,
          publicationOwnerName: "Owner Test",
        },
        createdAt: new Date("2026-06-02T10:00:00.000Z"),
        updatedAt: new Date("2026-06-02T10:00:00.000Z"),
      });

      const res = await request(app)
        .get("/api/notifications")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).to.equal(200);
      expect(res.body.unreadCount).to.equal(2);
      expect(res.body.notifications).to.have.length(2);
      expect(res.body.notifications[0]._id).to.equal(newerNotification._id.toString());
      expect(res.body.notifications[1]._id).to.equal(olderNotification._id.toString());
      expect(res.body.pagination.total).to.equal(2);
    });
  });

  describe("PATCH /api/notifications/:id/read", () => {
    it("marca una notificacion propia como leida", async () => {
      const { user, token } = await crearUsuarioConToken();
      const { user: owner } = await crearUsuarioConToken();
      const { publication, activeSearch } = await crearDependencias(owner._id, user._id);
      const notification = await crearNotificacion(user._id, publication, activeSearch);

      const res = await request(app)
        .patch(`/api/notifications/${notification._id}/read`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).to.equal(200);
      expect(res.body.isRead).to.equal(true);

      const saved = await Notification.findById(notification._id);
      expect(saved.isRead).to.equal(true);
    });

    it("rechaza marcar como leida una notificacion ajena", async () => {
      const { user } = await crearUsuarioConToken();
      const { user: otherUser, token: otherToken } = await crearUsuarioConToken();
      const { user: owner } = await crearUsuarioConToken();
      const { publication, activeSearch } = await crearDependencias(owner._id, user._id);
      const notification = await crearNotificacion(user._id, publication, activeSearch);

      const res = await request(app)
        .patch(`/api/notifications/${notification._id}/read`)
        .set("Authorization", `Bearer ${otherToken}`);

      expect(res.status).to.equal(403);
      expect(res.body.message).to.equal("No autorizado");
    });
  });

  describe("PATCH /api/notifications/read-all", () => {
    it("marca todas las notificaciones no leidas del usuario autenticado", async () => {
      const { user, token } = await crearUsuarioConToken();
      const { user: owner } = await crearUsuarioConToken();
      const { publication, activeSearch } = await crearDependencias(owner._id, user._id);

      await crearNotificacion(user._id, publication, activeSearch, { isRead: false });
      await crearNotificacion(user._id, publication, activeSearch, {
        publication: (await Publication.create({
          title: "Xbox Series S",
          description: "Consola compacta.",
          history: "La use poco.",
          category: "electronica",
          condition: "bueno",
          type: "venta",
          photos: ["https://res.cloudinary.com/demo/image/upload/foto3.jpg"],
          status: "available",
          owner: owner._id,
        }))._id,
        activeSearch: (await ActiveSearch.create({
          user: user._id,
          category: "electronica",
          keywords: ["xbox"],
          type: "venta",
          isActive: true,
        }))._id,
        metadata: {
          publicationTitle: "Xbox Series S",
          publicationPhoto: "https://res.cloudinary.com/demo/image/upload/foto3.jpg",
          publicationCategory: "electronica",
          publicationType: "venta",
          publicationOwnerId: owner._id,
          publicationOwnerName: "Owner Test",
        },
        isRead: false,
      });

      const res = await request(app)
        .patch("/api/notifications/read-all")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).to.equal(200);
      expect(res.body.message).to.equal("Notificaciones marcadas como leidas");
      expect(res.body.modifiedCount).to.equal(2);

      const unreadCount = await Notification.countDocuments({ user: user._id, isRead: false });
      expect(unreadCount).to.equal(0);
    });
  });
});
