const Expense = require('../models/Expense');

const MANUFACTURING_EXPENSE_CATEGORY = 'Manufacturing';

/**
 * Records the manufacturing (labor / overhead) cost of a completed production order
 * as an expense.
 *
 * Only the order's `manufacturingCost` field is recorded. Raw materials are NOT added
 * here because they are already accounted for via inventory consumption, so adding them
 * would double-count the spend.
 *
 * The expense is created with status "Pending Payment" so no bank account/transaction
 * is required automatically; Finance can pay it later. It is idempotent per production
 * order (a unique partial index on referenceProductionId prevents duplicates).
 *
 * @param {Object} params
 * @param {Object} params.productionOrder - The completed ProductionOrder document.
 * @param {String} [params.productName] - Resolved product name for a readable title.
 * @returns {Promise<Object|null>} The created/existing Expense, or null when there is nothing to record.
 */
async function recordManufacturingExpense({ productionOrder, productName }) {
  if (!productionOrder) return null;

  const amount = Number(productionOrder.manufacturingCost) || 0;

  if (!(amount > 0)) {
    return null;
  }

  // Idempotent: do not record the same production order twice.
  const existing = await Expense.findOne({ referenceProductionId: productionOrder._id });
  if (existing) {
    return existing;
  }

  const label = productName || 'Production';
  const expense = await Expense.create({
    title: `Manufacturing — ${label} (${productionOrder.orderNumber})`,
    amount: Number(amount.toFixed(2)),
    category: MANUFACTURING_EXPENSE_CATEGORY,
    source: 'Manufacturing',
    type: 'Manufacturing',
    status: 'Pending Payment',
    referenceProductionId: productionOrder._id,
    date: productionOrder.endDate || new Date(),
    notes: `Auto-recorded manufacturing cost for production order ${productionOrder.orderNumber}.`
  });

  return expense;
}

module.exports = {
  recordManufacturingExpense,
  MANUFACTURING_EXPENSE_CATEGORY
};
