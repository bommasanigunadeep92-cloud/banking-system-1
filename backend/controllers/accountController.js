/**
 * ============================================================================
 * Bank Account Controller
 * File: backend/controllers/accountController.js
 * ============================================================================
 * Explanation for Viva:
 * Fetches account information, real-time balance calculations, and provides
 * safe beneficiary verification before a money transfer is finalized.
 */

const { pool } = require('../config/db');

/**
 * Get account details for logged-in customer
 * Route: GET /api/accounts/my-account
 */
async function getMyAccount(req, res) {
  try {
    const customerId = req.customer.customer_id;

    const [rows] = await pool.query(
      `SELECT 
         a.account_id, a.account_number, a.account_type, a.balance, a.account_status, a.created_at,
         c.full_name, c.email, c.mobile_number, c.address
       FROM accounts a
       JOIN customers c ON a.customer_id = c.customer_id
       WHERE a.customer_id = ?
       LIMIT 1`,
      [customerId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active account found for this customer.'
      });
    }

    return res.status(200).json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('[getMyAccount Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve account details.'
    });
  }
}

/**
 * Get current balance for quick polling/refreshing
 * Route: GET /api/accounts/balance
 */
async function getBalance(req, res) {
  try {
    const accountId = req.account.account_id;

    const [rows] = await pool.query(
      'SELECT balance, account_status FROM accounts WHERE account_id = ? LIMIT 1',
      [accountId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Account not found.'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        balance: parseFloat(rows[0].balance),
        account_status: rows[0].account_status
      }
    });
  } catch (error) {
    console.error('[getBalance Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve balance.'
    });
  }
}

/**
 * Verify beneficiary account number before executing a transfer
 * Route: GET /api/accounts/verify-beneficiary/:accountNumber
 */
async function verifyBeneficiary(req, res) {
  const { accountNumber } = req.params;
  const senderAccountNumber = req.account.account_number;

  // Prevent transfers to own account
  if (accountNumber === senderAccountNumber) {
    return res.status(400).json({
      success: false,
      message: 'Self-transfers are not allowed. Please enter a different receiver account number.'
    });
  }

  try {
    const [rows] = await pool.query(
      `SELECT 
         a.account_number, a.account_status,
         c.full_name
       FROM accounts a
       JOIN customers c ON a.customer_id = c.customer_id
       WHERE a.account_number = ?
       LIMIT 1`,
      [accountNumber]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Receiver account number does not exist.'
      });
    }

    const receiver = rows[0];

    if (receiver.account_status !== 'Active') {
      return res.status(400).json({
        success: false,
        message: `Receiver account is currently ${receiver.account_status} and cannot receive funds.`
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        account_number: receiver.account_number,
        receiver_name: receiver.full_name
      }
    });
  } catch (error) {
    console.error('[verifyBeneficiary Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify beneficiary account.'
    });
  }
}

module.exports = {
  getMyAccount,
  getBalance,
  verifyBeneficiary
};
