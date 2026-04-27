const mongoose = require('mongoose');
const PayrollRecord = require('../models/PayrollRecord');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const SalesOrder = require('../models/SalesOrder');
const Expense = require('../models/Expense');
const Transaction = require('../models/Transaction');
const BankAccount = require('../models/BankAccount');
const { createPendingPayrollExpense } = require('./financeService');
const { calculateAttendanceMetrics } = require('../utils/attendanceMetrics');
const { getPayrollAttendanceQueryBounds } = require('../utils/payrollPeriodSlots');

const BONUS_RATE = 0.02;
const WORKING_DAYS_PER_MONTH = 26;
const WORKING_HOURS_PER_DAY = 8;
const OVERTIME_RATE = 1.5;
const PAYROLL_STATUS = {
  DRAFT: 'draft',
  APPROVED: 'approved',
  PAID: 'paid'
};

function roundCurrency(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function normalizeAttendanceStatus(status) {
  return String(status ?? '')
    .trim()
    .toLowerCase();
}

function toDateKeyUTC(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function getMonthRange(year, month) {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

function parsePeriod(periodYear, periodMonth) {
  const year = Number.parseInt(periodYear, 10);
  const month = Number.parseInt(periodMonth, 10);

  if (Number.isNaN(year) || year < 2000 || year > 2100) {
    const error = new Error('Valid periodYear is required');
    error.statusCode = 400;
    throw error;
  }

  if (Number.isNaN(month) || month < 1 || month > 12) {
    const error = new Error('Valid periodMonth (1-12) is required');
    error.statusCode = 400;
    throw error;
  }

  return { year, month };
}

async function resolveEmployees(employeeId) {
  if (!employeeId) {
    return Employee.find({ isActive: true }).sort({ employeeId: 1 });
  }

  let employee = null;
  if (mongoose.isValidObjectId(employeeId)) {
    employee = await Employee.findById(employeeId);
    if (!employee) {
      employee = await Employee.findOne({ user: employeeId });
    }
  }

  if (!employee) {
    employee = await Employee.findOne({ employeeId });
  }

  if (!employee) {
    const error = new Error('Employee not found');
    error.statusCode = 404;
    throw error;
  }

  return [employee];
}

function getApprovedLeaveDays(employee, payload) {
  const daysByEmployee = payload.approvedLeaveDaysByEmployee || {};
  const employeeKey = String(employee._id);
  const employeeCodeKey = String(employee.employeeId || '');

  const numericDays = Number(
    daysByEmployee[employeeKey] ??
      daysByEmployee[employeeCodeKey] ??
      payload.approvedLeaveDays ??
      0
  );

  return Math.max(0, Math.floor(numericDays));
}

function buildAttendanceSummary(attendanceRows) {
  const byEmployee = new Map();

  for (const row of attendanceRows) {
    const employeeId = String(row.employee);
    const dateKey = toDateKeyUTC(row.date);
    if (!dateKey) continue;

    if (!byEmployee.has(employeeId)) {
      byEmployee.set(employeeId, {
        presentDateKeys: new Set(),
        totalLateMinutes: 0,
        totalOvertimeMinutes: 0
      });
    }
    const summary = byEmployee.get(employeeId);

    // Payroll working bucket is 26 days/month. Count only explicit working-day
    // statuses per calendar date (dedupe multiple rows same day). Do not infer
    // presence from missing days, weekends, or raw row counts.
    const st = normalizeAttendanceStatus(row.status);
    const isCountedPresentDay = st === 'present' || st === 'late';

    if (isCountedPresentDay) {
      summary.presentDateKeys.add(dateKey);
    }

    if (isCountedPresentDay) {
      const metrics = calculateAttendanceMetrics({
        checkIn: row.checkIn,
        checkOut: row.checkOut,
        attendanceDate: row.date,
        standardHours: WORKING_HOURS_PER_DAY
      });
      if (metrics.isValid) {
        summary.totalLateMinutes += metrics.lateMinutes;
        summary.totalOvertimeMinutes += metrics.overtimeMinutes;
      }
    }
  }

  return byEmployee;
}

async function getSalesTotalsByEmployee(employeeIds, monthStart, monthEnd) {
  if (!employeeIds.length) return new Map();

  const rows = await SalesOrder.aggregate([
    {
      $match: {
        salesRep: { $in: employeeIds.map((id) => new mongoose.Types.ObjectId(id)) },
        orderDate: { $gte: monthStart, $lte: monthEnd },
        isDeleted: { $ne: true }
      }
    },
    {
      $group: {
        _id: '$salesRep',
        totalSales: { $sum: { $ifNull: ['$total', 0] } }
      }
    }
  ]);

  const totals = new Map();
  for (const row of rows) {
    totals.set(String(row._id), roundCurrency(row.totalSales));
  }
  return totals;
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
    select: 'title amount category status source employeeId referencePayrollId'
  };
}

async function buildPayrollFilter(query) {
  const filter = {};
  if (query.periodYear) {
    const y = parseInt(query.periodYear, 10);
    if (!Number.isNaN(y)) filter.periodYear = y;
  }
  if (query.periodMonth) {
    const m = parseInt(query.periodMonth, 10);
    if (m >= 1 && m <= 12) filter.periodMonth = m;
  }
  if (query.status) {
    filter.status = query.status;
  }
  const employeeFilterValue = query.employeeId || query.userId;
  if (employeeFilterValue) {
    const employees = await resolveEmployees(employeeFilterValue);
    filter.employee = { $in: employees.map((emp) => emp._id) };
  }

  return filter;
}

async function listPayroll(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const filter = await buildPayrollFilter(query);

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

  return {
    count: rows.length,
    data: rows,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1
    }
  };
}

async function getPayrollById(id) {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid payroll id');
    error.statusCode = 400;
    throw error;
  }

  const payroll = await PayrollRecord.findById(id)
    .populate(employeePopulate())
    .populate(financePopulate())
    .lean();

  if (!payroll) {
    const error = new Error('Payroll record not found');
    error.statusCode = 404;
    throw error;
  }

  return payroll;
}

