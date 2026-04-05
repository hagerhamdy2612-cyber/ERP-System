const ActivityLog = require('../models/ActivityLog');

/**
 * Get client IP address from request
 * @param {Object} req - Express request object
 * @returns {string|null}
 */
function getClientIp(req) {
  if (!req) return null;
  return (
    req.ip ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    null
  );
}

/**
 * Log an activity (audit trail) to the database.
 * Non-blocking: does not throw; failures are logged to console.
 *
 * @param {Object} params
 * @param {string} params.userId - User ID (ObjectId) who performed the action
 * @param {string} params.action - Action type: CREATE, UPDATE, DELETE, APPROVE, LOGIN, MANUAL_EDIT, etc.
 * @param {string} params.module - Module: SALES, HR, INVENTORY, FINANCE, PURCHASING, CRM, AUTH
 * @param {string} [params.entityId] - ID of the affected entity (ObjectId)
 * @param {string} [params.entityType] - Type of entity (e.g. Invoice, Employee, Product, BankAccount)
 * @param {Object} [params.oldData] - Previous state (for UPDATE/DELETE)
 * @param {Object} [params.newData] - New state (for CREATE/UPDATE)
 * @param {Object} [params.req] - Express request (used to extract ipAddress)
 */
async function logActivity({ userId, action, module, entityId, entityType, oldData, newData, req }) {
  if (!userId || !action || !module) {
    console.warn('[logActivity] Missing required fields: userId, action, module');
    return;
  }

  const ipAddress = req ? getClientIp(req) : null;

  try {
    await ActivityLog.create({
      user: userId,
      action,
      module,
      entityId: entityId || undefined,
      entityType: entityType || undefined,
      oldData: oldData || undefined,
      newData: newData || undefined,
      ipAddress
    });
  } catch (err) {
    console.error('[logActivity] Failed to create activity log:', err.message);
  }
}

module.exports = { logActivity, getClientIp };
