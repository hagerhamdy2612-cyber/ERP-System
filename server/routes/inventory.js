const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Product = require('../models/Product');
const InventoryTransaction = require('../models/InventoryTransaction');
const SalesOrder = require('../models/SalesOrder');
const PurchaseOrder = require('../models/PurchaseOrder');
const ProductionOrder = require('../models/ProductionOrder');
const { protect, authorize } = require('../middleware/auth');
const { archiveDocument } = require('../services/archiveService');
const {
  shouldTriggerAutoPurchaseForProduct,
  lowStockProductMongoFilter,
  lowStockMongoExpr
} = require('../utils/autoPurchaseLowStock');

const router = express.Router();

/** Empty string from forms is not a valid ObjectId — use null so Mongoose can clear optional refs. */
function sanitizeProductPayload(body) {
  if (!body || typeof body !== 'object') {
    return {};
  }
  const data = { ...body };
  if (data.supplier === '' || data.supplier === undefined) {
    data.supplier = null;
  } else if (typeof data.supplier === 'string' && !mongoose.Types.ObjectId.isValid(data.supplier)) {
    data.supplier = null;
  }
  if (Array.isArray(data.requiredMaterials)) {
    data.requiredMaterials = data.requiredMaterials
      .filter((m) => m && m.product && mongoose.Types.ObjectId.isValid(String(m.product)))
      .map((m) => ({
        product: m.product,
        quantity: Number(m.quantity) || 0
      }));
  } else {
    delete data.requiredMaterials;
  }
  return data;
}

