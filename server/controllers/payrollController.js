const payrollService = require('../services/payrollService');

function respondError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server error'
  });
}

exports.listPayroll = async (req, res) => {
  try {
    const result = await payrollService.listPayroll(req.query);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    respondError(res, error, 'listPayroll error:');
  }
};

exports.getPayrollById = async (req, res) => {
  try {
    const row = await payrollService.getPayrollById(req.params.id);
    res.json({ success: true, data: row });
  } catch (error) {
    respondError(res, error, 'getPayrollById error:');
  }
};

exports.generatePayroll = async (req, res) => {
  try {
    const rows = await payrollService.generatePayroll(req.body || {});
    res.status(201).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    respondError(res, error, 'generatePayroll error:');
  }
};

exports.approvePayroll = async (req, res) => {
  try {
    const row = await payrollService.approvePayroll(req.params.id);
    res.json({ success: true, data: row });
  } catch (error) {
    respondError(res, error, 'approvePayroll error:');
  }
};

exports.recalculatePayroll = async (req, res) => {
  try {
    const row = await payrollService.recalculatePayroll(req.params.id);
    res.json({ success: true, data: row });
  } catch (error) {
    respondError(res, error, 'recalculatePayroll error:');
  }
};

exports.deleteAllPayroll = async (req, res) => {
  try {
    const result = await payrollService.deleteAllPayroll(req.query || {});
    res.json({
      success: true,
      message: 'Payroll and linked finance records deleted successfully',
      ...result
    });
  } catch (error) {
    respondError(res, error, 'deleteAllPayroll error:');
  }
};
