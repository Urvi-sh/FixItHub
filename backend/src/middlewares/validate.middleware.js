const { validationResult } = require('express-validator');
const { removeUploadedFile } = require('../utils/helpers');

module.exports = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  // validation failed -> do not keep an uploaded file around
  if (req.file) removeUploadedFile(`/uploads/${req.file.filename}`);

  res.status(400).json({
    success: false,
    message: 'Validation failed',
    errors: result.array().map((e) => ({ field: e.path, msg: e.msg })),
  });
};
