const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'User not found' 
        });
      }

      next();
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized, token failed' 
      });
    }
  }

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Not authorized, no token' 
    });
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};

// Grant access to admin or HR managers
const authorizeAdminOrHR = (req, res, next) => {
  if (req.user.role === 'admin' || (req.user.role === 'manager' && req.user.department === 'HR')) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only administrators and HR managers can perform this action'
    });
  }
};

// Grant access to admin, managers, and employees (except HR employees)
const authorizeEmployeeManagement = (req, res, next) => {
  if (req.user.role === 'admin' || req.user.role === 'manager') {
    next();
  } else if (req.user.role === 'employee' && req.user.department !== 'HR') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only administrators, managers, and non-HR employees can perform this action'
    });
  }
};

// Generic authorize function with department check
const authorizeDepartment = (departmentName) => {
  return (req, res, next) => {
    if (req.user.role === 'admin' || (req.user.role === 'manager' && req.user.department === departmentName)) {
      next();
    } else {
      return res.status(403).json({
        success: false,
        message: `Access denied. Only administrators and managers in ${departmentName} department can perform this action`
      });
    }
  };
};

// Grant access to create purchase orders (admin or employees in Purchasing department)
const authorizeCreatePurchaseOrder = (req, res, next) => {
  if (req.user.role === 'admin' || 
      (req.user.role === 'employee' && req.user.department === 'Purchasing')) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only administrators and employees in Purchasing department can create purchase orders'
    });
  }
};

// Grant access to edit purchase orders (admin or managers in Purchasing department)
const authorizeEditPurchaseOrder = (req, res, next) => {
  if (req.user.role === 'admin' || 
      (req.user.role === 'manager' && req.user.department === 'Purchasing')) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only administrators and managers in Purchasing department can edit purchase orders'
    });
  }
};

// Grant access to accept/approve purchase orders (admin or managers in Purchasing department)
const authorizeAcceptPurchaseOrder = (req, res, next) => {
  if (req.user.role === 'admin' || 
      (req.user.role === 'manager' && req.user.department === 'Purchasing')) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only administrators and managers in Purchasing department can accept purchase orders'
    });
  }
};

// Grant access to receive purchase orders (admin or employees in Purchasing department)
const authorizeReceivePurchaseOrder = (req, res, next) => {
  if (req.user.role === 'admin' || 
      (req.user.role === 'employee' && req.user.department === 'Purchasing')) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only administrators and employees in Purchasing department can receive purchase orders'
    });
  }
};

// Recruitment: administrators or HR department managers only (not HR employees)
const authorizeHRRecruitment = (req, res, next) => {
  if (req.user.role === 'admin' || (req.user.role === 'manager' && req.user.department === 'HR')) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access denied. Only administrators and HR managers can access recruitment.'
  });
};

module.exports = { 
  protect, 
  authorize, 
  authorizeAdminOrHR, 
  authorizeHRRecruitment,
  authorizeEmployeeManagement,
  authorizeCreatePurchaseOrder,
  authorizeEditPurchaseOrder,
  authorizeAcceptPurchaseOrder,
  authorizeReceivePurchaseOrder,
  authorizeDepartment
};
