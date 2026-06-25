/**
 * Union Bank Management System - Main JavaScript
 * Banking operations, authentication UI, modals, and session handling
 */

// ==========================================================================
// Utility Functions
// ==========================================================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatCurrency(amount) {
    return '₹' + parseFloat(amount).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${icons[type] || icons.info}"></i>
        <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function showFieldError(errorId, message, input) {
    const errorEl = document.getElementById(errorId);
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('visible');
    }
    if (input) input.classList.add('error');
}

function clearFormErrors(form) {
    form.querySelectorAll('.error-msg').forEach(el => {
        el.textContent = '';
        el.classList.remove('visible');
    });
    form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
}

function showResultBox(resultId, success, html) {
    const resultBox = document.getElementById(resultId);
    if (!resultBox) return;
    resultBox.className = `result-box ${success ? 'success' : 'error'}`;
    resultBox.innerHTML = html;
    resultBox.classList.remove('hidden');
}

function showPageLoader(show) {
    const loader = document.getElementById('pageLoader');
    if (loader) loader.classList.toggle('hidden', !show);
}

/**
 * Fetch wrapper — handles 401 unauthorized redirects
 */
async function apiFetch(url, options = {}) {
    const response = await fetch(url, options);

    if (response.status === 401) {
        showToast('Session expired. Please login again.', 'error');
        setTimeout(() => {
            window.location.href = '/login';
        }, 1500);
        throw new Error('Unauthorized');
    }

    return response;
}

// ==========================================================================
// Confirmation Modal
// ==========================================================================

let confirmResolve = null;

function showConfirmModal(title, message) {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmModalTitle');
    const messageEl = document.getElementById('confirmModalMessage');
    const cancelBtn = document.getElementById('confirmModalCancel');
    const okBtn = document.getElementById('confirmModalOk');

    if (!modal) return Promise.resolve(true);

    titleEl.textContent = title;
    messageEl.textContent = message;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');

    return new Promise((resolve) => {
        confirmResolve = resolve;

        const onCancel = () => {
            cleanup();
            resolve(false);
        };
        const onOk = () => {
            cleanup();
            resolve(true);
        };

        const cleanup = () => {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
            cancelBtn.removeEventListener('click', onCancel);
            okBtn.removeEventListener('click', onOk);
            confirmResolve = null;
        };

        cancelBtn.addEventListener('click', onCancel);
        okBtn.addEventListener('click', onOk);
    });
}

// ==========================================================================
// Dark Mode Toggle
// ==========================================================================

function initDarkMode() {
    const toggle = document.getElementById('darkModeToggle');
    const savedMode = localStorage.getItem('unionBankDarkMode');

    if (savedMode === 'enabled') {
        document.body.classList.add('dark-mode');
        updateDarkModeIcon(true);
    }

    if (toggle) {
        toggle.addEventListener('click', () => {
            const isDark = document.body.classList.toggle('dark-mode');
            localStorage.setItem('unionBankDarkMode', isDark ? 'enabled' : 'disabled');
            updateDarkModeIcon(isDark);
        });
    }
}

function updateDarkModeIcon(isDark) {
    const toggle = document.getElementById('darkModeToggle');
    if (toggle) {
        const icon = toggle.querySelector('i');
        if (icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    }
}

// ==========================================================================
// Mobile Navigation
// ==========================================================================

function initMobileNav() {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            const icon = hamburger.querySelector('i');
            if (icon) {
                icon.className = navMenu.classList.contains('active') ? 'fas fa-times' : 'fas fa-bars';
            }
        });

        navMenu.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                const icon = hamburger.querySelector('i');
                if (icon) icon.className = 'fas fa-bars';
            });
        });
    }
}

// ==========================================================================
// Password Show/Hide Toggle (Auth Pages)
// ==========================================================================

function initPasswordToggles() {
    document.querySelectorAll('.password-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (!input) return;

            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            const icon = btn.querySelector('i');
            if (icon) icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
        });
    });
}

// ==========================================================================
// Auth Form Client Validation
// ==========================================================================

function initAuthForms() {
    const registerForm = document.querySelector('form[action*="register"]');
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            const password = document.getElementById('password');
            const confirm = document.getElementById('confirm_password');
            const mobile = document.getElementById('mobile');

            if (password && password.value.length < 8) {
                e.preventDefault();
                showToast('Password must be at least 8 characters.', 'error');
                return;
            }
            if (password && confirm && password.value !== confirm.value) {
                e.preventDefault();
                showToast('Password and Confirm Password must match.', 'error');
                return;
            }
            if (mobile && !/^\d{10}$/.test(mobile.value.trim())) {
                e.preventDefault();
                showToast('Mobile number must be 10 digits.', 'error');
            }
        });
    }

    const forgotForm = document.querySelector('form[action*="forgot-password"]');
    if (forgotForm) {
        forgotForm.addEventListener('submit', (e) => {
            const newPass = document.getElementById('new_password');
            const confirm = document.getElementById('confirm_password');
            if (newPass && newPass.value.length < 8) {
                e.preventDefault();
                showToast('Password must be at least 8 characters.', 'error');
                return;
            }
            if (newPass && confirm && newPass.value !== confirm.value) {
                e.preventDefault();
                showToast('New password and confirm password must match.', 'error');
            }
        });
    }
}

