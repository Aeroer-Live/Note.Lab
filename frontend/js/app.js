// Main Application Logic
class NoteApp {
    constructor() {
        this.notes = [];
        this.currentNote = null;
        this.currentView = 'all';
        this.isAuthenticated = false;
        this.user = null;
        
        this.init();
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
        
        // Create first note button
        document.getElementById('createFirstNote').addEventListener('click', () => {
            this.createNewNote();
        });
        
        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchNotes(e.target.value);
        });
        
        // Note title
        document.getElementById('noteTitle').addEventListener('input', (e) => {
            if (this.currentNote) {
                this.currentNote.title = e.target.value || 'Untitled note';
                this.updateNoteInList();
                this.autoSave();
            }
        });
        
        // Note actions
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
        
        // Focus on title
        setTimeout(() => {
            document.getElementById('noteTitle').focus();
            document.getElementById('noteTitle').select();
        }, 100);
    }
    
    selectNote(note) {
        this.currentNote = note;
        this.showEditor();
        this.updateNoteEditor();
        this.updateActiveNoteInList();
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
        
        this.displayFilteredNotes(notesToShow);
    }
    
    displayFilteredNotes(notes) {
        const notesList = document.getElementById('notesList');
        
        if (notes.length === 0) {
            notesList.innerHTML = `
                <div class="empty-state" style="padding: var(--space-4); text-align: center; color: var(--text-muted);">
                    <p>No notes found</p>
                </div>
            `;
            return;
        }
        
        notesList.innerHTML = notes.map(note => `
            <div class="note-item" data-note-id="${note.id}">
                <div class="note-item-title">${this.escapeHtml(note.title)}</div>
                <div class="note-item-preview">${this.escapeHtml(this.getPreviewText(note.content))}</div>
                <div class="note-item-meta">
                    <span class="note-item-time">${this.formatTime(note.updatedAt)}</span>
                    ${note.starred ? '<span class="note-starred">★</span>' : ''}
                </div>
            </div>
        `).join('');
        
        // Bind click events
        notesList.querySelectorAll('.note-item').forEach(item => {
            item.addEventListener('click', () => {
                const noteId = item.dataset.noteId;
                const note = this.notes.find(n => n.id === noteId);
                if (note) {
                    this.selectNote(note);
                }
            });
        });
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
        } else {
            this.showEditor();
        }
    }
    
    showEditor() {
        const welcomeScreen = document.getElementById('welcomeScreen');
        const noteEditor = document.getElementById('noteEditor');
        
        welcomeScreen.style.display = 'none';
        noteEditor.style.display = 'flex';
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
    
    saveNotes() {
        try {
            localStorage.setItem('notelab_notes', JSON.stringify(this.notes));
        } catch (e) {
            console.error('Failed to save notes:', e);
            document.getElementById('saveStatus').textContent = 'Save failed';
            document.getElementById('saveStatus').className = 'save-status error';
        }
    }
    
    loadNotes() {
        try {
            const saved = localStorage.getItem('notelab_notes');
            if (saved) {
                this.notes = JSON.parse(saved);
            }
        } catch (e) {
            console.error('Failed to load notes:', e);
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
        localStorage.removeItem('notelab_session');
        localStorage.removeItem('notelab_notes');
        
        this.isAuthenticated = false;
        this.user = null;
        this.notes = [];
        this.currentNote = null;
        
        // Redirect to login page
        window.location.href = '../login.html';
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.noteApp = new NoteApp();
});
