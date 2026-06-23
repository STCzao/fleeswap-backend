// test/admin.publications.test.js

const request  = require("supertest");
const { expect } = require("chai");
const mongoose = require("mongoose");
const app      = require("../../../src/app");
const User     = require("../../../src/models/User");
const Publication = require("../../../src/models/Publication");
const Report   = require("../../../src/models/Report");
const { generateAccessToken } = require("../../../src/helpers/generateToken");

// ─── Helpers ────────────────────────────────────────────────────────────────

const FOTOS_MOCK = [
  "https://res.cloudinary.com/demo/image/upload/foto1.jpg",
];

/**
 * Crea un usuario directamente en la DB (sin pasar por la API de registro
 * para no depender de emails ni lógica de verificación) y devuelve
 * el documento + un JWT firmado.
 */
async function crearUsuarioConToken(overrides = {}) {
  const user = await User.create({
    nombre: "Admin",
    apellido: "Test",
    fechaNacimiento: new Date("1990-01-01"),
    email: `admin_${Date.now()}@admintest.com`,
    password: "$2b$10$hashedpassword.placeholder.bcrypt.hash.here",
    role: "ADMIN_ROLE",
    isVerified: true,
    isActive: true,
    ...overrides,
  });
  const token = generateAccessToken(user);
  return { user, token };
}

/**
 * Crea una publicación directamente en la DB asociada a un owner.
 */
async function crearPublicacion(ownerId, overrides = {}) {
  return Publication.create({
    title: "Publicación de prueba",
    description: "Descripción de prueba para testing de admin.",
    history: "Historia de prueba para testing de moderación.",
    category: "electronica",
    condition: "nuevo",
    type: "venta",
    photos: FOTOS_MOCK,
    status: "available",
    owner: ownerId,
    ...overrides,
  });
}

// ─── Suite principal ─────────────────────────────────────────────────────────

