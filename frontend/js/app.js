// Main Application Logic
class NoteApp {
    constructor() {
        this.notes = [];
        this.currentNote = null;
        this.currentView = 'all';
        this.activeTag = null;
this.isAuthenticated = false;
        this.user = null;
        
        try {
            this.init();
        } catch (error) {
            console.error('Error initializing app:', error);
        }
    }
    
    init() {
        if (window.vault) {
            window.vault.onUnlock(async () => {
                await this.decryptLockedNotes();
                this.encryptPlaintextCredentials().catch(error => {
                    console.error('Encrypting existing credentials notes failed:', error);
                    this.showToast('Could not encrypt existing credentials notes: ' + error.message, 'error');
                });
            });
        }
        this.checkAuthentication();
    }
    
    async checkAuthentication() {
        try {
            // Check if we have a token
            const token = localStorage.getItem('notelab_token');
            
            if (!token) {
                console.log('No token found, redirecting to login');
                this.redirectToLogin();
                return;
            }
            
            console.log('Token found, verifying with backend...');
            
            // Verify token with backend
            const response = await window.api.getProfile();
            
            if (response.success) {
                this.isAuthenticated = true;
                this.user = response.data.user;
                this.updateUserInfo();
                console.log('Authentication verified successfully');
                
                // Initialize the app
                this.bindEvents();
                this.loadNotes();
                this.showWelcomeOrEditor();
            } else {
                console.log('Authentication failed:', response.message);
                this.redirectToLogin();
            }
        } catch (error) {
            console.error('Authentication check failed:', error);
            this.redirectToLogin();
        }
    }
    
    redirectToLogin() {
        // Clear any invalid data
        localStorage.removeItem('notelab_token');
        localStorage.removeItem('notelab_user');
        localStorage.removeItem('notelab_session');
        localStorage.removeItem('notelab_notes');
        
        // Redirect to login
        window.location.href = '/login.html';
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
        this.activeTag = null;

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
            id: 'temp_' + this.generateId(), // Use temporary ID until saved
            title: 'Untitled note',
            content: '',
            type: 'standard',
            starred: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            tags: []
        };
        
        this.notes.unshift(note);
        this.selectNote(note);
        this.displayNotes();
        
        // Close mobile menu if on mobile
        if (window.innerWidth <= 768) {
            this.closeMobileMenu();
        }
        
        // Focus on title
        setTimeout(() => {
            document.getElementById('noteTitle').focus();
            document.getElementById('noteTitle').select();
        }, 100);
        
