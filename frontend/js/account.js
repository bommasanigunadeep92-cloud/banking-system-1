/**
 * ============================================================================
 * Account Details & Profile Script
 * File: frontend/js/account.js
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  requireAuth((authData) => {
    renderDashboardNavigation('account', authData);
    loadAccountAndProfile();
    initProfileUpdateForm();
  });
});

async function loadAccountAndProfile() {
  try {
    const res = await apiFetch('/customers/profile');
    if (res.success && res.data) {
      const data = res.data;

      // Populate account card
      document.getElementById('acc-balance').textContent = formatCurrency(data.balance);
      document.getElementById('acc-number').textContent = data.account_number;
      document.getElementById('acc-type').textContent = `${data.account_type} Account`;
      document.getElementById('acc-customer-id').textContent = `#CUST-${data.customer_id.toString().padStart(5, '0')}`;
      document.getElementById('acc-username').textContent = `@${data.username}`;
      document.getElementById('acc-created-date').textContent = formatDateTime(data.account_opening_date || data.created_at);
      document.getElementById('acc-status-badge').textContent = data.account_status;

      // Populate form
      document.getElementById('edit_full_name').value = data.full_name || '';
      document.getElementById('display_email').value = data.email || '';
      document.getElementById('edit_mobile').value = data.mobile_number || '';
      document.getElementById('display_dob').value = formatDate(data.date_of_birth) || '';
      document.getElementById('edit_address').value = data.address || '';
    }
  } catch (error) {
    console.error('Error loading account profile:', error);
    showToast('Failed to load account profile data.', 'danger');
  }
}

function initProfileUpdateForm() {
  const form = document.getElementById('profile-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName = document.getElementById('edit_full_name').value.trim();
    const mobile = document.getElementById('edit_mobile').value.trim();
    const address = document.getElementById('edit_address').value.trim();
    const alertBox = document.getElementById('account-alert');
    const saveBtn = document.getElementById('save-profile-btn');

    if (!fullName || !mobile || !address) {
      showAlert(alertBox, 'Full name, mobile number, and address are required.', 'danger');
      return;
    }

    try {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Saving...';

      const res = await apiFetch('/customers/profile', {
        method: 'PUT',
        body: JSON.stringify({
          full_name: fullName,
          mobile_number: mobile,
          address: address
        })
      });

      if (res.success) {
        showAlert(alertBox, 'Profile updated successfully!', 'success');
        showToast('Profile updated successfully!', 'success');
      }
    } catch (error) {
      showAlert(alertBox, error.message || 'Failed to update profile.', 'danger');
      showToast(error.message || 'Update failed.', 'danger');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="bi bi-check2"></i><span>Save Profile Changes</span>';
    }
  });
}

function showAlert(element, message, type) {
  if (!element) return;
  element.className = `alert alert-${type} small py-2 px-3 mb-3`;
  element.textContent = message;
  element.classList.remove('d-none');
}
