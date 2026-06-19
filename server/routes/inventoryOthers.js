const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Product = require('../models/Product');
const SalesOrder = require('../models/SalesOrder');
const PurchaseOrder = require('../models/PurchaseOrder');
const ProductionOrder = require('../models/ProductionOrder');
const { protect, authorize } = require('../middleware/auth');
const { archiveDocument } = require('../services/archiveService');
const {
  OTHERS_CATEGORY,
  buildOthersProductPayload,
  isOthersProduct,
  parseNonNegativeNumber
} = require('../utils/inventoryOthers');

const router = express.Router();

const managerAuth = [protect, authorize('admin', 'manager')];

const othersBodyValidators = [
  body('name').trim().notEmpty().withMessage('Item name is required'),
  body('sku').trim().notEmpty().withMessage('SKU is required'),
  body('unit').trim().notEmpty().withMessage('Unit is required'),
  body('description').optional({ nullable: true }),
  body('currentStock').optional().custom((value) => {
    if (value === undefined || value === '') return true;
    if (parseNonNegativeNumber(value) === null) {
      throw new Error('Current stock must be a non-negative number');
    }
    return true;
  })
];

function validationErrorResponse(res, errors) {
  const first = errors.array()[0];
  return res.status(400).json({
    success: false,
    message: first?.msg || 'Validation errors',
    errors: errors.array()
  });
}

function duplicateKeyResponse(res) {
  return res.status(400).json({
    success: false,
    message: 'SKU already exists'
  });
}

async function findOthersProductById(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  const product = await Product.findById(id);
  if (!product || !isOthersProduct(product)) return null;
  return product;
}

// @route   GET /api/inventory/others
// @desc    List miscellaneous inventory items
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const items = await Product.find({ category: OTHERS_CATEGORY, isActive: true })
      .sort({ name: 1 });

    res.json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    console.error('List others inventory error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/inventory/others
// @desc    Create miscellaneous inventory item (category fixed server-side)
// @access  Private (Inventory managers)
router.post('/', [...managerAuth, ...othersBodyValidators], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationErrorResponse(res, errors);
    }

    const payload = buildOthersProductPayload(req.body);
    const product = await Product.create(payload);

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    if (error.code === 11000) return duplicateKeyResponse(res);
    if (error.message?.includes('stock')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('Create others inventory error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/inventory/others/:id
// @desc    Update miscellaneous inventory item
// @access  Private (Inventory managers)
router.put('/:id', [...managerAuth, ...othersBodyValidators], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationErrorResponse(res, errors);
    }

    const existing = await findOthersProductById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const payload = buildOthersProductPayload(req.body, { isUpdate: true });
    const product = await Product.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true
    });

    res.json({ success: true, data: product });
  } catch (error) {
    if (error.code === 11000) return duplicateKeyResponse(res);
    if (error.message?.includes('stock')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('Update others inventory error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/inventory/others/:id
// @desc    Archive miscellaneous inventory item
// @access  Private (Inventory managers)
router.delete('/:id', managerAuth, async (req, res) => {
  try {
    const product = await findOthersProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const productId = product._id.toString();
    const [salesOrders, purchaseOrders, productionOrders] = await Promise.all([
      SalesOrder.find({ 'items.product': productId }).select('_id'),
      PurchaseOrder.find({ 'items.product': productId }).select('_id'),
      ProductionOrder.find({
        $or: [{ product: productId }, { 'materials.product': productId }]
      }).select('_id')
    ]);

    if (salesOrders.length || purchaseOrders.length || productionOrders.length) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete item. It is referenced in orders or production.'
      });
    }

    await archiveDocument({
      model: Product,
      documentId: productId,
      module: 'Inventory',
      documentType: 'Product',
      documentNumber: product.sku,
      userId: req.user.id,
      reason: req.body?.reason
    });

    res.json({ success: true, message: 'Item archived successfully' });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error('Delete others inventory error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
