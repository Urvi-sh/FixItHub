const C = require('../config/constants');

// GET /meta -> dropdown options so the frontend never hardcodes them
exports.getMeta = (req, res) => {
  res.json({
    success: true,
    data: {
      statuses: C.STATUSES, priorities: C.PRIORITIES, categories: C.CATEGORIES,
      buildings: C.BUILDINGS, departments: C.DEPARTMENTS, roles: C.ROLES,
    },
  });
};
