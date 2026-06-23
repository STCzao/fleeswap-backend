const { expect } = require("chai");
const { body } = require("express-validator");
const validarCampos = require("../../../src/middlewares/validarCampos");

// Corre una regla real de express-validator sobre un req falso para dejarlo
// en el mismo estado en que llegaría desde una ruta real, y así poder
// probar validarCampos de forma aislada (sin levantar Express ni la app).
const correrValidacion = async (req, regla) => {
  await regla.run(req);
  return req;
};

describe("validarCampos (unit)", () => {

  it("llama a next() sin responder cuando no hay errores de validación", async () => {
    const req = { body: { title: "Algo válido" } };
    await correrValidacion(req, body("title").notEmpty());

    let nextLlamado = false;
    const res = { status: () => { throw new Error("no debería responder"); } };
    validarCampos(req, res, () => { nextLlamado = true; });

    expect(nextLlamado).to.equal(true);
  });

  it("responde 400 con errors cuando la validación falla", async () => {
    const req = { body: { title: "" } };
    await correrValidacion(req, body("title").notEmpty().withMessage("El título es obligatorio"));

    let statusRecibido, bodyRecibido;
    const res = {
      status: (code) => { statusRecibido = code; return res; },
      json: (payload) => { bodyRecibido = payload; },
    };
    const next = () => { throw new Error("no debería llamar a next()"); };

    validarCampos(req, res, next);

    expect(statusRecibido).to.equal(400);
    expect(bodyRecibido.errors).to.deep.equal([
      { field: "title", message: "El título es obligatorio" },
    ]);
  });

  it("incluye un objeto de error por cada campo inválido", async () => {
    const req = { body: { title: "", category: "" } };
    await correrValidacion(req, body("title").notEmpty().withMessage("title requerido"));
    await correrValidacion(req, body("category").notEmpty().withMessage("category requerido"));

    let bodyRecibido;
    const res = { status: () => res, json: (payload) => { bodyRecibido = payload; } };

    validarCampos(req, res, () => {});

    expect(bodyRecibido.errors).to.have.lengthOf(2);
    expect(bodyRecibido.errors.map((e) => e.field)).to.have.members(["title", "category"]);
  });

});
