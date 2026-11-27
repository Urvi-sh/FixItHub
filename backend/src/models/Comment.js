const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    text: { type: String, required: [true, 'Comment cannot be empty'], trim: true, maxlength: 500 },
    issue: { type: mongoose.Schema.Types.ObjectId, ref: 'Issue', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

commentSchema.index({ issue: 1, createdAt: 1 });

module.exports = mongoose.model('Comment', commentSchema);
