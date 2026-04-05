const express = require('express');
const { body, validationResult } = require('express-validator');
const ProductionOrder = require('../models/ProductionOrder');
const Product = require('../models/Product');
const Employee = require('../models/Employee');
const InventoryTransaction = require('../models/InventoryTransaction');
const { protect, authorize } = require('../middleware/auth');
const { archiveDocument } = require('../services/archiveService');

const router = express.Router();

// @route   GET /api/manufacturing/production-orders
// @desc    Get all production orders
// @access  Private
router.get('/production-orders', protect, async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};

    if (status) {
      query.status = status;
    }

    const productionOrders = await ProductionOrder.find(query)
      .populate('product', 'name sku')
      .populate('assignedEmployees.employee', 'employeeId user position')
      .populate('materials.product', 'name sku unitCost')
      .populate('salesOrder', 'orderNumber customer')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: productionOrders.length,
      data: productionOrders
    });
  } catch (error) {
    console.error('Get production orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/manufacturing/production-orders
// @desc    Create new production order. Materials are taken from product's requiredMaterials (Inventory BOM).
// @access  Private (Manufacturing, Admin)
router.post('/production-orders', [
  protect,
  authorize('admin', 'manager'),
  body('product').isMongoId().withMessage('Valid product ID is required'),
  body('quantity').isNumeric().withMessage('Valid quantity is required')
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

    const { product: productId, quantity, salesOrder, notes, manufacturingCost } = req.body;
    const orderQuantity = Number(quantity);

    const product = await Product.findById(productId).populate('requiredMaterials.product', 'name sku unitCost');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (!product.requiredMaterials || product.requiredMaterials.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'This product has no required materials defined. Add them in Inventory > Final Products (Required Raw Materials).'
      });
    }

    const materials = [];
    for (const rm of product.requiredMaterials) {
      const materialProduct = rm.product;
      if (!materialProduct) continue;
      const qty = (rm.quantity || 0) * orderQuantity;
      materials.push({
        product: materialProduct._id,
        quantity: qty,
        unitCost: materialProduct.unitCost ?? 0
      });
    }

    const orderCount = await ProductionOrder.countDocuments();
    const orderNumber = `PO${String(orderCount + 1).padStart(4, '0')}`;

    const productionOrder = await ProductionOrder.create({
      orderNumber,
      product: productId,
      quantity: orderQuantity,
      materials,
      salesOrder,
      notes,
      manufacturingCost: manufacturingCost != null ? Number(manufacturingCost) : 0
    });

    await productionOrder.populate('product', 'name sku');
    await productionOrder.populate('materials.product', 'name sku unitCost');

    res.status(201).json({
      success: true,
      data: productionOrder
    });
  } catch (error) {
    console.error('Create production order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/manufacturing/production-orders/:id/start
// @desc    Start production order
// @access  Private (Manufacturing, Admin)
router.put('/production-orders/:id/start', [
  protect,
  authorize('admin', 'manager')
], async (req, res) => {
  try {
    const productionOrder = await ProductionOrder.findById(req.params.id);
    if (!productionOrder) {
      return res.status(404).json({
        success: false,
        message: 'Production order not found'
      });
    }

    if (productionOrder.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Production order is not in pending status'
      });
    }

    // Check if materials are available
    for (const material of productionOrder.materials) {
      const product = await Product.findById(material.product);
      if (product.currentStock < material.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Required: ${material.quantity}, Available: ${product.currentStock}`
        });
      }
    }

    // Update production order status
    productionOrder.status = 'in-progress';
    productionOrder.startDate = new Date();
    await productionOrder.save();

    // Consume materials from inventory
    for (const material of productionOrder.materials) {
      const product = await Product.findById(material.product);
      product.currentStock -= material.quantity;
      await product.save();

      // Create inventory transaction
      await InventoryTransaction.create({
        product: material.product,
        type: 'out',
        quantity: material.quantity,
        unitCost: material.unitCost,
        totalCost: material.quantity * material.unitCost,
        reference: 'production',
        referenceId: productionOrder._id,
        notes: `Material consumed for production order ${productionOrder.orderNumber}`,
        performedBy: req.user.id
      });

      // Check if raw material stock is low and trigger auto PO generation
      if (product.category === 'raw-material' && product.currentStock <= product.minStockLevel && product.supplier) {
        const schedulerService = require('../services/schedulerService');
        schedulerService.generateAutoPurchaseOrders().catch(err => {
          console.error('Error generating auto POs after production start:', err);
        });
      }
    }

    await productionOrder.populate('product', 'name sku');
    await productionOrder.populate('materials.product', 'name sku unitCost');

    res.json({
      success: true,
      data: productionOrder
    });
  } catch (error) {
    console.error('Start production error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/manufacturing/production-orders/:id/complete
// @desc    Complete production order
// @access  Private (Manufacturing, Admin)
router.put('/production-orders/:id/complete', [
  protect,
  authorize('admin', 'manager')
], async (req, res) => {
  try {
    const productionOrder = await ProductionOrder.findById(req.params.id);
    if (!productionOrder) {
      return res.status(404).json({
        success: false,
        message: 'Production order not found'
      });
    }

    if (productionOrder.status !== 'in-progress') {
      return res.status(400).json({
        success: false,
        message: 'Production order is not in progress'
      });
    }

    // Update production order status
    productionOrder.status = 'completed';
    productionOrder.endDate = new Date();
    await productionOrder.save();

    // Add finished goods to inventory
    const product = await Product.findById(productionOrder.product);
    product.currentStock += productionOrder.quantity;
    await product.save();

    // Create inventory transaction for finished goods
    await InventoryTransaction.create({
      product: productionOrder.product,
      type: 'in',
      quantity: productionOrder.quantity,
      unitCost: product.unitCost,
      totalCost: productionOrder.quantity * product.unitCost,
      reference: 'production',
      referenceId: productionOrder._id,
      notes: `Finished goods produced for order ${productionOrder.orderNumber}`,
      performedBy: req.user.id
    });

    await productionOrder.populate('product', 'name sku');
    await productionOrder.populate('materials.product', 'name sku unitCost');

    res.json({
      success: true,
      data: productionOrder
    });
  } catch (error) {
    console.error('Complete production error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/manufacturing/production-orders/:id/assign
// @desc    Assign employees to production order
// @access  Private (Manufacturing, Admin)
router.put('/production-orders/:id/assign', [
  protect,
  authorize('admin', 'manager'),
  body('employees').isArray().withMessage('Employees array is required')
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

    const productionOrder = await ProductionOrder.findById(req.params.id);
    if (!productionOrder) {
      return res.status(404).json({
        success: false,
        message: 'Production order not found'
      });
    }

    const { employees } = req.body;

    // Validate employees exist
    for (const emp of employees) {
      const employee = await Employee.findById(emp.employee);
      if (!employee) {
        return res.status(400).json({
          success: false,
          message: `Employee with ID ${emp.employee} not found`
        });
      }
    }

    productionOrder.assignedEmployees = employees;
    await productionOrder.save();

    await productionOrder.populate('assignedEmployees.employee', 'employeeId user position');

    res.json({
      success: true,
      data: productionOrder
    });
  } catch (error) {
    console.error('Assign employees error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/manufacturing/production-orders/:id
// @desc    Delete (archive) production order
// @access  Private (Manufacturing, Admin)
router.delete('/production-orders/:id', [
  protect,
  authorize('admin', 'manager')
], async (req, res) => {
  try {
    const productionOrder = await ProductionOrder.findById(req.params.id);
    if (!productionOrder) {
      return res.status(404).json({
        success: false,
        message: 'Production order not found'
      });
    }

    await archiveDocument({
      model: ProductionOrder,
      documentId: req.params.id,
      module: 'Production',
      documentType: 'ProductionOrder',
      documentNumber: productionOrder.orderNumber,
      userId: req.user.id,
      reason: req.body?.reason
    });

    res.json({
      success: true,
      message: 'Production order archived successfully'
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error('Delete production order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
