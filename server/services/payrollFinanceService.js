const BankAccount = require('../models/BankAccount');
const Transaction = require('../models/Transaction');
const Expense = require('../models/Expense');

const PAYROLL_EXPENSE_CATEGORY = 'Payroll';

/**
 * Records an outgoing bank transaction + expense for a paid payroll (same pattern as POST /api/finance/expenses).
 */
async function recordPayrollExpense({
  netPay,
  payrollRecordId,
  employeeDisplayName,
  periodYear,
  periodMonth,
  bankAccountId,
  paymentDate,
  notes
}) {
  const bankAccount = await BankAccount.findById(bankAccountId);
  if (!bankAccount) {
    const err = new Error('Bank account not found');
    err.statusCode = 404;
    throw err;
  }

  const amount = Number(netPay);
  if (Number.isNaN(amount) || amount <= 0) {
    const err = new Error('Net pay must be greater than 0 to pay from Finance');
    err.statusCode = 400;
    throw err;
  }

  if (bankAccount.balance < amount) {
    const err = new Error('Insufficient balance in the selected bank account');
    err.statusCode = 400;
    throw err;
  }

  const periodLabel = `${periodYear}-${String(periodMonth).padStart(2, '0')}`;
  const title = `Payroll — ${employeeDisplayName} (${periodLabel})`;
  const payDate = paymentDate && !Number.isNaN(new Date(paymentDate).getTime())
    ? new Date(paymentDate)
    : new Date();
  const noteText =
    notes ||
    `Payroll record ${payrollRecordId} — ${employeeDisplayName} ${periodLabel}`;

  const transaction = await Transaction.create({
    sourceType: 'expense',
    sourceId: null,
    sourceModel: 'Expense',
    direction: 'out',
    amount,
    bankAccount: bankAccountId,
    date: payDate,
    notes: noteText
  });

  const expense = await Expense.create({
    title,
    amount,
    category: PAYROLL_EXPENSE_CATEGORY,
    bankAccount: bankAccountId,
    transaction: transaction._id,
    date: payDate,
    notes: noteText
  });

  transaction.sourceId = expense._id;
  await transaction.save();

  bankAccount.balance -= amount;
  await bankAccount.save();

  return { expense, transaction };
}

module.exports = {
  recordPayrollExpense,
  PAYROLL_EXPENSE_CATEGORY
};
