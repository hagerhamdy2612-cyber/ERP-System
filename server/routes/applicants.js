const express = require('express');
const applicantController = require('../controllers/applicantController');
const { protect, authorizeHRRecruitment } = require('../middleware/auth');
const upload = require('../middleware/uploadApplicantCv');

const router = express.Router();

router.use(protect, authorizeHRRecruitment);

function uploadCvMiddleware(req, res, next) {
  upload.single('cv')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
}

router.post('/', uploadCvMiddleware, applicantController.createApplicant);
router.get('/', applicantController.getApplicants);
router.get('/:id', applicantController.getApplicantById);
router.patch('/:id/status', applicantController.updateApplicantStatus);
router.patch('/:id/interview', applicantController.updateApplicantInterview);
router.delete('/:id', applicantController.deleteApplicant);

module.exports = router;
