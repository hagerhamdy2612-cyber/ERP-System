const express = require('express');
const Employee = require('../models/Employee');
const User = require('../models/User');
const SalesOrder = require('../models/SalesOrder');
const PurchaseOrder = require('../models/PurchaseOrder');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Attendance = require('../models/Attendance');
const ProductionOrder = require('../models/ProductionOrder');
const Supplier = require('../models/Supplier');
const InventoryTransaction = require('../models/InventoryTransaction');
const { protect } = require('../middleware/auth');
const { lowStockProductMongoFilter } = require('../utils/autoPurchaseLowStock');

const router = express.Router();

// @route   GET /api/dashboard/kpis
// @desc    Get dashboard KPIs
// @access  Private
router.get('/kpis', protect, async (req, res) => {
  try {
    // Get current date and start of month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    // Employee metrics - count actual Employee records (the real headcount).
    // Using the User collection wrongly counted the admin/system accounts that
    // have no Employee profile.
    const totalEmployees = await Employee.countDocuments({ isActive: true });
    // Present today = distinct employees who have a check-in today.
    const presentEmployeeIds = await Attendance.distinct('employee', {
      date: { $gte: startOfToday, $lt: startOfTomorrow },
      checkIn: { $ne: null }
    });
    const todayAttendance = presentEmployeeIds.length;
    const newHiresThisMonth = await Employee.countDocuments({
      hireDate: { $gte: startOfMonth }
    });

    // Sales metrics
    const totalSales = await SalesOrder.countDocuments();
    const monthlySales = await SalesOrder.countDocuments({
      orderDate: { $gte: startOfMonth }
    });
    const salesRevenue = await SalesOrder.aggregate([
      { $match: { status: { $in: ['confirmed', 'delivered'] } } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$total', 0] } } } }
    ]);
    const monthlyRevenue = await SalesOrder.aggregate([
      { 
        $match: { 
          status: { $in: ['confirmed', 'delivered'] },
          orderDate: { $gte: startOfMonth }
        } 
      },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$total', 0] } } } }
    ]);

    // Inventory metrics
    const totalProducts = await Product.countDocuments({ isActive: true });
    const lowStockProducts = await Product.countDocuments(lowStockProductMongoFilter());
    const stockValue = await Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, total: { $sum: { $multiply: ['$currentStock', '$unitCost'] } } } }
    ]);

    // Customer metrics
    const totalCustomers = await Customer.countDocuments({ isActive: true });
    const newCustomersThisMonth = await Customer.countDocuments({
      createdAt: { $gte: startOfMonth }
    });

    // Production metrics
    const totalProductionOrders = await ProductionOrder.countDocuments();
    const pendingProductionOrders = await ProductionOrder.countDocuments({
      status: 'pending'
    });
    const inProgressProductionOrders = await ProductionOrder.countDocuments({
      status: 'in-progress'
    });

    // Purchase metrics
    const totalPurchaseOrders = await PurchaseOrder.countDocuments();
    const pendingPurchaseOrders = await PurchaseOrder.countDocuments({
      status: 'pending'
    });
    const monthlyPurchases = await PurchaseOrder.aggregate([
      { 
        $match: { 
          status: 'received',
          receivedDate: { $gte: startOfMonth }
        } 
      },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);

    // Production: completed today + simple efficiency ratio.
    const completedProductionToday = await ProductionOrder.countDocuments({
      status: 'completed',
      updatedAt: { $gte: startOfToday, $lt: startOfTomorrow }
    });
    const completedProductionOrders = await ProductionOrder.countDocuments({
      status: 'completed'
    });
    const productionEfficiency = totalProductionOrders > 0
      ? Number(((completedProductionOrders / totalProductionOrders) * 100).toFixed(1))
      : 0;

    // Supplier metrics
    const totalSuppliers = await Supplier.countDocuments({ isActive: true });

    // Inventory movements this month
    const recentMovements = await InventoryTransaction.countDocuments({
      createdAt: { $gte: startOfMonth }
    });

    // Top selling product
    const topProduct = await SalesOrder.aggregate([
      { $match: { status: { $in: ['confirmed', 'delivered'] } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.total' }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 1 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          name: '$product.name',
          sku: '$product.sku',
          totalQuantity: 1,
          totalRevenue: 1
        }
      }
    ]);

    const kpis = {
      employees: {
        total: totalEmployees,
        presentToday: todayAttendance,
        absentToday: Math.max(0, totalEmployees - todayAttendance),
        newThisMonth: newHiresThisMonth,
        attendanceRate: totalEmployees > 0 ? (todayAttendance / totalEmployees * 100).toFixed(1) : 0
      },
      sales: {
        totalOrders: totalSales,
        monthlyOrders: monthlySales,
        totalRevenue: salesRevenue[0]?.total || 0,
        monthlyRevenue: monthlyRevenue[0]?.total || 0
      },
      inventory: {
        totalProducts,
        lowStockAlerts: lowStockProducts,
        totalValue: stockValue[0]?.total || 0,
        recentMovements
      },
      customers: {
        total: totalCustomers,
        newThisMonth: newCustomersThisMonth
      },
      suppliers: {
        total: totalSuppliers
      },
      production: {
        totalOrders: totalProductionOrders,
        pending: pendingProductionOrders,
        inProgress: inProgressProductionOrders,
        completedToday: completedProductionToday,
        efficiency: productionEfficiency
      },
      purchasing: {
        totalOrders: totalPurchaseOrders,
        pending: pendingPurchaseOrders,
        monthlySpending: monthlyPurchases[0]?.total || 0
      },
      topProduct: topProduct[0] || null
    };

    res.json({
      success: true,
      data: kpis
    });
  } catch (error) {
    console.error('Get KPIs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/dashboard/recent-activities
// @desc    Get recent activities
// @access  Private
router.get('/recent-activities', protect, async (req, res) => {
  try {
    const activities = [];

    // Recent sales orders
    const recentSales = await SalesOrder.find()
      .populate('customer', 'name')
      .sort({ createdAt: -1 })
      .limit(5);
    
    recentSales.forEach(order => {
      activities.push({
        type: 'sales',
        action: 'New sales order',
        description: `Order ${order.orderNumber} from ${order.customer?.name || 'N/A'}`,
        timestamp: order.createdAt,
        status: order.status
      });
    });

    // Recent production orders
    const recentProduction = await ProductionOrder.find()
      .populate('product', 'name')
      .sort({ createdAt: -1 })
      .limit(5);
    
    recentProduction.forEach(order => {
      activities.push({
        type: 'production',
        action: 'Production order',
        description: `Order ${order.orderNumber} for ${order.product?.name || 'N/A'}`,
        timestamp: order.createdAt,
        status: order.status
      });
    });

    // Recent purchase orders
    const recentPurchases = await PurchaseOrder.find()
      .populate('supplier', 'name')
      .sort({ createdAt: -1 })
      .limit(5);
    
    recentPurchases.forEach(order => {
      activities.push({
        type: 'purchasing',
        action: 'Purchase order',
        description: `Order ${order.orderNumber} from ${order.supplier?.name || 'N/A'}`,
        timestamp: order.createdAt,
        status: order.status
      });
    });

    // Sort all activities by timestamp
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      success: true,
      data: activities.slice(0, 10) // Return top 10 most recent
    });
  } catch (error) {
    console.error('Get recent activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/dashboard/sales-chart
// @desc    Get sales data for charts
// @access  Private
router.get('/sales-chart', protect, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const startDate = new Date();
    const endDate = new Date();
    // Daily buckets for short ranges, monthly buckets for the yearly trend.
    let groupFormat = '%Y-%m-%d';

    if (period === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'year') {
      // Last 12 months, grouped by month so the revenue trend is readable.
      startDate.setMonth(startDate.getMonth() - 11);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      groupFormat = '%Y-%m';
    } else {
      startDate.setMonth(startDate.getMonth() - 1);
    }

    const salesData = await SalesOrder.aggregate([
      {
        $match: {
          orderDate: { $gte: startDate, $lte: endDate },
          status: { $in: ['confirmed', 'delivered'] }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: '$orderDate' } },
          revenue: { $sum: { $ifNull: ['$total', 0] } },
          orders: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Return empty array if no sales data - no sample data

    res.json({
      success: true,
      data: salesData
    });
  } catch (error) {
    console.error('Get sales chart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/dashboard/department-chart
// @desc    Department performance trend. Returns { _id, value } points so the
//          main dashboard chart renders real data for non-admin managers.
// @access  Private
router.get('/department-chart', protect, async (req, res) => {
  try {
    const { department = '', period = 'month' } = req.query;
    const dept = String(department).toLowerCase();

    const startDate = new Date();
    if (period === 'week') startDate.setDate(startDate.getDate() - 7);
    else if (period === 'year') startDate.setFullYear(startDate.getFullYear() - 1);
    else startDate.setMonth(startDate.getMonth() - 1);
    const endDate = new Date();

    const dayGroup = (dateField) => ({
      _id: { $dateToString: { format: '%Y-%m-%d', date: dateField } },
      value: { $sum: { $ifNull: ['$total', 0] } }
    });

    let data = [];
    if (dept === 'purchasing') {
      data = await PurchaseOrder.aggregate([
        { $match: { orderDate: { $gte: startDate, $lte: endDate } } },
        { $group: dayGroup('$orderDate') },
        { $sort: { _id: 1 } }
      ]);
    } else if (dept === 'manufacturing') {
      data = await ProductionOrder.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            value: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);
    } else {
      // Sales and any other department: revenue trend from confirmed sales.
      data = await SalesOrder.aggregate([
        {
          $match: {
            orderDate: { $gte: startDate, $lte: endDate },
            status: { $in: ['confirmed', 'delivered'] }
          }
        },
        { $group: dayGroup('$orderDate') },
        { $sort: { _id: 1 } }
      ]);
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get department chart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
