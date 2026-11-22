/**
 * ============================================================================
 * Transactions Routes
 * File: backend/routes/transactionRoutes.js
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { requireAuth } = require('../middleware/authMiddleware');
const { validateDeposit, validateWithdraw, validateTransfer } = require('../middleware/validation');

// All transaction routes require active session
router.use(requireAuth);

// Deposit money
router.post('/deposit', validateDeposit, transactionController.deposit);

// Withdraw money
router.post('/withdraw', validateWithdraw, transactionController.withdraw);

// Transfer money
router.post('/transfer', validateTransfer, transactionController.transfer);

// Get paginated transaction history
router.get('/history', transactionController.getHistory);

// Export CSV statement
router.get('/export-csv', transactionController.exportCsv);

// Get single transaction by ID
router.get('/:id', transactionController.getTransactionById);

module.exports = router;
