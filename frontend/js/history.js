// Version history panel: list versions, compare with the current note, commit and restore
const DIFF_CONTEXT_LINES = 3;

class NoteHistory {
    constructor(app) {
        this.app = app;
        this.note = null;
        this.versions = [];
        this.selectedId = null;
        this.view = 'diff';
        this.cache = new Map();
        this.bindEvents();
    }

    bindEvents() {
        this.modal = document.getElementById('historyModal');

        document.getElementById('historyBtn').addEventListener('click', () => this.open());
        document.getElementById('historyClose').addEventListener('click', () => this.close());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) this.close();
        });

        document.getElementById('commitBtn').addEventListener('click', () => this.commit());
        document.getElementById('commitMessage').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.commit();
        });

        document.getElementById('historyList').addEventListener('click', (e) => {
            const item = e.target.closest('[data-version-id]');
            if (item) this.select(item.dataset.versionId);
        });

        document.querySelectorAll('[data-history-view]').forEach(tab => {
            tab.addEventListener('click', () => {
                this.view = tab.dataset.historyView;
                document.querySelectorAll('[data-history-view]').forEach(t => {
                    t.classList.toggle('active', t === tab);
                    t.setAttribute('aria-selected', String(t === tab));
                });
                this.renderDetail();
            });
        });

        document.getElementById('restoreVersionBtn').addEventListener('click', () => this.restore());
    }

    isOpen() {
        return this.modal.style.display !== 'none';
    }

    async open() {
        const note = this.app.currentNote;
        if (!note) return;

        this.note = note;
        this.selectedId = null;
        this.cache.clear();
        this.modal.style.display = 'flex';
        document.getElementById('historyTitle').textContent = `History: ${note.title || 'Untitled note'}`;
        document.getElementById('commitMessage').value = '';
        this.renderDetail();
        this.setListMessage('Loading…');

        // History lives on the server, so the note must be saved there first
        await this.app.settleSaves();
        if (this.note !== note) return;
        if (!note.id || note.id.startsWith('temp_')) {
            this.setListMessage('This note has not been saved yet. Try again once it is saved.');
            return;
        }

        await this.loadVersions();
        document.getElementById('commitMessage').focus();
    }

    close() {
        this.modal.style.display = 'none';
        this.note = null;
        document.getElementById('historyBtn').focus();
    }

    setListMessage(text) {
        const list = document.getElementById('historyList');
        list.innerHTML = '';
        const item = document.createElement('li');
        item.className = 'history-empty';
        item.textContent = text;
        list.appendChild(item);
    }

    async loadVersions() {
        const note = this.note;
        try {
            const response = await window.api.getNoteVersions(note.id);
            if (this.note !== note) return;
            this.versions = response.data.versions;
            this.renderList();
        } catch (error) {
            console.error('Failed to load history:', error);
            this.setListMessage('Could not load history: ' + error.message);
        }
    }

    describe(version) {
        if (version.message) return version.message;
        return version.kind === 'auto' ? 'Automatic snapshot' : 'Snapshot';
    }

    renderList() {
        const list = document.getElementById('historyList');

        if (this.versions.length === 0) {
            this.setListMessage('No versions yet. Commit to save the current state. Earlier states are also kept automatically while you edit, at most every 10 minutes.');
            return;
        }

        list.innerHTML = this.versions.map(version => `
            <li>
                <button type="button" class="history-item ${version.id === this.selectedId ? 'active' : ''}" data-version-id="${version.id}">
                    <span class="history-item-top">
                        <code class="history-hash">${version.id.slice(0, 7)}</code>
                        <span class="history-kind ${version.kind}">${version.kind === 'commit' ? 'commit' : version.kind === 'restore' ? 'restore' : 'auto'}</span>
                    </span>
                    <span class="history-message">${this.app.escapeHtml(this.describe(version))}</span>
                    <span class="history-meta" title="${new Date(version.createdAt).toLocaleString()}">${this.app.formatTime(version.createdAt)} · ${this.formatSize(version.size)}</span>
                </button>
            </li>
        `).join('');
    }

    // Versions of encrypted notes are stored encrypted
    async readable(content) {
        return Vault.isEncrypted(content) ? window.vault.decrypt(content) : content;
    }

    formatSize(chars) {
        return chars >= 1000 ? `${(chars / 1000).toFixed(1)}k chars` : `${chars} chars`;
    }

    async select(versionId) {
        this.selectedId = versionId;
        this.renderList();

        const note = this.note;
        if (!this.cache.has(versionId)) {
            this.renderDetail('Loading…');
            try {
                const response = await window.api.getNoteVersion(note.id, versionId);
                const version = response.data.version;
                version.content = await this.readable(version.content);
                this.cache.set(versionId, version);
            } catch (error) {
                if (this.selectedId === versionId) this.renderDetail('Could not load this version: ' + error.message);
                return;
            }
        }

        if (this.note === note && this.selectedId === versionId) this.renderDetail();
    }

    renderDetail(message) {
        const view = document.getElementById('historyView');
        const legend = document.getElementById('historyLegend');
        const restoreBtn = document.getElementById('restoreVersionBtn');
        const version = this.selectedId ? this.cache.get(this.selectedId) : null;

        restoreBtn.disabled = !version;
        legend.textContent = '';
        view.innerHTML = '';

        if (message || !version) {
            const empty = document.createElement('p');
            empty.className = 'history-empty';
            empty.textContent = message || 'Select a version to see how it differs from the current note.';
            view.appendChild(empty);
            return;
        }

        if (this.view === 'content') {
            legend.textContent = `"${version.title}" as of ${new Date(version.createdAt).toLocaleString()}`;
            const pre = document.createElement('pre');
            pre.className = 'history-content';
            pre.textContent = version.content || '(empty)';
            view.appendChild(pre);
            return;
        }

        this.renderDiff(version, view, legend);
    }

    // Line diff from the selected version to the current note, with unchanged runs collapsed
    renderDiff(version, view, legend) {
        if (!window.Diff) {
            legend.textContent = 'Comparison is unavailable: the diff library did not load. Use the Content tab.';
            return;
        }

        const current = this.note;
        const lines = [];
        let added = 0;
        let removed = 0;

        for (const part of Diff.diffLines(version.content || '', current.content || '')) {
            const partLines = part.value.replace(/\n$/, '').split('\n');
            const kind = part.added ? 'added' : part.removed ? 'removed' : 'same';
            if (part.added) added += partLines.length;
            if (part.removed) removed += partLines.length;
            partLines.forEach(text => lines.push({ kind, text }));
        }

        const titleChanged = version.title !== current.title;
        if (!added && !removed && !titleChanged) {
            legend.textContent = 'This version is identical to the current note.';
            return;
        }

        legend.textContent = `Changes from this version to the current note: +${added} −${removed} lines` +
            (titleChanged ? `; title was "${version.title}"` : '');

        const keep = lines.map(() => false);
        lines.forEach((line, i) => {
            if (line.kind === 'same') return;
            for (let j = Math.max(0, i - DIFF_CONTEXT_LINES); j <= Math.min(lines.length - 1, i + DIFF_CONTEXT_LINES); j++) {
                keep[j] = true;
            }
        });

        const out = document.createElement('div');
        out.className = 'history-diff';
        let hidden = 0;
        const flushHidden = () => {
            if (!hidden) return;
            const gap = document.createElement('div');
            gap.className = 'diff-line diff-gap';
            gap.textContent = `… ${hidden} unchanged line${hidden === 1 ? '' : 's'}`;
            out.appendChild(gap);
            hidden = 0;
        };

        lines.forEach((line, i) => {
            if (!keep[i]) {
                hidden++;
                return;
            }
            flushHidden();
            const row = document.createElement('div');
            row.className = `diff-line diff-${line.kind}`;
            row.textContent = (line.kind === 'added' ? '+ ' : line.kind === 'removed' ? '- ' : '  ') + line.text;
            out.appendChild(row);
        });
        flushHidden();

        view.appendChild(out);
    }

    async commit() {
        const note = this.note;
        if (!note || !note.id || note.id.startsWith('temp_')) return;

        const input = document.getElementById('commitMessage');
        const button = document.getElementById('commitBtn');
        button.disabled = true;

        try {
            await this.app.settleSaves();
            const response = await window.api.commitNoteVersion(note.id, input.value.trim());
            if (this.note !== note) return;

            if (response.data.nothingToCommit) {
                this.app.showToast('Nothing to commit: the latest commit already matches this note', 'info');
            } else {
                input.value = '';
                this.app.showToast(`Committed ${response.data.version.id.slice(0, 7)}`);
            }

            await this.loadVersions();
        } catch (error) {
            console.error('Commit failed:', error);
            this.app.showToast('Commit failed: ' + error.message, 'error');
        } finally {
            button.disabled = false;
        }
    }

    async restore() {
        const note = this.note;
        const version = this.selectedId ? this.cache.get(this.selectedId) : null;
        if (!note || !version) return;

        const hash = version.id.slice(0, 7);
        if (!confirm(`Restore version ${hash}? The current text is kept in history, so this can be undone.`)) return;

        const button = document.getElementById('restoreVersionBtn');
        button.disabled = true;

        try {
            // Save in-progress edits first so they are the state kept in history
            await this.app.settleSaves();
            const response = await window.api.restoreNoteVersion(note.id, version.id);
            const restored = response.data.note;

            const content = await this.readable(restored.content);
            note.title = restored.title;
            note.content = content;
            note.updatedAt = restored.updatedAt;

            if (this.app.currentNote === note) {
                this.app.updateNoteEditor();
                this.app.updateMobileTitle();
            }
            this.app.updateNoteInList(note);
            this.app.showToast(`Restored version ${hash}`);

            if (this.note === note) {
                document.getElementById('historyTitle').textContent = `History: ${note.title || 'Untitled note'}`;
                await this.loadVersions();
                this.renderDetail();
            }
        } catch (error) {
            console.error('Restore failed:', error);
            this.app.showToast('Restore failed: ' + error.message, 'error');
            button.disabled = false;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.noteApp) {
        window.noteHistory = new NoteHistory(window.noteApp);
    }
});
