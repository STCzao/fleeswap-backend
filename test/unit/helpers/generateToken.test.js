const { expect } = require("chai");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { generateAccessToken, generateRefreshToken } = require("../../../src/helpers/generateToken");

describe("generateToken (unit)", () => {

  const usuario = { _id: new mongoose.Types.ObjectId(), role: "USER_ROLE" };

  describe("generateAccessToken", () => {

    it("genera un token firmado con JWT_SECRET que incluye id y role", () => {
      const token = generateAccessToken(usuario);
      const payload = jwt.verify(token, process.env.JWT_SECRET);

      expect(payload.id).to.equal(usuario._id.toString());
      expect(payload.role).to.equal(usuario.role);
    });

    it("no puede verificarse con un secret distinto", () => {
      const token = generateAccessToken(usuario);
      expect(() => jwt.verify(token, "secret-incorrecto")).to.throw();
    });

  });

  describe("generateRefreshToken", () => {

    it("genera un token firmado con JWT_REFRESH_SECRET que incluye solo el id", () => {
      const token = generateRefreshToken(usuario);
      const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

      expect(payload.id).to.equal(usuario._id.toString());
      expect(payload).to.not.have.property("role");
    });

  });

});
