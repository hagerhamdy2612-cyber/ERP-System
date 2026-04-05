const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: ['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'LOGIN', 'MANUAL_EDIT', 'MARK_PAID', 'RESTORE', 'PERMANENT_DELETE']
  },
  module: {
    type: String,
    required: true,
    enum: ['SALES', 'HR', 'INVENTORY', 'FINANCE', 'PURCHASING', 'CRM', 'AUTH', 'ARCHIVE']
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId
  },
  entityType: {
    type: String
  },
  oldData: {
    type: mongoose.Schema.Types.Mixed
  },
  newData: {
    type: mongoose.Schema.Types.Mixed
  },
  ipAddress: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false
});

// Indexes for efficient querying
activityLogSchema.index({ user: 1 });
activityLogSchema.index({ module: 1 });
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ user: 1, createdAt: -1 });
activityLogSchema.index({ module: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
