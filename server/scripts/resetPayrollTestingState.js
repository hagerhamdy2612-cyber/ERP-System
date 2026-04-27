const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });

const Attendance = require('../models/Attendance');
const PayrollRecord = require('../models/PayrollRecord');
const Expense = require('../models/Expense');
const Transaction = require('../models/Transaction');
const Employee = require('../models/Employee');
const User = require('../models/User');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1) Remove attendance records
    const attendanceDeleteResult = await Attendance.deleteMany({});

    // 2) Remove payroll records
    const payrollDeleteResult = await PayrollRecord.deleteMany({});

    // 3) Remove expenses and related expense transactions
    const expensesDeleteResult = await Expense.deleteMany({});
    await Transaction.deleteMany({ sourceType: 'expense' });

    // 4) Keep only one admin + six employees (earliest created)
    const admins = await User.find({ role: 'admin' })
      .setOptions({ includeDeleted: true })
      .sort({ createdAt: 1 })
      .lean();

    if (!admins.length) {
      throw new Error('No admin user found. Reset aborted to avoid unsafe deletion.');
    }

    const keptAdmin = admins[0];

    const allEmployees = await Employee.find({})
      .populate({
        path: 'user',
        select: '_id role isActive isDeleted createdAt',
        options: { includeDeleted: true }
      })
      .sort({ createdAt: 1 })
      .lean();

    const candidateEmployees = allEmployees.filter(
      (emp) =>
        emp.user &&
        String(emp.user._id) !== String(keptAdmin._id) &&
        emp.user.role !== 'admin'
    );

    const keptEmployees = candidateEmployees.slice(0, 6);
    const keptEmployeeIds = new Set(keptEmployees.map((emp) => String(emp._id)));
    const removedEmployeeIds = allEmployees
      .filter((emp) => !keptEmployeeIds.has(String(emp._id)))
      .map((emp) => emp._id);

    const removedEmployeesResult =
      removedEmployeeIds.length > 0
        ? await Employee.deleteMany({ _id: { $in: removedEmployeeIds } })
        : { deletedCount: 0 };

    const keepUserIds = new Set([String(keptAdmin._id)]);
    keptEmployees.forEach((emp) => {
      if (emp.user?._id) keepUserIds.add(String(emp.user._id));
    });

    const removedUsersResult = await User.deleteMany({
      _id: { $nin: Array.from(keepUserIds) }
    });

    // Ensure kept entities are active/non-deleted
    await User.updateOne(
      { _id: keptAdmin._id },
      { $set: { isActive: true, isDeleted: false, deletedAt: null, deletedBy: null } }
    );
    if (keptEmployees.length > 0) {
      await Employee.updateMany(
        { _id: { $in: keptEmployees.map((emp) => emp._id) } },
        { $set: { isActive: true } }
      );
      await User.updateMany(
        { _id: { $in: keptEmployees.map((emp) => emp.user._id) } },
        { $set: { isActive: true, isDeleted: false, deletedAt: null, deletedBy: null } }
      );
    }

    // 5) Verify no orphaned links in reset scope
    const activeEmployeeIds = (await Employee.find({}).select('_id').lean()).map((emp) => emp._id);
    const orphanAttendanceCount = await Attendance.countDocuments({
      employee: { $nin: activeEmployeeIds }
    });
    const orphanExpensePayrollRefCount = await Expense.countDocuments({
      referencePayrollId: { $ne: null }
    });

    console.log('--- RESET SUMMARY ---');
    console.log(`employees_kept: ${keptEmployees.length}`);
    console.log(`employees_removed: ${removedEmployeesResult.deletedCount || 0}`);
    console.log(`users_removed: ${removedUsersResult.deletedCount || 0}`);
    console.log(`attendance_deleted: ${attendanceDeleteResult.deletedCount || 0}`);
    console.log(`payroll_deleted: ${payrollDeleteResult.deletedCount || 0}`);
    console.log(`expenses_deleted: ${expensesDeleteResult.deletedCount || 0}`);
    console.log(`orphan_attendance_links: ${orphanAttendanceCount}`);
    console.log(`orphan_expense_payroll_refs: ${orphanExpensePayrollRefCount}`);
    console.log(`kept_admin_user_id: ${keptAdmin._id}`);

    process.exit(0);
  } catch (error) {
    console.error('Reset payroll testing state failed:', error);
    process.exit(1);
  }
}

run();
