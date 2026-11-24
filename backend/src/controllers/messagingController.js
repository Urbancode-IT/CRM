const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { studentWhere } = require('../utils/studentQuery');
const { writeAudit } = require('../utils/audit');
const {
  MESSAGE_TEMPLATES,
  getTemplate,
  fillTemplate,
} = require('../constants/messageTemplates');
const {
  sendWhatsApp,
  sendSms,
  isWhatsAppEnabled,
  isSmsEnabled,
  normalizePhone,
} = require('../services/messagingService');

function userIdOf(user) {
  return user?.id ?? user?._id ?? null;
}

const listTemplates = asyncHandler(async (req, res) => {
  res.json({
    templates: MESSAGE_TEMPLATES,
    channels: {
      whatsapp: isWhatsAppEnabled(),
      sms: isSmsEnabled(),
    },
  });
});

const sendQuickMessage = asyncHandler(async (req, res) => {
  const templateId = String(req.body.templateId || 'custom').trim();
  const channel = String(req.body.channel || 'whatsapp').toLowerCase();
  const studentId = req.body.studentId ? String(req.body.studentId) : null;
  const phoneOverride = req.body.phone ? String(req.body.phone).trim() : '';
  const vars = req.body.vars && typeof req.body.vars === 'object' ? req.body.vars : {};
  const customBody = req.body.body != null ? String(req.body.body) : null;

  const template = getTemplate(templateId);
  if (!template && templateId !== 'custom') {
    res.status(400);
    throw new Error('Unknown template');
  }

  let student = null;
  if (studentId) {
    student = await prisma.student.findFirst({
      where: studentWhere({ id: studentId, tenantId: req.tenantId }),
    });
    if (!student) {
      res.status(404);
      throw new Error('Student not found');
    }
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: req.tenantId },
    select: { name: true },
  });

  const now = new Date();
  const merged = {
    parentName: student?.parentName || 'Parent',
    studentName: student?.name || '',
    amount: student?.monthlyFee ?? '',
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    date: now.toLocaleDateString('en-IN'),
    centreName: tenant?.name || 'Centre',
    ...vars,
  };

  const rawBody =
    customBody != null && customBody !== ''
      ? customBody
      : template?.body || '';
  const body = fillTemplate(rawBody, merged).trim();
  if (!body) {
    res.status(400);
    throw new Error('Message body is required');
  }

  const phone =
    phoneOverride ||
    student?.parentPhone ||
    student?.phone ||
    '';
  if (!normalizePhone(phone)) {
    res.status(400);
    throw new Error('Phone number is required');
  }

  let result;
  if (channel === 'sms') {
    result = await sendSms({ to: phone, body });
  } else if (channel === 'both') {
    const wa = await sendWhatsApp({ to: phone, body });
    const sms = await sendSms({ to: phone, body });
    result = { whatsapp: wa, sms };
  } else {
    result = await sendWhatsApp({ to: phone, body });
  }

  await writeAudit({
    tenantId: req.tenantId,
    userId: userIdOf(req.user),
    action: 'message.quick_send',
    entityType: student ? 'Student' : 'Message',
    entityId: student?.id || null,
    meta: { templateId, channel, phone: normalizePhone(phone) },
  });

  res.json({
    ok: true,
    preview: body,
    result,
    note:
      !isWhatsAppEnabled() && channel !== 'sms'
        ? 'WhatsApp is disabled in env — message was logged only'
        : undefined,
  });
});

module.exports = { listTemplates, sendQuickMessage };
