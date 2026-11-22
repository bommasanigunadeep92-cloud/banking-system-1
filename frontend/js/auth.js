/**
 * ============================================================================
 * Authentication Client Script
 * File: frontend/js/auth.js
 * ============================================================================
 * Explanation for Viva:
 * Coordinates login, registration, password visibility toggling, and demo
 * password reset requests. Interacts with Express /api/auth endpoints.
 */

document.addEventListener('DOMContentLoaded', () => {
  // If user is already logged in, redirect straight to dashboard
  redirectIfLoggedIn();

  // Initialize login form if present
  initLoginForm();

  // Initialize registration form if present
  initRegisterForm();

  // Initialize password toggle
  initPasswordToggle();

  // Initialize password reset form if present
  initResetForm();

  // Check if user just logged out
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('logout') === 'success') {
    const alertBox = document.getElementById('login-alert');
    if (alertBox) {
      alertBox.className = 'alert alert-success small py-2 px-3 mb-3';
      alertBox.textContent = 'You have been safely logged out.';
      alertBox.classList.remove('d-none');
    }
  } else if (urlParams.get('session') === 'expired') {
    const alertBox = document.getElementById('login-alert');
    if (alertBox) {
      alertBox.className = 'alert alert-warning small py-2 px-3 mb-3';
      alertBox.textContent = 'Your session has expired. Please sign in again.';
      alertBox.classList.remove('d-none');
    }
  }
});

/**
 * Password Visibility Toggle
 */
function initPasswordToggle() {
  const toggleBtn = document.getElementById('toggle-password-btn');
  const passwordInput = document.getElementById('password');
  const icon = document.getElementById('password-toggle-icon');

  if (toggleBtn && passwordInput && icon) {
    toggleBtn.addEventListener('click', () => {
      const isPassword = passwordInput.getAttribute('type') === 'password';
      passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
      icon.className = isPassword ? 'bi bi-eye-slash' : 'bi bi-eye';
    });
  }
}

/**
 * Login Handler
 */
function initLoginForm() {
  const loginForm = document.getElementById('login-form');
  if (!loginForm) return;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const usernameOrEmail = document.getElementById('username_or_email').value.trim();
    const password = document.getElementById('password').value;
    const alertBox = document.getElementById('login-alert');
    const submitBtn = loginForm.querySelector('button[type="submit"]');

    if (!usernameOrEmail || !password) {
      showAlert(alertBox, 'Please enter both your username/email and password.', 'danger');
      return;
    }

    try {
      // Disable button and show spinner
      submitBtn.disabled = true;
      document.getElementById('login-btn-text').textContent = 'Authenticating...';
      showAlert(alertBox, '', 'd-none');

      const response = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username_or_email: usernameOrEmail,
          password: password
        })
      });

      if (response.success) {
        showToast('Login successful! Redirecting to dashboard...', 'success');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 500);
      }
    } catch (error) {
      showAlert(alertBox, error.message || 'Login failed. Please check credentials.', 'danger');
      showToast(error.message || 'Login failed.', 'danger');
    } finally {
      submitBtn.disabled = false;
      document.getElementById('login-btn-text').textContent = 'Log In to Portal';
    }
  });
}

/**
 * Registration Handler
 */
function initRegisterForm() {
  const registerForm = document.getElementById('register-form');
  if (!registerForm) return;

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName = document.getElementById('full_name').value.trim();
    const email = document.getElementById('email').value.trim();
    const mobileNumber = document.getElementById('mobile_number').value.trim();
    const dateOfBirth = document.getElementById('date_of_birth').value;
    const address = document.getElementById('address').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm_password').value;
    const alertBox = document.getElementById('register-alert');
    const submitBtn = registerForm.querySelector('button[type="submit"]');

    // Client-side validations
    if (!fullName || !email || !mobileNumber || !dateOfBirth || !address || !username || !password) {
      showAlert(alertBox, 'All fields are required. Please fill in the full form.', 'danger');
      return;
    }

    if (password.length < 6) {
      showAlert(alertBox, 'Password must be at least 6 characters long.', 'danger');
      return;
    }

    if (password !== confirmPassword) {
      showAlert(alertBox, 'Passwords do not match. Please verify.', 'danger');
      return;
    }

    try {
      submitBtn.disabled = true;
      document.getElementById('register-btn-text').textContent = 'Creating Account...';
      showAlert(alertBox, '', 'd-none');

      const response = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          full_name: fullName,
          email: email,
          mobile_number: mobileNumber,
          date_of_birth: dateOfBirth,
          address: address,
          username: username,
          password: password,
          confirm_password: confirmPassword
        })
      });

      if (response.success && response.data) {
        // Show success modal with generated account number
        document.getElementById('modal-holder-name').textContent = response.data.full_name;
        document.getElementById('modal-account-number').textContent = response.data.account_number;
        document.getElementById('modal-balance').textContent = formatCurrency(response.data.balance);

        const modal = new bootstrap.Modal(document.getElementById('regSuccessModal'));
        modal.show();
      }
    } catch (error) {
      showAlert(alertBox, error.message || 'Registration failed. Please check your details.', 'danger');
      showToast(error.message || 'Registration failed.', 'danger');
    } finally {
      submitBtn.disabled = false;
      document.getElementById('register-btn-text').textContent = 'Complete Registration & Create Account';
    }
  });
}

/**
 * Password Reset Modal Handler
 */
function initResetForm() {
  const resetForm = document.getElementById('reset-form');
  if (!resetForm) return;

  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('reset_username').value.trim();
    const email = document.getElementById('reset_email').value.trim();
    const dob = document.getElementById('reset_dob').value;
    const newPassword = document.getElementById('reset_new_password').value;
    const alertBox = document.getElementById('reset-alert');

    try {
      const response = await apiFetch('/auth/reset-password-demo', {
        method: 'POST',
        body: JSON.stringify({
          username,
          email,
          date_of_birth: dob,
          new_password: newPassword
        })
      });

      if (response.success) {
        showAlert(alertBox, response.message, 'success');
        showToast('Password reset successfully. You can now login.', 'success');
        resetForm.reset();
      }
    } catch (error) {
      showAlert(alertBox, error.message || 'Verification failed.', 'danger');
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
