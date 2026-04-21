const mongoose = require('mongoose');

const payrollRecordSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'Employee is required']
    },
    periodYear: {
      type: Number,
      required: [true, 'Period year is required'],
      min: 2000,
      max: 2100
    },
    periodMonth: {
      type: Number,
      required: [true, 'Period month is required'],
      min: 1,
      max: 12
    },
    basePay: {
      type: Number,
      required: [true, 'Base pay is required'],
      min: 0
    },
    bonuses: {
      type: Number,
      default: 0,
      min: 0
    },
    deductions: {
      type: Number,
      default: 0,
      min: 0
    },
    netPay: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: ['draft', 'approved', 'paid'],
      default: 'draft'
    },
    paymentDate: {
      type: Date,
      default: null
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [2000, 'Notes cannot exceed 2000 characters']
    },
    financeExpense: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Expense',
      default: null
    },
    financeTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null
    }
  },
  { timestamps: true }
);

payrollRecordSchema.index({ employee: 1, periodYear: 1, periodMonth: 1 }, { unique: true });

module.exports = mongoose.model('PayrollRecord', payrollRecordSchema);
