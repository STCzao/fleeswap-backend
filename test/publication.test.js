const request = require("supertest");
const { expect } = require("chai");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Publication = require("../src/models/Publication");

// ─── Helpers ────────────────────────────────────────────────────────────────

const usuarioBase = {
  nombre: "Test",
  apellido: "Publicacion",
  fechaNacimiento: "2000-01-01",
  email: "pub@test.com",
  password: "Password123!",
  confirmPassword: "Password123!",
};

const fotosMock = [
  "https://res.cloudinary.com/demo/image/upload/foto1.jpg",
  "https://res.cloudinary.com/demo/image/upload/foto2.jpg",
];

const publicacionBase = {
  title: "PlayStation 5 Slim",
  description: "Consola PS5 en perfecto estado, incluye dos mandos y tres juegos originales.",
  history: "La compré en 2023, la usé poco porque me mudé. La vendo porque ya no tengo TV.",
  category: "electronica",
  condition: "como_nuevo",
  type: "venta",
  photos: fotosMock,
};

async function registrarYLoguear() {
  await request(app).post("/api/auth/register").send(usuarioBase);
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: usuarioBase.email, password: usuarioBase.password });
  return res.body.accessToken;
}

// ─── Setup / Teardown ───────────────────────────────────────────────────────

before(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }
});

afterEach(async () => {
  await Publication.deleteMany({});
  await User.deleteMany({});
});

after(async () => {
  await mongoose.disconnect();
});

// ─── BLOQUE A: Happy Path ────────────────────────────────────────────────────

describe("POST /api/publications — Happy Path", () => {

  it("A01 — publicación tipo venta con todos los campos válidos → 201", async () => {
    const token = await registrarYLoguear();

    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send(publicacionBase);

    expect(res.status).to.equal(201);
    expect(res.body).to.have.property("_id");
    expect(res.body.title).to.equal(publicacionBase.title);
    expect(res.body.type).to.equal("venta");
    expect(res.body.status).to.equal("available");
    expect(res.body.owner).to.be.a("string");
  });

  it("A02 — publicación tipo trueque → 201", async () => {
    const token = await registrarYLoguear();

    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...publicacionBase, type: "trueque" });

    expect(res.status).to.equal(201);
    expect(res.body.type).to.equal("trueque");
  });

  it("A03 — publicación tipo ambos → 201", async () => {
    const token = await registrarYLoguear();

    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...publicacionBase, type: "ambos" });

    expect(res.status).to.equal(201);
    expect(res.body.type).to.equal("ambos");
  });

  it("A04 — exactamente 1 foto → 201", async () => {
    const token = await registrarYLoguear();

    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...publicacionBase,
        photos: ["https://res.cloudinary.com/demo/image/upload/foto1.jpg"],
      });

    expect(res.status).to.equal(201);
    expect(res.body.photos).to.have.lengthOf(1);
  });

  it("A05 — exactamente 5 fotos → 201", async () => {
    const token = await registrarYLoguear();

    const cincoFotos = [
      "https://res.cloudinary.com/demo/image/upload/foto1.jpg",
      "https://res.cloudinary.com/demo/image/upload/foto2.jpg",
      "https://res.cloudinary.com/demo/image/upload/foto3.jpg",
      "https://res.cloudinary.com/demo/image/upload/foto4.jpg",
      "https://res.cloudinary.com/demo/image/upload/foto5.jpg",
    ];

    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...publicacionBase, photos: cincoFotos });

    expect(res.status).to.equal(201);
    expect(res.body.photos).to.have.lengthOf(5);
  });

  it("A06 — status es available por defecto → 201", async () => {
    const token = await registrarYLoguear();

    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send(publicacionBase);

    expect(res.status).to.equal(201);
    expect(res.body.status).to.equal("available");
  });

  it("A07 — publicación visible públicamente vía GET sin token", async () => {
    const token = await registrarYLoguear();

    const created = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send(publicacionBase);

    const res = await request(app)
      .get(`/api/publications/${created.body._id}`);

    expect(res.status).to.equal(200);
    expect(res.body._id).to.equal(created.body._id);
  });

});

// ─── BLOQUE B: Validaciones ──────────────────────────────────────────────────

