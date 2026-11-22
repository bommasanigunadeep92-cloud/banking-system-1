/**
 * ============================================================================
 * Express Application Configuration
 * File: backend/app.js
 * ============================================================================
 * Explanation for Viva:
 * This file configures all global middleware:
 * - Helmet: sets HTTP security headers to protect against common web attacks
 * - Express-Session: manages user sessions using cryptographically signed HTTP-only cookies
 * - JSON and URL-encoded body parsers
 * - Static file serving for the frontend files
 * - REST API routing endpoints
 */

const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');

// Import route modules
const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const accountRoutes = require('./routes/accountRoutes');
const transactionRoutes = require('./routes/transactionRoutes');

const app = express();

// 1. HTTP Security Headers with Helmet
// Configured to allow Bootstrap 5 and Bootstrap Icons from CDN
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// 2. CORS configuration (permits local client requests)
app.use(cors({
  origin: true,
  credentials: true
}));

// 3. Body Parsing Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Session Middleware
// Configured with proxy trust so cookies persist across Render/Railway reverse proxies
app.set('trust proxy', 1);
app.enable('trust proxy');

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'banking_system_college_project_default_secret_key_12345',
    resave: true,
    saveUninitialized: false,
    name: 'banking.sid',
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: false, // Set to false so cookies are accepted behind Render/Railway SSL-terminating reverse proxies
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  })
);

// 5. Serve Frontend Static Assets
app.use(express.static(path.join(__dirname, '../frontend')));

// 6. Mount REST API Routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/transactions', transactionRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    service: 'Banking and Account Management System'
  });
});

// 7. API 404 Handler (for unmatched /api calls)
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint '${req.originalUrl}' was not found on this server.`
  });
});

// 8. Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'An unexpected server error occurred.'
  });
});

module.exports = app;
