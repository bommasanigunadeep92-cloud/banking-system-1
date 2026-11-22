/**
 * ============================================================================
 * Transaction History & Statement Script
 * File: frontend/js/transactions.js
 * ============================================================================
 */

let currentPage = 1;
const limit = 10;
let currentSort = { by: 'transaction_date', order: 'desc' };

document.addEventListener('DOMContentLoaded', () => {
  requireAuth((authData) => {
    renderDashboardNavigation('transactions', authData);
    initFilterForm();
    initSortSelect();
    loadTransactions();
  });
});

function initFilterForm() {
  const form = document.getElementById('filter-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    currentPage = 1;
    loadTransactions();
  });
}

function resetFilters() {
  document.getElementById('filter-search').value = '';
  document.getElementById('filter-type').value = '';
  document.getElementById('filter-start-date').value = '';
  document.getElementById('filter-end-date').value = '';
  currentPage = 1;
  loadTransactions();
}

function initSortSelect() {
  const select = document.getElementById('sort-select');
  select.addEventListener('change', () => {
    const val = select.value;
    if (val === 'date-desc') currentSort = { by: 'transaction_date', order: 'desc' };
    else if (val === 'date-asc') currentSort = { by: 'transaction_date', order: 'asc' };
    else if (val === 'amount-desc') currentSort = { by: 'amount', order: 'desc' };
    else if (val === 'amount-asc') currentSort = { by: 'amount', order: 'asc' };

    currentPage = 1;
    loadTransactions();
  });
}

async function loadTransactions() {
  const tbody = document.getElementById('transactions-table-body');
  tbody.innerHTML = `
    <tr>
      <td colspan="8" class="text-center py-4 text-muted">
        <div class="spinner-border spinner-border-sm text-primary me-2"></div> Fetching records...
      </td>
    </tr>
  `;

  const search = document.getElementById('filter-search').value.trim();
  const type = document.getElementById('filter-type').value;
  const startDate = document.getElementById('filter-start-date').value;
  const endDate = document.getElementById('filter-end-date').value;

  const params = new URLSearchParams({
    page: currentPage,
    limit: limit,
    sortBy: currentSort.by,
    sortOrder: currentSort.order
  });

  if (search) params.append('search', search);
  if (type) params.append('type', type);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  try {
    const res = await apiFetch(`/transactions/history?${params.toString()}`);
    if (res.success && res.data) {
      renderTable(res.data.transactions);
      renderPagination(res.data.pagination);
    }
  } catch (error) {
    console.error('Error fetching transactions:', error);
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-4 text-danger">
          <i class="bi bi-exclamation-triangle fs-4 d-block mb-1"></i>
          Failed to load transactions. ${error.message}
        </td>
      </tr>
    `;
    showToast('Failed to load transaction history.', 'danger');
  }
}

function renderTable(transactions) {
  const tbody = document.getElementById('transactions-table-body');
  const countText = document.getElementById('results-count-text');

  if (!transactions || transactions.length === 0) {
    countText.textContent = 'No matching records found';
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-5 text-muted">
          <i class="bi bi-inbox fs-2 d-block mb-2"></i>
          No transaction records match the specified search/filters.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = transactions.map(tx => {
    const isDebit = ['WITHDRAWAL', 'TRANSFER_DEBIT'].includes(tx.transaction_type);
    const isCredit = ['DEPOSIT', 'TRANSFER_CREDIT'].includes(tx.transaction_type);

    const debitText = isDebit ? `<span class="amount-negative">-${formatCurrency(tx.amount)}</span>` : '<span class="text-muted">-</span>';
    const creditText = isCredit ? `<span class="amount-positive">+${formatCurrency(tx.amount)}</span>` : '<span class="text-muted">-</span>';

    let badgeClass = 'badge-deposit';
    let typeName = 'Deposit';

    if (tx.transaction_type === 'WITHDRAWAL') {
      badgeClass = 'badge-withdrawal';
      typeName = 'Withdrawal';
    } else if (tx.transaction_type === 'TRANSFER_DEBIT') {
      badgeClass = 'badge-transfer-debit';
      typeName = 'Transfer Out';
    } else if (tx.transaction_type === 'TRANSFER_CREDIT') {
      badgeClass = 'badge-transfer-credit';
      typeName = 'Transfer In';
    }

    return `
      <tr>
        <td><code class="fw-bold text-navy">${tx.reference_number}</code></td>
        <td class="small text-muted">${formatDateTime(tx.transaction_date)}</td>
        <td><span class="badge-txn ${badgeClass}">${typeName}</span></td>
        <td class="small text-truncate" style="max-width: 280px;" title="${tx.description}">${tx.description || '-'}</td>
        <td class="text-end">${debitText}</td>
        <td class="text-end">${creditText}</td>
        <td class="text-end fw-semibold">${formatCurrency(tx.balance_after)}</td>
        <td class="text-center">
          <span class="badge bg-success-subtle text-success">${tx.transaction_status}</span>
        </td>
      </tr>
    `;
  }).join('');
}

function renderPagination(pagination) {
  const { currentPage: cur, totalPages, totalTransactions } = pagination;
  const countText = document.getElementById('results-count-text');
  const infoText = document.getElementById('page-info-text');
  const list = document.getElementById('pagination-list');

  countText.textContent = `Showing ${totalTransactions} total transactions`;
  infoText.textContent = `Page ${cur} of ${totalPages || 1}`;

  if (totalPages <= 1) {
    list.innerHTML = '';
    return;
  }

  let html = `
    <li class="page-item ${cur === 1 ? 'disabled' : ''}">
      <button class="page-link" onclick="goToPage(${cur - 1})">Previous</button>
    </li>
  `;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= cur - 1 && i <= cur + 1)) {
      html += `
        <li class="page-item ${i === cur ? 'active' : ''}">
          <button class="page-link" onclick="goToPage(${i})">${i}</button>
        </li>
      `;
    } else if (i === cur - 2 || i === cur + 2) {
      html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    }
  }

  html += `
    <li class="page-item ${cur === totalPages ? 'disabled' : ''}">
      <button class="page-link" onclick="goToPage(${cur + 1})">Next</button>
    </li>
  `;

  list.innerHTML = html;
}

function goToPage(page) {
  currentPage = page;
  loadTransactions();
}

/**
 * Downloads transaction history as CSV statement
 */
function exportCsvStatement() {
  showToast('Preparing your CSV statement...', 'info');
  window.location.href = `${API_BASE}/transactions/export-csv`;
}
