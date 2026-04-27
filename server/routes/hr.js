const express = require('express');
const { body, validationResult } = require('express-validator');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { protect, authorize, authorizeAdminOrHR, authorizeEmployeeManagement } = require('../middleware/auth');
const { archiveDocument } = require('../services/archiveService');
const moment = require('moment');
const { isOptionalPhoneValid, PHONE_VALIDATION_MESSAGE } = require('../utils/phoneValidation');
const {
  calculateAttendanceMetrics,
  calculateWorkingHoursDisplay,
} = require('../utils/attendanceMetrics');

const router = express.Router();

function withCalculatedWorkingHours(attendanceDoc) {
  if (!attendanceDoc) return attendanceDoc;
  const attendance = attendanceDoc.toObject ? attendanceDoc.toObject() : attendanceDoc;
  return {
    ...attendance,
    workingHours: calculateWorkingHoursDisplay(attendance.checkIn, attendance.checkOut)
  };
}

// @route   GET /api/hr/employees
// @desc    Get all users (displayed as employees) - Public access for viewing
// @access  Public
router.get('/employees', async (req, res) => {
  try {
    console.log('Fetching employees...');
    // Fetch Employee records with populated user data
    const employees = await Employee.find()
      .populate('user', 'name email role department isActive createdAt')
      .sort({ createdAt: -1 });

    console.log('Found employees:', employees.length);

    // Transform employees for the frontend - filter out employees without users
    const employeesData = employees
      .filter((employee) => employee.user) // Only include employees with valid users
      .map((employee) => ({
        _id: employee.user._id,
        employeeId: employee.employeeId,
        user: {
          _id: employee.user._id,
          name: employee.user.name,
          email: employee.user.email,
          role: employee.user.role,
          department: employee.user.department,
          isActive: employee.user.isActive
        },
        position: employee.position,
        department: employee.department,
        salary: employee.salary || 0,
        hireDate: employee.hireDate,
        holidays: employee.holidays || 0,
        personalInfo: employee.personalInfo || {
          phone: ''
        },
        isActive: employee.isActive,
        createdAt: employee.createdAt,
        updatedAt: employee.updatedAt
      }));

    // Also get users without employee records and add them
    const allUsers = await User.find()
      .select('name email role department isActive createdAt')
      .sort({ createdAt: -1 });
    
    const usersWithoutEmployees = allUsers.filter(user => 
      !employees.some(emp => emp.user && emp.user._id.toString() === user._id.toString())
    );

    // Add users without employee records as employees with default values
    usersWithoutEmployees.forEach((user, index) => {
      const userEmployeeId = `EMP${String(employees.length + index + 1).padStart(4, '0')}`;
      employeesData.push({
        _id: user._id,
        employeeId: userEmployeeId,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          isActive: user.isActive
        },
        position: user.role === 'admin' ? 'Administrator' : 
                  user.role === 'manager' ? 'Manager' : 'Employee',
        department: user.department,
        salary: 0,
        hireDate: user.createdAt,
        holidays: 0,
        personalInfo: {
          phone: ''
        },
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      });
    });

    // Sort by creation date descending
    employeesData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      count: employeesData.length,
      data: employeesData
    });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/hr/employees/test
// @desc    Test route to check database
// @access  Public
router.get('/employees/test', async (req, res) => {
  try {
    console.log('=== TESTING DATABASE ===');
    
    // Check users
    const userCount = await User.countDocuments();
    console.log('Total users in database:', userCount);
    
    // Check employees
    const employeeCount = await Employee.countDocuments();
    console.log('Total employees in database:', employeeCount);
    
    // Get all users
    const users = await User.find().select('name email role department');
    console.log('All users:', users);
    
    // Get all employees
    const employees = await Employee.find().populate('user', 'name email role');
    console.log('All employees:', employees);
    
    res.json({
      success: true,
      userCount,
      employeeCount,
      users,
      employees
    });
  } catch (error) {
    console.error('Test route error:', error);
    res.status(500).json({
      success: false,
      message: 'Test route error',
      error: error.message
    });
  }
});

