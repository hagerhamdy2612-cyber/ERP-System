const Job = require('../models/Job');

exports.listJobs = async (req, res) => {
  try {
    const openOnly = req.query.all !== 'true';
    const filter = openOnly ? { isOpen: true } : {};
    const jobs = await Job.find(filter).sort({ title: 1 }).lean();
    res.json({ success: true, count: jobs.length, data: jobs });
  } catch (error) {
    console.error('listJobs error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createJob = async (req, res) => {
  try {
    const { title, department, description, isOpen } = req.body;
    const job = await Job.create({
      title,
      department,
      description,
      isOpen: isOpen !== undefined ? Boolean(isOpen) : true
    });
    res.status(201).json({ success: true, data: job });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const msg = Object.values(error.errors)
        .map((e) => e.message)
        .join(', ');
      return res.status(400).json({ success: false, message: msg });
    }
    console.error('createJob error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
