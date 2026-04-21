/**
 * Low / reorder for any product (in-memory):
 * - Out of stock (currentStock <= 0), OR
 * - minStockLevel > 0 and currentStock <= minStockLevel
 *
 * If minStockLevel is 0, only "out of stock" counts as low (avoids treating all positive stock as low).
 */
function isLowStockForReorder(product) {
  if (!product) return false;
  const stock = Number(product.currentStock);
  const min = Number(product.minStockLevel);
  const s = Number.isFinite(stock) ? stock : 0;
  const m = Number.isFinite(min) ? min : 0;
  if (s <= 0) return true;
  if (m > 0 && s <= m) return true;
  return false;
}

/**
 * After stock changes: any raw material that is low/out should run the auto-purchase sweep
 * so existing items in the DB are picked up (not only ones touched in this request).
 * Products without a supplier are skipped inside generateAutoPurchaseOrders until a supplier is set.
 */
function shouldTriggerAutoPurchaseForProduct(product) {
  if (!product || product.category !== 'raw-material') {
    return false;
  }
  return isLowStockForReorder(product);
}

/** $expr body: out of stock OR (min > 0 and stock <= min). */
function lowStockMongoExpr() {
  return {
    $or: [
      { $lte: [{ $ifNull: ['$currentStock', 0] }, 0] },
      {
        $and: [
          { $gt: [{ $ifNull: ['$minStockLevel', 0] }, 0] },
          { $lte: [{ $ifNull: ['$currentStock', 0] }, { $ifNull: ['$minStockLevel', 0] }] }
        ]
      }
    ]
  };
}

/**
 * All active raw materials that are out of stock or at/below min (when min &gt; 0).
 * Includes existing rows without a supplier so alerts/schedulers see them; PO creation still requires supplier.
 */
function lowStockRawMaterialMongoFilter() {
  return {
    category: 'raw-material',
    isActive: true,
    $expr: lowStockMongoExpr()
  };
}

/** Any active product at/below reorder or out of stock (alerts / listings). */
function lowStockProductMongoFilter() {
  return {
    isActive: true,
    $expr: lowStockMongoExpr()
  };
}

module.exports = {
  isLowStockForReorder,
  shouldTriggerAutoPurchaseForProduct,
  lowStockRawMaterialMongoFilter,
  lowStockProductMongoFilter,
  lowStockMongoExpr
};
