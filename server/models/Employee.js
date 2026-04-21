const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: true,
    unique: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  position: {
    type: String,
    required: true
  },
  department: {
    type: String,
    enum: ['HR', 'Manufacturing', 'SCM', 'CRM', 'Sales', 'Inventory', 'Purchasing', 'Finance'],
    required: true
  },
  hireDate: {
    type: Date,
    required: true
  },
  salary: {
    type: Number,
    default: 0
  },
  holidays: {
    type: Number,
    default: 0,
    min: 0
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  personalInfo: {
    phone: String,
    address: String,
    emergencyContact: {
      name: String,
      phone: String,
      relationship: String
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Employee', employeeSchema);
