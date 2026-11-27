const fs = require('fs');
const path = require('path');

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Safe pagination numbers: page >= 1, 1 <= limit <= 50
const getPagination = (query) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 50);
  return { page, limit, skip: (page - 1) * limit };
};

// Only allow sorting on known fields (prevents sorting by arbitrary/sensitive fields)
const getSort = (sort, allowed, fallback = '-createdAt') => {
  const clean = String(sort || fallback)
    .split(',')
    .filter((f) => allowed.includes(f.replace(/^-/, '')))
    .join(' ');
  return clean || fallback;
};

const removeUploadedFile = (publicPath) => {
  if (!publicPath || !publicPath.startsWith('/uploads/')) return;
  const file = path.join(__dirname, '..', '..', 'uploads', path.basename(publicPath));
  fs.unlink(file, () => {});
};

module.exports = { escapeRegex, getPagination, getSort, removeUploadedFile };
