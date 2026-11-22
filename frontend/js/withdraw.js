/**
 * ============================================================================
 * Withdraw Cash Script
 * File: frontend/js/withdraw.js
 * ============================================================================
 */

let currentBalance = 0;

document.addEventListener('DOMContentLoaded', () => {
  requireAuth((authData) => {
    currentBalance = authData.account.balance;
    renderDashboardNavigation('withdraw', authData);
    initWithdrawPage(authData.account);
    initWithdrawForm();
  });
});

function initWithdrawPage(account) {
  if (!account) return;
  document.getElementById('withdraw_account_number').value = account.account_number;
  document.getElementById('withdraw-current-balance').textContent = formatCurrency(account.balance);

  // Add real-time input listener to warn about insufficient funds immediately
  const amountInput = document.getElementById('withdraw_amount');
  const warningEl = document.getElementById('insufficient-warning');

  amountInput.addEventListener('input', () => {
    const entered = parseFloat(amountInput.value);
    if (!isNaN(entered) && entered > currentBalance) {
      warningEl.style.display = 'block';
    } else {
      warningEl.style.display = 'none';
    }
  });
}

function setWithdrawAmount(val) {
  const input = document.getElementById('withdraw_amount');
  input.value = val.toFixed(2);
  input.dispatchEvent(new Event('input'));
}

function initWithdrawForm() {
  const form = document.getElementById('withdraw-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const amountInput = document.getElementById('withdraw_amount');
    const descInput = document.getElementById('withdraw_description');
    const alertBox = document.getElementById('withdraw-alert');
    const submitBtn = document.getElementById('withdraw-submit-btn');
    const btnText = document.getElementById('withdraw-btn-text');

    const amount = parseFloat(amountInput.value);
    const description = descInput.value.trim() || 'ATM / Cash Withdrawal';

    if (isNaN(amount) || amount <= 0) {
      showAlert(alertBox, 'Please enter a valid positive withdrawal amount greater than $0.', 'danger');
      return;
    }

    if (amount > currentBalance) {
      showAlert(alertBox, `Insufficient funds. Your available balance is ${formatCurrency(currentBalance)}.`, 'danger');
      return;
    }

    try {
      submitBtn.disabled = true;
      btnText.textContent = 'Processing Withdrawal...';
      showAlert(alertBox, '', 'd-none');

      const res = await apiFetch('/transactions/withdraw', {
        method: 'POST',
        body: JSON.stringify({
          amount: amount,
          description: description
        })
      });

      if (res.success && res.data) {
        currentBalance = res.data.new_balance;
        showToast(res.message, 'success');
        showAlert(alertBox, res.message, 'success');

        // Update balance display
        document.getElementById('withdraw-current-balance').textContent = formatCurrency(res.data.new_balance);

        // Show receipt card
        const receiptCard = document.getElementById('last-withdraw-card');
        if (receiptCard) {
          receiptCard.classList.remove('d-none');
          document.getElementById('withdraw-receipt-ref').textContent = res.data.reference_number;
          document.getElementById('withdraw-receipt-amount').textContent = `-${formatCurrency(res.data.amount)}`;
          document.getElementById('withdraw-receipt-new-balance').textContent = formatCurrency(res.data.new_balance);
        }

        // Reset inputs
        amountInput.value = '';
        descInput.value = '';
        document.getElementById('insufficient-warning').style.display = 'none';
      }
    } catch (error) {
      showAlert(alertBox, error.message || 'Withdrawal failed.', 'danger');
      showToast(error.message || 'Withdrawal failed.', 'danger');
    } finally {
      submitBtn.disabled = false;
      btnText.textContent = 'Confirm & Withdraw Cash';
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