// @route   POST /api/hr/employees/test
// @desc    Test creating a simple user
// @access  Public
router.post('/employees/test', async (req, res) => {
  try {
    console.log('=== TESTING USER CREATION ===');
    console.log('Request body:', req.body);
    
    const { name, email, password, role, department } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }
    
    console.log('Creating user...');
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'employee',
      department
    });
    console.log('User created successfully:', user._id);
    
    res.json({
      success: true,
      message: 'User created successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      }
    });
  } catch (error) {
    console.error('Test user creation error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Test user creation failed',
      error: error.message
    });
  }
});

// @route   POST /api/hr/employees
// @desc    Create new employee (user) - Admin, managers, and non-HR employees
// @access  Private (Admin, managers, and non-HR employees)
router.post('/employees', [
  protect,
  authorizeEmployeeManagement,
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('department').notEmpty().withMessage('Department is required'),
  body('salary').optional().isFloat({ min: 0 }).withMessage('Salary must be a non-negative number'),
  body('holidays').optional().isInt({ min: 0 }).withMessage('Holidays must be a non-negative integer'),
  body('phone').custom((value) => isOptionalPhoneValid(value == null ? '' : String(value))).withMessage(PHONE_VALIDATION_MESSAGE)
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

    const { name, email, password, role, department, salary, holidays, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create user
    console.log('Creating user with data:', { name, email, role, department });
    
    // Validate department against enum values
    const validDepartments = ['HR', 'Manufacturing', 'SCM', 'CRM', 'Sales', 'Inventory', 'Purchasing', 'Finance'];
    if (!validDepartments.includes(department)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid department. Must be one of: ' + validDepartments.join(', ')
      });
    }
    
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'employee',
      department
    });
    console.log('User created:', user._id);

    // Create corresponding employee record for attendance system - MANDATORY
    let employee = null;
    try {
      // Find the highest existing employee ID and increment it
      const lastEmployee = await Employee.findOne().sort({ employeeId: -1 });
      let nextId = 1;
      if (lastEmployee && lastEmployee.employeeId) {
        const lastId = parseInt(lastEmployee.employeeId.replace('EMP', ''));
        nextId = lastId + 1;
      }
      const employeeId = `EMP${String(nextId).padStart(4, '0')}`;
      
      employee = await Employee.create({
        user: user._id,
        employeeId: employeeId,
        position: user.role === 'admin' ? 'Administrator' : 
                  user.role === 'manager' ? 'Manager' : 'Employee',
        department: user.department || 'HR',
        hireDate: user.createdAt,
        salary: salary !== undefined ? parseFloat(salary) : 0,
        holidays: holidays ? parseInt(holidays) : 0,
        personalInfo: {
          phone: phone || ''
        },
        isActive: true
      });
      console.log('Employee record created successfully:', employee._id);
    } catch (employeeError) {
      console.error('CRITICAL: Employee record creation failed:', employeeError);
      
      // If employee creation fails, delete the user and return error
      await User.findByIdAndDelete(user._id);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to create employee record. User creation rolled back.',
        error: employeeError.message
      });
    }

    // Transform user to look like employee for the frontend
    const employeeData = {
      _id: user._id,
      employeeId: employee.employeeId,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      position: employee.position,
      department: employee.department,
      salary: employee.salary || 0,
      hireDate: employee.hireDate,
      holidays: employee.holidays || 0,
      personalInfo: employee.personalInfo,
      isActive: employee.isActive,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt
    };

    console.log('User transformed to employee data:', employeeData);

    res.status(201).json({
      success: true,
      message: 'Employee created successfully with attendance access',
      data: employeeData
    });
    console.log('Response sent successfully');
  } catch (error) {
    console.error('Create employee error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/hr/employees/:id
// @desc    Update user (displayed as employee) - Admin, managers, and non-HR employees
// @access  Private (Admin, managers, and non-HR employees)
router.put('/employees/:id', [
  protect,
  authorizeEmployeeManagement,
  body('phone').custom((value) => {
    if (value === undefined) return true;
    return isOptionalPhoneValid(String(value));
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

    const { name, email, role, department, salary, holidays, phone, password } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate department against enum values
    const validDepartments = ['HR', 'Manufacturing', 'SCM', 'CRM', 'Sales', 'Inventory', 'Purchasing', 'Finance'];
    if (department && !validDepartments.includes(department)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid department. Must be one of: ' + validDepartments.join(', ')
      });
    }

    // Update user information
    user.name = name;
    user.email = email;
    user.role = role;
    user.department = department;
    
    // Update password if provided
    if (password && password.trim() !== '') {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters'
        });
      }
      user.password = password; // Password will be hashed by the pre-save hook
    }
    
    await user.save();

    // Find and update employee record
    let employee = await Employee.findOne({ user: req.params.id });
    
    if (employee) {
      // Update existing employee record
      if (salary !== undefined) {
        employee.salary = parseFloat(salary) || 0;
      }
      if (holidays !== undefined) {
        employee.holidays = parseInt(holidays);
      }
      // Update position if role changed
      employee.position = user.role === 'admin' ? 'Administrator' : 
                          user.role === 'manager' ? 'Manager' : 'Employee';
      employee.department = user.department;
      // Update phone number
      if (!employee.personalInfo) {
        employee.personalInfo = { phone: '' };
      }
      if (phone !== undefined) {
        employee.personalInfo.phone = phone || '';
      }
      await employee.save();
    } else {
      // Create employee record if it doesn't exist
      const lastEmployee = await Employee.findOne().sort({ employeeId: -1 });
      let nextId = 1;
      if (lastEmployee && lastEmployee.employeeId) {
        const lastId = parseInt(lastEmployee.employeeId.replace('EMP', ''));
        nextId = lastId + 1;
      }
      const employeeId = `EMP${String(nextId).padStart(4, '0')}`;
      
      employee = await Employee.create({
        user: user._id,
        employeeId: employeeId,
        position: user.role === 'admin' ? 'Administrator' : 
                  user.role === 'manager' ? 'Manager' : 'Employee',
        department: user.department || 'HR',
        hireDate: user.createdAt || new Date(),
        salary: salary !== undefined ? parseFloat(salary) : 0,
        holidays: holidays ? parseInt(holidays) : 0,
        personalInfo: {
          phone: phone || ''
        },
        isActive: true
      });
    }

    // Return updated employee data
    const employeeData = {
      _id: user._id,
      employeeId: employee.employeeId,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        isActive: user.isActive
      },
      position: employee.position,
      department: employee.department,
      salary: employee.salary || 0,
      hireDate: employee.hireDate,
      holidays: employee.holidays || 0,
      personalInfo: employee.personalInfo || {
        phone: ''
      },
      isActive: employee.isActive,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt
    };

    res.json({
      success: true,
      data: employeeData
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/hr/attendance/status
// @desc    Get current user's today attendance status
// @access  Private
router.get('/attendance/status', protect, async (req, res) => {
  try {
    // Find employee by user ID
    let employee = await Employee.findOne({ user: req.user.id });
    
    if (!employee) {
      return res.json({
        success: true,
        status: 'not_checked_in',
        data: null
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    const attendance = await Attendance.findOne({
      employee: employee._id,
      date: {
        $gte: today,
        $lte: endOfToday
      }
    })
      .populate({
        path: 'employee',
        select: 'employeeId user position department',
        populate: {
          path: 'user',
          select: '_id name email'
        }
      });

    if (!attendance || !attendance.checkIn) {
      return res.json({
        success: true,
        status: 'not_checked_in',
        data: null
      });
    }

    if (attendance.checkOut) {
      return res.json({
        success: true,
        status: 'checked_out',
        data: withCalculatedWorkingHours(attendance)
      });
    }

    return res.json({
      success: true,
      status: 'checked_in',
      data: withCalculatedWorkingHours(attendance)
    });
  } catch (error) {
    console.error('Get attendance status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/hr/attendance
// @desc    Get attendance records
// @access  Private
router.get('/attendance', protect, async (req, res) => {
  try {
    const { employee, startDate, endDate } = req.query;
    let query = {};

    // Check if user can view all attendance records (admin or HR department)
    const canViewAll = req.user.role === 'admin' || req.user.department === 'HR';
    
    if (!canViewAll) {
      // Non-HR users can only see their own attendance records
      const userEmployee = await Employee.findOne({ user: req.user.id });
      if (!userEmployee) {
        return res.status(403).json({
          success: false,
          message: 'Employee record not found'
        });
      }
      query.employee = userEmployee._id;
    } else if (employee) {
      // HR users can filter by specific employee
      query.employee = employee;
    }

    if (startDate && endDate) {
      // Create proper date range for the entire day in UTC
      const start = new Date(startDate + 'T00:00:00.000Z');
      const end = new Date(endDate + 'T23:59:59.999Z');
      
      query.date = {
        $gte: start,
        $lte: end
      };
    }

    const attendance = await Attendance.find(query)
      .populate({
        path: 'employee',
        select: 'employeeId user position department',
        populate: {
          path: 'user',
          select: '_id name email'
        }
      })
      .sort({ date: -1 });

    const attendanceWithHours = attendance.map(withCalculatedWorkingHours);

    res.json({
      success: true,
      count: attendanceWithHours.length,
      data: attendanceWithHours
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/hr/attendance/checkin
// @desc    Employee check-in
// @access  Private
router.post('/attendance/checkin', protect, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find employee by user ID
    let employee = await Employee.findOne({ user: req.user.id });
    
    if (!employee) {
      // Create employee record for existing user if it doesn't exist
      // Find the highest existing employee ID and increment it
      const lastEmployee = await Employee.findOne().sort({ employeeId: -1 });
      let nextId = 1;
      if (lastEmployee && lastEmployee.employeeId) {
        const lastId = parseInt(lastEmployee.employeeId.replace('EMP', ''));
        nextId = lastId + 1;
      }
      const employeeId = `EMP${String(nextId).padStart(4, '0')}`;
      
      try {
        employee = await Employee.create({
          user: req.user.id,
          employeeId: employeeId,
          position: req.user.role === 'admin' ? 'Administrator' : 
                    req.user.role === 'manager' ? 'Manager' : 'Employee',
          department: req.user.department || 'HR',
          hireDate: req.user.createdAt || new Date(),
          salary: 0,
          holidays: 0,
          personalInfo: {
            phone: ''
          },
          isActive: true
        });
      } catch (createError) {
        console.error('Error creating employee record:', createError);
        throw createError;
      }
    }

    // Check if already checked in today - use date range properly
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    const existingAttendance = await Attendance.findOne({
      employee: employee._id,
      date: {
        $gte: today,
        $lte: endOfToday
      }
    });

    if (existingAttendance && existingAttendance.checkIn) {
      return res.status(400).json({
        success: false,
        message: 'Already checked in today'
      });
    }

    let attendance;
    if (existingAttendance) {
      // Update existing record
      attendance = existingAttendance;
    } else {
      // Create new attendance record
      attendance = new Attendance({
        employee: employee._id,
        date: today
      });
    }

    attendance.checkIn = new Date();
    await attendance.save();

    await attendance.populate({
      path: 'employee',
      select: 'employeeId user position department',
      populate: {
        path: 'user',
        select: '_id name email'
      }
    });

    res.json({
      success: true,
      data: withCalculatedWorkingHours(attendance)
    });
  } catch (error) {
    console.error('Check-in error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/hr/attendance/checkout
// @desc    Employee check-out
// @access  Private
router.post('/attendance/checkout', protect, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find employee by user ID
    let employee = await Employee.findOne({ user: req.user.id });
    if (!employee) {
      // Create employee record for existing user if it doesn't exist
      console.log('Creating employee record for user:', req.user.id);
      // Find the highest existing employee ID and increment it
      const lastEmployee = await Employee.findOne().sort({ employeeId: -1 });
      let nextId = 1;
      if (lastEmployee && lastEmployee.employeeId) {
        const lastId = parseInt(lastEmployee.employeeId.replace('EMP', ''));
        nextId = lastId + 1;
      }
      const employeeId = `EMP${String(nextId).padStart(4, '0')}`;
      
      employee = await Employee.create({
        user: req.user.id,
        employeeId: employeeId,
        position: req.user.role === 'admin' ? 'Administrator' : 
                  req.user.role === 'manager' ? 'Manager' : 'Employee',
        department: req.user.department || 'HR',
        hireDate: req.user.createdAt || new Date(),
        salary: 0,
        holidays: 0,
        personalInfo: {
          phone: ''
        },
        isActive: true
      });
      console.log('Employee record created for existing user:', employee._id);
    }

    // Find today's attendance record - use date range properly
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    const attendance = await Attendance.findOne({
      employee: employee._id,
      date: {
        $gte: today,
        $lte: endOfToday
      }
    });

    if (!attendance) {
      return res.status(400).json({
        success: false,
        message: 'No attendance record found for today. Please check in first.'
      });
    }

    if (!attendance.checkIn) {
      return res.status(400).json({
        success: false,
        message: 'No check-in record found for today. Please check in first.'
      });
    }

    if (attendance.checkOut) {
      return res.status(400).json({
        success: false,
        message: 'Already checked out today'
      });
    }

    // Set checkout time
    attendance.checkOut = new Date();
    
    await attendance.save();

    await attendance.populate({
      path: 'employee',
      select: 'employeeId user position department',
      populate: {
        path: 'user',
        select: '_id name email'
      }
    });

    res.json({
      success: true,
      data: withCalculatedWorkingHours(attendance)
    });
  } catch (error) {
    console.error('Check-out error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   DELETE /api/hr/employees/:id
// @desc    Delete (archive) user (displayed as employee)
// @access  Private (Admin, managers, and non-HR employees)
router.delete('/employees/:id', [
  protect,
  authorizeEmployeeManagement
], async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await archiveDocument({
      model: User,
      documentId: req.params.id,
      module: 'HR',
      documentType: 'User',
      documentNumber: user.email || user.name,
      userId: req.user.id,
      reason: req.body?.reason
    });

    res.json({
      success: true,
      message: 'User archived successfully'
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/hr/managers/:department
// @desc    Get manager email for a specific department
// @access  Private
router.get('/managers/:department', protect, async (req, res) => {
  try {
    const { department } = req.params;
    
    // Find users with manager role in the specified department (case-insensitive)
    const manager = await User.findOne({
      role: 'manager',
      department: { $regex: new RegExp(`^${department}$`, 'i') },
      isActive: true
    }).select('name email department role');

    if (!manager) {
      return res.status(404).json({
        success: false,
        message: `No manager found for ${department} department`
      });
    }

    res.json({
      success: true,
      data: {
        name: manager.name,
        email: manager.email,
        department: manager.department,
        role: manager.role
      }
    });
  } catch (error) {
    console.error('Get manager error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/hr/managers
// @desc    Get all managers
// @access  Private
router.get('/managers', protect, async (req, res) => {
  try {
    const managers = await User.find({
      role: 'manager',
      isActive: true
    }).select('name email department role');

    res.json({
      success: true,
      count: managers.length,
      data: managers
    });
  } catch (error) {
    console.error('Get managers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/hr/managers/public
// @desc    Get all managers (public for testing)
// @access  Public
router.get('/managers/public', async (req, res) => {
  try {
    const managers = await User.find({
      role: 'manager',
      isActive: true
    }).select('name email department role');

    res.json({
      success: true,
      count: managers.length,
      data: managers
    });
  } catch (error) {
    console.error('Get managers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/hr/attendance/report
// @desc    Get unified attendance & punctuality report with lateness, early departure, and absence metrics
// @access  Private
router.get('/attendance/report', protect, async (req, res) => {
  try {
    const { dateFrom, dateTo, employeeId, departmentId } = req.query;

    // Validate date range
    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        success: false,
        message: 'Date range (dateFrom and dateTo) is required'
      });
    }

    // Parse dates
    const startDate = new Date(dateFrom + 'T00:00:00.000Z');
    const endDate = new Date(dateTo + 'T23:59:59.999Z');

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    // Build query for attendance records
    let attendanceQuery = {
      date: {
        $gte: startDate,
        $lte: endDate
      }
    };

    // Filter by employee if provided (can be Employee _id or employeeId string)
    if (employeeId) {
      let employee = null;
      // Try to find by _id first
      if (employeeId.match(/^[0-9a-fA-F]{24}$/)) {
        employee = await Employee.findById(employeeId);
      }
      // If not found by _id, try by employeeId string (e.g., "EMP0001")
      if (!employee) {
        employee = await Employee.findOne({ employeeId: employeeId });
      }
      // Also try finding by user _id (since frontend might pass user._id)
      if (!employee) {
        employee = await Employee.findOne({ user: employeeId });
      }
      if (employee) {
        attendanceQuery.employee = employee._id;
      }
    }

    // Get all attendance records in date range
    let attendanceRecords = await Attendance.find(attendanceQuery)
      .populate({
        path: 'employee',
        select: 'employeeId user department',
        populate: {
          path: 'user',
          select: 'name email'
        }
      })
      .sort({ date: 1, 'employee.employeeId': 1 });

    // Filter by department if provided
    if (departmentId) {
      attendanceRecords = attendanceRecords.filter(record => 
        record.employee && 
        record.employee.user && 
        record.employee.user.department === departmentId
      );
    }

    // Get all employees to calculate absent days
    let employeeQuery = {};
    if (departmentId) {
      const usersInDept = await User.find({ department: departmentId, isActive: true }).select('_id');
      const employeeIds = await Employee.find({ user: { $in: usersInDept.map(u => u._id) } }).select('_id');
      employeeQuery._id = { $in: employeeIds.map(e => e._id) };
    }
    if (employeeId) {
      // Find employee by _id, employeeId string, or user _id
      let employee = null;
      if (employeeId.match(/^[0-9a-fA-F]{24}$/)) {
        employee = await Employee.findById(employeeId);
      }
      if (!employee) {
        employee = await Employee.findOne({ employeeId: employeeId });
      }
      if (!employee) {
        employee = await Employee.findOne({ user: employeeId });
      }
      if (employee) {
        employeeQuery._id = employee._id;
      }
    }

    const allEmployees = await Employee.find(employeeQuery)
      .populate('user', 'name email department')
      .select('employeeId user department');

    const WORKING_DAYS_PER_MONTH = 26;
    const isScheduledWorkingDay = (dateValue) => {
      const dt = new Date(dateValue);
      return dt.getUTCDate() <= WORKING_DAYS_PER_MONTH;
    };
    const getScheduledWorkingDays = (start, end) => {
      let workingDays = 0;
      const currentDate = new Date(start);
      while (currentDate <= end) {
        if (isScheduledWorkingDay(currentDate)) {
          workingDays++;
        }
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }
      return workingDays;
    };

    const totalWorkingDays = getScheduledWorkingDays(startDate, endDate);

    // Group attendance by employee/day so absence math is deterministic
    // even if there are duplicate/mixed records on the same day.
    const employeeDaySummaryMap = new Map();
    const employeeInfoMap = new Map();
    attendanceRecords.forEach((record) => {
      if (!record.employee || !record.employee.user) return;
      const empId = record.employee._id.toString();
      const dateStr = record.date.toISOString().split('T')[0];
      const hasCheckIn = Boolean(record.checkIn);
      const hasCheckOut = Boolean(record.checkOut);
      const isExplicitAbsent = String(record.status || '').toLowerCase() === 'absent';
      const isComplete = hasCheckIn && hasCheckOut;

      if (!employeeInfoMap.has(empId)) {
        employeeInfoMap.set(empId, {
          employeeId: record.employee.employeeId,
          employeeName: record.employee.user.name
        });
      }

      if (!employeeDaySummaryMap.has(empId)) {
        employeeDaySummaryMap.set(empId, new Map());
      }
      const dayMap = employeeDaySummaryMap.get(empId);
      const current = dayMap.get(dateStr) || {
        hasAnyRecord: false,
        hasCompleteRecord: false,
        hasExplicitAbsent: false,
        // Keep one deterministic representative row per employee/day.
        representativeRecord: null
      };

      current.hasAnyRecord = true;
      current.hasCompleteRecord = current.hasCompleteRecord || (hasCheckIn && hasCheckOut);
      current.hasExplicitAbsent = current.hasExplicitAbsent || isExplicitAbsent;

      // Prefer a complete record over incomplete ones for the same day.
      if (!current.representativeRecord) {
        current.representativeRecord = record;
      } else {
        const existing = current.representativeRecord;
        const existingComplete = Boolean(existing.checkIn) && Boolean(existing.checkOut);
        if (!existingComplete && isComplete) {
          current.representativeRecord = record;
        }
      }
      dayMap.set(dateStr, current);
    });

    // Calculate absent days for each employee
    const absentDaysMap = new Map();
    
    allEmployees.forEach(employee => {
      if (!employee.user) return;
      
      const empId = employee._id.toString();
      const dayMap = employeeDaySummaryMap.get(empId) || new Map();

      let absentDays = 0;
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        if (isScheduledWorkingDay(currentDate)) {
          const dateStr = currentDate.toISOString().split('T')[0];
          const daySummary = dayMap.get(dateStr);
          // Absent if: no record OR explicit absent OR no complete check-in/out record.
          if (!daySummary || daySummary.hasExplicitAbsent || !daySummary.hasCompleteRecord) {
            absentDays++;
          }
        }
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }
      
      const absencePercentage = totalWorkingDays > 0 
        ? ((absentDays / totalWorkingDays) * 100).toFixed(2) 
        : '0.00';
      
      absentDaysMap.set(empId, {
        totalAbsentDays: absentDays,
        absencePercentage: parseFloat(absencePercentage)
      });
    });

    // Build unified report data
    const reportData = [];

    const formatTime = (dateTime) => {
      if (!dateTime) return null;
      const dt = new Date(dateTime);
      return dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    };
    const EARLY_LEAVE_THRESHOLD_MINUTES = 10; // Before 04:50 PM (vs 05:00 PM shift end).
    const statusMap = {
      present: 'Present',
      absent: 'Absent',
      late: 'Late',
      'half-day': 'Half-Day',
      'early-leave': 'Early Leave',
      'off-day': 'OFF_DAY'
    };

    // Build one deterministic row per employee/day in range:
    // - days 1..26 are scheduled working days
    // - days 27+ are OFF_DAY and never absent
    allEmployees.forEach((employee) => {
      if (!employee.user) return;
      const empId = employee._id.toString();
      const dayMap = employeeDaySummaryMap.get(empId) || new Map();
      const absentData = absentDaysMap.get(empId) || { totalAbsentDays: 0, absencePercentage: 0 };
      const employeeInfo = employeeInfoMap.get(empId) || {
        employeeId: employee.employeeId,
        employeeName: employee.user.name
      };

      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const daySummary = dayMap.get(dateStr);
        const record = daySummary?.representativeRecord || null;
        const isWorkingDay = isScheduledWorkingDay(currentDate);

        const metrics = calculateAttendanceMetrics({
          checkIn: record?.checkIn || null,
          checkOut: record?.checkOut || null,
          attendanceDate: record?.date || currentDate
        });

        const minutesLate = metrics.lateMinutes;
        const minutesEarly = metrics.earlyMinutes;

        let status = 'present';
        if (!isWorkingDay) {
          status = 'off-day';
        } else if (!record?.checkIn || !record?.checkOut || daySummary?.hasExplicitAbsent) {
          status = 'absent';
        } else if (minutesLate > 0) {
          status = 'late';
        } else if (minutesEarly > EARLY_LEAVE_THRESHOLD_MINUTES) {
          status = 'early-leave';
        }

        const displayStatus = statusMap[status] || 'Present';
        const isOffDay = status === 'off-day';

        reportData.push({
          employeeId: employeeInfo.employeeId,
          employeeName: employeeInfo.employeeName,
          date: dateStr,
          checkIn: formatTime(record?.checkIn) || 'N/A',
          checkOut: formatTime(record?.checkOut) || 'N/A',
          status: displayStatus,
          totalWorkingHours: isOffDay ? '00:00' : metrics.workingHoursDisplay,
          minutesLate: isOffDay ? 0 : minutesLate,
          minutesEarly: isOffDay ? 0 : minutesEarly,
          overtimeMinutes: isOffDay ? 0 : metrics.overtimeMinutes,
          overtime: isOffDay ? '00:00' : metrics.overtimeDisplay,
          overtimeHours: isOffDay ? 0 : metrics.overtimeHoursDecimal,
          totalAbsentDays: absentData.totalAbsentDays,
          absencePercentage: absentData.absencePercentage
        });

        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }
    });

    // Sort by employee name and date
    reportData.sort((a, b) => {
      if (a.employeeName !== b.employeeName) {
        return a.employeeName.localeCompare(b.employeeName);
      }
      return a.date.localeCompare(b.date);
    });

    res.json({
      success: true,
      count: reportData.length,
      data: reportData,
      totalWorkingDays: totalWorkingDays
    });
  } catch (error) {
    console.error('Attendance report error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