// ==========================================================================
// Create Account Form
// ==========================================================================

function initCreateAccountForm() {
    const form = document.getElementById('createAccountForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFormErrors(form);

        const name = document.getElementById('name').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const address = document.getElementById('address').value.trim();
        const initialDeposit = document.getElementById('initial_deposit').value;

        let isValid = true;

        if (!name) {
            showFieldError('nameError', 'Account holder name cannot be empty.', document.getElementById('name'));
            isValid = false;
        }
        if (!/^\d{10}$/.test(phone)) {
            showFieldError('phoneError', 'Phone number must contain exactly 10 digits.', document.getElementById('phone'));
            isValid = false;
        }
        if (!address) {
            showFieldError('addressError', 'Address cannot be empty.', document.getElementById('address'));
            isValid = false;
        }
        const depositNum = parseFloat(initialDeposit);
        if (isNaN(depositNum) || depositNum < 0) {
            showFieldError('depositInitError', 'Initial deposit cannot be negative.', document.getElementById('initial_deposit'));
            isValid = false;
        }
        if (!isValid) return;

        showPageLoader(true);
        try {
            const response = await apiFetch('/create-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone, address, initial_deposit: depositNum })
            });
            const data = await response.json();

            if (data.success) {
                showToast('Account created successfully!', 'success');
                showResultBox('createAccountResult', true, `
                    <strong><i class="fas fa-check-circle"></i> Account Created Successfully!</strong>
                    <div class="result-detail">
                        <strong>Account Number:</strong> ${escapeHtml(data.account_number)}<br>
                        <strong>Customer ID:</strong> ${escapeHtml(data.customer_id)}<br>
                        <strong>Balance:</strong> ${formatCurrency(data.balance)}<br>
                        <strong>Created:</strong> ${escapeHtml(data.created_at)}
                    </div>
                `);
                form.reset();
                document.getElementById('initial_deposit').value = '0';
            } else {
                showToast(data.message, 'error');
                showResultBox('createAccountResult', false,
                    `<strong><i class="fas fa-times-circle"></i> ${escapeHtml(data.message)}</strong>`
                );
            }
        } catch (error) {
            if (error.message !== 'Unauthorized') {
                showToast('Network error. Please try again.', 'error');
            }
        } finally {
            showPageLoader(false);
        }
    });
}

// ==========================================================================
// Deposit Form
// ==========================================================================

function initDepositForm() {
    const form = document.getElementById('depositForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFormErrors(form);

        const accountNumber = document.getElementById('deposit_account').value.trim();
        const amount = document.getElementById('deposit_amount').value;
        let isValid = true;

        if (!accountNumber) {
            showFieldError('depositAccountError', 'Account number is required.', document.getElementById('deposit_account'));
            isValid = false;
        }
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            showFieldError('depositAmountError', 'Amount must be greater than 0.', document.getElementById('deposit_amount'));
            isValid = false;
        }
        if (!isValid) return;

        const confirmed = await showConfirmModal(
            'Confirm Deposit',
            `Deposit ${formatCurrency(amountNum)} to account ${accountNumber}?`
        );
        if (!confirmed) return;

        showPageLoader(true);
        try {
            const response = await apiFetch('/deposit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ account_number: accountNumber, amount: amountNum })
            });
            const data = await response.json();

            if (data.success) {
                showToast(`Deposit of ${formatCurrency(data.deposit_amount)} successful!`, 'success');
                showResultBox('depositResult', true, `
                    <strong><i class="fas fa-check-circle"></i> Deposit Successful!</strong>
                    <div class="result-detail">
                        <strong>Previous Balance:</strong> ${formatCurrency(data.previous_balance)}<br>
                        <strong>Deposit:</strong> ${formatCurrency(data.deposit_amount)}<br>
                        <strong>New Balance:</strong> ${formatCurrency(data.new_balance)}
                    </div>
                `);
                form.reset();
            } else {
                showToast(data.message, 'error');
                showResultBox('depositResult', false,
                    `<strong><i class="fas fa-times-circle"></i> ${escapeHtml(data.message)}</strong>`
                );
            }
        } catch (error) {
            if (error.message !== 'Unauthorized') showToast('Network error. Please try again.', 'error');
        } finally {
            showPageLoader(false);
        }
    });
}

// ==========================================================================
// Withdraw Form
// ==========================================================================

