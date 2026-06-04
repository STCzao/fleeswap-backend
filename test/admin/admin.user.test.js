// test/admin.user.test.js

const request  = require("supertest");
const { expect } = require("chai");
const mongoose  = require("mongoose");
const app       = require("../../src/app");
const User      = require("../../src/models/User");
const Publication = require("../../src/models/Publication");
const { generateAccessToken } = require("../../src/helpers/generateToken");

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Crea un usuario directamente en la DB y devuelve el documento + JWT.
 * No pasa por la API de registro para no depender de email ni verificación.
 */
async function crearUsuarioConToken(overrides = {}) {
  const user = await User.create({
    nombre: "Admin",
    apellido: "Test",
    fechaNacimiento: new Date("1990-01-01"),
    email: `admin_${Date.now()}_${Math.random().toString(36).slice(2)}@usertest.com`,
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
    title: "Publicacion de prueba",
    description: "Descripcion de prueba para testing.",
    history: "Historia de prueba para testing.",
    category: "electronica",
    condition: "nuevo",
    type: "venta",
    photos: ["https://res.cloudinary.com/demo/image/upload/foto1.jpg"],
    status: "available",
    owner: ownerId,
    ...overrides,
  });
}

// ─── Suite principal ──────────────────────────────────────────────────────────

