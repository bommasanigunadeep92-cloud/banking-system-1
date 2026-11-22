/**
 * ============================================================================
 * Input Validation & Sanitization Middleware
 * File: backend/middleware/validation.js
 * ============================================================================
 * Explanation for Viva:
 * Input validation verifies that incoming user data satisfies business and security
 * rules before being processed or inserted into MySQL.
 *
 * It prevents malformed input, XSS vectors, and unexpected errors.
 * Combined with parameterized SQL queries, it provides robust defense in depth.
 */

const { body, validationResult } = require('express-validator');

/**
 * Middleware that inspects validation results and formats errors for client.
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg, // Return the first clear human error
      errors: errors.array()
    });
  }
  next();
}

/**
 * Validation rules for customer registration
 */
const validateRegistration = [
  body('full_name')
    .trim()
    .notEmpty().withMessage('Full name is required.')
    .isLength({ min: 3, max: 100 }).withMessage('Full name must be between 3 and 100 characters.'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email address is required.')
    .isEmail().withMessage('Please provide a valid email address.')
    .normalizeEmail(),

  body('mobile_number')
    .trim()
    .notEmpty().withMessage('Mobile number is required.')
    .matches(/^[0-9+\s-]{8,20}$/).withMessage('Please enter a valid mobile phone number.'),

  body('date_of_birth')
    .trim()
    .notEmpty().withMessage('Date of birth is required.')
    .isISO8601().withMessage('Date of birth must be a valid date (YYYY-MM-DD).'),

  body('address')
    .trim()
    .notEmpty().withMessage('Address is required.')
    .isLength({ min: 5, max: 255 }).withMessage('Address must be between 5 and 255 characters.'),

  body('username')
    .trim()
    .notEmpty().withMessage('Username is required.')
    .isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters.')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores.'),

  body('password')
    .notEmpty().withMessage('Password is required.')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),

  body('confirm_password')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password.');
      }
      return true;
    }),

  handleValidationErrors
];

/**
 * Validation rules for customer login
 */
const validateLogin = [
  body('username_or_email')
    .trim()
    .notEmpty().withMessage('Please enter your username or email address.'),

  body('password')
    .notEmpty().withMessage('Please enter your password.'),

  handleValidationErrors
];

/**
 * Validation rules for depositing money
 */
const validateDeposit = [
  body('amount')
    .notEmpty().withMessage('Deposit amount is required.')
    .isFloat({ min: 1.00, max: 1000000.00 }).withMessage('Deposit amount must be between $1.00 and $1,000,000.00.'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Description must be 100 characters or less.'),

  handleValidationErrors
];

/**
 * Validation rules for withdrawing money
 */
const validateWithdraw = [
  body('amount')
    .notEmpty().withMessage('Withdrawal amount is required.')
    .isFloat({ min: 1.00, max: 1000000.00 }).withMessage('Withdrawal amount must be between $1.00 and $1,000,000.00.'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Description must be 100 characters or less.'),

  handleValidationErrors
];

/**
 * Validation rules for transferring money
 */
const validateTransfer = [
  body('receiver_account_number')
    .trim()
    .notEmpty().withMessage('Receiver account number is required.')
    .isLength({ min: 8, max: 20 }).withMessage('Receiver account number must be between 8 and 20 digits.')
    .isNumeric().withMessage('Account number must contain only numbers.'),

  body('amount')
    .notEmpty().withMessage('Transfer amount is required.')
    .isFloat({ min: 1.00, max: 500000.00 }).withMessage('Transfer amount must be between $1.00 and $500,000.00.'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Description must be 100 characters or less.'),

  handleValidationErrors
];

/**
 * Validation rules for updating profile
 */
const validateProfileUpdate = [
  body('full_name')
    .trim()
    .notEmpty().withMessage('Full name is required.')
    .isLength({ min: 3, max: 100 }).withMessage('Full name must be between 3 and 100 characters.'),

  body('mobile_number')
    .trim()
    .notEmpty().withMessage('Mobile number is required.')
    .matches(/^[0-9+\s-]{8,20}$/).withMessage('Please enter a valid mobile phone number.'),

  body('address')
    .trim()
    .notEmpty().withMessage('Address is required.')
    .isLength({ min: 5, max: 255 }).withMessage('Address must be between 5 and 255 characters.'),

  handleValidationErrors
];

/**
 * Validation rules for password change
 */
const validateChangePassword = [
  body('current_password')
    .notEmpty().withMessage('Current password is required.'),

  body('new_password')
    .notEmpty().withMessage('New password is required.')
    .isLength({ min: 6 }).withMessage('New password must be at least 6 characters long.'),

  body('confirm_new_password')
    .custom((value, { req }) => {
      if (value !== req.body.new_password) {
        throw new Error('Confirm new password does not match new password.');
      }
      return true;
    }),

  handleValidationErrors
];

module.exports = {
  validateRegistration,
  validateLogin,
  validateDeposit,
  validateWithdraw,
  validateTransfer,
  validateProfileUpdate,
  validateChangePassword
};
