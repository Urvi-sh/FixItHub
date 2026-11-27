const Issue = require('../models/Issue');
const asyncHandler = require('../utils/asyncHandler');
const C = require('../config/constants');

const pick = (value, list) => (typeof value === 'string' && list.includes(value) ? value : undefined);
const toMap = (rows, keys) => keys.map((k) => ({ _id: k, count: (rows.find((r) => r._id === k) || {}).count || 0 }));

// GET /dashboard/stats
// admin  -> analytics for ALL issues (optional filters: building, category, department)
// others -> analytics for their own reported issues
exports.getStats = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const match = isAdmin ? {} : { reportedBy: req.user._id };
  if (isAdmin) {
    const allowed = { building: C.BUILDINGS, category: C.CATEGORIES, department: C.DEPARTMENTS };
    Object.keys(allowed).forEach((k) => {
      const v = pick(req.query[k], allowed[k]);
      if (v) match[k] = v;
    });
  }

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const group = (field) => [{ $group: { _id: `$${field}`, count: { $sum: 1 } } }, { $sort: { count: -1 } }];

  const [r] = await Issue.aggregate([
    { $match: match },
    {
      $facet: {
        byStatus: group('status'),
        byCategory: group('category'),
        byBuilding: group('building'),
        byPriority: group('priority'),
        monthly: [
          { $match: { createdAt: { $gte: sixMonthsAgo } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
              reported: { $sum: 1 },
              resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
            },
          },
          { $sort: { _id: 1 } },
        ],
        unassigned: [{ $match: { assignedTo: null, status: { $ne: 'resolved' } } }, { $count: 'count' }],
        avgResolution: [
          { $match: { status: 'resolved', resolvedAt: { $exists: true } } },
          { $group: { _id: null, ms: { $avg: { $subtract: ['$resolvedAt', '$createdAt'] } } } },
        ],
      },
    },
  ]);

  const byStatus = toMap(r.byStatus, C.STATUSES);
  const total = byStatus.reduce((s, x) => s + x.count, 0);
  const recent = await Issue.find(match).sort('-createdAt').limit(5).select('title status priority category createdAt');

  res.json({
    success: true,
    data: {
      total,
      byStatus,
      byCategory: r.byCategory,
      byBuilding: r.byBuilding,
      byPriority: r.byPriority,
      monthly: r.monthly,
      unassigned: r.unassigned[0] ? r.unassigned[0].count : 0,
      avgResolutionHours: r.avgResolution[0] ? Math.round((r.avgResolution[0].ms / 36e5) * 10) / 10 : null,
      recent,
    },
  });
});
