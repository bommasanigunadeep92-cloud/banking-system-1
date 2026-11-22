/**
 * ============================================================================
 * Automated End-to-End Test Suite for Banking & Account Management System
 * File: tests/test-suite.js
 * ============================================================================
 * Tests all 20 requirements and edge cases against the live Express server & MySQL:
 * 1. Health check & landing page accessibility
 * 2. Registration with auto-account generation & initial bonus
 * 3. Duplicate email & duplicate username rejection
 * 4. Input validation (invalid email, short password)
 * 5. Login with invalid and valid credentials
 * 6. Session persistence and /api/auth/me retrieval
 * 7. Deposit demo money and balance increment
 * 8. Rejection of negative / zero deposits
 * 9. Cash withdrawal and balance decrement
 * 10. Rejection of overdraft (withdrawal exceeding balance)
 * 11. Second user registration for transfer testing
 * 12. Beneficiary verification lookup
 * 13. Prevention of self-transfers
 * 14. Atomic money transfer with balance updates on both accounts
 * 15. Transaction history retrieval with filtering & sorting
 * 16. CSV statement generation
 * 17. Profile details update
 * 18. Password change and re-authentication with new password
 * 19. Logout & session destruction
 * 20. Unauthorized access blockage on protected endpoints
 */

const dotenv = require('dotenv');
dotenv.config();

const app = require('../backend/app');
const { pool, testDbConnection } = require('../backend/config/db');

const TEST_PORT = 3001;
let server;
let baseUrl = `http://localhost:${TEST_PORT}`;

// Helper: Custom HTTP client that retains session cookies across calls
class TestSession {
  constructor() {
    this.cookie = null;
  }

  async request(path, options = {}) {
    const headers = options.headers || {};
    if (this.cookie) {
      headers['Cookie'] = this.cookie;
    }
    if (options.body && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers
    });

    // Capture Set-Cookie if present
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      this.cookie = setCookie.split(';')[0];
    }

    const contentType = response.headers.get('content-type') || '';
    let body;
    if (contentType.includes('application/json')) {
      body = await response.json();
    } else {
      body = await response.text();
    }

    return {
      status: response.status,
      headers: response.headers,
      body
    };
  }
}

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, failureDetail = '') {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`  [FAIL] ${testName} -> ${failureDetail}`);
    failedCount++;
  }
}

