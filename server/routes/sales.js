const express = require('express');
const { body, validationResult } = require('express-validator');
const SalesOrder = require('../models/SalesOrder');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const ProductionOrder = require('../models/ProductionOrder');
const InventoryTransaction = require('../models/InventoryTransaction');
const Employee = require('../models/Employee');
const Invoice = require('../models/Invoice');
const { protect, authorize } = require('../middleware/auth');
const { logActivity } = require('../utils/logActivity');
const { archiveDocument } = require('../services/archiveService');

const router = express.Router();

/** Next SO#### / INV#### — must use numeric max, not string sort (SO0010 < SO0009 lexicographically). */
async function getNextSalesOrderNumber() {
  const orders = await SalesOrder.find({ orderNumber: { $regex: /^SO\d+$/i } })
    .select('orderNumber')
    .setOptions({ includeDeleted: true })
    .lean();
  let max = 0;
  for (const o of orders) {
    const n = parseInt(String(o.orderNumber).replace(/^SO/i, ''), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `SO${String(max + 1).padStart(4, '0')}`;
}

async function getNextInvoiceNumber() {
  const invoices = await Invoice.find({ invoiceNumber: { $regex: /^INV\d+$/i } })
    .select('invoiceNumber')
    .lean();
  let max = 0;
  for (const inv of invoices) {
    const n = parseInt(String(inv.invoiceNumber).replace(/^INV/i, ''), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `INV${String(max + 1).padStart(4, '0')}`;
}

// @route   GET /api/sales/orders
// @desc    Get all sales orders
// @access  Private
router.get('/orders', protect, async (req, res) => {
  try {
    const { status, customer } = req.query;
    let query = {};

    if (status) {
      query.status = status;
    }

    if (customer) {
      query.customer = customer;
    }

    const orders = await SalesOrder.find(query)
      .populate('customer', 'name email company')
      .populate('salesRep', 'employeeId user')
      .populate('items.product', 'name sku')
      .populate('productionOrder', 'orderNumber status')
      .sort({ orderDate: -1 });

    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error('Get sales orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/sales/orders
// @desc    Create new sales order
// @access  Private (Sales, Admin)
router.post('/orders', [
  protect,
  authorize('admin', 'manager'),
  body('customer').isMongoId().withMessage('Valid customer ID is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product').isMongoId().withMessage('Valid product ID is required'),
  body('items.*.quantity').custom((value) => {
    const num = Number(value);
    if (isNaN(num) || num <= 0) {
      throw new Error('Valid quantity greater than 0 is required');
    }
    return true;
  })
  // unitPrice is NOT from request - it comes from Product.sellingPrice (or unitCost) in inventory
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

    const { customer, items, deliveryDate, notes } = req.body;

    // Resolve unit price from inventory (sellingPrice for final products, fallback to unitCost)
    const processedItems = [];
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Product with ID ${item.product} not found`
        });
      }
      const unitPrice = product.sellingPrice != null && product.sellingPrice > 0
        ? product.sellingPrice
        : (product.unitCost != null ? product.unitCost : 0);
      if (unitPrice <= 0) {
        return res.status(400).json({
          success: false,
          message: `Product "${product.name}" has no selling price set in inventory. Set selling price in Inventory first.`
        });
      }
      const qty = Number(item.quantity);
      processedItems.push({
        product: product._id,
        quantity: qty,
        unitPrice,
        total: qty * unitPrice
      });
    }

    let subtotal = processedItems.reduce((sum, item) => sum + item.total, 0);

    let orderNumber = await getNextSalesOrderNumber();
    let existing = await SalesOrder.findOne({ orderNumber }).setOptions({ includeDeleted: true });
    let bump = 0;
    while (existing && bump < 1000) {
      bump += 1;
      const n = parseInt(orderNumber.replace(/^SO/i, ''), 10) + 1;
      orderNumber = `SO${String(n).padStart(4, '0')}`;
      existing = await SalesOrder.findOne({ orderNumber });
    }
    if (existing) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate unique order number'
      });
    }

    const tax = subtotal * 0.1; // 10% tax
    const total = subtotal + tax;

    // Check inventory availability
    for (const item of processedItems) {
      const product = await Product.findById(item.product);
      if (product.currentStock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Required: ${item.quantity}, Available: ${product.currentStock}`
        });
      }
    }

    // Find employee record for the user
    let employee = await Employee.findOne({ user: req.user.id });
    
    // Handle deliveryDate - convert string to Date if provided
    let parsedDeliveryDate = null;
    if (deliveryDate) {
      parsedDeliveryDate = new Date(deliveryDate);
      if (isNaN(parsedDeliveryDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid delivery date format'
        });
      }
    }
    
    // Create sales order
    const salesOrder = await SalesOrder.create({
      orderNumber,
      customer,
      items: processedItems,
      subtotal,
      tax,
      total,
      deliveryDate: parsedDeliveryDate,
      salesRep: employee ? employee._id : null,
      notes: notes || ''
    });

    await salesOrder.populate('customer', 'name email company');
    await salesOrder.populate('items.product', 'name sku');

    let invoiceNumber = await getNextInvoiceNumber();
    let invExisting = await Invoice.findOne({ invoiceNumber });
    let invBump = 0;
    while (invExisting && invBump < 1000) {
      invBump += 1;
      const n = parseInt(invoiceNumber.replace(/^INV/i, ''), 10) + 1;
      invoiceNumber = `INV${String(n).padStart(4, '0')}`;
      invExisting = await Invoice.findOne({ invoiceNumber });
    }
    if (invExisting) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate unique invoice number'
      });
    }

    // Calculate due date (30 days from invoice date)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    // Get customer payment terms if available
    const customerData = await Customer.findById(customer);
    const paymentTerms = customerData?.paymentTerms || 'Net 30';

    // Create invoice with product names
    const invoiceItems = await Promise.all(
      processedItems.map(async (item) => {
        const product = await Product.findById(item.product);
        return {
          product: item.product,
          productName: product?.name || 'Unknown Product',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total
        };
      })
    );

    const invoice = await Invoice.create({
      invoiceNumber,
      salesOrder: salesOrder._id,
      customer: customer,
      items: invoiceItems,
      subtotal,
      tax,
      total,
      dueDate,
      paymentTerms,
      status: 'sent',
      notes: notes || ''
    });

    await logActivity({
      userId: req.user.id,
      action: 'CREATE',
      module: 'SALES',
      entityId: invoice._id,
      entityType: 'Invoice',
      newData: invoice.toObject ? invoice.toObject() : invoice,
      req
    });

    res.status(201).json({
      success: true,
      data: salesOrder
    });
  } catch (error) {
    console.error('Create sales order error:', error);
    console.error('Error stack:', error.stack);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate order or invoice number (try again). If this persists, contact support.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// @route   PUT /api/sales/orders/:id/confirm
// @desc    Confirm sales order
// @access  Private (Sales, Admin)
router.put('/orders/:id/confirm', [
  protect,
  authorize('admin', 'manager')
], async (req, res) => {
  try {
    const salesOrder = await SalesOrder.findById(req.params.id);
    if (!salesOrder) {
      return res.status(404).json({
        success: false,
        message: 'Sales order not found'
      });
    }

    if (salesOrder.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Sales order is not in pending status'
      });
    }

    // Check inventory again
    for (const item of salesOrder.items) {
      const product = await Product.findById(item.product);
      if (product.currentStock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Required: ${item.quantity}, Available: ${product.currentStock}`
        });
      }
    }

    // Update inventory - reduce stock for all items and create transaction records
    for (const item of salesOrder.items) {
      const product = await Product.findByIdAndUpdate(
        item.product,
        { $inc: { currentStock: -item.quantity } },
        { new: true }
      );

      // Create inventory transaction record
      await InventoryTransaction.create({
        product: item.product,
        type: 'out',
        quantity: item.quantity,
        unitCost: product.unitCost,
        totalCost: item.quantity * product.unitCost,
        reference: 'sale',
        referenceId: salesOrder._id,
        notes: `Sales order ${salesOrder.orderNumber} - ${item.quantity} units sold`
      });

      // Check if raw material stock is low and trigger auto PO generation
      if (product.category === 'raw-material' && product.currentStock <= product.minStockLevel && product.supplier) {
        const schedulerService = require('../services/schedulerService');
        schedulerService.generateAutoPurchaseOrders().catch(err => {
          console.error('Error generating auto POs after sales confirmation:', err);
        });
      }
    }

    // Update status
    salesOrder.status = 'confirmed';
    await salesOrder.save();

    // Check if production is needed
    const needsProduction = [];
    for (const item of salesOrder.items) {
      const product = await Product.findById(item.product);
      if (product.category === 'final-product' && product.currentStock < item.quantity) {
        needsProduction.push({
          product: item.product,
          quantity: item.quantity
        });
      }
    }

    // Create production orders if needed
    if (needsProduction.length > 0) {
      for (const prod of needsProduction) {
        const product = await Product.findById(prod.product);
        const orderCount = await ProductionOrder.countDocuments();
        const orderNumber = `PO${String(orderCount + 1).padStart(4, '0')}`;

        const productionOrder = await ProductionOrder.create({
          orderNumber,
          product: prod.product,
          quantity: prod.quantity,
          salesOrder: salesOrder._id,
          status: 'pending'
        });

        salesOrder.productionOrder = productionOrder._id;
        await salesOrder.save();
      }
    }

    await salesOrder.populate('customer', 'name email company');
    await salesOrder.populate('items.product', 'name sku');
    await salesOrder.populate('productionOrder', 'orderNumber status');

    res.json({
      success: true,
      data: salesOrder
    });
  } catch (error) {
    console.error('Confirm sales order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/sales/orders/:id/ship
// @desc    Ship sales order
// @access  Private (Sales, Admin)
router.put('/orders/:id/ship', [
  protect,
  authorize('admin', 'manager')
], async (req, res) => {
  try {
    const salesOrder = await SalesOrder.findById(req.params.id);
    if (!salesOrder) {
      return res.status(404).json({
        success: false,
        message: 'Sales order not found'
      });
    }

    if (salesOrder.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Sales order must be confirmed before shipping'
      });
    }

    // Update status
    salesOrder.status = 'shipped';
    await salesOrder.save();

    await salesOrder.populate('customer', 'name email company');
    await salesOrder.populate('items.product', 'name sku');

    res.json({
      success: true,
      data: salesOrder
    });
  } catch (error) {
    console.error('Ship sales order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/sales/revenue
// @desc    Get sales revenue metrics
// @access  Private
router.get('/revenue', protect, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = { status: { $in: ['confirmed', 'shipped', 'delivered'] } };

    if (startDate && endDate) {
      query.orderDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const orders = await SalesOrder.find(query);
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const orderCount = orders.length;

    const revenue = {
      totalRevenue,
      orderCount,
      averageOrderValue: orderCount > 0 ? totalRevenue / orderCount : 0,
      period: {
        startDate: startDate || 'all time',
        endDate: endDate || 'all time'
      }
    };

    res.json({
      success: true,
      data: revenue
    });
  } catch (error) {
    console.error('Get revenue error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/sales/customers-report
// @desc    Get customer analytics report
// @access  Private
router.get('/customers-report', protect, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = { status: { $in: ['confirmed', 'shipped', 'delivered'] } };

    if (startDate && endDate) {
      query.orderDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const orders = await SalesOrder.find(query)
      .populate('customer', 'name email company')
      .populate('items.product', 'name sku');

    // Calculate customer metrics
    const customerMap = new Map();
    orders.forEach(order => {
      const customerId = order.customer._id.toString();
      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          name: order.customer.name,
          email: order.customer.email,
          company: order.customer.company,
          orderCount: 0,
          totalSpent: 0,
          lastOrderDate: order.orderDate
        });
      }
      const customer = customerMap.get(customerId);
      customer.orderCount += 1;
      customer.totalSpent += order.total;
      if (order.orderDate > customer.lastOrderDate) {
        customer.lastOrderDate = order.orderDate;
      }
    });

    const topCustomers = Array.from(customerMap.values())
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    const activeCustomers = customerMap.size;

    res.json({
      success: true,
      data: {
        activeCustomers,
        topCustomers
      }
    });
  } catch (error) {
    console.error('Get customers report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/sales/products-report
// @desc    Get product sales analytics report
// @access  Private
router.get('/products-report', protect, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = { status: { $in: ['confirmed', 'shipped', 'delivered'] } };

    if (startDate && endDate) {
      query.orderDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const orders = await SalesOrder.find(query)
      .populate('items.product', 'name sku category');

    // Calculate product metrics
    const productMap = new Map();
    orders.forEach(order => {
      order.items.forEach(item => {
        const productId = item.product._id.toString();
        if (!productMap.has(productId)) {
          productMap.set(productId, {
            name: item.product.name,
            sku: item.product.sku,
            category: item.product.category,
            quantitySold: 0,
            revenue: 0
          });
        }
        const product = productMap.get(productId);
        product.quantitySold += item.quantity;
        product.revenue += item.total;
      });
    });

    const topProducts = Array.from(productMap.values())
      .map(product => ({
        ...product,
        averagePrice: product.quantitySold > 0 ? product.revenue / product.quantitySold : 0
      }))
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 10);

    const topProduct = topProducts[0] || null;

    res.json({
      success: true,
      data: {
        topProducts,
        topProduct
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

// @route   GET /api/sales/trends
// @desc    Get sales trends and patterns
// @access  Private
router.get('/trends', protect, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = { status: { $in: ['confirmed', 'shipped', 'delivered'] } };

    if (startDate && endDate) {
      query.orderDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const orders = await SalesOrder.find(query);

    // Group by month
    const monthlyData = {};
    orders.forEach(order => {
      const month = order.orderDate.toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyData[month]) {
        monthlyData[month] = {
          month: new Date(order.orderDate.getFullYear(), order.orderDate.getMonth()).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          revenue: 0,
          orders: 0
        };
      }
      monthlyData[month].revenue += order.total;
      monthlyData[month].orders += 1;
    });

    const monthlyRevenue = Object.values(monthlyData).sort((a, b) => 
      new Date(a.month) - new Date(b.month)
    );

    res.json({
      success: true,
      data: {
        monthlyRevenue
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

// @route   GET /api/sales/export/:type
// @desc    Export sales data to CSV
// @access  Private
router.get('/export/:type', protect, async (req, res) => {
  try {
    const { type } = req.params;
    const { startDate, endDate } = req.query;
    let query = { status: { $in: ['confirmed', 'shipped', 'delivered'] } };

    if (startDate && endDate) {
      query.orderDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const orders = await SalesOrder.find(query)
      .populate('customer', 'name email company')
      .populate('items.product', 'name sku');

    let csvData = '';
    let filename = '';

    switch (type) {
      case 'sales':
        csvData = 'Order Number,Customer,Total,Status,Order Date,Items\n';
        orders.forEach(order => {
          const items = order.items.map(item => `${item.product.name} (${item.quantity})`).join('; ');
          csvData += `${order.orderNumber},"${order.customer.name}",${order.total},${order.status},${order.orderDate.toISOString().split('T')[0]},"${items}"\n`;
        });
        filename = 'sales-orders.csv';
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

// @route   DELETE /api/sales/orders/:id
// @desc    Delete (archive) sales order
// @access  Private (Sales, Admin)
router.delete('/orders/:id', [
  protect,
  authorize('admin', 'manager')
], async (req, res) => {
  try {
    const salesOrder = await SalesOrder.findById(req.params.id);
    if (!salesOrder) {
      return res.status(404).json({
        success: false,
        message: 'Sales order not found'
      });
    }

    await archiveDocument({
      model: SalesOrder,
      documentId: req.params.id,
      module: 'Sales',
      documentType: 'SalesOrder',
      documentNumber: salesOrder.orderNumber,
      userId: req.user.id,
      reason: req.body?.reason
    });

    await logActivity({
      userId: req.user.id,
      action: 'DELETE',
      module: 'SALES',
      entityId: salesOrder._id,
      entityType: 'SalesOrder',
      oldData: salesOrder.toObject ? salesOrder.toObject() : { ...salesOrder._doc },
      req
    });

    res.json({
      success: true,
      message: 'Sales order archived successfully'
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error('Delete sales order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/sales/invoices
// @desc    Get all invoices
// @access  Private
router.get('/invoices', protect, async (req, res) => {
  try {
    const invoices = await Invoice.find()
      .populate('customer', 'name email company')
      .populate('salesOrder', 'orderNumber')
      .sort({ invoiceDate: -1 });

    res.json({
      success: true,
      count: invoices.length,
      data: invoices
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/sales/invoices/:orderId
// @desc    Get invoice by sales order ID
// @access  Private
router.get('/invoices/:orderId', protect, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ salesOrder: req.params.orderId })
      .populate('customer', 'name email company phone address')
      .populate('salesOrder', 'orderNumber orderDate deliveryDate')
      .populate('items.product', 'name sku');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found for this sales order'
      });
    }

    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/sales/invoices/:id/mark-paid
// @desc    Mark sales invoice as paid
// @access  Private
router.put('/invoices/:id/mark-paid', protect, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

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

    const oldData = invoice.toObject ? invoice.toObject() : { ...invoice._doc };
    invoice.status = 'paid';
    await invoice.save();
    const newData = invoice.toObject ? invoice.toObject() : { ...invoice._doc };

    await logActivity({
      userId: req.user.id,
      action: 'UPDATE',
      module: 'SALES',
      entityId: invoice._id,
      entityType: 'Invoice',
      oldData,
      newData,
      req
    });

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
