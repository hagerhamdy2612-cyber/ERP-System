const mongoose = require('mongoose');
const PayrollRecord = require('../models/PayrollRecord');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const SalesOrder = require('../models/SalesOrder');
const Expense = require('../models/Expense');
const Transaction = require('../models/Transaction');
const BankAccount = require('../models/BankAccount');
const { createPendingPayrollExpense } = require('./financeService');
const {
  deriveAttendanceState,
  countWorkingDaysInMonth,
  getMonthRange,
  getBusinessDayKey,
  isWorkingDay,
  WORKING_HOURS_PER_DAY,
  OVERTIME_RATE
} = require('../utils/attendancePolicy');

const BONUS_RATE = 0.02;
const PAYROLL_STATUS = {
  DRAFT: 'draft',
  NEEDS_REVIEW: 'needs_review',
  APPROVED: 'approved',
  PAID: 'paid'
};

const ATTENDANCE_REVIEW_MESSAGE =
  'This payroll contains incomplete attendance records and must be reviewed before approval.';

function roundCurrency(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

// Attach a human-readable reviewMessage to plain payroll objects so the frontend
// can render a warning banner without re-deriving the rule.
function decoratePayroll(payroll) {
  if (!payroll) return payroll;
  if (payroll.requiresAttendanceReview) {
    return { ...payroll, reviewMessage: ATTENDANCE_REVIEW_MESSAGE };
  }
  return payroll;
}

function decoratePayrollList(rows) {
  return Array.isArray(rows) ? rows.map(decoratePayroll) : rows;
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

// Pure salary computation shared by generation and recalculation so both always
// produce identical numbers from the same inputs.
function computePayrollFields({
  employee,
  workingDaysOfMonth,
  attendanceSummary,
  totalSalesAmount,
  approvedLeaveDays
}) {
  const baseSalary = roundCurrency(employee.salary || 0);
  const dailySalary = workingDaysOfMonth > 0
    ? roundCurrency(baseSalary / workingDaysOfMonth)
    : 0;
  const hourlyRate = roundCurrency(dailySalary / WORKING_HOURS_PER_DAY);
  const rawPresentDays = attendanceSummary?.presentDateKeys.size || 0;
  const presentDays = Math.min(workingDaysOfMonth, rawPresentDays);
  const incompleteDays = attendanceSummary?.incompleteDateKeys.size || 0;
  const safeApprovedLeaveDays = Math.max(0, Math.floor(approvedLeaveDays || 0));
  // Absent = Working Days - Present - Approved Leave. Incomplete days are NOT
  // subtracted (they must be resolved by HR, not silently excused).
  const absentDays = Math.max(0, workingDaysOfMonth - presentDays - safeApprovedLeaveDays);
  const requiresAttendanceReview = incompleteDays > 0;
  const absenceDeduction = roundCurrency(absentDays * dailySalary);
  const totalLateMinutes = Math.max(0, attendanceSummary?.totalLateMinutes || 0);
  const perMinuteRate = hourlyRate / 60;
  const lateHours = roundCurrency(totalLateMinutes / 60);
  const lateDeduction = roundCurrency(totalLateMinutes * perMinuteRate);
  const overtimeMinutes = Math.max(0, attendanceSummary?.totalOvertimeMinutes || 0);
  const overtimeHours = roundCurrency(overtimeMinutes / 60);
  const overtimePay = roundCurrency(overtimeMinutes * perMinuteRate * OVERTIME_RATE);
  const totalSales = roundCurrency(totalSalesAmount || 0);
  const bonus = roundCurrency(totalSales * BONUS_RATE);
  const totalDeductions = roundCurrency(absenceDeduction + lateDeduction);
  const netSalary = roundCurrency(baseSalary - totalDeductions + bonus + overtimePay);

  return {
    basePay: baseSalary,
    bonuses: roundCurrency(bonus + overtimePay),
    deductions: totalDeductions,
    netPay: netSalary,
    baseSalary,
    workingDaysOfMonth,
    dailySalary,
    hourlyRate,
    presentDays,
    incompleteDays,
    approvedLeaveDays: safeApprovedLeaveDays,
    requiresAttendanceReview,
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
    netSalary
  };
}

// Live check against attendance data (working days only). Used to gate approval
// so HR's fixes are respected even if the stored flag is stale.
async function findUnresolvedIncompleteAttendance(employeeId, year, month) {
  const { start, end } = getMonthRange(year, month);
  const rows = await Attendance.find({
    employee: employeeId,
    date: { $gte: start, $lte: end },
    checkIn: { $ne: null },
    checkOut: null
  })
    .select('date')
    .lean();
  return rows.filter((row) => isWorkingDay(row.date));
}

function buildAttendanceSummary(attendanceRows) {
  // Step 1: dedupe to one representative record per employee/business-day,
  // preferring a complete (checkIn + checkOut) record. This matches the
  // Attendance Report so both modules agree on the same employee/day.
  const repByEmpDay = new Map();
  for (const row of attendanceRows) {
    const employeeId = String(row.employee);
    const dateKey = getBusinessDayKey(row.date);
    if (!dateKey) continue;

    if (!repByEmpDay.has(employeeId)) repByEmpDay.set(employeeId, new Map());
    const dayMap = repByEmpDay.get(employeeId);
    const existing = dayMap.get(dateKey);
    const isComplete = Boolean(row.checkIn) && Boolean(row.checkOut);
    if (!existing) {
      dayMap.set(dateKey, row);
    } else {
      const existingComplete = Boolean(existing.checkIn) && Boolean(existing.checkOut);
      if (!existingComplete && isComplete) dayMap.set(dateKey, row);
    }
  }

  // Step 2: derive attendance from actual timestamps (not status strings).
  // - Present/Late (complete records) => worked day, contributes late/overtime.
  // - Incomplete (checkIn without valid checkOut) => excluded from payroll
  //   (neither present nor absent) until completed/reviewed by HR.
  // - Weekend records => OFF_DAY, ignored.
  const byEmployee = new Map();
  for (const [employeeId, dayMap] of repByEmpDay.entries()) {
    const summary = {
      presentDateKeys: new Set(),
      incompleteDateKeys: new Set(),
      totalLateMinutes: 0,
      totalOvertimeMinutes: 0
    };

    for (const [dateKey, record] of dayMap.entries()) {
      if (!isWorkingDay(record.date)) continue;

      const derived = deriveAttendanceState({
        checkIn: record.checkIn || null,
        checkOut: record.checkOut || null,
        attendanceDate: record.date,
        hasRecord: true,
        workingDay: true
      });

      if (derived.isWorked) {
        summary.presentDateKeys.add(dateKey);
        summary.totalLateMinutes += derived.metrics.lateMinutes;
        // Overtime only accrues for completed attendance (enforced by the
        // state machine: Incomplete/Absent/OFF_DAY produce zero overtime).
        summary.totalOvertimeMinutes += derived.metrics.overtimeMinutes;
      } else if (derived.isIncomplete) {
        summary.incompleteDateKeys.add(dateKey);
      }
    }

    byEmployee.set(employeeId, summary);
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
    data: decoratePayrollList(rows),
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

  return decoratePayroll(payroll);
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
  // Query the whole calendar month; working days are derived dynamically
  // (weekends excluded) instead of the old fixed first-26-days bucket.
  const { start: attendanceStart, end: attendanceEnd } = getMonthRange(year, month);
  const workingDaysOfMonth = countWorkingDaysInMonth(year, month);

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
    const fields = computePayrollFields({
      employee,
      workingDaysOfMonth,
      attendanceSummary: attendanceSummaryByEmployee.get(employeeId),
      totalSalesAmount: salesTotals.get(employeeId) || 0,
      approvedLeaveDays: getApprovedLeaveDays(employee, payload)
    });

    return {
      employee: employee._id,
      periodYear: year,
      periodMonth: month,
      ...fields,
      requiresRegeneration: false,
      // Records with incomplete attendance start as needs_review and cannot be
      // approved until HR resolves them.
      status: fields.requiresAttendanceReview
        ? PAYROLL_STATUS.NEEDS_REVIEW
        : PAYROLL_STATUS.DRAFT
    };
  });

  const created = await PayrollRecord.insertMany(payrollDocs, { ordered: true });
  const createdIds = created.map((row) => row._id);

  const rows = await PayrollRecord.find({ _id: { $in: createdIds } })
    .populate(employeePopulate())
    .populate(financePopulate())
    .sort({ createdAt: -1 })
    .lean();

  return decoratePayrollList(rows);
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

  // If attendance was edited after this payroll was generated, the stored
  // numbers are stale. Force a recalculation before approval.
  if (payroll.requiresRegeneration === true) {
    const error = new Error(
      'Payroll is out of date after attendance changes. Please recalculate the payroll before approval.'
    );
    error.statusCode = 400;
    throw error;
  }

  // Critical integrity rule: re-check live attendance data (not just the stored
  // flag) so HR fixes are honored. Never finalize a salary while unresolved
  // incomplete attendance exists in the period.
  const unresolved = await findUnresolvedIncompleteAttendance(
    payroll.employee?._id || payroll.employee,
    payroll.periodYear,
    payroll.periodMonth
  );
  if (unresolved.length > 0) {
    const error = new Error('Payroll contains unresolved incomplete attendance records');
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

  return decoratePayroll(updated);
}

// Recompute a single payroll record in place from the current attendance + sales
// data. Lets HR fix incomplete attendance and refresh the salary without having
// to delete and regenerate the whole period. Clears the dirty flag.
async function recalculatePayroll(id) {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid payroll id');
    error.statusCode = 400;
    throw error;
  }

  const payroll = await PayrollRecord.findById(id);
  if (!payroll) {
    const error = new Error('Payroll record not found');
    error.statusCode = 404;
    throw error;
  }

  if (payroll.status === PAYROLL_STATUS.APPROVED || payroll.status === PAYROLL_STATUS.PAID) {
    const error = new Error('Only draft or needs-review payroll can be recalculated');
    error.statusCode = 400;
    throw error;
  }

  const employee = await Employee.findById(payroll.employee);
  if (!employee) {
    const error = new Error('Employee not found');
    error.statusCode = 404;
    throw error;
  }

  const year = payroll.periodYear;
  const month = payroll.periodMonth;
  const workingDaysOfMonth = countWorkingDaysInMonth(year, month);
  const { start, end } = getMonthRange(year, month);

  const attendanceRows = await Attendance.find({
    employee: employee._id,
    date: { $gte: start, $lte: end }
  })
    .select('employee date checkIn checkOut status')
    .lean();

  const attendanceSummary = buildAttendanceSummary(attendanceRows).get(String(employee._id));
  const salesTotals = await getSalesTotalsByEmployee([employee._id], start, end);

  const fields = computePayrollFields({
    employee,
    workingDaysOfMonth,
    attendanceSummary,
    totalSalesAmount: salesTotals.get(String(employee._id)) || 0,
    // Preserve the approved-leave value captured at generation time.
    approvedLeaveDays: payroll.approvedLeaveDays || 0
  });

  Object.assign(payroll, fields);
  payroll.requiresRegeneration = false;
  payroll.status = fields.requiresAttendanceReview
    ? PAYROLL_STATUS.NEEDS_REVIEW
    : PAYROLL_STATUS.DRAFT;
  await payroll.save();

  const updated = await PayrollRecord.findById(payroll._id)
    .populate(employeePopulate())
    .populate(financePopulate())
    .lean();

  return decoratePayroll(updated);
}

module.exports = {
  WORKING_HOURS_PER_DAY,
  OVERTIME_RATE,
  listPayroll,
  getPayrollById,
  generatePayroll,
  deleteAllPayroll,
  approvePayroll,
  recalculatePayroll
};
