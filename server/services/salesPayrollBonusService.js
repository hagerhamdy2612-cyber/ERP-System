const PayrollRecord = require('../models/PayrollRecord');

const SALES_ORDER_BONUS_RATE = 0.02;

function computeNetPay(basePay, bonuses, deductions) {
  const n = Number(basePay) + Number(bonuses || 0) - Number(deductions || 0);
  return Math.max(0, Math.round(n * 100) / 100);
}

/**
 * Adds 2% of order total to the employee's payroll bonuses for the order month
 * (Sales department only). Skips if that period is already paid in Finance.
 */
async function applySalesOrderPayrollBonus(employee, orderTotal, { orderNumber, orderDate } = {}) {
  if (!employee || employee.department !== 'Sales') {
    return;
  }

  const total = Number(orderTotal);
  if (Number.isNaN(total) || total <= 0) {
    return;
  }

  const bonus = Math.round(total * SALES_ORDER_BONUS_RATE * 100) / 100;
  if (bonus <= 0) {
    return;
  }

  const d = orderDate ? new Date(orderDate) : new Date();
  if (Number.isNaN(d.getTime())) {
    return;
  }

  const periodYear = d.getFullYear();
  const periodMonth = d.getMonth() + 1;
  const ref = orderNumber || 'order';

  const row = await PayrollRecord.findOne({
    employee: employee._id,
    periodYear,
    periodMonth
  });

  if (row && (row.financeExpense || row.status === 'paid')) {
    console.warn(
      `[payroll] Sales bonus skipped for ${ref}: employee ${employee.employeeId} ` +
        `${periodYear}-${String(periodMonth).padStart(2, '0')} is already paid or locked in Finance.`
    );
    return;
  }

  const noteLine = `+${bonus.toFixed(2)} (2% sales ${ref})`;

  if (row) {
    row.bonuses = Math.round((Number(row.bonuses || 0) + bonus) * 100) / 100;
    row.netPay = computeNetPay(row.basePay, row.bonuses, row.deductions);
    const existing = row.notes ? String(row.notes).trim() : '';
    row.notes = existing ? `${existing}\n${noteLine}` : noteLine;
    await row.save();
    return;
  }

  await PayrollRecord.create({
    employee: employee._id,
    periodYear,
    periodMonth,
    basePay: 0,
    bonuses: bonus,
    deductions: 0,
    netPay: computeNetPay(0, bonus, 0),
    status: 'draft',
    notes: noteLine
  });
}

module.exports = {
  applySalesOrderPayrollBonus,
  SALES_ORDER_BONUS_RATE
};
