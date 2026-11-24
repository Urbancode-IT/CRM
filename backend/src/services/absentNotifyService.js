const messagingService = require('./messagingService');

/**
 * Notify parent when a student is marked absent (WhatsApp preferred).
 * Safe to call repeatedly — failures are logged, never thrown to callers.
 */
async function notifyAbsent({ student, date, reason = '' }) {
  if (!student) return { sent: false, reason: 'no student' };
  const phone = student.parentPhone || student.phone;
  const email = typeof student.notificationEmail === 'function'
    ? student.notificationEmail()
    : student.email || student.parentEmail || null;

  if (!phone && !email) return { sent: false, reason: 'no contact' };

  const dayLabel = date
    ? new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'today';

  try {
    const results = await messagingService.notifyParent({
      phone,
      email,
      subject: `Absent · ${student.name}`,
      message: `Hi, ${student.name} was marked absent on ${dayLabel}.${reason ? ` ${reason}` : ''} Please contact the class if this is unexpected.`,
      prefer: 'whatsapp',
    });
    return { sent: results.some((r) => r.sent), results };
  } catch (err) {
    console.error('[absentNotify] failed', err.message);
    return { sent: false, reason: err.message };
  }
}

async function notifyAbsentMany(items) {
  let sent = 0;
  for (const item of items) {
    const result = await notifyAbsent(item);
    if (result.sent) sent += 1;
  }
  return sent;
}

module.exports = { notifyAbsent, notifyAbsentMany };
