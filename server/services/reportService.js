const moment = require('moment');
const ExcelJS = require('exceljs');
const SalesOrder = require('../models/SalesOrder');
const PurchaseOrder = require('../models/PurchaseOrder');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const InventoryTransaction = require('../models/InventoryTransaction');
const ProductionOrder = require('../models/ProductionOrder');
const Complaint = require('../models/Complaint');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const { calculateAttendanceMetrics } = require('../utils/attendanceMetrics');
const {
  isLowStockForReorder,
  lowStockRawMaterialMongoFilter
} = require('../utils/autoPurchaseLowStock');

class ReportService {
  constructor() {
    // Direct database access instead of HTTP requests
  }

  // Generate CSV data for sales report
  generateSalesCSV(salesData) {
    let csv = 'Order Number,Customer,Total,Status,Order Date,Items\n';
    
    if (salesData.orders && salesData.orders.length > 0) {
      salesData.orders.forEach(order => {
        const items = order.items ? 
          order.items.map(item => `${item.product?.name || 'Unknown'} (${item.quantity})`).join('; ') : '';
        const customerName = order.customer?.name || 'Unknown Customer';
        const orderDate = moment(order.orderDate).format('YYYY-MM-DD');
        csv += `${order.orderNumber},"${customerName}",${order.total},${order.status},${orderDate},"${items}"\n`;
      });
    }
    
    return csv;
  }

  // Generate CSV data for purchasing report
  generatePurchasingCSV(purchasingData) {
    let csv = 'Order Number,Supplier,Total,Status,Order Date,Received Date,Items\n';
    
    if (purchasingData.orders && purchasingData.orders.length > 0) {
      purchasingData.orders.forEach(order => {
        const items = order.items ? 
          order.items.map(item => `${item.product?.name || 'Unknown'} (${item.quantity})`).join('; ') : '';
        const supplierName = order.supplier?.name || 'Unknown Supplier';
        const orderDate = moment(order.orderDate).format('YYYY-MM-DD');
        const receivedDate = order.receivedDate ? 
          moment(order.receivedDate).format('YYYY-MM-DD') : 'N/A';
        csv += `${order.orderNumber},"${supplierName}",${order.total},${order.status},${orderDate},${receivedDate},"${items}"\n`;
      });
    }
    
    return csv;
  }

