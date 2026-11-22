/**
 * ============================================================================
 * Utility & Helper Functions
 * File: backend/utils/helpers.js
 * ============================================================================
 * Contains generator functions for unique bank account numbers and unique
 * audit transaction references, as well as safe data sanitization.
 */

const crypto = require('crypto');

/**
 * Generates a unique 10-digit bank account number.
 * Format: 1001 + 6 pseudo-random digits (e.g. 1001489231)
 */
function generateAccountNumber() {
  const prefix = '1001';
  const randomSuffix = Math.floor(100000 + Math.random() * 900000).toString();
  return `${prefix}${randomSuffix}`;
}

/**
 * Generates a collision-resistant unique transaction reference number.
 * Format: TXN-YYYYMMDD-XXXX (e.g., TXN-20261121-AB4F9E)
 */
function generateReferenceNumber(prefix = 'TXN') {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomBytes = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${dateStr}-${randomBytes}`;
}

/**
 * Strips sensitive fields like password_hash before sending customer data to frontend.
 */
function sanitizeCustomer(customer) {
  if (!customer) return null;
  const { password_hash, ...safeData } = customer;
  return safeData;
}

module.exports = {
  generateAccountNumber,
  generateReferenceNumber,
  sanitizeCustomer
};
