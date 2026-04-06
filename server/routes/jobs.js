const express = require('express');
const { body, validationResult } = require('express-validator');
const { protect, authorizeHRRecruitment } = require('../middleware/auth');
const jobController = require('../controllers/jobController');

const router = express.Router();

router.use(protect, authorizeHRRecruitment);

router.get('/', jobController.listJobs);

const validateJobCreate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

router.post(
  '/',
  [
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Title is required')
      .isLength({ max: 200 })
      .withMessage('Title is too long'),
    body('department').optional().trim().isLength({ max: 100 }),
    body('description').optional().trim().isLength({ max: 5000 }),
    body('isOpen').optional().isBoolean()
  ],
  validateJobCreate,
  jobController.createJob
);

module.exports = router;
