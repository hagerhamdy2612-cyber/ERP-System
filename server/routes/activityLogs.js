const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const ActivityLog = require('../models/ActivityLog');
const ExcelJS = require('exceljs');

const router = express.Router();

/**
 * @route   GET /api/activity-logs
 * @desc    Get activity logs (admin only). Pagination, filter by user, module, date range.
 * @access  Private (ADMIN only)
 */
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, user, module, startDate, endDate } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    if (user) {
      query.user = user;
    }
    if (module) {
      query.module = module;
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      ActivityLog.find(query)
        .select('-oldData -newData -entityId -ipAddress')
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ActivityLog.countDocuments(query)
    ]);

    const pages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      logs,
      total,
      page: pageNum,
      pages
    });
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /api/activity-logs/export
 * @desc    Export activity logs as Excel (.xlsx) (admin only). Same filters as list.
 * @access  Private (ADMIN only)
 */
const MAX_EXPORT = 10000;

router.get('/export', protect, authorize('admin'), async (req, res) => {
  try {
    const { user: userId, module, startDate, endDate } = req.query;
    const query = {};
    if (userId) query.user = userId;
    if (module) query.module = module;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const logs = await ActivityLog.find(query)
      .select('-oldData -newData -entityId -ipAddress')
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(MAX_EXPORT)
      .lean();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Activity Log');
    sheet.columns = [
      { header: 'Date', key: 'date', width: 22 },
      { header: 'User Name', key: 'userName', width: 20 },
      { header: 'User Email', key: 'userEmail', width: 28 },
      { header: 'Action', key: 'action', width: 14 },
      { header: 'Module', key: 'module', width: 14 },
      { header: 'Entity Type', key: 'entityType', width: 16 }
    ];

    logs.forEach((log) => {
      sheet.addRow({
        date: log.createdAt ? new Date(log.createdAt) : '',
        userName: log.user?.name ?? '',
        userEmail: log.user?.email ?? '',
        action: log.action ?? '',
        module: log.module ?? '',
        entityType: log.entityType ?? ''
      });
    });

    const filename =
      startDate && endDate
        ? `activity-log-${startDate}-to-${endDate}.xlsx`
        : `activity-log-export-${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Export activity logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
