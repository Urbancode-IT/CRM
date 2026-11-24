const { prisma } = require('../config/db');
const { studentWhere } = require('../utils/studentQuery');
const { notifyAbsentMany } = require('../services/absentNotifyService');

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function autoMarkMissingAttendance() {
  const date = todayStart();
  const activeStudents = await prisma.student.findMany({
    where: studentWhere({ status: 'active' }),
    select: {
      id: true,
      tenantId: true,
      name: true,
      phone: true,
      parentPhone: true,
      email: true,
      parentEmail: true,
    },
  });
  const marked = await prisma.attendance.findMany({
    where: { date },
    select: { studentId: true, tenantId: true, status: true },
  });
  const markedIds = new Set(marked.map((m) => m.studentId));

  // If a workspace already marked the day as holiday for anyone, skip auto-absent there.
  const holidayTenants = new Set(
    marked.filter((m) => m.status === 'holiday').map((m) => m.tenantId)
  );

  const missing = activeStudents.filter(
    (s) => !markedIds.has(s.id) && !holidayTenants.has(s.tenantId)
  );
  if (!missing.length) return 0;

  await prisma.attendance.createMany({
    data: missing.map((s) => ({
      tenantId: s.tenantId,
      studentId: s.id,
      date,
      status: 'absent',
      autoMarked: true,
      markedBy: 'system',
      remarks: 'Auto-marked absent: no attendance recorded by end of day',
    })),
    skipDuplicates: true,
  });

  const notified = await notifyAbsentMany(
    missing.map((s) => ({
      student: s,
      date,
      reason: 'Auto-marked at end of day (no attendance recorded).',
    }))
  );

  console.log(
    `[attendanceJob] auto-marked ${missing.length} student(s) absent; notified ${notified} parent(s)`
  );
  return missing.length;
}

module.exports = { autoMarkMissingAttendance };
