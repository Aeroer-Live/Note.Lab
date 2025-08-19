// Login Page JavaScript
class LoginManager {
    constructor() {
        this.currentMode = 'signin';
        this.apiBase = '/api'; // Will be handled by Cloudflare Workers
        this.init();
    }
    
    init() {
        // Check if already authenticated
        this.checkExistingSession();
        
        // Bind events
        this.bindEvents();
        
        // Initialize form state
        this.updateFormState();
    }
    
    checkExistingSession() {
        const session = localStorage.getItem('notelab_session');
        if (session) {
            try {
                const sessionData = JSON.parse(session);
                // Check if session is still valid
                if (sessionData.expiresAt && sessionData.expiresAt > Date.now()) {
                    // Redirect to main app
                    window.location.href = 'index.html';
                    return;
                }
            } catch (e) {
                // Invalid session data, remove it
                localStorage.removeItem('notelab_session');
            }
        }
    }
    
    bindEvents() {
        // Auth tab switching
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const mode = e.currentTarget.dataset.mode;
                this.switchMode(mode);
            });
        });
        
        // Form submission
        document.getElementById('authForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });
        
        // Demo button
        document.getElementById('demoBtn').addEventListener('click', () => {
            this.useDemoAccount();
        });
        
        // Password toggle
        document.getElementById('passwordToggle').addEventListener('click', () => {
            this.togglePasswordVisibility();
        });
        
        // Enter key handling
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
                e.preventDefault();
                this.handleSubmit();
            }
        });
        
        // Real-time validation
        ['fullName', 'email', 'password', 'confirmPassword'].forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('blur', () => this.validateField(fieldId));
                field.addEventListener('input', () => this.clearFieldError(fieldId));
            }
        });
        
        // Forgot password link
        document.querySelector('.forgot-link').addEventListener('click', (e) => {
            e.preventDefault();
            this.showForgotPassword();
        });
    }
    
    switchMode(mode) {
        if (this.currentMode === mode) return;
        
        this.currentMode = mode;
        
        // Update tab appearance
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
        
        // Update form state
        this.updateFormState();
        
        // Clear messages and form
        this.clearMessages();
        document.getElementById('authForm').reset();
        
        // Add smooth transition effect
        const formContainer = document.querySelector('.login-form-container');
        formContainer.style.transform = 'scale(0.98)';
        formContainer.style.opacity = '0.8';
        
        setTimeout(() => {
            formContainer.style.transform = 'scale(1)';
            formContainer.style.opacity = '1';
        }, 100);
    }
    
    updateFormState() {
        const isSignUp = this.currentMode === 'signup';
        
        // Toggle form fields
        const nameGroup = document.getElementById('nameGroup');
        const confirmPasswordGroup = document.getElementById('confirmPasswordGroup');
        const rememberGroup = document.getElementById('rememberGroup');
        const submitBtn = document.getElementById('submitBtn');
        const btnText = submitBtn.querySelector('.btn-text');
        const loadingText = submitBtn.querySelector('.loading-text');
        
        // Show/hide fields
        nameGroup.style.display = isSignUp ? 'flex' : 'none';
        confirmPasswordGroup.style.display = isSignUp ? 'flex' : 'none';
        rememberGroup.style.display = isSignUp ? 'none' : 'flex';
        
        // Update button text
        btnText.textContent = isSignUp ? 'Create Account' : 'Sign In';
        loadingText.textContent = isSignUp ? 'Creating account...' : 'Signing in...';
        
        // Update form attributes
        const fullNameField = document.getElementById('fullName');
        const passwordField = document.getElementById('password');
        const confirmPasswordField = document.getElementById('confirmPassword');
        
        if (isSignUp) {
            fullNameField.setAttribute('required', 'true');
            passwordField.setAttribute('autocomplete', 'new-password');
            confirmPasswordField.setAttribute('required', 'true');
        } else {
            fullNameField.removeAttribute('required');
            passwordField.setAttribute('autocomplete', 'current-password');
            confirmPasswordField.removeAttribute('required');
        }
        
        // Focus first field
        setTimeout(() => {
            if (isSignUp) {
                document.getElementById('fullName').focus();
            } else {
                document.getElementById('email').focus();
            }
        }, 150);
    }
    
    async handleSubmit() {
        // Get form data
        const fullName = document.getElementById('fullName').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const rememberMe = document.getElementById('rememberMe').checked;
        
        // Validate form
        if (!this.validateForm(fullName, email, password, confirmPassword)) {
            return;
        }
        
        // Show loading state
        this.setLoading(true);
        
        try {
            if (this.currentMode === 'signin') {
                await this.signIn(email, password, rememberMe);
            } else {
                await this.signUp(fullName, email, password);
            }
        } catch (error) {
            this.showMessage(error.message, 'error');
        } finally {
            this.setLoading(false);
        }
    }
    
    validateForm(fullName, email, password, confirmPassword) {
        this.clearMessages();
        
        // Sign up specific validation
        if (this.currentMode === 'signup') {
            if (!fullName) {
                this.showMessage('Full name is required', 'error');
                document.getElementById('fullName').focus();
                return false;
            }
            
            if (fullName.length < 2) {
                this.showMessage('Full name must be at least 2 characters long', 'error');
                document.getElementById('fullName').focus();
                return false;
            }
        }
        
        // Email validation
        if (!email) {
            this.showMessage('Email is required', 'error');
            document.getElementById('email').focus();
            return false;
        }
        
        if (!this.isValidEmail(email)) {
            this.showMessage('Please enter a valid email address', 'error');
            document.getElementById('email').focus();
            return false;
        }
        
        // Password validation
        if (!password) {
            this.showMessage('Password is required', 'error');
            document.getElementById('password').focus();
            return false;
        }
        
        if (password.length < 6) {
            this.showMessage('Password must be at least 6 characters long', 'error');
            document.getElementById('password').focus();
            return false;
        }
        
        // Sign up specific password validation
        if (this.currentMode === 'signup') {
            if (password !== confirmPassword) {
                this.showMessage('Passwords do not match', 'error');
                document.getElementById('confirmPassword').focus();
                return false;
            }
        }
        
        return true;
    }
    
    validateField(fieldId) {
        const field = document.getElementById(fieldId);
        const value = field.value.trim();
        
        switch (fieldId) {
            case 'fullName':
                if (value && value.length < 2) {
                    this.showFieldError(fieldId, 'Name too short');
                    return false;
                }
                break;
            case 'email':
                if (value && !this.isValidEmail(value)) {
                    this.showFieldError(fieldId, 'Invalid email format');
                    return false;
                }
                break;
            case 'password':
                if (value && value.length < 6) {
                    this.showFieldError(fieldId, 'Password too short');
                    return false;
                }
                break;
            case 'confirmPassword':
                const password = document.getElementById('password').value;
                if (value && value !== password) {
                    this.showFieldError(fieldId, 'Passwords do not match');
                    return false;
                }
                break;
        }
        
        this.clearFieldError(fieldId);
        return true;
    }
    
    showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        field.style.borderColor = '#ff6b6b';
        
        // Remove existing error
        const existingError = field.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
        
        // Add error message
        const errorEl = document.createElement('div');
        errorEl.className = 'field-error';
        errorEl.textContent = message;
        errorEl.style.cssText = `
            color: #ff6b6b;
            font-size: 12px;
            margin-top: 4px;
        `;
        field.parentNode.appendChild(errorEl);
    }
    
    clearFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        field.style.borderColor = '';
        
        const errorEl = field.parentNode.querySelector('.field-error');
        if (errorEl) {
            errorEl.remove();
        }
    }
    
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    async signIn(email, password, rememberMe) {
        // Demo account check
        if (email === 'demo@notelab.dev' && password === 'demo123') {
            const user = {
                id: 'demo-user',
                email: email,
                name: 'Demo User'
            };
            
            this.setUserSession(user, rememberMe);
            this.showMessage('Welcome back! Redirecting...', 'success');
            
            setTimeout(() => {
                window.location.href = '../index.html';
            }, 1500);
            
            return;
        }
        
        // Simulate API call for demo
        const response = await this.simulateApiCall('/auth/signin', {
            email,
            password
        });
        
        if (response.success) {
            this.setUserSession(response.user, rememberMe);
            this.showMessage('Welcome back! Redirecting...', 'success');
            
            setTimeout(() => {
                window.location.href = '../index.html';
            }, 1500);
        } else {
            throw new Error(response.error || 'Sign in failed');
        }
    }
    
    async signUp(fullName, email, password) {
        // Simulate API call
        const response = await this.simulateApiCall('/auth/signup', {
            fullName,
            email,
            password
        });
        
        if (response.success) {
            this.setUserSession(response.user, false);
            this.showMessage('Account created successfully! Redirecting...', 'success');
            
            setTimeout(() => {
                window.location.href = '../index.html';
            }, 1500);
        } else {
            throw new Error(response.error || 'Sign up failed');
        }
    }
    
    async simulateApiCall(endpoint, data) {
        // Show realistic loading time
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
        
        // For demo purposes, accept any email/password combination
        if (endpoint === '/auth/signin') {
            return {
                success: true,
                user: {
                    id: this.generateUserId(),
                    email: data.email,
                    name: data.email.split('@')[0]
                }
            };
        }
        
        if (endpoint === '/auth/signup') {
            return {
                success: true,
                user: {
                    id: this.generateUserId(),
                    fullName: data.fullName,
                    email: data.email,
                    name: data.fullName
                }
            };
        }
        
        return { success: false, error: 'Unknown endpoint' };
    }
    
    generateUserId() {
        return 'user_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    setUserSession(user, rememberMe) {
        const expirationTime = rememberMe ? 
            (30 * 24 * 60 * 60 * 1000) : // 30 days
            (7 * 24 * 60 * 60 * 1000);   // 7 days
            
        const sessionData = {
            user,
            timestamp: Date.now(),
            expiresAt: Date.now() + expirationTime
        };
        
        localStorage.setItem('notelab_session', JSON.stringify(sessionData));
    }
    
    useDemoAccount() {
        document.getElementById('email').value = 'demo@notelab.dev';
        document.getElementById('password').value = 'demo123';
        
        // Switch to sign in if on sign up
        if (this.currentMode === 'signup') {
            this.switchMode('signin');
        }
        
        // Add visual feedback
        const demoBtn = document.getElementById('demoBtn');
        const originalText = demoBtn.innerHTML;
        demoBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 6L9 17l-5-5"/>
            </svg>
            Credentials filled!
        `;
        demoBtn.style.background = 'var(--accent-primary)';
        demoBtn.style.color = 'white';
        
        setTimeout(() => {
            demoBtn.innerHTML = originalText;
            demoBtn.style.background = '';
            demoBtn.style.color = '';
        }, 2000);
    }
    
    togglePasswordVisibility() {
        const passwordField = document.getElementById('password');
        const eyeIcon = document.querySelector('.eye-icon');
        
        if (passwordField.type === 'password') {
            passwordField.type = 'text';
            eyeIcon.innerHTML = `
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <path d="M21 4L3 20"/>
            `;
        } else {
            passwordField.type = 'password';
            eyeIcon.innerHTML = `
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
            `;
        }
    }
    
    showForgotPassword() {
        this.showMessage('Password reset functionality coming soon!', 'error');
    }
    
    setLoading(loading) {
        const submitBtn = document.getElementById('submitBtn');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoading = submitBtn.querySelector('.btn-loading');
        const form = document.getElementById('authForm');
        
        if (loading) {
            submitBtn.disabled = true;
            btnText.style.display = 'none';
            btnLoading.style.display = 'flex';
            form.classList.add('form-loading');
        } else {
            submitBtn.disabled = false;
            btnText.style.display = 'inline';
            btnLoading.style.display = 'none';
            form.classList.remove('form-loading');
        }
    }
    
    showMessage(message, type = 'info') {
        this.clearMessages();
        
        const messageContainer = document.getElementById('messageContainer');
        const messageEl = document.createElement('div');
        messageEl.className = `auth-message auth-message-${type}`;
        messageEl.textContent = message;
        
        messageContainer.appendChild(messageEl);
        
        // Auto-remove success messages
        if (type === 'success') {
            setTimeout(() => {
                this.clearMessages();
            }, 3000);
        }
    }
    
    clearMessages() {
        const messageContainer = document.getElementById('messageContainer');
        messageContainer.innerHTML = '';
    }
}

// Initialize login manager
document.addEventListener('DOMContentLoaded', () => {
    window.loginManager = new LoginManager();
});