describe("Admin Users API", () => {

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  after(async () => {
    await mongoose.disconnect();
  });

  // ─── GET /api/admin/users/:id ─────────────────────────────────────────────

  describe("GET /api/admin/users/:id", () => {

    let adminUser, adminToken, targetUser;

    beforeEach(async () => {
      ({ user: adminUser, token: adminToken } = await crearUsuarioConToken());

      // Usuario objetivo: lo creamos con USER_ROLE para tener un target distinto al admin
      ({ user: targetUser } = await crearUsuarioConToken({
        role: "USER_ROLE",
        nombre: "Target",
        apellido: "Usuario",
      }));
    });

    afterEach(async () => {
      await User.deleteOne({ _id: adminUser._id });
      await User.deleteOne({ _id: targetUser._id });
    });

    // U01 ─────────────────────────────────────────────────────────────────────
    it("U01 — admin obtiene usuario existente → 200 con campos esperados", async () => {
      const res = await request(app)
        .get(`/api/admin/users/${targetUser._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).to.equal(200);

      // Campos que el repositorio selecciona explícitamente
      expect(res.body).to.have.property("_id");
      expect(res.body).to.have.property("nombre").that.equals("Target");
      expect(res.body).to.have.property("apellido").that.equals("Usuario");
      expect(res.body).to.have.property("email").that.is.a("string");
      expect(res.body).to.have.property("role").that.equals("USER_ROLE");
      expect(res.body).to.have.property("isActive").that.equals(true);
      expect(res.body).to.have.property("isVerified").that.equals(true);
      expect(res.body).to.have.property("createdAt").that.is.a("string");

      // El campo password NUNCA debe exponerse (select: false en el modelo)
      expect(res.body).to.not.have.property("password");
    });

    // U02 ─────────────────────────────────────────────────────────────────────
    it("U02 — ID válido pero inexistente → 404", async () => {
      const idInexistente = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/api/admin/users/${idInexistente}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).to.equal(404);
      expect(res.body).to.have.property("message").that.is.a("string");
    });

    // U03 ─────────────────────────────────────────────────────────────────────
    it("U03 — ID con formato inválido → 400 del validador", async () => {
      const res = await request(app)
        .get("/api/admin/users/no-es-un-mongo-id")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("errors").that.is.an("array");
      expect(res.body.errors[0]).to.have.property("field").that.equals("id");
      expect(res.body.errors[0]).to.have.property("message").that.is.a("string");
    });

    // U04 ─────────────────────────────────────────────────────────────────────
    it("U04 — sin token → 401", async () => {
      const res = await request(app)
        .get(`/api/admin/users/${targetUser._id}`);
        // Sin .set("Authorization", ...)

      expect(res.status).to.equal(401);
      expect(res.body).to.have.property("message");
    });

    // U05 ─────────────────────────────────────────────────────────────────────
    it("U05 — USER_ROLE con token válido → 403", async () => {
      // Creamos un usuario regular y usamos SU token para el request
      const { user: userRegular, token: userToken } = await crearUsuarioConToken({
        role: "USER_ROLE",
      });

      const res = await request(app)
        .get(`/api/admin/users/${targetUser._id}`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).to.equal(403);
      expect(res.body).to.have.property("message");

      // Limpieza del usuario extra creado solo para este test
      await User.deleteOne({ _id: userRegular._id });
    });

  }); // fin describe GET /api/admin/users/:id

    // ─── PATCH /api/admin/users/:id/status ───────────────────────────────────

  describe("PATCH /api/admin/users/:id/status", () => {

    let adminUser, adminToken, targetUser, pubAvailableId, pubUnavailableId;

    beforeEach(async () => {
      ({ user: adminUser, token: adminToken } = await crearUsuarioConToken());

      // Usuario objetivo sobre el que vamos a operar
      ({ user: targetUser } = await crearUsuarioConToken({
        role: "USER_ROLE",
        nombre: "Target",
        apellido: "Status",
      }));

      // Publicación "available" del targetUser — debe suspenderse al suspender al usuario
      const pubAvailable = await crearPublicacion(targetUser._id, {
        title: "Pub disponible",
        status: "available",
      });
      pubAvailableId = pubAvailable._id;

      // Publicación "unavailable" del targetUser — NO debe tocarse
      const pubUnavailable = await crearPublicacion(targetUser._id, {
        title: "Pub no disponible",
        status: "unavailable",
      });
      pubUnavailableId = pubUnavailable._id;
    });

    afterEach(async () => {
      await Publication.deleteOne({ _id: pubAvailableId });
      await Publication.deleteOne({ _id: pubUnavailableId });
      await User.deleteOne({ _id: targetUser._id });
      await User.deleteOne({ _id: adminUser._id });
    });

    // U06 ─────────────────────────────────────────────────────────────────────
    it("U06 — admin suspende usuario activo → 200 con isActive false", async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${targetUser._id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("isActive").that.equals(false);
      expect(res.body._id.toString()).to.equal(targetUser._id.toString());
    });

    // U07 ─────────────────────────────────────────────────────────────────────
    it("U07 — suspender usuario suspende sus publicaciones 'available' en la DB", async () => {
      await request(app)
        .patch(`/api/admin/users/${targetUser._id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: false });

      // Verificación directa en DB — no confiamos solo en el response HTTP
      const pubEnDB = await Publication.findById(pubAvailableId).lean();
      expect(pubEnDB).to.not.be.null;
      expect(pubEnDB.status).to.equal("suspended");
    });

    // U08 ─────────────────────────────────────────────────────────────────────
    it("U08 — suspender usuario NO modifica publicaciones 'unavailable'", async () => {
      await request(app)
        .patch(`/api/admin/users/${targetUser._id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: false });

      // La pub unavailable debe seguir siendo unavailable, no suspended
      const pubEnDB = await Publication.findById(pubUnavailableId).lean();
      expect(pubEnDB).to.not.be.null;
      expect(pubEnDB.status).to.equal("unavailable");
    });

    // U09 ─────────────────────────────────────────────────────────────────────
    it("U09 — admin reactiva usuario suspendido → 200 con isActive true", async () => {
      // Primero suspendemos directamente en DB para preparar el estado inicial
      await User.findOneAndUpdate(
        { _id: targetUser._id },
        { isActive: false, deletedAt: new Date() },
      );

      const res = await request(app)
        .patch(`/api/admin/users/${targetUser._id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: true });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("isActive").that.equals(true);
    });

    // U10 ─────────────────────────────────────────────────────────────────────
    it("U10 — admin intenta suspenderse a sí mismo → 400", async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${adminUser._id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("message").that.is.a("string");
    });

    // U11 ─────────────────────────────────────────────────────────────────────
    it("U11 — ID inexistente → 404", async () => {
      const idInexistente = new mongoose.Types.ObjectId();

      const res = await request(app)
        .patch(`/api/admin/users/${idInexistente}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.status).to.equal(404);
      expect(res.body).to.have.property("message").that.is.a("string");
    });

    // U12 ─────────────────────────────────────────────────────────────────────
    it("U12 — body inválido (isActive no booleano) → 400 del validador", async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${targetUser._id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: "si_activo" });

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("errors").that.is.an("array");
      expect(res.body.errors[0]).to.have.property("field").that.equals("isActive");
      expect(res.body.errors[0]).to.have.property("message").that.is.a("string");
    });

  }); // fin describe PATCH status

    // ─── PATCH /api/admin/users/:id/role ─────────────────────────────────────

  describe("PATCH /api/admin/users/:id/role", () => {

    let adminUser, adminToken, targetUser;

    beforeEach(async () => {
      ({ user: adminUser, token: adminToken } = await crearUsuarioConToken());

      // Target con USER_ROLE — sobre él vamos a cambiar el rol
      ({ user: targetUser } = await crearUsuarioConToken({
        role: "USER_ROLE",
        nombre: "Target",
        apellido: "Role",
      }));
    });

    afterEach(async () => {
      await User.deleteOne({ _id: targetUser._id });
      await User.deleteOne({ _id: adminUser._id });
    });

    // U13 ─────────────────────────────────────────────────────────────────────
    it("U13 — admin promueve USER_ROLE a ADMIN_ROLE → 200 con rol actualizado", async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${targetUser._id}/role`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ role: "ADMIN_ROLE" });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("role").that.equals("ADMIN_ROLE");
      expect(res.body._id.toString()).to.equal(targetUser._id.toString());

      // Confirmamos en DB que el cambio persistió
      const userEnDB = await User.findOne({ _id: targetUser._id, isActive: { $exists: true } }).lean();
      expect(userEnDB.role).to.equal("ADMIN_ROLE");
    });

    // U14 ─────────────────────────────────────────────────────────────────────
    it("U14 — admin degrada ADMIN_ROLE a USER_ROLE → 200 con rol actualizado", async () => {
      // Preparamos el target como ADMIN_ROLE directamente en DB
      await User.findOneAndUpdate(
        { _id: targetUser._id },
        { role: "ADMIN_ROLE" },
      );

      const res = await request(app)
        .patch(`/api/admin/users/${targetUser._id}/role`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ role: "USER_ROLE" });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("role").that.equals("USER_ROLE");

      // Confirmamos en DB
      const userEnDB = await User.findOne({ _id: targetUser._id, isActive: { $exists: true } }).lean();
      expect(userEnDB.role).to.equal("USER_ROLE");
    });

    // U15 ─────────────────────────────────────────────────────────────────────
    it("U15 — admin intenta cambiarse su propio rol → 400", async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${adminUser._id}/role`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ role: "USER_ROLE" });

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("message").that.is.a("string");

      // El rol del admin NO debe haber cambiado en DB
      const adminEnDB = await User.findOne({ _id: adminUser._id, isActive: { $exists: true } }).lean();
      expect(adminEnDB.role).to.equal("ADMIN_ROLE");
    });

    // U16 ─────────────────────────────────────────────────────────────────────
    it("U16 — ID inexistente → 404", async () => {
      const idInexistente = new mongoose.Types.ObjectId();

      const res = await request(app)
        .patch(`/api/admin/users/${idInexistente}/role`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ role: "ADMIN_ROLE" });

      expect(res.status).to.equal(404);
      expect(res.body).to.have.property("message").that.is.a("string");
    });

    // U17 ─────────────────────────────────────────────────────────────────────
    it("U17 — rol inválido en body → 400 del validador", async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${targetUser._id}/role`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ role: "SUPERADMIN_ROLE" });

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("errors").that.is.an("array");
      expect(res.body.errors[0]).to.have.property("field").that.equals("role");
      expect(res.body.errors[0]).to.have.property("message").that.is.a("string");
    });

  }); // fin describe PATCH role


}); // fin suite principal