  // Fetch sales report data
  async fetchSalesReport(startDate, endDate) {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // End of day

      // Get revenue data
      const revenueOrders = await SalesOrder.find({
        status: { $in: ['confirmed', 'shipped', 'delivered'] },
        orderDate: { $gte: start, $lte: end }
      });

      const totalRevenue = revenueOrders.reduce((sum, order) => sum + (order.total || 0), 0);
      const orderCount = revenueOrders.length;
      const averageOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

      const revenue = {
        totalRevenue,
        orderCount,
        averageOrderValue,
        period: { startDate, endDate }
      };

      // Get orders data
      const orders = await SalesOrder.find({
        orderDate: { $gte: start, $lte: end }
      })
      .populate('customer', 'name email company')
      .populate('items.product', 'name sku')
      .sort({ orderDate: -1 });

      // Get customer analytics
      const customerMap = new Map();
      revenueOrders.forEach(order => {
        if (order.customer) {
          const customerId = order.customer.toString();
          if (!customerMap.has(customerId)) {
            customerMap.set(customerId, {
              name: order.customer.name || 'Unknown',
              email: order.customer.email || '',
              company: order.customer.company || '',
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
        }
      });

      const topCustomers = Array.from(customerMap.values())
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 10);

      const customers = {
        activeCustomers: customerMap.size,
        topCustomers
      };

      // Get product analytics
      const productMap = new Map();
      revenueOrders.forEach(order => {
        order.items.forEach(item => {
          if (item.product) {
            const productId = item.product.toString();
            if (!productMap.has(productId)) {
              productMap.set(productId, {
                name: item.product.name || 'Unknown',
                sku: item.product.sku || '',
                category: item.product.category || '',
                quantitySold: 0,
                revenue: 0
              });
            }
            const product = productMap.get(productId);
            product.quantitySold += item.quantity;
            product.revenue += item.total;
          }
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

      const products = {
        topProducts,
        topProduct
      };

      const salesData = {
        revenue,
        orders,
        customers,
        products
      };

      // Generate CSV data
      salesData.csvData = this.generateSalesCSV(salesData);

      return salesData;
    } catch (error) {
      console.error('Error fetching sales report:', error);
      throw error;
    }
  }

  // Fetch purchasing report data
  async fetchPurchasingReport(startDate, endDate) {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // End of day

      // Get spending data
      const receivedOrders = await PurchaseOrder.find({
        status: 'received',
        receivedDate: { $gte: start, $lte: end }
      });

      const totalSpent = receivedOrders.reduce((sum, order) => sum + (order.total || 0), 0);
      const orderCount = receivedOrders.length;
      const averageOrderValue = orderCount > 0 ? totalSpent / orderCount : 0;

      const spending = {
        totalSpent,
        orderCount,
        averageOrderValue,
        period: { startDate, endDate }
      };

      // Get orders data
      const orders = await PurchaseOrder.find({
        orderDate: { $gte: start, $lte: end }
      })
      .populate('supplier', 'name contactPerson email')
      .populate('items.product', 'name sku')
      .sort({ orderDate: -1 });

      // Get supplier analytics
      const supplierMap = new Map();
      receivedOrders.forEach(order => {
        if (order.supplier) {
          const supplierId = order.supplier.toString();
          if (!supplierMap.has(supplierId)) {
            supplierMap.set(supplierId, {
              name: order.supplier.name || 'Unknown',
              contactPerson: order.supplier.contactPerson || '',
              email: order.supplier.email || '',
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
        }
      });

      const topSuppliers = Array.from(supplierMap.values())
        .map(supplier => ({
          ...supplier,
          averageOrderValue: supplier.totalSpent / supplier.orderCount
        }))
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 10);

      const suppliers = {
        activeSuppliers: supplierMap.size,
        topSuppliers
      };

      // Get product analytics
      const productMap = new Map();
      const categoryMap = new Map();

      receivedOrders.forEach(order => {
        order.items.forEach(item => {
          if (item.product) {
            const productId = item.product.toString();
            if (!productMap.has(productId)) {
              productMap.set(productId, {
                name: item.product.name || 'Unknown',
                sku: item.product.sku || '',
                category: item.product.category || '',
                quantityPurchased: 0,
                totalCost: 0,
                suppliers: new Set()
              });
            }
            const product = productMap.get(productId);
            product.quantityPurchased += item.quantity;
            product.totalCost += item.total;
            if (order.supplier) {
              product.suppliers.add(order.supplier.name || 'Unknown');
            }

            // Category breakdown
            const category = item.product.category || 'Unknown';
            if (!categoryMap.has(category)) {
              categoryMap.set(category, {
                count: 0,
                totalCost: 0
              });
            }
            const categoryData = categoryMap.get(category);
            categoryData.count += 1;
            categoryData.totalCost += item.total;
          }
        });
      });

      const topProducts = Array.from(productMap.values())
        .map(product => ({
          ...product,
          averageUnitCost: product.quantityPurchased > 0 ? product.totalCost / product.quantityPurchased : 0,
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

      const products = {
        topProducts,
        categoryBreakdown
      };

      // Get low stock alerts
      const lowStockProducts = await Product.find(lowStockRawMaterialMongoFilter()).populate(
        'supplier',
        'name contactPerson email'
      );

      const lowStock = lowStockProducts.map(product => ({
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

      const purchasingData = {
        spending,
        orders,
        suppliers,
        products,
        lowStock
      };

      // Generate CSV data
      purchasingData.csvData = this.generatePurchasingCSV(purchasingData);

      return purchasingData;
    } catch (error) {
      console.error('Error fetching purchasing report:', error);
      throw error;
    }
  }


  // Generate daily reports for yesterday
  async generateDailyReports() {
    const yesterday = moment().subtract(1, 'day');
    const startDate = yesterday.format('YYYY-MM-DD');
    const endDate = yesterday.format('YYYY-MM-DD');

    console.log(`Generating daily reports for ${startDate}`);

    try {
      const [salesData, purchasingData] = await Promise.all([
        this.fetchSalesReport(startDate, endDate),
        this.fetchPurchasingReport(startDate, endDate)
      ]);

      return {
        salesData,
        purchasingData,
        date: startDate
      };
    } catch (error) {
      console.error('Error generating daily reports:', error);
      throw error;
    }
  }

  // Generate reports for custom date range
  async generateCustomReports(startDate, endDate) {
    console.log(`Generating custom reports from ${startDate} to ${endDate}`);

    try {
      const [salesData, purchasingData] = await Promise.all([
        this.fetchSalesReport(startDate, endDate),
        this.fetchPurchasingReport(startDate, endDate)
      ]);

      return {
        salesData,
        purchasingData,
        date: `${startDate} to ${endDate}`
      };
    } catch (error) {
      console.error('Error generating custom reports:', error);
      throw error;
    }
  }

  // Fetch inventory report data
  async fetchInventoryReport(startDate, endDate) {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // Get all products
      const products = await Product.find({ isActive: true })
        .populate('supplier', 'name')
        .sort({ name: 1 });

      const totalInventoryValue = products.reduce((sum, p) => 
        sum + (p.currentStock * (p.unitCost || 0)), 0
      );

      // Get transactions in date range
      const transactions = await InventoryTransaction.find({
        createdAt: { $gte: start, $lte: end }
      })
        .populate('product', 'name sku category')
        .populate('performedBy', 'employeeId')
        .sort({ createdAt: -1 });

      // Calculate transaction stats
      const transactionStats = {
        totalTransactions: transactions.length,
        inTransactions: transactions.filter(t => t.type === 'in').length,
        outTransactions: transactions.filter(t => t.type === 'out').length,
        adjustmentTransactions: transactions.filter(t => t.type === 'adjustment').length,
        totalInValue: transactions
          .filter(t => t.type === 'in')
          .reduce((sum, t) => sum + (t.totalCost || 0), 0),
        totalOutValue: transactions
          .filter(t => t.type === 'out')
          .reduce((sum, t) => sum + (t.totalCost || 0), 0)
      };

      // Low stock products
      const lowStockProducts = products.filter((p) => isLowStockForReorder(p)).map((p) => ({
        name: p.name,
        sku: p.sku,
        currentStock: p.currentStock,
        minStockLevel: p.minStockLevel,
        maxStockLevel: p.maxStockLevel,
        unitCost: p.unitCost,
        category: p.category
      }));

      // Category breakdown
      const categoryMap = new Map();
      products.forEach(product => {
        const category = product.category || 'Uncategorized';
        if (!categoryMap.has(category)) {
          categoryMap.set(category, {
            count: 0,
            totalValue: 0,
            totalStock: 0
          });
        }
        const cat = categoryMap.get(category);
        cat.count += 1;
        cat.totalValue += product.currentStock * (product.unitCost || 0);
        cat.totalStock += product.currentStock;
      });

      const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({
        category,
        ...data
      }));

      // Top products by value
      const topProductsByValue = products
        .map(p => ({
          name: p.name,
          sku: p.sku,
          category: p.category,
          stock: p.currentStock,
          unitCost: p.unitCost,
          totalValue: p.currentStock * (p.unitCost || 0)
        }))
        .sort((a, b) => b.totalValue - a.totalValue)
        .slice(0, 10);

      // All products information (for report sheet)
      const allProducts = products.map(p => ({
        name: p.name,
        sku: p.sku,
        description: p.description || '',
        category: p.category || '',
        unit: p.unit || '',
        currentStock: p.currentStock,
        minStockLevel: p.minStockLevel,
        maxStockLevel: p.maxStockLevel,
        unitCost: p.unitCost,
        sellingPrice: p.sellingPrice != null ? p.sellingPrice : '',
        supplierName: p.supplier?.name || 'N/A',
        stockValue: (p.currentStock || 0) * (p.unitCost || 0),
        isLowStock: isLowStockForReorder(p)
      }));

      return {
        summary: {
          totalProducts: products.length,
          totalInventoryValue,
          lowStockCount: lowStockProducts.length,
          period: { startDate, endDate }
        },
        transactionStats,
        lowStockProducts,
        categoryBreakdown,
        topProductsByValue,
        allProducts,
        transactions: transactions.slice(0, 100) // Limit to recent 100
      };
    } catch (error) {
      console.error('Error fetching inventory report:', error);
      throw error;
    }
  }

  // Fetch manufacturing report data
  async fetchManufacturingReport(startDate, endDate) {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // Get production orders
      const productionOrders = await ProductionOrder.find({
        createdAt: { $gte: start, $lte: end }
      })
        .populate('product', 'name sku')
        .populate('assignedEmployees.employee', 'employeeId position')
        .populate('materials.product', 'name sku unit')
        .populate('salesOrder', 'orderNumber')
        .sort({ createdAt: -1 });

      const completedOrders = productionOrders.filter(o => o.status === 'completed');
      const inProgressOrders = productionOrders.filter(o => o.status === 'in-progress');
      const pendingOrders = productionOrders.filter(o => o.status === 'pending');

      // Calculate efficiency metrics
      const totalQuantity = completedOrders.reduce((sum, o) => sum + (o.quantity || 0), 0);
      const totalMaterialCost = completedOrders.reduce((sum, order) => {
        const materialCost = order.materials.reduce((mSum, m) => 
          mSum + (m.quantity * (m.unitCost || 0)), 0
        );
        return sum + materialCost;
      }, 0);

      const averageProductionTime = completedOrders
        .filter(o => o.startDate && o.endDate)
        .map(o => {
          const diff = new Date(o.endDate) - new Date(o.startDate);
          return diff / (1000 * 60 * 60); // hours
        });

      const avgProductionTime = averageProductionTime.length > 0
        ? averageProductionTime.reduce((a, b) => a + b, 0) / averageProductionTime.length
        : 0;

      // Employee performance
      const employeeMap = new Map();
      completedOrders.forEach(order => {
        order.assignedEmployees.forEach(assignment => {
          if (assignment.employee) {
            const empId = assignment.employee._id.toString();
            if (!employeeMap.has(empId)) {
              employeeMap.set(empId, {
                employeeId: assignment.employee.employeeId,
                position: assignment.employee.position,
                ordersCompleted: 0,
                totalHours: 0
              });
            }
            const emp = employeeMap.get(empId);
            emp.ordersCompleted += 1;
            if (assignment.startTime && assignment.endTime) {
              const hours = (new Date(assignment.endTime) - new Date(assignment.startTime)) / (1000 * 60 * 60);
              emp.totalHours += hours;
            }
          }
        });
      });

      const topEmployees = Array.from(employeeMap.values())
        .map(emp => ({
          ...emp,
          averageHoursPerOrder: emp.ordersCompleted > 0 ? emp.totalHours / emp.ordersCompleted : 0
        }))
        .sort((a, b) => b.ordersCompleted - a.ordersCompleted)
        .slice(0, 10);

      // Material usage
      const materialMap = new Map();
      completedOrders.forEach(order => {
        order.materials.forEach(material => {
          if (material.product) {
            const prodId = material.product._id.toString();
            if (!materialMap.has(prodId)) {
              materialMap.set(prodId, {
                name: material.product.name,
                sku: material.product.sku,
                unit: material.product.unit || '',
                totalQuantity: 0,
                totalCost: 0
              });
            }
            const mat = materialMap.get(prodId);
            mat.totalQuantity += material.quantity;
            mat.totalCost += material.quantity * (material.unitCost || 0);
          }
        });
      });

      const topMaterials = Array.from(materialMap.values())
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, 10);

      // Material consumption report (all materials)
      const materialConsumption = Array.from(materialMap.values())
        .sort((a, b) => b.totalQuantity - a.totalQuantity);

      // Production cost analysis (per order: material cost + manufacturing cost)
      const productionCostAnalysis = productionOrders.map(order => {
        const materialCost = (order.materials || []).reduce((sum, m) =>
          sum + (m.quantity || 0) * (m.unitCost || 0), 0
        );
        const mfgCost = Number(order.manufacturingCost) || 0;
        return {
          orderNumber: order.orderNumber,
          productName: order.product?.name || '—',
          quantity: order.quantity,
          materialCost,
          manufacturingCost: mfgCost,
          totalCost: materialCost + mfgCost,
          status: order.status
        };
      });
      const totalMfgCost = productionCostAnalysis.reduce((s, o) => s + o.manufacturingCost, 0);

      return {
        summary: {
          totalOrders: productionOrders.length,
          completedOrders: completedOrders.length,
          inProgressOrders: inProgressOrders.length,
          pendingOrders: pendingOrders.length,
          totalQuantity,
          totalMaterialCost,
          averageProductionTime: avgProductionTime,
          period: { startDate, endDate }
        },
        statusDistribution: {
          completed: completedOrders.length,
          'in-progress': inProgressOrders.length,
          pending: pendingOrders.length,
          cancelled: productionOrders.filter(o => o.status === 'cancelled').length
        },
        topEmployees,
        topMaterials,
        orders: productionOrders.slice(0, 50),
        materialConsumption,
        productionCostAnalysis,
        totalManufacturingCost: totalMfgCost
      };
    } catch (error) {
      console.error('Error fetching manufacturing report:', error);
      throw error;
    }
  }

  // Fetch CRM report data
  async fetchCRMReport(startDate, endDate) {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // Get all customers (for the report period - new customers)
      const customers = await Customer.find({
        createdAt: { $gte: start, $lte: end }
      }).sort({ createdAt: -1 });

      // Get all customers (full list for "All Customers" sheet)
      const allCustomers = await Customer.find().sort({ name: 1 }).lean();

      // Get customer orders in period (for analytics and sales history sheet)
      const customerOrders = await SalesOrder.find({
        orderDate: { $gte: start, $lte: end }
      })
        .populate('customer', 'name email company customerType')
        .sort({ orderDate: -1 });

      // Per-customer stats from orders in period
      const customerStatsMap = new Map();
      customerOrders.forEach(order => {
        if (order.customer) {
          const custId = order.customer._id.toString();
          if (!customerStatsMap.has(custId)) {
            customerStatsMap.set(custId, {
              orderCount: 0,
              totalSpent: 0,
              lastOrderDate: order.orderDate
            });
          }
          const stats = customerStatsMap.get(custId);
          stats.orderCount += 1;
          stats.totalSpent += order.total || 0;
          if (order.orderDate > stats.lastOrderDate) {
            stats.lastOrderDate = order.orderDate;
          }
        }
      });

      // All customers with details + sales stats (for Excel "All Customers" sheet)
      const allCustomersWithSales = allCustomers.map(c => {
        const stats = customerStatsMap.get(c._id.toString()) || {};
        const addr = c.address;
        const addressStr = addr
          ? [addr.street, addr.city, addr.state, addr.zipCode, addr.country].filter(Boolean).join(', ')
          : '';
        return {
          name: c.name,
          email: c.email,
          phone: c.phone || '',
          company: c.company || '',
          address: addressStr,
          customerType: c.customerType || 'individual',
          creditLimit: c.creditLimit ?? '',
          paymentTerms: c.paymentTerms || '',
          isActive: c.isActive !== false ? 'Yes' : 'No',
          notes: c.notes || '',
          orderCount: stats.orderCount ?? 0,
          totalSpent: stats.totalSpent ?? 0,
          lastOrderDate: stats.lastOrderDate || ''
        };
      });

      // Sales history (one row per order in period) for Excel "Sales History" sheet
      const salesHistory = customerOrders.map(order => ({
        customerName: order.customer?.name ?? '—',
        customerEmail: order.customer?.email ?? '—',
        orderNumber: order.orderNumber ?? '',
        orderDate: order.orderDate,
        total: order.total ?? 0,
        status: order.status ?? ''
      }));

      // Customer analytics (existing logic)
      const customerMap = new Map();
      customerOrders.forEach(order => {
        if (order.customer) {
          const custId = order.customer._id.toString();
          if (!customerMap.has(custId)) {
            customerMap.set(custId, {
              name: order.customer.name,
              email: order.customer.email,
              company: order.customer.company,
              customerType: order.customer.customerType,
              orderCount: 0,
              totalSpent: 0,
              lastOrderDate: order.orderDate
            });
          }
          const cust = customerMap.get(custId);
          cust.orderCount += 1;
          cust.totalSpent += order.total || 0;
          if (order.orderDate > cust.lastOrderDate) {
            cust.lastOrderDate = order.orderDate;
          }
        }
      });

      const topCustomers = Array.from(customerMap.values())
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 10);

      // Get complaints
      const complaints = await Complaint.find({
        createdAt: { $gte: start, $lte: end }
      })
        .populate('customer', 'name email')
        .populate('assignedTo', 'employeeId')
        .sort({ createdAt: -1 });

      const complaintStats = {
        total: complaints.length,
        open: complaints.filter(c => c.status === 'open').length,
        'in-progress': complaints.filter(c => c.status === 'in-progress').length,
        resolved: complaints.filter(c => c.status === 'resolved').length,
        closed: complaints.filter(c => c.status === 'closed').length,
        byPriority: {
          low: complaints.filter(c => c.priority === 'low').length,
          medium: complaints.filter(c => c.priority === 'medium').length,
          high: complaints.filter(c => c.priority === 'high').length,
          urgent: complaints.filter(c => c.priority === 'urgent').length
        },
        byCategory: {
          'product-quality': complaints.filter(c => c.category === 'product-quality').length,
          delivery: complaints.filter(c => c.category === 'delivery').length,
          billing: complaints.filter(c => c.category === 'billing').length,
          service: complaints.filter(c => c.category === 'service').length,
          other: complaints.filter(c => c.category === 'other').length
        }
      };

      // Customer type distribution
      const typeMap = new Map();
      customers.forEach(customer => {
        const type = customer.customerType || 'individual';
        typeMap.set(type, (typeMap.get(type) || 0) + 1);
      });

      const customerTypeDistribution = Array.from(typeMap.entries()).map(([type, count]) => ({
        type,
        count
      }));

      return {
        summary: {
          totalCustomers: customers.length,
          activeCustomers: customerMap.size,
          totalComplaints: complaints.length,
          period: { startDate, endDate }
        },
        topCustomers,
        complaintStats,
        customerTypeDistribution,
        recentComplaints: complaints.slice(0, 20),
        newCustomers: customers.slice(0, 20),
        allCustomersWithSales,
        salesHistory
      };
    } catch (error) {
      console.error('Error fetching CRM report:', error);
      throw error;
    }
  }

  // Fetch SCM report data
  async fetchSCMReport(startDate, endDate) {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // Get all suppliers
      const suppliers = await Supplier.find()
        .populate('products', 'name sku')
        .sort({ createdAt: -1 });

      // Get purchase orders
      const purchaseOrders = await PurchaseOrder.find({
        orderDate: { $gte: start, $lte: end }
      })
        .populate('supplier', 'name contactPerson email rating')
        .populate('items.product', 'name sku')
        .sort({ orderDate: -1 });

      // Supplier performance
      const supplierMap = new Map();
      purchaseOrders.forEach(order => {
        if (order.supplier) {
          const suppId = order.supplier._id.toString();
          if (!supplierMap.has(suppId)) {
            supplierMap.set(suppId, {
              name: order.supplier.name,
              contactPerson: order.supplier.contactPerson,
              email: order.supplier.email,
              rating: order.supplier.rating || 0,
              orderCount: 0,
              totalSpent: 0,
              onTimeDeliveries: 0,
              lateDeliveries: 0,
              lastOrderDate: order.orderDate
            });
          }
          const supp = supplierMap.get(suppId);
          supp.orderCount += 1;
          supp.totalSpent += order.total || 0;
          
          // Check if delivery was on time
          if (order.expectedDeliveryDate && order.receivedDate) {
            if (new Date(order.receivedDate) <= new Date(order.expectedDeliveryDate)) {
              supp.onTimeDeliveries += 1;
            } else {
              supp.lateDeliveries += 1;
            }
          }
          
          if (order.orderDate > supp.lastOrderDate) {
            supp.lastOrderDate = order.orderDate;
          }
        }
      });

      const supplierPerformance = Array.from(supplierMap.values())
        .map(supp => ({
          ...supp,
          averageOrderValue: supp.orderCount > 0 ? supp.totalSpent / supp.orderCount : 0,
          onTimeRate: supp.orderCount > 0 ? (supp.onTimeDeliveries / supp.orderCount) * 100 : 0
        }))
        .sort((a, b) => b.totalSpent - a.totalSpent);

      // Rating distribution
      const ratingDistribution = {
        5: suppliers.filter(s => s.rating === 5).length,
        4: suppliers.filter(s => s.rating === 4).length,
        3: suppliers.filter(s => s.rating === 3).length,
        2: suppliers.filter(s => s.rating === 2).length,
        1: suppliers.filter(s => s.rating === 1).length,
        0: suppliers.filter(s => !s.rating || s.rating === 0).length
      };

      // Top suppliers by spending
      const topSuppliers = supplierPerformance.slice(0, 10);

      // Supplier status
      const activeSuppliers = suppliers.filter(s => s.isActive).length;
      const inactiveSuppliers = suppliers.filter(s => !s.isActive).length;

      // All suppliers with full details (for Excel "All Suppliers" sheet)
      const allSuppliersWithDetails = suppliers.map(s => {
        const addr = s.address;
        const addressStr = addr
          ? [addr.street, addr.city, addr.state, addr.zipCode, addr.country].filter(Boolean).join(', ')
          : '';
        const perf = supplierMap.get(s._id.toString());
        return {
          name: s.name,
          contactPerson: s.contactPerson || '',
          email: s.email || '',
          phone: s.phone || '',
          address: addressStr,
          rating: s.rating != null ? s.rating : '',
          paymentTerms: s.paymentTerms || '',
          isActive: s.isActive !== false ? 'Yes' : 'No',
          productCount: Array.isArray(s.products) ? s.products.length : 0,
          orderCount: perf?.orderCount ?? 0,
          totalSpent: perf?.totalSpent ?? 0,
          onTimeRate: perf && perf.orderCount > 0 ? (perf.onTimeDeliveries / perf.orderCount) * 100 : ''
        };
      });

      return {
        summary: {
          totalSuppliers: suppliers.length,
          activeSuppliers,
          inactiveSuppliers,
          totalOrders: purchaseOrders.length,
          period: { startDate, endDate }
        },
        supplierPerformance,
        topSuppliers,
        ratingDistribution,
        suppliers: suppliers.slice(0, 50),
        allSuppliersWithDetails
      };
    } catch (error) {
      console.error('Error fetching SCM report:', error);
      throw error;
    }
  }

  // Fetch HR report data
  async fetchHRReport(startDate, endDate) {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // Get all employees
      const employees = await Employee.find()
        .populate('user', 'name email role department isActive')
        .sort({ createdAt: -1 });

      // Get attendance records
      const attendanceRecords = await Attendance.find({
        date: { $gte: start, $lte: end }
      })
        .populate('employee', 'employeeId position department')
        .populate('employee.user', 'name email')
        .sort({ date: -1 });

      // Department distribution
      const departmentMap = new Map();
      employees.forEach(emp => {
        if (emp.user && emp.user.department) {
          const dept = emp.user.department;
          departmentMap.set(dept, (departmentMap.get(dept) || 0) + 1);
        }
      });

      const departmentDistribution = Array.from(departmentMap.entries()).map(([dept, count]) => ({
        department: dept,
        count
      }));

      // Attendance statistics
      const attendanceStats = {
        totalRecords: attendanceRecords.length,
        present: attendanceRecords.filter(a => a.status === 'present').length,
        absent: attendanceRecords.filter(a => a.status === 'absent').length,
        late: attendanceRecords.filter(a => a.status === 'late').length,
        onLeave: attendanceRecords.filter(a => a.status === 'on-leave').length
      };

      // Employee performance by department
      const deptAttendanceMap = new Map();
      attendanceRecords.forEach(record => {
        if (record.employee && record.employee.department) {
          const dept = record.employee.department;
          if (!deptAttendanceMap.has(dept)) {
            deptAttendanceMap.set(dept, {
              present: 0,
              absent: 0,
              late: 0,
              onLeave: 0,
              totalMinutes: 0,
              totalHours: 0
            });
          }
          const deptStats = deptAttendanceMap.get(dept);
          deptStats[record.status] = (deptStats[record.status] || 0) + 1;
          const metrics = calculateAttendanceMetrics({
            checkIn: record.checkIn,
            checkOut: record.checkOut,
            attendanceDate: record.date
          });
          deptStats.totalMinutes += metrics.workingMinutes;
        }
      });

      const departmentAttendance = Array.from(deptAttendanceMap.entries()).map(([dept, stats]) => {
        const totalHours = stats.totalMinutes / 60;
        return {
          department: dept,
          ...stats,
          totalHours,
          attendanceRate: stats.present > 0
            ? (stats.present / (stats.present + stats.absent)) * 100
            : 0
        };
      });

      // New hires in period
      const newHires = employees.filter(emp => {
        const hireDate = new Date(emp.hireDate);
        return hireDate >= start && hireDate <= end;
      }).length;

      // Active vs inactive
      const activeEmployees = employees.filter(emp => 
        emp.isActive && emp.user && emp.user.isActive
      ).length;
      const inactiveEmployees = employees.length - activeEmployees;

      // Average salary by department
      const salaryByDept = new Map();
      employees.forEach(emp => {
        if (emp.user && emp.user.department && emp.salary) {
          const dept = emp.user.department;
          if (!salaryByDept.has(dept)) {
            salaryByDept.set(dept, { total: 0, count: 0 });
          }
          const deptSalary = salaryByDept.get(dept);
          deptSalary.total += emp.salary;
          deptSalary.count += 1;
        }
      });

      const averageSalaryByDept = Array.from(salaryByDept.entries()).map(([dept, data]) => ({
        department: dept,
        averageSalary: data.count > 0 ? data.total / data.count : 0,
        employeeCount: data.count
      }));

      return {
        summary: {
          totalEmployees: employees.length,
          activeEmployees,
          inactiveEmployees,
          newHires,
          period: { startDate, endDate }
        },
        departmentDistribution,
        attendanceStats,
        departmentAttendance,
        averageSalaryByDept,
        employees: employees.slice(0, 50).map(emp => ({
          employeeId: emp.employeeId,
          name: emp.user?.name,
          email: emp.user?.email,
          department: emp.department,
          position: emp.position,
          hireDate: emp.hireDate,
          isActive: emp.isActive && emp.user?.isActive
        }))
      };
    } catch (error) {
      console.error('Error fetching HR report:', error);
      throw error;
    }
  }

  // Generate Excel workbook for sales report
  async generateSalesExcel(reportData, startDate, endDate) {
    const workbook = new ExcelJS.Workbook();
    
    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.addRow(['Sales Report Summary']);
    summarySheet.addRow(['Period', `${startDate} to ${endDate}`]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Total Revenue', `$${reportData.revenue?.totalRevenue?.toLocaleString() || 0}`]);
    summarySheet.addRow(['Order Count', reportData.revenue?.orderCount || 0]);
    summarySheet.addRow(['Average Order Value', `$${reportData.revenue?.averageOrderValue?.toFixed(2) || 0}`]);
    summarySheet.addRow(['Active Customers', reportData.customers?.activeCustomers || 0]);
    
    // Orders Sheet
    if (reportData.orders && reportData.orders.length > 0) {
      const ordersSheet = workbook.addWorksheet('Orders');
      ordersSheet.columns = [
        { header: 'Order Number', key: 'orderNumber', width: 20 },
        { header: 'Customer', key: 'customer', width: 30 },
        { header: 'Total', key: 'total', width: 15 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Order Date', key: 'orderDate', width: 15 }
      ];
      
      reportData.orders.forEach(order => {
        ordersSheet.addRow({
          orderNumber: order.orderNumber,
          customer: order.customer?.name || 'Unknown',
          total: order.total,
          status: order.status,
          orderDate: moment(order.orderDate).format('YYYY-MM-DD')
        });
      });
    }
    
    // Top Customers Sheet
    if (reportData.customers?.topCustomers && reportData.customers.topCustomers.length > 0) {
      const customersSheet = workbook.addWorksheet('Top Customers');
      customersSheet.columns = [
        { header: 'Customer Name', key: 'name', width: 30 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Orders', key: 'orders', width: 10 },
        { header: 'Total Spent', key: 'totalSpent', width: 15 },
        { header: 'Last Order', key: 'lastOrder', width: 15 }
      ];
      
      reportData.customers.topCustomers.forEach(customer => {
        customersSheet.addRow({
          name: customer.name,
          email: customer.email,
          orders: customer.orderCount,
          totalSpent: customer.totalSpent,
          lastOrder: moment(customer.lastOrderDate).format('YYYY-MM-DD')
        });
      });
    }
    
    return workbook;
  }

  // Generate Excel workbook for purchasing report
  async generatePurchasingExcel(reportData, startDate, endDate) {
    const workbook = new ExcelJS.Workbook();
    
    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.addRow(['Purchasing Report Summary']);
    summarySheet.addRow(['Period', `${startDate} to ${endDate}`]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Total Spent', `$${reportData.spending?.totalSpent?.toLocaleString() || 0}`]);
    summarySheet.addRow(['Order Count', reportData.spending?.orderCount || 0]);
    summarySheet.addRow(['Average Order Value', `$${reportData.spending?.averageOrderValue?.toFixed(2) || 0}`]);
    summarySheet.addRow(['Active Suppliers', reportData.suppliers?.activeSuppliers || 0]);
    summarySheet.addRow(['Low Stock Items', reportData.lowStock?.length || 0]);
    
    // Orders Sheet
    if (reportData.orders && reportData.orders.length > 0) {
      const ordersSheet = workbook.addWorksheet('Orders');
      ordersSheet.columns = [
        { header: 'Order Number', key: 'orderNumber', width: 20 },
        { header: 'Supplier', key: 'supplier', width: 30 },
        { header: 'Total', key: 'total', width: 15 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Order Date', key: 'orderDate', width: 15 },
        { header: 'Received Date', key: 'receivedDate', width: 15 }
      ];
      
      reportData.orders.forEach(order => {
        ordersSheet.addRow({
          orderNumber: order.orderNumber,
          supplier: order.supplier?.name || 'Unknown',
          total: order.total,
          status: order.status,
          orderDate: moment(order.orderDate).format('YYYY-MM-DD'),
          receivedDate: order.receivedDate ? moment(order.receivedDate).format('YYYY-MM-DD') : 'N/A'
        });
      });
    }
    
    // Top Suppliers Sheet
    if (reportData.suppliers?.topSuppliers && reportData.suppliers.topSuppliers.length > 0) {
      const suppliersSheet = workbook.addWorksheet('Top Suppliers');
      suppliersSheet.columns = [
        { header: 'Supplier Name', key: 'name', width: 30 },
        { header: 'Orders', key: 'orders', width: 10 },
        { header: 'Total Spent', key: 'totalSpent', width: 15 },
        { header: 'Avg Order Value', key: 'avgOrderValue', width: 15 },
        { header: 'Rating', key: 'rating', width: 10 }
      ];
      
      reportData.suppliers.topSuppliers.forEach(supplier => {
        suppliersSheet.addRow({
          name: supplier.name,
          orders: supplier.orderCount,
          totalSpent: supplier.totalSpent,
          avgOrderValue: supplier.averageOrderValue,
          rating: supplier.rating || 'N/A'
        });
      });
    }
    
    return workbook;
  }

  // Generate Excel workbook for inventory report
  async generateInventoryExcel(reportData, startDate, endDate) {
    const workbook = new ExcelJS.Workbook();

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.addRow(['Inventory Report Summary']);
    summarySheet.addRow(['Period', `${startDate} to ${endDate}`]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Total Products', reportData.summary?.totalProducts || 0]);
    summarySheet.addRow(['Total Inventory Value', `$${reportData.summary?.totalInventoryValue?.toLocaleString() || 0}`]);
    summarySheet.addRow(['Low Stock Items', reportData.summary?.lowStockCount || 0]);
    summarySheet.addRow(['Total Transactions', reportData.transactionStats?.totalTransactions || 0]);

    // All Products Sheet
    if (reportData.allProducts && reportData.allProducts.length > 0) {
      const allProductsSheet = workbook.addWorksheet('All Products');
      allProductsSheet.columns = [
        { header: 'Name', key: 'name', width: 28 },
        { header: 'SKU', key: 'sku', width: 16 },
        { header: 'Category', key: 'category', width: 14 },
        { header: 'Unit', key: 'unit', width: 10 },
        { header: 'Current Stock', key: 'currentStock', width: 14 },
        { header: 'Min Level', key: 'minStockLevel', width: 12 },
        { header: 'Max Level', key: 'maxStockLevel', width: 12 },
        { header: 'Unit Cost', key: 'unitCost', width: 12 },
        { header: 'Selling Price', key: 'sellingPrice', width: 14 },
        { header: 'Stock Value', key: 'stockValue', width: 14 },
        { header: 'Supplier', key: 'supplierName', width: 20 },
        { header: 'Low Stock', key: 'isLowStock', width: 12 }
      ];
      reportData.allProducts.forEach(p => {
        allProductsSheet.addRow({
          name: p.name,
          sku: p.sku,
          category: p.category,
          unit: p.unit,
          currentStock: p.currentStock,
          minStockLevel: p.minStockLevel,
          maxStockLevel: p.maxStockLevel,
          unitCost: p.unitCost,
          sellingPrice: p.sellingPrice !== '' && p.sellingPrice != null ? p.sellingPrice : 'N/A',
          stockValue: p.stockValue,
          supplierName: p.supplierName,
          isLowStock: p.isLowStock ? 'Yes' : 'No'
        });
      });
    }

    // Low Stock Sheet
    if (reportData.lowStockProducts && reportData.lowStockProducts.length > 0) {
      const lowStockSheet = workbook.addWorksheet('Low Stock');
      lowStockSheet.columns = [
        { header: 'Product Name', key: 'name', width: 30 },
        { header: 'SKU', key: 'sku', width: 20 },
        { header: 'Current Stock', key: 'currentStock', width: 15 },
        { header: 'Min Level', key: 'minLevel', width: 15 },
        { header: 'Max Level', key: 'maxLevel', width: 15 },
        { header: 'Category', key: 'category', width: 20 }
      ];
      
      reportData.lowStockProducts.forEach(product => {
        lowStockSheet.addRow({
          name: product.name,
          sku: product.sku,
          currentStock: product.currentStock,
          minLevel: product.minStockLevel,
          maxLevel: product.maxStockLevel,
          category: product.category || 'N/A'
        });
      });
    }
    
    // Top Products Sheet
    if (reportData.topProductsByValue && reportData.topProductsByValue.length > 0) {
      const topProductsSheet = workbook.addWorksheet('Top Products by Value');
      topProductsSheet.columns = [
        { header: 'Product Name', key: 'name', width: 30 },
        { header: 'SKU', key: 'sku', width: 20 },
        { header: 'Stock', key: 'stock', width: 15 },
        { header: 'Unit Cost', key: 'unitCost', width: 15 },
        { header: 'Total Value', key: 'totalValue', width: 15 }
      ];
      
      reportData.topProductsByValue.forEach(product => {
        topProductsSheet.addRow({
          name: product.name,
          sku: product.sku,
          stock: product.stock,
          unitCost: product.unitCost,
          totalValue: product.totalValue
        });
      });
    }
    
    return workbook;
  }

  // Generate Excel workbook for manufacturing report
  async generateManufacturingExcel(reportData, startDate, endDate) {
    const workbook = new ExcelJS.Workbook();
    
    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.addRow(['Manufacturing Report Summary']);
    summarySheet.addRow(['Period', `${startDate} to ${endDate}`]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Total Orders', reportData.summary?.totalOrders || 0]);
    summarySheet.addRow(['Completed Orders', reportData.summary?.completedOrders || 0]);
    summarySheet.addRow(['In Progress Orders', reportData.summary?.inProgressOrders || 0]);
    summarySheet.addRow(['Total Quantity Produced', reportData.summary?.totalQuantity || 0]);
    summarySheet.addRow(['Total Material Cost', `$${reportData.summary?.totalMaterialCost?.toLocaleString() || 0}`]);
    summarySheet.addRow(['Total Manufacturing Cost', `$${reportData.totalManufacturingCost?.toLocaleString() || 0}`]);
    summarySheet.addRow(['Avg Production Time', `${reportData.summary?.averageProductionTime?.toFixed(2) || 0} hours`]);
    
    // Material Consumption Report
    if (reportData.materialConsumption && reportData.materialConsumption.length > 0) {
      const consumptionSheet = workbook.addWorksheet('Material Consumption');
      consumptionSheet.columns = [
        { header: 'Material Name', key: 'name', width: 28 },
        { header: 'SKU', key: 'sku', width: 18 },
        { header: 'Total Quantity', key: 'totalQuantity', width: 16 },
        { header: 'Unit', key: 'unit', width: 10 },
        { header: 'Total Cost', key: 'totalCost', width: 14 }
      ];
      reportData.materialConsumption.forEach(m => {
        consumptionSheet.addRow({
          name: m.name,
          sku: m.sku,
          totalQuantity: m.totalQuantity,
          unit: m.unit,
          totalCost: m.totalCost
        });
      });
    }

    // Production Cost Analysis
    if (reportData.productionCostAnalysis && reportData.productionCostAnalysis.length > 0) {
      const costSheet = workbook.addWorksheet('Production Cost Analysis');
      costSheet.columns = [
        { header: 'Order Number', key: 'orderNumber', width: 16 },
        { header: 'Product', key: 'productName', width: 24 },
        { header: 'Quantity', key: 'quantity', width: 12 },
        { header: 'Material Cost', key: 'materialCost', width: 16 },
        { header: 'Manufacturing Cost', key: 'manufacturingCost', width: 18 },
        { header: 'Total Cost', key: 'totalCost', width: 14 },
        { header: 'Status', key: 'status', width: 14 }
      ];
      reportData.productionCostAnalysis.forEach(row => {
        costSheet.addRow({
          orderNumber: row.orderNumber,
          productName: row.productName,
          quantity: row.quantity,
          materialCost: row.materialCost,
          manufacturingCost: row.manufacturingCost,
          totalCost: row.totalCost,
          status: row.status
        });
      });
      const totalMaterial = reportData.productionCostAnalysis.reduce((s, o) => s + o.materialCost, 0);
      const totalMfg = reportData.productionCostAnalysis.reduce((s, o) => s + o.manufacturingCost, 0);
      const grandTotal = reportData.productionCostAnalysis.reduce((s, o) => s + o.totalCost, 0);
      costSheet.addRow([]);
      costSheet.addRow({
        orderNumber: 'Total',
        productName: '',
        quantity: '',
        materialCost: totalMaterial,
        manufacturingCost: totalMfg,
        totalCost: grandTotal,
        status: ''
      });
    }
    
    // Top Employees Sheet
    if (reportData.topEmployees && reportData.topEmployees.length > 0) {
      const employeesSheet = workbook.addWorksheet('Top Employees');
      employeesSheet.columns = [
        { header: 'Employee ID', key: 'employeeId', width: 20 },
        { header: 'Position', key: 'position', width: 25 },
        { header: 'Orders Completed', key: 'ordersCompleted', width: 18 },
        { header: 'Total Hours', key: 'totalHours', width: 15 },
        { header: 'Avg Hours/Order', key: 'avgHours', width: 18 }
      ];
      
      reportData.topEmployees.forEach(employee => {
        employeesSheet.addRow({
          employeeId: employee.employeeId,
          position: employee.position,
          ordersCompleted: employee.ordersCompleted,
          totalHours: employee.totalHours.toFixed(2),
          avgHours: employee.averageHoursPerOrder.toFixed(2)
        });
      });
    }
    
    // Top Materials Sheet
    if (reportData.topMaterials && reportData.topMaterials.length > 0) {
      const materialsSheet = workbook.addWorksheet('Top Materials');
      materialsSheet.columns = [
        { header: 'Material Name', key: 'name', width: 30 },
        { header: 'SKU', key: 'sku', width: 20 },
        { header: 'Total Quantity', key: 'quantity', width: 15 },
        { header: 'Total Cost', key: 'cost', width: 15 }
      ];
      
      reportData.topMaterials.forEach(material => {
        materialsSheet.addRow({
          name: material.name,
          sku: material.sku,
          quantity: material.totalQuantity,
          cost: material.totalCost
        });
      });
    }
    
    return workbook;
  }

  // Generate Excel workbook for CRM report
  async generateCRMExcel(reportData, startDate, endDate) {
    const workbook = new ExcelJS.Workbook();
    
    // All Customers Sheet (customer details + sales stats in period)
    if (reportData.allCustomersWithSales && reportData.allCustomersWithSales.length > 0) {
      const allCustomersSheet = workbook.addWorksheet('All Customers');
      allCustomersSheet.columns = [
        { header: 'Name', key: 'name', width: 24 },
        { header: 'Email', key: 'email', width: 28 },
        { header: 'Phone', key: 'phone', width: 16 },
        { header: 'Company', key: 'company', width: 20 },
        { header: 'Type', key: 'customerType', width: 12 },
        { header: 'Credit Limit', key: 'creditLimit', width: 14 },
        { header: 'Payment Terms', key: 'paymentTerms', width: 14 },
        { header: 'Active', key: 'isActive', width: 8 },
        { header: 'Notes', key: 'notes', width: 24 },
        { header: 'Orders (Period)', key: 'orderCount', width: 14 },
        { header: 'Total Spent (Period)', key: 'totalSpent', width: 18 },
        { header: 'Last Order Date', key: 'lastOrderDate', width: 16 }
      ];
      reportData.allCustomersWithSales.forEach(c => {
        allCustomersSheet.addRow({
          name: c.name,
          email: c.email,
          phone: c.phone,
          company: c.company,
          customerType: c.customerType,
          creditLimit: c.creditLimit,
          paymentTerms: c.paymentTerms,
          isActive: c.isActive,
          notes: c.notes,
          orderCount: c.orderCount,
          totalSpent: c.totalSpent,
          lastOrderDate: c.lastOrderDate ? moment(c.lastOrderDate).format('YYYY-MM-DD') : ''
        });
      });
    }

    // Sales History Sheet (one row per order in period)
    const salesHistorySheet = workbook.addWorksheet('Sales History');
    salesHistorySheet.columns = [
      { header: 'Customer Name', key: 'customerName', width: 24 },
      { header: 'Customer Email', key: 'customerEmail', width: 28 },
      { header: 'Number of Orders', key: 'totalOrdersCustomer', width: 16 },
      { header: 'Order Number', key: 'orderNumber', width: 18 },
      { header: 'Order Date', key: 'orderDate', width: 14 },
      { header: 'Total Spent', key: 'total', width: 14 },
      { header: 'Status', key: 'status', width: 14 }
    ];
    if (reportData.salesHistory && reportData.salesHistory.length > 0) {
      const customerOrderCount = {};
      reportData.salesHistory.forEach(row => {
        const key = row.customerEmail ?? row.customerName ?? '';
        customerOrderCount[key] = (customerOrderCount[key] || 0) + 1;
      });
      reportData.salesHistory.forEach(row => {
        const key = row.customerEmail ?? row.customerName ?? '';
        salesHistorySheet.addRow({
          customerName: row.customerName,
          customerEmail: row.customerEmail,
          totalOrdersCustomer: customerOrderCount[key] ?? 0,
          orderNumber: row.orderNumber,
          orderDate: row.orderDate ? moment(row.orderDate).format('YYYY-MM-DD') : '',
          total: row.total,
          status: row.status
        });
      });
    } else {
      salesHistorySheet.addRow({ customerName: 'No orders in this period.', customerEmail: '', totalOrdersCustomer: '', orderNumber: '', orderDate: '', total: '', status: '' });
    }
    
    // Complaint Stats Sheet
    if (reportData.complaintStats) {
      const complaintsSheet = workbook.addWorksheet('Complaint Statistics');
      complaintsSheet.addRow(['Complaint Statistics']);
      complaintsSheet.addRow([]);
      complaintsSheet.addRow(['Total', reportData.complaintStats.total]);
      complaintsSheet.addRow(['Open', reportData.complaintStats.open]);
      complaintsSheet.addRow(['In Progress', reportData.complaintStats['in-progress']]);
      complaintsSheet.addRow(['Resolved', reportData.complaintStats.resolved]);
      complaintsSheet.addRow(['Closed', reportData.complaintStats.closed]);
    }
    
    return workbook;
  }

  // Generate Excel workbook for SCM report
  async generateSCMExcel(reportData, startDate, endDate) {
    const workbook = new ExcelJS.Workbook();

    // All Suppliers Sheet (full supplier details)
    if (reportData.allSuppliersWithDetails && reportData.allSuppliersWithDetails.length > 0) {
      const allSuppliersSheet = workbook.addWorksheet('All Suppliers');
      allSuppliersSheet.columns = [
        { header: 'Name', key: 'name', width: 26 },
        { header: 'Contact Person', key: 'contactPerson', width: 22 },
        { header: 'Email', key: 'email', width: 28 },
        { header: 'Phone', key: 'phone', width: 16 },
        { header: 'Rating', key: 'rating', width: 10 },
        { header: 'Payment Terms', key: 'paymentTerms', width: 14 },
        { header: 'Active', key: 'isActive', width: 8 },
        { header: 'Product Count', key: 'productCount', width: 14 },
        { header: 'Orders (Period)', key: 'orderCount', width: 14 },
        { header: 'Total Spent (Period)', key: 'totalSpent', width: 18 }
      ];
      reportData.allSuppliersWithDetails.forEach(s => {
        allSuppliersSheet.addRow({
          name: s.name,
          contactPerson: s.contactPerson,
          email: s.email,
          phone: s.phone,
          rating: s.rating,
          paymentTerms: s.paymentTerms,
          isActive: s.isActive,
          productCount: s.productCount,
          orderCount: s.orderCount,
          totalSpent: s.totalSpent
        });
      });
    }
    
    return workbook;
  }

  // Generate Excel workbook for HR report
  async generateHRExcel(reportData, startDate, endDate) {
    const workbook = new ExcelJS.Workbook();
    
    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.addRow(['HR Report Summary']);
    summarySheet.addRow(['Period', `${startDate} to ${endDate}`]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Total Employees', reportData.summary?.totalEmployees || 0]);
    summarySheet.addRow(['Active Employees', reportData.summary?.activeEmployees || 0]);
    summarySheet.addRow(['Inactive Employees', reportData.summary?.inactiveEmployees || 0]);
    summarySheet.addRow(['New Hires', reportData.summary?.newHires || 0]);
    
    // Department Distribution Sheet
    if (reportData.departmentDistribution && reportData.departmentDistribution.length > 0) {
      const deptSheet = workbook.addWorksheet('Department Distribution');
      deptSheet.columns = [
        { header: 'Department', key: 'department', width: 25 },
        { header: 'Employee Count', key: 'count', width: 18 }
      ];
      
      reportData.departmentDistribution.forEach(dept => {
        deptSheet.addRow({
          department: dept.department,
          count: dept.count
        });
      });
    }
    
    // Attendance Stats Sheet
    if (reportData.attendanceStats) {
      const attendanceSheet = workbook.addWorksheet('Attendance Statistics');
      attendanceSheet.addRow(['Attendance Statistics']);
      attendanceSheet.addRow([]);
      attendanceSheet.addRow(['Total Records', reportData.attendanceStats.totalRecords]);
      attendanceSheet.addRow(['Present', reportData.attendanceStats.present]);
      attendanceSheet.addRow(['Absent', reportData.attendanceStats.absent]);
      attendanceSheet.addRow(['Late', reportData.attendanceStats.late]);
      attendanceSheet.addRow(['On Leave', reportData.attendanceStats.onLeave]);
    }
    
    // Average Salary by Department Sheet
    if (reportData.averageSalaryByDept && reportData.averageSalaryByDept.length > 0) {
      const salarySheet = workbook.addWorksheet('Average Salary by Dept');
      salarySheet.columns = [
        { header: 'Department', key: 'department', width: 25 },
        { header: 'Employee Count', key: 'count', width: 18 },
        { header: 'Average Salary', key: 'salary', width: 18 }
      ];
      
      reportData.averageSalaryByDept.forEach(dept => {
        salarySheet.addRow({
          department: dept.department,
          count: dept.employeeCount,
          salary: dept.averageSalary
        });
      });
    }
    
    return workbook;
  }
}

module.exports = new ReportService();
