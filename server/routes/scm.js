const express = require('express');
const { body, validationResult } = require('express-validator');
const Supplier = require('../models/Supplier');
const Product = require('../models/Product');
const { protect, authorize } = require('../middleware/auth');
const { isValidPhone, PHONE_VALIDATION_MESSAGE } = require('../utils/phoneValidation');

const router = express.Router();

// @route   GET /api/scm/suppliers
// @desc    Get all suppliers
// @access  Private
router.get('/suppliers', protect, async (req, res) => {
  try {
    const { isActive } = req.query;
    let query = {};

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const suppliers = await Supplier.find(query)
      .populate('products', 'name sku')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: suppliers.length,
      data: suppliers
    });
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/scm/suppliers
// @desc    Create new supplier
// @access  Private (SCM, Admin)
router.post('/suppliers', [
  protect,
  authorize('admin', 'manager'),
  body('name').notEmpty().withMessage('Supplier name is required'),
  body('contactPerson').notEmpty().withMessage('Contact person is required'),
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

    const supplier = await Supplier.create(req.body);

    res.status(201).json({
      success: true,
      data: supplier
    });
  } catch (error) {
    console.error('Create supplier error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/scm/suppliers/:id
// @desc    Update supplier
// @access  Private (SCM, Admin)
router.put('/suppliers/:id', [
  protect,
  authorize('admin', 'manager'),
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

    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.json({
      success: true,
      data: supplier
    });
  } catch (error) {
    console.error('Update supplier error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/scm/suppliers/:id/products
// @desc    Get supplier products
// @access  Private
router.get('/suppliers/:id/products', protect, async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id)
      .populate('products', 'name sku description unitCost currentStock');

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.json({
      success: true,
      data: supplier.products
    });
  } catch (error) {
    console.error('Get supplier products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/scm/suppliers/:id/products
// @desc    Add product to supplier
// @access  Private (SCM, Admin)
router.post('/suppliers/:id/products', [
  protect,
  authorize('admin', 'manager'),
  body('product').isMongoId().withMessage('Valid product ID is required')
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

    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    const { product } = req.body;

    // Check if product already exists for this supplier
    if (supplier.products.includes(product)) {
      return res.status(400).json({
        success: false,
        message: 'Product already exists for this supplier'
      });
    }

    supplier.products.push(product);
    await supplier.save();

    // Update product supplier
    await Product.findByIdAndUpdate(product, { supplier: supplier._id });

    await supplier.populate('products', 'name sku description unitCost');

    res.json({
      success: true,
      data: supplier
    });
  } catch (error) {
    console.error('Add supplier product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/scm/suppliers/:id/performance
// @desc    Get supplier performance metrics
// @access  Private
router.get('/suppliers/:id/performance', protect, async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    // This would typically involve more complex queries
    // For now, return basic metrics
    const performance = {
      rating: supplier.rating,
      totalProducts: supplier.products.length,
      isActive: supplier.isActive,
      paymentTerms: supplier.paymentTerms
    };

    res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    console.error('Get supplier performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/scm/suppliers/:id
// @desc    Delete supplier
// @access  Private (SCM, Admin)
router.delete('/suppliers/:id', [
  protect,
  authorize('admin', 'manager')
], async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    // Check if supplier has products
    const products = await Product.find({ supplier: req.params.id });
    if (products.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete supplier. They have associated products.'
      });
    }

    await Supplier.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Supplier deleted successfully'
    });
  } catch (error) {
    console.error('Delete supplier error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
