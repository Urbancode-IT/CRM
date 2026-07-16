const { getTransporter, isEmailEnabled } = require('../config/mailer');
const { receiptEmail, overdueReminderEmail } = require('../templates/emailTemplates');

async function send(to, { subject, html }) {
  if (!isEmailEnabled()) {
    console.log(`[email:disabled] Would send "${subject}" to ${to}`);
    return { sent: false, reason: 'email disabled' };
  }
  if (!to) {
    console.log(`[email:skip] "${subject}" has no recipient address`);
    return { sent: false, reason: 'no recipient' };
  }

  const transporter = getTransporter();
  await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME || 'Tuition CRM'}" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
  return { sent: true };
}

async function sendReceiptEmail(to, payload) {
  return send(to, receiptEmail(payload));
}

async function sendOverdueReminderEmail(to, payload) {
  return send(to, overdueReminderEmail(payload));
}

module.exports = { sendReceiptEmail, sendOverdueReminderEmail };
