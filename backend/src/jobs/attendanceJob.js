// Daily job that automates attendance tracking: any active student who has no attendance
// record for today by the time this job runs (end-of-day cutoff) is auto-marked absent,
// so the tutor only has to handle exceptions rather than marking everyone by hand.
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function autoMarkMissingAttendance() {
  const date = todayStart();
  const activeStudents = await Student.find({ status: 'active' }, '_id');
  const marked = await Attendance.find({ date }, 'student');
  const markedIds = new Set(marked.map((m) => m.student.toString()));

  const missing = activeStudents.filter((s) => !markedIds.has(s._id.toString()));
  if (!missing.length) return 0;

  await Attendance.insertMany(
    missing.map((s) => ({
      student: s._id,
      date,
      status: 'absent',
      autoMarked: true,
      markedBy: 'system',
      remarks: 'Auto-marked absent: no attendance recorded by end of day',
    })),
    { ordered: false }
  );

  console.log(`[attendanceJob] auto-marked ${missing.length} student(s) absent for today`);
  return missing.length;
}

module.exports = { autoMarkMissingAttendance };
