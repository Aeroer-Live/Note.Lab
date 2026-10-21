// Markdown rendering shared by the editor preview and PDF export:
// sanitized HTML, syntax highlighting, Mermaid diagrams and copy buttons on code blocks
const MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js';
const MERMAID_CACHE_SIZE = 50;

class NoteMarkdown {
    constructor() {
        this.mermaidPromise = null;
        this.renderQueue = Promise.resolve();
        this.cache = new Map();
        this.diagramCount = 0;
    }

    toSafeHtml(markdown) {
        // Refuse to render unsanitized HTML if DOMPurify failed to load
        if (!window.marked || !window.DOMPurify) {
            throw new Error('Markdown renderer did not load');
        }
        return DOMPurify.sanitize(marked.parse(markdown || ''));
    }

    // Renders into a live element. Diagrams fill in as they finish rendering.
    renderInto(container, markdown, { theme = 'dark', interactive = true } = {}) {
        container.innerHTML = this.toSafeHtml(markdown);
        const diagrams = this.replaceMermaidBlocks(container, theme);

        if (window.Prism) {
            window.Prism.highlightAllUnder(container);
        }
        if (interactive) {
            this.addCopyButtons(container);
        }
        return diagrams;
    }

    // Fully rendered HTML (diagrams included), for documents such as PDF export
    async renderToHtml(markdown, { theme = 'default' } = {}) {
        const container = document.createElement('div');
        await this.renderInto(container, markdown, { theme, interactive: false });
        return container.innerHTML;
    }

    replaceMermaidBlocks(container, theme) {
        const jobs = [];
        container.querySelectorAll('pre > code.language-mermaid').forEach(code => {
            const source = code.textContent;
            const holder = document.createElement('div');
            holder.className = 'mermaid-diagram';
            code.parentElement.replaceWith(holder);

            const cached = this.cache.get(this.cacheKey(theme, source));
            if (cached) {
                this.showDiagram(holder, cached);
                return;
            }

            holder.classList.add('pending');
            holder.textContent = 'Rendering diagram…';
            jobs.push(this.renderDiagram(source, theme).then(result => this.showDiagram(holder, result)));
        });
        return Promise.all(jobs);
    }

    showDiagram(holder, result) {
        holder.classList.remove('pending');
        if (result.svg) {
            holder.classList.remove('error');
            holder.innerHTML = result.svg;
        } else {
            holder.classList.add('error');
            holder.textContent = 'Diagram error: ' + result.error;
        }
    }

    cacheKey(theme, source) {
        return theme + '\n' + source;
    }

    loadMermaid() {
        if (!this.mermaidPromise) {
            this.mermaidPromise = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = MERMAID_URL;
                script.onload = () => resolve(window.mermaid);
                script.onerror = () => {
                    this.mermaidPromise = null;
                    script.remove();
                    reject(new Error('the Mermaid library could not be loaded'));
                };
                document.head.appendChild(script);
            });
        }
        return this.mermaidPromise;
    }

    // Mermaid keeps global state, so renders run one at a time
    renderDiagram(source, theme) {
        const run = async () => {
            const key = this.cacheKey(theme, source);
            if (this.cache.has(key)) return this.cache.get(key);

            let result;
            const id = `note-diagram-${++this.diagramCount}`;
            try {
                const mermaid = await this.loadMermaid();
                // strict: Mermaid sanitizes labels and disables click handlers and scripts
                mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme });
                await mermaid.parse(source);
                const { svg } = await mermaid.render(id, source);
                result = { svg };
            } catch (error) {
                result = { error: (error && (error.message || error.str)) || 'could not render this diagram' };
            } finally {
                // Mermaid can leave its scratch element behind when rendering fails
                document.getElementById(id)?.remove();
                document.getElementById('d' + id)?.remove();
            }

            this.cache.set(key, result);
            if (this.cache.size > MERMAID_CACHE_SIZE) {
                this.cache.delete(this.cache.keys().next().value);
            }
            return result;
        };

        const next = this.renderQueue.then(run, run);
        this.renderQueue = next.catch(() => {});
        return next;
    }

    addCopyButtons(container) {
        container.querySelectorAll('pre').forEach(pre => {
            const code = pre.querySelector('code');
            if (!code) return;

            const wrapper = document.createElement('div');
            wrapper.className = 'code-block';
            pre.replaceWith(wrapper);
            wrapper.appendChild(pre);

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'code-copy-btn';
            button.textContent = 'Copy';
            button.setAttribute('aria-label', 'Copy code');
            button.addEventListener('click', async () => {
                const copied = await this.copyText(code.textContent);
                button.textContent = copied ? 'Copied' : 'Copy failed';
                button.classList.toggle('copied', copied);
                clearTimeout(button.resetTimer);
                button.resetTimer = setTimeout(() => {
                    button.textContent = 'Copy';
                    button.classList.remove('copied');
                }, 1500);
            });
            wrapper.appendChild(button);
        });
    }

    async copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Older browsers, or the Clipboard API blocked: fall back to a temporary selection
            const area = document.createElement('textarea');
            area.value = text;
            area.setAttribute('readonly', '');
            area.style.cssText = 'position: fixed; top: -1000px; opacity: 0;';
            document.body.appendChild(area);
            area.select();
            let ok = false;
            try {
                ok = document.execCommand('copy');
            } catch {
                ok = false;
            }
            area.remove();
            return ok;
        }
    }
}

window.noteMarkdown = new NoteMarkdown();