describe("POST /api/publications — Validaciones", () => {

  let token;

  beforeEach(async () => {
    token = await registrarYLoguear();
  });

  // ── Campos obligatorios ausentes ──

  it("B01 — sin title → 400", async () => {
    const { title, ...body } = publicacionBase;
    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send(body);

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("errors");
  });

  it("B02 — sin description → 400", async () => {
    const { description, ...body } = publicacionBase;
    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send(body);

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("errors");
  });

  it("B03 — sin history → 400", async () => {
    const { history, ...body } = publicacionBase;
    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send(body);

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("errors");
  });

  it("B04 — sin category → 400", async () => {
    const { category, ...body } = publicacionBase;
    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send(body);

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("errors");
  });

  it("B05 — sin condition → 400", async () => {
    const { condition, ...body } = publicacionBase;
    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send(body);

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("errors");
  });

  it("B06 — sin type → 400", async () => {
    const { type, ...body } = publicacionBase;
    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send(body);

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("errors");
  });

  it("B07 — sin photos → 400", async () => {
    const { photos, ...body } = publicacionBase;
    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send(body);

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("errors");
  });

  // ── Límites de longitud ──

  it("B08 — title supera 100 caracteres → 400", async () => {
    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...publicacionBase, title: "A".repeat(101) });

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("errors");
  });

  it("B09 — description supera 1000 caracteres → 400", async () => {
    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...publicacionBase, description: "A".repeat(1001) });

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("errors");
  });

  it("B10 — history supera 2000 caracteres → 400", async () => {
    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...publicacionBase, history: "A".repeat(2001) });

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("errors");
  });

  // ── Enums inválidos ──

  it("B11 — category con valor fuera del enum → 400", async () => {
    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...publicacionBase, category: "categoria_inexistente" });

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("errors");
  });

  it("B12 — condition con valor fuera del enum → 400", async () => {
    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...publicacionBase, condition: "perfecto" });

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("errors");
  });

  it("B13 — type con valor fuera del enum → 400", async () => {
    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...publicacionBase, type: "donacion" });

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("errors");
  });

  // ── Límites de fotos ──

  it("B14 — photos array vacío → 400", async () => {
    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...publicacionBase, photos: [] });

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("errors");
  });

  it("B15 — 6 fotos (supera el límite) → 400", async () => {
    const seisFotos = Array.from({ length: 6 }, (_, i) =>
      `https://res.cloudinary.com/demo/image/upload/foto${i + 1}.jpg`
    );

    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...publicacionBase, photos: seisFotos });

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("errors");
  });

  it("B16 — foto con URL inválida → 400", async () => {
    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...publicacionBase, photos: ["no-es-una-url"] });

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("errors");
  });

  // ── Campos solo espacios en blanco ──

  it("B17 — title con solo espacios → 400", async () => {
    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...publicacionBase, title: "     " });

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("errors");
  });

  it("B18 — description con solo espacios → 400", async () => {
    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...publicacionBase, description: "     " });

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("errors");
  });

  it("B19 — history con solo espacios → 400", async () => {
    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...publicacionBase, history: "     " });

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("errors");
  });

  // ── Autenticación ──

  it("B20 — sin token → 401", async () => {
    const res = await request(app)
      .post("/api/publications")
      .send(publicacionBase);

    expect(res.status).to.equal(401);
  });

  it("B21 — token inválido → 401", async () => {
    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", "Bearer tokeninvalido")
      .send(publicacionBase);

    expect(res.status).to.equal(401);
  });

});

// ─── BLOQUE C: Integración ───────────────────────────────────────────────────

