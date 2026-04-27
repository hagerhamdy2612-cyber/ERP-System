const BankAccount = require('../models/BankAccount');
const Transaction = require('../models/Transaction');
const Expense = require('../models/Expense');

const PAYROLL_EXPENSE_CATEGORY = 'Payroll';

async function recordPayrollExpense({
  netPay,
  payrollRecordId,
  employeeDisplayName,
  periodYear,
  periodMonth,
  bankAccountId,
  paymentDate,
  notes,
  existingExpenseId
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

  let expense = null;
  if (existingExpenseId) {
    expense = await Expense.findById(existingExpenseId);
    if (!expense) {
      const err = new Error('Linked payroll expense not found');
      err.statusCode = 404;
      throw err;
    }
    if (expense.status === 'Paid') {
      const err = new Error('This payroll expense is already paid');
      err.statusCode = 400;
      throw err;
    }
  }

  const transaction = await Transaction.create({
    sourceType: 'expense',
    sourceId: existingExpenseId || null,
    sourceModel: 'Expense',
    direction: 'out',
    amount,
    bankAccount: bankAccountId,
    date: payDate,
    notes: noteText
  });

  if (expense) {
    expense.title = expense.title || title;
    expense.amount = amount;
    expense.category = PAYROLL_EXPENSE_CATEGORY;
    expense.bankAccount = bankAccountId;
    expense.transaction = transaction._id;
    expense.date = payDate;
    expense.notes = noteText;
    expense.status = 'Paid';
    await expense.save();
  } else {
    expense = await Expense.create({
      title,
      amount,
      category: PAYROLL_EXPENSE_CATEGORY,
      source: 'Payroll',
      type: 'Salary',
      status: 'Paid',
      referencePayrollId: payrollRecordId,
      bankAccount: bankAccountId,
      transaction: transaction._id,
      date: payDate,
      notes: noteText
    });
  }

  if (!transaction.sourceId) {
    transaction.sourceId = expense._id;
    await transaction.save();
  }

  bankAccount.balance -= amount;
  await bankAccount.save();

  return { expense, transaction };
}

module.exports = {
  recordPayrollExpense,
  PAYROLL_EXPENSE_CATEGORY
};
