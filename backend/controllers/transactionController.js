/**
 * ============================================================================
 * Financial Transactions Controller
 * File: backend/controllers/transactionController.js
 * ============================================================================
 * Explanation for Viva:
 * This controller handles core banking operations: Deposits, Withdrawals, Transfers,
 * Transaction History, and CSV statement exports.
 *
 * CRITICAL CONCEPT - ACID TRANSACTIONS:
 * - Atomicity: Either all database operations succeed, or none take effect.
 * - Consistency: Balances never violate financial integrity rules.
 * - Isolation: Uses `SELECT ... FOR UPDATE` row-level locks so concurrent
 *   requests cannot cause race conditions or double-spending.
 * - Durability: Committed transactions are permanently saved to MySQL disk.
 */

const { pool } = require('../config/db');
const { generateReferenceNumber } = require('../utils/helpers');

/**
 * Deposit demo money into the customer's account
 * Route: POST /api/transactions/deposit
 */
async function deposit(req, res) {
  const accountId = req.account.account_id;
  const depositAmount = parseFloat(req.body.amount);
  const description = req.body.description ? req.body.description.trim() : 'Branch / Online Cash Deposit';

  if (isNaN(depositAmount) || depositAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Deposit amount must be a positive number greater than zero.'
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction(); // ACID: START TRANSACTION

    // 1. Lock the account row for update to prevent concurrent race conditions
    const [accountRows] = await connection.query(
      'SELECT account_id, balance, account_status FROM accounts WHERE account_id = ? FOR UPDATE',
      [accountId]
    );

    if (accountRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    const currentBalance = parseFloat(accountRows[0].balance);
    const newBalance = parseFloat((currentBalance + depositAmount).toFixed(2));

    // 2. Update account balance
    await connection.query(
      'UPDATE accounts SET balance = ? WHERE account_id = ?',
      [newBalance, accountId]
    );

    // 3. Create unique audit transaction entry
    const refNumber = generateReferenceNumber('TXN-DEP');
    const [txResult] = await connection.query(
      `INSERT INTO transactions 
         (reference_number, account_id, transaction_type, amount, balance_after, description, transaction_status)
       VALUES (?, ?, 'DEPOSIT', ?, ?, ?, 'SUCCESS')`,
      [refNumber, accountId, depositAmount, newBalance, description]
    );

    // 4. Commit transaction
    await connection.commit();

    return res.status(200).json({
      success: true,
      message: `Successfully deposited ₹${depositAmount.toFixed(2)} into your account!`,
      data: {
        transaction_id: txResult.insertId,
        reference_number: refNumber,
        transaction_type: 'DEPOSIT',
        amount: depositAmount,
        previous_balance: currentBalance,
        new_balance: newBalance,
        description
      }
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('[Deposit Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process deposit due to a database error.'
    });
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Withdraw demo money from the customer's account
 * Route: POST /api/transactions/withdraw
 */
async function withdraw(req, res) {
  const accountId = req.account.account_id;
  const withdrawAmount = parseFloat(req.body.amount);
  const description = req.body.description ? req.body.description.trim() : 'ATM / Cash Withdrawal';

  if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Withdrawal amount must be a positive number greater than zero.'
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction(); // ACID: START TRANSACTION

    // 1. Row-level lock on account
    const [accountRows] = await connection.query(
      'SELECT account_id, balance, account_status FROM accounts WHERE account_id = ? FOR UPDATE',
      [accountId]
    );

    if (accountRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    const currentBalance = parseFloat(accountRows[0].balance);

    // 2. Strict balance check to prevent overdraft
    if (currentBalance < withdrawAmount) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Insufficient funds. Your current available balance is ₹${currentBalance.toFixed(2)}.`
      });
    }

    const newBalance = parseFloat((currentBalance - withdrawAmount).toFixed(2));

    // 3. Update account balance
    await connection.query(
      'UPDATE accounts SET balance = ? WHERE account_id = ?',
      [newBalance, accountId]
    );

    // 4. Create unique audit transaction record
    const refNumber = generateReferenceNumber('TXN-WTH');
    const [txResult] = await connection.query(
      `INSERT INTO transactions 
         (reference_number, account_id, transaction_type, amount, balance_after, description, transaction_status)
       VALUES (?, ?, 'WITHDRAWAL', ?, ?, ?, 'SUCCESS')`,
      [refNumber, accountId, withdrawAmount, newBalance, description]
    );

    // 5. Commit transaction
    await connection.commit();

    return res.status(200).json({
      success: true,
      message: `Successfully withdrew ₹${withdrawAmount.toFixed(2)}.`,
      data: {
        transaction_id: txResult.insertId,
        reference_number: refNumber,
        transaction_type: 'WITHDRAWAL',
        amount: withdrawAmount,
        previous_balance: currentBalance,
        new_balance: newBalance,
        description
      }
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('[Withdrawal Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process withdrawal.'
    });
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Transfer money between two registered bank accounts
 * Route: POST /api/transactions/transfer
 *
 * Implements strict ACID transaction with double-entry debit & credit
 */
async function transfer(req, res) {
  const senderAccountId = req.account.account_id;
  const senderAccountNumber = req.account.account_number;
  const receiverAccountNumber = req.body.receiver_account_number ? req.body.receiver_account_number.trim() : '';
  const transferAmount = parseFloat(req.body.amount);
  const userDescription = req.body.description ? req.body.description.trim() : 'Funds Transfer';

  // 1. Basic validation
  if (!receiverAccountNumber) {
    return res.status(400).json({
      success: false,
      message: 'Receiver account number is required.'
    });
  }

  if (senderAccountNumber === receiverAccountNumber) {
    return res.status(400).json({
      success: false,
      message: 'Self-transfers are not allowed. Sender and receiver accounts cannot be the same.'
    });
  }

  if (isNaN(transferAmount) || transferAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Transfer amount must be a positive number greater than zero.'
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction(); // ACID: START TRANSACTION

    // 2. Lock and check Sender account
    const [senderRows] = await connection.query(
      'SELECT account_id, balance, account_status FROM accounts WHERE account_id = ? FOR UPDATE',
      [senderAccountId]
    );

    if (senderRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Sender account not found.' });
    }

    const senderCurrentBalance = parseFloat(senderRows[0].balance);

    if (senderCurrentBalance < transferAmount) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₹${senderCurrentBalance.toFixed(2)}, Required: ₹${transferAmount.toFixed(2)}.`
      });
    }

    // 3. Lock and verify Receiver account
    const [receiverRows] = await connection.query(
      `SELECT a.account_id, a.account_number, a.balance, a.account_status, c.full_name AS receiver_name
       FROM accounts a
       JOIN customers c ON a.customer_id = c.customer_id
       WHERE a.account_number = ? FOR UPDATE`,
      [receiverAccountNumber]
    );

    if (receiverRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Receiver account number not found. Please verify the account number.'
      });
    }

    const receiver = receiverRows[0];
    if (receiver.account_status !== 'Active') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Cannot transfer: receiver account is currently ${receiver.account_status}.`
      });
    }

    const receiverCurrentBalance = parseFloat(receiver.balance);

    // 4. Calculate new balances
    const newSenderBalance = parseFloat((senderCurrentBalance - transferAmount).toFixed(2));
    const newReceiverBalance = parseFloat((receiverCurrentBalance + transferAmount).toFixed(2));

    // 5. Update sender balance (Debit)
    await connection.query(
      'UPDATE accounts SET balance = ? WHERE account_id = ?',
      [newSenderBalance, senderAccountId]
    );

    // 6. Update receiver balance (Credit)
    await connection.query(
      'UPDATE accounts SET balance = ? WHERE account_id = ?',
      [newReceiverBalance, receiver.account_id]
    );

    // 7. Insert Sender Transaction (TRANSFER_DEBIT)
    const senderRef = generateReferenceNumber('TXN-TRF-OUT');
    const senderDesc = `${userDescription} (Sent to ${receiver.receiver_name} - Acc #${receiver.account_number})`;
    await connection.query(
      `INSERT INTO transactions 
         (reference_number, account_id, transaction_type, amount, balance_after, description, related_account_number, transaction_status)
       VALUES (?, ?, 'TRANSFER_DEBIT', ?, ?, ?, ?, 'SUCCESS')`,
      [senderRef, senderAccountId, transferAmount, newSenderBalance, senderDesc, receiver.account_number]
    );

    // 8. Insert Receiver Transaction (TRANSFER_CREDIT)
    const receiverRef = generateReferenceNumber('TXN-TRF-IN');
    const receiverDesc = `${userDescription} (Received from ${req.customer.full_name} - Acc #${senderAccountNumber})`;
    await connection.query(
      `INSERT INTO transactions 
         (reference_number, account_id, transaction_type, amount, balance_after, description, related_account_number, transaction_status)
       VALUES (?, ?, 'TRANSFER_CREDIT', ?, ?, ?, ?, 'SUCCESS')`,
      [receiverRef, receiver.account_id, transferAmount, newReceiverBalance, receiverDesc, senderAccountNumber]
    );

    // 9. Commit ACID transaction (both balances update together or neither updates)
    await connection.commit();

    return res.status(200).json({
      success: true,
      message: `Successfully transferred ₹${transferAmount.toFixed(2)} to ${receiver.receiver_name}!`,
      data: {
        reference_number: senderRef,
        receiver_name: receiver.receiver_name,
        receiver_account_number: receiver.account_number,
        amount: transferAmount,
        new_balance: newSenderBalance,
        description: senderDesc
      }
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('[Transfer Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Transfer failed due to a database transaction error. No funds were deducted.'
    });
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Get customer's transaction history with search, filters, pagination, and sorting
 * Route: GET /api/transactions/history
 */
async function getHistory(req, res) {
  const accountId = req.account.account_id;

  // Query parameters with defaults
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const offset = (page - 1) * limit;

  const type = req.query.type || '';
  const search = req.query.search ? req.query.search.trim() : '';
  const startDate = req.query.startDate || '';
  const endDate = req.query.endDate || '';
  const sortBy = req.query.sortBy === 'amount' ? 'amount' : 'transaction_date';
  const sortOrder = req.query.sortOrder === 'asc' ? 'ASC' : 'DESC';

  try {
    let whereClauses = ['account_id = ?'];
    let params = [accountId];

    // Filter by type
    if (type && ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER_DEBIT', 'TRANSFER_CREDIT'].includes(type)) {
      whereClauses.push('transaction_type = ?');
      params.push(type);
    }

    // Search by description, reference number, or related account
    if (search) {
      whereClauses.push('(reference_number LIKE ? OR description LIKE ? OR related_account_number LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Filter by date range
    if (startDate) {
      whereClauses.push('DATE(transaction_date) >= ?');
      params.push(startDate);
    }
    if (endDate) {
      whereClauses.push('DATE(transaction_date) <= ?');
      params.push(endDate);
    }

    const whereSQL = whereClauses.join(' AND ');

    // 1. Get total matching count
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM transactions WHERE ${whereSQL}`,
      params
    );
    const totalTransactions = countRows[0].total;
    const totalPages = Math.ceil(totalTransactions / limit) || 1;

    // 2. Fetch paginated records
    const [transactions] = await pool.query(
      `SELECT 
         transaction_id, reference_number, transaction_type, amount, balance_after,
         description, related_account_number, transaction_date, transaction_status
       FROM transactions
       WHERE ${whereSQL}
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // 3. Compute summary statistics for customer dashboard
    const [summaryRows] = await pool.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN transaction_type IN ('DEPOSIT', 'TRANSFER_CREDIT') THEN amount ELSE 0 END), 0) AS total_deposits,
         COALESCE(SUM(CASE WHEN transaction_type IN ('WITHDRAWAL', 'TRANSFER_DEBIT') THEN amount ELSE 0 END), 0) AS total_withdrawals,
         COUNT(*) AS total_count
       FROM transactions
       WHERE account_id = ?`,
      [accountId]
    );

    return res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: {
          currentPage: page,
          totalPages,
          totalTransactions,
          limit
        },
        summary: {
          totalDeposits: parseFloat(summaryRows[0].total_deposits),
          totalWithdrawals: parseFloat(summaryRows[0].total_withdrawals),
          totalCount: summaryRows[0].total_count
        }
      }
    });

  } catch (error) {
    console.error('[getHistory Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve transaction history.'
    });
  }
}

/**
 * Export customer's transaction history as a downloadable CSV statement
 * Route: GET /api/transactions/export-csv
 */
async function exportCsv(req, res) {
  const accountId = req.account.account_id;
  const accountNumber = req.account.account_number;

  try {
    const [rows] = await pool.query(
      `SELECT 
         reference_number, transaction_date, transaction_type, amount, balance_after,
         description, related_account_number, transaction_status
       FROM transactions
       WHERE account_id = ?
       ORDER BY transaction_date DESC`,
      [accountId]
    );

    // Build CSV string with clean headers
    let csv = 'Reference Number,Date & Time,Type,Debit (₹),Credit (₹),Balance After (₹),Description,Related Account,Status\r\n';

    for (const tx of rows) {
      const isDebit = ['WITHDRAWAL', 'TRANSFER_DEBIT'].includes(tx.transaction_type);
      const isCredit = ['DEPOSIT', 'TRANSFER_CREDIT'].includes(tx.transaction_type);
      const debitStr = isDebit ? parseFloat(tx.amount).toFixed(2) : '0.00';
      const creditStr = isCredit ? parseFloat(tx.amount).toFixed(2) : '0.00';
      const cleanDesc = (tx.description || '').replace(/"/g, '""');
      const related = tx.related_account_number || 'N/A';
      const dateFormatted = new Date(tx.transaction_date).toISOString().replace('T', ' ').slice(0, 19);

      csv += `"${tx.reference_number}","${dateFormatted}","${tx.transaction_type}","${debitStr}","${creditStr}","${parseFloat(tx.balance_after).toFixed(2)}","${cleanDesc}","${related}","${tx.transaction_status}"\r\n`;
    }

    const filename = `statement_${accountNumber}_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csv);

  } catch (error) {
    console.error('[exportCsv Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate transaction CSV export.'
    });
  }
}

/**
 * Get single transaction by ID (verifies ownership)
 * Route: GET /api/transactions/:id
 */
async function getTransactionById(req, res) {
  const accountId = req.account.account_id;
  const txId = parseInt(req.params.id, 10);

  try {
    const [rows] = await pool.query(
      `SELECT * FROM transactions WHERE transaction_id = ? AND account_id = ? LIMIT 1`,
      [txId, accountId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found or unauthorized.'
      });
    }

    return res.status(200).json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('[getTransactionById Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve transaction details.'
    });
  }
}

module.exports = {
  deposit,
  withdraw,
  transfer,
  getHistory,
  exportCsv,
  getTransactionById
};
