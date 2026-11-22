/**
 * ============================================================================
 * Server Entry Point
 * File: backend/server.js
 * ============================================================================
 * Explanation for Viva:
 * This is the bootstrap file for the Node.js process. It loads environment
 * variables, tests the MySQL database connection pool, and binds the Express
 * application to the designated TCP port.
 */

const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const { testDbConnection } = require('./config/db');

const PORT = parseInt(process.env.PORT, 10) || 3000;

async function startServer() {
  console.log('================================================================');
  console.log('    BANKING AND ACCOUNT MANAGEMENT SYSTEM - SERVER BOOTSTRAP    ');
  console.log('================================================================');

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n [Server Ready] HTTP server is running at: http://0.0.0.0:${PORT}`);
    console.log(` [Portal URL] Open your web browser: http://localhost:${PORT}/index.html`);
    console.log(' [Status] Press Ctrl+C to stop the server.\n');
  });

  // Verify database connection asynchronously so server binds port immediately
  testDbConnection().then(dbConnected => {
    if (dbConnected) {
      console.log(' [Database] MySQL Connection verified successfully.');
    } else {
      console.error('\n [Database Warning] Database connection check failed. Ensure DB environment variables are set.');
    }
  }).catch(err => {
    console.error(' [Database Error]', err.message);
  });

  // Graceful shutdown handling
  const shutdown = () => {
    console.log('\n Gracefully shutting down Banking Server...');
    server.close(() => {
      console.log(' Server stopped.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer();
