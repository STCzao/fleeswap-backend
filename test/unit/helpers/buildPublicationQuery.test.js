const { expect } = require("chai");
const buildPublicationQuery = require("../../../src/helpers/buildPublicationQuery");

describe("buildPublicationQuery (unit)", () => {

  it("siempre filtra por status available aunque no se pasen filtros", () => {
    expect(buildPublicationQuery()).to.deep.equal({ status: "available" });
  });

  it("agrega owner cuando se pasa userId", () => {
    expect(buildPublicationQuery({ userId: "u1" })).to.deep.equal({
      status: "available",
      owner: "u1",
    });
  });

  it("agrega category y condition tal cual cuando se pasan", () => {
    expect(buildPublicationQuery({ category: "electronica", condition: "bueno" })).to.deep.equal({
      status: "available",
      category: "electronica",
      condition: "bueno",
    });
  });

  it("type='ambos' filtra exactamente por 'ambos'", () => {
    expect(buildPublicationQuery({ type: "ambos" }).type).to.equal("ambos");
  });

  it("type='trueque' incluye también publicaciones 'ambos' vía $in", () => {
    expect(buildPublicationQuery({ type: "trueque" }).type).to.deep.equal({ $in: ["trueque", "ambos"] });
  });

  it("type='venta' incluye también publicaciones 'ambos' vía $in", () => {
    expect(buildPublicationQuery({ type: "venta" }).type).to.deep.equal({ $in: ["venta", "ambos"] });
  });

  it("agrega $or case-insensitive sobre title y description cuando se pasa search", () => {
    const query = buildPublicationQuery({ search: "switch" });
    expect(query.$or).to.deep.equal([
      { title: { $regex: "switch", $options: "i" } },
      { description: { $regex: "switch", $options: "i" } },
    ]);
  });

  it("no agrega $or cuando no se pasa search", () => {
    expect(buildPublicationQuery({ category: "arte" })).to.not.have.property("$or");
  });

});
