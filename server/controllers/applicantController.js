const mongoose = require('mongoose');
const Applicant = require('../models/Applicant');
const { isValidPhone, PHONE_VALIDATION_MESSAGE } = require('../utils/phoneValidation');

const STATUS_VALUES = ['pending', 'contacted', 'interview', 'accepted', 'rejected'];
const SOURCE_VALUES = ['WhatsApp', 'Facebook', 'Referral', 'Walk-in', 'Other'];
const INTERVIEW_TYPES = ['online', 'offline'];

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

exports.createApplicant = async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const phone = (req.body.phone || '').trim();
    const emailRaw = (req.body.email || '').trim();
    const jobTitleRaw = (req.body.jobTitle || '').trim();
    const source = req.body.source;
    const notes = (req.body.notes || '').trim();

    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone is required' });
    }
    if (!isValidPhone(phone)) {
      return res.status(400).json({ success: false, message: PHONE_VALIDATION_MESSAGE });
    }
    if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }
    if (source && !SOURCE_VALUES.includes(source)) {
      return res.status(400).json({
        success: false,
        message: `Source must be one of: ${SOURCE_VALUES.join(', ')}`
      });
    }

    let cv = '';
    if (req.file) {
      cv = `/uploads/cvs/${req.file.filename}`;
    }

    const applicant = await Applicant.create({
      name,
      phone,
      email: emailRaw || undefined,
      jobTitle: jobTitleRaw || undefined,
      source: source || undefined,
      notes: notes || undefined,
      cv
    });

    const data = await Applicant.findById(applicant._id).lean();

    res.status(201).json({ success: true, data });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const msg = Object.values(error.errors)
        .map((e) => e.message)
        .join(', ');
      return res.status(400).json({ success: false, message: msg });
    }
    console.error('createApplicant error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getApplicants = async (req, res) => {
  try {
    const { status, jobTitle, source, search } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));

    const filter = {};
    if (status) {
      if (!STATUS_VALUES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Allowed: ${STATUS_VALUES.join(', ')}`
        });
      }
      filter.status = status;
    }
    if (jobTitle && String(jobTitle).trim()) {
      const jq = escapeRegex(String(jobTitle).trim());
      filter.jobTitle = { $regex: jq, $options: 'i' };
    }
    if (source) {
      if (!SOURCE_VALUES.includes(source)) {
        return res.status(400).json({
          success: false,
          message: `Invalid source. Allowed: ${SOURCE_VALUES.join(', ')}`
        });
      }
      filter.source = source;
    }
    if (search && String(search).trim()) {
      const q = escapeRegex(String(search).trim());
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
        { jobTitle: { $regex: q, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const [total, applicants] = await Promise.all([
      Applicant.countDocuments(filter),
      Applicant.find(filter)
        .populate('jobId', 'title department isOpen')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);

    res.json({
      success: true,
      count: applicants.length,
      data: applicants,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    console.error('getApplicants error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getApplicantById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid applicant id' });
    }
    const applicant = await Applicant.findById(req.params.id)
      .populate('jobId', 'title department description isOpen')
      .lean();

    if (!applicant) {
      return res.status(404).json({ success: false, message: 'Applicant not found' });
    }

    res.json({ success: true, data: applicant });
  } catch (error) {
    console.error('getApplicantById error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateApplicantStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !STATUS_VALUES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status is required and must be one of: ${STATUS_VALUES.join(', ')}`
      });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid applicant id' });
    }

    const applicant = await Applicant.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    )
      .populate('jobId', 'title department isOpen')
      .lean();

    if (!applicant) {
      return res.status(404).json({ success: false, message: 'Applicant not found' });
    }

    res.json({ success: true, data: applicant });
  } catch (error) {
    console.error('updateApplicantStatus error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateApplicantInterview = async (req, res) => {
  try {
    const { date, time, type, notes } = req.body;

    if (type !== undefined && type !== null && type !== '' && !INTERVIEW_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Interview type must be one of: ${INTERVIEW_TYPES.join(', ')}`
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid applicant id' });
    }

    const applicant = await Applicant.findById(req.params.id);
    if (!applicant) {
      return res.status(404).json({ success: false, message: 'Applicant not found' });
    }

    const existing = applicant.interview
      ? typeof applicant.interview.toObject === 'function'
        ? applicant.interview.toObject()
        : { ...applicant.interview }
      : {};

    const next = { ...existing };

    if (date !== undefined) {
      if (date === '' || date === null) {
        next.date = undefined;
      } else {
        const d = new Date(date);
        if (Number.isNaN(d.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid interview date' });
        }
        next.date = d;
      }
    }
    if (time !== undefined) {
      next.time = time ? String(time).trim() : '';
    }
    if (type !== undefined) {
      next.type = type === '' ? undefined : type;
    }
    if (notes !== undefined) {
      next.notes = notes ? String(notes).trim() : '';
    }

    applicant.interview = next;

    await applicant.save();
    const fresh = await Applicant.findById(applicant._id)
      .populate('jobId', 'title department isOpen')
      .lean();

    res.json({ success: true, data: fresh });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const msg = Object.values(error.errors)
        .map((e) => e.message)
        .join(', ');
      return res.status(400).json({ success: false, message: msg });
    }
    console.error('updateApplicantInterview error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteApplicant = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid applicant id' });
    }
    const applicant = await Applicant.findByIdAndDelete(req.params.id);
    if (!applicant) {
      return res.status(404).json({ success: false, message: 'Applicant not found' });
    }
    res.json({ success: true, message: 'Applicant deleted', data: { _id: applicant._id } });
  } catch (error) {
    console.error('deleteApplicant error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
