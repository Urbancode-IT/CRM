const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const asyncHandler = require('../utils/asyncHandler');

function dayRange(dateStr) {
  const base = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const end = new Date(base);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

const getAttendance = asyncHandler(async (req, res) => {
  const { student, date, from, to } = req.query;
  const filter = {};
  if (student) filter.student = student;

  if (date) {
    const { start, end } = dayRange(date);
    filter.date = { $gte: start, $lte: end };
  } else if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }

  const records = await Attendance.find(filter).populate('student', 'name').sort({ date: -1 });
  res.json(records);
});

// Marks/updates attendance for one student on one day (upsert), used by the daily grid.
const markAttendance = asyncHandler(async (req, res) => {
  const { student, date, status, remarks, markedBy } = req.body;
  const { start } = dayRange(date);

  const record = await Attendance.findOneAndUpdate(
    { student, date: start },
    { student, date: start, status, remarks, markedBy: markedBy || req.user?.name, autoMarked: false },
    { new: true, upsert: true, runValidators: true }
  );

  res.json(record);
});

// Marks attendance for every active student at once for a given day (bulk daily entry).
const markBulkAttendance = asyncHandler(async (req, res) => {
  const { date, entries } = req.body; // entries: [{ student, status, remarks }]
  const { start } = dayRange(date);

  const results = await Promise.all(
    entries.map((entry) =>
      Attendance.findOneAndUpdate(
        { student: entry.student, date: start },
        {
          student: entry.student,
          date: start,
          status: entry.status,
          remarks: entry.remarks,
          markedBy: req.user?.name,
          autoMarked: false,
        },
        { new: true, upsert: true, runValidators: true }
      )
    )
  );

  res.json(results);
});

const deleteAttendance = asyncHandler(async (req, res) => {
  const record = await Attendance.findByIdAndDelete(req.params.id);
  if (!record) {
    res.status(404);
    throw new Error('Attendance record not found');
  }
  res.json({ message: 'Attendance record deleted' });
});

module.exports = { getAttendance, markAttendance, markBulkAttendance, deleteAttendance };
