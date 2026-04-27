const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../config.env') });

const Attendance = require('../models/Attendance');
const PayrollRecord = require('../models/PayrollRecord');
const Expense = require('../models/Expense');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const attendanceResult = await Attendance.deleteMany({});
    const payrollResult = await PayrollRecord.deleteMany({});
    const expenseResult = await Expense.deleteMany({});

    console.log('--- TEST DATA RESET ---');
    console.log(`attendance_deleted: ${attendanceResult.deletedCount ?? 0}`);
    console.log(`payroll_deleted: ${payrollResult.deletedCount ?? 0}`);
    console.log(`expenses_deleted: ${expenseResult.deletedCount ?? 0}`);
    console.log('Employees were not modified.');

    process.exit(0);
  } catch (error) {
    console.error('resetTestData failed:', error);
    process.exit(1);
  }
}

run();
