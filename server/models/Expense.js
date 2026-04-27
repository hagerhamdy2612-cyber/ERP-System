const mongoose = require('mongoose');

/**
 * Expense Model
 * Records business expenses (not linked to invoices)
 */
const expenseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Expense title is required'],
    trim: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than 0']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true
  },
  source: {
    type: String,
    enum: ['Manual', 'Payroll'],
    default: 'Manual'
  },
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },
  employeeId: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    trim: true,
    default: 'General'
  },
  status: {
    type: String,
    enum: ['Pending Payment', 'Paid'],
    default: 'Paid'
  },
  referencePayrollId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PayrollRecord',
    default: null
  },
  bankAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankAccount',
    required: function requiresBankAccount() {
      return this.status !== 'Pending Payment';
    }
  },
  transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    required: function requiresTransaction() {
      return this.status !== 'Pending Payment';
    }
  },
  date: {
    type: Date,
    default: Date.now,
    required: true
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
expenseSchema.index({ bankAccount: 1, date: -1 });
expenseSchema.index({ category: 1 });
expenseSchema.index({ date: -1 });
expenseSchema.index({ referencePayrollId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Expense', expenseSchema);

