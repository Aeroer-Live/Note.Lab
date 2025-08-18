// CodeMirror Editor Integration
class NoteEditor {
    constructor() {
        this.editor = null;
        this.init();
    }
    
    init() {
        // Initialize CodeMirror after DOM is loaded
        document.addEventListener('DOMContentLoaded', () => {
            this.initializeEditor();
            this.bindToolbarEvents();
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
        // Toolbar buttons
        document.querySelector('[title="Bold"]').addEventListener('click', () => {
            this.formatText('bold');
        });
        
        document.querySelector('[title="Italic"]').addEventListener('click', () => {
            this.formatText('italic');
        });
        
        document.querySelector('[title="Code"]').addEventListener('click', () => {
            this.formatText('code');
        });
        
        document.querySelector('[title="Link"]').addEventListener('click', () => {
            this.formatText('link');
        });
    }
    
    formatText(type) {
        if (!this.editor) return;
        
        const selection = this.editor.getSelection();
        const cursor = this.editor.getCursor();
        
        let replacement = '';
        let cursorOffset = 0;
        
        switch (type) {
            case 'bold':
                if (selection) {
                    replacement = `**${selection}**`;
                    cursorOffset = 2;
                } else {
                    replacement = '**bold text**';
                    cursorOffset = 2;
                }
                break;
                
            case 'italic':
                if (selection) {
                    replacement = `*${selection}*`;
                    cursorOffset = 1;
                } else {
                    replacement = '*italic text*';
                    cursorOffset = 1;
                }
                break;
                
            case 'code':
                if (selection) {
                    replacement = `\`${selection}\``;
                    cursorOffset = 1;
                } else {
                    replacement = '`code`';
                    cursorOffset = 1;
                }
                break;
                
            case 'link':
                const url = selection && this.isUrl(selection) ? selection : 'https://';
                const text = selection && !this.isUrl(selection) ? selection : 'link text';
                replacement = `[${text}](${url})`;
                cursorOffset = 1;
                break;
        }
        
        if (selection) {
            this.editor.replaceSelection(replacement);
        } else {
            this.editor.replaceRange(replacement, cursor);
            // Set cursor position
            const newCursor = {
                line: cursor.line,
                ch: cursor.ch + cursorOffset
            };
            this.editor.setCursor(newCursor);
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
