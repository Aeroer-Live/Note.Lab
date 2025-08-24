# 📝 Note.Lab - Developer Notes System

A cloud-based note-taking system tailored for developers, featuring GitHub-inspired UI and powerful markdown editing capabilities.

## 🚀 Features

### Frontend
- **Rich Markdown Editor** with syntax highlighting
- **GitHub-inspired UI** - clean, minimal, developer-friendly
- **Multi-type Notes** - standard, plan, code, and credential notes
- **Auto-save** - never lose your work
- **Save & Return** - one-click save that returns to welcome page
- **Responsive Design** - works on desktop and mobile

### Backend
- **Secure Authentication** - JWT-based auth with session management
- **Password Reset** - secure email-based password recovery
- **Note Organization** - tags, categories, search, and starred notes
- **Full-text Search** - powerful search across all notes
- **Rate Limiting** - API protection against abuse
- **Activity Logging** - comprehensive audit trail
- **Input Validation** - robust data sanitization and validation
- **Soft Deletes** - recoverable note deletion
- **Bulk Operations** - efficient batch note management

## 🛠️ Tech Stack

### Frontend
- HTML, CSS, JavaScript
- CodeMirror for markdown editing
- Prism.js for syntax highlighting
- GitHub-inspired dark theme

### Backend (Cloudflare)
- **Cloudflare Workers** - Serverless API endpoints
- **Cloudflare D1** - SQLite database with full-text search
- **Cloudflare R2** - Object storage for file attachments
- **Cloudflare KV** - Session management and caching
- **itty-router** - Lightweight routing for Workers
- **JWT** - Secure authentication tokens

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

### Prerequisites
- Node.js 16+ and npm
- Cloudflare account
- Wrangler CLI (`npm install -g wrangler`)

### Development Setup

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Cloudflare:**
   ```bash
   wrangler login
   ```

3. **Set up database:**
   ```bash
   # Create D1 database
   wrangler d1 create note-lab-db
   
   # Update wrangler.toml with your database ID
   # Then run the schema
   wrangler d1 execute note-lab-db --file=backend/schema/schema-v2.sql
   ```

4. **Set up KV and R2:**
   ```bash
   # Create KV namespace
   wrangler kv:namespace create "SESSIONS"
   
   # Create R2 bucket
   wrangler r2 bucket create note-lab-attachments
   
   # Update wrangler.toml with your IDs
   ```

5. **Set environment variables:**
   ```bash
   wrangler secret put JWT_SECRET
   wrangler secret put ENVIRONMENT
   ```

6. **Start development:**
   ```bash
   # Start frontend server
   npm run serve
   
   # Start backend in another terminal
   wrangler dev
   ```

### Production Deployment

1. **Deploy backend:**
   ```bash
   wrangler deploy
   ```

2. **Deploy frontend:**
   ```bash
   npm run build
   # Upload dist/ to your hosting provider
   ```

### Database Migration

To upgrade from v1 to v2 schema:
```bash
wrangler d1 execute note-lab-db --file=backend/schema/migrate-v1-to-v2.sql
```

## 📱 Future Enhancements

- [ ] Export/import notes (PDF, MD)
- [ ] Version history (Git-like commits)
- [ ] Offline mode with sync
- [ ] Shared notes with access controls
- [ ] AI integration for summaries
- [ ] Email integration for password reset (SendGrid, Mailgun)
- [ ] Two-factor authentication (2FA)
- [ ] Account deletion and data export

## 📄 License

MIT License - see LICENSE file for details