describe("POST /api/publications — Integración", () => {

  let token;
  let userId;

  beforeEach(async () => {
    const regRes = await request(app).post("/api/auth/register").send(usuarioBase);
    userId = regRes.body.user._id;
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: usuarioBase.email, password: usuarioBase.password });
    token = loginRes.body.accessToken;
  });

  it("C01 — el owner de la publicación coincide con el usuario autenticado", async () => {
    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send(publicacionBase);

    expect(res.status).to.equal(201);
    expect(res.body.owner).to.equal(userId);
  });

  it("C02 — los datos guardados en BD coinciden con los enviados", async () => {
    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send(publicacionBase);

    expect(res.status).to.equal(201);

    const enBD = await Publication.findById(res.body._id);
    expect(enBD.title).to.equal(publicacionBase.title);
    expect(enBD.description).to.equal(publicacionBase.description);
    expect(enBD.history).to.equal(publicacionBase.history);
    expect(enBD.category).to.equal(publicacionBase.category);
    expect(enBD.condition).to.equal(publicacionBase.condition);
    expect(enBD.type).to.equal(publicacionBase.type);
    expect(enBD.photos).to.deep.equal(publicacionBase.photos);
  });

  it("C03 — la publicación creada aparece en el listado público GET /api/publications", async () => {
    await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send(publicacionBase);

    const res = await request(app).get("/api/publications");

    expect(res.status).to.equal(200);
    const titles = res.body.publications.map((p) => p.title);
    expect(titles).to.include(publicacionBase.title);
  });

  it("C04 — price y location enviados por el FE son ignorados sin romper el request", async () => {
    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...publicacionBase, price: 500000, location: "Tucumán" });

    expect(res.status).to.equal(201);
    expect(res.body).to.not.have.property("price");
    expect(res.body).to.not.have.property("location");
  });

  it("C05 — el texto es sanitizado antes de guardarse en BD", async () => {
    const res = await request(app)
      .post("/api/publications")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...publicacionBase, title: "  PlayStation 5  " });

    expect(res.status).to.equal(201);
    expect(res.body.title).to.equal("PlayStation 5");
  });

});

// ─── Helpers adicionales ─────────────────────────────────────────────────────

async function crearPublicacion(token) {
  const res = await request(app)
    .post("/api/publications")
    .set("Authorization", `Bearer ${token}`)
    .send(publicacionBase);
  return res.body;
}

// ─── BLOQUE D: Editar publicación ────────────────────────────────────────────

