const mongoose = require('mongoose');
const Archive = require('../models/Archive');
const { logActivity } = require('../utils/logActivity');

/**
 * Map documentType to Mongoose model for restore
 */
const DOCUMENT_MODELS = {
  SalesOrder: require('../models/SalesOrder'),
  PurchaseOrder: require('../models/PurchaseOrder'),
  Product: require('../models/Product'),
  User: require('../models/User'),
  ProductionOrder: require('../models/ProductionOrder'),
  Customer: require('../models/Customer'),
  Complaint: require('../models/Complaint')
};

/**
 * Archive a document (soft delete): save full snapshot to Archive, then set isDeleted on original.
 * @param {Object} params
 * @param {mongoose.Model} params.model - Mongoose model (e.g. SalesOrder, Product)
 * @param {string} params.documentId - _id of the document
 * @param {string} params.module - Sales | Purchasing | Inventory | HR | Production | CRM
 * @param {string} params.documentType - e.g. SalesOrder, Invoice, Employee, Product
 * @param {string} [params.documentNumber] - optional human-readable number
 * @param {string} params.userId - User who deleted
 * @param {string} [params.reason] - optional reason
 * @returns {Promise<{ archive: Object, doc: Object }>}
 */
/**
 * Archive a document (soft delete): save full snapshot to Archive, then set isDeleted on original.
 * Uses a transaction when the deployment supports it (replica set); otherwise runs without session.
 */
async function archiveDocument({ model, documentId, module, documentType, documentNumber, userId, reason }) {
  const runWithSession = async (session) => {
    const opts = session ? { session } : {};
    const doc = await model.findById(documentId).setOptions(opts).lean();
    if (!doc) {
      const err = new Error('Document not found');
      err.statusCode = 404;
      throw err;
    }

    const deletedAt = new Date();
    const archiveDoc = {
      originalId: doc._id,
      module,
      documentType,
      documentNumber: documentNumber || doc.orderNumber || doc.invoiceNumber || doc.employeeId || doc.sku || doc.complaintNumber || doc.name || String(doc._id),
      data: doc,
      deletedBy: userId,
      deletedAt,
      reason: reason || null
    };

    const created = await Archive.create([archiveDoc], opts);
    await model.updateOne(
      { _id: documentId },
      { $set: { isDeleted: true, deletedAt, deletedBy: userId } },
      opts
    );

    return { archive: created[0], doc };
  };

  try {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const result = await runWithSession(session);
      await session.commitTransaction();
      return result;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } catch (transactionError) {
    // Fallback when transactions are not supported (e.g. standalone MongoDB without replica set)
    const isTransactionError = transactionError.message && (
      transactionError.message.includes('replica set') ||
      transactionError.message.includes('transaction') ||
      transactionError.code === 251
    );
    if (isTransactionError) {
      return runWithSession(null);
    }
    throw transactionError;
  }
}

/**
 * Restore an archived document: set isDeleted = false on original, mark archive as restored.
 */
async function restoreArchive(archiveId, userId) {
  const runWithSession = async (session) => {
    const opts = session ? { session } : {};
    const archive = await Archive.findById(archiveId).setOptions(opts);
    if (!archive) {
      const err = new Error('Archive record not found');
      err.statusCode = 404;
      throw err;
    }
    if (archive.isRestored) {
      const err = new Error('Document already restored');
      err.statusCode = 400;
      throw err;
    }

    const Model = DOCUMENT_MODELS[archive.documentType];
    if (!Model) {
      const err = new Error(`Unknown document type: ${archive.documentType}`);
      err.statusCode = 400;
      throw err;
    }

    const restoredAt = new Date();
    await Model.updateOne(
      { _id: archive.originalId },
      { $set: { isDeleted: false, deletedAt: null, deletedBy: null } },
      opts
    );

    archive.isRestored = true;
    archive.restoredAt = restoredAt;
    archive.restoredBy = userId;
    await archive.save(opts);

    const restored = await Model.findById(archive.originalId).lean();
    return { archive, restored };
  };

  try {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const result = await runWithSession(session);
      await session.commitTransaction();
      return result;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } catch (transactionError) {
    const isTransactionError = transactionError.message && (
      transactionError.message.includes('replica set') ||
      transactionError.message.includes('transaction') ||
      transactionError.code === 251
    );
    if (isTransactionError) {
      return runWithSession(null);
    }
    throw transactionError;
  }
}

module.exports = {
  archiveDocument,
  restoreArchive,
  DOCUMENT_MODELS
};
