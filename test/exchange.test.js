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

describe("GET /api/exchanges/received — Listado de solicitudes recibidas", () => {

  it("1a | sin solicitudes recibidas → 200 con array vacío", async () => {
    // Usuario que nunca recibió nada
    const owner = await registrarUsuario({
      nombre: "Ana",
      apellido: "Test",
      fechaNacimiento: "2000-01-01",
      email: "ana@exchange.test.com",
      password: "Password123!",
      confirmPassword: "Password123!",
    });

    const res = await request(app)
      .get("/api/exchanges/received")
      .set("Authorization", `Bearer ${owner.token}`);

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property("exchanges").that.is.an("array").that.is.empty;
    expect(res.body).to.have.property("pagination");
    expect(res.body.pagination).to.have.property("total", 0);
  });

  it("1b | sin token → 401", async () => {
    const res = await request(app)
      .get("/api/exchanges/received");

    expect(res.status).to.equal(401);
    expect(res.body).to.have.property("message");
  });

  it("1c | con solicitudes recibidas → 200 + estructura correcta", async () => {
    // Dos usuarios
    const requester = await registrarUsuario({
      nombre: "Bruno",
      apellido: "Test",
      fechaNacimiento: "2000-01-01",
      email: "bruno@exchange.test.com",
      password: "Password123!",
      confirmPassword: "Password123!",
    });

    const owner = await registrarUsuario({
      nombre: "Clara",
      apellido: "Test",
      fechaNacimiento: "2000-01-01",
      email: "clara@exchange.test.com",
      password: "Password123!",
      confirmPassword: "Password123!",
    });

    // Una publicación por usuario
    const pubBruno = await Publication.create({
      ...crearPublicacion({ title: "Publicación de Bruno" }),
      owner: requester.userId,
    });

    const pubClara = await Publication.create({
      ...crearPublicacion({ title: "Publicación de Clara" }),
      owner: owner.userId,
    });

    // Bruno envía solicitud a Clara
    await request(app)
      .post("/api/exchanges")
      .set("Authorization", `Bearer ${requester.token}`)
      .send({
        offeredPublicationId: pubBruno._id.toString(),
        requestedPublicationId: pubClara._id.toString(),
      });

    // Clara consulta sus recibidas
    const res = await request(app)
      .get("/api/exchanges/received")
      .set("Authorization", `Bearer ${owner.token}`);

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property("exchanges").that.is.an("array").with.lengthOf(1);
    expect(res.body).to.have.property("pagination");
    expect(res.body.pagination).to.have.property("total", 1);

    const exchange = res.body.exchanges[0];
    expect(exchange).to.have.property("_id");
    expect(exchange).to.have.property("status");
    expect(exchange).to.have.property("complementaryAmount");
    expect(exchange).to.have.property("offeredPublication");
    expect(exchange).to.have.property("requester");
  });

});

