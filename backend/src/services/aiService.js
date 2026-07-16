const { callGemini, isAiEnabled } = require('../config/ai');
const Attendance = require('../models/Attendance');
const Payment = require('../models/Payment');
const Task = require('../models/Task');

async function buildStudentStats(student) {
  const [attendanceRecords, payments, tasks] = await Promise.all([
    Attendance.find({ student: student._id }).sort({ date: -1 }).limit(60),
    Payment.find({ student: student._id }).sort({ year: -1, month: -1 }).limit(12),
    Task.find({ relatedStudent: student._id }).sort({ createdAt: -1 }).limit(20),
  ]);

  const presentCount = attendanceRecords.filter((a) => a.status === 'present').length;
  const lateCount = attendanceRecords.filter((a) => a.status === 'late').length;
  const absentCount = attendanceRecords.filter((a) => a.status === 'absent').length;
  const attendanceRate = attendanceRecords.length
    ? Math.round(((presentCount + lateCount * 0.5) / attendanceRecords.length) * 100)
    : null;

  const paidOnTime = payments.filter((p) => p.status === 'paid').length;
  const overdue = payments.filter((p) => p.status === 'overdue').length;
  const paymentReliability = payments.length ? Math.round((paidOnTime / payments.length) * 100) : null;

  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const taskCompletionRate = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : null;

  return {
    attendanceRecordsConsidered: attendanceRecords.length,
    attendanceRate,
    presentCount,
    lateCount,
    absentCount,
    paymentsConsidered: payments.length,
    paymentReliability,
    overdue,
    tasksConsidered: tasks.length,
    taskCompletionRate,
  };
}

function buildPrompt(student, stats) {
  return `You are an assistant helping a tuition tutor track student progress.
Analyze the following student data and respond with:
1. A short "Progress Summary" (2-3 sentences).
2. A "Strengths" bullet list (max 3 items).
3. An "Areas to Improve" bullet list (max 3 items).
4. A "Suggested Actions for the Tutor" bullet list (max 3 concrete, actionable items).

Student: ${student.name}
Grade/Level: ${student.grade || 'N/A'}
Subjects: ${(student.subjects || []).join(', ') || 'N/A'}
Notes on file: ${student.notes || 'None'}

Attendance (last ${stats.attendanceRecordsConsidered} recorded days):
- Attendance rate: ${stats.attendanceRate ?? 'N/A'}%
- Present: ${stats.presentCount}, Late: ${stats.lateCount}, Absent: ${stats.absentCount}

Payments (last ${stats.paymentsConsidered} billing periods):
- On-time/paid rate: ${stats.paymentReliability ?? 'N/A'}%
- Currently overdue periods: ${stats.overdue}

Tasks (last ${stats.tasksConsidered} tasks assigned to this student):
- Completion rate: ${stats.taskCompletionRate ?? 'N/A'}%

Keep the tone constructive and specific to this data. Do not invent facts not implied by the numbers above.`;
}

async function analyzeStudentProgress(student) {
  const stats = await buildStudentStats(student);

  if (!isAiEnabled()) {
    return {
      aiGenerated: false,
      stats,
      analysis:
        'AI analysis is currently disabled. Set AI_ENABLED=true and GEMINI_API_KEY in backend/.env ' +
        '(a free key is available at https://aistudio.google.com/apikey) to enable automated progress ' +
        'summaries and improvement suggestions.',
    };
  }

  const prompt = buildPrompt(student, stats);
  const analysis = await callGemini(prompt);
  return { aiGenerated: true, stats, analysis };
}

module.exports = { analyzeStudentProgress, buildStudentStats };
