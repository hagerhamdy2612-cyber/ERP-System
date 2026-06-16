const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const schedulerService = require('./services/schedulerService');

// Load environment variables
dotenv.config({ path: './config.env' });
console.log("JWT_SECRET =", process.env.JWT_SECRET);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database connection
mongoose.connect(process.env.MONGODB_URI)
.then(async () => {
  console.log('MongoDB connected successfully');
  try {
    const Product = require('./models/Product');
    const fg = await Product.updateMany(
      { category: 'finished-good' },
      { $set: { category: 'final-product' } }
    );
    const rest = await Product.updateMany(
      { category: { $nin: ['raw-material', 'final-product'] } },
      { $set: { category: 'raw-material' } }
    );
    const n = (fg.modifiedCount || 0) + (rest.modifiedCount || 0);
    if (n > 0) {
      console.log(`Product categories: migrated ${n} legacy row(s) (finished-good → final-product; other legacy → raw-material).`);
    }
  } catch (e) {
    console.error('Product category migration:', e.message);
  }
})
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/hr', require('./routes/hr'));
app.use('/api/hr/payroll', require('./routes/payroll'));
app.use('/api/payroll', require('./routes/payroll'));
app.use('/api/manufacturing', require('./routes/manufacturing'));
app.use('/api/scm', require('./routes/scm'));
app.use('/api/crm', require('./routes/crm'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/purchasing', require('./routes/purchasing'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api/activity-logs', require('./routes/activityLogs'));
app.use('/api/archive', require('./routes/archive'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'ERP System API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Start the scheduler service
  try {
    schedulerService.start();
    console.log('Scheduler service started successfully');
    // Run once immediately so existing low-stock raw materials get POs without waiting for the hourly job
    // or without saving a "new" product to trigger hooks.
    schedulerService.generateAutoPurchaseOrders().catch((err) => {
      console.error('Initial auto-purchase run after startup:', err);
    });
  } catch (error) {
    console.error('Error starting scheduler service:', error);
    console.log('Server will continue without scheduler service');
  }
});
