const Issue = require('../models/Issue');
const User = require('../models/User');
const Comment = require('../models/Comment');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const C = require('../config/constants');
const { escapeRegex, getPagination, getSort, removeUploadedFile } = require('../utils/helpers');

const pick = (value, list) => (typeof value === 'string' && list.includes(value) ? value : undefined);

const populateIssue = (q) =>
  q.populate('reportedBy', 'name department avatar').populate('assignedTo', 'name email');

// attach hasUpvoted and strip the raw upvotes array before sending
const shape = (issue, userId) => {
  const obj = issue.toObject ? issue.toObject() : issue;
  obj.hasUpvoted = (obj.upvotes || []).some((id) => String(id) === String(userId));
  delete obj.upvotes;
  return obj;
};

// GET /issues  ?search&status&category&building&department&priority&mine&assignedToMe&assignedTo&sort&page&limit
exports.getIssues = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const q = req.query;
  const filter = {};

  const status = pick(q.status, C.STATUSES); if (status) filter.status = status;
  const category = pick(q.category, C.CATEGORIES); if (category) filter.category = category;
  const building = pick(q.building, C.BUILDINGS); if (building) filter.building = building;
  const department = pick(q.department, C.DEPARTMENTS); if (department) filter.department = department;
  const priority = pick(q.priority, C.PRIORITIES); if (priority) filter.priority = priority;

  if (q.mine === 'true') filter.reportedBy = req.user._id;
  if (q.assignedToMe === 'true') filter.assignedTo = req.user._id;
  if (req.user.role === 'admin' && q.assignedTo === 'none') filter.assignedTo = null;
  else if (req.user.role === 'admin' && typeof q.assignedTo === 'string' && /^[a-f\d]{24}$/i.test(q.assignedTo)) {
    filter.assignedTo = q.assignedTo;
  }

  if (typeof q.search === 'string' && q.search.trim()) {
    const rx = new RegExp(escapeRegex(q.search.trim()), 'i');
    filter.$or = [{ title: rx }, { description: rx }, { location: rx }];
  }

  const sort = getSort(q.sort, ['createdAt', 'updatedAt', 'upvoteCount', 'commentCount']);

  const [issues, total] = await Promise.all([
    populateIssue(Issue.find(filter).select('-statusHistory').sort(sort).skip(skip).limit(limit)),
    Issue.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: issues.map((i) => shape(i, req.user._id)),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// GET /issues/:id
exports.getIssue = asyncHandler(async (req, res) => {
  const issue = await populateIssue(Issue.findById(req.params.id)).populate('statusHistory.changedBy', 'name');
  if (!issue) throw new ApiError(404, 'Issue not found');
  res.json({ success: true, data: shape(issue, req.user._id) });
});

// POST /issues (multipart, optional file field "photo")
exports.createIssue = asyncHandler(async (req, res) => {
  const { title, description, category, building, department, location } = req.body;
  const issue = await Issue.create({
    title, description, category, building, department, location,
    photo: req.file ? `/uploads/${req.file.filename}` : '',
    reportedBy: req.user._id,
    statusHistory: [{ status: 'open', changedBy: req.user._id }],
  });
  res.status(201).json({ success: true, message: 'Issue reported', data: issue });
});

// PUT /issues/:id
//  - owner (student): can edit details while the issue is still "open"
//  - admin: can edit everything, plus status / priority / assignedTo
//  - maintenance: can only change the status of issues assigned to them
exports.updateIssue = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id);
  if (!issue) throw new ApiError(404, 'Issue not found');

  const { role, _id: userId } = req.user;
  const isOwner = issue.reportedBy.equals(userId);
  const isAdmin = role === 'admin';
  const isAssignedStaff = role === 'maintenance' && issue.assignedTo && issue.assignedTo.equals(userId);

  const detailFields = ['title', 'description', 'category', 'building', 'department', 'location'];
  const adminFields = ['priority', 'assignedTo'];
  const touchesDetails = detailFields.some((k) => req.body[k] !== undefined) || !!req.file;
  const touchesAdmin = adminFields.some((k) => req.body[k] !== undefined);
  const touchesStatus = req.body.status !== undefined;

  if (!isAdmin) {
    if (touchesAdmin) throw new ApiError(403, 'Only admins can change priority or assignment');
    if (touchesStatus && !isAssignedStaff) throw new ApiError(403, 'Only admins or assigned staff can change status');
    if (touchesDetails && !(isOwner && issue.status === 'open')) {
      throw new ApiError(403, 'You can only edit your own issues while they are still open');
    }
    if (!isOwner && !isAssignedStaff) throw new ApiError(403, 'Not allowed');
  }

  if (touchesDetails) detailFields.forEach((k) => { if (req.body[k] !== undefined) issue[k] = req.body[k]; });
  if (req.file) {
    removeUploadedFile(issue.photo);
    issue.photo = `/uploads/${req.file.filename}`;
  }

  if (isAdmin) {
    if (req.body.priority !== undefined) issue.priority = req.body.priority;
    if (req.body.assignedTo !== undefined) {
      if (!req.body.assignedTo) issue.assignedTo = null;
      else {
        const staff = await User.findOne({ _id: req.body.assignedTo, role: 'maintenance', isActive: true });
        if (!staff) throw new ApiError(400, 'Assigned user must be an active maintenance staff member');
        issue.assignedTo = staff._id;
      }
    }
  }

  if (touchesStatus && req.body.status !== issue.status) {
    issue.status = req.body.status;
    issue.resolvedAt = issue.status === 'resolved' ? new Date() : undefined;
    issue.statusHistory.push({ status: issue.status, changedBy: userId });
  }

  await issue.save();
  const populated = await populateIssue(Issue.findById(issue._id));
  res.json({ success: true, message: 'Issue updated', data: shape(populated, userId) });
});

// DELETE /issues/:id  (owner or admin)
exports.deleteIssue = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id);
  if (!issue) throw new ApiError(404, 'Issue not found');
  const isOwner = issue.reportedBy.equals(req.user._id);
  if (!isOwner && req.user.role !== 'admin') throw new ApiError(403, 'Not allowed');
  removeUploadedFile(issue.photo);
  await Comment.deleteMany({ issue: issue._id });
  await issue.deleteOne();
  res.json({ success: true, message: 'Issue deleted' });
});

// POST /issues/:id/upvote  -> toggles. Atomic ($addToSet + condition) so duplicates are impossible.
exports.toggleUpvote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const issue = await Issue.findById(id).select('reportedBy');
  if (!issue) throw new ApiError(404, 'Issue not found');
  if (issue.reportedBy.equals(userId)) throw new ApiError(400, 'You cannot upvote your own issue');

  let updated = await Issue.findOneAndUpdate(
    { _id: id, upvotes: { $ne: userId } },
    { $addToSet: { upvotes: userId }, $inc: { upvoteCount: 1 } },
    { new: true }
  );
  let upvoted = true;
  if (!updated) {
    updated = await Issue.findOneAndUpdate(
      { _id: id, upvotes: userId },
      { $pull: { upvotes: userId }, $inc: { upvoteCount: -1 } },
      { new: true }
    );
    upvoted = false;
  }
  res.json({ success: true, data: { upvoted, upvoteCount: updated ? updated.upvoteCount : 0 } });
});
