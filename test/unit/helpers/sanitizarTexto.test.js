const { expect } = require("chai");
const sanitizarTexto = require("../../../src/helpers/sanitizarTexto");

describe("sanitizarTexto (unit)", () => {

  it("elimina tags HTML del texto", () => {
    expect(sanitizarTexto("<b>Hola</b> mundo")).to.equal("Hola mundo");
  });

  it("elimina tags anidados y con atributos", () => {
    expect(sanitizarTexto('<div class="x"><script>alert(1)</script>texto</div>'))
      .to.equal("alert(1)texto");
  });

  it("recorta espacios al inicio y al final", () => {
    expect(sanitizarTexto("   con espacios   ")).to.equal("con espacios");
  });

  it("devuelve string vacío si el valor es undefined", () => {
    expect(sanitizarTexto(undefined)).to.equal("");
  });

  it("devuelve string vacío si el valor es null", () => {
    expect(sanitizarTexto(null)).to.equal("");
  });

  it("no modifica un texto sin tags ni espacios extra", () => {
    expect(sanitizarTexto("texto limpio")).to.equal("texto limpio");
  });

});
