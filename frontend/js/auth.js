// Authentication Module
class AuthManager {
    constructor() {
        this.apiBase = '/api'; // Will be handled by Cloudflare Workers
        this.init();
    }
    
    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.bindAuthEvents();
        });
    }
    
    bindAuthEvents() {
        // Auth tab switching
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchAuthTab(e.target.dataset.tab);
            });
        });
        
        // Auth form submission
        document.getElementById('authForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAuthSubmit();
        });
        
        // Close modal
        document.getElementById('closeModal').addEventListener('click', () => {
            // Only allow closing if user is authenticated
            if (window.noteApp && window.noteApp.isAuthenticated) {
                window.noteApp.hideAuthModal();
            }
        });
        
        // Close modal on overlay click
        document.getElementById('authModal').addEventListener('click', (e) => {
            if (e.target.id === 'authModal' && window.noteApp && window.noteApp.isAuthenticated) {
                window.noteApp.hideAuthModal();
            }
        });
    }
    
    switchAuthTab(tab) {
        // Update active tab
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        
        // Update form
        const usernameGroup = document.getElementById('usernameGroup');
        const confirmPasswordGroup = document.getElementById('confirmPasswordGroup');
        const submitBtn = document.querySelector('#authForm button[type="submit"]');
        
        if (tab === 'register') {
            if (usernameGroup) usernameGroup.style.display = 'flex';
            confirmPasswordGroup.style.display = 'flex';
            submitBtn.textContent = 'Sign Up';
        } else {
            if (usernameGroup) usernameGroup.style.display = 'none';
            confirmPasswordGroup.style.display = 'none';
            submitBtn.textContent = 'Sign In';
        }
        
        // Clear form
        document.getElementById('authForm').reset();
    }
    
    async handleAuthSubmit() {
        const isLogin = document.querySelector('.auth-tab.active').dataset.tab === 'login';
        const username = document.getElementById('username') ? document.getElementById('username').value : '';
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        // Basic validation
        if (!email || !password) {
            this.showError('Please fill in all fields');
            return;
        }
        
        if (!isLogin && !username) {
            this.showError('Please enter a username');
            return;
        }
        
        if (!isLogin && password !== confirmPassword) {
            this.showError('Passwords do not match');
            return;
        }
        
        if (password.length < 6) {
            this.showError('Password must be at least 6 characters');
            return;
        }
        
        const submitBtn = document.querySelector('#authForm button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Loading...';
        submitBtn.disabled = true;
        
        try {
            if (isLogin) {
                await this.login(email, password);
            } else {
                await this.register(username, email, password);
            }
        } catch (error) {
            this.showError(error.message);
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }
    
    async login(email, password) {
        try {
            const response = await window.api.login({ email, password });
            
            if (response.success) {
                const user = response.data.user;
                this.setUserSession(user);
                this.showSuccess('Welcome back!');
                
                if (window.noteApp) {
                    window.noteApp.isAuthenticated = true;
                    window.noteApp.user = user;
                    window.noteApp.updateUserInfo();
                    window.noteApp.hideAuthModal();
                    window.noteApp.loadNotes();
                    window.noteApp.showWelcomeOrEditor();
                }
            } else {
                throw new Error(response.message || 'Login failed');
            }
        } catch (error) {
            throw new Error(error.message || 'Login failed. Please check your credentials.');
        }
    }
    
    async register(username, email, password) {
        try {
            const response = await window.api.register({
                name: username,
                email,
                password
            });
            
            if (response.success) {
                const user = response.data.user;
                this.setUserSession(user);
                this.showSuccess('Account created successfully!');
                
                if (window.noteApp) {
                    window.noteApp.isAuthenticated = true;
                    window.noteApp.user = user;
                    window.noteApp.updateUserInfo();
                    window.noteApp.hideAuthModal();
                    window.noteApp.showWelcomeOrEditor();
                }
            } else {
                throw new Error(response.message || 'Registration failed');
            }
        } catch (error) {
            throw new Error(error.message || 'Registration failed. Please try again.');
        }
    }
    
    async simulateApiCall(endpoint, data) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // For demo purposes, accept any email/password combination
        if (endpoint === '/auth/login') {
            return {
                success: true,
                user: {
                    id: this.generateUserId(),
                    email: data.email,
                    name: data.email.split('@')[0]
                }
            };
        }
        
        if (endpoint === '/auth/register') {
            return {
                success: true,
                user: {
                    id: this.generateUserId(),
                    username: data.username,
                    email: data.email,
                    name: data.username || data.email.split('@')[0]
                }
            };
        }
        
        return { success: false, error: 'Unknown endpoint' };
    }
    
    generateUserId() {
        return 'user_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    setUserSession(user) {
        const sessionData = {
            user,
            timestamp: Date.now(),
            expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
        };
        
        localStorage.setItem('notelab_session', JSON.stringify(sessionData));
    }
    
    showError(message) {
        this.showMessage(message, 'error');
    }
    
    showSuccess(message) {
        this.showMessage(message, 'success');
    }
    
    showMessage(message, type) {
        // Remove existing messages
        const existingMessage = document.querySelector('.auth-message');
        if (existingMessage) {
            existingMessage.remove();
        }
        
        // Create message element
        const messageEl = document.createElement('div');
        messageEl.className = `auth-message auth-message-${type}`;
        messageEl.textContent = message;
        
        // Style the message
        messageEl.style.cssText = `
            padding: var(--space-3);
            margin-bottom: var(--space-3);
            border-radius: var(--radius-md);
            font-size: 14px;
            ${type === 'error' ? 
                'background-color: rgba(218, 54, 51, 0.1); color: #ff6b6b; border: 1px solid rgba(218, 54, 51, 0.2);' :
                'background-color: rgba(35, 134, 54, 0.1); color: #51cf66; border: 1px solid rgba(35, 134, 54, 0.2);'
            }
        `;
        
        // Insert message
        const modalBody = document.querySelector('.modal-body');
        modalBody.insertBefore(messageEl, modalBody.firstChild);
        
        // Auto-remove success messages
        if (type === 'success') {
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.remove();
                }
            }, 3000);
        }
    }
    
    setUserSession(user) {
        localStorage.setItem('notelab_user', JSON.stringify(user));
    }
    
    getUserSession() {
        const session = localStorage.getItem('notelab_user');
        return session ? JSON.parse(session) : null;
    }
    
    clearUserSession() {
        localStorage.removeItem('notelab_user');
    }
    
    logout() {
        this.clearUserSession();
        if (window.api) {
            window.api.logout();
        }
        
        if (window.noteApp) {
            window.noteApp.isAuthenticated = false;
            window.noteApp.user = null;
            window.noteApp.notes = [];
            window.noteApp.currentNote = null;
        }
        
        // Redirect to login page
        window.location.href = '/login.html';
    }
}

// Initialize auth manager
window.authManager = new AuthManager();
