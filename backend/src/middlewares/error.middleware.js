const multer = require('multer');
const ApiError = require('../utils/ApiError');

exports.notFound = (req, res, next) => next(new ApiError(404, `Route not found: ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars
exports.errorHandler = (err, req, res, next) => {
  let status = err.statusCode || 500;
  let message = err.message || 'Server error';
  let errors = err.errors || [];

  if (err.name === 'ValidationError') {
    status = 400;
    errors = Object.values(err.errors).map((e) => ({ field: e.path, msg: e.message }));
    message = errors.map((e) => e.msg).join(', ');
  }
  if (err.code === 11000) {
    status = 409;
    message = `${Object.keys(err.keyValue || { value: 1 })[0]} already exists`;
  }
  if (err.name === 'CastError') { status = 400; message = 'Invalid ID format'; }
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    status = 401; message = 'Invalid or expired token';
  }
  if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 3 MB)' : err.message;
  }
  if (err.type === 'entity.too.large') { status = 413; message = 'Request body too large'; }
  if (err.type === 'entity.parse.failed') { status = 400; message = 'Invalid JSON body'; }

  if (status >= 500) console.error(err);

  res.status(status).json({
    success: false,
    message: status >= 500 && process.env.NODE_ENV === 'production' ? 'Server error' : message,
    errors,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};
