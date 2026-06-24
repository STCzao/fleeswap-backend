const request = require("supertest");
const { expect } = require("chai");
const mongoose = require("mongoose");
const app = require("../../../src/app");
const User = require("../../../src/models/User");

const registrarUsuario = async (email, password = "Password123!") => {
  const res = await request(app)
    .post("/api/auth/register")
    .send({
      nombre: "Cuenta",
      apellido: "Test",
      fechaNacimiento: "2000-01-01",
      email,
      password,
      confirmPassword: password,
    });

  return { accessToken: res.body.accessToken, userId: res.body.user._id };
};

describe("DELETE /api/users/me — Eliminar cuenta", () => {
  before(async () => {
    await mongoose.connect(process.env.MONGO_URI);
  });

  afterEach(async () => {
    await User.deleteMany({ email: /test\.com$/ });
  });

  after(async () => {
    await mongoose.disconnect();
  });

  it("contraseña correcta -> 200 + soft-delete (isActive=false, deletedAt seteado) + limpia la cookie", async () => {
    const { accessToken, userId } = await registrarUsuario("borrarcuenta@test.com");

    const res = await request(app)
      .delete("/api/users/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ password: "Password123!" });

    expect(res.status).to.equal(200);
    expect(res.headers["set-cookie"].some((c) => c.startsWith("refreshToken=;"))).to.equal(true);

    // El query middleware del modelo excluye usuarios inactivos por defecto;
    // hay que incluir "isActive" explícito en el filtro para poder verlos.
    const userEliminado = await User.findOne({ _id: userId, isActive: { $in: [true, false] } });
    expect(userEliminado.isActive).to.equal(false);
    expect(userEliminado.deletedAt).to.be.instanceOf(Date);
  });

  it("contraseña incorrecta -> 401 + la cuenta sigue activa", async () => {
    const { accessToken, userId } = await registrarUsuario("borrarcuenta-mal@test.com");

    const res = await request(app)
      .delete("/api/users/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ password: "ContraseñaIncorrecta1!" });

    expect(res.status).to.equal(401);

    const user = await User.findById(userId);
    expect(user).to.exist;
    expect(user.isActive).to.equal(true);
  });

  it("sin password en el body -> 400 del validador", async () => {
    const { accessToken } = await registrarUsuario("borrarcuenta-sinpass@test.com");

    const res = await request(app)
      .delete("/api/users/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(res.status).to.equal(400);
  });

  it("sin token -> 401", async () => {
    const res = await request(app)
      .delete("/api/users/me")
      .send({ password: "Password123!" });

    expect(res.status).to.equal(401);
  });

  it("cuenta eliminada ya no permite loguear con normalidad pero sí dentro del período de gracia (reactivación)", async () => {
    await registrarUsuario("borrarcuenta-relogin@test.com");

    const loginInicial = await request(app)
      .post("/api/auth/login")
      .send({ email: "borrarcuenta-relogin@test.com", password: "Password123!" });

    await request(app)
      .delete("/api/users/me")
      .set("Authorization", `Bearer ${loginInicial.body.accessToken}`)
      .send({ password: "Password123!" });

    const loginPostBorrado = await request(app)
      .post("/api/auth/login")
      .send({ email: "borrarcuenta-relogin@test.com", password: "Password123!" });

    expect(loginPostBorrado.status).to.equal(200);
    expect(loginPostBorrado.body).to.have.property("reactivated", true);
  });
});
