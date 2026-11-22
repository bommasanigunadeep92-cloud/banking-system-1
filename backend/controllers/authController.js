/**
 * ============================================================================
 * Authentication Controller
 * File: backend/controllers/authController.js
 * ============================================================================
 * Explanation for Viva:
 * Handles user onboarding (registration with automatic account generation),
 * credential authentication using bcrypt, session creation, and secure logout.
 */

const bcrypt = require('bcrypt');
const { pool } = require('../config/db');
const { generateAccountNumber, generateReferenceNumber, sanitizeCustomer } = require('../utils/helpers');

const SALT_ROUNDS = 10;
const INITIAL_DEMO_BALANCE = 1000.00; // Demo opening balance for quick testing

/**
 * Register a new customer and automatically open a bank account
 * Route: POST /api/auth/register
 */
async function register(req, res) {
  const {
    full_name,
    email,
    mobile_number,
    date_of_birth,
    address,
    username,
    password
  } = req.body;

  let connection;
  try {
    // 1. Check for duplicate email or username
    const [existing] = await pool.query(
      'SELECT customer_id, email, username FROM customers WHERE email = ? OR username = ? LIMIT 1',
      [email, username]
    );

    if (existing.length > 0) {
      const match = existing[0];
      if (match.email.toLowerCase() === email.toLowerCase()) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email address already exists. Please login.'
        });
      }
      if (match.username.toLowerCase() === username.toLowerCase()) {
        return res.status(409).json({
          success: false,
          message: 'This username is already taken. Please choose another username.'
        });
      }
    }

    // 2. Hash password with bcrypt
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    // 3. Obtain a connection from pool to run transaction
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 4. Insert into customers table
    const [customerResult] = await connection.query(
      `INSERT INTO customers (full_name, email, mobile_number, date_of_birth, address, username, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [full_name, email, mobile_number, date_of_birth, address, username, password_hash]
    );

    const newCustomerId = customerResult.insertId;

    // 5. Generate a unique account number
    let accountNumber = generateAccountNumber();
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      const [checkAcc] = await connection.query(
        'SELECT account_id FROM accounts WHERE account_number = ? LIMIT 1',
        [accountNumber]
      );
      if (checkAcc.length === 0) {
        isUnique = true;
      } else {
        accountNumber = generateAccountNumber();
        attempts++;
      }
    }

    // 6. Insert new account with initial demo opening balance
    const [accountResult] = await connection.query(
      `INSERT INTO accounts (customer_id, account_number, account_type, balance, account_status)
       VALUES (?, ?, 'Savings', ?, 'Active')`,
      [newCustomerId, accountNumber, INITIAL_DEMO_BALANCE]
    );

    const newAccountId = accountResult.insertId;

    // 7. Insert opening balance transaction record for auditing
    const refNumber = generateReferenceNumber('TXN-OPEN');
    await connection.query(
      `INSERT INTO transactions (reference_number, account_id, transaction_type, amount, balance_after, description, transaction_status)
       VALUES (?, ?, 'DEPOSIT', ?, ?, 'Welcome Bonus & Account Opening Balance', 'SUCCESS')`,
      [refNumber, newAccountId, INITIAL_DEMO_BALANCE, INITIAL_DEMO_BALANCE]
    );

    // 8. Commit ACID transaction
    await connection.commit();

    // 9. Automatically create logged-in session
    req.session.customer = {
      customer_id: newCustomerId,
      username: username
    };

    return res.status(201).json({
      success: true,
      message: 'Account created successfully! Welcome to ApexTrust Bank.',
      data: {
        customer_id: newCustomerId,
        full_name,
        email,
        username,
        account_number: accountNumber,
        account_type: 'Savings',
        balance: INITIAL_DEMO_BALANCE
      }
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('[Registration Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete registration due to a server error. Please try again.'
    });
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Authenticate customer login credentials
 * Route: POST /api/auth/login
 */
async function login(req, res) {
  const { username_or_email, password } = req.body;

  try {
    // 1. Look up customer by username OR email
    const [rows] = await pool.query(
      `SELECT 
         c.customer_id, c.full_name, c.email, c.username, c.password_hash,
         a.account_id, a.account_number, a.account_type, a.balance, a.account_status
       FROM customers c
       LEFT JOIN accounts a ON c.customer_id = a.customer_id
       WHERE c.username = ? OR c.email = ?
       LIMIT 1`,
      [username_or_email, username_or_email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. No customer found matching that username or email.'
      });
    }

    const customer = rows[0];

    // 2. Verify password with bcrypt
    const isPasswordValid = await bcrypt.compare(password, customer.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password. Please double check your credentials.'
      });
    }

    // 3. Check account status
    if (customer.account_status && customer.account_status !== 'Active') {
      return res.status(403).json({
        success: false,
        message: `Your account is ${customer.account_status}. Please contact branch administration.`
      });
    }

    // 4. Set session cookie
    req.session.customer = {
      customer_id: customer.customer_id,
      username: customer.username
    };

    return res.status(200).json({
      success: true,
      message: 'Login successful. Welcome back!',
      data: {
        customer: sanitizeCustomer(customer),
        account: {
          account_id: customer.account_id,
          account_number: customer.account_number,
          account_type: customer.account_type,
          balance: parseFloat(customer.balance),
          account_status: customer.account_status
        }
      }
    });

  } catch (error) {
    console.error('[Login Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error processing login.'
    });
  }
}

/**
 * Destroy active user session
 * Route: POST /api/auth/logout, GET /api/auth/logout
 */
function logout(req, res) {
  const finalizeLogout = () => {
    res.clearCookie('banking.sid', { path: '/' });
    res.clearCookie('connect.sid', { path: '/' });
    if (req.method === 'GET') {
      return res.redirect('/login.html');
    }
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.'
    });
  };

  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error('[Logout Error]:', err);
      }
      finalizeLogout();
    });
  } else {
    finalizeLogout();
  }
}

/**
 * Get currently authenticated customer and live account info
 * Route: GET /api/auth/me
 */
async function getMe(req, res) {
  // `req.customer` and `req.account` are populated by `requireAuth`
  return res.status(200).json({
    success: true,
    data: {
      customer: req.customer,
      account: req.account
    }
  });
}

/**
 * Demo Password Reset Mechanism
 * Route: POST /api/auth/reset-password-demo
 */
async function resetPasswordDemo(req, res) {
  const { username, email, date_of_birth, new_password } = req.body;

  if (!username || !email || !date_of_birth || !new_password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide username, email, date of birth, and new password.'
    });
  }

  if (new_password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 6 characters long.'
    });
  }

  try {
    const [rows] = await pool.query(
      'SELECT customer_id FROM customers WHERE username = ? AND email = ? AND date_of_birth = ? LIMIT 1',
      [username, email, date_of_birth]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Identity verification failed. Information provided does not match any record.'
      });
    }

    const customerId = rows[0].customer_id;
    const newHash = await bcrypt.hash(new_password, SALT_ROUNDS);

    await pool.query(
      'UPDATE customers SET password_hash = ? WHERE customer_id = ?',
      [newHash, customerId]
    );

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You may now login with your new password.'
    });
  } catch (error) {
    console.error('[Password Reset Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error resetting password.'
    });
  }
}

module.exports = {
  register,
  login,
  logout,
  getMe,
  resetPasswordDemo
};
