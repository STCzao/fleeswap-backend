const request = require("supertest");
const { expect } = require("chai");
const mongoose = require("mongoose");
const app = require("../../src/app");
const User = require("../../src/models/User");
const Publication = require("../../src/models/Publication");
const { generateAccessToken } = require("../../src/helpers/generateToken");

const crearUsuarioConToken = async (overrides = {}) => {
  const user = await User.create({
    nombre: "Reco",
    apellido: "Test",
    fechaNacimiento: new Date("1995-06-15"),
    email: `reco_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`,
    password: "$2b$10$hashedpassword.placeholder.bcrypt.hash.here",
    role: "USER_ROLE",
    isVerified: true,
    isActive: true,
    preferredCategories: [],
    ...overrides,
  });

  return {
    user,
    token: generateAccessToken(user),
  };
};

const crearPublicacion = async (ownerId, overrides = {}) =>
  Publication.create({
    title: "Objeto recomendado",
    description: "Descripción válida para recomendaciones.",
    history: "Historia válida para recomendaciones.",
    category: "electronica",
    condition: "bueno",
    type: "trueque",
    photos: ["https://res.cloudinary.com/demo/image/upload/foto1.jpg"],
    status: "available",
    owner: ownerId,
    ...overrides,
  });

describe("Recommendations API", function () {
  this.timeout(30000);

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  after(async () => {
    await mongoose.disconnect();
  });

  describe("PATCH /api/users/me/profile", () => {
    let user;
    let token;

    beforeEach(async () => {
      ({ user, token } = await crearUsuarioConToken());
    });

    afterEach(async () => {
      await User.deleteOne({ _id: user._id });
    });

    it("guarda preferredCategories en el perfil del usuario", async () => {
      const res = await request(app)
        .patch("/api/users/me/profile")
        .set("Authorization", `Bearer ${token}`)
        .send({
          preferredCategories: ["electronica", "libros_comics"],
        });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("preferredCategories").that.deep.equals([
        "electronica",
        "libros_comics",
      ]);

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.preferredCategories).to.deep.equal([
        "electronica",
        "libros_comics",
      ]);
    });
  });

  describe("GET /api/publications/recommendations", () => {
    let user;
    let token;
    let otherUser;
    let ownPublication;
    let matchingPublication;
    let secondMatchingPublication;
    let nonMatchingPublication;
    let unavailableMatchingPublication;

    beforeEach(async () => {
      ({ user, token } = await crearUsuarioConToken({
        preferredCategories: ["electronica", "libros_comics"],
      }));
      ({ user: otherUser } = await crearUsuarioConToken());

      ownPublication = await crearPublicacion(user._id, {
        title: "Propia",
        category: "electronica",
      });
      matchingPublication = await crearPublicacion(otherUser._id, {
        title: "Match 1",
        category: "electronica",
      });
      secondMatchingPublication = await crearPublicacion(otherUser._id, {
        title: "Match 2",
        category: "libros_comics",
      });
      nonMatchingPublication = await crearPublicacion(otherUser._id, {
        title: "Sin match",
        category: "arte",
      });
      unavailableMatchingPublication = await crearPublicacion(otherUser._id, {
        title: "Match unavailable",
        category: "electronica",
        status: "unavailable",
      });
    });

    afterEach(async () => {
      await Publication.deleteMany({
        _id: {
          $in: [
            ownPublication._id,
            matchingPublication._id,
            secondMatchingPublication._id,
            nonMatchingPublication._id,
            unavailableMatchingPublication._id,
          ],
        },
      });
      await User.deleteOne({ _id: user._id });
      await User.deleteOne({ _id: otherUser._id });
    });

    it("devuelve publicaciones recomendadas segun preferredCategories", async () => {
      const res = await request(app)
        .get("/api/publications/recommendations")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("basedOnCategories").that.deep.equals([
        "electronica",
        "libros_comics",
      ]);
      expect(res.body).to.have.property("publications").that.is.an("array");

      const ids = res.body.publications.map((publication) => publication._id.toString());
      expect(ids).to.include(matchingPublication._id.toString());
      expect(ids).to.include(secondMatchingPublication._id.toString());
      expect(ids).to.not.include(ownPublication._id.toString());
      expect(ids).to.not.include(nonMatchingPublication._id.toString());
      expect(ids).to.not.include(unavailableMatchingPublication._id.toString());
    });

    it("devuelve lista vacia si el usuario no tiene preferredCategories", async () => {
      await User.findByIdAndUpdate(user._id, { preferredCategories: [] });

      const res = await request(app)
        .get("/api/publications/recommendations")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).to.equal(200);
      expect(res.body).to.deep.equal({
        publications: [],
        basedOnCategories: [],
      });
    });
  });
});
