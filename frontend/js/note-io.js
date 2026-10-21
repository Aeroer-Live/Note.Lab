// Export (Markdown, PDF, ZIP of all notes) and import (Markdown, text, ZIP) of notes
const NOTE_TYPES = ['standard', 'plan', 'code', 'credentials'];
const MARKDOWN_FILE = /\.(md|markdown|txt)$/i;
const MAX_IMPORT_BYTES = 1024 * 1024;
const FRONT_MATTER = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)(?:[ \t]*\r?\n)?/;

const PRINT_STYLES = `
    @page { margin: 18mm 16mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
           color: #1f2328; font-size: 11pt; line-height: 1.6; margin: 0; }
    h1, h2, h3, h4 { line-height: 1.25; margin: 1.4em 0 0.5em; break-after: avoid; }
    h1 { font-size: 1.8em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
    h2 { font-size: 1.4em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
    .doc-title { margin-top: 0; }
    p, ul, ol, table, pre, blockquote { margin: 0 0 1em; }
    a { color: #0969da; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.9em;
           background: #f6f8fa; padding: 0.15em 0.35em; border-radius: 4px; }
    pre { background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; padding: 12px;
          white-space: pre-wrap; word-wrap: break-word; break-inside: avoid; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 4px solid #d0d7de; color: #59636e; padding: 0 1em; margin-left: 0; }
    table { border-collapse: collapse; }
    th, td { border: 1px solid #d0d7de; padding: 6px 12px; text-align: left; }
    th { background: #f6f8fa; }
    img { max-width: 100%; }
    hr { border: 0; border-top: 1px solid #d0d7de; }
`;

class NoteIO {
    constructor(app) {
        this.app = app;
        this.printFrame = null;
        this.bindEvents();
    }