describe("Admin Publications API", () => {

  // IDs de recursos creados — se limpian en afterEach de cada describe
  let adminUser, adminToken;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  after(async () => {
    await mongoose.disconnect();
  });

    // ─── GET /api/admin/publications ─────────────────────────────────────────

  describe("GET /api/admin/publications", () => {

    let pub1Id, pub2Id, pub3Id;

    beforeEach(async () => {
      ({ user: adminUser, token: adminToken } = await crearUsuarioConToken());

      // pub1: available + electronica
      const pub1 = await crearPublicacion(adminUser._id, {
        title: "Pub Alpha",
        status: "available",
        category: "electronica",
      });
      // pub2: suspended + electronica
      const pub2 = await crearPublicacion(adminUser._id, {
        title: "Pub Beta",
        status: "suspended",
        category: "electronica",
      });
      // pub3: available + libros_comics  ← categoría diferente
      const pub3 = await crearPublicacion(adminUser._id, {
        title: "Pub Gamma",
        status: "available",
        category: "libros_comics",
      });

      pub1Id = pub1._id;
      pub2Id = pub2._id;
      pub3Id = pub3._id;
    });

    afterEach(async () => {
      await Publication.deleteOne({ _id: pub1Id });
      await Publication.deleteOne({ _id: pub2Id });
      await Publication.deleteOne({ _id: pub3Id });
      await User.deleteOne({ _id: adminUser._id });
    });

    // P01 ─────────────────────────────────────────────────────────────────────
    it("P01 — admin lista publicaciones → 200 con estructura paginada correcta", async () => {
      const res = await request(app)
        .get("/api/admin/publications")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("publicaciones").that.is.an("array");
      expect(res.body).to.have.property("total").that.is.a("number");
      expect(res.body).to.have.property("pagina").that.is.a("number");
      expect(res.body).to.have.property("totalPaginas").that.is.a("number");
      expect(res.body.total).to.be.at.least(3);
      expect(res.body.pagina).to.equal(1);
    });

    // P02 ─────────────────────────────────────────────────────────────────────
    it("P02 — filtro status=suspended → solo devuelve publicaciones suspendidas", async () => {
      const res = await request(app)
        .get("/api/admin/publications")
        .query({ status: "suspended" })
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.publicaciones).to.be.an("array");

      // Todas las publicaciones retornadas deben tener status "suspended"
      res.body.publicaciones.forEach((pub) => {
        expect(pub.status).to.equal("suspended");
      });

      // La pub2 (suspended) debe aparecer; la pub1 y pub3 (available) no deben
      const titles = res.body.publicaciones.map((p) => p.title);
      expect(titles).to.include("Pub Beta");
      expect(titles).to.not.include("Pub Alpha");
      expect(titles).to.not.include("Pub Gamma");
    });

    // P03 ─────────────────────────────────────────────────────────────────────
    it("P03 — filtro category=libros_comics → solo devuelve esa categoría", async () => {
      const res = await request(app)
        .get("/api/admin/publications")
        .query({ category: "libros_comics" })
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.publicaciones).to.be.an("array");

      // Todas las publicaciones retornadas deben ser de esa categoría
      res.body.publicaciones.forEach((pub) => {
        expect(pub.category).to.equal("libros_comics");
      });

      // pub3 (libros_comics) debe aparecer; pub1 y pub2 (electronica) no
      const titles = res.body.publicaciones.map((p) => p.title);
      expect(titles).to.include("Pub Gamma");
      expect(titles).to.not.include("Pub Alpha");
      expect(titles).to.not.include("Pub Beta");
    });

  }); // fin describe GET

    // ─── Permisos ─────────────────────────────────────────────────────────────

  describe("Permisos en rutas de admin publications", () => {

    let userRegular, userToken;

    beforeEach(async () => {
      // Usuario con rol USER_ROLE (no admin)
      userRegular = await User.create({
        nombre: "Usuario",
        apellido: "Regular",
        fechaNacimiento: new Date("1995-05-05"),
        email: `user_regular_${Date.now()}@admintest.com`,
        password: "$2b$10$hashedpassword.placeholder.bcrypt.hash.here",
        role: "USER_ROLE",
        isVerified: true,
        isActive: true,
      });
      userToken = generateAccessToken(userRegular);
    });

    afterEach(async () => {
      await User.deleteOne({ _id: userRegular._id });
    });

    // P04 ─────────────────────────────────────────────────────────────────────
    it("P04 — sin token → 401 en GET /api/admin/publications", async () => {
      const res = await request(app)
        .get("/api/admin/publications");
        // Sin .set("Authorization", ...)

      expect(res.status).to.equal(401);
      expect(res.body).to.have.property("message");
    });

    // P05 ─────────────────────────────────────────────────────────────────────
    it("P05 — USER_ROLE con token válido → 403 en GET /api/admin/publications", async () => {
      const res = await request(app)
        .get("/api/admin/publications")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).to.equal(403);
      expect(res.body).to.have.property("message");
    });

  }); // fin describe Permisos

    // ─── PATCH /api/admin/publications/:id/status ─────────────────────────────

  describe("PATCH /api/admin/publications/:id/status", () => {

    let adminUser, adminToken, pubId;

    beforeEach(async () => {
      ({ user: adminUser, token: adminToken } = await crearUsuarioConToken());

      const pub = await crearPublicacion(adminUser._id, {
        title: "Pub para suspender",
        status: "available",
        category: "electronica",
      });
      pubId = pub._id;
    });

    afterEach(async () => {
      await Publication.deleteOne({ _id: pubId });
      await User.deleteOne({ _id: adminUser._id });
    });

    // P06 ─────────────────────────────────────────────────────────────────────
    it("P06 — admin suspende publicación existente → 200 con status actualizado", async () => {
      const res = await request(app)
        .patch(`/api/admin/publications/${pubId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "suspended" });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("status").that.equals("suspended");
      expect(res.body._id.toString()).to.equal(pubId.toString());
    });

    // P07 ─────────────────────────────────────────────────────────────────────
    it("P07 — ID inexistente → 404", async () => {
      const idInexistente = new mongoose.Types.ObjectId();

      const res = await request(app)
        .patch(`/api/admin/publications/${idInexistente}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "suspended" });

      expect(res.status).to.equal(404);
      expect(res.body).to.have.property("message");
    });

    // P08 ─────────────────────────────────────────────────────────────────────
    it("P08 — status inválido en body → 400 del validador", async () => {
      const res = await request(app)
        .patch(`/api/admin/publications/${pubId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "borrado_total" });

      expect(res.status).to.equal(400);

      // validarCampos responde con { errors: [{ field, message }] }
      expect(res.body).to.have.property("errors").that.is.an("array");
      expect(res.body.errors[0]).to.have.property("field").that.equals("status");
      expect(res.body.errors[0]).to.have.property("message").that.is.a("string");
    });

  }); // fin describe PATCH status

    // ─── DELETE /api/admin/publications/:id ──────────────────────────────────

  describe("DELETE /api/admin/publications/:id", () => {

    let adminUser, adminToken, pubId, reporteId;

    beforeEach(async () => {
      ({ user: adminUser, token: adminToken } = await crearUsuarioConToken());

      // Creamos un usuario extra para que sea el reporter
      const reporter = await User.create({
        nombre: "Reporter",
        apellido: "Test",
        fechaNacimiento: new Date("1995-05-05"),
        email: `reporter_${Date.now()}@admintest.com`,
        password: "$2b$10$hashedpassword.placeholder.bcrypt.hash.here",
        role: "USER_ROLE",
        isVerified: true,
        isActive: true,
      });

      const pub = await crearPublicacion(adminUser._id, {
        title: "Pub a eliminar",
        status: "available",
      });
      pubId = pub._id;

      // Creamos un reporte asociado a esa publicación
      const reporte = await Report.create({
        publicationId: pubId,
        reporterId: reporter._id,
        reason: "spam",
        status: "pending",
      });
      reporteId = reporte._id;

      // Limpiamos el reporter acá mismo ya que no necesitamos su ID luego
      await User.deleteOne({ _id: reporter._id });
    });

    afterEach(async () => {
      // Limpieza defensiva: si el test falló antes del DELETE, los documentos
      // pueden seguir en la DB. deleteOne sobre un ID inexistente no lanza error.
      await Publication.deleteOne({ _id: pubId });
      await Report.deleteOne({ _id: reporteId });
      await User.deleteOne({ _id: adminUser._id });
    });

    // P09 ─────────────────────────────────────────────────────────────────────
    it("P09 — admin elimina publicación → 204, pub y reportes eliminados de la DB", async () => {
      const res = await request(app)
        .delete(`/api/admin/publications/${pubId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).to.equal(204);
      expect(res.body).to.deep.equal({});

      // Verificación directa en DB: la publicación ya no debe existir
      const pubEnDB = await Publication.findById(pubId);
      expect(pubEnDB).to.be.null;

      // Verificación directa en DB: el reporte asociado también debe haberse eliminado
      const reporteEnDB = await Report.findById(reporteId);
      expect(reporteEnDB).to.be.null;
    });

    // P10 ─────────────────────────────────────────────────────────────────────
    it("P10 — ID inexistente → 404", async () => {
      const idInexistente = new mongoose.Types.ObjectId();

      const res = await request(app)
        .delete(`/api/admin/publications/${idInexistente}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).to.equal(404);
      expect(res.body).to.have.property("message");
    });

  }); // fin describe DELETE


}); // fin suite principal
