const request = require("supertest");
const { expect } = require("chai");
const mongoose = require("mongoose");
const app = require("../../src/app");
const User = require("../../src/models/User");
const Publication = require("../../src/models/Publication");
const Exchange = require("../../src/models/Exchange");
const Review = require("../../src/models/Review");

const registrarUsuario = async (email, overrides = {}) => {
  const payload = {
    nombre: "Usuario",
    apellido: "Review",
    fechaNacimiento: "2000-01-01",
    email,
    password: "Password123!",
    confirmPassword: "Password123!",
    ...overrides,
  };

  const res = await request(app).post("/api/auth/register").send(payload);
  return { token: res.body.accessToken, userId: res.body.user._id };
};

const publicacionBase = (owner, title) => ({
  title,
  description: "Descripción de prueba para reputación",
  history: "Historia de prueba para reputación",
  category: "electronica",
  condition: "bueno",
  type: "trueque",
  photos: ["https://res.cloudinary.com/test/image/upload/v1/review.jpg"],
  owner,
});

const crearExchangeCompletado = async ({ ownerId, requesterId, suffix }) => {
  const requestedPublication = await Publication.create(publicacionBase(ownerId, `Pedida ${suffix}`));
  const offeredPublication = await Publication.create(publicacionBase(requesterId, `Ofrecida ${suffix}`));

  const exchange = await Exchange.create({
    requestedPublication: requestedPublication._id,
    offeredPublication: offeredPublication._id,
    requester: requesterId,
    owner: ownerId,
    status: "completed",
    type: "exchange",
    confirmedByRequester: true,
    confirmedByOwner: true,
  });

  return { exchange, requestedPublication, offeredPublication };
};