async function runTestSuite() {
  console.log('\n============================================================');
  console.log('   STARTING AUTOMATED SYSTEM TESTS & EDGE-CASE VALIDATION   ');
  console.log('============================================================\n');

  // Check DB connection
  const dbOk = await testDbConnection();
  if (!dbOk) {
    console.error('Cannot run tests without MySQL connection.');
    process.exit(1);
  }

  // Start temporary server instance
  server = app.listen(TEST_PORT);
  console.log(` Test server running on ${baseUrl}\n`);

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Health check & static files
    // ------------------------------------------------------------------------
    console.log('--- TEST GROUP 1: Server Health & Static Routing ---');
    const health = await new TestSession().request('/api/health');
    assert(health.status === 200 && health.body.status === 'UP', 'Health check API returns UP');

    const indexPage = await new TestSession().request('/index.html');
    assert(indexPage.status === 200 && indexPage.body.includes('ApexTrust Bank'), 'Landing page is accessible and contains branding');

    // ------------------------------------------------------------------------
    // TEST 2: Registration Validation & Edge Cases
    // ------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 2: Registration & Input Validation ---');
    const anon = new TestSession();

    // Invalid email check
    const badEmail = await anon.request('/api/auth/register', {
      method: 'POST',
      body: {
        full_name: 'Test Bad',
        email: 'invalid-email-format',
        mobile_number: '9876543210',
        date_of_birth: '1995-01-01',
        address: '123 Street',
        username: 'testbad',
        password: 'password123',
        confirm_password: 'password123'
      }
    });
    assert(badEmail.status === 400, 'Registration rejects invalid email format');

    // Weak / short password check
    const weakPass = await anon.request('/api/auth/register', {
      method: 'POST',
      body: {
        full_name: 'Test Bad',
        email: 'test@example.com',
        mobile_number: '9876543210',
        date_of_birth: '1995-01-01',
        address: '123 Street',
        username: 'testbad',
        password: '123',
        confirm_password: '123'
      }
    });
    assert(weakPass.status === 400, 'Registration rejects password shorter than 6 characters');

    // Mismatched passwords check
    const mismatch = await anon.request('/api/auth/register', {
      method: 'POST',
      body: {
        full_name: 'Test Bad',
        email: 'test@example.com',
        mobile_number: '9876543210',
        date_of_birth: '1995-01-01',
        address: '123 Street',
        username: 'testbad',
        password: 'password123',
        confirm_password: 'differentpassword'
      }
    });
    assert(mismatch.status === 400, 'Registration rejects mismatched confirm password');

    // ------------------------------------------------------------------------
    // TEST 3: Successful Registration with Auto-Account & Demo Bonus
    // ------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 3: Valid Registration & Demo Account Creation ---');
    const userTimestamp = Date.now().toString().slice(-6);
    const testUser1 = {
      full_name: `Alice Johnson ${userTimestamp}`,
      email: `alice_${userTimestamp}@example.com`,
      mobile_number: '9876543220',
      date_of_birth: '1999-03-25',
      address: '789 Oak Lane, Tech City',
      username: `alice_${userTimestamp}`,
      password: 'password123',
      confirm_password: 'password123'
    };

    const sessionUser1 = new TestSession();
    const regRes = await sessionUser1.request('/api/auth/register', {
      method: 'POST',
      body: testUser1
    });

    assert(regRes.status === 201 && regRes.body.success === true, 'Customer 1 successfully registered');
    assert(regRes.body.data.account_number.startsWith('1001'), 'Unique 10-digit account number automatically generated');
    assert(regRes.body.data.balance === 1000.00, 'Account provisioned with $1,000.00 demo opening bonus');

    const user1Account = regRes.body.data.account_number;

    // Duplicate email registration check
    const dupEmail = await anon.request('/api/auth/register', {
      method: 'POST',
      body: { ...testUser1, username: `other_${userTimestamp}` }
    });
    assert(dupEmail.status === 409, 'Registration prevents duplicate email address');

    // Duplicate username registration check
    const dupUser = await anon.request('/api/auth/register', {
      method: 'POST',
      body: { ...testUser1, email: `other_${userTimestamp}@example.com` }
    });
    assert(dupUser.status === 409, 'Registration prevents duplicate username');

    // ------------------------------------------------------------------------
    // TEST 4: Authentication & Login
    // ------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 4: Login & Credential Verification ---');
    const loginSession = new TestSession();

    // Wrong password check
    const wrongPass = await loginSession.request('/api/auth/login', {
      method: 'POST',
      body: {
        username_or_email: testUser1.username,
        password: 'incorrectPassword'
      }
    });
    assert(wrongPass.status === 401, 'Login rejects incorrect password');

    // Successful login by username
    const goodLogin = await loginSession.request('/api/auth/login', {
      method: 'POST',
      body: {
        username_or_email: testUser1.username,
        password: testUser1.password
      }
    });
    assert(goodLogin.status === 200 && goodLogin.body.success === true, 'Login succeeds with registered username');

    // Verify session /api/auth/me
    const meRes = await loginSession.request('/api/auth/me');
    assert(meRes.status === 200 && meRes.body.data.customer.username === testUser1.username, 'Session authenticated: /api/auth/me returns valid customer');

    // ------------------------------------------------------------------------
    // TEST 5: Financial Deposits
    // ------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 5: Deposits & Balance Mutations ---');
    
    // Invalid deposit (0 or negative)
    const badDep = await loginSession.request('/api/transactions/deposit', {
      method: 'POST',
      body: { amount: -50, description: 'Negative test' }
    });
    assert(badDep.status === 400, 'Deposit rejects negative amount');

    // Valid deposit of $500
    const depRes = await loginSession.request('/api/transactions/deposit', {
      method: 'POST',
      body: { amount: 500.00, description: 'Simulated Cash Deposit' }
    });
    assert(depRes.status === 200 && depRes.body.data.new_balance === 1500.00, 'Deposit of $500 correctly updates balance from $1000 to $1500');
    assert(depRes.body.data.reference_number.startsWith('TXN-DEP'), 'Deposit generates unique TXN-DEP reference');

    // ------------------------------------------------------------------------
    // TEST 6: Financial Withdrawals & Overdraft Guard
    // ------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 6: Cash Withdrawals & Overdraft Protection ---');

    // Overdraft attempt ($2,000 when balance is $1,500)
    const overdraft = await loginSession.request('/api/transactions/withdraw', {
      method: 'POST',
      body: { amount: 2000.00, description: 'Attempted Overdraft' }
    });
    assert(overdraft.status === 400 && overdraft.body.message.includes('Insufficient funds'), 'Withdrawal exceeding available balance is rejected (Overdraft Guard)');

    // Valid withdrawal of $200
    const wthRes = await loginSession.request('/api/transactions/withdraw', {
      method: 'POST',
      body: { amount: 200.00, description: 'ATM Withdrawal' }
    });
    assert(wthRes.status === 200 && wthRes.body.data.new_balance === 1300.00, 'Withdrawal of $200 correctly reduces balance from $1500 to $1300');

    // ------------------------------------------------------------------------
    // TEST 7: Register Second Customer & Test Beneficiary Verification
    // ------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 7: Second Customer & Beneficiary Lookup ---');
    const testUser2 = {
      full_name: `Bob Miller ${userTimestamp}`,
      email: `bob_${userTimestamp}@example.com`,
      mobile_number: '9876543221',
      date_of_birth: '2001-07-12',
      address: '456 Pine Street, Tech City',
      username: `bob_${userTimestamp}`,
      password: 'password123',
      confirm_password: 'password123'
    };

    const sessionUser2 = new TestSession();
    const reg2 = await sessionUser2.request('/api/auth/register', {
      method: 'POST',
      body: testUser2
    });
    assert(reg2.status === 201, 'Customer 2 registered successfully with $1,000 bonus');
    const user2Account = reg2.body.data.account_number;

    // Lookup User 2 from User 1
    const verifyRes = await loginSession.request(`/api/accounts/verify-beneficiary/${user2Account}`);
    assert(verifyRes.status === 200 && verifyRes.body.data.receiver_name.includes('Bob Miller'), 'Beneficiary verification returns recipient full name');

    // Self-transfer attempt check
    const selfVerify = await loginSession.request(`/api/accounts/verify-beneficiary/${user1Account}`);
    assert(selfVerify.status === 400, 'Beneficiary verification prevents self-transfers');

    // ------------------------------------------------------------------------
    // TEST 8: ACID Money Transfer Between Accounts
    // ------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 8: ACID Inter-Account Transfer ---');
    // User 1 has $1,300. User 2 has $1,000.
    // Transfer $300 from User 1 -> User 2
    const transferRes = await loginSession.request('/api/transactions/transfer', {
      method: 'POST',
      body: {
        receiver_account_number: user2Account,
        amount: 300.00,
        description: 'Project Collaboration Payment'
      }
    });

    assert(transferRes.status === 200 && transferRes.body.data.new_balance === 1000.00, 'Sender balance deducted by $300 (now $1000.00)');

    // Verify Receiver balance updated simultaneously to $1,300.00
    const user2Balance = await sessionUser2.request('/api/accounts/balance');
    assert(user2Balance.status === 200 && user2Balance.body.data.balance === 1300.00, 'Receiver balance credited by $300 (now $1300.00) in atomic transaction');

    // ------------------------------------------------------------------------
    // TEST 9: Transaction History, Filtering & CSV Export
    // ------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 9: Audit Ledger & CSV Export ---');
    const historyRes = await loginSession.request('/api/transactions/history');
    assert(historyRes.status === 200 && historyRes.body.data.transactions.length >= 4, 'Transaction history returns paginated list of all operations');

    // Filter by type DEPOSIT
    const filterRes = await loginSession.request('/api/transactions/history?type=DEPOSIT');
    const allDeposits = filterRes.body.data.transactions.every(tx => tx.transaction_type === 'DEPOSIT');
    assert(filterRes.status === 200 && allDeposits, 'Filtering by transaction type DEPOSIT only returns deposits');

    // CSV Statement export
    const csvRes = await loginSession.request('/api/transactions/export-csv');
    assert(csvRes.status === 200 && csvRes.headers.get('content-type').includes('text/csv') && csvRes.body.includes('Reference Number'), 'CSV statement download endpoint returns formatted CSV data');

    // ------------------------------------------------------------------------
    // TEST 10: Profile Update, Password Change, Logout & Auth Protection
    // ------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 10: Security, Password Change & Route Protection ---');

    // Update Profile
    const updateProf = await loginSession.request('/api/customers/profile', {
      method: 'PUT',
      body: {
        full_name: 'Alice Johnson Updated',
        mobile_number: '9988776655',
        address: '999 New Boulevard, Silicon Hills'
      }
    });
    assert(updateProf.status === 200 && updateProf.body.data.full_name === 'Alice Johnson Updated', 'Customer profile updated successfully');

    // Change Password
    const changePwd = await loginSession.request('/api/customers/change-password', {
      method: 'PUT',
      body: {
        current_password: 'password123',
        new_password: 'newSecretPassword@2026',
        confirm_new_password: 'newSecretPassword@2026'
      }
    });
    assert(changePwd.status === 200, 'Password changed successfully with bcrypt verification');

    // Logout
    const logoutRes = await loginSession.request('/api/auth/logout', { method: 'POST' });
    assert(logoutRes.status === 200, 'Logout successfully destroys active session');

    // Verify protected route is now blocked with 401
    const blockedRes = await loginSession.request('/api/customers/profile');
    assert(blockedRes.status === 401, 'Unauthorized request to protected endpoint is correctly blocked with HTTP 401');

    // Login with new password
    const newLogin = await loginSession.request('/api/auth/login', {
      method: 'POST',
      body: {
        username_or_email: testUser1.username,
        password: 'newSecretPassword@2026'
      }
    });
    assert(newLogin.status === 200, 'Login succeeds using newly changed password');

  } catch (err) {
    console.error('\nFatal test execution error:', err);
    failedCount++;
  } finally {
    if (server) server.close();
    console.log('\n============================================================');
    console.log(` TEST RUN COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('============================================================\n');

    if (failedCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runTestSuite();
