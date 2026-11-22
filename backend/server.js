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

  // Verify database connection before starting HTTP listener
  const dbConnected = await testDbConnection();

  if (!dbConnected) {
    console.error('\n [Fatal Warning] Database connection failed. Please check MySQL server status.');
  }

  const server = app.listen(PORT, () => {
    console.log(`\n [Server Ready] HTTP server is running at: http://localhost:${PORT}`);
    console.log(` [Portal URL] Open your web browser: http://localhost:${PORT}/index.html`);
    console.log(' [Status] Press Ctrl+C to stop the server.\n');
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
