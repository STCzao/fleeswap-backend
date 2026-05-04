require("dotenv").config();
const chai = require("chai");
const { expect } = chai;
const request = require("supertest");
const app = require("../src/app");
const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const User = require("../src/models/User");
const Publication = require("../src/models/Publication");
const Report = require("../src/models/Report");

describe("POST /api/publications/:id/report", () => {
  let token;
  let publicationId;

 before(async () => {
  await connectDB();

  // Usuario dueño de la publicación
  const ownerRes = await request(app)
    .post("/api/auth/register")
    .send({
      nombre: "Owner",
      apellido: "Test",
      email: "owner@test.com",
      password: "Password123!",
      confirmPassword: "Password123!",
      fechaNacimiento: "1995-01-01",
    });

  const ownerId = ownerRes.body.user._id;

  // Usuario que va a reportar
  const reporterRes = await request(app)
    .post("/api/auth/register")
    .send({
      nombre: "Reporter",
      apellido: "Test",
      email: "reporter@test.com",
      password: "Password123!",
      confirmPassword: "Password123!",
      fechaNacimiento: "1995-01-01",
    });

  token = reporterRes.body.accessToken;

  const pub = await Publication.create({
    owner: ownerId,
    title: "Publicación de prueba",
    description: "Descripción de prueba",
    history: "Historia de prueba",
    category: "electronica",
    condition: "nuevo",
    type: "trueque",
    photos: ["https://via.placeholder.com/150"],
  });

  publicationId = pub._id;
});

  after(async () => {
  await User.deleteMany({ email: { $in: ["owner@test.com", "reporter@test.com"] } });
  await Publication.deleteMany({ title: "Publicación de prueba" });
  await Report.deleteMany({});
  await User.deleteMany({ email: { $in: ["owner@test.com", "reporter@test.com", "reporter2@test.com"] } });
  await mongoose.connection.close();
});

  it("debería enviar un reporte válido y retornar 201", async () => {
    const res = await request(app)
      .post(`/api/publications/${publicationId}/report`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "objeto_falso" });

    expect(res.status).to.equal(201);
    expect(res.body).to.have.property("message", "Reporte enviado correctamente");
  });

  it("no debería permitir reportar la misma publicación dos veces", async () => {
    const res = await request(app)
        .post(`/api/publications/${publicationId}/report`)
        .set("Authorization", `Bearer ${token}`)
        .send({ reason: "objeto_falso" });

    expect(res.status).to.not.equal(201);
    expect(res.status).to.be.oneOf([400, 409]);
    });

    it("debería asociar el reporte a la publicación y al reporter correctamente", async () => {
    const report = await Report.findOne({ publicationId });

    expect(report).to.not.be.null;
    expect(report.publicationId.toString()).to.equal(publicationId.toString());
    expect(report.reason).to.equal("objeto_falso");
    });

    it("debería retornar el mensaje de confirmación correcto", async () => {
    // Registrar un segundo reporter para no chocar con el reporte ya existente
    const reporter2Res = await request(app)
        .post("/api/auth/register")
        .send({
        nombre: "Reporter",
        apellido: "Dos",
        email: "reporter2@test.com",
        password: "Password123!",
        confirmPassword: "Password123!",
        fechaNacimiento: "1995-01-01",
        });

    const token2 = reporter2Res.body.accessToken;

    const res = await request(app)
        .post(`/api/publications/${publicationId}/report`)
        .set("Authorization", `Bearer ${token2}`)
        .send({ reason: "descripcion_enganosa" });

    expect(res.status).to.equal(201);
    expect(res.body).to.have.property("message").that.is.a("string");
    expect(res.body.message).to.equal("Reporte enviado correctamente");
    });
});