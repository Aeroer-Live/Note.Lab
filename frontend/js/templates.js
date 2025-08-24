// Template-specific functionality for Note.Lab
class TemplateManager {
    constructor() {
        this.currentNoteType = null;
        this.currentLanguage = 'javascript';
        this.init();
    }

    init() {
        this.bindTemplateEvents();
        this.bindCredentialFormEvents();
        
        // Show default toolbar (standard toolbar) on initialization
        this.setNoteType('standard');
    }

    bindTemplateEvents() {
        // Language selection for code notes
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-lang]')) {
                this.setCodeLanguage(e.target.dataset.lang);
            }
        });

        // Credential template selection
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-template]')) {
                const template = e.target.dataset.template;
                this.insertCredentialTemplate(template);
                
                // Close dropdown
                const dropdown = e.target.closest('.dropdown-menu');
                if (dropdown) {
                    dropdown.style.display = 'none';
                }
            }
        });

        // Special template actions
        document.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (!action) return;

            switch (action) {
                case 'task-list':
                    this.insertTaskList();
                    break;
                case 'numbered-list':
                    this.insertNumberedList();
                    break;
                case 'bullet-list':
                    this.insertBulletList();
                    break;
                case 'code-block':
                    this.insertCodeBlock();
                    break;
                case 'inline-code':
                    this.insertInlineCode();
                    break;
                case 'comment':
                    this.insertComment();
                    break;
                case 'function-template':
                    this.insertFunctionTemplate();
                    break;

                case 'generate-password':
                    this.generatePassword();
                    break;
                case 'quick-form':
                    this.openCredentialForm();
                    break;
                case 'paragraph':
                    this.insertParagraph();
                    break;
            }
        });
    }

    setNoteType(noteType) {
        this.currentNoteType = noteType;
        this.updateToolbar();
        this.updateEditorMode();
    }

    updateToolbar() {
        // Hide all toolbars
        document.querySelectorAll('.editor-toolbar').forEach(toolbar => {
            toolbar.style.display = 'none';
        });

        // Show appropriate toolbar
        let toolbarId;
        switch (this.currentNoteType) {
            case 'plan':
                toolbarId = 'planToolbar';
                break;
            case 'code':
                toolbarId = 'codeToolbar';
                break;
            case 'credentials':
                toolbarId = 'credentialsToolbar';
                break;
            default:
                toolbarId = 'standardToolbar';
                break;
        }

        const toolbar = document.getElementById(toolbarId);
        if (toolbar) {
            toolbar.style.display = 'flex';
        }
        
        // Ensure preview functionality is maintained
        setTimeout(() => {
            if (window.noteEditor && typeof window.noteEditor.bindPreviewEvents === 'function') {
                // Re-bind preview events after toolbar change
                window.noteEditor.bindPreviewEvents();
            }
            if (window.noteEditor && typeof window.noteEditor.updatePreview === 'function') {
                window.noteEditor.updatePreview();
            }
        }, 100);
    }

    updateEditorMode() {
        if (!window.noteEditor?.editor) return;

        let mode = 'markdown';
        if (this.currentNoteType === 'code') {
            mode = this.getCodeMirrorMode(this.currentLanguage);
        }
        // Keep markdown mode for plan notes to support all formatting options

        window.noteEditor.editor.setOption('mode', mode);
    }

    getCodeMirrorMode(language) {
        const modeMap = {
            'javascript': 'javascript',
            'typescript': 'javascript',
            'python': 'python',
            'java': 'text/x-java',
            'csharp': 'text/x-csharp',
            'cpp': 'text/x-c++src',
            'php': 'php',
            'ruby': 'ruby',
            'go': 'go',
            'rust': 'rust',
            'sql': 'sql',
            'html': 'xml',
            'css': 'css',
            'json': 'application/json',
            'yaml': 'yaml',
            'markdown': 'markdown'
        };
        return modeMap[language] || 'javascript';
    }

    setCodeLanguage(language) {
        this.currentLanguage = language;
        
        // Update dropdown display
        const selectedLang = document.getElementById('selectedLanguage');
        if (selectedLang) {
            selectedLang.textContent = language.charAt(0).toUpperCase() + language.slice(1);
        }

        // Update editor mode if current note is code type
        if (this.currentNoteType === 'code') {
            this.updateEditorMode();
        }

        // Close dropdown
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            menu.style.display = 'none';
        });
    }

    // Plan Note Methods
    insertTaskList() {
        const text = `## ✅ Tasks
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

`;
        this.insertText(text);
    }

    insertNumberedList() {
        const text = `1. First item
2. Second item
3. Third item

`;
        this.insertText(text);
    }

    insertBulletList() {
        const text = `• First point
• Second point
• Third point

`;
        this.insertText(text);
    }

    insertParagraph() {
        const text = `<p>Your paragraph text here</p>

`;
        this.insertText(text);
    }

    // Code Note Methods
    insertCodeBlock() {
        const text = `\`\`\`${this.currentLanguage}
// Your code here

\`\`\`

`;
        this.insertText(text);
    }

    insertInlineCode() {
        this.insertText('`code`');
    }

    insertComment() {
        const commentStyle = this.getCommentStyle(this.currentLanguage);
        const text = `${commentStyle} TODO: Add implementation

`;
        this.insertText(text);
    }

    insertFunctionTemplate() {
        const template = this.getFunctionTemplate(this.currentLanguage);
        this.insertText(template);
    }

    getCommentStyle(language) {
        const styles = {
            'javascript': '//',
            'typescript': '//',
            'python': '#',
            'java': '//',
            'csharp': '//',
            'cpp': '//',
            'php': '//',
            'ruby': '#',
            'go': '//',
            'rust': '//',
            'sql': '--',
            'html': '<!--',
            'css': '/*',
            'yaml': '#'
        };
        return styles[language] || '//';
    }

    getFunctionTemplate(language) {
        const templates = {
            'javascript': `function functionName(params) {
    // Implementation here
    return result;
}

`,
            'python': `def function_name(params):
    """
    Function description
    """
    # Implementation here
    return result

`,
            'java': `public ReturnType functionName(ParamType params) {
    // Implementation here
    return result;
}

`,
            'csharp': `public ReturnType FunctionName(ParamType params)
{
    // Implementation here
    return result;
}

`,
            'cpp': `ReturnType functionName(ParamType params) {
    // Implementation here
    return result;
}

`,
            'php': `function functionName($params) {
    // Implementation here
    return $result;
}

`,
            'ruby': `def function_name(params)
  # Implementation here
  result
end

`,
            'go': `func functionName(params ParamType) ReturnType {
    // Implementation here
    return result
}

`,
            'rust': `fn function_name(params: ParamType) -> ReturnType {
    // Implementation here
    result
}

`
        };
        return templates[language] || templates['javascript'];
    }

    // Credentials Note Methods - only password generation

    generatePassword() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
        let password = '';
        for (let i = 0; i < 16; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        // Insert the password into the editor
        this.insertText(password);
        
        // Also copy to clipboard
        navigator.clipboard.writeText(password).then(() => {
            this.showNotification('Generated password inserted and copied to clipboard!');
        }).catch(() => {
            this.showNotification('Generated password inserted into editor!');
        });
    }



    showNotification(message) {
        // Create a simple notification
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--accent-primary);
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Utility method to insert text at cursor
    insertText(text) {
        if (!window.noteEditor?.editor) return;
        
        const cursor = window.noteEditor.editor.getCursor();
        window.noteEditor.editor.replaceRange(text, cursor);
        window.noteEditor.editor.focus();
    }

    // Credential Management Methods
    bindCredentialFormEvents() {
        const modal = document.getElementById('credentialModal');
        const modalClose = document.getElementById('modalClose');
        const modalCancel = document.getElementById('modalCancel');
        const modalSave = document.getElementById('modalSave');
        const passwordToggle = document.getElementById('passwordToggle');
        const generateBtn = document.getElementById('generateBtn');
        const categorySelect = document.getElementById('credentialCategory');

        // Close modal events
        [modalClose, modalCancel].forEach(btn => {
            btn?.addEventListener('click', () => this.closeCredentialForm());
        });

        // Close on overlay click
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) this.closeCredentialForm();
        });

        // Save credential
        modalSave?.addEventListener('click', () => this.saveCredential());

        // Password toggle
        passwordToggle?.addEventListener('click', () => {
            const passwordInput = document.getElementById('credentialPassword');
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            passwordToggle.textContent = isPassword ? '🙈' : '👁️';
        });

        // Generate password in modal
        generateBtn?.addEventListener('click', () => {
            const passwordInput = document.getElementById('credentialPassword');
            const password = this.generateSecurePassword();
            passwordInput.value = password;
        });

        // Category change for dynamic fields
        categorySelect?.addEventListener('change', (e) => {
            this.updateDynamicFields(e.target.value);
        });
    }

    openCredentialForm() {
        const modal = document.getElementById('credentialModal');
        modal.style.display = 'flex';
        
        // Reset form
        document.getElementById('credentialForm').reset();
        this.updateDynamicFields('web-hosting');
        
        // Focus first input
        setTimeout(() => {
            document.getElementById('credentialTitle').focus();
        }, 100);
    }

    closeCredentialForm() {
        const modal = document.getElementById('credentialModal');
        modal.style.display = 'none';
    }

    updateDynamicFields(category) {
        const dynamicFields = document.getElementById('dynamicFields');
        dynamicFields.innerHTML = '';

        const fieldConfigs = {
            'web-hosting': [
                { label: 'Control Panel URL', type: 'url', placeholder: 'https://cpanel.example.com' },
                { label: 'Server IP', type: 'text', placeholder: '192.168.1.1' },
                { label: 'SSH Port', type: 'number', placeholder: '22' }
            ],
            'domain': [
                { label: 'Registrar', type: 'text', placeholder: 'GoDaddy, Namecheap, etc.' },
                { label: 'Domain Name', type: 'text', placeholder: 'example.com' },
                { label: 'Nameservers', type: 'textarea', placeholder: 'ns1.example.com\\nns2.example.com' }
            ],
            'social-media': [
                { label: 'Platform', type: 'text', placeholder: 'Facebook, Twitter, Instagram, etc.' },
                { label: 'Profile URL', type: 'url', placeholder: 'https://twitter.com/username' },
                { label: 'Backup Email', type: 'email', placeholder: 'backup@example.com' }
            ],
            'email': [
                { label: 'Email Provider', type: 'text', placeholder: 'Gmail, Outlook, etc.' },
                { label: 'IMAP Server', type: 'text', placeholder: 'imap.gmail.com' },
                { label: 'SMTP Server', type: 'text', placeholder: 'smtp.gmail.com' },
                { label: 'Port (IMAP)', type: 'number', placeholder: '993' },
                { label: 'Port (SMTP)', type: 'number', placeholder: '587' }
            ],
            'database': [
                { label: 'Database Type', type: 'text', placeholder: 'MySQL, PostgreSQL, MongoDB' },
                { label: 'Host/Server', type: 'text', placeholder: 'localhost or server IP' },
                { label: 'Port', type: 'number', placeholder: '3306' },
                { label: 'Database Name', type: 'text', placeholder: 'database_name' }
            ],
            'ftp': [
                { label: 'Protocol', type: 'text', placeholder: 'FTP, SFTP, FTPS' },
                { label: 'Host', type: 'text', placeholder: 'ftp.example.com' },
                { label: 'Port', type: 'number', placeholder: '21' },
                { label: 'Root Directory', type: 'text', placeholder: '/public_html/' }
            ],
            'api': [
                { label: 'API Provider', type: 'text', placeholder: 'AWS, Google, Stripe, etc.' },
                { label: 'API Key', type: 'password', placeholder: 'sk_live_...' },
                { label: 'Secret Key', type: 'password', placeholder: 'Secret or private key' },
                { label: 'Endpoint', type: 'url', placeholder: 'https://api.example.com' }
            ],
            'server': [
                { label: 'Server Type', type: 'text', placeholder: 'VPS, Dedicated, Cloud' },
                { label: 'IP Address', type: 'text', placeholder: '192.168.1.1' },
                { label: 'SSH Port', type: 'number', placeholder: '22' },
                { label: 'Operating System', type: 'text', placeholder: 'Ubuntu 20.04, CentOS, etc.' }
            ]
        };

        const fields = fieldConfigs[category] || [];
        
        fields.forEach(field => {
            const div = document.createElement('div');
            div.className = 'form-group';
            
            const label = document.createElement('label');
            label.textContent = field.label;
            
            let input;
            if (field.type === 'textarea') {
                input = document.createElement('textarea');
                input.rows = 3;
            } else {
                input = document.createElement('input');
                input.type = field.type;
            }
            
            input.placeholder = field.placeholder;
            input.className = 'dynamic-field';
            
            div.appendChild(label);
            div.appendChild(input);
            dynamicFields.appendChild(div);
        });
    }

    saveCredential() {
        // Get form values
        const title = document.getElementById('credentialTitle').value;
        const category = document.getElementById('credentialCategory').value;
        const url = document.getElementById('credentialUrl').value;
        const username = document.getElementById('credentialUsername').value;
        const password = document.getElementById('credentialPassword').value;
        const notes = document.getElementById('credentialNotes').value;
        
        // Get dynamic fields
        const dynamicFields = {};
        document.querySelectorAll('.dynamic-field').forEach(field => {
            const label = field.previousElementSibling.textContent;
            if (field.value.trim()) {
                dynamicFields[label] = field.value;
            }
        });

        // Generate credential text
        const credentialText = this.generateCredentialText({
            title, category, url, username, password, notes, dynamicFields
        });

        // Insert into editor
        this.insertText(credentialText);
        this.closeCredentialForm();
        this.showNotification('Credentials added successfully!');
    }

    generateCredentialText({ title, category, url, username, password, notes, dynamicFields }) {
        const categoryEmojis = {
            'web-hosting': '🌐',
            'domain': '🔗',
            'social-media': '📱',
            'email': '📧',
            'database': '🗄️',
            'ftp': '📁',
            'api': '🔑',
            'server': '🖥️',
            'other': '🔧'
        };

        const emoji = categoryEmojis[category] || '🔧';
        const categoryName = category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        let text = `## ${emoji} ${title}\n\n`;
        text += `**Category:** ${categoryName}\n`;
        
        if (url) text += `**URL:** ${url}\n`;
        text += `**Username:** ${username}\n`;
        text += `**Password:** ${password}\n`;
        
        // Add dynamic fields
        Object.entries(dynamicFields).forEach(([label, value]) => {
            text += `**${label}:** ${value}\n`;
        });
        
        if (notes) {
            text += `\n**Notes:**\n${notes}\n`;
        }
        
        text += `\n**Created:** ${new Date().toLocaleDateString()}\n\n---\n\n`;
        
        return text;
    }

    insertCredentialTemplate(templateType) {
        const templates = {
            'web-hosting': {
                title: 'Web Hosting Account',
                category: 'web-hosting',
                url: '',
                username: '',
                password: '',
                dynamicFields: {
                    'Control Panel URL': '',
                    'Server IP': '',
                    'SSH Port': '22'
                },
                notes: 'Enter hosting provider details and access information'
            },
            'domain': {
                title: 'Domain Registration',
                category: 'domain',
                url: '',
                username: '',
                password: '',
                dynamicFields: {
                    'Registrar': '',
                    'Domain Name': '',
                    'Nameservers': ''
                },
                notes: 'Domain management and DNS configuration details'
            },
            'social-media': {
                title: 'Social Media Account',
                category: 'social-media',
                url: '',
                username: '',
                password: '',
                dynamicFields: {
                    'Platform': '',
                    'Profile URL': '',
                    'Backup Email': ''
                },
                notes: 'Social media account access and recovery information'
            },
            'email': {
                title: 'Email Account',
                category: 'email',
                url: '',
                username: '',
                password: '',
                dynamicFields: {
                    'Email Provider': '',
                    'IMAP Server': '',
                    'SMTP Server': '',
                    'Port (IMAP)': '993',
                    'Port (SMTP)': '587'
                },
                notes: 'Email configuration and server settings'
            },
            'database': {
                title: 'Database Access',
                category: 'database',
                url: '',
                username: '',
                password: '',
                dynamicFields: {
                    'Database Type': '',
                    'Host/Server': '',
                    'Port': '3306',
                    'Database Name': ''
                },
                notes: 'Database connection and access credentials'
            },
            'ftp': {
                title: 'FTP/SFTP Access',
                category: 'ftp',
                url: '',
                username: '',
                password: '',
                dynamicFields: {
                    'Protocol': 'SFTP',
                    'Host': '',
                    'Port': '21',
                    'Root Directory': '/public_html/'
                },
                notes: 'File transfer protocol access details'
            },
            'api': {
                title: 'API Keys',
                category: 'api',
                url: '',
                username: '',
                password: '',
                dynamicFields: {
                    'API Provider': '',
                    'API Key': '',
                    'Secret Key': '',
                    'Endpoint': ''
                },
                notes: 'API access keys and integration details'
            },
            'server': {
                title: 'Server Access',
                category: 'server',
                url: '',
                username: '',
                password: '',
                dynamicFields: {
                    'Server Type': '',
                    'IP Address': '',
                    'SSH Port': '22',
                    'Operating System': ''
                },
                notes: 'Server access and configuration information'
            }
        };

        const template = templates[templateType];
        if (template) {
            const credentialText = this.generateCredentialText(template);
            this.insertText(credentialText);
            this.showNotification(`${template.title} template inserted!`);
        }
    }

    generateSecurePassword(length = 16) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
        let password = '';
        for (let i = 0; i < length; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }
}

// Initialize template manager
document.addEventListener('DOMContentLoaded', () => {
    window.templateManager = new TemplateManager();
});
