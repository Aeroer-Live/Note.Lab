// Main Application Logic
class NoteApp {
    constructor() {
        this.notes = [];
        this.currentNote = null;
        this.currentView = 'all';
        this.isAuthenticated = false;
        this.user = null;
        
        try {
            this.init();
        } catch (error) {
            console.error('Error initializing app:', error);
        }
    }
    
    init() {
        this.loadUserSession();
        
        if (!this.isAuthenticated) {
            // Redirect to login page
            window.location.href = 'login.html';
            return;
        }
        this.bindEvents();
        this.loadNotes();
        this.showWelcomeOrEditor();
    }
    
    loadUserSession() {
        const session = localStorage.getItem('notelab_session');
        const token = localStorage.getItem('notelab_token');
        const user = localStorage.getItem('notelab_user');
        
        if (session) {
            try {
                const sessionData = JSON.parse(session);
                
                // Check if session is still valid
                if (sessionData.expiresAt && sessionData.expiresAt > Date.now()) {
                    this.isAuthenticated = true;
                    this.user = sessionData.user;
                    this.updateUserInfo();
                } else {
                    // Session expired, remove it
                    localStorage.removeItem('notelab_session');
                    this.isAuthenticated = false;
                }
            } catch (e) {
                console.error('Invalid session data:', e);
                localStorage.removeItem('notelab_session');
                this.isAuthenticated = false;
            }
        } else {
            // Fallback: check if we have token and user data
            if (token && user) {
                try {
                    const userData = JSON.parse(user);
                    this.isAuthenticated = true;
                    this.user = userData;
                    this.updateUserInfo();
                } catch (e) {
                    console.error('Invalid user data:', e);
                    this.isAuthenticated = false;
                }
            } else {
                this.isAuthenticated = false;
            }
        }
    }
    
    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-item a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchView(e.target.closest('a').dataset.view);
            });
        });
        
        // New note button
        document.getElementById('newNoteBtn').addEventListener('click', () => {
            this.createNewNote();
        });
        
        // Template selection
        document.querySelectorAll('.template-card').forEach(card => {
            card.addEventListener('click', () => {
                const template = card.dataset.template;
                this.createNoteFromTemplate(template);
            });
        });

        // Create blank note
        document.getElementById('createBlankNote').addEventListener('click', () => {
            this.createNewNote();
        });
        
        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchNotes(e.target.value);
            // Close mobile menu when user starts typing in search
            if (window.innerWidth <= 768) {
                this.closeMobileMenu();
            }
        });

        // Category header collapse/expand
        this.bindCategoryEvents();
        
        // Note title
        document.getElementById('noteTitle').addEventListener('input', (e) => {
            if (this.currentNote) {
                this.currentNote.title = e.target.value || 'Untitled note';
                this.updateNoteInList();
                this.autoSave();
            }
        });
        
        // Note actions
        document.getElementById('saveNote').addEventListener('click', () => {
            this.saveAndReturnToWelcome();
        });
        
        document.getElementById('starNote').addEventListener('click', () => {
            this.toggleStar();
        });
        
        document.getElementById('deleteNote').addEventListener('click', () => {
            this.deleteCurrentNote();
        });
        
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // Mobile menu handling
        this.bindMobileEvents();
        
        // Auto-save timer
        this.autoSaveTimer = null;
    }
    
    switchView(view) {
        this.currentView = view;
        
        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        document.querySelector(`[data-view="${view}"]`).closest('.nav-item').classList.add('active');
        
        // Filter and display notes
        this.displayNotes();
    }
    
    createNewNote() {
        const note = {
            id: this.generateId(),
            title: 'Untitled note',
            content: '',
            starred: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            tags: []
        };
        
        this.notes.unshift(note);
        this.selectNote(note);
        this.displayNotes();
        this.saveNotes();
        
        // Close mobile menu if on mobile
        if (window.innerWidth <= 768) {
            this.closeMobileMenu();
        }
        
        // Focus on title
        setTimeout(() => {
            document.getElementById('noteTitle').focus();
            document.getElementById('noteTitle').select();
        }, 100);
    }

    createNoteFromTemplate(templateType) {
        const templates = this.getTemplateContent();
        const template = templates[templateType] || templates.blank;
        
        const note = {
            id: this.generateId(),
            title: template.title,
            content: template.content,
            type: templateType,
            starred: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            tags: template.tags || []
        };
        
        this.notes.unshift(note);
        this.selectNote(note);
        this.displayNotes();
        this.saveNotes();
        
        // Close mobile menu if on mobile
        if (window.innerWidth <= 768) {
            this.closeMobileMenu();
        }
        
        // Focus on title for easy editing
        setTimeout(() => {
            document.getElementById('noteTitle').focus();
            document.getElementById('noteTitle').select();
        }, 100);
    }

    getTemplateContent() {
        return {
            plan: {
                title: 'Untitled note',
                tags: ['planning'],
                content: ''
            },
            code: {
                title: 'Untitled note',
                tags: ['code'],
                content: ''
            },
            credentials: {
                title: 'Untitled note',
                tags: ['secure', 'credentials'],
                content: ''
            },

            blank: {
                title: 'Untitled note',
                tags: [],
                content: ''
            }
        };
    }
    
    selectNote(note) {
        this.currentNote = note;
        this.showEditor();
        this.updateNoteEditor();
        this.updateActiveNoteInList();
        this.updateMobileTitle();
        this.updateSaveButtonVisibility();
        
        // Close mobile menu if on mobile
        if (window.innerWidth <= 768) {
            this.closeMobileMenu();
        }
        
        // Set template-specific behavior
        if (window.templateManager && note.type) {
            window.templateManager.setNoteType(note.type);
        }
    }
    
    updateNoteEditor() {
        if (!this.currentNote) return;
        
        document.getElementById('noteTitle').value = this.currentNote.title;
        
        // Update star button
        const starBtn = document.getElementById('starNote');
        if (this.currentNote.starred) {
            starBtn.innerHTML = `
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"/>
                </svg>
            `;
            starBtn.style.color = '#ffd700';
        } else {
            starBtn.innerHTML = `
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M2.866 14.85c-.078.444.36.791.746.593l4.39-2.256 4.389 2.256c.386.198.824-.149.746-.592l-.83-4.73 3.522-3.356c.33-.314.16-.888-.282-.95l-4.898-.696L8.465.792a.513.513 0 0 0-.927 0L5.354 5.12l-4.898.696c-.441.062-.612.636-.283.95l3.523 3.356-.83 4.73zm4.905-2.767-3.686 1.894.694-3.957a.565.565 0 0 0-.163-.505L1.71 6.745l4.052-.576a.525.525 0 0 0 .393-.288L8 2.223l1.847 3.658a.525.525 0 0 0 .393.288l4.052.576-2.906 2.77a.565.565 0 0 0-.163.506l.694 3.957-3.686-1.894a.503.503 0 0 0-.461 0z"/>
                </svg>
            `;
            starBtn.style.color = '';
        }
        
        // Update editor content if editor is initialized
        if (window.editor) {
            window.editor.setValue(this.currentNote.content);
        } else {
            document.getElementById('codeEditor').value = this.currentNote.content;
        }
        
        // Update preview if editor is available
        if (window.noteEditor) {
            window.noteEditor.updatePreview();
        }
        
        this.updateWordCount();
    }
    
    updateNoteInList() {
        if (!this.currentNote) return;
        
        const noteElement = document.querySelector(`[data-note-id="${this.currentNote.id}"]`);
        if (noteElement) {
            noteElement.querySelector('.note-item-title').textContent = this.currentNote.title;
            noteElement.querySelector('.note-item-preview').textContent = this.getPreviewText(this.currentNote.content);
            
            const timeElement = noteElement.querySelector('.note-item-time');
            if (timeElement) {
                timeElement.textContent = this.formatTime(this.currentNote.updatedAt);
            }
        }
    }
    
    updateActiveNoteInList() {
        document.querySelectorAll('.note-item').forEach(item => {
            item.classList.remove('active');
        });
        
        if (this.currentNote) {
            const activeItem = document.querySelector(`[data-note-id="${this.currentNote.id}"]`);
            if (activeItem) {
                activeItem.classList.add('active');
            }
        }
    }
    
    toggleStar() {
        if (!this.currentNote) return;
        
        this.currentNote.starred = !this.currentNote.starred;
        this.currentNote.updatedAt = new Date().toISOString();
        
        this.updateNoteEditor();
        this.updateNoteInList();
        this.saveNotes();
        
        // Close mobile menu if on mobile
        if (window.innerWidth <= 768) {
            this.closeMobileMenu();
        }
    }
    
    deleteCurrentNote() {
        if (!this.currentNote) return;
        
        if (confirm('Are you sure you want to delete this note?')) {
            this.notes = this.notes.filter(note => note.id !== this.currentNote.id);
            this.currentNote = null;
            
            this.saveNotes();
            this.displayNotes();
            this.showWelcomeOrEditor();
        }
    }
    
    async deleteNoteFromList(noteId) {
        const note = this.notes.find(n => n.id === noteId);
        if (!note) return;
        
        if (confirm(`Are you sure you want to delete "${note.title}"?`)) {
            try {
                if (!window.api) {
                    console.error('API not available');
                    return;
                }

                const response = await window.api.deleteNote(noteId);
                if (response.success) {
                    // Remove from notes array
                    this.notes = this.notes.filter(n => n.id !== noteId);
                    
                    // If this was the currently selected note, clear selection
                    if (this.currentNote && this.currentNote.id === noteId) {
                        this.currentNote = null;
                        this.showWelcomeOrEditor();
                    }
                    
                    // Update display
                    this.displayNotes();
                } else {
                    console.error('Failed to delete note:', response.message);
                }
            } catch (error) {
                console.error('Failed to delete note:', error);
            }
        }
    }
    
    saveAndReturnToWelcome() {
        if (!this.currentNote) return;
        
        // Update the current note with latest content
        this.updateCurrentNoteContent();
        
        // Save notes to localStorage
        this.saveNotes();
        
        // Clear current note selection
        this.currentNote = null;
        
        // Update the display
        this.displayNotes();
        
        // Show welcome screen
        this.showWelcomeOrEditor();
        
        // Show success message
        this.showSaveSuccessMessage();
    }
    
    updateCurrentNoteContent() {
        if (!this.currentNote) return;
        
        // Update title
        const titleInput = document.getElementById('noteTitle');
        if (titleInput) {
            this.currentNote.title = titleInput.value || 'Untitled note';
        }
        
        // Update content from editor
        if (window.editor) {
            this.currentNote.content = window.editor.getValue();
        } else {
            const contentTextarea = document.getElementById('codeEditor');
            if (contentTextarea) {
                this.currentNote.content = contentTextarea.value;
            }
        }
        
        // Update timestamp
        this.currentNote.updatedAt = new Date().toISOString();
    }
    
    showSaveStatus(message, type = 'success') {
        const saveStatus = document.getElementById('saveStatus');
        if (saveStatus) {
            saveStatus.textContent = message;
            saveStatus.className = `save-status ${type}`;
            
            // Auto-clear after 3 seconds
            setTimeout(() => {
                saveStatus.textContent = '';
                saveStatus.className = 'save-status';
            }, 3000);
        }
    }

    showSaveSuccessMessage() {
        // Create a temporary success message
        const message = document.createElement('div');
        message.className = 'save-success-message';
        message.innerHTML = `
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.97a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
            </svg>
            Note saved successfully!
        `;
        
        // Add styles
        message.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 8px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideInRight 0.3s ease-out;
        `;
        
        // Add animation styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(message);
        
        // Remove message after 3 seconds
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 3000);
    }
    
    searchNotes(query) {
        if (!query.trim()) {
            this.displayNotes();
            return;
        }
        
        const filteredNotes = this.notes.filter(note => 
            note.title.toLowerCase().includes(query.toLowerCase()) ||
            note.content.toLowerCase().includes(query.toLowerCase())
        );
        
        this.displayFilteredNotes(filteredNotes);
    }
    
    displayNotes() {
        let notesToShow = [...this.notes];
        
        // Filter by view
        switch (this.currentView) {
            case 'starred':
                notesToShow = notesToShow.filter(note => note.starred);
                break;
            case 'recent':
                notesToShow = notesToShow.slice(0, 10);
                break;
            // 'all' shows everything
        }
        
        this.displayNotesByCategory(notesToShow);
    }
    
    displayNotesByCategory(notes) {
        // Group notes by category
        const categorizedNotes = {
            plan: notes.filter(note => note.type === 'plan'),
            code: notes.filter(note => note.type === 'code'),
            credentials: notes.filter(note => note.type === 'credentials'),
            other: notes.filter(note => !note.type || !['plan', 'code', 'credentials'].includes(note.type))
        };

        // Update each category section
        this.updateCategorySection('plan', categorizedNotes.plan);
        this.updateCategorySection('code', categorizedNotes.code);
        this.updateCategorySection('credentials', categorizedNotes.credentials);
        this.updateCategorySection('other', categorizedNotes.other);
    }

    updateCategorySection(category, notes) {
        const categoryMapping = {
            plan: { listId: 'planNotesList', countId: 'planNotesCount', sectionId: 'planNotesSection' },
            code: { listId: 'codeNotesList', countId: 'codeNotesCount', sectionId: 'codeNotesSection' },
            credentials: { listId: 'credentialsNotesList', countId: 'credentialsNotesCount', sectionId: 'credentialsNotesSection' },
            other: { listId: 'otherNotesList', countId: 'otherNotesCount', sectionId: 'otherNotesSection' }
        };

        const mapping = categoryMapping[category];
        const notesList = document.getElementById(mapping.listId);
        const countElement = document.getElementById(mapping.countId);
        const sectionElement = document.getElementById(mapping.sectionId);

        // Update count
        countElement.textContent = notes.length;

        // Update section visibility and state
        if (notes.length === 0) {
            sectionElement.classList.add('empty');
            notesList.innerHTML = `
                <div class="empty-category" style="padding: var(--space-3); text-align: center; color: var(--text-muted); font-size: 13px;">
                    No notes yet
                </div>
            `;
        } else {
            sectionElement.classList.remove('empty');
            
            // Generate notes HTML
            notesList.innerHTML = notes.map(note => `
                <div class="note-item" data-note-id="${note.id}">
                    <div class="note-item-content">
                        <div class="note-item-title">${this.escapeHtml(note.title)}</div>
                        <div class="note-item-preview">${this.escapeHtml(this.getPreviewText(note.content))}</div>
                        <div class="note-item-meta">
                            <span class="note-item-time">${this.formatTime(note.updatedAt)}</span>
                            ${note.starred ? '<span class="note-starred">★</span>' : ''}
                        </div>
                    </div>
                    <button class="note-delete-btn" data-note-id="${note.id}" title="Delete note">
                        <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6Z"/>
                            <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1ZM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118ZM2.5 3h11V2h-11v1Z"/>
                        </svg>
                    </button>
                </div>
            `).join('');

            // Bind click events for this category
            notesList.querySelectorAll('.note-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    // Don't trigger note selection if clicking delete button
                    if (e.target.closest('.note-delete-btn')) {
                        return;
                    }
                    
                    const noteId = item.dataset.noteId;
                    const note = this.notes.find(n => n.id === noteId);
                    if (note) {
                        this.selectNote(note);
                    }
                });
            });
            
            // Bind delete button events
            notesList.querySelectorAll('.note-delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent note selection
                    const noteId = btn.dataset.noteId;
                    this.deleteNoteFromList(noteId);
                });
            });
        }
    }

    displayFilteredNotes(notes) {
        // For search results, use the category-based display
        this.displayNotesByCategory(notes);
    }
    
    getPreviewText(content) {
        return content
            .replace(/[#*`]/g, '') // Remove markdown symbols
            .replace(/\n/g, ' ') // Replace newlines with spaces
            .substring(0, 100); // Limit length
    }
    
    formatTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 30) return `${days}d ago`;
        
        return date.toLocaleDateString();
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    showWelcomeOrEditor() {
        const welcomeScreen = document.getElementById('welcomeScreen');
        const noteEditor = document.getElementById('noteEditor');
        
        if (this.notes.length === 0 || !this.currentNote) {
            welcomeScreen.style.display = 'flex';
            noteEditor.style.display = 'none';
            this.updateSaveButtonVisibility(); // Hide save buttons on welcome screen
        } else {
            this.showEditor();
        }
    }
    
    showEditor() {
        const welcomeScreen = document.getElementById('welcomeScreen');
        const noteEditor = document.getElementById('noteEditor');
        
        welcomeScreen.style.display = 'none';
        noteEditor.style.display = 'flex';
        
        // Ensure save button is visible when editor is shown
        this.updateSaveButtonVisibility();
    }
    
    updateSaveButtonVisibility() {
        // Show save button when a note is being edited
        const saveButton = document.getElementById('saveNote');
        if (saveButton) {
            saveButton.style.display = this.currentNote ? 'flex' : 'none';
        }
    }
    
    updateWordCount() {
        const content = this.currentNote ? this.currentNote.content : '';
        const words = content.trim() ? content.trim().split(/\s+/).length : 0;
        document.getElementById('wordCount').textContent = `${words} words`;
    }
    
    autoSave() {
        clearTimeout(this.autoSaveTimer);
        
        document.getElementById('saveStatus').textContent = 'Saving...';
        document.getElementById('saveStatus').className = 'save-status saving';
        
        this.autoSaveTimer = setTimeout(() => {
            this.saveNotes();
            document.getElementById('saveStatus').textContent = 'Saved';
            document.getElementById('saveStatus').className = 'save-status saved';
        }, 1000);
    }
    
    async saveNotes() {
        try {
            if (!this.currentNote) return;
            
            if (!window.api) {
                console.error('API not available');
                return;
            }

            const noteData = {
                title: this.currentNote.title,
                content: this.currentNote.content,
                type: this.currentNote.type || 'standard',
                starred: this.currentNote.starred || false,
                tags: this.currentNote.tags || [],
                metadata: this.currentNote.metadata || {}
            };

            let response;
            if (this.currentNote.id) {
                // Update existing note
                response = await window.api.updateNote(this.currentNote.id, noteData);
            } else {
                // Create new note
                response = await window.api.createNote(noteData);
                if (response.success) {
                    this.currentNote.id = response.data.note.id;
                }
            }

            if (response.success) {
                // Update the note in our local array
                const noteIndex = this.notes.findIndex(n => n.id === this.currentNote.id);
                if (noteIndex !== -1) {
                    this.notes[noteIndex] = { ...this.currentNote, ...response.data.note };
                } else {
                    this.notes.push({ ...this.currentNote, ...response.data.note });
                }
                
                this.updateNoteInList();
                this.showSaveStatus('Saved successfully', 'success');
            } else {
                this.showSaveStatus('Save failed', 'error');
            }
        } catch (error) {
            console.error('Failed to save note:', error);
            this.showSaveStatus('Save failed', 'error');
        }
    }
    
    async loadNotes() {
        try {
            if (!window.api) {
                console.error('API not available');
                this.notes = [];
                this.displayNotes();
                return;
            }

            const response = await window.api.getNotes();
            if (response.success) {
                this.notes = response.data.notes.map(note => ({
                    id: note.id,
                    title: note.title,
                    content: note.content,
                    type: note.type,
                    starred: note.starred,
                    tags: note.tags,
                    metadata: note.metadata,
                    createdAt: note.createdAt,
                    updatedAt: note.updatedAt
                }));
            } else {
                console.error('Failed to load notes:', response.message);
                this.notes = [];
            }
        } catch (error) {
            console.error('Failed to load notes:', error);
            this.notes = [];
        }
        
        this.displayNotes();
    }
    

    
    updateUserInfo() {
        if (this.user) {
            document.querySelector('.user-name').textContent = this.user.name || this.user.email;
        }
    }
    
    logout() {
        // Clear all authentication data
        localStorage.removeItem('notelab_session');
        localStorage.removeItem('notelab_token');
        localStorage.removeItem('notelab_user');
        localStorage.removeItem('notelab_notes');
        
        this.isAuthenticated = false;
        this.user = null;
        this.notes = [];
        this.currentNote = null;
        
        // Redirect to login page
        window.location.href = '/login.html';
    }

    bindMobileEvents() {
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const mobileOverlay = document.getElementById('mobileOverlay');

        // Mobile menu toggle
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleMobileMenu();
            });
        }

        // Close menu when clicking overlay
        if (mobileOverlay) {
            mobileOverlay.addEventListener('click', (e) => {
                e.preventDefault();
                this.closeMobileMenu();
            });
            
            // Also handle touch events for better mobile support
            mobileOverlay.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.closeMobileMenu();
            });
        }

        // Close menu when clicking a nav item (mobile)
        document.querySelectorAll('.nav-item a').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    this.closeMobileMenu();
                }
            });
        });

        // Close menu when clicking a note item (mobile)
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && e.target.closest('.note-item')) {
                this.closeMobileMenu();
            }
        });

        // Close menu when clicking outside sidebar (mobile)
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                const sidebar = document.getElementById('sidebar');
                const mobileMenuBtn = document.getElementById('mobileMenuBtn');
                
                // Check if sidebar is open and click is outside sidebar and not on menu button
                if (sidebar && sidebar.classList.contains('open') && 
                    !sidebar.contains(e.target) && 
                    !mobileMenuBtn.contains(e.target)) {
                    this.closeMobileMenu();
                }
            }
        });

        // Close menu when clicking on main content area (mobile)
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                const mainContent = document.querySelector('.main-content');
                const sidebar = document.getElementById('sidebar');
                
                if (mainContent && mainContent.contains(e.target) && 
                    sidebar && sidebar.classList.contains('open')) {
                    this.closeMobileMenu();
                }
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                this.closeMobileMenu();
            }
        });

        // Update mobile title when note changes
        this.updateMobileTitle();
    }

    toggleMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('mobileOverlay');
        const body = document.body;
        
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
        
        // Prevent body scroll when sidebar is open
        if (sidebar.classList.contains('open')) {
            body.style.overflow = 'hidden';
        } else {
            body.style.overflow = '';
        }
    }

    closeMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('mobileOverlay');
        const body = document.body;
        
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
        body.style.overflow = '';
    }

    updateMobileTitle() {
        const mobileTitle = document.getElementById('mobileTitle');
        if (mobileTitle && this.currentNote) {
            mobileTitle.textContent = this.currentNote.title || 'Untitled note';
        } else if (mobileTitle) {
            mobileTitle.textContent = 'Note.Lab';
        }
    }

    bindCategoryEvents() {
        // Add click events to category headers for collapse/expand
        document.querySelectorAll('.category-header').forEach(header => {
            header.addEventListener('click', () => {
                const category = header.closest('.notes-category');
                category.classList.toggle('collapsed');
            });
        });
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.noteApp = new NoteApp();
});
