const request = require("supertest");
const { expect } = require("chai");
const mongoose = require("mongoose");
const app = require("../../src/app");
const connectDB = require("../../src/config/db");
const User = require("../../src/models/User");
const Publication = require("../../src/models/Publication");
const Report = require("../../src/models/Report");
const Exchange = require("../../src/models/Exchange");

describe("Admin API", () => {
  let adminToken;
  let userToken;
  let adminId;
  let userId;
  let publicationId;
  let publicationSuspendId;
  let reportDismissId;
  let reportSuspendId;

  const registerUser = async ({
    nombre,
    apellido,
    email,
    password = "Password123!",
    fechaNacimiento = "1995-01-01",
  }) => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        nombre,
        apellido,
        email,
        password,
        confirmPassword: password,
        fechaNacimiento,
      });

    return res.body;
  };

  const loginUser = async (email, password = "Password123!") => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password });

    return res.body;
  };

  before(async () => {
    await connectDB();

    const adminRegister = await registerUser({
      nombre: "Admin",
      apellido: "Test",
      email: "admin@admin-test.com",
    });
    adminId = adminRegister.user._id;

    await User.findByIdAndUpdate(adminId, { role: "ADMIN_ROLE" });

    const adminLogin = await loginUser("admin@admin-test.com");
    adminToken = adminLogin.accessToken;

    const userRegister = await registerUser({
      nombre: "User",
      apellido: "AdminTest",
      email: "user@admin-test.com",
    });
    userId = userRegister.user._id;

    const userLogin = await loginUser("user@admin-test.com");
    userToken = userLogin.accessToken;

    const publication = await Publication.create({
      owner: userId,
      title: "Pub Admin Test",
      description: "Descripción para pruebas admin",
      history: "Historia de la publicación admin test",
      category: "electronica",
      condition: "nuevo",
      type: "trueque",
      status: "available",
      photos: ["https://via.placeholder.com/150"],
    });
    publicationId = publication._id;

    const suspendPublication = await Publication.create({
      owner: userId,
      title: "Pub Admin Test",
      description: "Descripción para suspensión admin",
      history: "Historia para suspensión admin test",
      category: "electronica",
      condition: "bueno",
      type: "venta",
      status: "available",
      photos: ["https://via.placeholder.com/151"],
    });
    publicationSuspendId = suspendPublication._id;

    const [dismissReport, suspendReport] = await Report.create([
      {
        publicationId,
        reporterId: adminId,
        reason: "spam",
        status: "pending",
      },
      {
        publicationId: publicationSuspendId,
        reporterId: adminId,
        reason: "spam",
        status: "pending",
      },
    ]);

    reportDismissId = dismissReport._id;
    reportSuspendId = suspendReport._id;

    await Exchange.create({
      offeredPublication: publicationSuspendId,
      requestedPublication: publicationId,
      requester: adminId,
      owner: userId,
      status: "active",
    });
  });

  after(async () => {
    await Exchange.deleteMany({
      $or: [
        { requester: adminId },
        { owner: userId },
      ],
    });
    await Report.deleteMany({ reason: "spam" });
    await Publication.deleteMany({ title: "Pub Admin Test" });
    await User.deleteMany({ email: /@admin-test\.com$/ });
    await mongoose.disconnect();
  });

  describe("GET /api/admin/stats", () => {
    it("H7.1 - 200 con las 4 métricas para admin", async () => {
      const res = await request(app)
        .get("/api/admin/stats")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("usuariosActivos").that.is.a("number");
      expect(res.body).to.have.property("publicacionesActivas").that.is.a("number");
      expect(res.body).to.have.property("reportesPendientes").that.is.a("number");
      expect(res.body).to.have.property("intercambiosActivos").that.is.a("number");
    });

    it("H7.1 - 401 sin token", async () => {
      const res = await request(app).get("/api/admin/stats");

      expect(res.status).to.equal(401);
      expect(res.body).to.have.property("message", "Token no proporcionado");
    });

    it("H7.1 - 403 con token de usuario normal", async () => {
      const res = await request(app)
        .get("/api/admin/stats")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).to.equal(403);
      expect(res.body).to.have.property("message", "No tenés permisos para realizar esta acción");
    });
  });

  describe("GET /api/admin/users", () => {
    it("H7.2 - 200 lista paginada", async () => {
      const res = await request(app)
        .get("/api/admin/users")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("usuarios").that.is.an("array");
      expect(res.body).to.have.property("total").that.is.a("number");
      expect(res.body).to.have.property("pagina").that.is.a("number");
      expect(res.body).to.have.property("totalPaginas").that.is.a("number");
    });

    it("H7.2 - filtra por role=USER_ROLE", async () => {
      const res = await request(app)
        .get("/api/admin/users?role=USER_ROLE")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.usuarios).to.be.an("array").that.is.not.empty;
      res.body.usuarios.forEach((usuario) => {
        expect(usuario.role).to.equal("USER_ROLE");
      });
    });

    it("H7.2 - filtra por isActive=true", async () => {
      const res = await request(app)
        .get("/api/admin/users?isActive=true")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.usuarios).to.be.an("array").that.is.not.empty;
      res.body.usuarios.forEach((usuario) => {
        expect(usuario.isActive).to.equal(true);
      });
    });

    it("H7.2 - filtra por search", async () => {
      const res = await request(app)
        .get("/api/admin/users?search=user")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.usuarios).to.be.an("array");
      expect(
        res.body.usuarios.some((usuario) =>
          [usuario.nombre, usuario.apellido, usuario.email]
            .filter(Boolean)
            .some((valor) => valor.toLowerCase().includes("user"))
        )
      ).to.equal(true);
    });

    it("H7.2 - paginacion page=1", async () => {
      const res = await request(app)
        .get("/api/admin/users?page=1")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("pagina", 1);
    });

    it("H7.2 - 401 sin token", async () => {
      const res = await request(app).get("/api/admin/users");

      expect(res.status).to.equal(401);
      expect(res.body).to.have.property("message", "Token no proporcionado");
    });

    it("H7.2 - 403 con token de usuario normal", async () => {
      const res = await request(app)
        .get("/api/admin/users")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).to.equal(403);
      expect(res.body).to.have.property("message", "No tenés permisos para realizar esta acción");
    });

    it("H7.2 - 400 con role inválido", async () => {
      const res = await request(app)
        .get("/api/admin/users?role=INVALID_ROLE")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("errors").that.is.an("array");
      expect(res.body.errors[0]).to.deep.equal({
        field: "role",
        message: "Rol inválido",
      });
    });
  });

  describe("GET /api/admin/reports", () => {
    it("H7.5 - 200 lista paginada con relaciones populadas", async () => {
      const res = await request(app)
        .get("/api/admin/reports")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("reportes").that.is.an("array");
      expect(res.body).to.have.property("total").that.is.a("number");
      expect(res.body).to.have.property("pagina").that.is.a("number");
      expect(res.body).to.have.property("totalPaginas").that.is.a("number");
      expect(res.body.reportes).to.be.an("array").that.is.not.empty;
      res.body.reportes.forEach((reporte) => {
        expect(reporte.publicationId).to.be.an("object");
        expect(reporte.publicationId).to.have.property("_id");
        expect(reporte.reporterId).to.be.an("object");
        expect(reporte.reporterId).to.have.property("_id");
      });
    });

    it("H7.5 - filtra por status=pending", async () => {
      const res = await request(app)
        .get("/api/admin/reports?status=pending")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.reportes).to.be.an("array").that.is.not.empty;
      res.body.reportes.forEach((reporte) => {
        expect(reporte.status).to.equal("pending");
      });
    });

    it("H7.5 - filtra por reason=spam", async () => {
      const res = await request(app)
        .get("/api/admin/reports?reason=spam")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.reportes).to.be.an("array").that.is.not.empty;
      res.body.reportes.forEach((reporte) => {
        expect(reporte.reason).to.equal("spam");
      });
    });

    it("H7.5 - 401 sin token", async () => {
      const res = await request(app).get("/api/admin/reports");

      expect(res.status).to.equal(401);
      expect(res.body).to.have.property("message", "Token no proporcionado");
    });

    it("H7.5 - 403 con token de usuario normal", async () => {
      const res = await request(app)
        .get("/api/admin/reports")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).to.equal(403);
      expect(res.body).to.have.property("message", "No tenés permisos para realizar esta acción");
    });

    it("H7.5 - 400 con status inválido", async () => {
      const res = await request(app)
        .get("/api/admin/reports?status=INVALIDO")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("errors").that.is.an("array");
      expect(res.body.errors[0]).to.deep.equal({
        field: "status",
        message: "Estado de reporte inválido",
      });
    });
  });

  describe("PATCH /api/admin/reports/:id/resolve", () => {
    it("H7.5 - 200 con action dismiss", async () => {
      const res = await request(app)
        .patch(`/api/admin/reports/${reportDismissId}/resolve`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ action: "dismiss" });

      const publication = await Publication.findById(publicationId);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("status", "dismissed");
      expect(publication.status).to.equal("available");
    });

    it("H7.5 - 200 con action suspend_publication", async () => {
      const res = await request(app)
        .patch(`/api/admin/reports/${reportSuspendId}/resolve`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ action: "suspend_publication" });

      const publication = await Publication.findById(publicationSuspendId);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("status", "reviewed");
      expect(publication.status).to.equal("suspended");
    });

    it("H7.5 - 400 al intentar resolver un reporte ya resuelto", async () => {
      const res = await request(app)
        .patch(`/api/admin/reports/${reportSuspendId}/resolve`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ action: "dismiss" });

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("message", "El reporte ya fue resuelto");
    });

    it("H7.5 - 404 con id inexistente", async () => {
      const reportId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/admin/reports/${reportId}/resolve`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ action: "dismiss" });

      expect(res.status).to.equal(404);
      expect(res.body).to.have.property("message", "Reporte no encontrado");
    });

    it("H7.5 - 400 con action inválida", async () => {
      const reportId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/admin/reports/${reportId}/resolve`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ action: "INVALIDA" });

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("errors").that.is.an("array");
      expect(res.body.errors[0]).to.deep.equal({
        field: "action",
        message: "Accion inválida",
      });
    });

    it("H7.5 - 400 sin action", async () => {
      const reportId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/admin/reports/${reportId}/resolve`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("errors").that.is.an("array");
      expect(res.body.errors[0]).to.deep.equal({
        field: "action",
        message: "La accion es requerida",
      });
    });

    it("H7.5 - 401 sin token", async () => {
      const res = await request(app)
        .patch(`/api/admin/reports/${reportDismissId}/resolve`)
        .send({ action: "dismiss" });

      expect(res.status).to.equal(401);
      expect(res.body).to.have.property("message", "Token no proporcionado");
    });

    it("H7.5 - 403 con token de usuario normal", async () => {
      const res = await request(app)
        .patch(`/api/admin/reports/${reportDismissId}/resolve`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ action: "dismiss" });

      expect(res.status).to.equal(403);
      expect(res.body).to.have.property("message", "No tenés permisos para realizar esta acción");
    });
  });
});
