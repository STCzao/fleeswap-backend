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

  describe("POST /api/auth/refresh", () => {
    const registrarUsuario = async (email) => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          nombre: "Refresh",
          apellido: "User",
          fechaNacimiento: "2000-01-01",
          email,
          password: "Password123!",
          confirmPassword: "Password123!",
        });

      const refreshCookie = res.headers["set-cookie"].find((c) => c.startsWith("refreshToken="));
      return { accessToken: res.body.accessToken, refreshCookie };
    };

    it("refresh válido -> 200 + nuevo accessToken + rota la cookie", async () => {
      const { accessToken, refreshCookie } = await registrarUsuario("refresh@test.com");

      // El JWT se firma con granularidad de segundo (iat) y sin jti: si se generara
      // en el mismo segundo que el original, el token "nuevo" sería bit-idéntico.
      // Se espera >1s para que la comparación de rotación sea determinista.
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const res = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", refreshCookie);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("accessToken");
      expect(res.body.accessToken).to.not.equal(accessToken);

      const nuevaCookie = res.headers["set-cookie"].find((c) => c.startsWith("refreshToken="));
      expect(nuevaCookie).to.exist;
      expect(nuevaCookie.split(";")[0]).to.not.equal(refreshCookie.split(";")[0]);
    });

    it("sin cookie -> 401", async () => {
      const res = await request(app).post("/api/auth/refresh");

      expect(res.status).to.equal(401);
      expect(res.body).to.have.property("message", "Refresh token no proporcionado");
    });

    it("refresh token ya rotado (reutilizado) -> 401", async () => {
      const { refreshCookie } = await registrarUsuario("refresh-rotado@test.com");

      // Esperar >1s: ver comentario del test anterior sobre granularidad de iat.
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Primer refresh: rota el token y deja el viejo invalidado en DB.
      await request(app).post("/api/auth/refresh").set("Cookie", refreshCookie);

      // Reintentar con la cookie vieja debe fallar.
      const res = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", refreshCookie);

      expect(res.status).to.equal(401);
    });

    it("token con firma inválida -> 401", async () => {
      const tokenFalso = jwt.sign({ id: "000000000000000000000001" }, "secret-incorrecto");

      const res = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", `refreshToken=${tokenFalso}`);

      expect(res.status).to.equal(401);
      expect(res.body).to.have.property("message", "Refresh token inválido");
    });
  });

  describe("POST /api/auth/logout", () => {
    it("logout con sesión activa -> 200 + limpia la cookie + revoca el refresh token en DB", async () => {
      const registerRes = await request(app)
        .post("/api/auth/register")
        .send({
          nombre: "Logout",
          apellido: "User",
          fechaNacimiento: "2000-01-01",
          email: "logout@test.com",
          password: "Password123!",
          confirmPassword: "Password123!",
        });

      const refreshCookie = registerRes.headers["set-cookie"].find((c) => c.startsWith("refreshToken="));

      const res = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", refreshCookie);

      expect(res.status).to.equal(200);
      expect(res.headers["set-cookie"].some((c) => c.startsWith("refreshToken=;"))).to.equal(true);

      // El refresh token revocado ya no debe poder usarse.
      const refreshRes = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", refreshCookie);
      expect(refreshRes.status).to.equal(401);
    });

    it("logout sin cookie -> 200 (la sesión ya estaba cerrada, no es un error)", async () => {
      const res = await request(app).post("/api/auth/logout");

      expect(res.status).to.equal(200);
    });
  });

  describe("POST /api/auth/forgot-password", () => {
    it("email existente -> 200 + envía el email de recuperación con token", async () => {
      await request(app)
        .post("/api/auth/register")
        .send({
          nombre: "Forgot",
          apellido: "User",
          fechaNacimiento: "2000-01-01",
          email: "forgot@test.com",
          password: "Password123!",
          confirmPassword: "Password123!",
        });

      sentEmails = [];

      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "forgot@test.com" });

      expect(res.status).to.equal(200);
      expect(sentEmails).to.have.length(1);
      expect(extractTokenFromHtml(sentEmails[0].html, "/reset-password")).to.be.a("string");
    });

    it("email inexistente -> 200 + mismo mensaje (no revela si el email existe)", async () => {
      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "noexiste-forgot@test.com" });

      expect(res.status).to.equal(200);
      expect(sentEmails).to.have.length(0);
    });

    it("email con formato inválido -> 400", async () => {
      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "no-es-un-email" });

      expect(res.status).to.equal(400);
    });
  });

  describe("POST /api/auth/reset-password", () => {
    it("token válido -> 200 + permite loguear con la nueva contraseña", async () => {
      await request(app)
        .post("/api/auth/register")
        .send({
          nombre: "Reset",
          apellido: "User",
          fechaNacimiento: "2000-01-01",
          email: "reset@test.com",
          password: "Password123!",
          confirmPassword: "Password123!",
        });

      sentEmails = [];
      await request(app).post("/api/auth/forgot-password").send({ email: "reset@test.com" });
      const token = extractTokenFromHtml(sentEmails[0].html, "/reset-password");

      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ token, password: "NuevaPass123!", confirmPassword: "NuevaPass123!" });

      expect(res.status).to.equal(200);

      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "reset@test.com", password: "NuevaPass123!" });
      expect(loginRes.status).to.equal(200);

      const loginViejaRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "reset@test.com", password: "Password123!" });
      expect(loginViejaRes.status).to.equal(401);
    });

    it("token inexistente -> 400", async () => {
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: "f".repeat(64), password: "NuevaPass123!", confirmPassword: "NuevaPass123!" });

      expect(res.status).to.equal(400);
    });

    it("contraseñas que no coinciden -> 400 del validador", async () => {
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: "f".repeat(64), password: "NuevaPass123!", confirmPassword: "Distinta123!" });

      expect(res.status).to.equal(400);
    });
  });
});