describe("Reviews API", () => {
  const createdUserIds = [];
  const createdPublicationIds = [];
  const createdExchangeIds = [];
  const createdReviewIds = [];

  const trackScenario = ({ owner, requester, exchangeData, review }) => {
    if (owner?.userId) createdUserIds.push(owner.userId);
    if (requester?.userId) createdUserIds.push(requester.userId);
    if (exchangeData?.requestedPublication?._id) createdPublicationIds.push(exchangeData.requestedPublication._id);
    if (exchangeData?.offeredPublication?._id) createdPublicationIds.push(exchangeData.offeredPublication._id);
    if (exchangeData?.exchange?._id) createdExchangeIds.push(exchangeData.exchange._id);
    if (review?._id) createdReviewIds.push(review._id);
  };

  before(async () => {
    await mongoose.connect(process.env.MONGO_URI);
  });

  afterEach(async () => {
    await Review.deleteMany({ _id: { $in: createdReviewIds.splice(0) } });
    await Exchange.deleteMany({ _id: { $in: createdExchangeIds.splice(0) } });
    await Publication.deleteMany({ _id: { $in: createdPublicationIds.splice(0) } });
    await User.deleteMany({ _id: { $in: createdUserIds.splice(0) } });
  });

  after(async () => {
    await mongoose.disconnect();
  });

  it("permite calificar al otro participante de un intercambio completado", async () => {
    const owner = await registrarUsuario("owner.ok@review.test.com", { nombre: "Owner" });
    const requester = await registrarUsuario("requester.ok@review.test.com", { nombre: "Requester" });
    const exchangeData = await crearExchangeCompletado({
      ownerId: owner.userId,
      requesterId: requester.userId,
      suffix: "ok",
    });
    trackScenario({ owner, requester, exchangeData });

    const res = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${requester.token}`)
      .send({
        exchangeId: exchangeData.exchange._id.toString(),
        rating: 5,
        comment: "Excelente trato",
      });

    expect(res.status).to.equal(201);
    expect(res.body).to.include({ rating: 5, comment: "Excelente trato" });
    expect(res.body.reviewer.toString()).to.equal(requester.userId.toString());
    expect(res.body.reviewedUser.toString()).to.equal(owner.userId.toString());
    createdReviewIds.push(res.body._id);
  });

  it("no permite calificar dos veces el mismo intercambio", async () => {
    const owner = await registrarUsuario("owner.dup@review.test.com");
    const requester = await registrarUsuario("requester.dup@review.test.com");
    const exchangeData = await crearExchangeCompletado({
      ownerId: owner.userId,
      requesterId: requester.userId,
      suffix: "dup",
    });
    trackScenario({ owner, requester, exchangeData });

    const first = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${requester.token}`)
      .send({ exchangeId: exchangeData.exchange._id.toString(), rating: 4 });
    createdReviewIds.push(first.body._id);

    const second = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${requester.token}`)
      .send({ exchangeId: exchangeData.exchange._id.toString(), rating: 5 });

    expect(second.status).to.equal(409);
    expect(second.body).to.deep.equal({ message: "Ya calificaste este intercambio" });
  });

  it("rechaza calificaciones sobre intercambios no completados", async () => {
    const owner = await registrarUsuario("owner.pending@review.test.com");
    const requester = await registrarUsuario("requester.pending@review.test.com");
    const exchangeData = await crearExchangeCompletado({
      ownerId: owner.userId,
      requesterId: requester.userId,
      suffix: "pending",
    });
    await Exchange.findByIdAndUpdate(exchangeData.exchange._id, { status: "active" });
    trackScenario({ owner, requester, exchangeData });

    const res = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${requester.token}`)
      .send({ exchangeId: exchangeData.exchange._id.toString(), rating: 5 });

    expect(res.status).to.equal(400);
    expect(res.body).to.deep.equal({ message: "Solo se pueden calificar intercambios completados" });
  });

  it("rechaza intercambios con status completed si no fueron confirmados por ambas partes", async () => {
    const owner = await registrarUsuario("owner.inconsistent@review.test.com");
    const requester = await registrarUsuario("requester.inconsistent@review.test.com");
    const exchangeData = await crearExchangeCompletado({
      ownerId: owner.userId,
      requesterId: requester.userId,
      suffix: "inconsistent",
    });
    await Exchange.findByIdAndUpdate(exchangeData.exchange._id, { confirmedByOwner: false });
    trackScenario({ owner, requester, exchangeData });

    const res = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${requester.token}`)
      .send({ exchangeId: exchangeData.exchange._id.toString(), rating: 5 });

    expect(res.status).to.equal(400);
    expect(res.body).to.deep.equal({ message: "Solo se pueden calificar intercambios completados" });
  });

  it("rechaza calificaciones fuera del plazo de 7 días", async () => {
    const owner = await registrarUsuario("owner.expired@review.test.com");
    const requester = await registrarUsuario("requester.expired@review.test.com");
    const exchangeData = await crearExchangeCompletado({
      ownerId: owner.userId,
      requesterId: requester.userId,
      suffix: "expired",
    });
    await Exchange.updateOne(
      { _id: exchangeData.exchange._id },
      { $set: { updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) } },
      { timestamps: false },
    );
    trackScenario({ owner, requester, exchangeData });

    const res = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${requester.token}`)
      .send({ exchangeId: exchangeData.exchange._id.toString(), rating: 5 });

    expect(res.status).to.equal(400);
    expect(res.body).to.deep.equal({ message: "El plazo para calificar este intercambio ya venció" });
  });

  it("lista las calificaciones recibidas del usuario autenticado", async () => {
    const owner = await registrarUsuario("owner.received@review.test.com");
    const requester = await registrarUsuario("requester.received@review.test.com", { nombre: "Reviewer" });
    const exchangeData = await crearExchangeCompletado({
      ownerId: owner.userId,
      requesterId: requester.userId,
      suffix: "received",
    });
    trackScenario({ owner, requester, exchangeData });

    const review = await Review.create({
      exchange: exchangeData.exchange._id,
      reviewer: requester.userId,
      reviewedUser: owner.userId,
      rating: 5,
      comment: "Todo perfecto",
    });
    trackScenario({ review });

    const res = await request(app)
      .get("/api/reviews/received")
      .set("Authorization", `Bearer ${owner.token}`);

    expect(res.status).to.equal(200);
    expect(res.body.pagination.total).to.equal(1);
    expect(res.body.reviews).to.have.length(1);
    expect(res.body.reviews[0]).to.include({ rating: 5, comment: "Todo perfecto" });
    expect(res.body.reviews[0].reviewer).to.include({ nombre: "Reviewer" });
  });

  it("expone reputación real y publicaciones activas en el perfil público", async () => {
    const owner = await registrarUsuario("owner.profile@review.test.com", { nombre: "Perfil" });
    const requester = await registrarUsuario("requester.profile@review.test.com");
    const exchangeData = await crearExchangeCompletado({
      ownerId: owner.userId,
      requesterId: requester.userId,
      suffix: "profile",
    });
    trackScenario({ owner, requester, exchangeData });

    const review = await Review.create({
      exchange: exchangeData.exchange._id,
      reviewer: requester.userId,
      reviewedUser: owner.userId,
      rating: 4,
      comment: "Muy buena experiencia",
    });
    trackScenario({ review });

    const res = await request(app).get(`/api/users/${owner.userId}`);

    expect(res.status).to.equal(200);
    expect(res.body).to.include({
      calificacionPromedio: 4,
      totalCalificaciones: 1,
      totalIntercambiosCompletados: 1,
      cancelaciones: 0,
    });
    expect(res.body.calificacionesRecibidas).to.have.length(1);
    expect(res.body.publicaciones).to.have.length(1);
    expect(res.body.publicaciones[0]).to.include({ title: "Pedida profile", status: "available" });
  });
});
