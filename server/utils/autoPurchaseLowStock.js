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

function shouldTriggerAutoPurchaseForProduct(product) {
  if (!product || product.category !== 'raw-material') {
    return false;
  }
  return isLowStockForReorder(product);
}
/*out of stock OR (min > 0 and stock <= min). */
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
