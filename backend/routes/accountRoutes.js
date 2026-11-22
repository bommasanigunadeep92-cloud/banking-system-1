/**
 * ============================================================================
 * Account Routes
 * File: backend/routes/accountRoutes.js
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');
const { requireAuth } = require('../middleware/authMiddleware');

// All account routes require active session
router.use(requireAuth);

// Get my bank account details
router.get('/my-account', accountController.getMyAccount);

// Get real-time balance
router.get('/balance', accountController.getBalance);

// Lookup beneficiary account details before transfer
router.get('/verify-beneficiary/:accountNumber', accountController.verifyBeneficiary);

module.exports = router;