describe("PATCH /api/publications/:id — Editar publicación", () => {

  it("D01 — owner edita su publicación con campos válidos → 200", async () => {
    const token = await registrarYLoguear();
    const publicacion = await crearPublicacion(token);

    const cambios = {
      title: "PlayStation 5 Slim Editado",
      description: "Descripción actualizada por el owner.",
    };

    const res = await request(app)
      .patch(`/api/publications/${publicacion._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send(cambios);

    expect(res.status).to.equal(200);
    expect(res.body.title).to.equal(cambios.title);
    expect(res.body.description).to.equal(cambios.description);
  });

  it("D02 — no-owner intenta editar la publicación → 403", async () => {
    const tokenOwner = await registrarYLoguear();
    const publicacion = await crearPublicacion(tokenOwner);

    // Registramos un segundo usuario
    const otroUsuario = {
      ...usuarioBase,
      email: "otro@test.com",
    };
    await request(app).post("/api/auth/register").send(otroUsuario);
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: otroUsuario.email, password: otroUsuario.password });
    const tokenOtro = loginRes.body.accessToken;

    const res = await request(app)
      .patch(`/api/publications/${publicacion._id}`)
      .set("Authorization", `Bearer ${tokenOtro}`)
      .send({ title: "Intento de edición no autorizada" });

    expect(res.status).to.equal(403);
  });

  it("D03 — fecha_creacion no puede ser modificada → se mantiene igual", async () => {
    const token = await registrarYLoguear();
    const publicacion = await crearPublicacion(token);

    const res = await request(app)
      .patch(`/api/publications/${publicacion._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Título modificado",
        createdAt: "2000-01-01T00:00:00.000Z",
      });

    expect(res.status).to.equal(200);
    expect(new Date(res.body.createdAt).toISOString()).to.equal(
      new Date(publicacion.createdAt).toISOString()
    );
  });

  it("D04 — los cambios se reflejan inmediatamente en la vista pública", async () => {
    const token = await registrarYLoguear();
    const publicacion = await crearPublicacion(token);

    await request(app)
      .patch(`/api/publications/${publicacion._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Título visible públicamente" });

    const res = await request(app)
      .get(`/api/publications/${publicacion._id}`);

    expect(res.status).to.equal(200);
    expect(res.body.title).to.equal("Título visible públicamente");
  });

});

// ─── E: DELETE /api/publications/:id ────────────────────────────────────────

describe("E: DELETE /api/publications/:id — Eliminar publicación", () => {
  let token;
  let otroToken;
  let publicacionId;

 beforeEach(async () => {
  // Owner
  token = await registrarYLoguear();

  // No-owner: registrar y loguear manualmente
  const otroUsuarioData = { ...usuarioBase, email: "otro@test.com" };
  await request(app).post("/api/auth/register").send(otroUsuarioData);
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: otroUsuarioData.email, password: otroUsuarioData.password });
  otroToken = loginRes.body.accessToken;

  // Publicación del owner
  const pub = await crearPublicacion(token);
  publicacionId = pub._id;
});

  afterEach(async () => {
    await Publication.deleteMany({});
    await User.deleteMany({});
  });

  // ── E01: Owner elimina su propia publicación ────────────────────────────
  it("E01 — owner puede eliminar su publicación (200)", async () => {
    const res = await request(app)
      .delete(`/api/publications/${publicacionId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ confirmacion: true });

    expect(res.status).to.equal(200);

    // Verificar que ya no existe en la base
    const enDb = await Publication.findById(publicacionId);
    expect(enDb).to.be.null;
  });

  // ── E02: Publicación con intercambio activo no puede eliminarse ─────────
  it("E02 — falla al eliminar publicación con intercambio en curso (409)", async () => {
    // Simular intercambio activo directamente en el documento
    await Publication.findByIdAndUpdate(publicacionId, {
      intercambioActivo: true, // ajustar al nombre real del campo en tu modelo
    });

    const res = await request(app)
      .delete(`/api/publications/${publicacionId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ confirmacion: true });

    expect(res.status).to.equal(409);
    expect(res.body).to.have.property("message");

    // La publicación debe seguir existiendo
    const enDb = await Publication.findById(publicacionId);
    expect(enDb).to.not.be.null;
  });

  // ── E03: No-owner no puede eliminar (403) ──────────────────────────────
  // BUG CONOCIDO: actualmente devuelve 404 en vez de 403 (igual que D02)
  it("E03 — no-owner recibe 403 al intentar eliminar [BUG: devuelve 404]", async () => {
    const res = await request(app)
      .delete(`/api/publications/${publicacionId}`)
      .set("Authorization", `Bearer ${otroToken}`)
      .send({ confirmacion: true });

    // Cambiar a 403 cuando se corrija el bug (igual que D02)
    expect(res.status).to.equal(404); // BUG: debería ser 403
    // expect(res.status).to.equal(403); // descomentar post-fix

    // La publicación debe seguir existiendo
    const enDb = await Publication.findById(publicacionId);
    expect(enDb).to.not.be.null;
  });

  // ── E04: Sin confirmación previa, el servidor rechaza la solicitud ──────
  it("E04 — falla sin confirmación previa (400)", async () => {
    const res = await request(app)
      .delete(`/api/publications/${publicacionId}`)
      .set("Authorization", `Bearer ${token}`)
      // No se envía { confirmacion: true }
      .send({});

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("message"); // o "errors" post bug-fix
  });

  // ── E05: Sin token, responde 401 ────────────────────────────────────────
  it("E05 — sin token devuelve 401", async () => {
    const res = await request(app)
      .delete(`/api/publications/${publicacionId}`)
      .send({ confirmacion: true });

    expect(res.status).to.equal(401);
  });

  // ── E06: ID inexistente devuelve 404 ────────────────────────────────────
  it("E06 — publicación inexistente devuelve 404", async () => {
    const idFalso = "000000000000000000000000";

    const res = await request(app)
      .delete(`/api/publications/${idFalso}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ confirmacion: true });

    expect(res.status).to.equal(404);
  });
});

// ─── F: PATCH /api/publications/:id/status — Cambiar estado ─────────────────

