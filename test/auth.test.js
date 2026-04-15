const request = require("supertest");
const { expect } = require("chai");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");

before(async () => {
  await mongoose.connect(process.env.MONGO_URI);
});

afterEach(async () => {
  await User.deleteMany({ email: /test\.com$/ });
});

after(async () => {
  await mongoose.disconnect();
});

describe("POST /api/auth/register", () => {

  it("registro exitoso → 201 + accessToken + user sin password", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        nombre: "Juan",
        apellido: "Perez",
        fechaNacimiento: "2000-01-01",
        email: "juan@test.com",
        password: "Password123!",
        confirmPassword: "Password123!",
      });

    expect(res.status).to.equal(201);
    expect(res.body).to.have.property("accessToken");
    expect(res.body).to.have.property("user");
    expect(res.body.user).to.not.have.property("password");
  });



it("email duplicado → 409", async () => {
    const usuario = {
      nombre: "Juan",
      apellido: "Perez",
      fechaNacimiento: "2000-01-01",
      email: "duplicado@test.com",
      password: "Password123!",
      confirmPassword: "Password123!",
    };

    await request(app).post("/api/auth/register").send(usuario);
    const res = await request(app).post("/api/auth/register").send(usuario);

    expect(res.status).to.equal(409);
    expect(res.body).to.have.property("message");
  });

  it("password no aparece en la respuesta", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        nombre: "Juan",
        apellido: "Perez",
        fechaNacimiento: "2000-01-01",
        email: "sinpassword@test.com",
        password: "Password123!",
        confirmPassword: "Password123!",
      });

    expect(res.body.user).to.not.have.property("password");
    expect(res.body).to.not.have.property("password");
  });

  });

describe("POST /api/auth/login", () => {

  // Crea un usuario real antes de los tests de login
  let usuarioBase;
  beforeEach(async () => {
    usuarioBase = {
      nombre: "Login",
      apellido: "Test",
      fechaNacimiento: "2000-01-01",
      email: "login@test.com",
      password: "Password123!",
      confirmPassword: "Password123!",
    };
    await request(app).post("/api/auth/register").send(usuarioBase);
  });

  it("login exitoso → 200 + accessToken en body + user sin password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@test.com", password: "Password123!" });

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property("accessToken");
    expect(res.body).to.have.property("user");
    expect(res.body.user).to.not.have.property("password");
  });

  it("email inexistente → 401 + mensaje genérico", async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "noexiste@test.com", password: "Password123!" });

  expect(res.status).to.equal(401);
  expect(res.body).to.have.property("message", "Credenciales inválidas");
});

it("contraseña incorrecta → 401 + mismo mensaje genérico", async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "login@test.com", password: "Incorrecta123!" });

  expect(res.status).to.equal(401);
  expect(res.body).to.have.property("message", "Credenciales inválidas");
});

});

describe("Rutas protegidas — authenticate middleware", () => {

  it("sin token → 401", async () => {
    const res = await request(app)
      .patch("/api/auth/change-password")
      .send({ passwordActual: "Password123!", passwordNueva: "Nueva123!" });

    expect(res.status).to.equal(401);
    expect(res.body).to.have.property("message", "Token no proporcionado");
  });

  it("token inválido → 401", async () => {
    const res = await request(app)
      .patch("/api/auth/change-password")
      .set("Authorization", "Bearer tokenbasurainvalido")
      .send({ passwordActual: "Password123!", passwordNueva: "Nueva123!" });

    expect(res.status).to.equal(401);
    expect(res.body).to.have.property("message", "Token inválido");
  });

  it("token expirado → 401", async () => {
  const jwt = require("jsonwebtoken");

  const tokenExpirado = jwt.sign(
    { id: "000000000000000000000001" },
    process.env.JWT_SECRET,
    { expiresIn: "1ms" }
  );

  await new Promise((resolve) => setTimeout(resolve, 10));

  const res = await request(app)
    .patch("/api/auth/change-password")
    .set("Authorization", `Bearer ${tokenExpirado}`)
    .send({ passwordActual: "Password123!", passwordNueva: "Nueva123!" });

  expect(res.status).to.equal(401);
  expect(res.body).to.have.property("message", "Token expirado");
});

});