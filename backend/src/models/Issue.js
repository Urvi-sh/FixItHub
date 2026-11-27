const mongoose = require('mongoose');
const { STATUSES, PRIORITIES, CATEGORIES, BUILDINGS, DEPARTMENTS } = require('../config/constants');

const issueSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, minlength: 5, maxlength: 100 },
    description: { type: String, required: [true, 'Description is required'], trim: true, minlength: 10, maxlength: 1000 },
    category: { type: String, enum: CATEGORIES, required: [true, 'Category is required'] },
    building: { type: String, enum: BUILDINGS, required: [true, 'Building is required'] },
    department: { type: String, enum: DEPARTMENTS, required: [true, 'Department is required'] },
    location: { type: String, trim: true, maxlength: 100, default: '' }, // room / floor
    status: { type: String, enum: STATUSES, default: 'open' },
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    photo: { type: String, default: '' },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    upvoteCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    resolvedAt: Date,
    statusHistory: [
      {
        status: { type: String, enum: STATUSES },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        changedAt: { type: Date, default: Date.now },
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

issueSchema.index({ reportedBy: 1, status: 1 });
issueSchema.index({ status: 1, category: 1, building: 1, department: 1 });
issueSchema.index({ assignedTo: 1 });
issueSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Issue', issueSchema);
