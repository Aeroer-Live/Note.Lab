# 📝 Note.Lab

A Markdown note-taking app for developers, with a GitHub-style dark UI, version history, and end-to-end encrypted credentials notes. The backend runs on Cloudflare Workers with a D1 database; the frontend is plain HTML, CSS and JavaScript hosted on Cloudflare Pages.

**Live:** [note-lab.pages.dev](https://note-lab.pages.dev)

## ✨ Features

### Writing
- **Markdown editor** (CodeMirror) with a live preview and a toolbar for common formatting
- **Note types**: standard, plan, code and credentials, each with its own template and toolbar
- **Syntax highlighting** in the preview (Prism), with a **Copy** button on every code block
- **Mermaid diagrams**: a ` ```mermaid ` block renders as a diagram in the preview and in PDF export
- **Auto-save** one second after you stop typing

### Organizing
- **Tags**: add them under the note title; filter by tag from the sidebar; search `#tag` to match tags only
- **Views**: All Notes, Recent (the 10 most recently edited) and Starred
- **Search** across titles, content and tags
- **Categories** in the sidebar by note type

### History, import and export
- **Version history** (Git-like): commit a version with a message, see a line diff against the current note, and restore any version. Earlier states are also kept automatically while you edit, at most every 10 minutes (up to 50 automatic snapshots per note). Restoring keeps the replaced text as a new version, so it can be undone.
- **Export** a note as Markdown or PDF (through the browser's print dialog), or every note as a ZIP of Markdown files
- **Import** `.md`, `.markdown`, `.txt` and `.zip` files. Markdown exported by Note.Lab keeps its title, type, tags and star.

### Security
- **Encrypted credentials notes**: the content of credentials notes is encrypted in the browser (AES-256-GCM) with a key unlocked by your vault passphrase, so the server stores only ciphertext. See [Vault encryption](#-vault-encryption).
- **Passwords** hashed with PBKDF2-SHA256 (100,000 iterations); older hashes are upgraded at the next login
- **JWT sessions** (7 days); resetting a password signs out every existing session
- **Rate limiting** per IP, with strict limits on login, registration and password reset
- **Sanitized preview**: rendered Markdown passes through DOMPurify; Mermaid runs in strict mode

## 🛠️ Tech stack

| Part | Technology |
|---|---|
| Frontend | HTML, CSS, vanilla JavaScript (no build step) |
| Editor and preview | CodeMirror 5, marked, DOMPurify, Prism, Mermaid (loaded only when a note has a diagram) |
| Export and history | JSZip, jsdiff |
| API | Cloudflare Workers, itty-router, `@tsndr/cloudflare-worker-jwt` |
| Database | Cloudflare D1 (SQLite) |
| Key-value store | Cloudflare KV (password reset tokens, session revocation) |
| Frontend hosting | Cloudflare Pages |

Frontend libraries load from cdnjs and jsDelivr; there are no npm frontend dependencies.

## 🏗️ Project structure

```
Note.Lab/
├── index.html               # Main app
├── login.html               # Sign in and registration
├── forgot-password.html     # Password reset
├── frontend/
│   ├── css/                 # main.css, editor.css, login.css
│   ├── js/
│   │   ├── api-config.js    # API client (base URL, auth token, endpoints)
│   │   ├── app.js           # NoteApp: notes, views, saving, sidebar
│   │   ├── editor.js        # NoteEditor: CodeMirror, toolbar, preview pane
│   │   ├── markdown-render.js  # Preview rendering, Mermaid, copy buttons
│   │   ├── templates.js     # Note-type templates and toolbars
│   │   ├── tags.js          # Tag editing and sidebar tag filter
│   │   ├── history.js       # Version history panel
│   │   ├── note-io.js       # Import and export
│   │   ├── vault.js         # Client-side encryption for credentials notes
│   │   ├── login.js, forgot-password.js
│   │   └── auth.js          # Unused
│   └── assets/              # Logo
├── backend/
│   ├── src/
│   │   ├── index.js         # Worker entry point and routes
│   │   ├── handlers/        # auth, notes-enhanced, versions, vault, categories (notes.js is the unused v1 handler)
│   │   ├── middleware/      # JWT verification
│   │   └── utils/           # security (hashing, rate limiting, validation), CORS, email
│   ├── schema/              # SQL schema and migrations
│   └── API_DOCUMENTATION.md
├── wrangler.toml            # Worker configuration (D1 and KV bindings)
└── package.json
```

## 🚀 Getting started

### Prerequisites
- Node.js 18 or later
- A Cloudflare account
- Python 3 (only for serving the frontend locally)

### 1. Install

```bash
npm install
npx wrangler login
```

### 2. Create Cloudflare resources

```bash
# D1 database
npx wrangler d1 create note-lab-db

# KV namespace (reset tokens and session revocation)
npx wrangler kv namespace create SESSIONS
```

Put the returned IDs in `wrangler.toml` under `[[d1_databases]]` and `[[kv_namespaces]]`.

### 3. Create the database tables

```bash
npx wrangler d1 execute note-lab-db --remote --file=backend/schema/schema-v2.sql
```

### 4. Set the JWT secret

```bash
npx wrangler secret put JWT_SECRET
```

Use a long random value. The API refuses to issue or accept tokens without it.

### 5. Set the frontend URL

`FRONTEND_URL` in `wrangler.toml` (`[vars]`) is used to build password reset links. Set it to where the frontend is hosted.

## 💻 Local development

```bash
# Local database
npx wrangler d1 execute note-lab-db --local --file=backend/schema/schema-v2.sql

# API on http://127.0.0.1:8787
npx wrangler dev --local --var JWT_SECRET:local-dev-secret

# Frontend on http://localhost:8000 (in another terminal)
npm run serve
```

> **Note:** the API address is hard-coded in `frontend/js/api-config.js` (`getBaseURL()`), and it points to the production Worker. To use your local API, change it to `http://127.0.0.1:8787/api` while developing, and don't commit that change. Otherwise the local frontend reads and writes production data.

## 📦 Deployment

Deploy the backend first, then the frontend.

### Backend (Worker)

```bash
npx wrangler deploy
```

### Frontend (Pages)

Publish only the app files: the three HTML pages and the `frontend/` folder. Uploading the whole repository would make files such as `wrangler.toml` and the SQL schema public.

```bash
mkdir -p dist
cp index.html login.html forgot-password.html dist/
cp -r frontend dist/
npx wrangler pages deploy dist --project-name note-lab --branch main
```

If the Pages project builds from Git instead, set its build output to the same set of files.

> `npm run build` currently produces broken asset paths and should not be used.

### Database migrations

Run each against the remote database once, in order, when upgrading an existing deployment:

| Migration | When |
|---|---|
| `backend/schema/migrate-v1-to-v2.sql` | Upgrading from the v1 schema |
| `backend/schema/migrate-add-versions.sql` | Adding version history (`note_versions` table) |

```bash
npx wrangler d1 execute note-lab-db --remote --file=backend/schema/migrate-add-versions.sql
```

A new database created from `schema-v2.sql` already includes every table.

## 🔐 Vault encryption

Credentials notes are encrypted end to end:

- The first time you open or create a credentials note, you choose a **vault passphrase**. It never leaves the browser.
- A random AES-256-GCM key encrypts note content. That key is stored on the server only after being wrapped by a key derived from the passphrase (PBKDF2-SHA256, 600,000 iterations).
- The unlocked key lives only in memory; reloading the page locks the vault again.
- When the vault is set up, existing credentials notes are encrypted, and their plaintext version history is deleted. The server rejects plaintext for any note that is already encrypted.

What is **not** encrypted: note titles and tags, other note types, and copies of plaintext that existed before encryption (soft-deleted notes and database backups).

**There is no way to recover a forgotten vault passphrase.** Keep it in a password manager.

## 📡 API

The Worker serves a REST API under `/api`. Authenticated requests send `Authorization: Bearer <token>`.

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register`, `/login`, `/refresh`, `/forgot-password`, `/reset-password` |
| Notes | `GET /api/notes`, `POST /api/notes`, `GET/PUT/DELETE /api/notes/:id`, `GET /api/notes/search`, `GET /api/notes/stats`, `POST /api/notes/bulk-update` |
| Version history | `GET/POST /api/notes/:id/versions`, `GET /api/notes/:id/versions/:versionId`, `POST /api/notes/:id/versions/:versionId/restore` |
| Vault | `GET/PUT /api/user/vault` |
| Profile | `GET/PUT /api/user/profile` |
| Categories | `GET/POST /api/categories`, `PUT/DELETE /api/categories/:id`, `POST /api/categories/assign`, `GET /api/notes/:noteId/categories` |
| Health | `GET /api/health` |

[backend/API_DOCUMENTATION.md](backend/API_DOCUMENTATION.md) has request and response details for the auth, notes and categories endpoints. It does not yet cover version history or the vault.

## ⚠️ Known limitations

- **Password reset emails are not sent yet.** The reset link is only written to the Worker's logs (`npx wrangler tail`).
- Rust syntax highlighting in the editor fails to load (a missing CodeMirror add-on).
- Email addresses are case-sensitive at login.
- The vault has no "change passphrase" option or inactivity auto-lock yet.

## 🗺️ Roadmap

- [x] Export and import (Markdown, PDF, ZIP)
- [x] Version history
- [x] Encrypted credentials notes
- [x] Tags, Mermaid diagrams, code copy buttons
- [ ] Send password reset emails (Cloudflare Email Sending)
- [ ] Change vault passphrase and auto-lock
- [ ] Offline mode with sync
- [ ] Shared read-only links
- [ ] Wiki links and backlinks
- [ ] Two-factor authentication
- [ ] Account deletion and data export

## 📄 License

MIT, as declared in `package.json`. The repository does not include a LICENSE file yet.
