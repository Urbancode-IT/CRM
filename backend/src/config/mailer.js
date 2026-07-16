const nodemailer = require('nodemailer');

let transporter = null;

function isEmailEnabled() {
  return process.env.EMAIL_ENABLED === 'true' && process.env.SMTP_USER && process.env.SMTP_PASS;
}

function getTransporter() {
  if (!isEmailEnabled()) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

module.exports = { getTransporter, isEmailEnabled };
