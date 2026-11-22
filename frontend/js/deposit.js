/**
 * ============================================================================
 * Deposit Money Script
 * File: frontend/js/deposit.js
 * ============================================================================
 */

let currentAccount = null;

document.addEventListener('DOMContentLoaded', () => {
  requireAuth((authData) => {
    currentAccount = authData.account;
    renderDashboardNavigation('deposit', authData);
    initDepositPage(authData.account);
    initDepositForm();
  });
});

function initDepositPage(account) {
  if (!account) return;
  document.getElementById('deposit_account_number').value = account.account_number;
  document.getElementById('deposit-current-balance').textContent = formatCurrency(account.balance);
}

function setDepositAmount(val) {
  document.getElementById('deposit_amount').value = val.toFixed(2);
}

function initDepositForm() {
  const form = document.getElementById('deposit-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const amountInput = document.getElementById('deposit_amount');
    const descInput = document.getElementById('deposit_description');
    const alertBox = document.getElementById('deposit-alert');
    const submitBtn = document.getElementById('deposit-submit-btn');
    const btnText = document.getElementById('deposit-btn-text');

    const amount = parseFloat(amountInput.value);
    const description = descInput.value.trim() || 'Online Cash Deposit';

    if (isNaN(amount) || amount <= 0) {
      showAlert(alertBox, 'Please enter a valid positive deposit amount greater than $0.', 'danger');
      return;
    }

    try {
      submitBtn.disabled = true;
      btnText.textContent = 'Processing Deposit...';
      showAlert(alertBox, '', 'd-none');

      const res = await apiFetch('/transactions/deposit', {
        method: 'POST',
        body: JSON.stringify({
          amount: amount,
          description: description
        })
      });

      if (res.success && res.data) {
        showToast(res.message, 'success');
        showAlert(alertBox, res.message, 'success');

        // Update real-time balance display
        document.getElementById('deposit-current-balance').textContent = formatCurrency(res.data.new_balance);

        // Show receipt card
        const receiptCard = document.getElementById('last-deposit-card');
        if (receiptCard) {
          receiptCard.classList.remove('d-none');
          document.getElementById('receipt-ref').textContent = res.data.reference_number;
          document.getElementById('receipt-amount').textContent = `+${formatCurrency(res.data.amount)}`;
          document.getElementById('receipt-new-balance').textContent = formatCurrency(res.data.new_balance);
        }

        // Reset form
        amountInput.value = '';
        descInput.value = '';
      }
    } catch (error) {
      showAlert(alertBox, error.message || 'Deposit failed.', 'danger');
      showToast(error.message || 'Deposit failed.', 'danger');
    } finally {
      submitBtn.disabled = false;
      btnText.textContent = 'Confirm & Deposit Funds';
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
