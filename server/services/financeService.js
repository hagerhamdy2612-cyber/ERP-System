const Expense = require('../models/Expense');

function roundCurrency(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

async function createPendingPayrollExpense(payrollRecord) {
  const amount = roundCurrency(payrollRecord.netSalary ?? payrollRecord.netPay);
  if (amount <= 0) {
    const error = new Error('Cannot create payroll expense with zero amount');
    error.statusCode = 400;
    throw error;
  }

  const periodLabel = `${payrollRecord.periodYear}-${String(payrollRecord.periodMonth).padStart(2, '0')}`;
  const employeeCode = payrollRecord.employee?.employeeId || 'N/A';

  const expense = await Expense.create({
    title: `Payroll ${employeeCode} ${periodLabel}`,
    amount,
    category: 'Payroll',
    source: 'Payroll',
    employee: payrollRecord.employee?._id || null,
    employeeId: employeeCode,
    type: 'Salary',
    status: 'Pending Payment',
    referencePayrollId: payrollRecord._id,
    notes: payrollRecord.notes || `Pending salary expense for ${periodLabel}`
  });

  return expense;
}

module.exports = {
  createPendingPayrollExpense
};
