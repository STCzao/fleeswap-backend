const { expect } = require("chai");
const validarMayorDeEdad = require("../../../src/middlewares/validarMayorDeEdad");
const AppError = require("../../../src/helpers/AppError");

describe("validarMayorDeEdad (unit)", () => {

  const hoy = new Date();

  // Formatea en fecha LOCAL (no toISOString, que convierte a UTC y puede
  // correr el día según la zona horaria de la máquina que ejecuta el test).
  const aFechaLocal = (fecha) => {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, "0");
    const d = String(fecha.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const fechaConEdad = (anios) => {
    const fecha = new Date(hoy);
    fecha.setFullYear(hoy.getFullYear() - anios);
    return aFechaLocal(fecha);
  };

  const ejecutar = (fechaNacimiento) => {
    const req = { body: { fechaNacimiento } };
    let nextArg;
    const next = (arg) => { nextArg = arg; };

    validarMayorDeEdad(req, {}, next);
    return nextArg;
  };

  it("llama a next() sin argumentos si el usuario ya cumplió 18 años", () => {
    const resultado = ejecutar(fechaConEdad(18));
    expect(resultado).to.be.undefined;
  });

  it("llama a next() sin argumentos si el usuario tiene más de 18 años", () => {
    const resultado = ejecutar(fechaConEdad(30));
    expect(resultado).to.be.undefined;
  });

  it("llama a next(AppError) si el usuario tiene menos de 18 años", () => {
    const resultado = ejecutar(fechaConEdad(17));

    expect(resultado).to.be.instanceOf(AppError);
    expect(resultado.status).to.equal(400);
  });

});
