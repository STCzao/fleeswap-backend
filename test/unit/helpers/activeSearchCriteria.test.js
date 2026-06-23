const { expect } = require("chai");
const { normalizeKeywords, buildCriteriaSignature } = require("../../../src/helpers/activeSearchCriteria");

describe("activeSearchCriteria (unit)", () => {

  describe("normalizeKeywords", () => {

    it("recorta espacios, pasa a minúsculas y ordena alfabéticamente", () => {
      expect(normalizeKeywords([" Nintendo ", "switch"])).to.deep.equal(["nintendo", "switch"]);
    });

    it("elimina duplicados luego de normalizar", () => {
      expect(normalizeKeywords(["switch", "Switch", " switch "])).to.deep.equal(["switch"]);
    });

    it("descarta keywords que quedan vacías tras sanitizar", () => {
      expect(normalizeKeywords(["<b></b>", "switch"])).to.deep.equal(["switch"]);
    });

    it("devuelve array vacío cuando no se pasan keywords", () => {
      expect(normalizeKeywords()).to.deep.equal([]);
    });

  });

  describe("buildCriteriaSignature", () => {

    it("genera la misma firma para keywords en distinto orden o capitalización", () => {
      const firmaA = buildCriteriaSignature({ category: "electronica", keywords: ["Switch", "Nintendo"], type: "ambos" });
      const firmaB = buildCriteriaSignature({ category: "electronica", keywords: [" nintendo ", "switch"], type: "ambos" });

      expect(firmaA).to.equal(firmaB);
    });

    it("genera firmas distintas si cambia la categoría", () => {
      const firmaA = buildCriteriaSignature({ category: "electronica", keywords: ["switch"], type: "ambos" });
      const firmaB = buildCriteriaSignature({ category: "arte", keywords: ["switch"], type: "ambos" });

      expect(firmaA).to.not.equal(firmaB);
    });

    it("genera firmas distintas si cambia el type", () => {
      const firmaA = buildCriteriaSignature({ category: "electronica", keywords: ["switch"], type: "venta" });
      const firmaB = buildCriteriaSignature({ category: "electronica", keywords: ["switch"], type: "trueque" });

      expect(firmaA).to.not.equal(firmaB);
    });

  });

});
