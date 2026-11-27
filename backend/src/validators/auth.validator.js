const { body } = require('express-validator');
const { DEPARTMENTS } = require('../config/constants');

const strongPassword = (field) =>
  body(field)
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[A-Za-z])(?=.*\d)/).withMessage('Password must contain a letter and a number');

const email = () => body('email').trim().toLowerCase().isEmail().withMessage('Valid email required');

exports.registerRules = [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
  email(),
  strongPassword('password'),
  body('department').optional({ values: 'falsy' }).isIn(DEPARTMENTS).withMessage('Invalid department'),
];

exports.loginRules = [
  email(),
  body('password').notEmpty().withMessage('Password required'),
];

exports.changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Current password required'),
  strongPassword('newPassword'),
];

exports.profileRules = [
  body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
  body('department').optional({ values: 'falsy' }).isIn(DEPARTMENTS).withMessage('Invalid department'),
  body('phone').optional({ values: 'falsy' }).trim().matches(/^[0-9+\-\s]{7,20}$/).withMessage('Invalid phone number'),
];
