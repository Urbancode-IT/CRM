const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ['present', 'absent', 'late', 'holiday'], default: 'present' },
    autoMarked: { type: Boolean, default: false },
    markedBy: { type: String, trim: true },
    remarks: { type: String, trim: true },
  },
  { timestamps: true }
);

// One attendance record per student per calendar day.
attendanceSchema.index({ student: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
