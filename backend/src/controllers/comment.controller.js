const Issue = require('../models/Issue');
const Comment = require('../models/Comment');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getPagination } = require('../utils/helpers');

// GET /issues/:id/comments
exports.getComments = asyncHandler(async (req, res) => {
  if (!(await Issue.exists({ _id: req.params.id }))) throw new ApiError(404, 'Issue not found');
  const { page, limit, skip } = getPagination({ ...req.query, limit: req.query.limit || 20 });
  const filter = { issue: req.params.id };
  const [comments, total] = await Promise.all([
    Comment.find(filter).sort('createdAt').skip(skip).limit(limit).populate('author', 'name role avatar'),
    Comment.countDocuments(filter),
  ]);
  res.json({ success: true, data: comments, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

// POST /issues/:id/comments
exports.addComment = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id).select('_id');
  if (!issue) throw new ApiError(404, 'Issue not found');
  const comment = await Comment.create({ text: req.body.text, issue: issue._id, author: req.user._id });
  await Issue.updateOne({ _id: issue._id }, { $inc: { commentCount: 1 } });
  await comment.populate('author', 'name role avatar');
  res.status(201).json({ success: true, message: 'Comment added', data: comment });
});

// DELETE /comments/:id (author or admin)
exports.deleteComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.id);
  if (!comment) throw new ApiError(404, 'Comment not found');
  if (!comment.author.equals(req.user._id) && req.user.role !== 'admin') throw new ApiError(403, 'Not allowed');
  await comment.deleteOne();
  await Issue.updateOne({ _id: comment.issue, commentCount: { $gt: 0 } }, { $inc: { commentCount: -1 } });
  res.json({ success: true, message: 'Comment deleted' });
});
