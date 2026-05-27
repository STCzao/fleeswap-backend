// test/profile.publications.test.js

const request    = require("supertest");
const { expect } = require("chai");
const mongoose   = require("mongoose");
const app        = require("../src/app");
const User        = require("../src/models/User");
const Publication = require("../src/models/Publication");
const { generateAccessToken } = require("../src/helpers/generateToken");

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function crearUsuarioConToken(overrides = {}) {
  const user = await User.create({
    nombre: "Profile",
    apellido: "Test",
    fechaNacimiento: new Date("1995-06-15"),
    email: `profile_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`,
    password: "$2b$10$hashedpassword.placeholder.bcrypt.hash.here",
    role: "USER_ROLE",
    isVerified: true,
    isActive: true,
    ...overrides,
  });
  const token = generateAccessToken(user);
  return { user, token };
}

async function crearPublicacion(ownerId, overrides = {}) {
  return Publication.create({
    title: "Objeto de prueba",
    description: "Descripción válida para testing de perfil.",
    history: "Historia válida del objeto para testing.",
    category: "electronica",
    condition: "bueno",
    type: "trueque",
    photos: ["https://res.cloudinary.com/demo/image/upload/foto1.jpg"],
    status: "available",
    owner: ownerId,
    ...overrides,
  });
}

// ─── Suite principal ──────────────────────────────────────────────────────────

