// CodeMirror Editor Integration
class NoteEditor {
    constructor() {
        this.editor = null;
        this.previewMode = false;
        this.splitView = false;
        this.resizing = false;
        this.init();
    }
    
    init() {
        // Initialize CodeMirror after DOM is loaded
        document.addEventListener('DOMContentLoaded', () => {
            this.initializeEditor();
            this.bindToolbarEvents();
            this.bindPreviewEvents();
            this.setupResizeHandle();
        });
    }
    
    initializeEditor() {
        const textarea = document.getElementById('codeEditor');
        
        this.editor = CodeMirror.fromTextArea(textarea, {
            mode: 'markdown',
            theme: 'github-dark',
            lineNumbers: true,
            lineWrapping: true,
            autoCloseBrackets: true,
            matchBrackets: true,
            indentUnit: 2,
            tabSize: 2,
            indentWithTabs: false,
            extraKeys: {
                "Ctrl-B": () => this.formatText('bold'),
                "Cmd-B": () => this.formatText('bold'),
                "Ctrl-I": () => this.formatText('italic'),
                "Cmd-I": () => this.formatText('italic'),
                "Ctrl-K": () => this.formatText('link'),
                "Cmd-K": () => this.formatText('link'),
                "Ctrl-`": () => this.formatText('code'),
                "Cmd-`": () => this.formatText('code'),
                "Ctrl-S": () => this.saveNote(),
                "Cmd-S": () => this.saveNote(),
                "Tab": (cm) => {
                    if (cm.somethingSelected()) {
                        cm.indentSelection("add");
                    } else {
                        cm.replaceSelection("  ");
                    }
                }
            },
            placeholder: "Start writing your note... \n\n# Your Note Title\n\nWrite your thoughts, code snippets, and ideas here.\n\n## Code Example\n```javascript\nconsole.log('Hello, Note.Lab!');\n```\n\n- Use markdown for formatting\n- Add code blocks with syntax highlighting\n- Organize with headers and lists"
        });
        
        // Store reference globally for app.js
        window.editor = this.editor;
        
        // Bind editor events
        this.editor.on('change', () => {
            this.onContentChange();
        });
        
        this.editor.on('cursorActivity', () => {
            this.updateWordCount();
        });
        
        // Auto-focus editor
        setTimeout(() => {
            this.editor.refresh();
            this.editor.focus();
        }, 100);
    }
    
