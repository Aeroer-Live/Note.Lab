// Forgot Password Functionality
class ForgotPasswordManager {
    constructor() {
        this.currentStep = 'request';
        this.requestedEmail = '';
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.setupPasswordToggles();
        this.checkUrlParams();
    }
    
    bindEvents() {
        // Request form submission
        document.getElementById('requestForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRequestReset();
        });
        
        // Reset form submission
        document.getElementById('resetForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleResetPassword();
        });
        
        // Tab navigation
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const step = e.target.dataset.step;
                this.switchStep(step);
            });
        });
        
        // Success message actions
        document.getElementById('resendBtn').addEventListener('click', () => {
            this.handleRequestReset();
        });
        
        document.getElementById('backToLoginBtn').addEventListener('click', () => {
            window.location.href = 'login.html';
        });
    }
    
    setupPasswordToggles() {
        // New password toggle
        const newPasswordToggle = document.getElementById('newPasswordToggle');
        const newPasswordInput = document.getElementById('newPassword');
        
        newPasswordToggle.addEventListener('click', () => {
            const type = newPasswordInput.type === 'password' ? 'text' : 'password';
            newPasswordInput.type = type;
            newPasswordToggle.querySelector('.eye-icon').style.opacity = type === 'password' ? '1' : '0.5';
        });
        
        // Confirm password toggle
        const confirmPasswordToggle = document.getElementById('confirmPasswordToggle');
        const confirmPasswordInput = document.getElementById('confirmNewPassword');
        
        confirmPasswordToggle.addEventListener('click', () => {
            const type = confirmPasswordInput.type === 'password' ? 'text' : 'password';
            confirmPasswordInput.type = type;
            confirmPasswordToggle.querySelector('.eye-icon').style.opacity = type === 'password' ? '1' : '0.5';
        });
    }
    
    checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const email = urlParams.get('email');
        
        if (token && email) {
            // User clicked reset link from email
            this.requestedEmail = email;
            document.getElementById('resetToken').value = token;
            this.switchStep('reset');
        }
    }
    
    switchStep(step) {
        this.currentStep = step;
        
        // Update tab visibility
        document.getElementById('requestTab').style.display = step === 'request' ? 'block' : 'none';
        document.getElementById('resetTab').style.display = step === 'reset' ? 'block' : 'none';
        
        // Update tab active state
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.step === step);
        });
        
        // Show/hide forms
        document.getElementById('requestForm').style.display = step === 'request' ? 'block' : 'none';
        document.getElementById('resetForm').style.display = step === 'reset' ? 'block' : 'none';
        document.getElementById('successMessage').style.display = 'none';
        
        // Clear messages
        this.clearMessages();
    }
    
    async handleRequestReset() {
        const email = document.getElementById('email').value.trim();
        
        if (!email) {
            this.showMessage('Please enter your email address', 'error');
            return;
        }
        
        if (!this.isValidEmail(email)) {
            this.showMessage('Please enter a valid email address', 'error');
            return;
        }
        
        this.setLoading('requestBtn', true);
        
        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.requestedEmail = email;
                this.showSuccessMessage();
            } else {
                this.showMessage(data.message || 'Failed to send reset email', 'error');
            }
        } catch (error) {
            console.error('Request reset error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        } finally {
            this.setLoading('requestBtn', false);
        }
    }
    
    async handleResetPassword() {
        const token = document.getElementById('resetToken').value.trim();
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmNewPassword').value;
        
        // Validation
        if (!token) {
            this.showMessage('Please enter the reset token', 'error');
            return;
        }
        
        if (!newPassword) {
            this.showMessage('Please enter a new password', 'error');
            return;
        }
        
        if (newPassword.length < 6) {
            this.showMessage('Password must be at least 6 characters long', 'error');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            this.showMessage('Passwords do not match', 'error');
            return;
        }
        
        this.setLoading('resetBtn', true);
        
        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    token,
                    password: newPassword
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.showMessage('Password reset successfully! Redirecting to login...', 'success');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            } else {
                this.showMessage(data.message || 'Failed to reset password', 'error');
            }
        } catch (error) {
            console.error('Reset password error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        } finally {
            this.setLoading('resetBtn', false);
        }
    }
    
    showSuccessMessage() {
        document.getElementById('requestForm').style.display = 'none';
        document.getElementById('resetForm').style.display = 'none';
        document.getElementById('successMessage').style.display = 'block';
        
        // Update success message with email
        const successMessage = document.querySelector('#successMessage p');
        successMessage.textContent = `We've sent a password reset link to ${this.requestedEmail}. Please check your inbox and follow the instructions to reset your password.`;
    }
    
    showMessage(message, type = 'info') {
        const messageContainer = document.getElementById('messageContainer');
        
        // Remove existing messages
        messageContainer.innerHTML = '';
        
        // Create message element
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.textContent = message;
        
        // Add close button for success/error messages
        if (type === 'success' || type === 'error') {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'message-close';
            closeBtn.innerHTML = '×';
            closeBtn.addEventListener('click', () => {
                messageEl.remove();
            });
            messageEl.appendChild(closeBtn);
        }
        
        messageContainer.appendChild(messageEl);
        
        // Auto-remove success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.remove();
                }
            }, 5000);
        }
    }
    
    clearMessages() {
        document.getElementById('messageContainer').innerHTML = '';
    }
    
    setLoading(buttonId, loading) {
        const button = document.getElementById(buttonId);
        const btnText = button.querySelector('.btn-text');
        const btnLoading = button.querySelector('.btn-loading');
        
        if (loading) {
            btnText.style.display = 'none';
            btnLoading.style.display = 'flex';
            button.disabled = true;
        } else {
            btnText.style.display = 'block';
            btnLoading.style.display = 'none';
            button.disabled = false;
        }
    }
    
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ForgotPasswordManager();
});
