const { Resend } = require("resend");

// Cliente de Resend para envío de emails transaccionales.
// La API key se configura en .env — en desarrollo se puede usar el sandbox de Resend.
const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = resend;
