/**
 * Wipe ALL business data from the database while keeping admin account(s) so you
 * can still log in.
 *
 * - Every collection is emptied.
 * - In the `users` collection, only users with role === 'admin' are kept.
 *   (Their Employee profiles and all other linked records are still removed.)
 *
 * Usage (from the server folder so ./config.env loads):
 *   node scripts/clearAllData.js
 *   node scripts/clearAllData.js --yes     # skip the confirmation prompt
 *
 * WARNING: This is destructive and cannot be undone.
 */

const path = require('path');
const readline = require('readline');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../config.env') });

const User = require('../models/User');

// Every other model is fully cleared. Keep this list in sync with /models.
const MODELS_TO_CLEAR = [
  'Attendance',
  'Employee',
  'PayrollRecord',
  'Expense',
  'Transaction',
  'BankAccount',
  'Customer',
  'Complaint',
  'Supplier',
  'Product',
  'InventoryTransaction',
  'Invoice',
  'PurchaseOrder',
  'PurchaseInvoice',
  'SalesOrder',
  'ProductionOrder',
  'Archive',
  'ActivityLog'
];

function confirm(question) {
  if (process.argv.includes('--yes') || process.argv.includes('-y')) {
    return Promise.resolve(true);
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(String(answer).trim().toLowerCase() === 'yes');
    });
  });
}

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set. Run this script from the server folder so ./config.env loads.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to MongoDB: ${process.env.MONGODB_URI}`);

  const adminCount = await User.countDocuments({ role: 'admin' }).setOptions({ includeDeleted: true });
  console.log(`Admin accounts that will be kept: ${adminCount}`);

  if (adminCount === 0) {
    console.warn('WARNING: No admin account found. You may be locked out after wiping users.');
  }

  const proceed = await confirm(
    'This will DELETE ALL DATA except admin account(s). Type "yes" to continue: '
  );
  if (!proceed) {
    console.log('Aborted. No data was deleted.');
    process.exit(0);
  }

  const summary = {};

  // Clear all non-user collections.
  for (const modelName of MODELS_TO_CLEAR) {
    let Model;
    try {
      Model = require(`../models/${modelName}`);
    } catch (err) {
      console.warn(`Skipping ${modelName} (model not found).`);
      continue;
    }
    const result = await Model.deleteMany({});
    summary[modelName] = result.deletedCount || 0;
  }

  // Clear users except admins (deleteMany bypasses the soft-delete find hook,
  // so soft-deleted non-admins are removed too).
  const userResult = await User.deleteMany({ role: { $ne: 'admin' } });
  summary.User = userResult.deletedCount || 0;

  console.log('--- CLEAR ALL DATA SUMMARY ---');
  Object.keys(summary)
    .sort()
    .forEach((name) => console.log(`${name}_deleted: ${summary[name]}`));
  console.log(`admins_kept: ${adminCount}`);
  console.log('Done. You can still log in with your admin account.');

  process.exit(0);
}

run().catch((error) => {
  console.error('clearAllData failed:', error);
  process.exit(1);
});
