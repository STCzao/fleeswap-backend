const resend = require("../config/resend");
const logger = require("./logger");

// Helper genérico para enviar emails via Resend.
// Centraliza el envío y loguea errores sin detener el flujo — un fallo de email
// no debería impedir la operación principal (ej: el reset token ya se guardó en DB).
// En desarrollo usa "onboarding@resend.dev" como remitente (sandbox de Resend).
const enviarEmail = async ({ to, subject, html }) => {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "Fleeswap <onboarding@resend.dev>",
      to,
      subject,
      html,
    });
  } catch (error) {
    logger.error(`Error enviando email a ${to}: ${error.message}`);
  }
};

module.exports = enviarEmail;
