/**
 * ============================================================================
 * Authentication & Authorization Middleware
 * File: backend/middleware/authMiddleware.js
 * ============================================================================
 * Explanation for Viva:
 * This middleware checks if a request is authenticated via an active session.
 * It verifies that `req.session.customer` exists and automatically fetches
 * the customer's verified bank account from MySQL.
 *
 * This completely prevents "Broken Access Control" vulnerabilities (OWASP #1)
 * because controllers will never trust customer IDs or account IDs provided
 * in request parameters or body. The server authoritative session dictates
 * ownership.
 */

const { pool } = require('../config/db');

async function requireAuth(req, res, next) {
  try {
    // 1. Check if user session exists
    if (!req.session || !req.session.customer || !req.session.customer.customer_id) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. You must be logged in to perform this action.',
        requireLogin: true
      });
    }

    const customerId = req.session.customer.customer_id;

    // 2. Fetch fresh customer and account data from MySQL
    const [rows] = await pool.query(
      `SELECT 
         c.customer_id, c.full_name, c.email, c.mobile_number, c.date_of_birth, c.address, c.username,
         a.account_id, a.account_number, a.account_type, a.balance, a.account_status, a.created_at AS account_created_at
       FROM customers c
       JOIN accounts a ON c.customer_id = a.customer_id
       WHERE c.customer_id = ?
       LIMIT 1`,
      [customerId]
    );

    if (rows.length === 0) {
      // Invalidate invalid session
      req.session.destroy();
      return res.status(401).json({
        success: false,
        message: 'Customer account not found or has been deactivated.',
        requireLogin: true
      });
    }

    const record = rows[0];

    // Check if account is suspended or closed
    if (record.account_status !== 'Active') {
      return res.status(403).json({
        success: false,
        message: `Account is currently ${record.account_status}. Please contact bank support.`
      });
    }

    // Attach authenticated entities to the Express request object
    req.customer = {
      customer_id: record.customer_id,
      full_name: record.full_name,
      email: record.email,
      mobile_number: record.mobile_number,
      date_of_birth: record.date_of_birth,
      address: record.address,
      username: record.username
    };

    req.account = {
      account_id: record.account_id,
      account_number: record.account_number,
      account_type: record.account_type,
      balance: parseFloat(record.balance),
      account_status: record.account_status,
      created_at: record.account_created_at
    };

    next();
  } catch (error) {
    console.error('[authMiddleware Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error verifying session authentication.'
    });
  }
}

module.exports = {
  requireAuth
};
