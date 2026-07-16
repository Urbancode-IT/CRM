const Student = require('../models/Student');
const Payment = require('../models/Payment');
const Attendance = require('../models/Attendance');
const Task = require('../models/Task');

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

async function getDashboardSummary() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [totalStudents, activeStudents, monthPayments, todayAttendance, overduePayments, upcomingTasks, pendingTasks] =
    await Promise.all([
      Student.countDocuments({}),
      Student.countDocuments({ status: 'active' }),
      Payment.find({ month, year }),
      Attendance.find({ date: { $gte: startOfDay(now), $lte: endOfDay(now) } }),
      Payment.find({ status: 'overdue' }).populate('student', 'name email parentEmail'),
      Task.find({ status: { $ne: 'completed' }, dueDate: { $gte: startOfDay(now) } })
        .sort({ dueDate: 1 })
        .limit(10)
        .populate('relatedStudent', 'name'),
      Task.countDocuments({ status: 'pending' }),
    ]);

  const feeCollected = monthPayments.filter((p) => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
  const feePending = monthPayments
    .filter((p) => p.status !== 'paid')
    .reduce((sum, p) => sum + p.amount, 0);

  const presentToday = todayAttendance.filter((a) => a.status === 'present' || a.status === 'late').length;
  const attendanceRateToday = todayAttendance.length
    ? Math.round((presentToday / todayAttendance.length) * 100)
    : null;

  return {
    totalStudents,
    activeStudents,
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
    overduePayments: overduePayments.map((p) => ({
      id: p._id,
      student: p.student ? { id: p.student._id, name: p.student.name } : null,
      amount: p.amount,
      month: p.month,
      year: p.year,
      dueDate: p.dueDate,
      reminderCount: p.reminderCount,
    })),
    pendingTasksCount: pendingTasks,
    upcomingTasks: upcomingTasks.map((t) => ({
      id: t._id,
      title: t.title,
      dueDate: t.dueDate,
      priority: t.priority,
      status: t.status,
      student: t.relatedStudent ? t.relatedStudent.name : null,
    })),
  };
}

module.exports = { getDashboardSummary };
