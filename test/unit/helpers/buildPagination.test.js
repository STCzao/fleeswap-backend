const { expect } = require("chai");
const { buildPagination, DEFAULT_LIMIT, MAX_LIMIT } = require("../../../src/helpers/buildPagination");

describe("buildPagination (unit)", () => {

  it("usa page=1 y el límite por defecto cuando no se pasan parámetros", () => {
    expect(buildPagination({})).to.deep.equal({ page: 1, limit: DEFAULT_LIMIT, skip: 0 });
  });

  it("calcula skip correctamente para una página mayor a 1", () => {
    expect(buildPagination({ page: 3, limit: 10 })).to.deep.equal({ page: 3, limit: 10, skip: 20 });
  });

  it("clampea page a 1 cuando se envía un valor menor o igual a 0", () => {
    expect(buildPagination({ page: 0, limit: 10 }).page).to.equal(1);
    expect(buildPagination({ page: -5, limit: 10 }).page).to.equal(1);
  });

  it("clampea limit al MAX_LIMIT cuando se solicita un valor mayor", () => {
    expect(buildPagination({ limit: 999 }).limit).to.equal(MAX_LIMIT);
  });

  it("clampea limit a 1 cuando se solicita un valor negativo", () => {
    expect(buildPagination({ limit: -10 }).limit).to.equal(1);
  });

  it("cae al defaultLimit cuando limit es 0 (0 es falsy en el '||')", () => {
    expect(buildPagination({ limit: 0 }).limit).to.equal(DEFAULT_LIMIT);
  });

  it("cae al defaultLimit cuando limit no es un entero válido", () => {
    expect(buildPagination({ limit: "no-numero" }).limit).to.equal(DEFAULT_LIMIT);
  });

  it("respeta un defaultLimit custom pasado como segundo argumento", () => {
    expect(buildPagination({}, 25).limit).to.equal(25);
  });

});
