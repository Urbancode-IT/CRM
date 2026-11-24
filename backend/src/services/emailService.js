const { getTransporter, isEmailEnabled } = require('../config/mailer');
const { maskDestination } = require('../utils/mask');
const {
  receiptEmail,
  overdueReminderEmail,
  inviteEmail,
  workflowNotifyEmail,
  otpEmail,
  parentMagicEmail,
} = require('../templates/emailTemplates');

async function sendMail(to, { subject, html }) {
  if (!isEmailEnabled()) {
    console.log(`[email:disabled] Would send "${subject}" to ${maskDestination(to)}`);
    return { sent: false, reason: 'email disabled' };
  }
  if (!to) {
    console.log(`[email:skip] "${subject}" has no recipient address`);
    return { sent: false, reason: 'no recipient' };
  }

  const transporter = getTransporter();
  await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME || 'Tusion'}" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
  return { sent: true };
}

async function sendReceiptEmail(to, payload) {
  return sendMail(to, receiptEmail(payload));
}

async function sendOverdueReminderEmail(to, payload) {
  return sendMail(to, overdueReminderEmail(payload));
}

async function sendInviteEmail(to, payload) {
  return sendMail(to, inviteEmail(payload));
}

async function sendWorkflowNotifyEmail(to, payload) {
  return sendMail(to, workflowNotifyEmail(payload));
}

async function sendOtpEmail(to, payload) {
  return sendMail(to, otpEmail(payload));
}

async function sendParentMagicEmail(to, payload) {
  return sendMail(to, parentMagicEmail(payload));
}

module.exports = {
  sendMail,
  sendReceiptEmail,
  sendOverdueReminderEmail,
  sendInviteEmail,
  sendWorkflowNotifyEmail,
  sendOtpEmail,
  sendParentMagicEmail,
};
