/**
 * ============================================================================
 * Customer Profile Routes
 * File: backend/routes/customerRoutes.js
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { requireAuth } = require('../middleware/authMiddleware');
const { validateProfileUpdate, validateChangePassword } = require('../middleware/validation');

// All customer routes require active session
router.use(requireAuth);

// Get current profile
router.get('/profile', customerController.getProfile);

// Update permitted profile info
router.put('/profile', validateProfileUpdate, customerController.updateProfile);

// Change password
router.put('/change-password', validateChangePassword, customerController.changePassword);

module.exports = router;