describe("GET /api/exchanges/received — Estados visibles", () => {

  it("2a | exchange pendiente tiene todos los campos requeridos", async () => {
    const requester = await registrarUsuario({
      nombre: "Diego",
      apellido: "Test",
      fechaNacimiento: "2000-01-01",
      email: "diego@exchange.test.com",
      password: "Password123!",
      confirmPassword: "Password123!",
    });

    const owner = await registrarUsuario({
      nombre: "Elena",
      apellido: "Test",
      fechaNacimiento: "2000-01-01",
      email: "elena@exchange.test.com",
      password: "Password123!",
      confirmPassword: "Password123!",
    });

    const pubDiego = await Publication.create({
      ...crearPublicacion({ title: "Publicación de Diego" }),
      owner: requester.userId,
    });

    const pubElena = await Publication.create({
      ...crearPublicacion({ title: "Publicación de Elena" }),
      owner: owner.userId,
    });

    await request(app)
      .post("/api/exchanges")
      .set("Authorization", `Bearer ${requester.token}`)
      .send({
        offeredPublicationId: pubDiego._id.toString(),
        requestedPublicationId: pubElena._id.toString(),
        complementaryAmount: 300,
      });

    const res = await request(app)
      .get("/api/exchanges/received")
      .set("Authorization", `Bearer ${owner.token}`);

    expect(res.status).to.equal(200);

    const exchange = res.body.exchanges[0];

    // Estado
    expect(exchange).to.have.property("status", "pending");

    // Objeto ofrecido — populate: title, photos, category, condition
    expect(exchange).to.have.property("offeredPublication");
    expect(exchange.offeredPublication).to.have.property("title");
    expect(exchange.offeredPublication).to.have.property("photos").that.is.an("array");
    expect(exchange.offeredPublication).to.have.property("category");
    expect(exchange.offeredPublication).to.have.property("condition");

    // Usuario solicitante — populate: nombre, apellido, photo
    expect(exchange).to.have.property("requester");
    expect(exchange.requester).to.have.property("nombre");
    expect(exchange.requester).to.have.property("apellido");

    // Monto
    expect(exchange).to.have.property("complementaryAmount", 300);
  });

  it("2b | filtro status=pending devuelve solo pendientes", async () => {
    const requester = await registrarUsuario({
      nombre: "Felipe",
      apellido: "Test",
      fechaNacimiento: "2000-01-01",
      email: "felipe@exchange.test.com",
      password: "Password123!",
      confirmPassword: "Password123!",
    });

    const owner = await registrarUsuario({
      nombre: "Gabriela",
      apellido: "Test",
      fechaNacimiento: "2000-01-01",
      email: "gabriela@exchange.test.com",
      password: "Password123!",
      confirmPassword: "Password123!",
    });

    const pubFelipe = await Publication.create({
      ...crearPublicacion({ title: "Publicación de Felipe" }),
      owner: requester.userId,
    });

    const pubGabriela = await Publication.create({
      ...crearPublicacion({ title: "Publicación de Gabriela" }),
      owner: owner.userId,
    });

    await request(app)
      .post("/api/exchanges")
      .set("Authorization", `Bearer ${requester.token}`)
      .send({
        offeredPublicationId: pubFelipe._id.toString(),
        requestedPublicationId: pubGabriela._id.toString(),
      });

    const res = await request(app)
      .get("/api/exchanges/received?status=pending")
      .set("Authorization", `Bearer ${owner.token}`);

    expect(res.status).to.equal(200);
    expect(res.body.exchanges).to.be.an("array").that.is.not.empty;

    // Todos los exchanges del resultado deben ser pending
    res.body.exchanges.forEach((exchange) => {
      expect(exchange).to.have.property("status", "pending");
    });
  });

  it("2c | filtro status=rejected devuelve solo rechazadas", async () => {
    const requester = await registrarUsuario({
      nombre: "Hector",
      apellido: "Test",
      fechaNacimiento: "2000-01-01",
      email: "hector@exchange.test.com",
      password: "Password123!",
      confirmPassword: "Password123!",
    });

    const owner = await registrarUsuario({
      nombre: "Ines",
      apellido: "Test",
      fechaNacimiento: "2000-01-01",
      email: "ines@exchange.test.com",
      password: "Password123!",
      confirmPassword: "Password123!",
    });

    const pubHector = await Publication.create({
      ...crearPublicacion({ title: "Publicación de Hector" }),
      owner: requester.userId,
    });

    const pubInes = await Publication.create({
      ...crearPublicacion({ title: "Publicación de Ines" }),
      owner: owner.userId,
    });

    // Hector envía solicitud
    const envio = await request(app)
      .post("/api/exchanges")
      .set("Authorization", `Bearer ${requester.token}`)
      .send({
        offeredPublicationId: pubHector._id.toString(),
        requestedPublicationId: pubInes._id.toString(),
      });

    // Ines la rechaza
    await request(app)
      .patch(`/api/exchanges/${envio.body._id}/reject`)
      .set("Authorization", `Bearer ${owner.token}`);

    // Ines consulta sus recibidas filtrando por rejected
    const res = await request(app)
      .get("/api/exchanges/received?status=rejected")
      .set("Authorization", `Bearer ${owner.token}`);

    expect(res.status).to.equal(200);
    expect(res.body.exchanges).to.be.an("array").that.is.not.empty;

    res.body.exchanges.forEach((exchange) => {
      expect(exchange).to.have.property("status", "rejected");
    });
  });

});

