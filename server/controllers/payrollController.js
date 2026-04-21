const mongoose = require('mongoose');
const PayrollRecord = require('../models/PayrollRecord');
const Employee = require('../models/Employee');
const STATUS_VALUES = ['draft', 'approved'];

function computeNetPay(basePay, bonuses, deductions) {
  const n = Number(basePay) + Number(bonuses || 0) - Number(deductions || 0);
  return Math.max(0, Math.round(n * 100) / 100);
}

async function resolveEmployeeFromUserId(userId) {
  if (!userId || !mongoose.isValidObjectId(userId)) return null;
  return Employee.findOne({ user: userId });
}

function employeePopulate() {
  return {
    path: 'employee',
    select: 'employeeId user department position',
    populate: { path: 'user', select: 'name email' }
  };
}

function financePopulate() {
  return {
    path: 'financeExpense',
    select: 'title amount category bankAccount',
    populate: { path: 'bankAccount', select: 'name' }
  };
}

exports.listPayroll = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const { periodYear, periodMonth, status, userId } = req.query;

    const filter = {};
    if (periodYear) {
      const y = parseInt(periodYear, 10);
      if (!Number.isNaN(y)) filter.periodYear = y;
    }
    if (periodMonth) {
      const m = parseInt(periodMonth, 10);
      if (m >= 1 && m <= 12) filter.periodMonth = m;
    }
    if (status) {
      if (!STATUS_VALUES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Allowed: ${STATUS_VALUES.join(', ')}`
        });
      }
      filter.status = status;
    }
    if (userId) {
      const emp = await resolveEmployeeFromUserId(userId);
      if (!emp) {
        return res.json({
          success: true,
          count: 0,
          data: [],
          pagination: { page, limit, total: 0, pages: 1 }
        });
      }
      filter.employee = emp._id;
    }

    const skip = (page - 1) * limit;
    const [total, rows] = await Promise.all([
      PayrollRecord.countDocuments(filter),
      PayrollRecord.find(filter)
        .populate(employeePopulate())
        .populate(financePopulate())
        .sort({ periodYear: -1, periodMonth: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);

    res.json({
      success: true,
      count: rows.length,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    console.error('listPayroll error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getPayrollById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid payroll id' });
    }
    const row = await PayrollRecord.findById(req.params.id)
      .populate(employeePopulate())
      .populate(financePopulate())
      .lean();

    if (!row) {
      return res.status(404).json({ success: false, message: 'Payroll record not found' });
    }

    res.json({ success: true, data: row });
  } catch (error) {
    console.error('getPayrollById error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createPayroll = async (req, res) => {
  try {
    const {
      userId,
      periodYear,
      periodMonth,
      basePay,
      bonuses,
      deductions,
      status,
      paymentDate,
      notes,
      bankAccountId
    } = req.body;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Valid userId is required' });
    }

    const employee = await resolveEmployeeFromUserId(userId);
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'No employee profile found for this user. Create an employee record first.'
      });
    }

    const y = parseInt(periodYear, 10);
    const m = parseInt(periodMonth, 10);
    if (Number.isNaN(y) || y < 2000 || y > 2100) {
      return res.status(400).json({ success: false, message: 'Valid period year is required' });
    }
    if (Number.isNaN(m) || m < 1 || m > 12) {
      return res.status(400).json({ success: false, message: 'Valid period month (1–12) is required' });
    }

    const base = Number(basePay);
    if (Number.isNaN(base) || base < 0) {
      return res.status(400).json({ success: false, message: 'Valid base pay is required' });
    }

    const bon = Number(bonuses) || 0;
    const ded = Number(deductions) || 0;
    if (bon < 0 || ded < 0) {
      return res.status(400).json({ success: false, message: 'Bonuses and deductions must be >= 0' });
    }

    let st = status || 'draft';
    if (!STATUS_VALUES.includes(st)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${STATUS_VALUES.join(', ')}`
      });
    }

    if (st === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Set status to Draft or Approved in HR. Payroll payment is handled from Finance.'
      });
    }
    if (bankAccountId) {
      return res.status(400).json({
        success: false,
        message: 'bankAccountId is not accepted in HR payroll. Use Finance payroll payment.'
      });
    }

    let payDate = null;
    if (paymentDate) {
      payDate = new Date(paymentDate);
      if (Number.isNaN(payDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid payment date' });
      }
    }

    const netPay = computeNetPay(base, bon, ded);

    const created = await PayrollRecord.create({
      employee: employee._id,
      periodYear: y,
      periodMonth: m,
      basePay: base,
      bonuses: bon,
      deductions: ded,
      netPay,
      status: st,
      paymentDate: payDate || undefined,
      notes: notes ? String(notes).trim() : ''
    });

    const populated = await PayrollRecord.findById(created._id)
      .populate(employeePopulate())
      .populate(financePopulate())
      .lean();

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A payroll record already exists for this employee and period.'
      });
    }
    if (error.name === 'ValidationError') {
      const msg = Object.values(error.errors)
        .map((e) => e.message)
        .join(', ');
      return res.status(400).json({ success: false, message: msg });
    }
    console.error('createPayroll error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updatePayroll = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid payroll id' });
    }

    const row = await PayrollRecord.findById(req.params.id).populate(employeePopulate());
    if (!row) {
      return res.status(404).json({ success: false, message: 'Payroll record not found' });
    }

    if (row.financeExpense) {
      if (req.body.status !== undefined && req.body.status !== 'paid') {
        return res.status(400).json({
          success: false,
          message:
            'Cannot change status: this salary was already paid from Finance. Adjust in Finance if needed.'
        });
      }
      if (
        req.body.basePay !== undefined ||
        req.body.bonuses !== undefined ||
        req.body.deductions !== undefined
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Cannot change pay amounts after payment was posted to Finance (Expense + bank withdrawal).'
        });
      }
    }

    const { basePay, bonuses, deductions, status, paymentDate, notes, bankAccountId } = req.body;

    if (basePay !== undefined) {
      const base = Number(basePay);
      if (Number.isNaN(base) || base < 0) {
        return res.status(400).json({ success: false, message: 'Valid base pay is required' });
      }
      row.basePay = base;
    }
    if (bonuses !== undefined) {
      const bon = Number(bonuses) || 0;
      if (bon < 0) return res.status(400).json({ success: false, message: 'Bonuses must be >= 0' });
      row.bonuses = bon;
    }
    if (deductions !== undefined) {
      const ded = Number(deductions) || 0;
      if (ded < 0) return res.status(400).json({ success: false, message: 'Deductions must be >= 0' });
      row.deductions = ded;
    }
    if (status !== undefined) {
      if (status === 'paid') {
        return res.status(400).json({
          success: false,
          message: 'Set status to Draft or Approved in HR. Payroll payment is handled from Finance.'
        });
      }
      if (!STATUS_VALUES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Status must be one of: ${STATUS_VALUES.join(', ')}`
        });
      }
      row.status = status;
    }
    if (paymentDate !== undefined) {
      if (paymentDate === null || paymentDate === '') {
        row.paymentDate = null;
      } else {
        const d = new Date(paymentDate);
        if (Number.isNaN(d.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid payment date' });
        }
        row.paymentDate = d;
      }
    }
    if (notes !== undefined) {
      row.notes = notes ? String(notes).trim() : '';
    }
    if (bankAccountId !== undefined) {
      return res.status(400).json({
        success: false,
        message: 'bankAccountId is not accepted in HR payroll. Use Finance payroll payment.'
      });
    }

    row.netPay = computeNetPay(row.basePay, row.bonuses, row.deductions);

    await row.save();

    const populated = await PayrollRecord.findById(row._id)
      .populate(employeePopulate())
      .populate(financePopulate())
      .lean();

    res.json({ success: true, data: populated });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const msg = Object.values(error.errors)
        .map((e) => e.message)
        .join(', ');
      return res.status(400).json({ success: false, message: msg });
    }
    console.error('updatePayroll error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deletePayroll = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid payroll id' });
    }
    const row = await PayrollRecord.findById(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Payroll record not found' });
    }
    if (row.financeExpense) {
      return res.status(400).json({
        success: false,
        message:
          'Cannot delete: salary was paid from Finance. Use Finance to correct transactions if needed.'
      });
    }
    await PayrollRecord.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Payroll record deleted', data: { _id: row._id } });
  } catch (error) {
    console.error('deletePayroll error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