function initWithdrawForm() {
    const form = document.getElementById('withdrawForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFormErrors(form);

        const accountNumber = document.getElementById('withdraw_account').value.trim();
        const amount = document.getElementById('withdraw_amount').value;
        let isValid = true;

        if (!accountNumber) {
            showFieldError('withdrawAccountError', 'Account number is required.', document.getElementById('withdraw_account'));
            isValid = false;
        }
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            showFieldError('withdrawAmountError', 'Amount must be greater than 0.', document.getElementById('withdraw_amount'));
            isValid = false;
        }
        if (!isValid) return;

        const confirmed = await showConfirmModal(
            'Confirm Withdrawal',
            `Withdraw ${formatCurrency(amountNum)} from account ${accountNumber}?`
        );
        if (!confirmed) return;

        showPageLoader(true);
        try {
            const response = await apiFetch('/withdraw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ account_number: accountNumber, amount: amountNum })
            });
            const data = await response.json();

            if (data.success) {
                showToast(`Withdrawal of ${formatCurrency(data.withdraw_amount)} successful!`, 'success');
                showResultBox('withdrawResult', true, `
                    <strong><i class="fas fa-check-circle"></i> Withdrawal Successful!</strong>
                    <div class="result-detail">
                        <strong>Previous Balance:</strong> ${formatCurrency(data.previous_balance)}<br>
                        <strong>Withdraw:</strong> ${formatCurrency(data.withdraw_amount)}<br>
                        <strong>New Balance:</strong> ${formatCurrency(data.new_balance)}
                    </div>
                `);
                form.reset();
            } else {
                showToast(data.message, 'error');
                showResultBox('withdrawResult', false,
                    `<strong><i class="fas fa-times-circle"></i> ${escapeHtml(data.message)}</strong>`
                );
            }
        } catch (error) {
            if (error.message !== 'Unauthorized') showToast('Network error. Please try again.', 'error');
        } finally {
            showPageLoader(false);
        }
    });
}

// ==========================================================================
// Account Search Form
// ==========================================================================

function initAccountSearchForm() {
    const form = document.getElementById('searchAccountForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFormErrors(form);

        const accountNumber = document.getElementById('search_account').value.trim();
        if (!accountNumber) {
            showFieldError('searchAccountError', 'Account number is required.', document.getElementById('search_account'));
            return;
        }

        showPageLoader(true);
        try {
            const response = await apiFetch(`/account/${accountNumber}`);
            const data = await response.json();

            if (data.success) {
                const account = data.account;
                document.getElementById('detailName').textContent = account.name;
                document.getElementById('detailPhone').textContent = account.phone;
                document.getElementById('detailAccountNumber').textContent = account.account_number;
                document.getElementById('detailCustomerId').textContent = account.customer_id;
                document.getElementById('detailBalance').textContent = formatCurrency(account.balance);
                document.getElementById('detailCreatedAt').textContent = account.created_at;
                document.getElementById('accountDetails').classList.remove('hidden');
                showToast('Account found!', 'success');
            } else {
                document.getElementById('accountDetails').classList.add('hidden');
                showToast(data.message, 'error');
            }
        } catch (error) {
            if (error.message !== 'Unauthorized') showToast('Network error. Please try again.', 'error');
        } finally {
            showPageLoader(false);
        }
    });
}

// ==========================================================================
// Transaction History
// ==========================================================================

function getTransactionBadgeClass(type) {
    switch (type) {
        case 'Account Creation': return 'badge-creation';
        case 'Deposit': return 'badge-deposit';
        case 'Withdrawal': return 'badge-withdrawal';
        default: return '';
    }
}

async function loadTransactions() {
    const loading = document.getElementById('transactionsLoading');
    const empty = document.getElementById('transactionsEmpty');
    const tableWrapper = document.getElementById('transactionsTableWrapper');
    const tbody = document.getElementById('transactionsBody');

    if (!loading || !tbody) return;

    loading.classList.remove('hidden');
    empty.classList.add('hidden');
    tableWrapper.classList.add('hidden');

    try {
        const response = await apiFetch('/transactions');
        const data = await response.json();
        loading.classList.add('hidden');

        if (data.success && data.transactions.length > 0) {
            tbody.innerHTML = data.transactions.map(tx => `
                <tr>
                    <td>#${escapeHtml(String(tx.id))}</td>
                    <td>${escapeHtml(tx.account_number)}</td>
                    <td>
                        <span class="badge ${getTransactionBadgeClass(tx.transaction_type)}">
                            ${escapeHtml(tx.transaction_type)}
                        </span>
                    </td>
                    <td class="${tx.transaction_type === 'Withdrawal' ? 'amount-negative' : 'amount-positive'}">
                        ${formatCurrency(tx.amount)}
                    </td>
                    <td>${escapeHtml(tx.transaction_date)}</td>
                </tr>
            `).join('');
            tableWrapper.classList.remove('hidden');
        } else {
            empty.classList.remove('hidden');
        }
    } catch (error) {
        loading.classList.add('hidden');
        if (error.message !== 'Unauthorized') showToast('Failed to load transactions.', 'error');
    }
}

function initTransactionsPage() {
    const refreshBtn = document.getElementById('refreshTransactions');
    if (document.getElementById('transactionsTable')) loadTransactions();

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadTransactions();
            showToast('Transactions refreshed.', 'info');
        });
    }
}

// ==========================================================================
// Application Initialization
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    initDarkMode();
    initMobileNav();
    initPasswordToggles();
    initAuthForms();
    initCreateAccountForm();
    initDepositForm();
    initWithdrawForm();
    initAccountSearchForm();
    initTransactionsPage();
});
