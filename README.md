# 📝 Note.Lab - Developer Notes System

A cloud-based note-taking system tailored for developers, featuring GitHub-inspired UI and powerful markdown editing capabilities.

## 🚀 Features

- **Rich Markdown Editor** with syntax highlighting
- **GitHub-inspired UI** - clean, minimal, developer-friendly
- **Cloud Sync** - access notes from any device
- **Organization** - tags, folders, search, and starred notes
- **Auto-save** - never lose your work
- **Responsive Design** - works on desktop and mobile

## 🛠️ Tech Stack

### Frontend
- HTML, CSS, JavaScript
- CodeMirror for markdown editing
- Prism.js for syntax highlighting
- GitHub-inspired dark theme

### Backend (Cloudflare)
- **Cloudflare Workers** - API endpoints
- **Cloudflare D1** - SQLite database
- **Cloudflare R2** - file storage
- **Cloudflare KV** - caching and sessions

## 🏗️ Project Structure

```
Note.Lab/
├── frontend/           # Frontend application
│   ├── index.html     # Main HTML file
│   ├── css/           # Stylesheets
│   ├── js/            # JavaScript modules
│   └── assets/        # Images and icons
├── backend/           # Cloudflare Workers
│   ├── src/           # Worker source code
│   └── schema/        # Database schemas
├── wrangler.toml      # Cloudflare configuration
└── package.json       # Dependencies
```

## 🚀 Getting Started

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run serve
   ```

3. **Deploy to Cloudflare:**
   ```bash
   npm run deploy
   ```

## 📱 Future Enhancements

- [ ] Export/import notes (PDF, MD)
- [ ] Version history (Git-like commits)
- [ ] Offline mode with sync
- [ ] Shared notes with access controls
- [ ] AI integration for summaries

## 📄 License

MIT License - see LICENSE file for details
