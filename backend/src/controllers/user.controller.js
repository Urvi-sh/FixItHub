const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ROLES } = require('../config/constants');
const { escapeRegex, getPagination, removeUploadedFile } = require('../utils/helpers');

// PUT /users/profile  (multipart: name, department, phone, avatar)
exports.updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  ['name', 'department', 'phone'].forEach((k) => {
    if (req.body[k] !== undefined) user[k] = req.body[k];
  });
  if (req.file) {
    removeUploadedFile(user.avatar);
    user.avatar = `/uploads/${req.file.filename}`;
  }
  await user.save();
  res.json({
    success: true, message: 'Profile updated',
    data: { id: user._id, name: user.name, email: user.email, role: user.role,
      department: user.department, phone: user.phone, avatar: user.avatar },
  });
});

// GET /users (admin)  ?search=&role=&page=&limit=
exports.getUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (typeof req.query.role === 'string' && ROLES.includes(req.query.role)) filter.role = req.query.role;
  if (typeof req.query.search === 'string' && req.query.search.trim()) {
    const rx = new RegExp(escapeRegex(req.query.search.trim()), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const [users, total] = await Promise.all([
    User.find(filter).sort('-createdAt').skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, data: users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

// GET /users/staff (admin) -> active maintenance personnel for the assign dropdown
exports.getStaff = asyncHandler(async (req, res) => {
  const staff = await User.find({ role: 'maintenance', isActive: true }).select('name email').sort('name');
  res.json({ success: true, data: staff });
});

// PUT /users/:id/role (admin)
exports.updateRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!ROLES.includes(role)) throw new ApiError(400, 'Invalid role');
  if (req.params.id === String(req.user._id)) throw new ApiError(400, 'You cannot change your own role');
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  user.role = role;
  await user.save();
  res.json({ success: true, message: 'Role updated', data: user });
});

// PUT /users/:id/status (admin) body: { isActive: true|false }
exports.updateStatus = asyncHandler(async (req, res) => {
  if (typeof req.body.isActive !== 'boolean') throw new ApiError(400, 'isActive must be true or false');
  if (req.params.id === String(req.user._id)) throw new ApiError(400, 'You cannot deactivate yourself');
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  user.isActive = req.body.isActive;
  await user.save();
  res.json({ success: true, message: user.isActive ? 'User activated' : 'User deactivated', data: user });
});

// DELETE /users/:id (admin) -> soft delete (deactivate) so issues keep their reporter
exports.deleteUser = asyncHandler(async (req, res) => {
  if (req.params.id === String(req.user._id)) throw new ApiError(400, 'You cannot delete yourself');
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  user.isActive = false;
  await user.save();
  res.json({ success: true, message: 'User deactivated' });
});
