const { prisma } = require('../config/db');
const { studentWhere } = require('../utils/studentQuery');

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Related student is treated as missing when soft-deleted. */
function liveStudent(student) {
  return student && !student.deletedAt ? student : null;
}

async function getDashboardSummary(tenantId) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const t = { tenantId };

  const [
    totalStudents,
    activeStudents,
    monthPayments,
    todayAttendance,
    overduePaymentRows,
    upcomingTaskRows,
    pendingTasks,
    customModules,
    customRecords,
  ] = await Promise.all([
    prisma.student.count({ where: studentWhere(t) }),
    prisma.student.count({ where: studentWhere({ ...t, status: 'active' }) }),
    prisma.payment.findMany({ where: { ...t, month, year } }),
    prisma.attendance.findMany({
      where: { ...t, date: { gte: startOfDay(now), lte: endOfDay(now) } },
    }),
    prisma.payment.findMany({
      where: { ...t, status: 'overdue' },
      include: {
        student: { select: { id: true, name: true, email: true, parentEmail: true, deletedAt: true } },
      },
    }),
    prisma.task.findMany({
      where: {
        ...t,
        status: { not: 'completed' },
        dueDate: { gte: startOfDay(now) },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
      include: { relatedStudent: { select: { id: true, name: true, deletedAt: true } } },
    }),
    prisma.task.count({ where: { ...t, status: 'pending' } }),
    prisma.customModule.count({ where: { ...t, isSystem: false } }),
    prisma.record.count({ where: t }),
  ]);

  const feeCollected = monthPayments.filter((p) => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
  const feePending = monthPayments
    .filter((p) => p.status !== 'paid')
    .reduce((sum, p) => sum + p.amount, 0);

  const countedToday = todayAttendance.filter((a) => a.status !== 'holiday');
  const presentToday = countedToday.filter((a) => a.status === 'present' || a.status === 'late').length;
  const isHolidayToday =
    todayAttendance.length > 0 && todayAttendance.every((a) => a.status === 'holiday');
  const attendanceRateToday = isHolidayToday
    ? null
    : countedToday.length
      ? Math.round((presentToday / countedToday.length) * 100)
      : null;

  return {
    totalStudents,
    activeStudents,
    customModules,
    customRecords,
    monthlyFee: {
      month,
      year,
      collected: feeCollected,
      pending: feePending,
      recordCount: monthPayments.length,
    },
    todayAttendance: {
      marked: todayAttendance.length,
      present: presentToday,
      rate: attendanceRateToday,
    },
    overduePayments: overduePaymentRows.map((p) => {
      const student = liveStudent(p.student);
      return {
        id: p.id,
        student: student ? { id: student.id, name: student.name } : null,
        amount: p.amount,
        month: p.month,
        year: p.year,
        dueDate: p.dueDate,
        reminderCount: p.reminderCount,
      };
    }),
    pendingTasksCount: pendingTasks,
    upcomingTasks: upcomingTaskRows.map((task) => {
      const student = liveStudent(task.relatedStudent);
      return {
        id: task.id,
        title: task.title,
        dueDate: task.dueDate,
        priority: task.priority,
        status: task.status,
        student: student ? student.name : null,
      };
    }),
  };
}

module.exports = { getDashboardSummary };
