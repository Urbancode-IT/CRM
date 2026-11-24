const { prisma } = require('../config/db');
const { studentWhere } = require('../utils/studentQuery');
const asyncHandler = require('../utils/asyncHandler');

function toCsv(rows, headers) {
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','));
  }
  return lines.join('\n');
}

const feesReport = asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = req.query.month ? Number(req.query.month) : null;
  const where = { tenantId: req.tenantId, year };
  if (month) where.month = month;

  const payments = await prisma.payment.findMany({
    where,
    include: {
      student: { select: { id: true, name: true, grade: true, batch: true, email: true, parentPhone: true } },
    },
    orderBy: [{ month: 'asc' }, { year: 'asc' }],
  });

  const rows = payments.map((p) => ({
    student: p.student?.name || '',
    grade: p.student?.grade || '',
    batch: p.student?.batch || '',
    month: p.month,
    year: p.year,
    amount: p.amount,
    status: p.status,
    dueDate: p.dueDate ? new Date(p.dueDate).toISOString().slice(0, 10) : '',
    paidDate: p.paidDate ? new Date(p.paidDate).toISOString().slice(0, 10) : '',
    method: p.method || '',
  }));

  if (req.query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="fees-${year}.csv"`);
    return res.send(
      toCsv(rows, [
        'student',
        'grade',
        'batch',
        'month',
        'year',
        'amount',
        'status',
        'dueDate',
        'paidDate',
        'method',
      ])
    );
  }

  const summary = {
    total: rows.length,
    collected: rows.filter((r) => r.status === 'paid').reduce((s, r) => s + Number(r.amount || 0), 0),
    pending: rows
      .filter((r) => r.status === 'pending' || r.status === 'overdue')
      .reduce((s, r) => s + Number(r.amount || 0), 0),
    overdueCount: rows.filter((r) => r.status === 'overdue').length,
  };
  res.json({ year, month, summary, rows });
});

const attendanceReport = asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const records = await prisma.attendance.findMany({
    where: {
      tenantId: req.tenantId,
      date: { gte: start, lt: end },
    },
    include: { student: { select: { id: true, name: true, grade: true, batch: true } } },
  });

  const byStudent = {};
  for (const r of records) {
    const id = String(r.student?.id || r.studentId);
    if (!byStudent[id]) {
      byStudent[id] = {
        student: r.student?.name || '',
        grade: r.student?.grade || '',
        batch: r.student?.batch || '',
        present: 0,
        absent: 0,
        late: 0,
        total: 0,
      };
    }
    byStudent[id].total += 1;
    if (r.status === 'present') byStudent[id].present += 1;
    else if (r.status === 'late') byStudent[id].late += 1;
    else byStudent[id].absent += 1;
  }

  const rows = Object.values(byStudent).map((r) => ({
    ...r,
    attendancePercent: r.total ? Math.round((r.present / r.total) * 100) : 0,
  }));

  if (req.query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-${year}-${month}.csv"`);
    return res.send(
      toCsv(rows, ['student', 'grade', 'batch', 'present', 'absent', 'late', 'total', 'attendancePercent'])
    );
  }

  res.json({ year, month, rows });
});

const studentsExport = asyncHandler(async (req, res) => {
  const students = await prisma.student.findMany({
    where: studentWhere({ tenantId: req.tenantId }),
    orderBy: { name: 'asc' },
  });
  const rows = students.map((s) => ({
    name: s.name,
    email: s.email || '',
    phone: s.phone || '',
    parentName: s.parentName || '',
    parentEmail: s.parentEmail || '',
    parentPhone: s.parentPhone || '',
    grade: s.grade || '',
    batch: s.batch || '',
    monthlyFee: s.monthlyFee,
    status: s.status,
  }));

  if (req.query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="students.csv"');
    return res.send(
      toCsv(rows, [
        'name',
        'email',
        'phone',
        'parentName',
        'parentEmail',
        'parentPhone',
        'grade',
        'batch',
        'monthlyFee',
        'status',
      ])
    );
  }
  res.json({ rows });
});

const overviewReport = asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const [payments, attendance, studentsCount, leadModule] = await Promise.all([
    prisma.payment.findMany({
      where: { tenantId: req.tenantId, year, month },
      select: { amount: true, status: true },
    }),
    prisma.attendance.findMany({
      where: { tenantId: req.tenantId, date: { gte: start, lt: end } },
      select: { status: true },
    }),
    prisma.student.count({
      where: studentWhere({ tenantId: req.tenantId, status: 'active' }),
    }),
    prisma.customModule.findFirst({
      where: {
        tenantId: req.tenantId,
        OR: [{ slug: 'leads' }, { systemKey: 'catalog:leads' }],
      },
      select: { id: true },
    }),
  ]);

  const collected = payments
    .filter((p) => p.status === 'paid')
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const pending = payments
    .filter((p) => p.status === 'pending' || p.status === 'overdue')
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const overdueCount = payments.filter((p) => p.status === 'overdue').length;

  const attTotal = attendance.length;
  const attPresent = attendance.filter((a) => a.status === 'present' || a.status === 'late').length;
  const attendancePercent = attTotal ? Math.round((attPresent / attTotal) * 100) : 0;

  let leads = {
    total: 0,
    byStatus: {},
    won: 0,
    converted: 0,
    conversionRate: 0,
  };

  if (leadModule) {
    const records = await prisma.record.findMany({
      where: { tenantId: req.tenantId, moduleId: leadModule.id },
      select: { values: true },
    });
    leads.total = records.length;
    for (const r of records) {
      const status = String(r.values?.status || 'New');
      leads.byStatus[status] = (leads.byStatus[status] || 0) + 1;
      if (status === 'Won' || r.values?.converted_student_id) leads.won += 1;
      if (r.values?.converted_student_id) leads.converted += 1;
    }
    leads.conversionRate = leads.total
      ? Math.round((leads.converted / leads.total) * 100)
      : 0;
  }

  res.json({
    year,
    month,
    fees: {
      collected,
      pending,
      overdueCount,
      invoiceCount: payments.length,
    },
    attendance: {
      percent: attendancePercent,
      present: attPresent,
      total: attTotal,
    },
    students: { active: studentsCount },
    leads,
  });
});

module.exports = { feesReport, attendanceReport, studentsExport, overviewReport };
