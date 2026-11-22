/**
 * ============================================================================
 * Database Connection Pool Configuration
 * File: backend/config/db.js
 * ============================================================================
 * Explanation for Viva:
 * A connection pool manages a cache of database connections that can be
 * reused across multiple client requests, avoiding the overhead of establishing
 * a new TCP/SQL handshake on every single HTTP request.
 *
 * We use `mysql2/promise` so that we can use modern `async/await` syntax instead
 * of messy nested callbacks.
 */

const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Create connection pool configuration with sensible defaults
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'banking_management_system',
  waitForConnections: true,
  connectionLimit: 10,       // Maximum active connections at any time
  queueLimit: 0,             // Unlimited queue length for waiting requests
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  decimalNumbers: true       // Parse DECIMAL SQL columns as JavaScript numbers
};

// Automatically enable SSL when connecting to cloud MySQL hosts (Aiven, TiDB, Clever Cloud, etc.)
if (process.env.DB_SSL === 'true' || (process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1')) {
  dbConfig.ssl = {
    rejectUnauthorized: false
  };
}

const pool = mysql.createPool(dbConfig);

/**
 * Helper function to test database connectivity at server startup.
 */
async function testDbConnection() {
  try {
    const connection = await pool.getConnection();
    console.log(' [Database] MySQL Connection Pool successfully established.');
    console.log(` [Database] Connected to database: "${process.env.DB_NAME || 'banking_management_system'}" at ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}`);
    connection.release();
    return true;
  } catch (error) {
    console.error(' [Database Error] Failed to connect to MySQL:');
    console.error(`   Code: ${error.code}`);
    console.error(`   Message: ${error.message}`);
    console.error('\n--> Tip: Check your .env file and ensure MySQL Server is running.');
    return false;
  }
}

module.exports = {
  pool,
  testDbConnection
};
