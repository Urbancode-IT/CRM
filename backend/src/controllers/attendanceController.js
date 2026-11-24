const { prisma } = require('../config/db');
const { toApi, toApiList } = require('../utils/toApi');
const { studentWhere } = require('../utils/studentQuery');
const asyncHandler = require('../utils/asyncHandler');
const { notifyAbsent } = require('../services/absentNotifyService');

function dayRange(dateStr) {
  const base = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const end = new Date(base);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function monthRange(year, month) {
  const start = new Date(year, month - 1, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(year, month, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end, daysInMonth: end.getDate() };
}

/** Upsert one attendance row via the (tenantId, studentId, date) unique key. */
function upsertAttendance(tenantId, studentId, date, fields) {
  return prisma.attendance.upsert({
    where: { tenantId_studentId_date: { tenantId, studentId, date } },
    create: { tenantId, studentId, date, ...fields },
    update: fields,
  });
}

const getAttendance = asyncHandler(async (req, res) => {
  const { student, date, from, to } = req.query;
  const where = { tenantId: req.tenantId };
  if (student) where.studentId = String(student);

  if (date) {
    const { start, end } = dayRange(date);
    where.date = { gte: start, lte: end };
  } else if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }

  if (req.instructorScope?.studentFilter) {
    const scoped = await prisma.student.findMany({
      where: studentWhere({
        tenantId: req.tenantId,
        AND: [req.instructorScope.studentFilter],
      }),
      select: { id: true },
    });
    const ids = scoped.map((s) => s.id);
    if (student) {
      if (!ids.map(String).includes(String(student))) return res.json([]);
      where.studentId = String(student);
    } else {
      where.studentId = { in: ids };
    }
  }

  const records = await prisma.attendance.findMany({
    where,
    include: { student: { select: { id: true, name: true } } },
    orderBy: { date: 'desc' },
  });
  res.json(toApiList(records));
});

const markAttendance = asyncHandler(async (req, res) => {
  const { student, date, status, remarks, markedBy } = req.body;
  const owned = student
    ? await prisma.student.findFirst({
        where: studentWhere({ id: String(student), tenantId: req.tenantId }),
      })
    : null;
  if (!owned) {
    res.status(400);
    throw new Error('Student not found in this workspace');
  }
  const { start } = dayRange(date);

  const previous = await prisma.attendance.findUnique({
    where: {
      tenantId_studentId_date: { tenantId: req.tenantId, studentId: owned.id, date: start },
    },
  });
  const record = await upsertAttendance(req.tenantId, owned.id, start, {
    status,
    remarks,
    markedBy: markedBy || req.user?.name,
    autoMarked: false,
  });

  if (status === 'absent' && previous?.status !== 'absent') {
    notifyAbsent({ student: owned, date: start }).catch(() => {});
  }

  res.json(toApi(record));
});

const markBulkAttendance = asyncHandler(async (req, res) => {
  const { date, entries } = req.body;
  const { start } = dayRange(date);

  const results = await Promise.all(
    (entries || []).map(async (entry) => {
      if (!entry?.student) return null;
      const owned = await prisma.student.findFirst({
        where: studentWhere({ id: String(entry.student), tenantId: req.tenantId }),
      });
      if (!owned) return null;
      const previous = await prisma.attendance.findUnique({
        where: {
          tenantId_studentId_date: { tenantId: req.tenantId, studentId: owned.id, date: start },
        },
      });
      const record = await upsertAttendance(req.tenantId, owned.id, start, {
        status: entry.status,
        remarks: entry.remarks,
        markedBy: req.user?.name,
        autoMarked: false,
      });
      if (entry.status === 'absent' && previous?.status !== 'absent') {
        notifyAbsent({ student: owned, date: start }).catch(() => {});
      }
      return record;
    })
  );

  res.json(toApiList(results.filter(Boolean)));
});

const deleteAttendance = asyncHandler(async (req, res) => {
  const record = await prisma.attendance.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId },
    select: { id: true },
  });
  if (!record) {
    res.status(404);
    throw new Error('Attendance record not found');
  }
  await prisma.attendance.delete({ where: { id: record.id } });
  res.json({ message: 'Attendance record deleted' });
});

/** Monthly per-student attendance report. Holidays excluded from attendance %. */
const getMonthlyReport = asyncHandler(async (req, res) => {
  const now = new Date();
  const year = Number(req.query.year) || now.getFullYear();
  const month = Number(req.query.month) || now.getMonth() + 1;
  if (month < 1 || month > 12) {
    res.status(400);
    throw new Error('month must be 1-12');
  }

  const { start, end, daysInMonth } = monthRange(year, month);
  const students = await prisma.student.findMany({
    where: studentWhere({ tenantId: req.tenantId, status: 'active' }),
    select: { id: true, name: true, grade: true, batch: true },
    orderBy: { name: 'asc' },
  });

  const records = await prisma.attendance.findMany({
    where: {
      tenantId: req.tenantId,
      date: { gte: start, lte: end },
      studentId: { in: students.map((s) => s.id) },
    },
    select: { studentId: true, status: true, date: true },
  });

  const byStudent = new Map();
  students.forEach((s) => {
    byStudent.set(s.id, {
      studentId: s.id,
      name: s.name,
      grade: s.grade || '',
      batch: s.batch || '',
      present: 0,
      late: 0,
      absent: 0,
      holiday: 0,
      markedDays: 0,
    });
  });

  records.forEach((r) => {
    const row = byStudent.get(String(r.studentId));
    if (!row) return;
    row.markedDays += 1;
    if (r.status === 'present') row.present += 1;
    else if (r.status === 'late') row.late += 1;
    else if (r.status === 'absent') row.absent += 1;
    else if (r.status === 'holiday') row.holiday += 1;
  });

  const report = [...byStudent.values()].map((row) => {
    const countedDays = row.present + row.late + row.absent;
    const attended = row.present + row.late;
    return {
      ...row,
      countedDays,
      attendanceRate: countedDays ? Math.round((attended / countedDays) * 100) : null,
    };
  });

  res.json({
    year,
    month,
    daysInMonth,
    students: report,
  });
});

module.exports = {
  getAttendance,
  markAttendance,
  markBulkAttendance,
  deleteAttendance,
  getMonthlyReport,
};