describe("Profile Publications API", () => {

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  after(async () => {
    await mongoose.disconnect();
  });

  // ─── GET /api/users/me/publications ──────────────────────────────────────

  describe("GET /api/users/me/publications — Mis publicaciones", () => {

    let usuarioA, tokenA, pubA1, pubA2;
    let usuarioB, tokenB, pubB1;

    beforeEach(async () => {
      ({ user: usuarioA, token: tokenA } = await crearUsuarioConToken());
      pubA1 = await crearPublicacion(usuarioA._id, { title: "Pub A1 - Guitarra" });
      pubA2 = await crearPublicacion(usuarioA._id, { title: "Pub A2 - Teclado" });

      ({ user: usuarioB, token: tokenB } = await crearUsuarioConToken());
      pubB1 = await crearPublicacion(usuarioB._id, { title: "Pub B1 - Batería" });
    });

    afterEach(async () => {
      await Publication.deleteOne({ _id: pubA1._id });
      await Publication.deleteOne({ _id: pubA2._id });
      await Publication.deleteOne({ _id: pubB1._id });
      await User.deleteOne({ _id: usuarioA._id });
      await User.deleteOne({ _id: usuarioB._id });
    });

    // ── H01 ──────────────────────────────────────────────────────────────────
    it("H01 — usuario A solo ve sus propias publicaciones, no las de usuario B", async () => {
      const res = await request(app)
        .get("/api/users/me/publications")
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).to.equal(200);
      expect(res.body).to.be.an("array");

      const ids = res.body.map((p) => p._id.toString());
      expect(ids).to.include(pubA1._id.toString());
      expect(ids).to.include(pubA2._id.toString());
      expect(ids).to.not.include(pubB1._id.toString());
    });

    // ── H02 ──────────────────────────────────────────────────────────────────
    it("H02 — usuario sin publicaciones recibe array vacío [], no null ni error", async () => {
      const { user: usuarioC, token: tokenC } = await crearUsuarioConToken();

      const res = await request(app)
        .get("/api/users/me/publications")
        .set("Authorization", `Bearer ${tokenC}`);

      expect(res.status).to.equal(200);
      expect(res.body).to.be.an("array");
      expect(res.body).to.have.lengthOf(0);

      await User.deleteOne({ _id: usuarioC._id });
    });

    // ── H03 ──────────────────────────────────────────────────────────────────
    it("H03 — owner ve sus publicaciones unavailable; el listado público no las muestra", async () => {
      const pubPausada = await crearPublicacion(usuarioA._id, {
        title: "Pub A3 - Pausada",
        status: "unavailable",
      });

      // 1) El owner SÍ la ve en su panel privado
      const resMio = await request(app)
        .get("/api/users/me/publications")
        .set("Authorization", `Bearer ${tokenA}`);

      expect(resMio.status).to.equal(200);
      expect(resMio.body).to.be.an("array");

      const idsMios = resMio.body.map((p) => p._id.toString());
      expect(idsMios).to.include(pubPausada._id.toString());

      // 2) El listado público NO la muestra (filtra por status=available)
      const resPublico = await request(app)
        .get(`/api/publications?userId=${usuarioA._id}`);

      expect(resPublico.status).to.equal(200);
      expect(resPublico.body).to.have.property("publications").that.is.an("array");

      const idsPublicos = resPublico.body.publications.map((p) => p._id.toString());
      expect(idsPublicos).to.not.include(pubPausada._id.toString());

      await Publication.deleteOne({ _id: pubPausada._id });
    });

    // ── H04 ──────────────────────────────────────────────────────────────────
    it("H04 — sin token → 401", async () => {
      const res = await request(app)
        .get("/api/users/me/publications");
        // Sin .set("Authorization", ...)

      expect(res.status).to.equal(401);
      expect(res.body).to.have.property("message").that.is.a("string");
    });

    // ── H04b ─────────────────────────────────────────────────────────────────
    it("H04b — token malformado (string basura) → 401", async () => {
      const res = await request(app)
        .get("/api/users/me/publications")
        .set("Authorization", "Bearer esto_no_es_un_jwt");

      expect(res.status).to.equal(401);
      expect(res.body).to.have.property("message").that.is.a("string");
    });

    // ── H04c ─────────────────────────────────────────────────────────────────
    it("H04c — token expirado → 401", async () => {
      // Firmamos un JWT con expiración en el pasado usando la misma clave del server
      const jwt = require("jsonwebtoken");
      const tokenExpirado = jwt.sign(
        { id: usuarioA._id, role: usuarioA.role },
        process.env.JWT_SECRET,
        { expiresIn: -1 }   // negativo = ya expiró al momento de crearse
      );

      const res = await request(app)
        .get("/api/users/me/publications")
        .set("Authorization", `Bearer ${tokenExpirado}`);

      expect(res.status).to.equal(401);
      expect(res.body).to.have.property("message").that.is.a("string");
    });


  }); // fin describe GET me/publications

  // ─── POST /api/exchanges — Bloqueo de auto-intercambio ───────────────────
  describe("POST /api/exchanges — Bloqueo de auto-intercambio", () => {

    let usuario, token, pubPropia, pubAjena;
    let otroUsuario;

    beforeEach(async () => {
      // Usuario que intenta el auto-intercambio
      ({ user: usuario, token } = await crearUsuarioConToken());

      // Usuario dueño de la publicación ajena (necesario para el flujo exchange)
      ({ user: otroUsuario } = await crearUsuarioConToken());

      // Publicación propia del usuario (la que va a intentar solicitar)
      pubPropia = await crearPublicacion(usuario._id, {
        title: "Mi pub — no se puede auto-solicitar",
        type: "ambos",
      });

      // Publicación ajena (necesaria como offeredPublicationId en el flujo exchange)
      pubAjena = await crearPublicacion(otroUsuario._id, {
        title: "Pub ajena — usada como offered",
        type: "ambos",
      });
    });

    afterEach(async () => {
      await Publication.deleteOne({ _id: pubPropia._id });
      await Publication.deleteOne({ _id: pubAjena._id });
      await User.deleteOne({ _id: usuario._id });
      await User.deleteOne({ _id: otroUsuario._id });
    });

    // ── H05 ──────────────────────────────────────────────────────────────────
    it("H05 — auto-intercambio (exchange): usuario solicita su propia publicación → 400", async () => {
      const res = await request(app)
        .post("/api/exchanges")
        .set("Authorization", `Bearer ${token}`)
        .send({
          type: "exchange",
          offeredPublicationId: pubAjena._id.toString(),  // ofrece la ajena
          requestedPublicationId: pubPropia._id.toString(), // solicita la PROPIA ← bloqueado
        });

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("message").that.is.a("string");
    });

    // ── H05b ─────────────────────────────────────────────────────────────────
    it("H05b — auto-compra (purchase): usuario intenta comprar su propia publicación → 400", async () => {
      const res = await request(app)
        .post("/api/exchanges")
        .set("Authorization", `Bearer ${token}`)
        .send({
          type: "purchase",
          requestedPublicationId: pubPropia._id.toString(), // solicita la PROPIA ← bloqueado
        });

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("message").that.is.a("string");
    });

    // ── H05c ─────────────────────────────────────────────────────────────────
    it("H05c — intercambio legítimo entre dos usuarios distintos → 201", async () => {
      // Happy path: confirma que el bloqueo es específico para el owner,
      // no que el endpoint rechaza todo
      const res = await request(app)
        .post("/api/exchanges")
        .set("Authorization", `Bearer ${token}`)
        .send({
          type: "exchange",
          offeredPublicationId: pubPropia._id.toString(),  // ofrece la PROPIA ← correcto
          requestedPublicationId: pubAjena._id.toString(), // solicita la AJENA ← correcto
        });

      expect(res.status).to.equal(201);
      expect(res.body).to.have.property("_id");
      expect(res.body).to.have.property("status").that.equals("pending");

      // Limpieza del exchange creado
      const Exchange = require("../src/models/Exchange");
      await Exchange.deleteOne({ _id: res.body._id });
    });

  }); // fin describe auto-intercambio

    // ─── GET /api/publications — Filtros de tipo ──────────────────────────────

  describe("GET /api/publications?type=trueque — Filtro por tipo de intercambio", () => {

    let usuarioFiltro, pubTrueque, pubVenta, pubAmbos;

    beforeEach(async () => {
      ({ user: usuarioFiltro } = await crearUsuarioConToken());

      pubTrueque = await crearPublicacion(usuarioFiltro._id, {
        title: "Pub solo trueque",
        type: "trueque",
        status: "available",
      });

      pubVenta = await crearPublicacion(usuarioFiltro._id, {
        title: "Pub solo venta",
        type: "venta",
        status: "available",
      });

      pubAmbos = await crearPublicacion(usuarioFiltro._id, {
        title: "Pub acepta ambos",
        type: "ambos",
        status: "available",
      });
    });

    afterEach(async () => {
      await Publication.deleteOne({ _id: pubTrueque._id });
      await Publication.deleteOne({ _id: pubVenta._id });
      await Publication.deleteOne({ _id: pubAmbos._id });
      await User.deleteOne({ _id: usuarioFiltro._id });
    });

    // ── H06 ──────────────────────────────────────────────────────────────────
    it("H06 — type=trueque excluye publicaciones de tipo 'venta'", async () => {
      const res = await request(app)
        .get(`/api/publications?type=trueque&userId=${usuarioFiltro._id}`);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("publications").that.is.an("array");

      const ids = res.body.publications.map((p) => p._id.toString());

      // "trueque" y "ambos" deben aparecer
      expect(ids).to.include(pubTrueque._id.toString());
      expect(ids).to.include(pubAmbos._id.toString());

      // "venta" debe estar excluida
      expect(ids).to.not.include(pubVenta._id.toString());
    });

    // ── H08 ──────────────────────────────────────────────────────────────────
    it("H08 — listado público solo muestra pubs 'available'; unavailable/suspended/sold/exchanged quedan excluidas", async () => {
      // Creamos una pub por cada status no-público
      const pubUnavailable = await crearPublicacion(usuarioFiltro._id, {
        title: "Pub unavailable",
        type: "trueque",
        status: "unavailable",
      });
      const pubSuspended = await crearPublicacion(usuarioFiltro._id, {
        title: "Pub suspended",
        type: "trueque",
        status: "suspended",
      });
      const pubSold = await crearPublicacion(usuarioFiltro._id, {
        title: "Pub sold",
        type: "trueque",
        status: "sold",
      });
      const pubExchanged = await crearPublicacion(usuarioFiltro._id, {
        title: "Pub exchanged",
        type: "trueque",
        status: "exchanged",
      });

      const res = await request(app)
        .get(`/api/publications?userId=${usuarioFiltro._id}`);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("publications").that.is.an("array");

      const ids = res.body.publications.map((p) => p._id.toString());

      // La única pub "available" del beforeEach sí debe aparecer
      expect(ids).to.include(pubTrueque._id.toString());

      // Ninguno de los estados no-públicos debe filtrarse al listado
      expect(ids).to.not.include(pubUnavailable._id.toString());
      expect(ids).to.not.include(pubSuspended._id.toString());
      expect(ids).to.not.include(pubSold._id.toString());
      expect(ids).to.not.include(pubExchanged._id.toString());

      // Limpieza de las pubs extra creadas dentro del test
      await Publication.deleteOne({ _id: pubUnavailable._id });
      await Publication.deleteOne({ _id: pubSuspended._id });
      await Publication.deleteOne({ _id: pubSold._id });
      await Publication.deleteOne({ _id: pubExchanged._id });
    });


  }); // fin describe filtro tipo


}); // fin suite principal
