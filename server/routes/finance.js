const express = require('express');
const { body, validationResult } = require('express-validator');
const { protect, authorize, authorizeDepartment } = require('../middleware/auth');
const BankAccount = require('../models/BankAccount');
const { logActivity } = require('../utils/logActivity');
const Transaction = require('../models/Transaction');
const Expense = require('../models/Expense');
const Invoice = require('../models/Invoice');
const PurchaseInvoice = require('../models/PurchaseInvoice');
const PayrollRecord = require('../models/PayrollRecord');
const { recordPayrollExpense } = require('../services/payrollFinanceService');

const router = express.Router();

/**
 * @route   GET /api/finance/dashboard
 * @desc    Get finance dashboard summary
 * @access  Private (Manager, Admin)
 */
router.get('/dashboard', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    // Get total bank balance
    const bankAccounts = await BankAccount.find();
    const totalBalance = bankAccounts.reduce((sum, acc) => sum + acc.balance, 0);

    // Get unpaid invoices count
    const unpaidSalesInvoices = await Invoice.countDocuments({ status: { $ne: 'paid' } });
    const unpaidPurchaseInvoices = await PurchaseInvoice.countDocuments({ status: { $ne: 'paid' } });
    const totalUnpaid = unpaidSalesInvoices + unpaidPurchaseInvoices;

    // Get paid invoices count
    const paidSalesInvoices = await Invoice.countDocuments({ status: 'paid' });
    const paidPurchaseInvoices = await PurchaseInvoice.countDocuments({ status: 'paid' });
    const totalPaid = paidSalesInvoices + paidPurchaseInvoices;

    // Get expenses this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const expensesThisMonth = await Expense.find({
      date: { $gte: startOfMonth }
    });
    const totalExpenses = expensesThisMonth.reduce((sum, exp) => sum + exp.amount, 0);

    // Calculate Net Cash Flow (Total Income - Total Expenses)
    // Income = IN transactions (sales invoices paid)
    // Expenses = OUT transactions (purchase invoices paid + expenses)
    const allTransactions = await Transaction.find();
    const totalIncome = allTransactions
      .filter(t => t.direction === 'in')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalOutgoing = allTransactions
      .filter(t => t.direction === 'out')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const netCashFlow = totalIncome - totalOutgoing;

    // Get recent transactions (last 10)
    const recentTransactions = await Transaction.find()
      .populate('bankAccount', 'name')
      .sort({ date: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        totalBalance,
        totalUnpaid,
        totalPaid,
        totalExpenses,
        expensesCount: expensesThisMonth.length,
        netCashFlow,
        totalIncome,
        totalOutgoing,
        recentTransactions
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /api/finance/invoices
 * @desc    Get all invoices (sales + purchase) - both paid and unpaid
 * @access  Private
 */
router.get('/invoices', protect, async (req, res) => {
  try {
    const salesInvoices = await Invoice.find()
      .populate('customer', 'name')
      .select('invoiceNumber total status invoiceDate dueDate customer')
      .sort({ invoiceDate: -1 });

    const purchaseInvoices = await PurchaseInvoice.find()
      .populate('supplier', 'name')
      .select('invoiceNumber total status invoiceDate dueDate supplier')
      .sort({ invoiceDate: -1 });

    // Format invoices with type
    const formattedSales = salesInvoices.map(inv => ({
      _id: inv._id,
      invoiceNumber: inv.invoiceNumber,
      type: 'sales',
      totalAmount: inv.total,
      status: inv.status,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      customer: inv.customer?.name || 'N/A',
      model: 'Invoice'
    }));

    const formattedPurchase = purchaseInvoices.map(inv => ({
      _id: inv._id,
      invoiceNumber: inv.invoiceNumber,
      type: 'purchase',
      totalAmount: inv.total,
      status: inv.status,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      supplier: inv.supplier?.name || 'N/A',
      model: 'PurchaseInvoice'
    }));

    const allInvoices = [...formattedSales, ...formattedPurchase].sort((a, b) => 
      new Date(b.invoiceDate) - new Date(a.invoiceDate)
    );

    res.json({
      success: true,
      count: allInvoices.length,
      data: allInvoices
    });
  } catch (error) {
    console.error('Get unpaid invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   POST /api/finance/pay-invoice
 * @desc    Pay an invoice (sales or purchase)
 * @access  Private (Manager, Admin)
 */
router.post('/pay-invoice', [
  protect,
  authorize('admin', 'manager'),
  body('invoiceId').notEmpty().withMessage('Invoice ID is required'),
  body('invoiceModel').isIn(['Invoice', 'PurchaseInvoice']).withMessage('Invalid invoice model'),
  body('bankAccountId').isMongoId().withMessage('Valid bank account ID is required'),
  body('notes').optional().isString()
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

    const { invoiceId, invoiceModel, bankAccountId, notes } = req.body;

    // Get invoice
    const InvoiceModel = invoiceModel === 'Invoice' ? Invoice : PurchaseInvoice;
    const invoice = await InvoiceModel.findById(invoiceId);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Invoice is already paid'
      });
    }

    // Get bank account
    const bankAccount = await BankAccount.findById(bankAccountId);
    if (!bankAccount) {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }

    // Determine transaction direction
    // Sales invoice = money coming IN
    // Purchase invoice = money going OUT
    const direction = invoiceModel === 'Invoice' ? 'in' : 'out';

    // Check balance for outgoing transactions
    if (direction === 'out' && bankAccount.balance < invoice.total) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance in bank account'
      });
    }

    // Create transaction
    const transaction = await Transaction.create({
      sourceType: 'invoice',
      sourceId: invoice._id,
      sourceModel: invoiceModel,
      direction,
      amount: invoice.total,
      bankAccount: bankAccountId,
      date: new Date(),
      notes: notes || `Payment for ${invoice.invoiceNumber}`
    });

    // Update bank account balance
    if (direction === 'in') {
      bankAccount.balance += invoice.total;
    } else {
      bankAccount.balance -= invoice.total;
    }
    await bankAccount.save();

    // Update invoice status and link transaction
    invoice.status = 'paid';
    invoice.relatedTransaction = transaction._id;
    await invoice.save();

    res.json({
      success: true,
      message: 'Invoice paid successfully',
      data: {
        transaction,
        invoice,
        newBalance: bankAccount.balance
      }
    });
  } catch (error) {
    console.error('Pay invoice error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

/**
 * @route   GET /api/finance/payroll/unpaid
 * @desc    List payroll records awaiting payment from Finance
 * @access  Private (Manager, Admin)
 */
router.get('/payroll/unpaid', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const rows = await PayrollRecord.find({
      status: 'approved'
    })
      .populate({
        path: 'employee',
        select: 'employeeId user',
        populate: { path: 'user', select: 'name email' }
      })
      .populate({
        path: 'financeExpense',
        select: 'status amount employeeId source type referencePayrollId'
      })
      .sort({ periodYear: -1, periodMonth: -1, createdAt: -1 })
      .lean();

    const unpaidRows = rows.filter((row) => {
      if (!row.financeExpense) return true;
      return row.financeExpense.status !== 'Paid';
    });

    res.json({
      success: true,
      count: unpaidRows.length,
      data: unpaidRows
    });
  } catch (error) {
    console.error('Get unpaid payroll error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   POST /api/finance/payroll/:id/pay
 * @desc    Pay an approved payroll record from a Finance bank account
 * @access  Private (Manager, Admin)
 */
router.post(
  '/payroll/:id/pay',
  [
    protect,
    authorize('admin', 'manager'),
    body('bankAccountId').isMongoId().withMessage('Valid bank account ID is required'),
    body('paymentDate').optional().isISO8601().withMessage('Valid payment date is required'),
    body('notes').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const payroll = await PayrollRecord.findById(req.params.id).populate({
        path: 'employee',
        select: 'employeeId user',
        populate: { path: 'user', select: 'name email' }
      });

      if (!payroll) {
        return res.status(404).json({
          success: false,
          message: 'Payroll record not found'
        });
      }

      if (payroll.status !== 'approved') {
        return res.status(400).json({
          success: false,
          message: 'Only approved payroll records can be paid from Finance.'
        });
      }

      const payableAmount = Number(payroll.netSalary ?? payroll.netPay ?? 0);
      if (payableAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Net pay must be greater than 0.'
        });
      }

      if (payroll.financeExpense) {
        const linkedExpense = await Expense.findById(payroll.financeExpense).select('status');
        if (linkedExpense?.status === 'Paid') {
          return res.status(400).json({
            success: false,
            message: 'This payroll record was already paid from Finance.'
          });
        }
      }

      const paymentDate = req.body.paymentDate ? new Date(req.body.paymentDate) : new Date();
      const employeeName = payroll.employee?.user?.name || payroll.employee?.employeeId || 'Employee';

      const { expense, transaction } = await recordPayrollExpense({
        netPay: payableAmount,
        payrollRecordId: payroll._id,
        employeeDisplayName: employeeName,
        periodYear: payroll.periodYear,
        periodMonth: payroll.periodMonth,
        bankAccountId: req.body.bankAccountId,
        paymentDate,
        notes: req.body.notes || payroll.notes,
        existingExpenseId: payroll.financeExpense || null
      });

      payroll.status = 'paid';
      payroll.paymentDate = paymentDate;
      if (req.body.notes !== undefined) {
        payroll.notes = req.body.notes ? String(req.body.notes).trim() : '';
      }
      payroll.financeExpense = expense._id;
      payroll.financeTransaction = transaction._id;
      await payroll.save();

      const updated = await PayrollRecord.findById(payroll._id)
        .populate({
          path: 'employee',
          select: 'employeeId user',
          populate: { path: 'user', select: 'name email' }
        })
        .populate({
          path: 'financeExpense',
          select: 'title amount category bankAccount',
          populate: { path: 'bankAccount', select: 'name' }
        });

      res.json({
        success: true,
        data: updated
      });
    } catch (error) {
      console.error('Pay payroll from finance error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Server error'
      });
    }
  }
);

/**
 * @route   GET /api/finance/transactions
 * @desc    Get all transactions
 * @access  Private
 */
router.get('/transactions', protect, async (req, res) => {
  try {
    const { limit = 100, startDate, endDate } = req.query;
    
    let query = {};
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(query)
      .populate('bankAccount', 'name')
      .sort({ date: -1 })
      .limit(parseInt(limit));

    // Populate source information
    for (let transaction of transactions) {
      if (transaction.sourceModel === 'Invoice') {
        const invoice = await Invoice.findById(transaction.sourceId)
          .select('invoiceNumber customer')
          .populate('customer', 'name');
        transaction.sourceData = invoice;
      } else if (transaction.sourceModel === 'PurchaseInvoice') {
        const invoice = await PurchaseInvoice.findById(transaction.sourceId)
          .select('invoiceNumber supplier')
          .populate('supplier', 'name');
        transaction.sourceData = invoice;
      } else if (transaction.sourceModel === 'Expense') {
        const expense = await Expense.findById(transaction.sourceId)
          .select('title category');
        transaction.sourceData = expense;
      }
    }

    res.json({
      success: true,
      count: transactions.length,
      data: transactions
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /api/finance/bank
 * @desc    Get bank accounts with recent transactions
 * @access  Private
 */
router.get('/bank', protect, async (req, res) => {
  try {
    const bankAccounts = await BankAccount.find().sort({ name: 1 });

    // Get recent transactions for each account (last 5)
    const accountsWithTransactions = await Promise.all(
      bankAccounts.map(async (account) => {
        const recentTransactions = await Transaction.find({ bankAccount: account._id })
          .sort({ date: -1 })
          .limit(5)
          .select('direction amount date notes sourceType');

        return {
          ...account.toObject(),
          recentTransactions
        };
      })
    );

    res.json({
      success: true,
      count: accountsWithTransactions.length,
      data: accountsWithTransactions
    });
  } catch (error) {
    console.error('Get bank error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   POST /api/finance/expenses
 * @desc    Create an expense
 * @access  Private (Manager, Admin)
 */
router.post('/expenses', [
  protect,
  authorize('admin', 'manager'),
  body('title').notEmpty().withMessage('Title is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('category').notEmpty().withMessage('Category is required'),
  body('bankAccountId').isMongoId().withMessage('Valid bank account ID is required'),
  body('notes').optional().isString(),
  body('date').optional().isISO8601().withMessage('Invalid date format')
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

    const { title, amount, category, bankAccountId, notes, date } = req.body;

    // Get bank account
    const bankAccount = await BankAccount.findById(bankAccountId);
    if (!bankAccount) {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }

    // Check balance
    if (bankAccount.balance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance in bank account'
      });
    }

    // Create transaction first (direction = out for expenses)
    const transaction = await Transaction.create({
      sourceType: 'expense',
      sourceId: null, // Will be updated after expense creation
      sourceModel: 'Expense',
      direction: 'out',
      amount: parseFloat(amount),
      bankAccount: bankAccountId,
      date: date ? new Date(date) : new Date(),
      notes: notes || `Expense: ${title}`
    });

    // Create expense
    const expense = await Expense.create({
      title,
      amount: parseFloat(amount),
      category,
      bankAccount: bankAccountId,
      transaction: transaction._id,
      date: date ? new Date(date) : new Date(),
      notes
    });

    // Update transaction with expense reference
    transaction.sourceId = expense._id;
    await transaction.save();

    // Update bank account balance (deduct)
    bankAccount.balance -= parseFloat(amount);
    await bankAccount.save();

    const populatedExpense = await Expense.findById(expense._id)
      .populate('bankAccount', 'name')
      .populate('transaction');

    res.status(201).json({
      success: true,
      message: 'Expense created successfully',
      data: populatedExpense
    });
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

/**
 * @route   GET /api/finance/expenses
 * @desc    Get all expenses
 * @access  Private
 */
router.get('/expenses', protect, async (req, res) => {
  try {
    const { limit = 100, startDate, endDate, category } = req.query;
    
    let query = {};
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    if (category) {
      query.category = category;
    }

    const expenses = await Expense.find(query)
      .populate('bankAccount', 'name')
      .populate('transaction', 'direction amount date')
      .sort({ date: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: expenses.length,
      data: expenses
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   POST /api/finance/expenses/:id/pay
 * @desc    Pay a pending expense from Finance
 * @access  Private (Manager, Admin)
 */
router.post('/expenses/:id/pay', [
  protect,
  authorize('admin', 'manager'),
  body('bankAccountId').isMongoId().withMessage('Valid bank account ID is required'),
  body('paymentDate').optional().isISO8601().withMessage('Invalid payment date'),
  body('notes').optional().isString()
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

    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    if (expense.status === 'Paid') {
      return res.status(400).json({
        success: false,
        message: 'This expense is already paid'
      });
    }

    const bankAccount = await BankAccount.findById(req.body.bankAccountId);
    if (!bankAccount) {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }

    const amount = Number(expense.amount);
    if (bankAccount.balance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance in bank account'
      });
    }

    const payDate = req.body.paymentDate ? new Date(req.body.paymentDate) : new Date();
    const noteText = req.body.notes || `Expense payment: ${expense.title}`;

    const transaction = await Transaction.create({
      sourceType: 'expense',
      sourceId: expense._id,
      sourceModel: 'Expense',
      direction: 'out',
      amount,
      bankAccount: bankAccount._id,
      date: payDate,
      notes: noteText
    });

    expense.bankAccount = bankAccount._id;
    expense.transaction = transaction._id;
    expense.status = 'Paid';
    expense.date = payDate;
    expense.notes = noteText;
    await expense.save();

    bankAccount.balance -= amount;
    await bankAccount.save();

    const populatedExpense = await Expense.findById(expense._id)
      .populate('bankAccount', 'name')
      .populate('transaction', 'direction amount date');

    res.json({
      success: true,
      message: 'Expense paid successfully',
      data: populatedExpense
    });
  } catch (error) {
    console.error('Pay expense error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

/**
 * @route   GET /api/finance/bank-accounts
 * @desc    Get all bank accounts (Admin only)
 * @access  Private (Admin)
 */
router.get('/bank-accounts', protect, authorize('admin'), async (req, res) => {
  try {
    const bankAccounts = await BankAccount.find().sort({ name: 1 });
    
    res.json({
      success: true,
      count: bankAccounts.length,
      data: bankAccounts
    });
  } catch (error) {
    console.error('Get bank accounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   POST /api/finance/bank-accounts
 * @desc    Create a new bank account (Admin or Finance manager)
 * @access  Private
 */
router.post('/bank-accounts', [
  protect,
  authorizeDepartment('Finance'),
  body('name').notEmpty().withMessage('Name is required').trim(),
  body('balance').optional().isFloat({ min: 0 }).withMessage('Balance must be a positive number')
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

    const { name, balance = 0 } = req.body;

    // Check if account with same name already exists
    const existingAccount = await BankAccount.findOne({ name: name.trim() });
    if (existingAccount) {
      return res.status(400).json({
        success: false,
        message: 'Bank account with this name already exists'
      });
    }

    const bankAccount = await BankAccount.create({
      name: name.trim(),
      balance: parseFloat(balance) || 0
    });

    await logActivity({
      userId: req.user.id,
      action: 'CREATE',
      module: 'FINANCE',
      entityId: bankAccount._id,
      entityType: 'BankAccount',
      newData: bankAccount.toObject ? bankAccount.toObject() : bankAccount,
      req
    });

    res.status(201).json({
      success: true,
      message: 'Bank account created successfully',
      data: bankAccount
    });
  } catch (error) {
    console.error('Create bank account error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

/**
 * @route   PUT /api/finance/bank-accounts/:id
 * @desc    Update a bank account (Admin or Finance manager)
 * @access  Private
 */
router.put('/bank-accounts/:id', [
  protect,
  authorizeDepartment('Finance'),
  body('name').optional().notEmpty().withMessage('Name cannot be empty').trim(),
  body('balance').optional().isFloat({ min: 0 }).withMessage('Balance must be a positive number')
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

    const { name, balance } = req.body;
    const bankAccount = await BankAccount.findById(req.params.id);

    if (!bankAccount) {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }

    const oldData = bankAccount.toObject ? bankAccount.toObject() : { ...bankAccount._doc };

    // Check if name is being changed and if new name already exists
    if (name && name.trim() !== bankAccount.name) {
      const existingAccount = await BankAccount.findOne({ name: name.trim() });
      if (existingAccount) {
        return res.status(400).json({
          success: false,
          message: 'Bank account with this name already exists'
        });
      }
      bankAccount.name = name.trim();
    }

    // Update balance if provided
    if (balance !== undefined) {
      bankAccount.balance = parseFloat(balance);
    }

    await bankAccount.save();

    const newData = bankAccount.toObject ? bankAccount.toObject() : { ...bankAccount._doc };
    await logActivity({
      userId: req.user.id,
      action: 'MANUAL_EDIT',
      module: 'FINANCE',
      entityId: bankAccount._id,
      entityType: 'BankAccount',
      oldData,
      newData,
      req
    });

    res.json({
      success: true,
      message: 'Bank account updated successfully',
      data: bankAccount
    });
  } catch (error) {
    console.error('Update bank account error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

/**
 * @route   DELETE /api/finance/bank-accounts/:id
 * @desc    Delete a bank account (Admin or Finance manager)
 * @access  Private
 */
router.delete('/bank-accounts/:id', protect, authorizeDepartment('Finance'), async (req, res) => {
  try {
    const bankAccount = await BankAccount.findById(req.params.id);

    if (!bankAccount) {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }

    // Check if account has transactions
    const transactionCount = await Transaction.countDocuments({ bankAccount: bankAccount._id });
    if (transactionCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete bank account with existing transactions. Please delete transactions first.'
      });
    }

    const oldData = bankAccount.toObject ? bankAccount.toObject() : { ...bankAccount._doc };
    await BankAccount.findByIdAndDelete(req.params.id);

    await logActivity({
      userId: req.user.id,
      action: 'DELETE',
      module: 'FINANCE',
      entityId: bankAccount._id,
      entityType: 'BankAccount',
      oldData,
      req
    });

    res.json({
      success: true,
      message: 'Bank account deleted successfully'
    });
  } catch (error) {
    console.error('Delete bank account error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

/**
 * @route   GET /api/finance/cash-flow
 * @desc    Get cash flow data aggregated by date for line chart
 * @access  Private (Manager, Admin)
 */
router.get('/cash-flow', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { period = '30' } = req.query; // days, default 30
    const days = parseInt(period);
    
    // Calculate start date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Aggregate transactions by date
    const cashFlowData = await Transaction.aggregate([
      {
        $match: {
          date: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$date' }
          },
          totalIn: {
            $sum: {
              $cond: [{ $eq: ['$direction', 'in'] }, '$amount', 0]
            }
          },
          totalOut: {
            $sum: {
              $cond: [{ $eq: ['$direction', 'out'] }, '$amount', 0]
            }
          }
        }
      },
      {
        $project: {
          date: '$_id',
          totalIn: 1,
          totalOut: 1,
          netFlow: { $subtract: ['$totalIn', '$totalOut'] }
        }
      },
      {
        $sort: { date: 1 }
      }
    ]);

    res.json({
      success: true,
      data: cashFlowData
    });
  } catch (error) {
    console.error('Cash flow error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /api/finance/month-comparison
 * @desc    Get month-over-month comparison data for trend indicators
 * @access  Private (Manager, Admin)
 */
router.get('/month-comparison', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const now = new Date();
    
    // Current month
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    currentMonthStart.setHours(0, 0, 0, 0);
    
    // Previous month
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    previousMonthStart.setHours(0, 0, 0, 0);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    previousMonthEnd.setHours(23, 59, 59, 999);

    // Get current month transactions
    const currentMonthTransactions = await Transaction.find({
      date: { $gte: currentMonthStart }
    });

    const currentMonthIncome = currentMonthTransactions
      .filter(t => t.direction === 'in')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const currentMonthExpenses = currentMonthTransactions
      .filter(t => t.direction === 'out')
      .reduce((sum, t) => sum + t.amount, 0);

    // Get previous month transactions
    const previousMonthTransactions = await Transaction.find({
      date: {
        $gte: previousMonthStart,
        $lte: previousMonthEnd
      }
    });

    const previousMonthIncome = previousMonthTransactions
      .filter(t => t.direction === 'in')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const previousMonthExpenses = previousMonthTransactions
      .filter(t => t.direction === 'out')
      .reduce((sum, t) => sum + t.amount, 0);

    // Calculate net cash flow
    const currentMonthNetFlow = currentMonthIncome - currentMonthExpenses;
    const previousMonthNetFlow = previousMonthIncome - previousMonthExpenses;

    // Calculate percentage changes
    const incomeChange = previousMonthIncome > 0
      ? ((currentMonthIncome - previousMonthIncome) / previousMonthIncome) * 100
      : (currentMonthIncome > 0 ? 100 : 0);
    
    const expensesChange = previousMonthExpenses > 0
      ? ((currentMonthExpenses - previousMonthExpenses) / previousMonthExpenses) * 100
      : (currentMonthExpenses > 0 ? 100 : 0);
    
    const netFlowChange = previousMonthNetFlow !== 0
      ? ((currentMonthNetFlow - previousMonthNetFlow) / Math.abs(previousMonthNetFlow)) * 100
      : (currentMonthNetFlow !== 0 ? (currentMonthNetFlow > 0 ? 100 : -100) : 0);

    // Get current month balance change
    const currentMonthBalanceChange = currentMonthIncome - currentMonthExpenses;
    const previousMonthBalanceChange = previousMonthIncome - previousMonthExpenses;
    const balanceChange = previousMonthBalanceChange !== 0
      ? ((currentMonthBalanceChange - previousMonthBalanceChange) / Math.abs(previousMonthBalanceChange)) * 100
      : (currentMonthBalanceChange !== 0 ? (currentMonthBalanceChange > 0 ? 100 : -100) : 0);

    res.json({
      success: true,
      data: {
        currentMonth: {
          income: currentMonthIncome,
          expenses: currentMonthExpenses,
          netFlow: currentMonthNetFlow,
          balanceChange: currentMonthBalanceChange
        },
        previousMonth: {
          income: previousMonthIncome,
          expenses: previousMonthExpenses,
          netFlow: previousMonthNetFlow,
          balanceChange: previousMonthBalanceChange
        },
        percentageChange: {
          income: incomeChange,
          expenses: expensesChange,
          netFlow: netFlowChange,
          balance: balanceChange
        }
      }
    });
  } catch (error) {
    console.error('Month comparison error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /api/finance/expenses-breakdown
 * @desc    Get expenses breakdown by category for pie chart
 * @access  Private (Manager, Admin)
 */
router.get('/expenses-breakdown', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    // Get current month start
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Aggregate expenses by category
    const expensesBreakdown = await Expense.aggregate([
      {
        $match: {
          date: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          category: '$_id',
          total: 1,
          count: 1,
          _id: 0
        }
      },
      {
        $sort: { total: -1 }
      }
    ]);

    // Calculate total for percentage calculation
    const totalExpenses = expensesBreakdown.reduce((sum, item) => sum + item.total, 0);

    // Add percentage to each category
    const breakdownWithPercentage = expensesBreakdown.map(item => ({
      ...item,
      percentage: totalExpenses > 0 ? (item.total / totalExpenses) * 100 : 0
    }));

    res.json({
      success: true,
      data: breakdownWithPercentage,
      total: totalExpenses
    });
  } catch (error) {
    console.error('Expenses breakdown error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;

