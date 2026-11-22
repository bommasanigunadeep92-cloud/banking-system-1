/**
 * ============================================================================
 * Rate Limiting Middleware
 * File: backend/middleware/rateLimiter.js
 * ============================================================================
 * Explanation for Viva:
 * Rate limiting restricts the number of incoming requests an IP address can make
 * within a defined timeframe. This protects the login endpoint from automated
 * brute-force password guessing attacks and dictionary attacks.
 */

const rateLimit = require('express-rate-limit');

/**
 * Strict limiter for login attempts (15 attempts per 15 minutes per IP)
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 20,                  // Limit each IP to 20 login requests per window
  standardHeaders: true,    // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,     // Disable `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many login attempts from this IP address. Please try again after 15 minutes.'
  }
});

/**
 * General limiter for public API registrations and sensitive forms
 */
const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,  // 5 minutes
  max: 100,                 // 100 requests per 5 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please slow down and try again shortly.'
  }
});

module.exports = {
  loginLimiter,
  apiLimiter
};
