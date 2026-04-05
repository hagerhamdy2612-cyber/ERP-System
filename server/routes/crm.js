const express = require('express');
const { body, validationResult } = require('express-validator');
const Customer = require('../models/Customer');
const SalesOrder = require('../models/SalesOrder');
const Complaint = require('../models/Complaint');
const Employee = require('../models/Employee');
const { protect, authorize } = require('../middleware/auth');
const { archiveDocument } = require('../services/archiveService');
const { isValidPhone, PHONE_VALIDATION_MESSAGE } = require('../utils/phoneValidation');

const router = express.Router();

// @route   GET /api/crm/customers
// @desc    Get all customers
// @access  Private
router.get('/customers', protect, async (req, res) => {
  try {
    const { customerType, isActive } = req.query;
    let query = {};

    if (customerType) {
      query.customerType = customerType;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const customers = await Customer.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: customers.length,
      data: customers
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/crm/customers
// @desc    Create new customer
// @access  Private (CRM, Admin)
router.post('/customers', [
  protect,
  body('name').notEmpty().withMessage('Customer name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('phone').custom((v) => isValidPhone(v)).withMessage(PHONE_VALIDATION_MESSAGE)
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

    const customer = await Customer.create(req.body);

    res.status(201).json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/crm/customers/:id
// @desc    Update customer
// @access  Private (CRM, Admin)
router.put('/customers/:id', [
  protect,
  body('phone').custom((value) => {
    if (value === undefined) return true;
    if (value === null || String(value).trim() === '') return false;
    return isValidPhone(String(value));
  }).withMessage(PHONE_VALIDATION_MESSAGE)
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

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    res.json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/crm/customers/:id/orders
// @desc    Get customer orders
// @access  Private
router.get('/customers/:id/orders', protect, async (req, res) => {
  try {
    const { status } = req.query;
    let query = { customer: req.params.id };

    if (status) {
      query.status = status;
    }

    const orders = await SalesOrder.find(query)
      .populate('customer', 'name email')
      .populate('salesRep', 'employeeId user')
      .populate('items.product', 'name sku')
      .sort({ orderDate: -1 });

    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error('Get customer orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/crm/customers/:id/history
// @desc    Get customer interaction history
// @access  Private
router.get('/customers/:id/history', protect, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Get orders, support tickets, etc.
    const orders = await SalesOrder.find({ customer: req.params.id })
      .select('orderNumber orderDate total status')
      .sort({ orderDate: -1 })
      .limit(10);

    const history = {
      customer: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        customerType: customer.customerType
      },
      recentOrders: orders,
      totalOrders: orders.length,
      totalSpent: orders.reduce((sum, order) => sum + order.total, 0)
    };

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Get customer history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/crm/leads
// @desc    Get potential customers (leads)
// @access  Private
router.get('/leads', protect, async (req, res) => {
  try {
    // For now, return customers with no orders as leads
    const customers = await Customer.find({ isActive: true });
    const customerIds = customers.map(c => c._id);
    
    const customersWithOrders = await SalesOrder.distinct('customer');
    const leadIds = customerIds.filter(id => !customersWithOrders.includes(id));
    
    const leads = await Customer.find({ 
      _id: { $in: leadIds },
      isActive: true 
    });

    res.json({
      success: true,
      count: leads.length,
      data: leads
    });
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/crm/support-tickets
// @desc    Get support tickets (placeholder)
// @access  Private
router.get('/support-tickets', protect, async (req, res) => {
  try {
    // This would be implemented with a SupportTicket model
    // For now, return empty array
    res.json({
      success: true,
      count: 0,
      data: []
    });
  } catch (error) {
    console.error('Get support tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/crm/customers/:id
// @desc    Delete (archive) customer
// @access  Private (CRM, Admin)
router.delete('/customers/:id', [
  protect
], async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check if customer has orders
    const orders = await SalesOrder.find({ customer: req.params.id });
    if (orders.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete customer. They have associated orders.'
      });
    }

    await archiveDocument({
      model: Customer,
      documentId: req.params.id,
      module: 'CRM',
      documentType: 'Customer',
      documentNumber: customer.email || customer.name,
      userId: req.user.id,
      reason: req.body?.reason
    });

    res.json({
      success: true,
      message: 'Customer archived successfully'
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error('Delete customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ============================================
// COMPLAINTS ROUTES
// ============================================

// @route   GET /api/crm/complaints
// @desc    Get all complaints
// @access  Private
router.get('/complaints', protect, async (req, res) => {
  try {
    const { status, priority, category, customer } = req.query;
    let query = {};

    if (status) {
      query.status = status;
    }

    if (priority) {
      query.priority = priority;
    }

    if (category) {
      query.category = category;
    }

    if (customer) {
      query.customer = customer;
    }

    // Check if Complaint model is available
    if (!Complaint) {
      throw new Error('Complaint model is not available');
    }

    const complaints = await Complaint.find(query)
      .populate('customer', 'name email company phone')
      .populate('assignedTo', 'employeeId')
      .populate('relatedOrder', 'orderNumber')
      .populate('resolvedBy', 'employeeId')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: complaints.length,
      data: complaints
    });
  } catch (error) {
    console.error('Get complaints error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// @route   GET /api/crm/complaints/:id
// @desc    Get single complaint
// @access  Private
router.get('/complaints/:id', protect, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('customer', 'name email company phone address')
      .populate('assignedTo', 'employeeId')
      .populate('relatedOrder', 'orderNumber orderDate total')
      .populate('resolvedBy', 'employeeId')
      .populate('notes.addedBy', 'employeeId');

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    res.json({
      success: true,
      data: complaint
    });
  } catch (error) {
    console.error('Get complaint error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/crm/complaints
// @desc    Create new complaint
// @access  Private
router.post('/complaints', [
  protect,
  body('customer').isMongoId().withMessage('Valid customer ID is required'),
  body('subject').notEmpty().withMessage('Subject is required'),
  body('description').notEmpty().withMessage('Description is required')
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

    // Generate complaint number - handle potential race conditions
    let complaintNumber;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const complaintCount = await Complaint.countDocuments();
      complaintNumber = `CMP${String(complaintCount + 1).padStart(4, '0')}`;
      
      // Check if this number already exists (handle race conditions)
      const existing = await Complaint.findOne({ complaintNumber });
      if (!existing) {
        break;
      }
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new Error('Failed to generate unique complaint number');
    }

    // Clean up the request body - remove empty strings for optional fields
    const complaintData = {
      ...req.body,
      complaintNumber
    };
    
    // Remove empty strings for optional ObjectId fields
    if (complaintData.relatedOrder === '') {
      delete complaintData.relatedOrder;
    }
    if (complaintData.assignedTo === '') {
      delete complaintData.assignedTo;
    }

    const complaint = await Complaint.create(complaintData);

    await complaint.populate('customer', 'name email company');
    if (complaint.assignedTo) {
      await complaint.populate('assignedTo', 'employeeId');
    }

    res.status(201).json({
      success: true,
      data: complaint
    });
  } catch (error) {
    console.error('Create complaint error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// @route   PUT /api/crm/complaints/:id
// @desc    Update complaint
// @access  Private
router.put('/complaints/:id', [
  protect
], async (req, res) => {
  try {
    // Clean up the request body - remove empty strings for optional fields
    const updateData = { ...req.body };
    
    // Remove empty strings for optional ObjectId fields
    if (updateData.relatedOrder === '') {
      delete updateData.relatedOrder;
    }
    if (updateData.assignedTo === '') {
      delete updateData.assignedTo;
    }
    if (updateData.resolution === '') {
      delete updateData.resolution;
    }

    const complaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('customer', 'name email company')
      .populate('assignedTo', 'employeeId')
      .populate('relatedOrder', 'orderNumber');

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // If status is resolved, set resolvedAt and resolvedBy
    if (req.body.status === 'resolved' && !complaint.resolvedAt) {
      complaint.resolvedAt = new Date();
      // Find employee by user ID
      const employee = await Employee.findOne({ user: req.user.id });
      if (employee) {
        complaint.resolvedBy = employee._id;
      }
      await complaint.save();
      await complaint.populate('resolvedBy', 'employeeId');
    }

    res.json({
      success: true,
      data: complaint
    });
  } catch (error) {
    console.error('Update complaint error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// @route   POST /api/crm/complaints/:id/notes
// @desc    Add note to complaint
// @access  Private
router.post('/complaints/:id/notes', [
  protect,
  body('note').notEmpty().withMessage('Note is required')
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

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Find employee by user ID
    const employee = await Employee.findOne({ user: req.user.id });
    complaint.notes.push({
      note: req.body.note,
      addedBy: employee ? employee._id : null
    });

    await complaint.save();
    await complaint.populate('notes.addedBy', 'employeeId');

    res.json({
      success: true,
      data: complaint
    });
  } catch (error) {
    console.error('Add note error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   DELETE /api/crm/complaints/:id
// @desc    Delete (archive) complaint
// @access  Private (CRM, Admin)
router.delete('/complaints/:id', [
  protect
], async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    await archiveDocument({
      model: Complaint,
      documentId: req.params.id,
      module: 'CRM',
      documentType: 'Complaint',
      documentNumber: complaint.complaintNumber,
      userId: req.user.id,
      reason: req.body?.reason
    });

    res.json({
      success: true,
      message: 'Complaint archived successfully'
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error('Delete complaint error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
