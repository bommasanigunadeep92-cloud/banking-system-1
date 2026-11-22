/**
 * ============================================================================
 * Authentication Routes
 * File: backend/routes/authRoutes.js
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const { loginLimiter, apiLimiter } = require('../middleware/rateLimiter');
const { validateRegistration, validateLogin } = require('../middleware/validation');

// Register customer and create account
router.post('/register', apiLimiter, validateRegistration, authController.register);

// Login customer
router.post('/login', loginLimiter, validateLogin, authController.login);

// Logout customer
router.post('/logout', authController.logout);

// Get current session data
router.get('/me', requireAuth, authController.getMe);

// Demo password reset
router.post('/reset-password-demo', apiLimiter, authController.resetPasswordDemo);

module.exports = router;
