const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ApiError = require('../utils/ApiError');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// extension comes from the verified mime type, never from the user's file name
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${EXT[file.mimetype]}`),
});

const fileFilter = (req, file, cb) => {
  if (EXT[file.mimetype]) return cb(null, true);
  cb(new ApiError(400, 'Only JPG, PNG or WEBP images are allowed'));
};

module.exports = multer({ storage, fileFilter, limits: { fileSize: 3 * 1024 * 1024, files: 1 } });
