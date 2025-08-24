// API Configuration for Note.Lab
class APIConfig {
    constructor() {
        this.baseURL = this.getBaseURL();
        this.token = this.getStoredToken();
    }

    getBaseURL() {
        // Always use production Cloudflare server for data persistence
        return 'https://note-lab.aeroermark.workers.dev/api';
    }

    getStoredToken() {
        return localStorage.getItem('notelab_token');
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('notelab_token', token);
    }

    clearToken() {
        this.token = null;
        localStorage.removeItem('notelab_token');
    }

    getHeaders(includeAuth = true) {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (includeAuth && this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        return headers;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: this.getHeaders(options.includeAuth !== false),
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                // Handle authentication errors
                if (response.status === 401) {
                    this.clearToken();
                    // Don't redirect automatically for login/register requests
                    if (endpoint.includes('/auth/login') || endpoint.includes('/auth/register')) {
                        throw new Error(data.message || 'Invalid credentials');
                    }
                    // Only redirect for authenticated requests
                    window.location.href = '/login.html';
                    throw new Error('Authentication failed. Please log in again.');
                }

                throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Authentication methods
    async register(userData) {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData),
            includeAuth: false
        });
    }

    async login(credentials) {
        const response = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials),
            includeAuth: false
        });

        if (response.success && response.data.token) {
            this.setToken(response.data.token);
        }

        return response;
    }

    async forgotPassword(email) {
        return this.request('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email }),
            includeAuth: false
        });
    }

    async resetPassword(token, password) {
        return this.request('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token, password }),
            includeAuth: false
        });
    }

    async logout() {
        this.clearToken();
        // Clear other stored data
        localStorage.removeItem('notelab_user');
        localStorage.removeItem('notelab_notes');
    }

    // User profile methods
    async getProfile() {
        return this.request('/user/profile');
    }

    async updateProfile(profileData) {
        return this.request('/user/profile', {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
    }

    // Notes methods
    async getNotes(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `/notes?${queryString}` : '/notes';
        return this.request(endpoint);
    }

    async getNote(id) {
        return this.request(`/notes/${id}`);
    }

    async createNote(noteData) {
        return this.request('/notes', {
            method: 'POST',
            body: JSON.stringify(noteData)
        });
    }

    async updateNote(id, noteData) {
        return this.request(`/notes/${id}`, {
            method: 'PUT',
            body: JSON.stringify(noteData)
        });
    }

    async deleteNote(id) {
        return this.request(`/notes/${id}`, {
            method: 'DELETE'
        });
    }

    async searchNotes(query, limit = 20) {
        return this.request(`/notes/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    }

    async getNotesStats() {
        return this.request('/notes/stats');
    }

    async bulkUpdateNotes(noteIds, updates) {
        return this.request('/notes/bulk-update', {
            method: 'POST',
            body: JSON.stringify({ noteIds, updates })
        });
    }

    // Categories methods
    async getCategories() {
        return this.request('/categories');
    }

    async createCategory(categoryData) {
        return this.request('/categories', {
            method: 'POST',
            body: JSON.stringify(categoryData)
        });
    }

    async updateCategory(id, categoryData) {
        return this.request(`/categories/${id}`, {
            method: 'PUT',
            body: JSON.stringify(categoryData)
        });
    }

    async deleteCategory(id) {
        return this.request(`/categories/${id}`, {
            method: 'DELETE'
        });
    }

    async assignCategoriesToNote(noteId, categoryIds) {
        return this.request('/categories/assign', {
            method: 'POST',
            body: JSON.stringify({ noteId, categoryIds })
        });
    }

    async getNoteCategories(noteId) {
        return this.request(`/notes/${noteId}/categories`);
    }

    // Health check
    async healthCheck() {
        return this.request('/health', { includeAuth: false });
    }
}

// Create global API instance
window.api = new APIConfig();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = APIConfig;
}
