const cron = require('node-cron');
const Product = require('../models/Product');
const PurchaseOrder = require('../models/PurchaseOrder');
const PurchaseInvoice = require('../models/PurchaseInvoice');
const { lowStockRawMaterialMongoFilter } = require('../utils/autoPurchaseLowStock');

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

async function ensureInvoiceForPurchaseOrder(purchaseOrder) {
  const existingInvoice = await PurchaseInvoice.findOne({ purchaseOrder: purchaseOrder._id });
  if (existingInvoice) return existingInvoice;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  const invoiceItems = await Promise.all(
    (purchaseOrder.items || []).map(async (item) => {
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
    supplier: purchaseOrder.supplier,
    items: invoiceItems,
    subtotal: purchaseOrder.subtotal,
    tax: purchaseOrder.tax,
    total: purchaseOrder.total,
    dueDate,
    paymentTerms: 'Net 30',
    status: 'sent',
    notes: purchaseOrder.notes || ''
  });
}

class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  // Start the scheduler
  start() {
    if (this.isRunning) {
      console.log('Scheduler is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting scheduler service...');

    // Schedule automatic purchase order generation (every hour)
    this.scheduleAutoPurchaseOrders();

    console.log('Scheduler service started successfully');
  }

  // Stop the scheduler
  stop() {
    if (!this.isRunning) {
      console.log('Scheduler is not running');
      return;
    }

    this.jobs.forEach((job, name) => {
      job.destroy();
      console.log(`Stopped job: ${name}`);
    });

    this.jobs.clear();
    this.isRunning = false;
    console.log('Scheduler service stopped');
  }


  // Schedule automatic purchase order generation
  scheduleAutoPurchaseOrders() {
    // Run every hour to check for low stock of raw materials
    const job = cron.schedule('0 * * * *', async () => {
      console.log('Running automatic purchase order generation...');
      await this.generateAutoPurchaseOrders();
    }, {
      scheduled: false,
      timezone: process.env.TIMEZONE || 'UTC'
    });

    this.jobs.set('autoPurchaseOrders', job);
    job.start();
    console.log('Automatic purchase order generation scheduled every hour');
  }


  // Generate automatic purchase orders from low stock
  async generateAutoPurchaseOrders() {
    try {
      const lowStockProducts = await Product.find(lowStockRawMaterialMongoFilter()).populate(
        'supplier',
        'name contactPerson email'
      );

      console.log(
        `Auto-purchase: found ${lowStockProducts.length} low-stock raw material(s) in catalog (out of stock or stock <= min when min > 0); POs are created only where a supplier is assigned.`
      );

      const createdOrders = [];

      for (const product of lowStockProducts) {
        if (!product.supplier) {
          console.log(
            `Auto-purchase: skipping "${product.name}" (${product.sku || 'no SKU'}) — assign a supplier on this raw material in Inventory to auto-create purchase orders.`
          );
          continue;
        }

        // Skip if there is already an OPEN purchase order (not yet received/cancelled)
        // for this product, regardless of how it was created. An order that is
        // "ordered" (sent to supplier) is still in-flight and will replenish stock,
        // so creating another one would produce a duplicate PO + invoice.
        const existingOrder = await PurchaseOrder.findOne({
          'items.product': product._id,
          status: { $in: ['pending', 'ordered'] }
        });

        if (existingOrder) {
          console.log(`Auto-purchase: open PO (${existingOrder.orderNumber}, ${existingOrder.status}) already exists for ${product.name} - skipping`);
          continue;
        }

        const suggestedQuantity = product.maxStockLevel - product.currentStock;
        // Ensure quantity is at least 1 (avoid 0 or negative)
        const quantity = Math.max(1, suggestedQuantity, product.minStockLevel || 1);
        const unitPrice = product.unitCost != null ? product.unitCost : 0;
        if (unitPrice <= 0) {
          console.log(`Auto-purchase: skipping ${product.name} - invalid unitCost`);
          continue;
        }
        
        // Calculate totals
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
        console.log(`Created auto PO ${purchaseOrder.orderNumber} for ${product.name}`);
      }

      if (createdOrders.length > 0) {
        console.log(`Auto-purchase: created ${createdOrders.length} purchase order(s)`);
      } else if (lowStockProducts.length === 0) {
        console.log('Auto-purchase: no raw materials need replenishment (see low-stock rules in autoPurchaseLowStock.js)');
      } else {
        console.log('Auto-purchase: no new POs created (all low-stock products already have a pending auto PO)');
      }
    } catch (error) {
      console.error('Error generating automatic purchase orders:', error);
      // Don't throw error to prevent scheduler from stopping
    }
  }

  // Manually trigger auto purchase order generation
  async triggerAutoPurchaseOrders() {
    console.log('Manually triggering auto purchase order generation...');
    await this.generateAutoPurchaseOrders();
  }

  // Get scheduler status
  getStatus() {
    return {
      isRunning: this.isRunning,
      jobs: Array.from(this.jobs.keys())
    };
  }
}

module.exports = new SchedulerService();