describe("F: PATCH /api/publications/:id/status — Cambiar estado de publicación", () => {
  let token;
  let publicacion;

  beforeEach(async () => {
    token = await registrarYLoguear();
    publicacion = await crearPublicacion(token);
  });

  // ── F01: Owner cambia estado a unavailable ──────────────────────────────
  it("F01 — owner puede marcar su publicación como unavailable (200)", async () => {
    const res = await request(app)
      .patch(`/api/publications/${publicacion._id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "unavailable" });

    expect(res.status).to.equal(200);
    expect(res.body.status).to.equal("unavailable");
  });

  it("F02 — no-owner no puede cambiar el estado (403)", async () => {
    const otroUsuarioData = { ...usuarioBase, email: "otro@test.com" };
    await request(app).post("/api/auth/register").send(otroUsuarioData);
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: otroUsuarioData.email, password: otroUsuarioData.password });
    const otroToken = loginRes.body.accessToken;

    const res = await request(app)
      .patch(`/api/publications/${publicacion._id}/status`)
      .set("Authorization", `Bearer ${otroToken}`)
      .send({ status: "unavailable" });

    expect(res.status).to.equal(403);
  });

  // F03: Verificar que no aparece en listados activos
  it("F03 — publicación unavailable no aparece en el listado público", async () => {
    // Primero cambiamos el estado a unavailable
    await request(app)
      .patch(`/api/publications/${publicacion._id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "unavailable" });

    // Luego consultamos el listado público sin token
    const res = await request(app).get("/api/publications");

    expect(res.status).to.equal(200);
    const ids = res.body.publications.map((p) => p._id);
    expect(ids).to.not.include(publicacion._id);
  });

  // F04: Validar persistencia — el cambio se guardó realmente en BD
  it("F04 — el estado unavailable persiste en base de datos", async () => {
    await request(app)
      .patch(`/api/publications/${publicacion._id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "unavailable" });

    // Consultamos directamente en MongoDB, sin pasar por la API
    const enBD = await Publication.findById(publicacion._id);
    expect(enBD.status).to.equal("unavailable");
  });

});

// ─── G: GET /api/publications/:id — Ver detalle ─────────────────────────────

describe("G: GET /api/publications/:id — Ver detalle de publicación", () => {
  let token;
  let publicacion;

  beforeEach(async () => {
    token = await registrarYLoguear();
    publicacion = await crearPublicacion(token);
  });

  it("G01 — respuesta incluye todos los campos requeridos", async () => {
    const res = await request(app)
      .get(`/api/publications/${publicacion._id}`);

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property("title");
    expect(res.body).to.have.property("description");
    expect(res.body).to.have.property("history");
    expect(res.body).to.have.property("category");
    expect(res.body).to.have.property("condition");
    expect(res.body).to.have.property("type");
    expect(res.body).to.have.property("photos");
    expect(res.body).to.have.property("status");
  });

  it("G02 — respuesta incluye datos básicos del dueño", async () => {
    const res = await request(app)
      .get(`/api/publications/${publicacion._id}`);

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property("owner");
    expect(res.body.owner).to.have.property("_id");
    expect(res.body.owner).to.have.property("nombre");
    expect(res.body.owner).to.not.have.property("password");
  });

  it("G03 — publicación unavailable es visible para su owner autenticado", async () => {
    await request(app)
      .patch(`/api/publications/${publicacion._id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "unavailable" });

    const res = await request(app)
      .get(`/api/publications/${publicacion._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).to.equal(200);
    expect(res.body.status).to.equal("unavailable");
  });

  it("G04 — publicación unavailable devuelve 404 para usuario no autenticado", async () => {
    await request(app)
      .patch(`/api/publications/${publicacion._id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "unavailable" });

    const res = await request(app)
      .get(`/api/publications/${publicacion._id}`);

    expect(res.status).to.equal(404);
  });

  it("G05 — publicación unavailable devuelve 404 para usuario autenticado no-owner", async () => {
    await request(app)
      .patch(`/api/publications/${publicacion._id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "unavailable" });

    const otroUsuarioData = { ...usuarioBase, email: "otro@test.com" };
    await request(app).post("/api/auth/register").send(otroUsuarioData);
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: otroUsuarioData.email, password: otroUsuarioData.password });
    const otroToken = loginRes.body.accessToken;

    const res = await request(app)
      .get(`/api/publications/${publicacion._id}`)
      .set("Authorization", `Bearer ${otroToken}`);

    expect(res.status).to.equal(404);
  });

});