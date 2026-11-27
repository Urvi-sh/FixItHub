const { body } = require('express-validator');
const { CATEGORIES, BUILDINGS, DEPARTMENTS, STATUSES, PRIORITIES } = require('../config/constants');

exports.createIssueRules = [
  body('title').trim().isLength({ min: 5, max: 100 }).withMessage('Title must be 5-100 characters'),
  body('description').trim().isLength({ min: 10, max: 1000 }).withMessage('Description must be 10-1000 characters'),
  body('category').isIn(CATEGORIES).withMessage('Invalid category'),
  body('building').isIn(BUILDINGS).withMessage('Invalid building'),
  body('department').isIn(DEPARTMENTS).withMessage('Invalid department'),
  body('location').optional({ values: 'falsy' }).trim().isLength({ max: 100 }).withMessage('Location is too long'),
];

// every field optional on update; role checks happen in the controller
exports.updateIssueRules = [
  body('title').optional().trim().isLength({ min: 5, max: 100 }).withMessage('Title must be 5-100 characters'),
  body('description').optional().trim().isLength({ min: 10, max: 1000 }).withMessage('Description must be 10-1000 characters'),
  body('category').optional().isIn(CATEGORIES).withMessage('Invalid category'),
  body('building').optional().isIn(BUILDINGS).withMessage('Invalid building'),
  body('department').optional().isIn(DEPARTMENTS).withMessage('Invalid department'),
  body('location').optional({ values: 'falsy' }).trim().isLength({ max: 100 }).withMessage('Location is too long'),
  body('status').optional().isIn(STATUSES).withMessage('Invalid status'),
  body('priority').optional().isIn(PRIORITIES).withMessage('Invalid priority'),
  body('assignedTo').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid staff id'),
];

exports.commentRules = [
  body('text').trim().isLength({ min: 1, max: 500 }).withMessage('Comment must be 1-500 characters'),
];
