const request = require("supertest");
const { expect } = require("chai");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const app = require("../../../src/app");
const User = require("../../../src/models/User");
const resend = require("../../../src/config/resend");

const extractTokenFromHtml = (html, path) => {
  const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`${escapedPath}\\?token=([a-f0-9]{64})`, "i"));
  return match ? match[1] : null;
};

describe("Auth API", function () {
  this.timeout(30000);

  let sentEmails;
  let originalSend;

  before(async () => {
    await mongoose.connect(process.env.MONGO_URI);
  });

  beforeEach(() => {
    sentEmails = [];
    originalSend = resend.emails.send;
    resend.emails.send = async (payload) => {
      sentEmails.push(payload);
      return { id: `mock-${sentEmails.length}` };
    };
  });

  afterEach(async () => {
    resend.emails.send = originalSend;
    await User.deleteMany({ email: /test\.com$/ });
  });

  after(async () => {
    await mongoose.disconnect();
  });

  describe("POST /api/auth/register", () => {
    it("registro exitoso -> 201 + accessToken + user sin password", async () => {
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

    it("email duplicado -> 409", async () => {
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

    it("registro crea usuario no verificado con token persistido y envia email", async () => {
      await request(app)
        .post("/api/auth/register")
        .send({
          nombre: "Token",
          apellido: "Test",
          fechaNacimiento: "2000-01-01",
          email: "verify-register@test.com",
          password: "Password123!",
          confirmPassword: "Password123!",
        });

      const user = await User.findOne({ email: "verify-register@test.com" }).select("+verificationToken");

      expect(user).to.exist;
      expect(user.isVerified).to.equal(false);
      expect(user.verificationToken).to.be.a("string").with.length(64);
      expect(user.verificationTokenExpiry).to.be.instanceOf(Date);
      expect(sentEmails).to.have.length(1);
      expect(sentEmails[0].subject).to.include("Verifica tu email");
      expect(extractTokenFromHtml(sentEmails[0].html, "/verify-email")).to.be.a("string");
    });
  });

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      await request(app).post("/api/auth/register").send({
        nombre: "Login",
        apellido: "Test",
        fechaNacimiento: "2000-01-01",
        email: "login@test.com",
        password: "Password123!",
        confirmPassword: "Password123!",
      });
    });

    it("login exitoso -> 200 + accessToken en body + user sin password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "login@test.com", password: "Password123!" });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("accessToken");
      expect(res.body).to.have.property("user");
      expect(res.body.user).to.not.have.property("password");
    });

    it("email inexistente -> 401 + mensaje generico", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "noexiste@test.com", password: "Password123!" });

      expect(res.status).to.equal(401);
      expect(res.body).to.have.property("message", "Credenciales inválidas");
    });

    it("contraseña incorrecta -> 401 + mismo mensaje generico", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "login@test.com", password: "Incorrecta123!" });

      expect(res.status).to.equal(401);
      expect(res.body).to.have.property("message", "Credenciales inválidas");
    });
  });

  describe("POST /api/auth/verify-email", () => {
    it("verifica el email con token válido y limpia los campos auxiliares", async () => {
      await request(app)
        .post("/api/auth/register")
        .send({
          nombre: "Verify",
          apellido: "User",
          fechaNacimiento: "2000-01-01",
          email: "verify@test.com",
          password: "Password123!",
          confirmPassword: "Password123!",
        });

      const token = extractTokenFromHtml(sentEmails[0].html, "/verify-email");
      expect(token).to.be.a("string").with.length(64);

      const res = await request(app)
        .post("/api/auth/verify-email")
        .send({ token });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("message");

      const user = await User.findOne({ email: "verify@test.com" }).select("+verificationToken");
      expect(user.isVerified).to.equal(true);
      expect(user.verificationToken).to.equal(null);
      expect(user.verificationTokenExpiry).to.equal(null);
    });

    it("rechaza token inexistente", async () => {
      const res = await request(app)
        .post("/api/auth/verify-email")
        .send({ token: "f".repeat(64) });

      expect(res.status).to.equal(400);
    });
  });

  describe("POST /api/auth/resend-verification", () => {
    it("rota el token para un usuario no verificado autenticado", async () => {
      const registerRes = await request(app)
        .post("/api/auth/register")
        .send({
          nombre: "Resend",
          apellido: "User",
          fechaNacimiento: "2000-01-01",
          email: "resend@test.com",
          password: "Password123!",
          confirmPassword: "Password123!",
        });

      const before = await User.findOne({ email: "resend@test.com" }).select("+verificationToken");
      const firstToken = extractTokenFromHtml(sentEmails[0].html, "/verify-email");

      sentEmails = [];

      const res = await request(app)
        .post("/api/auth/resend-verification")
        .set("Authorization", `Bearer ${registerRes.body.accessToken}`)
        .send();

      expect(res.status).to.equal(200);
      expect(sentEmails).to.have.length(1);

      const secondToken = extractTokenFromHtml(sentEmails[0].html, "/verify-email");
      const after = await User.findOne({ email: "resend@test.com" }).select("+verificationToken");

      expect(secondToken).to.be.a("string").with.length(64);
      expect(secondToken).to.not.equal(firstToken);
      expect(after.verificationToken).to.not.equal(before.verificationToken);
      expect(after.verificationTokenExpiry.getTime()).to.be.at.least(before.verificationTokenExpiry.getTime());
    });

    it("rechaza el reenvio si el usuario ya está verificado", async () => {
      const registerRes = await request(app)
        .post("/api/auth/register")
        .send({
          nombre: "Verified",
          apellido: "User",
          fechaNacimiento: "2000-01-01",
          email: "verified@test.com",
          password: "Password123!",
          confirmPassword: "Password123!",
        });

      const token = extractTokenFromHtml(sentEmails[0].html, "/verify-email");

      await request(app)
        .post("/api/auth/verify-email")
        .send({ token });

      const res = await request(app)
        .post("/api/auth/resend-verification")
        .set("Authorization", `Bearer ${registerRes.body.accessToken}`)
        .send();

      expect(res.status).to.equal(400);
    });
  });

  describe("Rutas protegidas - authenticate middleware", () => {
    it("sin token -> 401", async () => {
      const res = await request(app)
        .patch("/api/auth/change-password")
        .send({ passwordActual: "Password123!", passwordNueva: "Nueva123!" });

      expect(res.status).to.equal(401);
      expect(res.body).to.have.property("message", "Token no proporcionado");
    });

    it("token inválido -> 401", async () => {
      const res = await request(app)
        .patch("/api/auth/change-password")
        .set("Authorization", "Bearer tokenbasurainvalido")
        .send({ passwordActual: "Password123!", passwordNueva: "Nueva123!" });

      expect(res.status).to.equal(401);
      expect(res.body).to.have.property("message", "Token inválido");
    });

    it("token expirado -> 401", async () => {
      const tokenExpirado = jwt.sign(
        { id: "000000000000000000000001" },
        process.env.JWT_SECRET,
        { expiresIn: "1ms" },
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
});
