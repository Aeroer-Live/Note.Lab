// Tags: edit a note's tags in the editor and filter the sidebar by tag
const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 50;

class NoteTags {
    constructor(app) {
        this.app = app;
        this.list = document.getElementById('noteTagList');
        this.input = document.getElementById('noteTagInput');
        this.bindEvents();
    }

    bindEvents() {
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                this.addFromInput();
            } else if (e.key === 'Backspace' && this.input.value === '') {
                const tags = this.currentTags();
                if (tags.length) this.remove(tags[tags.length - 1]);
            }
        });
        // A tag typed but not confirmed is kept when focus leaves the field
        this.input.addEventListener('blur', () => this.addFromInput());

        this.list.addEventListener('click', (e) => {
            const button = e.target.closest('[data-remove-tag]');
            if (button) {
                this.remove(button.dataset.removeTag);
                this.input.focus();
            }
        });

        document.getElementById('sidebarTagList').addEventListener('click', (e) => {
            const button = e.target.closest('[data-filter-tag]');
            if (!button) return;
            const tag = button.dataset.filterTag;
            this.app.activeTag = this.same(this.app.activeTag, tag) ? null : tag;
            this.app.displayNotes();
        });

        document.getElementById('clearTagFilter').addEventListener('click', () => {
            this.app.activeTag = null;
            this.app.displayNotes();
        });
    }

    normalize(tag) {
        return tag.replace(/^#+/, '').replace(/\s+/g, ' ').trim().slice(0, MAX_TAG_LENGTH);
    }

    same(a, b) {
        return Boolean(a && b) && a.toLowerCase() === b.toLowerCase();
    }

    currentTags() {
        const note = this.app.currentNote;
        return note && Array.isArray(note.tags) ? note.tags : [];
    }

    addFromInput() {
        const value = this.input.value;
        if (!value.trim()) return;
        this.input.value = '';
        // Pasting "a, b, c" adds three tags
        value.split(',').forEach(part => this.add(part));
    }

    add(raw) {
        const note = this.app.currentNote;
        const tag = this.normalize(raw);
        if (!note || !tag) return;

        const tags = this.currentTags();
        if (tags.some(existing => this.same(existing, tag))) return;
        if (tags.length >= MAX_TAGS) {
            this.app.showToast(`A note can have at most ${MAX_TAGS} tags`, 'info');
            return;
        }

        this.update(note, [...tags, tag]);
    }

    remove(tag) {
        const note = this.app.currentNote;
        if (!note) return;
        this.update(note, this.currentTags().filter(existing => !this.same(existing, tag)));
    }

    update(note, tags) {
        note.tags = tags;
        note.updatedAt = new Date().toISOString();
        this.renderEditor(note);
        this.app.autoSave();
        this.app.displayNotes();
    }

    renderEditor(note) {
        const tags = note && Array.isArray(note.tags) ? note.tags : [];
        this.list.innerHTML = tags.map(tag => `
            <li class="tag-chip">
                <span>${this.app.escapeHtml(tag)}</span>
                <button type="button" class="tag-remove" data-remove-tag="${this.escapeAttr(tag)}" aria-label="Remove tag ${this.escapeAttr(tag)}">×</button>
            </li>
        `).join('');

        const full = tags.length >= MAX_TAGS;
        this.input.disabled = full;
        this.input.placeholder = full ? `${MAX_TAGS} tags maximum` : (tags.length ? 'Add tag…' : 'Add tags…');
        this.renderSuggestions(tags);
    }

    renderSuggestions(current) {
        const datalist = document.getElementById('tagSuggestions');
        datalist.innerHTML = this.allTags()
            .filter(({ tag }) => !current.some(existing => this.same(existing, tag)))
            .map(({ tag }) => `<option value="${this.escapeAttr(tag)}"></option>`)
            .join('');
    }

    // Every tag in use with its note count, most used first
    allTags() {
        const counts = new Map();
        for (const note of this.app.notes) {
            for (const tag of note.tags || []) {
                const key = tag.toLowerCase();
                const entry = counts.get(key) || { tag, count: 0 };
                entry.count++;
                counts.set(key, entry);
            }
        }
        return [...counts.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
    }

    renderSidebar() {
        const section = document.getElementById('sidebarTags');
        const tags = this.allTags();

        // Forget a filter whose tag no longer exists
        if (this.app.activeTag && !tags.some(({ tag }) => this.same(tag, this.app.activeTag))) {
            this.app.activeTag = null;
        }

        section.hidden = tags.length === 0;
        document.getElementById('clearTagFilter').hidden = !this.app.activeTag;
        document.getElementById('sidebarTagList').innerHTML = tags.map(({ tag, count }) => {
            const active = this.same(tag, this.app.activeTag);
            return `<button type="button" class="sidebar-tag ${active ? 'active' : ''}" data-filter-tag="${this.escapeAttr(tag)}" aria-pressed="${active}">` +
                `${this.app.escapeHtml(tag)} <span class="sidebar-tag-count">${count}</span></button>`;
        }).join('');
    }

    escapeAttr(text) {
        return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.noteApp) {
        window.noteTags = new NoteTags(window.noteApp);
    }
});
