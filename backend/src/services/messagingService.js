/**
 * WhatsApp + SMS messaging (env-gated).
 * WhatsApp: Meta Cloud API. SMS: Twilio.
 * When disabled, messages are logged like email (destination masked, body omitted).
 */

const { maskDestination } = require('../utils/mask');

function isWhatsAppEnabled() {
  return (
    String(process.env.WHATSAPP_ENABLED || '').toLowerCase() === 'true' &&
    Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
  );
}

function isSmsEnabled() {
  return (
    String(process.env.SMS_ENABLED || '').toLowerCase() === 'true' &&
    Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM)
  );
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

async function sendWhatsApp({ to, body }) {
  const phone = normalizePhone(to);
  if (!phone) return { sent: false, channel: 'whatsapp', reason: 'no phone' };

  if (!isWhatsAppEnabled()) {
    console.log(`[whatsapp:disabled] Would send to ${maskDestination(phone)} (${String(body || '').length} chars)`);
    return { sent: false, channel: 'whatsapp', reason: 'whatsapp disabled' };
  }

  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body: String(body).slice(0, 4000) },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[whatsapp] send failed', text);
    return { sent: false, channel: 'whatsapp', reason: text };
  }
  return { sent: true, channel: 'whatsapp' };
}

async function sendSms({ to, body }) {
  const phone = normalizePhone(to);
  if (!phone) return { sent: false, channel: 'sms', reason: 'no phone' };

  if (!isSmsEnabled()) {
    console.log(`[sms:disabled] Would send to ${maskDestination(phone)} (${String(body || '').length} chars)`);
    return { sent: false, channel: 'sms', reason: 'sms disabled' };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
  const params = new URLSearchParams({
    To: `+${phone}`,
    From: process.env.TWILIO_FROM,
    Body: String(body).slice(0, 1500),
  });

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[sms] send failed', text);
    return { sent: false, channel: 'sms', reason: text };
  }
  return { sent: true, channel: 'sms' };
}

async function notifyParent({ phone, email, subject, message, prefer = 'whatsapp' }) {
  const results = [];
  if (prefer === 'whatsapp' || prefer === 'both') {
    results.push(await sendWhatsApp({ to: phone, body: `${subject}\n\n${message}` }));
  }
  if (prefer === 'sms' || prefer === 'both') {
    results.push(await sendSms({ to: phone, body: `${subject}: ${message}` }));
  }
  if (email) {
    const emailService = require('./emailService');
    results.push(await emailService.sendMail(email, { subject, html: `<p>${message}</p>` }));
  }
  return results;
}

module.exports = {
  isWhatsAppEnabled,
  isSmsEnabled,
  sendWhatsApp,
  sendSms,
  notifyParent,
  normalizePhone,
};
