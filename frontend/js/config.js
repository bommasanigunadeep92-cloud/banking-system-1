/**
 * ============================================================================
 * Frontend Shared Utilities & API Client
 * File: frontend/js/config.js
 * ============================================================================
 * Explanation for Viva:
 * This file serves as the centralized utility library for all frontend pages.
 * It encapsulates HTTP requests using the browser's Fetch API, handles
 * session authentication checks, renders the responsive sidebar navigation,
 * and displays feedback notifications.
 */

const API_BASE = '/api';

/**
 * Enhanced fetch wrapper that handles JSON serialization, cookies, and errors
 */
async function apiFetch(endpoint, options = {}) {
  const defaultHeaders = {
    'Accept': 'application/json'
  };

  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {})
    },
    credentials: 'same-origin' // Ensures session cookie is sent with request
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const contentType = response.headers.get('content-type');

    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      // If server returned 401 Unauthorized on a protected API, clear any stale state
      if (response.status === 401 && !window.location.pathname.includes('login.html') && !window.location.pathname.includes('index.html')) {
        sessionStorage.clear();
        window.location.href = 'login.html?session=expired';
      }
      throw new Error(data.message || `Request failed with status ${response.status}`);
    }

    return data;
  } catch (error) {
    throw error;
  }
}

/**
 * Display a modern Toast notification
 * @param {string} message - Message text
 * @param {'success'|'danger'|'warning'|'info'} type - Bootstrap color variant
 */
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: 'bi-check-circle-fill text-success',
    danger: 'bi-exclamation-triangle-fill text-danger',
    warning: 'bi-exclamation-circle-fill text-warning',
    info: 'bi-info-circle-fill text-primary'
  };

  const toastId = 'toast-' + Math.random().toString(36).substr(2, 9);
  const toastHtml = `
    <div id="${toastId}" class="toast align-items-center bg-white border-0 shadow-lg mb-2" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex p-2">
        <div class="toast-body d-flex align-items-center gap-2">
          <i class="bi ${icons[type] || icons.info} fs-5"></i>
          <span class="text-dark fw-medium">${message}</span>
        </div>
        <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', toastHtml);
  const toastElement = document.getElementById(toastId);
  const bsToast = new bootstrap.Toast(toastElement, { delay: 4500 });
  bsToast.show();

  toastElement.addEventListener('hidden.bs.toast', () => {
    toastElement.remove();
  });
}

/**
 * Display global loading overlay
 */
function showLoading(text = 'Processing secure request...') {
  let overlay = document.getElementById('loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.innerHTML = `
      <div class="spinner-content">
        <div class="spinner-border text-primary" role="status" style="width: 2.2rem; height: 2.2rem;">
          <span class="visually-hidden">Loading...</span>
        </div>
        <span id="loading-overlay-text" class="fw-semibold text-navy">${text}</span>
      </div>
    `;
    document.body.appendChild(overlay);
  } else {
    document.getElementById('loading-overlay-text').textContent = text;
  }
  overlay.style.display = 'flex';
}

/**
 * Hide global loading overlay
 */
function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

/**
 * Format numeric currency value as $ 1,250.00
 */
function formatCurrency(amount) {
  const num = parseFloat(amount);
  if (isNaN(num)) return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Format datetime into readable format
 */
function formatDateTime(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format date (YYYY-MM-DD)
 */
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toISOString().split('T')[0];
}

/**
 * Fetch authenticated customer data from /api/auth/me
 */
async function getAuthData() {
  try {
    const res = await apiFetch('/auth/me');
    return res.data;
  } catch (error) {
    return null;
  }
}

/**
 * Route protection: enforces that the user must be authenticated
 */
async function requireAuth(onSuccess) {
  showLoading('Verifying credentials...');
  try {
    const authData = await getAuthData();
    hideLoading();
    if (!authData || !authData.customer) {
      window.location.href = 'login.html';
      return;
    }
    if (typeof onSuccess === 'function') {
      onSuccess(authData);
    }
  } catch (error) {
    hideLoading();
    window.location.href = 'login.html';
  }
}

/**
 * Route protection: redirects already logged-in users away from login/register to dashboard
 */
async function redirectIfLoggedIn() {
  const authData = await getAuthData();
  if (authData && authData.customer) {
    window.location.href = 'dashboard.html';
  }
}

/**
 * Log out user, destroy session, and redirect to login page
 */
async function logout() {
  try {
    showLoading('Logging out securely...');
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch (err) {
    console.error('Logout error:', err);
  } finally {
    sessionStorage.clear();
    hideLoading();
    window.location.href = 'login.html';
  }
}

/**
 * Dynamically renders the sidebar and top navbar for all dashboard pages
 * @param {string} activePage - Name of the active page ('dashboard'|'account'|'deposit'|'withdraw'|'transfer'|'transactions'|'profile')
 * @param {object} authData - Authenticated customer & account object
 */
function renderDashboardNavigation(activePage, authData) {
  const customerName = authData.customer.full_name || 'Customer';
  const accountNumber = authData.account.account_number || 'N/A';

  // Render Sidebar
  const sidebarContainer = document.getElementById('sidebar-container');
  if (sidebarContainer) {
    sidebarContainer.innerHTML = `
      <div class="sidebar" id="app-sidebar">
        <div class="sidebar-header d-flex justify-content-between align-items-center">
          <a href="dashboard.html" class="sidebar-brand">
            <i class="bi bi-bank2"></i>
            <span>ApexTrust</span>
          </a>
          <button class="btn btn-sm btn-link d-lg-none text-muted" onclick="toggleSidebar()">
            <i class="bi bi-x-lg fs-5"></i>
          </button>
        </div>

        <div class="px-3 py-3 border-bottom">
          <div class="d-flex align-items-center gap-2">
            <div class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold" style="width: 40px; height: 40px;">
              ${customerName.charAt(0).toUpperCase()}
            </div>
            <div class="overflow-hidden">
              <div class="fw-semibold text-truncate" style="max-width: 160px;">${customerName}</div>
              <small class="text-muted-bank d-block">Acc: ${accountNumber}</small>
            </div>
          </div>
        </div>

        <ul class="sidebar-nav">
          <li class="sidebar-item">
            <a href="dashboard.html" class="sidebar-link ${activePage === 'dashboard' ? 'active' : ''}">
              <i class="bi bi-speedometer2"></i>
              <span>Dashboard</span>
            </a>
          </li>
          <li class="sidebar-item">
            <a href="account.html" class="sidebar-link ${activePage === 'account' ? 'active' : ''}">
              <i class="bi bi-wallet2"></i>
              <span>Account Details</span>
            </a>
          </li>
          <li class="sidebar-item">
            <a href="deposit.html" class="sidebar-link ${activePage === 'deposit' ? 'active' : ''}">
              <i class="bi bi-arrow-down-circle"></i>
              <span>Deposit Money</span>
            </a>
          </li>
          <li class="sidebar-item">
            <a href="withdraw.html" class="sidebar-link ${activePage === 'withdraw' ? 'active' : ''}">
              <i class="bi bi-arrow-up-circle"></i>
              <span>Withdraw Money</span>
            </a>
          </li>
          <li class="sidebar-item">
            <a href="transfer.html" class="sidebar-link ${activePage === 'transfer' ? 'active' : ''}">
              <i class="bi bi-arrow-left-right"></i>
              <span>Money Transfer</span>
            </a>
          </li>
          <li class="sidebar-item">
            <a href="transactions.html" class="sidebar-link ${activePage === 'transactions' ? 'active' : ''}">
              <i class="bi bi-clock-history"></i>
              <span>Transactions</span>
            </a>
          </li>
          <li class="sidebar-item">
            <a href="profile.html" class="sidebar-link ${activePage === 'profile' ? 'active' : ''}">
              <i class="bi bi-shield-lock"></i>
              <span>Profile & Security</span>
            </a>
          </li>
        </ul>

        <div class="p-3 border-top mt-auto">
          <button class="btn btn-outline-danger w-100 d-flex align-items-center justify-content-center gap-2" onclick="logout()">
            <i class="bi bi-box-arrow-right"></i>
            <span>Log Out</span>
          </button>
        </div>
      </div>
    `;
  }

  // Render Top Navbar
  const navbarContainer = document.getElementById('top-navbar-container');
  if (navbarContainer) {
    navbarContainer.innerHTML = `
      <header class="top-navbar">
        <div class="d-flex align-items-center gap-3">
          <button class="btn btn-light d-lg-none border" onclick="toggleSidebar()">
            <i class="bi bi-list fs-5"></i>
          </button>
          <div>
            <h5 class="mb-0 text-navy fw-semibold" id="page-title">${getPageTitle(activePage)}</h5>
            <small class="text-muted-bank d-none d-sm-inline">ApexTrust Online Banking Portal</small>
          </div>
        </div>

        <div class="d-flex align-items-center gap-3">
          <span class="badge bg-success-subtle text-success border border-success px-3 py-2 rounded-pill d-none d-md-flex align-items-center gap-1">
            <i class="bi bi-dot fs-5"></i> System Online
          </span>
          <div class="dropdown">
            <button class="btn btn-light border d-flex align-items-center gap-2 dropdown-toggle" type="button" data-bs-toggle="dropdown">
              <i class="bi bi-person-circle fs-5 text-primary"></i>
              <span class="fw-medium d-none d-sm-inline">${customerName.split(' ')[0]}</span>
            </button>
            <ul class="dropdown-menu dropdown-menu-end shadow-sm">
              <li><h6 class="dropdown-header">Logged in as @${authData.customer.username}</h6></li>
              <li><a class="dropdown-item" href="account.html"><i class="bi bi-wallet2 me-2"></i>My Account</a></li>
              <li><a class="dropdown-item" href="profile.html"><i class="bi bi-gear me-2"></i>Security Settings</a></li>
              <li><hr class="dropdown-divider"></li>
              <li><button class="dropdown-item text-danger" onclick="logout()"><i class="bi bi-box-arrow-right me-2"></i>Log Out</button></li>
            </ul>
          </div>
        </div>
      </header>
    `;
  }
}

function getPageTitle(activePage) {
  const titles = {
    dashboard: 'Dashboard Overview',
    account: 'Account Details',
    deposit: 'Deposit Funds',
    withdraw: 'Withdraw Funds',
    transfer: 'Fund Transfer',
    transactions: 'Transaction History',
    profile: 'Profile & Security Settings'
  };
  return titles[activePage] || 'Banking Portal';
}

function toggleSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  if (sidebar) {
    sidebar.classList.toggle('show');
  }
}
