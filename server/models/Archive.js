const mongoose = require('mongoose');

const archiveSchema = new mongoose.Schema({
  originalId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  module: {
    type: String,
    required: true,
    enum: ['Sales', 'Purchasing', 'Inventory', 'HR', 'Production', 'CRM']
  },
  documentType: {
    type: String,
    required: true
  },
  documentNumber: {
    type: String
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  deletedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  reason: {
    type: String
  },
  isRestored: {
    type: Boolean,
    default: false
  },
  restoredAt: {
    type: Date
  },
  restoredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

archiveSchema.index({ module: 1 });
archiveSchema.index({ deletedAt: -1 });
archiveSchema.index({ documentNumber: 'text' });
archiveSchema.index({ isRestored: 1 });

module.exports = mongoose.model('Archive', archiveSchema);