describe("GET /api/exchanges/received — Navegación a perfil del solicitante", () => {

  it("3a | el requester dentro del exchange contiene _id", async () => {
    const requester = await registrarUsuario({
      nombre: "Juan",
      apellido: "Test",
      fechaNacimiento: "2000-01-01",
      email: "juan@exchange.test.com",
      password: "Password123!",
      confirmPassword: "Password123!",
    });

    const owner = await registrarUsuario({
      nombre: "Lucia",
      apellido: "Test",
      fechaNacimiento: "2000-01-01",
      email: "lucia@exchange.test.com",
      password: "Password123!",
      confirmPassword: "Password123!",
    });

    const pubJuan = await Publication.create({
      ...crearPublicacion({ title: "Publicación de Juan" }),
      owner: requester.userId,
    });

    const pubLucia = await Publication.create({
      ...crearPublicacion({ title: "Publicación de Lucia" }),
      owner: owner.userId,
    });

    await request(app)
      .post("/api/exchanges")
      .set("Authorization", `Bearer ${requester.token}`)
      .send({
        offeredPublicationId: pubJuan._id.toString(),
        requestedPublicationId: pubLucia._id.toString(),
      });

    const res = await request(app)
      .get("/api/exchanges/received")
      .set("Authorization", `Bearer ${owner.token}`);

    expect(res.status).to.equal(200);

    const exchange = res.body.exchanges[0];
    expect(exchange).to.have.property("requester");
    expect(exchange.requester).to.have.property("_id");
    expect(exchange.requester._id).to.equal(requester.userId);
  });

    it("3b | GET /api/users/:id con el _id del requester devuelve 200", async () => {
    const requester = await registrarUsuario({
      nombre: "Mario",
      apellido: "Test",
      fechaNacimiento: "2000-01-01",
      email: "mario@exchange.test.com",
      password: "Password123!",
      confirmPassword: "Password123!",
    });

    const owner = await registrarUsuario({
      nombre: "Nora",
      apellido: "Test",
      fechaNacimiento: "2000-01-01",
      email: "nora@exchange.test.com",
      password: "Password123!",
      confirmPassword: "Password123!",
    });

    const pubMario = await Publication.create({
      ...crearPublicacion({ title: "Publicación de Mario" }),
      owner: requester.userId,
    });

    const pubNora = await Publication.create({
      ...crearPublicacion({ title: "Publicación de Nora" }),
      owner: owner.userId,
    });

    await request(app)
      .post("/api/exchanges")
      .set("Authorization", `Bearer ${requester.token}`)
      .send({
        offeredPublicationId: pubMario._id.toString(),
        requestedPublicationId: pubNora._id.toString(),
      });

    // Nora obtiene sus recibidas
    const recibidas = await request(app)
      .get("/api/exchanges/received")
      .set("Authorization", `Bearer ${owner.token}`);

    const requesterId = recibidas.body.exchanges[0].requester._id;

    // Usa ese _id para consultar el perfil público
    const perfilRes = await request(app)
      .get(`/api/users/${requesterId}`);

    expect(perfilRes.status).to.equal(200);
    // El service retorna "id", no "_id"
    expect(perfilRes.body).to.have.property("id", requesterId);
    expect(perfilRes.body).to.have.property("nombre");
    expect(perfilRes.body).to.have.property("apellido");
  });

    it("3c | GET /api/users/:id con ID inexistente → 404", async () => {
    const idInexistente = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .get(`/api/users/${idInexistente}`);

    expect(res.status).to.equal(404);
    expect(res.body).to.have.property("message");
  });

});

});