    bindToolbarEvents() {
        // Enhanced toolbar events
        document.querySelectorAll('.toolbar-btn[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const action = btn.dataset.action;
                this.handleToolbarAction(action);
            });
        });

        // Dropdown functionality
        document.querySelectorAll('.toolbar-dropdown').forEach(dropdown => {
            const toggle = dropdown.querySelector('.dropdown-toggle');
            const menu = dropdown.querySelector('.dropdown-menu');
            
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Close other dropdowns
                document.querySelectorAll('.dropdown-menu.show').forEach(m => {
                    if (m !== menu) m.classList.remove('show');
                });
                
                menu.classList.toggle('show');
                toggle.classList.toggle('active');
            });

            // Handle dropdown menu clicks
            menu.querySelectorAll('button[data-action]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const action = btn.dataset.action;
                    this.handleToolbarAction(action);
                    menu.classList.remove('show');
                    toggle.classList.remove('active');
                });
            });
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', () => {
            document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                menu.classList.remove('show');
                menu.closest('.toolbar-dropdown').querySelector('.dropdown-toggle').classList.remove('active');
            });
        });
    }

    bindPreviewEvents() {
        const previewToggle = document.getElementById('previewToggle');
        previewToggle.addEventListener('click', () => {
            this.togglePreview();
        });
    }

    setupResizeHandle() {
        const resizeHandle = document.getElementById('resizeHandle');
        const editorPanes = document.querySelector('.editor-panes');
        const editorPane = document.querySelector('.editor-pane');
        const previewPane = document.querySelector('.preview-pane');

        resizeHandle.addEventListener('mousedown', (e) => {
            this.resizing = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';

            const handleMouseMove = (e) => {
                if (!this.resizing) return;

                const containerRect = editorPanes.getBoundingClientRect();
                const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
                
                if (newWidth > 20 && newWidth < 80) {
                    editorPane.style.flex = `0 0 ${newWidth}%`;
                    previewPane.style.flex = `0 0 ${100 - newWidth}%`;
                }
            };

            const handleMouseUp = () => {
                this.resizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });
    }

    handleToolbarAction(action) {
        switch (action) {
            case 'bold':
                this.formatText('bold');
                break;
            case 'italic':
                this.formatText('italic');
                break;
            case 'strikethrough':
                this.formatText('strikethrough');
                break;
            case 'code':
                this.formatText('code');
                break;
            case 'h1':
            case 'h2':
            case 'h3':
            case 'h4':
            case 'h5':
            case 'h6':
                this.formatText('heading', action);
                break;
            case 'ul':
                this.formatText('ul');
                break;
            case 'ol':
                this.formatText('ol');
                break;
            case 'quote':
                this.formatText('blockquote');
                break;
            case 'link':
                this.formatText('link');
                break;
            case 'codeblock':
                this.formatText('codeblock');
                break;
            case 'table':
                this.formatText('table');
                break;
            case 'hr':
                this.formatText('hr');
                break;
        }
    }

    togglePreview() {
        const previewPane = document.getElementById('previewPane');
        const resizeHandle = document.getElementById('resizeHandle');
        const editorPanes = document.querySelector('.editor-panes');
        const previewToggle = document.getElementById('previewToggle');

        if (!this.previewMode) {
            // Show preview
            previewPane.style.display = 'flex';
            resizeHandle.style.display = 'block';
            editorPanes.classList.add('split-view');
            previewToggle.classList.add('active');
            this.previewMode = true;
            this.updatePreview();
        } else {
            // Hide preview
            previewPane.style.display = 'none';
            resizeHandle.style.display = 'none';
            editorPanes.classList.remove('split-view');
            previewToggle.classList.remove('active');
            this.previewMode = false;
        }

        // Refresh CodeMirror after layout change
        setTimeout(() => {
            if (this.editor) {
                this.editor.refresh();
            }
        }, 100);
    }

    updatePreview() {
        if (!this.previewMode || !window.marked) return;

        const content = this.editor ? this.editor.getValue() : '';
        const previewContent = document.getElementById('previewContent');
        
        if (content.trim() === '') {
            previewContent.innerHTML = `
                <div class="preview-placeholder">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                    </svg>
                    <p>Preview will appear here</p>
                </div>
            `;
        } else {
            try {
                const html = marked.parse(content);
                previewContent.innerHTML = html;
                
                // Highlight code blocks if Prism is available
                if (window.Prism) {
                    window.Prism.highlightAllUnder(previewContent);
                }
            } catch (error) {
                console.error('Markdown parsing error:', error);
                previewContent.innerHTML = `<p style="color: var(--accent-danger);">Error parsing markdown</p>`;
            }
        }
    }
    
    formatText(type, subtype = null) {
        if (!this.editor) return;
        
        const selection = this.editor.getSelection();
        const cursor = this.editor.getCursor();
        const doc = this.editor.getDoc();
        
        let replacement = '';
        let cursorOffset = 0;
        let lineMode = false;
        
        switch (type) {
            case 'bold':
                if (selection) {
                    replacement = `**${selection}**`;
                } else {
                    replacement = '**bold text**';
                    cursorOffset = 2;
                }
                break;
                
            case 'italic':
                if (selection) {
                    replacement = `*${selection}*`;
                } else {
                    replacement = '*italic text*';
                    cursorOffset = 1;
                }
                break;

            case 'strikethrough':
                if (selection) {
                    replacement = `~~${selection}~~`;
                } else {
                    replacement = '~~strikethrough text~~';
                    cursorOffset = 2;
                }
                break;
                
            case 'code':
                if (selection) {
                    replacement = `\`${selection}\``;
                } else {
                    replacement = '`code`';
                    cursorOffset = 1;
                }
                break;

            case 'heading':
                const level = parseInt(subtype.charAt(1));
                const prefix = '#'.repeat(level) + ' ';
                if (selection) {
                    replacement = `${prefix}${selection}`;
                } else {
                    replacement = `${prefix}Heading ${level}`;
                    cursorOffset = prefix.length;
                }
                lineMode = true;
                break;

            case 'ul':
                if (selection) {
                    const lines = selection.split('\n');
                    replacement = lines.map(line => `- ${line}`).join('\n');
                } else {
                    replacement = '- List item';
                    cursorOffset = 2;
                }
                lineMode = true;
                break;

            case 'ol':
                if (selection) {
                    const lines = selection.split('\n');
                    replacement = lines.map((line, i) => `${i + 1}. ${line}`).join('\n');
                } else {
                    replacement = '1. List item';
                    cursorOffset = 3;
                }
                lineMode = true;
                break;

            case 'blockquote':
                if (selection) {
                    const lines = selection.split('\n');
                    replacement = lines.map(line => `> ${line}`).join('\n');
                } else {
                    replacement = '> Blockquote';
                    cursorOffset = 2;
                }
                lineMode = true;
                break;
                
            case 'link':
                const url = selection && this.isUrl(selection) ? selection : 'https://';
                const text = selection && !this.isUrl(selection) ? selection : 'link text';
                replacement = `[${text}](${url})`;
                cursorOffset = 1;
                break;

            case 'codeblock':
                const language = 'javascript'; // Default language
                if (selection) {
                    replacement = `\`\`\`${language}\n${selection}\n\`\`\``;
                } else {
                    replacement = `\`\`\`${language}\n// Your code here\n\`\`\``;
                    cursorOffset = language.length + 5; // Position after language
                }
                lineMode = true;
                break;

            case 'table':
                replacement = `| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |`;
                lineMode = true;
                break;

            case 'hr':
                replacement = '\n---\n';
                lineMode = true;
                break;
        }
        
        if (lineMode) {
            // Insert at beginning of line
            const lineStart = { line: cursor.line, ch: 0 };
            const lineEnd = { line: cursor.line, ch: doc.getLine(cursor.line).length };
            
            if (selection) {
                this.editor.replaceSelection(replacement);
            } else {
                this.editor.replaceRange(replacement, lineStart);
                if (cursorOffset > 0) {
                    this.editor.setCursor({ line: cursor.line, ch: cursorOffset });
                }
            }
        } else {
        if (selection) {
            this.editor.replaceSelection(replacement);
        } else {
            this.editor.replaceRange(replacement, cursor);
                if (cursorOffset > 0) {
            const newCursor = {
                line: cursor.line,
                ch: cursor.ch + cursorOffset
            };
            this.editor.setCursor(newCursor);
                }
            }
        }
        
        this.editor.focus();
    }
    
    isUrl(text) {
        try {
            new URL(text);
            return true;
        } catch {
            return false;
        }
    }
    
    onContentChange() {
        if (window.noteApp && window.noteApp.currentNote) {
            window.noteApp.currentNote.content = this.editor.getValue();
            window.noteApp.currentNote.updatedAt = new Date().toISOString();
            window.noteApp.updateNoteInList();
            window.noteApp.autoSave();
        }
        
        this.updateWordCount();
        this.updatePreview();
    }
    
    updateWordCount() {
        const content = this.editor ? this.editor.getValue() : '';
        const words = content.trim() ? content.trim().split(/\s+/).length : 0;
        const wordCountElement = document.getElementById('wordCount');
        if (wordCountElement) {
            wordCountElement.textContent = `${words} words`;
        }
    }
    
    saveNote() {
        if (window.noteApp) {
            window.noteApp.saveNotes();
            
            const saveStatus = document.getElementById('saveStatus');
            saveStatus.textContent = 'Saved';
            saveStatus.className = 'save-status saved';
        }
        return false; // Prevent default Ctrl+S behavior
    }
    
    insertText(text) {
        if (!this.editor) return;
        
        const cursor = this.editor.getCursor();
        this.editor.replaceRange(text, cursor);
        this.editor.focus();
    }
    
    insertCodeBlock(language = '') {
        const codeBlock = `\n\`\`\`${language}\n// Your code here\n\`\`\`\n`;
        this.insertText(codeBlock);
    }
    
    insertTable() {
        const table = `\n| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |\n\n`;
        this.insertText(table);
    }
    
    insertTaskList() {
        const taskList = `\n- [ ] Task 1\n- [ ] Task 2\n- [x] Completed task\n\n`;
        this.insertText(taskList);
    }
    
    setValue(content) {
        if (this.editor) {
            this.editor.setValue(content);
        }
    }
    
    getValue() {
        return this.editor ? this.editor.getValue() : '';
    }
    
    focus() {
        if (this.editor) {
            this.editor.focus();
        }
    }
    
    refresh() {
        if (this.editor) {
            this.editor.refresh();
        }
    }
}

// Additional editor utilities
class EditorUtils {
    static getMarkdownPreview(content) {
        // Simple markdown to HTML conversion for preview
        return content
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*)\*/gim, '<em>$1</em>')
            .replace(/`(.*?)`/gim, '<code>$1</code>')
            .replace(/\n/gim, '<br>');
    }
    
    static exportAsMarkdown(note) {
        const content = `# ${note.title}\n\n${note.content}`;
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
        a.click();
        
        URL.revokeObjectURL(url);
    }
    
    static exportAsText(note) {
        const content = `${note.title}\n\n${note.content}`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
        a.click();
        
        URL.revokeObjectURL(url);
    }
}

// Initialize editor
window.noteEditor = new NoteEditor();
