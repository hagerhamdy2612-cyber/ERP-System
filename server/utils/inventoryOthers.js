const OTHERS_CATEGORY = 'others';

const OTHERS_DEFAULTS = {
  unitCost: 0,
  minStockLevel: 0,
  maxStockLevel: 1000,
  supplier: null
};

function parseNonNegativeNumber(value, fallback = 0) {
  if (value === '' || value == null) return fallback;
  const num = Number(value);
  if (Number.isNaN(num) || num < 0) return null;
  return num;
}

/** Build a Product document payload for the "others" category. */
function buildOthersProductPayload(body, { isUpdate = false } = {}) {
  const name = String(body.name || '').trim();
  const sku = String(body.sku || '').trim();
  const unit = String(body.unit || '').trim();
  const description = body.description != null ? String(body.description) : '';

  const payload = {
    name,
    sku,
    unit,
    description,
    category: OTHERS_CATEGORY
  };

  if (!isUpdate || body.currentStock !== undefined) {
    const stock = parseNonNegativeNumber(body.currentStock, isUpdate ? undefined : 0);
    if (stock === null) {
      throw new Error('Current stock must be a non-negative number');
    }
    payload.currentStock = stock;
  }

  if (!isUpdate) {
    Object.assign(payload, OTHERS_DEFAULTS);
  }

  return payload;
}

function isOthersProduct(product) {
  return product?.category === OTHERS_CATEGORY;
}

module.exports = {
  OTHERS_CATEGORY,
  OTHERS_DEFAULTS,
  buildOthersProductPayload,
  isOthersProduct,
  parseNonNegativeNumber
};
