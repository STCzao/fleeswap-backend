const { expect } = require("chai");
const AppError = require("../../../src/helpers/AppError");

describe("AppError (unit)", () => {

  it("es instancia de Error y de AppError", () => {
    const error = new AppError("Algo falló", 400);

    expect(error).to.be.instanceOf(Error);
    expect(error).to.be.instanceOf(AppError);
  });

  it("expone message y status pasados al constructor", () => {
    const error = new AppError("No autorizado", 403);

    expect(error.message).to.equal("No autorizado");
    expect(error.status).to.equal(403);
  });

  it("setea name como 'AppError'", () => {
    const error = new AppError("x", 500);
    expect(error.name).to.equal("AppError");
  });

  it("conserva el stack trace", () => {
    const error = new AppError("x", 500);
    expect(error.stack).to.be.a("string").and.not.empty;
  });

});
