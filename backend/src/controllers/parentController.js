const crypto = require('crypto');
const { prisma } = require('../config/db');
const { toApiList } = require('../utils/toApi');
const { studentWhere } = require('../utils/studentQuery');
const asyncHandler = require('../utils/asyncHandler');
const emailService = require('../services/emailService');
const messagingService = require('../services/messagingService');
const { generateParentToken, verifyParentToken } = require('../utils/generateToken');

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

const requestAccess = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '')
    .toLowerCase()
    .trim();
  const phone = String(req.body.phone || '').trim();
  if (!email && !phone) {
    res.status(400);
    throw new Error('Parent email or phone is required');
  }

  const extra = { status: 'active' };
  if (email) extra.parentEmail = email;
  if (phone) extra.parentPhone = phone;

  const students = await prisma.student.findMany({
    where: studentWhere(extra),
    take: 50,
  });
  if (!students.length) {
    res.status(404);
    throw new Error('No students found for this parent contact');
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const destination = email || messagingService.normalizePhone(phone);
  await prisma.otpChallenge.create({
    data: {
      channel: email ? 'email' : 'sms',
      destination,
      purpose: 'parent_login',
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      meta: {
        studentIds: students.map((s) => String(s.id)),
        tenantId: String(students[0].tenantId),
        parentEmail: email || students[0].parentEmail || '',
      },
    },
  });

  const client = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
  const loginUrl = `${client}/parent?email=${encodeURIComponent(email || '')}`;

  if (email) {
    await emailService.sendParentMagicEmail(email, {
      studentName: students.map((s) => s.name).join(', '),
      loginUrl,
      code,
    });
  }
  if (phone) {
    await messagingService.sendWhatsApp({
      to: phone,
      body: `Tusion parent code: ${code}. Valid 10 minutes.`,
    });
    await messagingService.sendSms({
      to: phone,
      body: `Tusion parent code: ${code}`,
    });
  }

  // Never return access codes in API responses — they belong only in SMS/email.
  res.json({
    ok: true,
    message: 'Access code sent',
  });
});

const verifyAccess = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '')
    .toLowerCase()
    .trim();
  const phone = String(req.body.phone || '').trim();
  const code = String(req.body.code || '').trim();
  const destination = email || messagingService.normalizePhone(phone);

  const challenge = await prisma.otpChallenge.findFirst({
    where: {
      destination,
      purpose: 'parent_login',
      consumed: false,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!challenge || challenge.expiresAt < new Date()) {
    res.status(400);
    throw new Error('Code expired. Request a new one.');
  }
  const attempts = challenge.attempts + 1;
  if (attempts > 5) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts, consumed: true },
    });
    res.status(400);
    throw new Error('Too many attempts');
  }
  if (challenge.codeHash !== hashCode(code)) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts },
    });
    res.status(400);
    throw new Error('Invalid code');
  }
  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { attempts, consumed: true },
  });

  const meta = challenge.meta || {};
  const studentIds = meta.studentIds || [];
  const token = generateParentToken({
    parentEmail: meta.parentEmail || email,
    tenantId: meta.tenantId,
    studentIds,
  });

  const students = await prisma.student.findMany({
    where: studentWhere({ id: { in: studentIds } }),
    select: {
      id: true,
      name: true,
      grade: true,
      batch: true,
      monthlyFee: true,
      status: true,
      parentName: true,
    },
  });

  res.json({ token, students: toApiList(students) });
});

function parentAuth(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token;
  if (!token) {
    const err = new Error('Parent token required');
    err.statusCode = 401;
    throw err;
  }
  return verifyParentToken(token);
}

const parentDashboard = asyncHandler(async (req, res) => {
  const decoded = parentAuth(req);
  const studentIds = decoded.studentIds || [];
  const students = await prisma.student.findMany({
    where: studentWhere({ id: { in: studentIds } }),
    select: {
      id: true,
      name: true,
      grade: true,
      batch: true,
      monthlyFee: true,
      status: true,
      parentName: true,
    },
  });
  const payments = await prisma.payment.findMany({
    where: { studentId: { in: studentIds } },
    select: {
      id: true,
      studentId: true,
      amount: true,
      month: true,
      year: true,
      status: true,
      paidDate: true,
      dueDate: true,
      method: true,
    },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    take: 50,
  });
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const attendance = await prisma.attendance.findMany({
    where: {
      studentId: { in: studentIds },
      date: { gte: since },
    },
    select: {
      id: true,
      studentId: true,
      date: true,
      status: true,
    },
    orderBy: { date: 'desc' },
  });

  res.json({
    students: toApiList(students),
    payments: toApiList(payments),
    attendance: toApiList(attendance),
  });
});

module.exports = {
  requestAccess,
  verifyAccess,
  parentDashboard,
};