// @route   GET /api/inventory/products
// @desc    Get all products
// @access  Private
router.get('/products', protect, async (req, res) => {
  try {
    const { category, lowStock } = req.query;
    let query = { isActive: true };

    if (category) {
      if (category === 'final-product') {
        query.category = { $in: ['finished-good', 'final-product'] };
        Product.updateMany(
          { category: 'finished-good' },
          { $set: { category: 'final-product' } }
        ).catch(err => console.error('Error updating category:', err));
      } else {
        query.category = category;
      }
    }

    if (lowStock === 'true') {
      query.$expr = lowStockMongoExpr();
    }

    const products = await Product.find(query)
      .populate('supplier', 'name contactPerson')
      .populate('requiredMaterials.product', 'name sku unit unitCost')
      .sort({ name: 1 });

    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/inventory/products
// @desc    Create new product
// @access  Private (Inventory, Admin)
router.post('/products', [
  protect,
  authorize('admin', 'manager'),
  body('name').notEmpty().withMessage('Product name is required'),
  body('sku').notEmpty().withMessage('SKU is required'),
  body('category').isIn(['raw-material', 'final-product']).withMessage('Valid category is required'),
  body('unit').notEmpty().withMessage('Unit is required'),
  body('unitCost').isNumeric().withMessage('Valid unit cost is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const product = await Product.create(sanitizeProductPayload(req.body));

    // Check if raw material stock is low and trigger auto PO generation
    if (shouldTriggerAutoPurchaseForProduct(product)) {
      const schedulerService = require('../services/schedulerService');
      schedulerService.generateAutoPurchaseOrders().catch(err => {
        console.error('Error generating auto POs after product creation:', err);
      });
    }

    res.status(201).json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/inventory/products/:id
// @desc    Update product
// @access  Private (Inventory, Admin)
router.put('/products/:id', [
  protect,
  authorize('admin', 'manager')
], async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid product id' });
    }

    const payload = sanitizeProductPayload(req.body);
    const product = await Product.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if raw material stock is low and trigger auto PO generation
    if (shouldTriggerAutoPurchaseForProduct(product)) {
      const schedulerService = require('../services/schedulerService');
      schedulerService.generateAutoPurchaseOrders().catch(err => {
        console.error('Error generating auto POs after product update:', err);
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/inventory/products/:id/adjust
// @desc    Adjust product stock
// @access  Private (Inventory, Admin)
router.post('/products/:id/adjust', [
  protect,
  authorize('admin', 'manager'),
  body('quantity').isNumeric().withMessage('Valid quantity is required'),
  body('type').isIn(['in', 'out']).withMessage('Type must be in or out'),
  body('notes').notEmpty().withMessage('Notes are required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const { quantity, type, notes } = req.body;

    // Update stock
    if (type === 'in') {
      product.currentStock += quantity;
    } else {
      if (product.currentStock < quantity) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient stock for adjustment'
        });
      }
      product.currentStock -= quantity;
    }

    await product.save();

    // Create inventory transaction
    const transaction = await InventoryTransaction.create({
      product: product._id,
      type,
      quantity,
      unitCost: product.unitCost,
      totalCost: quantity * product.unitCost,
      reference: 'adjustment',
      notes,
      performedBy: req.user.id
    });

    // Check if raw material stock is low and trigger auto PO generation
    if (shouldTriggerAutoPurchaseForProduct(product)) {
      const schedulerService = require('../services/schedulerService');
      schedulerService.generateAutoPurchaseOrders().catch(err => {
        console.error('Error generating auto POs after stock adjustment:', err);
      });
    }

    res.json({
      success: true,
      data: {
        product,
        transaction
      }
    });
  } catch (error) {
    console.error('Adjust stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/inventory/transactions
// @desc    Get inventory transactions
// @access  Private
router.get('/transactions', protect, async (req, res) => {
  try {
    const { product, type, startDate, endDate } = req.query;
    let query = {};

    if (product) {
      query.product = product;
    }

    if (type) {
      query.type = type;
    }

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const transactions = await InventoryTransaction.find(query)
      .populate('product', 'name sku')
      .populate('performedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: transactions.length,
      data: transactions
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/inventory/low-stock
// @desc    Get low stock alerts
// @access  Private
router.get('/low-stock', protect, async (req, res) => {
  try {
    const products = await Product.find(lowStockProductMongoFilter())
    .populate('supplier', 'name contactPerson email')
    .sort({ currentStock: 1 });

    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error('Get low stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Miscellaneous inventory — mount before /products/:id param routes
router.use('/others', require('./inventoryOthers'));

// @route   DELETE /api/inventory/products/:id
// @desc    Delete product
// @access  Private (Inventory, Admin)
router.delete('/products/:id', [
  protect,
  authorize('admin', 'manager')
], async (req, res) => {
  try {
    console.log('Delete product request - User:', req.user?.email, 'Role:', req.user?.role);
    console.log('Product ID:', req.params.id);
    
    const product = await Product.findById(req.params.id);
    if (!product) {
      console.log('Product not found with ID:', req.params.id);
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    console.log('Product found:', product.name);
    console.log('Product ID from DB:', product._id);
    console.log('Requested ID:', req.params.id);
    console.log('IDs match:', product._id.toString() === req.params.id);

    // Check if product is being used in any orders
    console.log('Checking for product usage in orders...');
    
    try {
      const salesOrders = await SalesOrder.find({
        'items.product': req.params.id
      });
      console.log('Sales orders using this product:', salesOrders.length);

      const purchaseOrders = await PurchaseOrder.find({
        'items.product': req.params.id
      });
      console.log('Purchase orders using this product:', purchaseOrders.length);

      const productionOrders = await ProductionOrder.find({
        $or: [
          { product: req.params.id },
          { 'materials.product': req.params.id }
        ]
      });
      console.log('Production orders using this product:', productionOrders.length);

      if (salesOrders.length > 0 || purchaseOrders.length > 0 || productionOrders.length > 0) {
        console.log('Product cannot be deleted - it is being used in orders');
        return res.status(400).json({
          success: false,
          message: 'Cannot delete product. It is being used in orders or production.'
        });
      }
      
      console.log('Product is safe to delete');
    } catch (orderCheckError) {
      console.error('Error checking order usage:', orderCheckError);
      // Continue with deletion if order check fails
      console.log('Order check failed, proceeding with deletion');
    }

    await archiveDocument({
      model: Product,
      documentId: req.params.id,
      module: 'Inventory',
      documentType: 'Product',
      documentNumber: product.sku,
      userId: req.user.id,
      reason: req.body?.reason
    });

    res.json({
      success: true,
      message: 'Product archived successfully'
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error('Delete product error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/inventory/stock-value
// @desc    Get total stock value
// @access  Private
router.get('/stock-value', protect, async (req, res) => {
  try {
    const products = await Product.find({ isActive: true });
    
    const stockValue = products.reduce((total, product) => {
      return total + (product.currentStock * product.unitCost);
    }, 0);

    const stockMetrics = {
      totalValue: stockValue,
      totalProducts: products.length,
      totalItems: products.reduce((sum, product) => sum + product.currentStock, 0),
      averageValue: products.length > 0 ? stockValue / products.length : 0
    };

    res.json({
      success: true,
      data: stockMetrics
    });
  } catch (error) {
    console.error('Get stock value error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
