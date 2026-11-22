/**
 * ============================================================================
 * Customer Dashboard Script
 * File: frontend/js/dashboard.js
 * ============================================================================
 * Explanation for Viva:
 * Fetches real-time financial data for the authenticated customer from MySQL.
 * Updates metric cards (available balance, total deposits, total withdrawals)
 * and populates the recent transactions table.
 */

let currentAuthData = null;

document.addEventListener('DOMContentLoaded', () => {
  // Enforce authentication before loading dashboard
  requireAuth((authData) => {
    currentAuthData = authData;
    renderDashboardNavigation('dashboard', authData);
    setGreeting(authData.customer.full_name);
    populateAccountCard(authData.account);
    loadDashboardData();
  });
});

/**
 * Sets dynamic greeting based on system time of day
 */
function setGreeting(name) {
  const hour = new Date().getHours();
  let timeOfDay = 'Day';
  if (hour < 12) timeOfDay = 'Morning';
  else if (hour < 17) timeOfDay = 'Afternoon';
  else timeOfDay = 'Evening';

  const greetingEl = document.getElementById('dash-greeting');
  if (greetingEl) {
    greetingEl.textContent = `Good ${timeOfDay}, ${name}!`;
  }
}

/**
 * Fills the primary account summary card
 */
function populateAccountCard(account) {
  if (!account) return;
  document.getElementById('dash-balance').textContent = formatCurrency(account.balance);
  document.getElementById('dash-account-number').textContent = account.account_number;
  document.getElementById('dash-account-type').textContent = `${account.account_type} Account`;
  document.getElementById('dash-account-status').textContent = account.account_status;
}

/**
 * Loads recent transactions & financial summaries from backend
 */
async function loadDashboardData() {
  try {
    // 1. Fetch fresh account balance
    const balanceRes = await apiFetch('/accounts/balance');
    if (balanceRes.success && balanceRes.data) {
      document.getElementById('dash-balance').textContent = formatCurrency(balanceRes.data.balance);
    }

    // 2. Fetch latest 5 transactions
    const historyRes = await apiFetch('/transactions/history?limit=5&sortBy=transaction_date&sortOrder=desc');
    if (historyRes.success && historyRes.data) {
      const { transactions, summary } = historyRes.data;

      // Update total deposits and withdrawals cards
      document.getElementById('dash-total-deposits').textContent = formatCurrency(summary.totalDeposits);
      document.getElementById('dash-total-withdrawals').textContent = formatCurrency(summary.totalWithdrawals);

      renderRecentTransactions(transactions);
    }
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
    showToast('Failed to refresh dashboard data.', 'danger');
  }
}

/**
 * Render rows for recent transactions table
 */
function renderRecentTransactions(transactions) {
  const tbody = document.getElementById('recent-transactions-tbody');
  if (!tbody) return;

  if (!transactions || transactions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-4 text-muted">
          <i class="bi bi-inbox fs-3 d-block mb-1"></i>
          No transactions recorded yet. Make a deposit to get started!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = transactions.map(tx => {
    const isCredit = ['DEPOSIT', 'TRANSFER_CREDIT'].includes(tx.transaction_type);
    const amountClass = isCredit ? 'amount-positive' : 'amount-negative';
    const amountPrefix = isCredit ? '+' : '-';

    let badgeClass = 'badge-deposit';
    let typeLabel = 'Deposit';

    if (tx.transaction_type === 'WITHDRAWAL') {
      badgeClass = 'badge-withdrawal';
      typeLabel = 'Withdrawal';
    } else if (tx.transaction_type === 'TRANSFER_DEBIT') {
      badgeClass = 'badge-transfer-debit';
      typeLabel = 'Transfer Out';
    } else if (tx.transaction_type === 'TRANSFER_CREDIT') {
      badgeClass = 'badge-transfer-credit';
      typeLabel = 'Transfer In';
    }

    return `
      <tr>
        <td><code class="fw-semibold text-navy">${tx.reference_number}</code></td>
        <td class="small text-muted">${formatDateTime(tx.transaction_date)}</td>
        <td><span class="badge-txn ${badgeClass}">${typeLabel}</span></td>
        <td class="small text-truncate" style="max-width: 260px;" title="${tx.description}">${tx.description || '-'}</td>
        <td class="text-end ${amountClass}">${amountPrefix}${formatCurrency(tx.amount)}</td>
        <td class="text-end fw-medium">${formatCurrency(tx.balance_after)}</td>
        <td class="text-center">
          <span class="badge bg-success-subtle text-success">${tx.transaction_status}</span>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Copy account number to clipboard with feedback
 */
function copyAccountNumber() {
  const accNo = document.getElementById('dash-account-number').textContent;
  if (!accNo || accNo.includes('-')) return;

  navigator.clipboard.writeText(accNo).then(() => {
    const copyBtnText = document.getElementById('copy-btn-text');
    copyBtnText.textContent = 'Copied!';
    setTimeout(() => {
      copyBtnText.textContent = 'Copy';
    }, 2000);
    showToast('Account number copied to clipboard.', 'info');
  }).catch(() => {
    showToast('Could not copy automatically.', 'warning');
  });
}
