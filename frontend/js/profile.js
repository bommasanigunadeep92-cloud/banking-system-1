/**
 * ============================================================================
 * Profile & Security Settings Script
 * File: frontend/js/profile.js
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  requireAuth((authData) => {
    renderDashboardNavigation('profile', authData);
    initPasswordChangeForm();

    const userAgentEl = document.getElementById('client-user-agent');
    if (userAgentEl) {
      userAgentEl.textContent = navigator.userAgent;
      userAgentEl.title = navigator.userAgent;
    }
  });
});

function initPasswordChangeForm() {
  const form = document.getElementById('change-password-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentPassword = document.getElementById('current_password').value;
    const newPassword = document.getElementById('new_password').value;
    const confirmNewPassword = document.getElementById('confirm_new_password').value;
    const alertBox = document.getElementById('password-alert');
    const submitBtn = document.getElementById('pwd-submit-btn');

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      showAlert(alertBox, 'All password fields are required.', 'danger');
      return;
    }

    if (newPassword.length < 6) {
      showAlert(alertBox, 'New password must be at least 6 characters long.', 'danger');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      showAlert(alertBox, 'New password confirmation does not match.', 'danger');
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Updating Password...';
      showAlert(alertBox, '', 'd-none');

      const res = await apiFetch('/customers/change-password', {
        method: 'PUT',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_new_password: confirmNewPassword
        })
      });

      if (res.success) {
        showAlert(alertBox, res.message, 'success');
        showToast('Password updated successfully! Keep your new password secure.', 'success');
        form.reset();
      }
    } catch (error) {
      showAlert(alertBox, error.message || 'Failed to update password.', 'danger');
      showToast(error.message || 'Password update failed.', 'danger');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="bi bi-shield-check"></i><span>Update Password</span>';
    }
  });
}

function showAlert(element, message, type) {
  if (!element) return;
  if (type === 'd-none') {
    element.className = 'alert d-none';
    element.textContent = '';
  } else {
    element.className = `alert alert-${type} small py-2 px-3 mb-3`;
    element.textContent = message;
    element.classList.remove('d-none');
  }
}
