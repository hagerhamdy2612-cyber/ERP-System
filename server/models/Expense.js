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
    enum: ['Manual', 'Payroll', 'Manufacturing'],
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
    ref: 'PayrollRecord'
  },
  referenceProductionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductionOrder'
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
// Partial filters so only real references are indexed (nulls/missing are excluded),
// preventing duplicate-key errors on unrelated expenses.
expenseSchema.index(
  { referencePayrollId: 1 },
  { unique: true, partialFilterExpression: { referencePayrollId: { $type: 'objectId' } } }
);
// Partial filter so only real production references are indexed (nulls/missing are
// excluded), preventing duplicate-key errors on non-manufacturing expenses.
expenseSchema.index(
  { referenceProductionId: 1 },
  { unique: true, partialFilterExpression: { referenceProductionId: { $type: 'objectId' } } }
);

module.exports = mongoose.model('Expense', expenseSchema);

