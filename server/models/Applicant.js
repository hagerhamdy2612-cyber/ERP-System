const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema(
  {
    date: { type: Date },
    time: { type: String, trim: true },
    type: { type: String, enum: ['online', 'offline'] },
    notes: { type: String, trim: true }
  },
  { _id: false }
);

const applicantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [200, 'Name cannot exceed 200 characters']
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      trim: true,
      maxlength: [40, 'Phone cannot exceed 40 characters']
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: [200, 'Email cannot exceed 200 characters']
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      default: null
    },
    jobTitle: {
      type: String,
      trim: true,
      maxlength: [200, 'Job title cannot exceed 200 characters']
    },
    status: {
      type: String,
      enum: ['pending', 'contacted', 'interview', 'accepted', 'rejected'],
      default: 'pending'
    },
    source: {
      type: String,
      enum: ['WhatsApp', 'Facebook', 'Referral', 'Walk-in', 'Other']
    },
    cv: {
      type: String,
      trim: true,
      default: ''
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [10000, 'Notes cannot exceed 10000 characters']
    },
    interview: {
      type: interviewSchema,
      default: undefined
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Applicant', applicantSchema);
