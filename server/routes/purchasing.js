const express = require('express');
const { body, validationResult } = require('express-validator');
const PurchaseOrder = require('../models/PurchaseOrder');
const Supplier = require('../models/Supplier');
const Product = require('../models/Product');
const InventoryTransaction = require('../models/InventoryTransaction');
const PurchaseInvoice = require('../models/PurchaseInvoice');
const Employee = require('../models/Employee');
const { protect, authorize, authorizeCreatePurchaseOrder, authorizeEditPurchaseOrder, authorizeAcceptPurchaseOrder, authorizeReceivePurchaseOrder, authorizeDepartment } = require('../middleware/auth');
const { logActivity } = require('../utils/logActivity');
const { archiveDocument } = require('../services/archiveService');
const { lowStockRawMaterialMongoFilter } = require('../utils/autoPurchaseLowStock');

const router = express.Router();

/**
 * Build PO line items using each product's unit cost from inventory (no client unit price).
 */
async function buildPurchaseOrderItemsFromProducts(items) {
  const processedItems = [];
  let subtotal = 0;
  for (const item of items) {
    const product = await Product.findById(item.product);
    if (!product) {
      const err = new Error('Product not found');
      err.statusCode = 400;
      throw err;
    }
    const qty = Number(item.quantity);
    if (Number.isNaN(qty) || qty <= 0) {
      const err = new Error('Each line needs a valid quantity greater than 0');
      err.statusCode = 400;
      throw err;
    }
    const unitPrice = Number(product.unitCost);
    if (Number.isNaN(unitPrice) || unitPrice < 0) {
      const err = new Error(`Product "${product.name}" has an invalid unit cost in inventory`);
      err.statusCode = 400;
      throw err;
    }
    if (unitPrice === 0) {
      const err = new Error(
        `Product "${product.name}" has no unit cost set. Set unit cost in Inventory (Raw materials) before purchasing.`
      );
      err.statusCode = 400;
      throw err;
    }
    const lineTotal = Math.round(qty * unitPrice * 100) / 100;
    subtotal = Math.round((subtotal + lineTotal) * 100) / 100;
    processedItems.push({
      product: item.product,
      quantity: qty,
      unitPrice,
      total: lineTotal
    });
  }
  return { processedItems, subtotal };
}

/**
 * Next PO#### using numeric max (safe with deleted/history gaps).
 */
async function getNextPurchaseOrderNumber() {
  const orders = await PurchaseOrder.find({ orderNumber: { $regex: /^PO\d+$/i } })
    .select('orderNumber')
    .setOptions({ includeDeleted: true })
    .lean();
  let max = 0;
  for (const o of orders) {
    const n = parseInt(String(o.orderNumber).replace(/^PO/i, ''), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `PO${String(max + 1).padStart(4, '0')}`;
}

/**
 * Create purchase order and retry on duplicate PO number collisions.
 */
async function createPurchaseOrderWithUniqueNumber(payload, maxAttempts = 5) {
  let lastError;
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const orderNumber = await getNextPurchaseOrderNumber();
      return await PurchaseOrder.create({ ...payload, orderNumber });
    } catch (error) {
      lastError = error;
      if (error?.code !== 11000) throw error;
    }
  }
  throw lastError || new Error('Failed to generate unique purchase order number');
}

async function getNextPurchaseInvoiceNumber() {
  const invoices = await PurchaseInvoice.find({ invoiceNumber: { $regex: /^PINV\d+$/i } })
    .select('invoiceNumber')
    .lean();
  let max = 0;
  for (const inv of invoices) {
    const n = parseInt(String(inv.invoiceNumber).replace(/^PINV/i, ''), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `PINV${String(max + 1).padStart(4, '0')}`;
}

async function createPurchaseInvoiceWithUniqueNumber(payload, maxAttempts = 5) {
  let lastError;
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const invoiceNumber = await getNextPurchaseInvoiceNumber();
      return await PurchaseInvoice.create({ ...payload, invoiceNumber });
    } catch (error) {
      lastError = error;
      if (error?.code !== 11000) throw error;
    }
  }
  throw lastError || new Error('Failed to generate unique purchase invoice number');
}