    bindEvents() {
        const exportBtn = document.getElementById('exportNoteBtn');
        const exportMenu = document.getElementById('exportMenu');

        exportBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.setExportMenuOpen(exportMenu.hidden);
        });

        exportMenu.addEventListener('click', (e) => {
            const item = e.target.closest('[data-export]');
            if (!item) return;
            this.setExportMenuOpen(false);
            if (item.dataset.export === 'pdf') {
                this.exportPdf(this.app.currentNote);
            } else {
                this.exportMarkdown(this.app.currentNote);
            }
        });

        document.addEventListener('click', (e) => {
            if (!exportMenu.hidden && !e.target.closest('#exportDropdown')) {
                this.setExportMenuOpen(false);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !exportMenu.hidden) {
                this.setExportMenuOpen(false);
                exportBtn.focus();
            }
        });

        const fileInput = document.getElementById('importFileInput');
        document.getElementById('importNotesBtn').addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
            const files = Array.from(fileInput.files);
            fileInput.value = '';
            if (files.length) this.importFiles(files);
        });

        document.getElementById('exportAllBtn').addEventListener('click', () => this.exportAll());
    }

    setExportMenuOpen(open) {
        document.getElementById('exportMenu').hidden = !open;
        document.getElementById('exportNoteBtn').setAttribute('aria-expanded', String(open));
    }

    setBusy(busy) {
        ['importNotesBtn', 'exportAllBtn'].forEach(id => {
            document.getElementById(id).disabled = busy;
        });
    }

    // Markdown with a front-matter header, so an exported note imports back with its title, type and tags
    toMarkdown(note) {
        const header = [
            '---',
            `title: ${JSON.stringify(note.title || 'Untitled note')}`,
            `type: ${note.type || 'standard'}`,
            `tags: ${JSON.stringify(note.tags || [])}`,
            `starred: ${note.starred ? 'true' : 'false'}`
        ];
        if (note.createdAt) header.push(`created: ${note.createdAt}`);
        if (note.updatedAt) header.push(`updated: ${note.updatedAt}`);
        header.push('---', '');

        return header.join('\n') + '\n' + (note.content || '');
    }

    fileName(title, extension) {
        const base = (title || '')
            .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 80)
            .replace(/[. ]+$/, '');
        return (base || 'note') + extension;
    }

    download(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    exportMarkdown(note) {
        if (!note) return;
        const blob = new Blob([this.toMarkdown(note)], { type: 'text/markdown;charset=utf-8' });
        this.download(blob, this.fileName(note.title, '.md'));
    }

    // Renders the note as a clean light document and opens the browser's print dialog,
    // where "Save as PDF" produces a text PDF (selectable and searchable)
    exportPdf(note) {
        if (!note) return;
        if (!window.marked || !window.DOMPurify) {
            this.app.showToast('PDF export is unavailable: the Markdown renderer did not load', 'error');
            return;
        }

        const title = note.title || 'Untitled note';
        const body = DOMPurify.sanitize(marked.parse(note.content || ''));
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>${this.app.escapeHtml(title)}</title>` +
            `<style>${PRINT_STYLES}</style></head><body><h1 class="doc-title">${this.app.escapeHtml(title)}</h1>${body}</body></html>`;

        if (this.printFrame) this.printFrame.remove();
        const frame = document.createElement('iframe');
        frame.setAttribute('aria-hidden', 'true');
        frame.tabIndex = -1;
        frame.style.cssText = 'position: fixed; right: 0; bottom: 0; width: 0; height: 0; border: 0;';
        this.printFrame = frame;

        frame.addEventListener('load', () => {
            // Browsers name the PDF after the page title
            const pageTitle = document.title;
            document.title = title;
            frame.contentWindow.addEventListener('afterprint', () => {
                document.title = pageTitle;
                frame.remove();
                if (this.printFrame === frame) this.printFrame = null;
            }, { once: true });
            frame.contentWindow.focus();
            frame.contentWindow.print();
        }, { once: true });

        frame.srcdoc = html;
        document.body.appendChild(frame);
    }

    async fetchAllNotes() {
        const notes = [];
        let offset = 0;

        for (;;) {
            const response = await window.api.getNotes({ limit: 100, offset });
            if (!response.success) {
                throw new Error(response.message || 'Failed to load notes');
            }
            notes.push(...response.data.notes);
            if (!response.data.pagination.hasMore || response.data.notes.length === 0) break;
            offset += response.data.notes.length;
        }

        return notes;
    }

    async exportAll() {
        if (!window.JSZip) {
            this.app.showToast('Export is unavailable: the ZIP library did not load', 'error');
            return;
        }

        this.setBusy(true);
        try {
            // Export what the server holds, so pending edits are saved first and notes beyond
            // the ones loaded in the sidebar are included
            await this.app.settleSaves();
            const notes = await this.fetchAllNotes();

            if (notes.length === 0) {
                this.app.showToast('There are no notes to export', 'info');
                return;
            }

            // Encrypted notes go out readable when the vault is unlocked, otherwise still
            // encrypted (they import back into an account with the same vault)
            let stillEncrypted = 0;
            for (const note of notes) {
                if (!Vault.isEncrypted(note.content)) continue;
                if (window.vault.isUnlocked()) {
                    note.content = await window.vault.decrypt(note.content);
                } else {
                    stillEncrypted++;
                }
            }

            const zip = new JSZip();
            const used = new Set();
            for (const note of notes) {
                let name = this.fileName(note.title, '.md');
                for (let n = 2; used.has(name.toLowerCase()); n++) {
                    name = this.fileName(`${note.title || 'note'} (${n})`, '.md');
                }
                used.add(name.toLowerCase());
                zip.file(name, this.toMarkdown(note));
            }

            const blob = await zip.generateAsync({ type: 'blob' });
            const date = new Date().toISOString().slice(0, 10);
            this.download(blob, `note-lab-export-${date}.zip`);
            this.app.showToast(`Exported ${notes.length} note${notes.length === 1 ? '' : 's'}` +
                (stillEncrypted ? `; ${stillEncrypted} still encrypted because the vault is locked` : ''));
        } catch (error) {
            console.error('Export failed:', error);
            this.app.showToast('Export failed: ' + error.message, 'error');
        } finally {
            this.setBusy(false);
        }
    }

    parseFrontMatter(block) {
        const meta = {};
        for (const line of block.split(/\r?\n/)) {
            const match = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
            if (!match) continue;

            let value = match[2].trim();
            if (value === 'true' || value === 'false') {
                value = value === 'true';
            } else if (value.startsWith('"') || value.startsWith('[')) {
                try {
                    value = JSON.parse(value);
                } catch {
                    // YAML allows unquoted list items and loose quoting: [a, b] or "text
                    value = value.startsWith('[')
                        ? value.replace(/^\[|\]$/g, '').split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
                        : value.replace(/^"|"$/g, '');
                }
            } else if (/^'.*'$/.test(value)) {
                value = value.slice(1, -1).replace(/''/g, "'");
            }
            meta[match[1].toLowerCase()] = value;
        }
        return meta;
    }

    parseMarkdown(text, filename) {
        let content = text.replace(/^﻿/, '');
        let meta = {};

        const frontMatter = content.match(FRONT_MATTER);
        if (frontMatter) {
            meta = this.parseFrontMatter(frontMatter[1]);
            content = content.slice(frontMatter[0].length);
        }

        let title = typeof meta.title === 'string' ? meta.title.trim() : '';
        if (!title) {
            const heading = content.match(/^#\s+(.+?)\s*#*\s*$/m);
            title = heading ? heading[1] : filename.replace(/^.*[\\/]/, '').replace(MARKDOWN_FILE, '');
        }

        let tags = [];
        if (Array.isArray(meta.tags)) {
            tags = meta.tags.filter(tag => typeof tag === 'string');
        } else if (typeof meta.tags === 'string') {
            tags = meta.tags.split(',').map(tag => tag.trim()).filter(Boolean);
        }

        return {
            title: (title.trim() || 'Untitled note').slice(0, 200),
            content,
            type: NOTE_TYPES.includes(meta.type) ? meta.type : 'standard',
            tags: tags.slice(0, 10),
            starred: meta.starred === true,
            metadata: {}
        };
    }

    // Reads the chosen files (and Markdown files inside ZIPs) into { name, text } entries
    async readImportFiles(files) {
        const entries = [];
        const skipped = [];

        for (const file of files) {
            if (/\.zip$/i.test(file.name)) {
                if (!window.JSZip) {
                    skipped.push(file.name);
                    continue;
                }
                const zip = await JSZip.loadAsync(file);
                for (const entry of Object.values(zip.files)) {
                    const base = entry.name.replace(/^.*\//, '');
                    if (entry.dir || entry.name.startsWith('__MACOSX/') || base.startsWith('.') || !MARKDOWN_FILE.test(base)) {
                        continue;
                    }
                    const text = await entry.async('string');
                    if (text.length > MAX_IMPORT_BYTES) {
                        skipped.push(base);
                    } else {
                        entries.push({ name: base, text });
                    }
                }
            } else if (MARKDOWN_FILE.test(file.name) && file.size <= MAX_IMPORT_BYTES) {
                entries.push({ name: file.name, text: await file.text() });
            } else {
                skipped.push(file.name);
            }
        }

        return { entries, skipped };
    }

    async importFiles(files) {
        this.setBusy(true);
        try {
            const { entries, skipped } = await this.readImportFiles(files);

            if (entries.length === 0) {
                this.app.showToast('No Markdown files to import (accepted: .md, .markdown, .txt, .zip up to 1 MB each)', 'error');
                return;
            }

            const failed = [];
            let imported = 0;
            for (const entry of entries) {
                try {
                    const data = this.parseMarkdown(entry.text, entry.name);

                    // Credentials notes are only ever uploaded encrypted
                    if (Vault.isEncrypted(data.content)) {
                        data.metadata = { encrypted: true };
                    } else if (data.type === 'credentials') {
                        if (!await window.vault.ensureUnlocked()) {
                            failed.push(`${entry.name} (vault locked)`);
                            continue;
                        }
                        data.content = await window.vault.encrypt(data.content);
                        data.metadata = { encrypted: true };
                    }

                    const response = await window.api.createNote(data);
                    if (response.success) {
                        const note = this.app.fromServerNote(response.data.note);
                        if (note.locked && window.vault.isUnlocked()) {
                            try {
                                note.content = await window.vault.decrypt(note.ciphertext);
                                note.locked = false;
                                delete note.ciphertext;
                            } catch {
                                // Encrypted with a different vault: stays locked
                            }
                        }
                        this.app.notes.unshift(note);
                        imported++;
                    } else {
                        failed.push(entry.name);
                    }
                } catch (error) {
                    console.error('Import failed for', entry.name, error);
                    failed.push(entry.name);
                }
            }

            this.app.displayNotes();

            const notSaved = [...failed, ...skipped];
            if (notSaved.length) {
                this.app.showToast(`Imported ${imported} of ${imported + notSaved.length}. Not imported: ${notSaved.join(', ')}`, 'error');
            } else {
                this.app.showToast(`Imported ${imported} note${imported === 1 ? '' : 's'}`);
            }
        } catch (error) {
            console.error('Import failed:', error);
            this.app.showToast('Import failed: ' + error.message, 'error');
        } finally {
            this.setBusy(false);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.noteApp) {
        window.noteIO = new NoteIO(window.noteApp);
    }
});
