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
        const token = localStorage.getItem('notelab_token');
        const user = localStorage.getItem('notelab_user');
        
        if (token && user) {
            try {
                const userData = JSON.parse(user);
                // For now, just check if we have valid data
                // In production, you might want to validate the token with the server
                if (userData.id && userData.email) {
                    // Redirect to main app
                    window.location.href = 'index.html';
                    return;
                }
            } catch (e) {
                // Invalid session data, remove it
                localStorage.removeItem('notelab_token');
                localStorage.removeItem('notelab_user');
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
        
        // Password strength indicator
        const passwordField = document.getElementById('password');
        if (passwordField) {
            passwordField.addEventListener('input', () => this.checkPasswordStrength());
            passwordField.addEventListener('focus', () => {
                document.getElementById('passwordRequirements').style.display = 'block';
            });
            passwordField.addEventListener('blur', () => {
                if (!passwordField.value) {
                    document.getElementById('passwordRequirements').style.display = 'none';
                }
            });
        }
        
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
            
            if (fullName.length > 50) {
                this.showMessage('Full name must be less than 50 characters', 'error');
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
        
        if (password.length < 8) {
            this.showMessage('Password must be at least 8 characters long', 'error');
            document.getElementById('password').focus();
            return false;
        }
        
        if (password.length > 128) {
            this.showMessage('Password must be less than 128 characters', 'error');
            document.getElementById('password').focus();
            return false;
        }
        
        // Check for at least one letter and one number
        if (!/[A-Za-z]/.test(password)) {
            this.showMessage('Password must contain at least one letter', 'error');
            document.getElementById('password').focus();
            return false;
        }
        
        if (!/\d/.test(password)) {
            this.showMessage('Password must contain at least one number', 'error');
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
                if (value && value.length < 8) {
                    this.showFieldError(fieldId, 'Password must be at least 8 characters');
                    return false;
                }
                if (value && !/[A-Za-z]/.test(value)) {
                    this.showFieldError(fieldId, 'Must contain at least one letter');
                    return false;
                }
                if (value && !/\d/.test(value)) {
                    this.showFieldError(fieldId, 'Must contain at least one number');
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
        try {
            const response = await window.api.login({ email, password });
            
            if (response.success) {
                const user = response.data.user;
                this.setUserSession(user, rememberMe);
                this.showMessage('Welcome back! Redirecting...', 'success');
                
                setTimeout(() => {
                    window.location.href = '/index.html';
                }, 1500);
            } else {
                throw new Error(response.message || 'Sign in failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            
            // Provide more specific error messages
            let errorMessage = 'Sign in failed. Please check your credentials.';
            
            if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                errorMessage = 'Invalid email or password. Please try again.';
            } else if (error.message.includes('Network') || error.message.includes('fetch')) {
                errorMessage = 'Network error. Please check your connection and try again.';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            throw new Error(errorMessage);
        }
    }
    
    async signUp(fullName, email, password) {
        try {
            const response = await window.api.register({
                name: fullName,
                email,
                password
            });
            
            if (response.success) {
                const user = response.data.user;
                this.setUserSession(user, false);
                this.showMessage('Account created successfully! Redirecting...', 'success');
                
                setTimeout(() => {
                    window.location.href = '/index.html';
                }, 1500);
            } else {
                throw new Error(response.message || 'Sign up failed');
            }
        } catch (error) {
            throw new Error(error.message || 'Sign up failed. Please try again.');
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
        // Store user data
        localStorage.setItem('notelab_user', JSON.stringify(user));
        
        // Create session data for app.js compatibility
        const sessionData = {
            user: user,
            expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
            rememberMe: rememberMe
        };
        localStorage.setItem('notelab_session', JSON.stringify(sessionData));
        
        // Token is already stored by the API config
        // The API config handles token storage automatically
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
    
    checkPasswordStrength() {
        const password = document.getElementById('password').value;
        const strengthBar = document.getElementById('passwordStrength');
        const strengthFill = document.getElementById('strengthFill');
        const strengthText = document.getElementById('strengthText');
        
        if (!password) {
            strengthBar.style.display = 'none';
            return;
        }
        
        strengthBar.style.display = 'block';
        
        // Calculate strength based on backend requirements
        let score = 0;
        let feedback = '';
        let isValid = true;
        
        // Basic requirements (must have all)
        if (password.length >= 8) score += 1;
        if (/[A-Za-z]/.test(password)) score += 1;
        if (/\d/.test(password)) score += 1;
        
        // Bonus points
        if (password.length >= 12) score += 1;
        if (/[A-Z]/.test(password)) score += 1;
        if (/[^A-Za-z0-9]/.test(password)) score += 1;
        
        // Check if meets minimum requirements
        if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
            isValid = false;
        }
        
        // Determine strength level
        let strength = 'weak';
        if (score >= 3 && isValid) strength = 'fair';
        if (score >= 4 && isValid) strength = 'good';
        if (score >= 5 && isValid) strength = 'strong';
        
        // Update UI
        strengthFill.className = `strength-fill ${strength}`;
        
        if (!isValid) {
            feedback = 'Must be 8+ chars with letters & numbers';
            strengthFill.className = 'strength-fill weak';
        } else {
            switch (strength) {
                case 'weak':
                    feedback = 'Weak password';
                    break;
                case 'fair':
                    feedback = 'Fair password';
                    break;
                case 'good':
                    feedback = 'Good password';
                    break;
                case 'strong':
                    feedback = 'Strong password';
                    break;
            }
        }
        
        strengthText.textContent = feedback;
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
        
        // Add close button for error messages
        if (type === 'error') {
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '×';
            closeBtn.className = 'message-close';
            closeBtn.onclick = () => this.clearMessages();
            messageEl.appendChild(closeBtn);
        }
        
        messageContainer.appendChild(messageEl);
        
        // Auto-remove success messages only
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
