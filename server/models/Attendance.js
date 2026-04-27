const mongoose = require('mongoose');
const { calculateAttendanceMetrics } = require('../utils/attendanceMetrics');

function applyAttendanceMetrics(record) {
  const metrics = calculateAttendanceMetrics({
    checkIn: record.checkIn,
    checkOut: record.checkOut,
    attendanceDate: record.date
  });
  // Stored values are derived snapshots only; all logic must use checkIn/checkOut.
  record.workingHours = metrics.workingHoursDecimal;
  record.overtime = metrics.overtimeHoursDecimal;
}

const attendanceSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  checkIn: {
    type: Date
  },
  checkOut: {
    type: Date
  },
  workingHours: {
    type: Number,
    default: 0
  },
  overtime: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'half-day'],
    default: 'present'
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Calculate working hours before saving
attendanceSchema.pre('save', function(next) {
  applyAttendanceMetrics(this);
  next();
});

// Keep workingHours/overtime accurate for bulk inserts too.
attendanceSchema.pre('insertMany', function(next, docs) {
  for (const doc of docs) {
    applyAttendanceMetrics(doc);
  }
  next();
});

module.exports = mongoose.model('Attendance', attendanceSchema);
