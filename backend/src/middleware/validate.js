const { validationResult, body, param, query } = require('express-validator');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const list = errors.array({ onlyFirstError: true });
    const first = list[0];
    const err = new Error(first?.msg || 'Invalid input');
    err.statusCode = 400;
    err.errors = list;
    return next(err);
  }
  return next();
}

const loginRules = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isString().isLength({ min: 6, max: 128 }).withMessage('Password is required'),
];

const registerRules = [
  body('name').trim().isLength({ min: 1, max: 120 }).withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password')
    .isString()
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be at least 8 characters'),
  body('businessName').optional().trim().isLength({ max: 160 }),
  body('businessCategory').optional().trim().isLength({ max: 60 }),
];

const idParam = [param('id').isString().isLength({ min: 1, max: 64 }).withMessage('Invalid id')];

const searchQuery = [
  query('search').optional().isString().isLength({ max: 120 }),
  query('status').optional().isString().isLength({ max: 40 }),
];

module.exports = {
  validate,
  body,
  param,
  query,
  loginRules,
  registerRules,
  idParam,
  searchQuery,
};
