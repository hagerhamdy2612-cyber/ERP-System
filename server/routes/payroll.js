const express = require('express');
const { protect, authorizeAdminOrHR } = require('../middleware/auth');
const payrollController = require('../controllers/payrollController');

const router = express.Router();

router.use(protect, authorizeAdminOrHR);

router.get('/', payrollController.listPayroll);
router.delete('/', payrollController.deleteAllPayroll);
router.post('/generate', payrollController.generatePayroll);
router.patch('/approve/:id', payrollController.approvePayroll);
router.patch('/recalculate/:id', payrollController.recalculatePayroll);
router.patch('/:id/recalculate', payrollController.recalculatePayroll);
router.get('/:id', payrollController.getPayrollById);

module.exports = router;
