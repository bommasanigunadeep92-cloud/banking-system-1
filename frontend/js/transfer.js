/**
 * ============================================================================
 * Money Transfer Script
 * File: frontend/js/transfer.js
 * ============================================================================
 */

let currentAuth = null;
let verifiedBeneficiary = null;
let pendingTransferPayload = null;
let confirmModalInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  requireAuth((authData) => {
    currentAuth = authData;
    renderDashboardNavigation('transfer', authData);
    initTransferPage(authData);
    initBeneficiaryVerification();
    initTransferForm();
  });
});

function initTransferPage(authData) {
  document.getElementById('transfer-sender-account').textContent = authData.account.account_number;
  document.getElementById('transfer-sender-balance').textContent = formatCurrency(authData.account.balance);
  confirmModalInstance = new bootstrap.Modal(document.getElementById('transferConfirmModal'));
}

/**
 * Beneficiary Verification Handler
 */
function initBeneficiaryVerification() {
  const verifyBtn = document.getElementById('verify-beneficiary-btn');
  const receiverInput = document.getElementById('receiver_account_number');

  const performVerification = async () => {
    const accNo = receiverInput.value.trim();
    const previewBox = document.getElementById('beneficiary-preview');
    const nameSpan = document.getElementById('beneficiary-name');
    const alertBox = document.getElementById('transfer-alert');

    if (!accNo) return;

    if (accNo === currentAuth.account.account_number) {
      showAlert(alertBox, 'Self-transfers are not allowed. Please enter a different receiver account.', 'warning');
      previewBox.classList.add('d-none');
      verifiedBeneficiary = null;
      return;
    }

    try {
      verifyBtn.disabled = true;
      verifyBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

      const res = await apiFetch(`/accounts/verify-beneficiary/${accNo}`);
      if (res.success && res.data) {
        verifiedBeneficiary = res.data;
        nameSpan.textContent = res.data.receiver_name;
        previewBox.classList.remove('d-none');
        showAlert(alertBox, '', 'd-none');
      }
    } catch (error) {
      verifiedBeneficiary = null;
      previewBox.classList.add('d-none');
      showAlert(alertBox, error.message || 'Receiver account not found.', 'danger');
    } finally {
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'Verify Name';
    }
  };

  verifyBtn.addEventListener('click', performVerification);
  receiverInput.addEventListener('change', performVerification);
}

/**
 * Transfer Form Submission (Opens Confirmation Modal)
 */
function initTransferForm() {
  const form = document.getElementById('transfer-form');
  const alertBox = document.getElementById('transfer-alert');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const receiverAcc = document.getElementById('receiver_account_number').value.trim();
    const amount = parseFloat(document.getElementById('transfer_amount').value);
    const description = document.getElementById('transfer_description').value.trim() || 'Fund Transfer';

    if (!receiverAcc) {
      showAlert(alertBox, 'Please enter a receiver account number.', 'danger');
      return;
    }

    if (receiverAcc === currentAuth.account.account_number) {
      showAlert(alertBox, 'Sender and receiver accounts cannot be the same.', 'danger');
      return;
    }

    if (isNaN(amount) || amount <= 0) {
      showAlert(alertBox, 'Please enter a valid transfer amount greater than $0.', 'danger');
      return;
    }

    if (amount > currentAuth.account.balance) {
      showAlert(alertBox, `Insufficient funds. Your available balance is ${formatCurrency(currentAuth.account.balance)}.`, 'danger');
      return;
    }

    // If beneficiary name not verified yet, verify now before opening modal
    let receiverName = verifiedBeneficiary ? verifiedBeneficiary.receiver_name : 'Registered Customer';
    if (!verifiedBeneficiary || verifiedBeneficiary.account_number !== receiverAcc) {
      try {
        const verifyRes = await apiFetch(`/accounts/verify-beneficiary/${receiverAcc}`);
        if (verifyRes.success && verifyRes.data) {
          verifiedBeneficiary = verifyRes.data;
          receiverName = verifyRes.data.receiver_name;
        }
      } catch (err) {
        showAlert(alertBox, err.message || 'Invalid receiver account number.', 'danger');
        return;
      }
    }

    // Populate confirmation modal
    document.getElementById('modal-sender-acc').textContent = currentAuth.account.account_number;
    document.getElementById('modal-receiver-name').textContent = receiverName;
    document.getElementById('modal-receiver-acc').textContent = receiverAcc;
    document.getElementById('modal-amount').textContent = formatCurrency(amount);
    document.getElementById('modal-desc').textContent = description;

    // Cache payload for confirmation execution
    pendingTransferPayload = {
      receiver_account_number: receiverAcc,
      amount: amount,
      description: description
    };

    confirmModalInstance.show();
  });

  // Confirm Button inside Modal
  const confirmBtn = document.getElementById('confirm-transfer-btn');
  confirmBtn.addEventListener('click', async () => {
    if (!pendingTransferPayload) return;

    try {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Executing ACID Transfer...';

      const res = await apiFetch('/transactions/transfer', {
        method: 'POST',
        body: JSON.stringify(pendingTransferPayload)
      });

      confirmModalInstance.hide();

      if (res.success && res.data) {
        currentAuth.account.balance = res.data.new_balance;
        document.getElementById('transfer-sender-balance').textContent = formatCurrency(res.data.new_balance);

        showToast(res.message, 'success');
        showAlert(alertBox, res.message, 'success');

        // Show receipt card
        const receiptCard = document.getElementById('transfer-receipt-card');
        if (receiptCard) {
          receiptCard.classList.remove('d-none');
          document.getElementById('trf-receipt-ref').textContent = res.data.reference_number;
          document.getElementById('trf-receipt-receiver').textContent = `${res.data.receiver_name} (${res.data.receiver_account_number})`;
          document.getElementById('trf-receipt-amount').textContent = formatCurrency(res.data.amount);
          document.getElementById('trf-receipt-balance').textContent = formatCurrency(res.data.new_balance);
        }

        // Reset form
        form.reset();
        document.getElementById('beneficiary-preview').classList.add('d-none');
        verifiedBeneficiary = null;
        pendingTransferPayload = null;
      }
    } catch (error) {
      confirmModalInstance.hide();
      showAlert(alertBox, error.message || 'Transfer failed.', 'danger');
      showToast(error.message || 'Transfer failed.', 'danger');
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Execute Transfer Now';
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
