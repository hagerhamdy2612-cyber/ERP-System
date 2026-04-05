const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const Archive = require('../models/Archive');
const { restoreArchive } = require('../services/archiveService');
const { logActivity } = require('../utils/logActivity');

const router = express.Router();

/**
 * GET /api/archive
 * List archived documents. Admin only.
 * Query: page, limit, module, startDate, endDate, documentNumber (search)
 */
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, module, startDate, endDate, documentNumber } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (module) query.module = module;
    if (startDate || endDate) {
      query.deletedAt = {};
      if (startDate) query.deletedAt.$gte = new Date(startDate);
      if (endDate) query.deletedAt.$lte = new Date(endDate);
    }
    if (documentNumber && documentNumber.trim()) {
      query.documentNumber = new RegExp(documentNumber.trim(), 'i');
    }

    const [archives, total] = await Promise.all([
      Archive.find(query)
        .populate('deletedBy', 'name email')
        .populate('restoredBy', 'name email')
        .sort({ deletedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Archive.countDocuments(query)
    ]);

    const pages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      data: archives,
      total,
      page: pageNum,
      pages
    });
  } catch (error) {
    console.error('Get archive list error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * POST /api/archive/:id/restore
 * Restore an archived document. Admin only.
 */
router.post('/:id/restore', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await restoreArchive(id, req.user.id);

    await logActivity({
      userId: req.user.id,
      action: 'RESTORE',
      module: 'ARCHIVE',
      entityId: result.archive._id,
      entityType: result.archive.documentType,
      newData: { archiveId: id, originalId: result.archive.originalId, documentNumber: result.archive.documentNumber },
      req
    });

    res.json({
      success: true,
      message: 'Document restored successfully',
      data: result.restored
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('Restore archive error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