async function generatePayroll(payload) {
  const { year, month } = parsePeriod(payload.periodYear, payload.periodMonth);
  const employees = await resolveEmployees(payload.employeeId);
  if (!employees.length) {
    const error = new Error('No employees found');
    error.statusCode = 404;
    throw error;
  }

  const existing = await PayrollRecord.find({
    employee: { $in: employees.map((emp) => emp._id) },
    periodYear: year,
    periodMonth: month
  })
    .select('_id employee')
    .lean();

  if (existing.length > 0) {
    const error = new Error('Payroll already generated for this period');
    error.statusCode = 409;
    throw error;
  }

  const { start: salesMonthStart, end: salesMonthEnd } = getMonthRange(year, month);
  const { start: attendanceStart, end: attendanceEnd } = getPayrollAttendanceQueryBounds(year, month);
  const workingDaysOfMonth = WORKING_DAYS_PER_MONTH;

  const attendanceRows = await Attendance.find({
    employee: { $in: employees.map((emp) => emp._id) },
    date: { $gte: attendanceStart, $lte: attendanceEnd }
  })
    .select('employee date checkIn checkOut status')
    .lean();

  const attendanceSummaryByEmployee = buildAttendanceSummary(attendanceRows);
  const salesTotals = await getSalesTotalsByEmployee(
    employees.map((emp) => emp._id),
    salesMonthStart,
    salesMonthEnd
  );

  const payrollDocs = employees.map((employee) => {
    const employeeId = String(employee._id);
    const baseSalary = roundCurrency(employee.salary || 0);
    const dailySalary = roundCurrency(baseSalary / WORKING_DAYS_PER_MONTH);
    const hourlyRate = roundCurrency(dailySalary / WORKING_HOURS_PER_DAY);
    const attendanceSummary = attendanceSummaryByEmployee.get(employeeId);
    const rawPresentDays = attendanceSummary?.presentDateKeys.size || 0;
    const presentDays = Math.min(WORKING_DAYS_PER_MONTH, rawPresentDays);
    const approvedLeaveDays = getApprovedLeaveDays(employee, payload);
    const absentDays = Math.max(
      0,
      workingDaysOfMonth - presentDays - approvedLeaveDays
    );
    const absenceDeduction = roundCurrency(absentDays * dailySalary);
    const totalLateMinutes = Math.max(0, attendanceSummary?.totalLateMinutes || 0);
    const perMinuteRate = hourlyRate / 60;
    const lateHours = roundCurrency(totalLateMinutes / 60);
    const lateDeduction = roundCurrency(totalLateMinutes * perMinuteRate);
    const overtimeMinutes = Math.max(0, attendanceSummary?.totalOvertimeMinutes || 0);
    const overtimeHours = roundCurrency(overtimeMinutes / 60);
    const overtimePay = roundCurrency(overtimeMinutes * perMinuteRate * OVERTIME_RATE);
    const totalSales = roundCurrency(salesTotals.get(employeeId) || 0);
    const bonus = roundCurrency(totalSales * BONUS_RATE);
    const totalDeductions = roundCurrency(absenceDeduction + lateDeduction);
    const netSalary = roundCurrency(baseSalary - totalDeductions + bonus + overtimePay);

    return {
      employee: employee._id,
      periodYear: year,
      periodMonth: month,
      basePay: baseSalary,
      bonuses: roundCurrency(bonus + overtimePay),
      deductions: totalDeductions,
      netPay: netSalary,
      baseSalary,
      workingDaysOfMonth,
      dailySalary,
      hourlyRate,
      absentDays,
      absenceDeduction,
      totalLateMinutes,
      lateHours,
      lateDeduction,
      overtimeHours,
      overtimePay,
      totalSales,
      bonus,
      totalDeductions,
      netSalary,
      status: PAYROLL_STATUS.DRAFT
    };
  });

  const created = await PayrollRecord.insertMany(payrollDocs, { ordered: true });
  const createdIds = created.map((row) => row._id);

  const rows = await PayrollRecord.find({ _id: { $in: createdIds } })
    .populate(employeePopulate())
    .populate(financePopulate())
    .sort({ createdAt: -1 })
    .lean();

  return rows;
}

