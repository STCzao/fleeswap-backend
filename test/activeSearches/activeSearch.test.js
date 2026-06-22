const request = require("supertest");
const { expect } = require("chai");
const mongoose = require("mongoose");
const app = require("../../src/app");
const User = require("../../src/models/User");
const ActiveSearch = require("../../src/models/ActiveSearch");
const { generateAccessToken } = require("../../src/helpers/generateToken");
const { buildCriteriaSignature } = require("../../src/helpers/activeSearchCriteria");

const crearUsuarioConToken = async (overrides = {}) => {
  const user = await User.create({
    nombre: "Search",
    apellido: "Test",
    fechaNacimiento: new Date("1993-08-20"),
    email: `search_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`,
    password: "$2b$10$hashedpassword.placeholder.bcrypt.hash.here",
    role: "USER_ROLE",
    isVerified: true,
    isActive: true,
    ...overrides,
  });

  return {
    user,
    token: generateAccessToken(user),
  };
};

describe("Active Searches API", function () {
  this.timeout(30000);

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  after(async () => {
    await mongoose.disconnect();
  });

  describe("POST /api/active-searches", () => {
    let user;
    let token;

    beforeEach(async () => {
      ({ user, token } = await crearUsuarioConToken());
    });

    afterEach(async () => {
      await ActiveSearch.deleteMany({ user: user._id });
      await User.deleteOne({ _id: user._id });
    });

    it("crea un criterio de búsqueda activa para el usuario autenticado", async () => {
      const res = await request(app)
        .post("/api/active-searches")
        .set("Authorization", `Bearer ${token}`)
        .send({
          category: "electronica",
          keywords: [" Nintendo ", "switch", "switch"],
          type: "ambos",
        });

      expect(res.status).to.equal(201);
      expect(res.body).to.include({
        category: "electronica",
        type: "ambos",
        isActive: true,
      });
      expect(res.body.keywords).to.deep.equal(["nintendo", "switch"]);

      const saved = await ActiveSearch.findById(res.body._id);
      expect(saved).to.exist;
      expect(saved.user.toString()).to.equal(user._id.toString());
      expect(saved.keywords).to.deep.equal(["nintendo", "switch"]);
    });

    it("rechaza criterios duplicados para el mismo usuario", async () => {
      await ActiveSearch.create({
        user: user._id,
        category: "electronica",
        keywords: ["nintendo", "switch"],
        type: "ambos",
        criteriaSignature: JSON.stringify({
          category: "electronica",
          keywords: ["nintendo", "switch"],
          type: "ambos",
        }),
        isActive: true,
      });

      const res = await request(app)
        .post("/api/active-searches")
        .set("Authorization", `Bearer ${token}`)
        .send({
          category: "electronica",
          keywords: [" switch ", "Nintendo"],
          type: "ambos",
        });

      expect(res.status).to.equal(409);
      expect(res.body).to.deep.equal({
        message: "Ya existe un criterio de búsqueda igual",
      });
    });

    it("rechaza palabras clave que quedan demasiado cortas luego de sanitizarse", async () => {
      const res = await request(app)
        .post("/api/active-searches")
        .set("Authorization", `Bearer ${token}`)
        .send({
          category: "electronica",
          keywords: ["<b>a</b>"],
          type: "ambos",
        });

      expect(res.status).to.equal(400);
      expect(res.body.errors).to.deep.include({
        field: "keywords[0]",
        message: "Cada palabra clave debe tener entre 2 y 50 caracteres",
      });
    });

    it("rechaza acceso sin autenticación", async () => {
      const res = await request(app)
        .post("/api/active-searches")
        .send({
          category: "electronica",
          keywords: ["switch"],
          type: "ambos",
        });

      expect(res.status).to.equal(401);
    });
  });

  describe("GET /api/active-searches", () => {
    let user;
    let token;
    let firstSearch;
    let secondSearch;

    beforeEach(async () => {
      ({ user, token } = await crearUsuarioConToken());

      firstSearch = await ActiveSearch.create({
        user: user._id,
        category: "electronica",
        keywords: ["camara"],
        type: "venta",
        criteriaSignature: buildCriteriaSignature({
          category: "electronica",
          keywords: ["camara"],
          type: "venta",
        }),
        isActive: true,
      });

      secondSearch = await ActiveSearch.create({
        user: user._id,
        category: "libros_comics",
        keywords: ["batman"],
        type: "trueque",
        criteriaSignature: buildCriteriaSignature({
          category: "libros_comics",
          keywords: ["batman"],
          type: "trueque",
        }),
        isActive: false,
      });
    });

    afterEach(async () => {
      await ActiveSearch.deleteMany({
        _id: { $in: [firstSearch._id, secondSearch._id] },
      });
      await User.deleteOne({ _id: user._id });
    });

    it("lista los criterios del usuario autenticado", async () => {
      const res = await request(app)
        .get("/api/active-searches")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).to.equal(200);
      expect(res.body).to.be.an("array").with.length(2);

      const ids = res.body.map((search) => search._id.toString());
      expect(ids).to.include(firstSearch._id.toString());
      expect(ids).to.include(secondSearch._id.toString());
    });

    it("rechaza listado sin autenticación", async () => {
      const res = await request(app)
        .get("/api/active-searches");

      expect(res.status).to.equal(401);
    });
  });

  describe("PATCH /api/active-searches/:id", () => {
    let user;
    let token;
    let activeSearch;
    let duplicateSearch;
    let otherUser;
    let otherToken;

    beforeEach(async () => {
      ({ user, token } = await crearUsuarioConToken());
      ({ user: otherUser, token: otherToken } = await crearUsuarioConToken());

      activeSearch = await ActiveSearch.create({
        user: user._id,
        category: "electronica",
        keywords: ["camara"],
        type: "venta",
        criteriaSignature: buildCriteriaSignature({
          category: "electronica",
          keywords: ["camara"],
          type: "venta",
        }),
        isActive: true,
      });

      duplicateSearch = await ActiveSearch.create({
        user: user._id,
        category: "libros_comics",
        keywords: ["batman"],
        type: "trueque",
        criteriaSignature: buildCriteriaSignature({
          category: "libros_comics",
          keywords: ["batman"],
          type: "trueque",
        }),
        isActive: true,
      });
    });

    afterEach(async () => {
      await ActiveSearch.deleteMany({
        _id: { $in: [activeSearch._id, duplicateSearch._id] },
      });
      await User.deleteOne({ _id: user._id });
      await User.deleteOne({ _id: otherUser._id });
    });

    it("edita un criterio existente del usuario autenticado", async () => {
      const res = await request(app)
        .patch(`/api/active-searches/${activeSearch._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          category: "arte",
          keywords: [" oleo ", "canvas"],
          type: "ambos",
          isActive: false,
        });

      expect(res.status).to.equal(200);
      expect(res.body).to.include({
        category: "arte",
        type: "ambos",
        isActive: false,
      });
      expect(res.body.keywords).to.deep.equal(["canvas", "oleo"]);
    });

    it("permite activar o desactivar sin cambiar el resto del criterio", async () => {
      const res = await request(app)
        .patch(`/api/active-searches/${activeSearch._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          isActive: false,
        });

      expect(res.status).to.equal(200);
      expect(res.body).to.include({
        category: "electronica",
        type: "venta",
        isActive: false,
      });
      expect(res.body.keywords).to.deep.equal(["camara"]);
    });

    it("rechaza editar un criterio de otro usuario", async () => {
      const res = await request(app)
        .patch(`/api/active-searches/${activeSearch._id}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .send({
          isActive: false,
        });

      expect(res.status).to.equal(403);
      expect(res.body).to.deep.equal({
        message: "No autorizado",
      });
    });

    it("rechaza editar un criterio hacia un duplicado logico", async () => {
      const res = await request(app)
        .patch(`/api/active-searches/${activeSearch._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          category: "libros_comics",
          keywords: [" Batman "],
          type: "trueque",
        });

      expect(res.status).to.equal(409);
      expect(res.body).to.deep.equal({
        message: "Ya existe un criterio de búsqueda igual",
      });
    });

    it("rechaza editar un criterio inexistente", async () => {
      const nonExistingId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .patch(`/api/active-searches/${nonExistingId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          isActive: false,
        });

      expect(res.status).to.equal(404);
      expect(res.body).to.deep.equal({
        message: "Criterio de búsqueda no encontrado",
      });
    });

    it("rechaza editar con body vacio", async () => {
      const res = await request(app)
        .patch(`/api/active-searches/${activeSearch._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).to.equal(400);
      expect(res.body).to.deep.equal({
        message: "Solicitud inválida",
      });
    });

    it("rechaza editar con isActive inválido", async () => {
      const res = await request(app)
        .patch(`/api/active-searches/${activeSearch._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          isActive: "quizas",
        });

      expect(res.status).to.equal(400);
      expect(res.body.errors).to.deep.include({
        field: "isActive",
        message: "isActive debe ser booleano",
      });
    });

    it("rechaza editar sin autenticación", async () => {
      const res = await request(app)
        .patch(`/api/active-searches/${activeSearch._id}`)
        .send({
          isActive: false,
        });

      expect(res.status).to.equal(401);
    });
  });

  describe("DELETE /api/active-searches/:id", () => {
    let user;
    let token;
    let activeSearch;
    let otherUser;
    let otherToken;

    beforeEach(async () => {
      ({ user, token } = await crearUsuarioConToken());
      ({ user: otherUser, token: otherToken } = await crearUsuarioConToken());

      activeSearch = await ActiveSearch.create({
        user: user._id,
        category: "electronica",
        keywords: ["camara"],
        type: "venta",
        criteriaSignature: buildCriteriaSignature({
          category: "electronica",
          keywords: ["camara"],
          type: "venta",
        }),
        isActive: true,
      });
    });

    afterEach(async () => {
      await ActiveSearch.deleteMany({ _id: activeSearch._id });
      await User.deleteOne({ _id: user._id });
      await User.deleteOne({ _id: otherUser._id });
    });

    it("elimina un criterio propio", async () => {
      const res = await request(app)
        .delete(`/api/active-searches/${activeSearch._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).to.equal(200);
      expect(res.body).to.deep.equal({
        message: "Criterio de búsqueda eliminado correctamente",
      });

      const deleted = await ActiveSearch.findById(activeSearch._id);
      expect(deleted).to.equal(null);
    });

    it("rechaza eliminar un criterio de otro usuario", async () => {
      const res = await request(app)
        .delete(`/api/active-searches/${activeSearch._id}`)
        .set("Authorization", `Bearer ${otherToken}`);

      expect(res.status).to.equal(403);
      expect(res.body).to.deep.equal({
        message: "No autorizado",
      });
    });

    it("rechaza eliminar un criterio inexistente", async () => {
      const nonExistingId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .delete(`/api/active-searches/${nonExistingId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).to.equal(404);
      expect(res.body).to.deep.equal({
        message: "Criterio de búsqueda no encontrado",
      });
    });

    it("rechaza eliminar sin autenticación", async () => {
      const res = await request(app)
        .delete(`/api/active-searches/${activeSearch._id}`);

      expect(res.status).to.equal(401);
    });
  });
});
