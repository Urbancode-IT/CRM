const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    parentName: { type: String, trim: true },
    parentEmail: { type: String, trim: true, lowercase: true },
    parentPhone: { type: String, trim: true },
    subjects: [{ type: String, trim: true }],
    grade: { type: String, trim: true },
    batch: { type: String, trim: true },
    joinDate: { type: Date, default: Date.now },
    monthlyFee: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

// Prefer the student's own email; fall back to the parent's for notifications.
studentSchema.methods.notificationEmail = function notificationEmail() {
  return this.email || this.parentEmail || null;
};

module.exports = mongoose.model('Student', studentSchema);
