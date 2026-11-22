/**
 * ============================================================================
 * Customer Profile Controller
 * File: backend/controllers/customerController.js
 * ============================================================================
 * Explanation for Viva:
 * Allows customers to view and update permitted contact information (name, phone, address).
 * Strictly forbids customers from directly modifying balances, account numbers,
 * or other customer IDs.
 */

const bcrypt = require('bcrypt');
const { pool } = require('../config/db');

const SALT_ROUNDS = 10;

/**
 * Get customer profile information
 * Route: GET /api/customers/profile
 */
async function getProfile(req, res) {
  try {
    const customerId = req.customer.customer_id;

    const [rows] = await pool.query(
      `SELECT 
         c.customer_id, c.full_name, c.email, c.mobile_number, c.date_of_birth, c.address, c.username, c.created_at,
         a.account_id, a.account_number, a.account_type, a.balance, a.account_status, a.created_at AS account_opening_date
       FROM customers c
       JOIN accounts a ON c.customer_id = a.customer_id
       WHERE c.customer_id = ?
       LIMIT 1`,
      [customerId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found.'
      });
    }

    return res.status(200).json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('[getProfile Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve profile data.'
    });
  }
}

/**
 * Update permitted profile information
 * Route: PUT /api/customers/profile
 */
async function updateProfile(req, res) {
  const { full_name, mobile_number, address } = req.body;
  const customerId = req.customer.customer_id;

  try {
    await pool.query(
      `UPDATE customers 
       SET full_name = ?, mobile_number = ?, address = ?
       WHERE customer_id = ?`,
      [full_name, mobile_number, address, customerId]
    );

    return res.status(200).json({
      success: true,
      message: 'Profile information updated successfully!',
      data: {
        full_name,
        mobile_number,
        address
      }
    });
  } catch (error) {
    console.error('[updateProfile Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile details.'
    });
  }
}

/**
 * Change customer password
 * Route: PUT /api/customers/change-password
 */
async function changePassword(req, res) {
  const { current_password, new_password } = req.body;
  const customerId = req.customer.customer_id;

  try {
    // 1. Fetch current password hash from database
    const [rows] = await pool.query(
      'SELECT password_hash FROM customers WHERE customer_id = ? LIMIT 1',
      [customerId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found.'
      });
    }

    // 2. Verify current password matches
    const isMatch = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password does not match our records.'
      });
    }

    // 3. Hash the new password
    const newHash = await bcrypt.hash(new_password, SALT_ROUNDS);

    // 4. Update the password hash in MySQL
    await pool.query(
      'UPDATE customers SET password_hash = ? WHERE customer_id = ?',
      [newHash, customerId]
    );

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully! Please remember your new password.'
    });
  } catch (error) {
    console.error('[changePassword Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update password.'
    });
  }
}

module.exports = {
  getProfile,
  updateProfile,
  changePassword
};
