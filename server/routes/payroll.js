const express = require('express');
const { protect, authorizeAdminOrHR } = require('../middleware/auth');
const payrollController = require('../controllers/payrollController');

const router = express.Router();

router.use(protect, authorizeAdminOrHR);

router.get('/', payrollController.listPayroll);
router.get('/:id', payrollController.getPayrollById);
router.post('/', payrollController.createPayroll);
router.put('/:id', payrollController.updatePayroll);
router.delete('/:id', payrollController.deletePayroll);

module.exports = router;
