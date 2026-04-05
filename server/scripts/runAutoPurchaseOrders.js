/**
 * Standalone script: Auto-generate purchase orders from low stock.
 * Run this when the ERP server is OFF so auto-purchase still runs on a schedule.
 *
 * Usage (from project root):
 *   node server/scripts/runAutoPurchaseOrders.js
 *
 * Schedule with OS:
 * - Windows: Task Scheduler → run every hour (e.g. "node C:\path\to\erp-grad\server\scripts\runAutoPurchaseOrders.js")
 * - Linux/Mac: cron — add: 0 * * * * cd /path/to/erp-grad && node server/scripts/runAutoPurchaseOrders.js
 */

const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load env from server/config.env (works when run from project root: node server/scripts/runAutoPurchaseOrders.js)
dotenv.config({ path: path.join(__dirname, '../config.env') });

const schedulerService = require('../services/schedulerService');

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set. Check config.env.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[runAutoPurchaseOrders] Connected to MongoDB');
    await schedulerService.generateAutoPurchaseOrders();
    console.log('[runAutoPurchaseOrders] Done');
  } catch (err) {
    console.error('[runAutoPurchaseOrders] Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('[runAutoPurchaseOrders] Disconnected');
    process.exit(0);
  }
}

main();
