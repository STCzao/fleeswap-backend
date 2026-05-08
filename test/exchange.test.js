const request = require("supertest");
const { expect } = require("chai");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Publication = require("../src/models/Publication");
const Exchange = require("../src/models/Exchange");

// ─── Helpers de setup ────────────────────────────────────────────────────────

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

// ─── Lifecycle ────────────────────────────────────────────────────────────────

describe("Exchange API", () => {

before(async () => {
  await mongoose.connect(process.env.MONGO_URI);
});

afterEach(async () => {
  await Exchange.deleteMany({});
  await Publication.deleteMany({});
  await User.deleteMany({ email: /exchange\.test\.com$/ });
});

after(async () => {
  await mongoose.disconnect();
});

// ─── Suite principal ──────────────────────────────────────────────────────────

describe("POST /api/exchanges — Solicitud de intercambio", () => {

  it("envío válido → 201 + Exchange con campos correctos", async () => {
    // 1. Crear dos usuarios
    const requester = await registrarUsuario({
      nombre: "Alice",
      apellido: "Test",
      fechaNacimiento: "2000-01-01",
      email: "alice@exchange.test.com",
      password: "Password123!",
      confirmPassword: "Password123!",
    });

    const owner = await registrarUsuario({
      nombre: "Bob",
      apellido: "Test",
      fechaNacimiento: "2000-01-01",
      email: "bob@exchange.test.com",
      password: "Password123!",
      confirmPassword: "Password123!",
    });

    // 2. Cada usuario crea su propia publicación
    const pubAlice = await Publication.create({
      ...crearPublicacion({ title: "Publicación de Alice" }),
      owner: requester.userId,
    });

    const pubBob = await Publication.create({
      ...crearPublicacion({ title: "Publicación de Bob" }),
      owner: owner.userId,
    });

    // 3. Alice envía solicitud por la publicación de Bob, ofreciendo la suya
    const res = await request(app)
      .post("/api/exchanges")
      .set("Authorization", `Bearer ${requester.token}`)
      .send({
        offeredPublicationId: pubAlice._id.toString(),
        requestedPublicationId: pubBob._id.toString(),
        complementaryAmount: 500,
      });

    // 4. Assertions
    expect(res.status).to.equal(201);
    expect(res.body).to.have.property("_id");
    expect(res.body).to.have.property("status", "pending");
    expect(res.body).to.have.property("complementaryAmount", 500);
    expect(res.body.offeredPublication.toString()).to.equal(pubAlice._id.toString());
    expect(res.body.requestedPublication.toString()).to.equal(pubBob._id.toString());
  });

  it("solicitud sobre publicación propia → 400", async () => {
  // 1. Un único usuario con dos publicaciones propias
  const requester = await registrarUsuario({
    nombre: "Carlos",
    apellido: "Test",
    fechaNacimiento: "2000-01-01",
    email: "carlos@exchange.test.com",
    password: "Password123!",
    confirmPassword: "Password123!",
  });

  const pubPropia1 = await Publication.create({
    ...crearPublicacion({ title: "Publicación propia A" }),
    owner: requester.userId,
  });

  const pubPropia2 = await Publication.create({
    ...crearPublicacion({ title: "Publicación propia B" }),
    owner: requester.userId,
  });

  // 2. Intenta intercambiar una de sus publicaciones por la otra
  const res = await request(app)
    .post("/api/exchanges")
    .set("Authorization", `Bearer ${requester.token}`)
    .send({
      offeredPublicationId: pubPropia1._id.toString(),
      requestedPublicationId: pubPropia2._id.toString(),
    });

  // 3. Assertions
  expect(res.status).to.equal(400);
  expect(res.body).to.have.property("message");
});

  it("solicitud duplicada sobre la misma publicación → 409", async () => {
  // 1. Crear dos usuarios
  const requester = await registrarUsuario({
    nombre: "Diana",
    apellido: "Test",
    fechaNacimiento: "2000-01-01",
    email: "diana@exchange.test.com",
    password: "Password123!",
    confirmPassword: "Password123!",
  });

  const owner = await registrarUsuario({
    nombre: "Eduardo",
    apellido: "Test",
    fechaNacimiento: "2000-01-01",
    email: "eduardo@exchange.test.com",
    password: "Password123!",
    confirmPassword: "Password123!",
  });

  // 2. Una publicación por usuario
  const pubDiana = await Publication.create({
    ...crearPublicacion({ title: "Publicación de Diana" }),
    owner: requester.userId,
  });

  const pubEduardo = await Publication.create({
    ...crearPublicacion({ title: "Publicación de Eduardo" }),
    owner: owner.userId,
  });

  const payload = {
    offeredPublicationId: pubDiana._id.toString(),
    requestedPublicationId: pubEduardo._id.toString(),
  };

  // 3. Primera solicitud — debe pasar
  const primera = await request(app)
    .post("/api/exchanges")
    .set("Authorization", `Bearer ${requester.token}`)
    .send(payload);

  expect(primera.status).to.equal(201);

  // 4. Segunda solicitud idéntica — debe ser bloqueada
  const segunda = await request(app)
    .post("/api/exchanges")
    .set("Authorization", `Bearer ${requester.token}`)
    .send(payload);

  expect(segunda.status).to.equal(409);
  expect(segunda.body).to.have.property("message");
});

    it("sin token → 401", async () => {
    const res = await request(app)
        .post("/api/exchanges")
        .send({
        offeredPublicationId: new mongoose.Types.ObjectId().toString(),
        requestedPublicationId: new mongoose.Types.ObjectId().toString(),
        });

    expect(res.status).to.equal(401);
    expect(res.body).to.have.property("message");
});

    it("body vacío → 400", async () => {
    // Necesitamos un token válido para pasar el middleware de autenticación
    const requester = await registrarUsuario({
        nombre: "Hugo",
        apellido: "Test",
        fechaNacimiento: "2000-01-01",
        email: "hugo@exchange.test.com",
        password: "Password123!",
        confirmPassword: "Password123!",
    });

    const res = await request(app)
        .post("/api/exchanges")
        .set("Authorization", `Bearer ${requester.token}`)
        .send({});

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("errors");
    expect(res.body.errors).to.be.an("array").that.is.not.empty;
});

    it("IDs con formato inválido → 400", async () => {
    const requester = await registrarUsuario({
        nombre: "Irene",
        apellido: "Test",
        fechaNacimiento: "2000-01-01",
        email: "irene@exchange.test.com",
        password: "Password123!",
        confirmPassword: "Password123!",
    });

    const res = await request(app)
        .post("/api/exchanges")
        .set("Authorization", `Bearer ${requester.token}`)
        .send({
        offeredPublicationId: "esto-no-es-un-id",
        requestedPublicationId: "tampoco-este",
        });

    expect(res.body).to.have.property("errors");
    expect(res.body.errors).to.be.an("array").that.is.not.empty;
});

    it("complementaryAmount negativo → 400", async () => {
    const requester = await registrarUsuario({
        nombre: "Julian",
        apellido: "Test",
        fechaNacimiento: "2000-01-01",
        email: "julian@exchange.test.com",
        password: "Password123!",
        confirmPassword: "Password123!",
    });

    const owner = await registrarUsuario({
        nombre: "Karen",
        apellido: "Test",
        fechaNacimiento: "2000-01-01",
        email: "karen@exchange.test.com",
        password: "Password123!",
        confirmPassword: "Password123!",
    });

    const pubJulian = await Publication.create({
        ...crearPublicacion({ title: "Publicación de Julian" }),
        owner: requester.userId,
    });

    const pubKaren = await Publication.create({
        ...crearPublicacion({ title: "Publicación de Karen" }),
        owner: owner.userId,
    });

    const res = await request(app)
        .post("/api/exchanges")
        .set("Authorization", `Bearer ${requester.token}`)
        .send({
        offeredPublicationId: pubJulian._id.toString(),
        requestedPublicationId: pubKaren._id.toString(),
        complementaryAmount: -100,
        });

    expect(res.body).to.have.property("errors");
    expect(res.body.errors).to.be.an("array").that.is.not.empty;
});

  it("requestedPublication inexistente → 404", async () => {
  const requester = await registrarUsuario({
    nombre: "Laura",
    apellido: "Test",
    fechaNacimiento: "2000-01-01",
    email: "laura@exchange.test.com",
    password: "Password123!",
    confirmPassword: "Password123!",
  });

  const pubLaura = await Publication.create({
    ...crearPublicacion({ title: "Publicación de Laura" }),
    owner: requester.userId,
  });

  const res = await request(app)
    .post("/api/exchanges")
    .set("Authorization", `Bearer ${requester.token}`)
    .send({
      offeredPublicationId: pubLaura._id.toString(),
      requestedPublicationId: new mongoose.Types.ObjectId().toString(),
    });

  expect(res.status).to.equal(404);
  expect(res.body).to.have.property("message");
});

    it("offeredPublication inexistente → 404", async () => {
    const requester = await registrarUsuario({
        nombre: "Marcos",
        apellido: "Test",
        fechaNacimiento: "2000-01-01",
        email: "marcos@exchange.test.com",
        password: "Password123!",
        confirmPassword: "Password123!",
    });

    const owner = await registrarUsuario({
        nombre: "Natalia",
        apellido: "Test",
        fechaNacimiento: "2000-01-01",
        email: "natalia@exchange.test.com",
        password: "Password123!",
        confirmPassword: "Password123!",
    });

    const pubNatalia = await Publication.create({
        ...crearPublicacion({ title: "Publicación de Natalia" }),
        owner: owner.userId,
    });

    const res = await request(app)
        .post("/api/exchanges")
        .set("Authorization", `Bearer ${requester.token}`)
        .send({
        offeredPublicationId: new mongoose.Types.ObjectId().toString(),
        requestedPublicationId: pubNatalia._id.toString(),
        });

    expect(res.status).to.equal(404);
    expect(res.body).to.have.property("message");
    });

    it("ofrecer publicación ajena → 403", async () => {
    // 1. Tres usuarios: requester, dueño de la pub ofrecida, dueño de la pub solicitada
    const requester = await registrarUsuario({
        nombre: "Oscar",
        apellido: "Test",
        fechaNacimiento: "2000-01-01",
        email: "oscar@exchange.test.com",
        password: "Password123!",
        confirmPassword: "Password123!",
    });

    const tercero = await registrarUsuario({
        nombre: "Paula",
        apellido: "Test",
        fechaNacimiento: "2000-01-01",
        email: "paula@exchange.test.com",
        password: "Password123!",
        confirmPassword: "Password123!",
    });

    const owner = await registrarUsuario({
        nombre: "Roberto",
        apellido: "Test",
        fechaNacimiento: "2000-01-01",
        email: "roberto@exchange.test.com",
        password: "Password123!",
        confirmPassword: "Password123!",
    });

    // 2. La publicación ofrecida pertenece a Paula, no a Oscar
    const pubPaula = await Publication.create({
        ...crearPublicacion({ title: "Publicación de Paula" }),
        owner: tercero.userId,
    });

    const pubRoberto = await Publication.create({
        ...crearPublicacion({ title: "Publicación de Roberto" }),
        owner: owner.userId,
    });

    // 3. Oscar intenta ofrecer la publicación de Paula
    const res = await request(app)
        .post("/api/exchanges")
        .set("Authorization", `Bearer ${requester.token}`)
        .send({
        offeredPublicationId: pubPaula._id.toString(),
        requestedPublicationId: pubRoberto._id.toString(),
        });

    expect(res.status).to.equal(403);
    expect(res.body).to.have.property("message");
    });

    it("requestedPublication no disponible → 400", async () => {
    const requester = await registrarUsuario({
        nombre: "Sofia",
        apellido: "Test",
        fechaNacimiento: "2000-01-01",
        email: "sofia@exchange.test.com",
        password: "Password123!",
        confirmPassword: "Password123!",
    });

    const owner = await registrarUsuario({
        nombre: "Tomas",
        apellido: "Test",
        fechaNacimiento: "2000-01-01",
        email: "tomas@exchange.test.com",
        password: "Password123!",
        confirmPassword: "Password123!",
    });

    const pubSofia = await Publication.create({
        ...crearPublicacion({ title: "Publicación de Sofia" }),
        owner: requester.userId,
    });

    // Publicación de Tomas marcada como no disponible
    const pubTomas = await Publication.create({
        ...crearPublicacion({ title: "Publicación de Tomas" }),
        owner: owner.userId,
        status: "unavailable",
    });

    const res = await request(app)
        .post("/api/exchanges")
        .set("Authorization", `Bearer ${requester.token}`)
        .send({
        offeredPublicationId: pubSofia._id.toString(),
        requestedPublicationId: pubTomas._id.toString(),
        });

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("message");
    });

    it("offeredPublication no disponible → 400", async () => {
    const requester = await registrarUsuario({
        nombre: "Ursula",
        apellido: "Test",
        fechaNacimiento: "2000-01-01",
        email: "ursula@exchange.test.com",
        password: "Password123!",
        confirmPassword: "Password123!",
    });

    const owner = await registrarUsuario({
        nombre: "Victor",
        apellido: "Test",
        fechaNacimiento: "2000-01-01",
        email: "victor@exchange.test.com",
        password: "Password123!",
        confirmPassword: "Password123!",
    });

    // Publicación de Ursula marcada como no disponible
    const pubUrsula = await Publication.create({
        ...crearPublicacion({ title: "Publicación de Ursula" }),
        owner: requester.userId,
        status: "unavailable",
    });

    const pubVictor = await Publication.create({
        ...crearPublicacion({ title: "Publicación de Victor" }),
        owner: owner.userId,
    });

    const res = await request(app)
        .post("/api/exchanges")
        .set("Authorization", `Bearer ${requester.token}`)
        .send({
        offeredPublicationId: pubUrsula._id.toString(),
        requestedPublicationId: pubVictor._id.toString(),
        });

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("message");
    });

    it("offeredPublication igual a requestedPublication → 400", async () => {
    const requester = await registrarUsuario({
        nombre: "Walter",
        apellido: "Test",
        fechaNacimiento: "2000-01-01",
        email: "walter@exchange.test.com",
        password: "Password123!",
        confirmPassword: "Password123!",
    });

    const pubWalter = await Publication.create({
        ...crearPublicacion({ title: "Publicación de Walter" }),
        owner: requester.userId,
    });

    const res = await request(app)
        .post("/api/exchanges")
        .set("Authorization", `Bearer ${requester.token}`)
        .send({
        offeredPublicationId: pubWalter._id.toString(),
        requestedPublicationId: pubWalter._id.toString(),
        });

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("message");
    });

});

});