async function deleteAllPayroll(query) {
  const filter = await buildPayrollFilter(query || {});
  const targets = await PayrollRecord.find(filter)
    .select('_id financeExpense financeTransaction')
    .lean();

  if (!targets.length) {
    return { deletedCount: 0, deletedExpenseCount: 0, deletedTransactionCount: 0 };
  }

  const payrollIds = targets.map((row) => row._id);
  const financeExpenseIds = new Set(
    targets
      .map((row) => row.financeExpense && String(row.financeExpense))
      .filter(Boolean)
  );
  const financeTransactionIds = new Set(
    targets
      .map((row) => row.financeTransaction && String(row.financeTransaction))
      .filter(Boolean)
  );

  const financeExpenses = financeExpenseIds.size
    ? await Expense.find({ _id: { $in: Array.from(financeExpenseIds) } })
        .select('_id transaction')
        .lean()
    : [];

  for (const expense of financeExpenses) {
    if (expense.transaction) {
      financeTransactionIds.add(String(expense.transaction));
    }
  }

  const financeTransactions = financeTransactionIds.size
    ? await Transaction.find({ _id: { $in: Array.from(financeTransactionIds) } })
        .select('_id direction amount bankAccount')
        .lean()
    : [];

  const bankBalanceAdjustments = new Map();
  for (const transaction of financeTransactions) {
    if (!transaction.bankAccount) continue;
    const accountId = String(transaction.bankAccount);
    const amount = Number(transaction.amount) || 0;
    if (amount <= 0) continue;

    // Reverse bank impact from the original transaction before deleting it.
    const delta = transaction.direction === 'out' ? amount : -amount;
    bankBalanceAdjustments.set(accountId, (bankBalanceAdjustments.get(accountId) || 0) + delta);
  }

  if (bankBalanceAdjustments.size > 0) {
    await Promise.all(
      Array.from(bankBalanceAdjustments.entries()).map(([accountId, delta]) =>
        BankAccount.updateOne({ _id: accountId }, { $inc: { balance: delta } })
      )
    );
  }

  const [transactionDeleteResult, expenseDeleteResult, payrollDeleteResult] = await Promise.all([
    financeTransactionIds.size
      ? Transaction.deleteMany({ _id: { $in: Array.from(financeTransactionIds) } })
      : Promise.resolve({ deletedCount: 0 }),
    financeExpenseIds.size
      ? Expense.deleteMany({ _id: { $in: Array.from(financeExpenseIds) } })
      : Promise.resolve({ deletedCount: 0 }),
    PayrollRecord.deleteMany({ _id: { $in: payrollIds } })
  ]);

  return {
    deletedCount: payrollDeleteResult.deletedCount || 0,
    deletedExpenseCount: expenseDeleteResult.deletedCount || 0,
    deletedTransactionCount: transactionDeleteResult.deletedCount || 0
  };
}

async function approvePayroll(id) {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid payroll id');
    error.statusCode = 400;
    throw error;
  }

  const payroll = await PayrollRecord.findById(id).populate({
    path: 'employee',
    select: 'employeeId user',
    populate: { path: 'user', select: 'name email' }
  });

  if (!payroll) {
    const error = new Error('Payroll record not found');
    error.statusCode = 404;
    throw error;
  }

  if (payroll.status === PAYROLL_STATUS.APPROVED) {
    const error = new Error('Payroll is already approved');
    error.statusCode = 400;
    throw error;
  }

  if (payroll.status === PAYROLL_STATUS.PAID) {
    const error = new Error('Paid payroll cannot be approved again');
    error.statusCode = 400;
    throw error;
  }

  if (payroll.financeExpense) {
    const error = new Error('Finance expense already linked to this payroll');
    error.statusCode = 400;
    throw error;
  }

  const expense = await createPendingPayrollExpense(payroll);
  payroll.status = PAYROLL_STATUS.APPROVED;
  payroll.financeExpense = expense._id;
  await payroll.save();

  const updated = await PayrollRecord.findById(payroll._id)
    .populate(employeePopulate())
    .populate(financePopulate())
    .lean();

  return updated;
}

module.exports = {
  WORKING_DAYS_PER_MONTH,
  WORKING_HOURS_PER_DAY,
  OVERTIME_RATE,
  listPayroll,
  getPayrollById,
  generatePayroll,
  deleteAllPayroll,
  approvePayroll
};