        console.log('Created new temporary note:', note.id);
    }

    createNoteFromTemplate(templateType) {
        // Credentials notes are encrypted, so they need an unlocked vault before they exist
        if (templateType === 'credentials' && window.vault && !window.vault.isUnlocked()) {
            window.vault.ensureUnlocked().then(unlocked => {
                if (unlocked) this.createNoteFromTemplate(templateType);
            });
            return;
        }

        const templates = this.getTemplateContent();
        const template = templates[templateType] || templates.blank;
        
        const note = {
            id: 'temp_' + this.generateId(), // Use temporary ID until saved
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
        
        // Close mobile menu if on mobile
        if (window.innerWidth <= 768) {
            this.closeMobileMenu();
        }
        
        // Focus on title for easy editing
        setTimeout(() => {
            document.getElementById('noteTitle').focus();
            document.getElementById('noteTitle').select();
        }, 100);
        
        console.log('Created new note from template:', templateType, note.id);
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
        if (this.requiresVault(note) && window.vault && !window.vault.isUnlocked()) {
            window.vault.ensureUnlocked().then(unlocked => {
                if (unlocked) this.selectNote(note);
            });
            return;
        }
        if (note.locked) {
            // Unlocked, but this note could not be decrypted: never open (and save over) it empty
            this.showToast('This note could not be decrypted with your vault key', 'error');
            return;
        }

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
        
        if (window.noteTags) {
            window.noteTags.renderEditor(this.currentNote);
        }

        this.updateWordCount();
    }
    
    updateNoteInList(note = this.currentNote) {
        if (!note) return;

        const noteElement = document.querySelector(`.note-item[data-note-id="${note.id}"]`);
        if (noteElement) {
            noteElement.querySelector('.note-item-title').textContent = note.title;
            noteElement.querySelector('.note-item-preview').textContent = this.getNotePreview(note);

            const timeElement = noteElement.querySelector('.note-item-time');
            if (timeElement) {
                timeElement.textContent = this.formatTime(note.updatedAt);
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

        this.deleteNoteFromList(this.currentNote.id);
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

                // Drop its pending auto-save and wait for in-flight saves, so a create
                // still running can't recreate the note after it is deleted
                this.cancelAutoSave(note);
                await this.saveQueue;

                // A note that never reached the server only needs removing locally
                if (!note.id.startsWith('temp_')) {
                    const response = await window.api.deleteNote(note.id);
                    if (!response.success) {
                        console.error('Failed to delete note:', response.message);
                        this.showSaveStatus('Delete failed: ' + (response.message || 'Unknown error'), 'error');
                        return;
                    }
                }

                // Remove from notes array
                this.notes = this.notes.filter(n => n !== note);

                // If this was the currently selected note, clear selection
                if (this.currentNote === note) {
                    this.currentNote = null;
                    this.showWelcomeOrEditor();
                }

                // Update display
                this.displayNotes();
            } catch (error) {
                console.error('Failed to delete note:', error);
                this.showSaveStatus('Delete failed: ' + error.message, 'error');
            }
        }
    }
    
    saveAndReturnToWelcome() {
        if (!this.currentNote) return;
        
        // Update the current note with latest content
        this.updateCurrentNoteContent();

        // Save now; a pending auto-save of this note would only repeat it
        this.cancelAutoSave(this.currentNote);
        this.saveNotes(this.currentNote);
        
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
    
    // Short message that stays visible whether or not the editor is open
    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `app-toast ${type}`;
        toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.remove(), type === 'error' ? 6000 : 3500);
    }

    searchNotes(query) {
        if (!query.trim()) {
            this.displayNotes();
            return;
        }
        
        // "#name" searches tags only
        const needle = query.trim().toLowerCase();
        const tagOnly = needle.startsWith('#');
        const tagNeedle = needle.replace(/^#+/, '');
        const filteredNotes = this.notes.filter(note => {
            const tagMatch = (note.tags || []).some(tag => tag.toLowerCase().includes(tagNeedle));
            if (tagOnly) return tagMatch;
            return tagMatch ||
                note.title.toLowerCase().includes(needle) ||
                (note.content || '').toLowerCase().includes(needle);
        });
        
        this.displayFilteredNotes(filteredNotes);
    }
    
    displayNotes() {
        // Most recently edited first, in every view (edits made here update updatedAt locally)
        let notesToShow = [...this.notes].sort((a, b) => this.editTime(b) - this.editTime(a));
        
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

        if (this.activeTag) {
            const tag = this.activeTag.toLowerCase();
            notesToShow = notesToShow.filter(note => (note.tags || []).some(t => t.toLowerCase() === tag));
        }
        if (window.noteTags) {
            window.noteTags.renderSidebar();
        }

        this.displayNotesByCategory(notesToShow);
    }
    
    editTime(note) {
        const time = Date.parse(note.updatedAt || note.createdAt || '');
        return Number.isNaN(time) ? 0 : time;
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
                        <div class="note-item-preview">${this.escapeHtml(this.getNotePreview(note))}</div>
                        <div class="note-item-meta">
                            <span class="note-item-time">${this.formatTime(note.updatedAt)}</span>
                            ${note.starred ? '<span class="note-starred">★</span>' : ''}
                            ${(note.tags || []).slice(0, 3).map(tag => `<span class="note-item-tag">${this.escapeHtml(tag)}</span>`).join('')}
                            ${(note.tags || []).length > 3 ? `<span class="note-item-tag more">+${note.tags.length - 3}</span>` : ''}
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
    
    getNotePreview(note) {
        return note.locked ? '🔒 Encrypted. Unlock your vault to view.' : this.getPreviewText(note.content);
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
        const note = this.currentNote;
        if (!note) return;

        // Another note still has a pending auto-save: save it now instead of dropping its edits
        if (this.pendingSaveNote && this.pendingSaveNote !== note) {
            this.flushAutoSave();
        }

        clearTimeout(this.autoSaveTimer);
        this.pendingSaveNote = note;

        document.getElementById('saveStatus').textContent = 'Saving...';
        document.getElementById('saveStatus').className = 'save-status saving';

        this.autoSaveTimer = setTimeout(() => this.flushAutoSave(), 1000);
    }

    flushAutoSave() {
        clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = null;

        const note = this.pendingSaveNote;
        this.pendingSaveNote = null;
        return note ? this.saveNotes(note) : Promise.resolve();
    }

    cancelAutoSave(note) {
        if (this.pendingSaveNote === note) {
            clearTimeout(this.autoSaveTimer);
            this.autoSaveTimer = null;
            this.pendingSaveNote = null;
        }
    }

    // Credentials notes, and anything already encrypted, are stored encrypted
    requiresVault(note) {
        return Boolean(note && (note.locked || note.type === 'credentials' || (note.metadata && note.metadata.encrypted)));
    }

    // Note object for the app from a server note; encrypted content waits in `ciphertext`
    fromServerNote(note) {
        const local = {
            id: note.id,
            title: note.title,
            content: note.content,
            type: note.type,
            starred: note.starred,
            tags: note.tags,
            metadata: note.metadata,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt
        };
        if ((note.metadata && note.metadata.encrypted) || Vault.isEncrypted(note.content)) {
            local.ciphertext = note.content;
            local.content = '';
            local.locked = true;
        }
        return local;
    }

    async decryptLockedNotes() {
        for (const note of this.notes) {
            if (!note.locked) continue;
            try {
                note.content = await window.vault.decrypt(note.ciphertext);
                note.locked = false;
                delete note.ciphertext;
            } catch (error) {
                console.error('Could not decrypt note', note.id, error);
            }
        }
        this.displayNotes();
    }

    // Encrypts credentials notes saved before the vault existed, including ones beyond
    // the notes loaded in the sidebar
    async encryptPlaintextCredentials() {
        await this.settleSaves();

        const loaded = new Set(this.notes.map(note => note.id));
        let count = 0;

        for (const note of this.notes) {
            if (note.type === 'credentials' && !note.locked && !(note.metadata && note.metadata.encrypted) &&
                note.id && !note.id.startsWith('temp_')) {
                await this.saveNotes(note);
                if (note.metadata && note.metadata.encrypted) count++;
            }
        }

        if (window.noteIO) {
            for (const note of await window.noteIO.fetchAllNotes()) {
                if (loaded.has(note.id) || note.type !== 'credentials' ||
                    (note.metadata && note.metadata.encrypted) || Vault.isEncrypted(note.content)) {
                    continue;
                }
                await window.api.updateNote(note.id, {
                    content: await window.vault.encrypt(note.content),
                    metadata: { ...(note.metadata || {}), encrypted: true }
                });
                count++;
            }
        }

        if (count) {
            this.showToast(`Encrypted ${count} existing credentials note${count === 1 ? '' : 's'}`);
        }
    }

    // Save pending edits now and wait for every save, so the server holds what the editor shows
    async settleSaves() {
        await this.flushAutoSave();
        await this.saveQueue;
    }

    saveNotes(note = this.currentNote) {
        if (!note) return Promise.resolve();

        // Saves run one at a time, so a note's create finishes (and it gets its
        // server ID) before any later save of it runs; otherwise it is created twice
        this.saveQueue = (this.saveQueue || Promise.resolve()).then(() => this.persistNote(note));
        return this.saveQueue;
    }

    async persistNote(note) {
        try {
            if (!window.api) {
                console.error('API not available');
                this.showSaveStatus('API not available', 'error');
                return;
            }

            // Still holds ciphertext we could not decrypt: saving would overwrite it
            if (note.locked) return;

            const noteData = {
                title: note.title,
                content: note.content,
                type: note.type || 'standard',
                starred: note.starred || false,
                tags: note.tags || [],
                metadata: note.metadata || {}
            };

            const encrypt = this.requiresVault(note);
            if (encrypt) {
                if (!window.vault || !window.vault.isUnlocked()) {
                    this.showSaveStatus('Not saved: unlock your vault to save credentials notes', 'error');
                    return;
                }
                noteData.content = await window.vault.encrypt(note.content);
                noteData.metadata = { ...noteData.metadata, encrypted: true };
            }

            const isNew = !note.id || note.id.startsWith('temp_');
            const response = isNew
                ? await window.api.createNote(noteData)
                : await window.api.updateNote(note.id, noteData);

            if (response.success) {
                const saved = response.data.note;

                if (isNew) {
                    const tempId = note.id;
                    note.id = saved.id;
                    note.createdAt = saved.createdAt;

                    // Point list items at the server ID so clicks and deletes still find the note
                    if (tempId) {
                        document.querySelectorAll(`[data-note-id="${tempId}"]`).forEach(el => {
                            el.dataset.noteId = saved.id;
                        });
                    }
                    console.log('Created new note with ID:', note.id);
                } else {
                    console.log('Updated existing note:', note.id);
                }

                // Keep the same object (currentNote may reference it) and only take server
                // fields: content typed while this request was in flight must not be overwritten
                note.updatedAt = saved.updatedAt;
                if (encrypt) {
                    note.metadata = { ...(note.metadata || {}), encrypted: true };
                }

                this.updateNoteInList(note);
                this.showSaveStatus('Saved successfully', 'success');
            } else {
                console.error('Save failed:', response.message);
                this.showSaveStatus('Save failed: ' + (response.message || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Failed to save note:', error);
            this.showSaveStatus('Save failed: ' + error.message, 'error');
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

            // First, verify authentication is still valid
            try {
                const profileResponse = await window.api.getProfile();
                if (!profileResponse.success) {
                    console.error('Authentication failed, redirecting to login');
                    this.logout();
                    return;
                }
            } catch (authError) {
                console.error('Authentication check failed:', authError);
                this.logout();
                return;
            }

            // All pages, not just the first: the server returns at most 100 notes per request
            const notes = await window.api.getAllNotes();
            this.notes = notes.map(note => this.fromServerNote(note));
            if (window.vault && window.vault.isUnlocked()) {
                await this.decryptLockedNotes();
            }
            console.log(`Loaded ${this.notes.length} notes from server`);
        } catch (error) {
            console.error('Failed to load notes:', error);
            this.showToast('Could not load notes: ' + error.message, 'error');
            // Don't clear notes array on network error, keep existing notes
            if (this.notes.length === 0) {
                this.notes = [];
            }
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
        localStorage.removeItem('notelab_token');
        localStorage.removeItem('notelab_user');
        localStorage.removeItem('notelab_session');
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