async function ensureInvoiceForPurchaseOrder({ purchaseOrder, supplierId, items, notes }) {
  const existingInvoice = await PurchaseInvoice.findOne({ purchaseOrder: purchaseOrder._id });
  if (existingInvoice) return existingInvoice;

  const supplierData = await Supplier.findById(supplierId || purchaseOrder.supplier);
  const paymentTerms = supplierData?.paymentTerms || 'Net 30';
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  const invoiceItems = await Promise.all(
    (items || []).map(async (item) => {
      const product = await Product.findById(item.product).select('name');
      return {
        product: item.product,
        productName: product?.name || 'Unknown Product',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total
      };
    })
  );

  return createPurchaseInvoiceWithUniqueNumber({
    purchaseOrder: purchaseOrder._id,
    supplier: supplierId || purchaseOrder.supplier,
    items: invoiceItems,
    subtotal: purchaseOrder.subtotal,
    tax: purchaseOrder.tax,
    total: purchaseOrder.total,
    dueDate,
    paymentTerms,
    status: 'sent',
    notes: notes ?? purchaseOrder.notes ?? ''
  });
}

// @route   GET /api/purchasing/orders
// @desc    Get all purchase orders
// @access  Private
router.get('/orders', protect, async (req, res) => {
  try {
    const { status, supplier } = req.query;
    let query = {};

    if (status) {
      query.status = status;
    }

    if (supplier) {
      query.supplier = supplier;
    }

    const orders = await PurchaseOrder.find(query)
      .populate('supplier', 'name contactPerson email')
      .populate('purchaser', 'employeeId user')
      .populate('items.product', 'name sku unitCost')
      .sort({ orderDate: -1 });

    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error('Get purchase orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/purchasing/orders
// @desc    Create new purchase order
// @access  Private (Admin or Employee in Purchasing department)
router.post('/orders', [
  protect,
  authorizeCreatePurchaseOrder,
  body('supplier').isMongoId().withMessage('Valid supplier ID is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product').isMongoId().withMessage('Valid product ID is required'),
  body('items.*.quantity').isNumeric().withMessage('Valid quantity is required')
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

    const { supplier, items, expectedDelivery, notes } = req.body;

    let processedItems;
    let subtotal;
    try {
      ({ processedItems, subtotal } = await buildPurchaseOrderItemsFromProducts(items));
    } catch (e) {
      const code = e.statusCode || 400;
      return res.status(code).json({ success: false, message: e.message });
    }

    const tax = subtotal * 0.1; // 10% tax
    const total = subtotal + tax;

    // Find employee record for the user
    let employee = await Employee.findOne({ user: req.user.id });

    const purchaseOrder = await createPurchaseOrderWithUniqueNumber({
      supplier,
      items: processedItems,
      subtotal,
      tax,
      total,
      expectedDelivery,
      purchaser: employee ? employee._id : null,
      notes
    });

    await purchaseOrder.populate('supplier', 'name contactPerson email');
    await purchaseOrder.populate('items.product', 'name sku unitCost');

    await logActivity({
      userId: req.user.id,
      action: 'CREATE',
      module: 'PURCHASING',
      entityId: purchaseOrder._id,
      entityType: 'PurchaseOrder',
      newData: purchaseOrder.toObject ? purchaseOrder.toObject() : purchaseOrder,
      req
    });

    // Invoice is intentionally NOT created here. It is generated when the PO is
    // accepted/placed with the supplier (PUT /orders/:id/order), so pending POs
    // don't show up as invoices in Finance before they are approved.

    res.status(201).json({
      success: true,
      data: purchaseOrder
    });
  } catch (error) {
    console.error('Create purchase order error:', error);
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate purchase order number generated. Please try again.'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/purchasing/orders/:id
// @desc    Update purchase order
// @access  Private (Admin or Manager in Purchasing department)
router.put('/orders/:id', [
  protect,
  authorizeEditPurchaseOrder,
  body('supplier').optional().isMongoId().withMessage('Valid supplier ID is required'),
  body('items').optional().isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product').optional().isMongoId().withMessage('Valid product ID is required'),
  body('items.*.quantity').optional().isNumeric().withMessage('Valid quantity is required')
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

    const purchaseOrder = await PurchaseOrder.findById(req.params.id);
    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    // Only allow editing pending orders
    if (purchaseOrder.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending orders can be edited'
      });
    }

    const oldData = purchaseOrder.toObject ? purchaseOrder.toObject() : { ...purchaseOrder._doc };
    const { supplier, items, expectedDelivery, notes } = req.body;

    // Update fields if provided
    if (supplier) purchaseOrder.supplier = supplier;
    if (items && items.length > 0) {
      let processedItems;
      let subtotal;
      try {
        ({ processedItems, subtotal } = await buildPurchaseOrderItemsFromProducts(items));
      } catch (e) {
        const code = e.statusCode || 400;
        return res.status(code).json({ success: false, message: e.message });
      }
      purchaseOrder.items = processedItems;
      purchaseOrder.subtotal = subtotal;
      purchaseOrder.tax = subtotal * 0.1; // 10% tax
      purchaseOrder.total = subtotal + purchaseOrder.tax;
    }
    if (expectedDelivery !== undefined) purchaseOrder.expectedDelivery = expectedDelivery;
    if (notes !== undefined) purchaseOrder.notes = notes;

    await purchaseOrder.save();

    await purchaseOrder.populate('supplier', 'name contactPerson email');
    await purchaseOrder.populate('items.product', 'name sku unitCost');

    const newData = purchaseOrder.toObject ? purchaseOrder.toObject() : { ...purchaseOrder._doc };
    await logActivity({
      userId: req.user.id,
      action: 'UPDATE',
      module: 'PURCHASING',
      entityId: purchaseOrder._id,
      entityType: 'PurchaseOrder',
      oldData,
      newData,
      req
    });

    res.json({
      success: true,
      data: purchaseOrder
    });
  } catch (error) {
    console.error('Update purchase order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/purchasing/orders/:id/order
// @desc    Place purchase order with supplier
// @access  Private (Admin or Manager in Purchasing department)
router.put('/orders/:id/order', [
  protect,
  authorizeAcceptPurchaseOrder
], async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);
    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    if (purchaseOrder.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Purchase order is not in pending status'
      });
    }

    purchaseOrder.status = 'ordered';
    await purchaseOrder.save();

    // The invoice (which shows up in Finance) is created only once the PO is
    // accepted/placed with the supplier — not while it is still pending.
    await ensureInvoiceForPurchaseOrder({
      purchaseOrder,
      supplierId: purchaseOrder.supplier,
      items: purchaseOrder.items,
      notes: purchaseOrder.notes || ''
    });

    await logActivity({
      userId: req.user.id,
      action: 'APPROVE',
      module: 'PURCHASING',
      entityId: purchaseOrder._id,
      entityType: 'PurchaseOrder',
      newData: purchaseOrder.toObject ? purchaseOrder.toObject() : purchaseOrder,
      req
    });

    await purchaseOrder.populate('supplier', 'name contactPerson email');
    await purchaseOrder.populate('items.product', 'name sku unitCost');

    res.json({
      success: true,
      data: purchaseOrder
    });
  } catch (error) {
    console.error('Order purchase error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/purchasing/orders/:id/receive
// @desc    Receive purchase order
// @access  Private (Admin or Employee in Purchasing department)
router.put('/orders/:id/receive', [
  protect,
  authorizeReceivePurchaseOrder
], async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);
    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    if (purchaseOrder.status !== 'ordered') {
      return res.status(400).json({
        success: false,
        message: 'Purchase order is not in ordered status'
      });
    }

    // Update purchase order status
    purchaseOrder.status = 'received';
    purchaseOrder.receivedDate = new Date();
    await purchaseOrder.save();

    // Update inventory
    for (const item of purchaseOrder.items) {
      const product = await Product.findById(item.product);
      product.currentStock += item.quantity;
      product.unitCost = item.unitPrice; // Update cost
      await product.save();

      // Create inventory transaction
      await InventoryTransaction.create({
        product: item.product,
        type: 'in',
        quantity: item.quantity,
        unitCost: item.unitPrice,
        totalCost: item.total,
        reference: 'purchase',
        referenceId: purchaseOrder._id,
        notes: `Received from purchase order ${purchaseOrder.orderNumber}`,
        performedBy: req.user.id
      });
    }

    await purchaseOrder.populate('supplier', 'name contactPerson email');
    await purchaseOrder.populate('items.product', 'name sku unitCost');

    res.json({
      success: true,
      data: purchaseOrder
    });
  } catch (error) {
    console.error('Receive purchase error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/purchasing/auto-generate
// @desc    Auto-generate purchase orders from low stock inventory
// @access  Private (Admin or Manager in Purchasing department)
router.post('/auto-generate', [
  protect,
  authorize('admin', 'manager')
], async (req, res) => {
  try {
    const lowStockProducts = await Product.find(lowStockRawMaterialMongoFilter()).populate(
      'supplier',
      'name contactPerson email'
    );

    const createdOrders = [];

    for (const product of lowStockProducts) {
      if (!product.supplier) continue;

      // Skip if there is already an open PO (pending/ordered) for this product so we
      // don't create a duplicate PO + invoice for stock that is already on the way.
      const existingOpenOrder = await PurchaseOrder.findOne({
        'items.product': product._id,
        status: { $in: ['pending', 'ordered'] }
      });
      if (existingOpenOrder) continue;

      const suggestedQuantity = product.maxStockLevel - product.currentStock;
      
      // Calculate totals
      const quantity = Math.max(suggestedQuantity, product.minStockLevel);
      const unitPrice = product.unitCost;
      const total = quantity * unitPrice;
      const subtotal = total;
      const tax = subtotal * 0.1; // 10% tax
      const totalWithTax = subtotal + tax;

      const purchaseOrder = await createPurchaseOrderWithUniqueNumber({
        supplier: product.supplier._id,
        items: [{
          product: product._id,
          quantity,
          unitPrice,
          total
        }],
        subtotal,
        tax,
        total: totalWithTax,
        status: 'pending',
        autoGenerated: true,
        source: 'inventory',
        notes: `Auto-generated from inventory: Current stock ${product.currentStock}, Min level ${product.minStockLevel}`
      });
      // Invoice is created when the PO is accepted (PUT /orders/:id/order), not at
      // auto-generation time, so unapproved auto POs don't appear in Finance.

      await purchaseOrder.populate('supplier', 'name contactPerson email');
      await purchaseOrder.populate('items.product', 'name sku unitCost');

      createdOrders.push(purchaseOrder);
    }

    res.status(201).json({
      success: true,
      count: createdOrders.length,
      data: createdOrders
    });
  } catch (error) {
    console.error('Auto-generate purchase orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/purchasing/auto-requests
// @desc    Get auto-generated purchase requests for low stock
// @access  Private
router.get('/auto-requests', protect, async (req, res) => {
  try {
    const lowStockProducts = await Product.find(lowStockRawMaterialMongoFilter()).populate(
      'supplier',
      'name contactPerson email'
    );

    const autoRequests = lowStockProducts.map(product => ({
      product: {
        id: product._id,
        name: product.name,
        sku: product.sku,
        currentStock: product.currentStock,
        minStockLevel: product.minStockLevel,
        unitCost: product.unitCost
      },
      suggestedQuantity: product.maxStockLevel - product.currentStock,
      supplier: product.supplier,
      priority: product.currentStock === 0 ? 'high' : 'medium'
    }));

    res.json({
      success: true,
      count: autoRequests.length,
      data: autoRequests
    });
  } catch (error) {
    console.error('Get auto requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/purchasing/spending
// @desc    Get purchasing spending metrics
// @access  Private
router.get('/spending', protect, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = { status: 'received' };

    if (startDate && endDate) {
      query.receivedDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const orders = await PurchaseOrder.find(query);
    const totalSpent = orders.reduce((sum, order) => sum + order.total, 0);
    const orderCount = orders.length;

    const spending = {
      totalSpent,
      orderCount,
      averageOrderValue: orderCount > 0 ? totalSpent / orderCount : 0,
      period: {
        startDate: startDate || 'all time',
        endDate: endDate || 'all time'
      }
    };

    res.json({
      success: true,
      data: spending
    });
  } catch (error) {
    console.error('Get spending error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/purchasing/suppliers-report
// @desc    Get supplier analytics report
// @access  Private
router.get('/suppliers-report', protect, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = { status: 'received' };

    if (startDate && endDate) {
      query.receivedDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const orders = await PurchaseOrder.find(query)
      .populate('supplier', 'name contactPerson email')
      .populate('items.product', 'name sku');

    // Calculate supplier metrics
    const supplierMap = new Map();
    orders.forEach(order => {
      const supplierId = order.supplier._id.toString();
      if (!supplierMap.has(supplierId)) {
        supplierMap.set(supplierId, {
          name: order.supplier.name,
          contactPerson: order.supplier.contactPerson,
          email: order.supplier.email,
          orderCount: 0,
          totalSpent: 0,
          lastOrderDate: order.orderDate
        });
      }
      const supplier = supplierMap.get(supplierId);
      supplier.orderCount += 1;
      supplier.totalSpent += order.total;
      if (order.orderDate > supplier.lastOrderDate) {
        supplier.lastOrderDate = order.orderDate;
      }
    });

    const topSuppliers = Array.from(supplierMap.values())
      .map(supplier => ({
        ...supplier,
        averageOrderValue: supplier.totalSpent / supplier.orderCount
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    const activeSuppliers = supplierMap.size;

    res.json({
      success: true,
      data: {
        activeSuppliers,
        topSuppliers
      }
    });
  } catch (error) {
    console.error('Get suppliers report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/purchasing/products-report
// @desc    Get product purchasing analytics report
// @access  Private
router.get('/products-report', protect, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = { status: 'received' };

    if (startDate && endDate) {
      query.receivedDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const orders = await PurchaseOrder.find(query)
      .populate('supplier', 'name')
      .populate('items.product', 'name sku category');

    // Calculate product metrics
    const productMap = new Map();
    const categoryMap = new Map();

    orders.forEach(order => {
      order.items.forEach(item => {
        const productId = item.product._id.toString();
        if (!productMap.has(productId)) {
          productMap.set(productId, {
            name: item.product.name,
            sku: item.product.sku,
            category: item.product.category,
            quantityPurchased: 0,
            totalCost: 0,
            suppliers: new Set()
          });
        }
        const product = productMap.get(productId);
        product.quantityPurchased += item.quantity;
        product.totalCost += item.total;
        product.suppliers.add(order.supplier.name);

        // Category breakdown
        const category = item.product.category;
        if (!categoryMap.has(category)) {
          categoryMap.set(category, {
            count: 0,
            totalCost: 0
          });
        }
        const categoryData = categoryMap.get(category);
        categoryData.count += 1;
        categoryData.totalCost += item.total;
      });
    });

    const topProducts = Array.from(productMap.values())
      .map(product => ({
        ...product,
        averageUnitCost: product.totalCost / product.quantityPurchased,
        supplier: Array.from(product.suppliers).join(', ')
      }))
      .sort((a, b) => b.quantityPurchased - a.quantityPurchased)
      .slice(0, 10);

    const categoryBreakdown = Object.fromEntries(
      Array.from(categoryMap.entries()).map(([category, data]) => [
        category,
        {
          count: data.count,
          totalCost: data.totalCost
        }
      ])
    );

    res.json({
      success: true,
      data: {
        topProducts,
        categoryBreakdown
      }
    });
  } catch (error) {
    console.error('Get products report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/purchasing/trends
// @desc    Get purchasing trends and patterns
// @access  Private
router.get('/trends', protect, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = { status: 'received' };

    if (startDate && endDate) {
      query.receivedDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const orders = await PurchaseOrder.find(query);

    // Group by month
    const monthlyData = {};
    orders.forEach(order => {
      const month = order.receivedDate.toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyData[month]) {
        monthlyData[month] = {
          month: new Date(order.receivedDate.getFullYear(), order.receivedDate.getMonth()).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          spending: 0,
          orders: 0
        };
      }
      monthlyData[month].spending += order.total;
      monthlyData[month].orders += 1;
    });

    const monthlySpending = Object.values(monthlyData).sort((a, b) => 
      new Date(a.month) - new Date(b.month)
    );

    res.json({
      success: true,
      data: {
        monthlySpending
      }
    });
  } catch (error) {
    console.error('Get trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/purchasing/low-stock-alerts
// @desc    Get low stock alerts for purchasing
// @access  Private
router.get('/low-stock-alerts', protect, async (req, res) => {
  try {
    const lowStockProducts = await Product.find(lowStockRawMaterialMongoFilter()).populate(
      'supplier',
      'name contactPerson email'
    );

    const alerts = lowStockProducts.map(product => ({
      product: {
        id: product._id,
        name: product.name,
        sku: product.sku,
        currentStock: product.currentStock,
        minStockLevel: product.minStockLevel,
        maxStockLevel: product.maxStockLevel,
        unitCost: product.unitCost
      },
      suggestedQuantity: product.maxStockLevel - product.currentStock,
      supplier: product.supplier,
      priority: product.currentStock === 0 ? 'high' : 'medium'
    }));

    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    console.error('Get low stock alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/purchasing/export/:type
// @desc    Export purchasing data to CSV
// @access  Private
router.get('/export/:type', protect, async (req, res) => {
  try {
    const { type } = req.params;
    const { startDate, endDate } = req.query;
    let query = { status: 'received' };

    if (startDate && endDate) {
      query.receivedDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const orders = await PurchaseOrder.find(query)
      .populate('supplier', 'name contactPerson email')
      .populate('items.product', 'name sku');

    let csvData = '';
    let filename = '';

    switch (type) {
      case 'purchasing':
        csvData = 'Order Number,Supplier,Total,Status,Order Date,Received Date,Items\n';
        orders.forEach(order => {
          const items = order.items.map(item => `${item.product.name} (${item.quantity})`).join('; ');
          csvData += `${order.orderNumber},"${order.supplier.name}",${order.total},${order.status},${order.orderDate.toISOString().split('T')[0]},${order.receivedDate ? order.receivedDate.toISOString().split('T')[0] : 'N/A'},"${items}"\n`;
        });
        filename = 'purchase-orders.csv';
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid export type'
        });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvData);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/purchasing/orders/:id
// @desc    Delete (archive) purchase order
// @access  Private (Admin or Manager in Purchasing department)
router.delete('/orders/:id', [
  protect,
  authorizeDepartment('Purchasing')
], async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);
    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    await archiveDocument({
      model: PurchaseOrder,
      documentId: req.params.id,
      module: 'Purchasing',
      documentType: 'PurchaseOrder',
      documentNumber: purchaseOrder.orderNumber,
      userId: req.user.id,
      reason: req.body?.reason
    });

    await logActivity({
      userId: req.user.id,
      action: 'DELETE',
      module: 'PURCHASING',
      entityId: purchaseOrder._id,
      entityType: 'PurchaseOrder',
      oldData: purchaseOrder.toObject ? purchaseOrder.toObject() : { ...purchaseOrder._doc },
      req
    });

    res.json({
      success: true,
      message: 'Purchase order archived successfully'
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error('Delete purchase order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ==================== REPORTS ENDPOINTS ====================

// @route   GET /api/purchasing/spending
// @desc    Get spending report
// @access  Private
router.get('/spending', protect, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = { status: { $in: ['completed', 'delivered'] } };

    if (startDate && endDate) {
      query.orderDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const orders = await PurchaseOrder.find(query);
    
    const totalSpending = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const orderCount = orders.length;
    const averageOrderValue = orderCount > 0 ? totalSpending / orderCount : 0;

    // Monthly spending breakdown
    const monthlySpending = {};
    orders.forEach(order => {
      const month = new Date(order.orderDate).toISOString().substring(0, 7);
      monthlySpending[month] = (monthlySpending[month] || 0) + (order.totalAmount || 0);
    });

    res.json({
      success: true,
      data: {
        totalSpending,
        orderCount,
        averageOrderValue,
        monthlySpending
      }
    });
  } catch (error) {
    console.error('Spending report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate spending report'
    });
  }
});

// @route   GET /api/purchasing/orders-report
// @desc    Get orders report (with date filtering)
// @access  Private
router.get('/orders-report', protect, async (req, res) => {
  try {
    const { startDate, endDate, status, supplier } = req.query;
    let query = {};

    if (status) {
      query.status = status;
    }

    if (supplier) {
      query.supplier = supplier;
    }

    if (startDate && endDate) {
      query.orderDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const orders = await PurchaseOrder.find(query)
      .populate('supplier', 'name contactPerson email')
      .populate('purchaser', 'employeeId user')
      .populate('items.product', 'name sku unitCost')
      .sort({ orderDate: -1 });

    // Calculate summary statistics
    const totalOrders = orders.length;
    const completedOrders = orders.filter(order => order.status === 'completed').length;
    const pendingOrders = orders.filter(order => order.status === 'pending').length;
    const totalValue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    res.json({
      success: true,
      data: {
        orders,
        summary: {
          totalOrders,
          completedOrders,
          pendingOrders,
          totalValue
        }
      }
    });
  } catch (error) {
    console.error('Orders report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate orders report'
    });
  }
});

// @route   GET /api/purchasing/suppliers-report
// @desc    Get suppliers report
// @access  Private
router.get('/suppliers-report', protect, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let orderQuery = { status: { $in: ['completed', 'delivered'] } };

    if (startDate && endDate) {
      orderQuery.orderDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const orders = await PurchaseOrder.find(orderQuery)
      .populate('supplier', 'name contactPerson email phone')
      .populate('items.product', 'name sku');

    // Group by supplier
    const supplierStats = {};
    orders.forEach(order => {
      const supplierId = order.supplier._id.toString();
      if (!supplierStats[supplierId]) {
        supplierStats[supplierId] = {
          supplier: order.supplier,
          totalOrders: 0,
          totalSpent: 0,
          lastOrderDate: null
        };
      }
      
      supplierStats[supplierId].totalOrders += 1;
      supplierStats[supplierId].totalSpent += order.totalAmount || 0;
      
      if (!supplierStats[supplierId].lastOrderDate || 
          new Date(order.orderDate) > new Date(supplierStats[supplierId].lastOrderDate)) {
        supplierStats[supplierId].lastOrderDate = order.orderDate;
      }
    });

    const suppliers = Object.values(supplierStats).sort((a, b) => b.totalSpent - a.totalSpent);

    res.json({
      success: true,
      data: {
        suppliers,
        totalSuppliers: suppliers.length
      }
    });
  } catch (error) {
    console.error('Suppliers report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate suppliers report'
    });
  }
});

// @route   GET /api/purchasing/products-report
// @desc    Get products report
// @access  Private
router.get('/products-report', protect, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let orderQuery = { status: { $in: ['completed', 'delivered'] } };

    if (startDate && endDate) {
      orderQuery.orderDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const orders = await PurchaseOrder.find(orderQuery)
      .populate('items.product', 'name sku category unitCost');

    // Group by product
    const productStats = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        const productId = item.product._id.toString();
        if (!productStats[productId]) {
          productStats[productId] = {
            product: item.product,
            totalQuantity: 0,
            totalValue: 0,
            orderCount: 0
          };
        }
        
        productStats[productId].totalQuantity += item.quantity;
        productStats[productId].totalValue += item.quantity * item.unitPrice;
        productStats[productId].orderCount += 1;
      });
    });

    const products = Object.values(productStats).sort((a, b) => b.totalValue - a.totalValue);

    res.json({
      success: true,
      data: {
        products,
        totalProducts: products.length
      }
    });
  } catch (error) {
    console.error('Products report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate products report'
    });
  }
});

// @route   GET /api/purchasing/trends
// @desc    Get purchasing trends
// @access  Private
router.get('/trends', protect, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = { status: { $in: ['completed', 'delivered'] } };

    if (startDate && endDate) {
      query.orderDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const orders = await PurchaseOrder.find(query).sort({ orderDate: 1 });

    // Group by month
    const monthlyData = {};
    orders.forEach(order => {
      const month = new Date(order.orderDate).toISOString().substring(0, 7);
      if (!monthlyData[month]) {
        monthlyData[month] = {
          month,
          orderCount: 0,
          totalValue: 0
        };
      }
      monthlyData[month].orderCount += 1;
      monthlyData[month].totalValue += order.totalAmount || 0;
    });

    const trends = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));

    res.json({
      success: true,
      data: {
        trends
      }
    });
  } catch (error) {
    console.error('Trends report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate trends report'
    });
  }
});

// @route   GET /api/purchasing/export/:type
// @desc    Export purchasing data
// @access  Private
router.get('/export/:type', protect, async (req, res) => {
  try {
    const { type } = req.params;
    const { startDate, endDate } = req.query;

    // This is a placeholder - you would implement actual CSV export here
    res.json({
      success: true,
      message: `Export functionality for ${type} not yet implemented`,
      data: {
        type,
        startDate,
        endDate
      }
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export data'
    });
  }
});

// @route   GET /api/purchasing/invoices
// @desc    Get all purchase invoices
// @access  Private
router.get('/invoices', protect, async (req, res) => {
  try {
    const invoices = await PurchaseInvoice.find()
      .populate('supplier', 'name contactPerson email')
      .populate('purchaseOrder', 'orderNumber')
      .sort({ invoiceDate: -1 });

    res.json({
      success: true,
      count: invoices.length,
      data: invoices
    });
  } catch (error) {
    console.error('Get purchase invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/purchasing/invoices/:orderId
// @desc    Get purchase invoice by purchase order ID
// @access  Private
router.get('/invoices/:orderId', protect, async (req, res) => {
  try {
    const invoice = await PurchaseInvoice.findOne({ purchaseOrder: req.params.orderId })
      .populate('supplier', 'name contactPerson email phone address')
      .populate('purchaseOrder', 'orderNumber orderDate expectedDelivery')
      .populate('items.product', 'name sku');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found for this purchase order'
      });
    }

    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Get purchase invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/purchasing/invoices/:id/mark-paid
// @desc    Mark purchase invoice as paid
// @access  Private
router.put('/invoices/:id/mark-paid', protect, async (req, res) => {
  try {
    const invoice = await PurchaseInvoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Invoice is already marked as paid'
      });
    }

    // Update invoice status
    invoice.status = 'paid';
    await invoice.save();

    res.json({
      success: true,
      message: 'Invoice marked as paid',
      data: invoice
    });
  } catch (error) {
    console.error('Mark invoice paid error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
