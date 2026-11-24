const { prisma } = require('../config/db');
const { toApi, toApiList } = require('../utils/toApi');
const { studentWhere, notificationEmail } = require('../utils/studentQuery');
const asyncHandler = require('../utils/asyncHandler');
const emailService = require('../services/emailService');
const pick = require('../utils/pick');
const { buildReceiptPdf } = require('../utils/receiptPdf');

const PAYMENT_FIELDS = ['student', 'amount', 'month', 'year', 'dueDate', 'paidDate', 'status', 'method', 'notes'];

/** Map API payload (student, date strings, numeric strings) to Prisma payment data. */
function normalizePaymentData(data) {
  const { student, ...rest } = data;
  const out = { ...rest };
  if (student !== undefined) out.studentId = student ? String(student) : student;
  if (out.amount !== undefined) out.amount = Number(out.amount);
  if (out.month !== undefined) out.month = Number(out.month);
  if (out.year !== undefined) out.year = Number(out.year);
  if (out.dueDate !== undefined) out.dueDate = out.dueDate ? new Date(out.dueDate) : undefined;
  if (out.paidDate !== undefined) out.paidDate = out.paidDate ? new Date(out.paidDate) : null;
  return out;
}

async function assertStudentInTenant(req, res, studentId) {
  const student = studentId
    ? await prisma.student.findFirst({
        where: studentWhere({ id: String(studentId), tenantId: req.tenantId }),
        select: { id: true },
      })
    : null;
  if (!student) {
    res.status(400);
    throw new Error('Student not found in this workspace');
  }
  return student;
}

const getPayments = asyncHandler(async (req, res) => {
  const { student, status, month, year } = req.query;
  const where = { tenantId: req.tenantId };
  if (student) where.studentId = String(student);
  if (status) where.status = status;
  if (month) where.month = Number(month);
  if (year) where.year = Number(year);

  const payments = await prisma.payment.findMany({
    where,
    include: { student: { select: { id: true, name: true, email: true, parentEmail: true } } },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });
  res.json(toApiList(payments));
});

const createPayment = asyncHandler(async (req, res) => {
  const data = normalizePaymentData(pick(req.body, PAYMENT_FIELDS));
  await assertStudentInTenant(req, res, data.studentId);
  try {
    const payment = await prisma.payment.create({
      data: { ...data, tenantId: req.tenantId },
    });
    res.status(201).json(toApi(payment));
  } catch (err) {
    if (err.code === 'P2002') {
      res.status(409);
      throw new Error('A payment already exists for this student, month and year');
    }
    throw err;
  }
});

const markPaid = asyncHandler(async (req, res) => {
  const payment = await prisma.payment.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId },
    include: { student: true },
  });
  if (!payment) {
    res.status(404);
    throw new Error('Payment not found');
  }

  const paid = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'paid',
      paidDate: req.body.paidDate ? new Date(req.body.paidDate) : new Date(),
      method: req.body.method || payment.method,
    },
  });

  const to = notificationEmail(payment.student);
  const result = await emailService.sendReceiptEmail(to, {
    studentName: payment.student.name,
    amount: paid.amount,
    month: paid.month,
    year: paid.year,
    paidDate: paid.paidDate,
    method: paid.method,
  });

  const final = await prisma.payment.update({
    where: { id: payment.id },
    data: { receiptSent: Boolean(result?.sent) },
    include: { student: true },
  });

  res.json(toApi(final));
});

const updatePayment = asyncHandler(async (req, res) => {
  const data = normalizePaymentData(pick(req.body, PAYMENT_FIELDS));
  const existing = await prisma.payment.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId },
    select: { id: true },
  });
  if (!existing) {
    res.status(404);
    throw new Error('Payment not found');
  }
  if (data.studentId !== undefined) await assertStudentInTenant(req, res, data.studentId);
  try {
    const payment = await prisma.payment.update({ where: { id: existing.id }, data });
    res.json(toApi(payment));
  } catch (err) {
    if (err.code === 'P2002') {
      res.status(409);
      throw new Error('A payment already exists for this student, month and year');
    }
    throw err;
  }
});

const deletePayment = asyncHandler(async (req, res) => {
  const payment = await prisma.payment.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId },
    select: { id: true },
  });
  if (!payment) {
    res.status(404);
    throw new Error('Payment not found');
  }
  await prisma.payment.delete({ where: { id: payment.id } });
  res.json({ message: 'Payment deleted' });
});

const getReceipt = asyncHandler(async (req, res) => {
  const payment = await prisma.payment.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId },
    include: { student: true },
  });
  if (!payment) {
    res.status(404);
    throw new Error('Payment not found');
  }
  if (payment.status !== 'paid') {
    res.status(400);
    throw new Error('Receipt available only for paid invoices');
  }

  const monthName = new Date(payment.year, payment.month - 1, 1).toLocaleString('default', {
    month: 'long',
  });
  const workspace = req.tenant?.name || 'User';
  const receiptPayload = {
    workspace,
    studentName: payment.student?.name || '',
    amount: payment.amount,
    month: payment.month,
    year: payment.year,
    paidDate: payment.paidDate,
    method: payment.method,
    receiptId: payment.id,
  };

  if (req.query.format === 'json') {
    return res.json({ receipt: { id: payment.id, ...receiptPayload } });
  }

  if (req.query.format === 'html') {
    const html = `<!doctype html>
<html><head><meta charset="utf-8"/><title>Receipt ${payment.id}</title>
<style>
  body{font-family:Manrope,Segoe UI,sans-serif;color:#0f172a;padding:32px;max-width:720px;margin:auto}
  h1{font-size:22px;margin:0 0 4px} .muted{color:#64748b;font-size:13px}
  table{width:100%;border-collapse:collapse;margin-top:24px}
  td,th{border-bottom:1px solid #e2e8f0;padding:10px 0;text-align:left;font-size:14px}
  .amount{font-size:28px;font-weight:700;margin-top:16px}
  @media print{button{display:none}}
</style></head><body>
  <button onclick="window.print()">Print / Save PDF</button>
  <h1>${workspace}</h1>
  <p class="muted">Fee receipt</p>
  <p class="amount">₹${Number(payment.amount).toLocaleString('en-IN')}</p>
  <table>
    <tr><th>Student</th><td>${payment.student?.name || ''}</td></tr>
    <tr><th>Period</th><td>${monthName} ${payment.year}</td></tr>
    <tr><th>Paid on</th><td>${payment.paidDate ? new Date(payment.paidDate).toLocaleDateString() : ''}</td></tr>
    <tr><th>Method</th><td>${payment.method || '—'}</td></tr>
    <tr><th>Receipt ID</th><td>${payment.id}</td></tr>
  </table>
  <p class="muted" style="margin-top:28px">Generated by User</p>
</body></html>`;
    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  }

  const pdf = await buildReceiptPdf(receiptPayload);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="receipt-${payment.student?.name || 'fee'}-${payment.year}-${payment.month}.pdf"`
  );
  res.send(pdf);
});

module.exports = {
  getPayments,
  createPayment,
  markPaid,
  updatePayment,
  deletePayment,
  getReceipt,
};
