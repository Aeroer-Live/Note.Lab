-- Migration scripts for Note.Lab database
-- Run these in order when setting up or updating the database

-- Migration 1: Initial schema
-- Run: wrangler d1 execute note-lab-db --file=backend/schema/schema.sql

-- Migration 2: Add sample data (optional, for development)
INSERT OR IGNORE INTO users (id, email, password_hash, name, created_at, updated_at) VALUES 
(
    'demo-user-id',
    'demo@notelab.dev',
    'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', -- password: demo123
    'Demo User',
    datetime('now'),
    datetime('now')
);

INSERT OR IGNORE INTO notes (id, user_id, title, content, starred, tags, created_at, updated_at) VALUES
(
    'demo-note-1',
    'demo-user-id',
    'Welcome to Note.Lab',
    '# Welcome to Note.Lab! 📝

This is your first note in Note.Lab, a developer-focused note-taking system.

## Features

- **Markdown Support**: Write notes in markdown with syntax highlighting
- **Code Blocks**: Perfect for storing code snippets
- **Organization**: Use tags and starring to organize your notes
- **Cloud Sync**: Access your notes from anywhere

## Example Code Block

```javascript
function greetUser(name) {
    console.log(`Hello, ${name}! Welcome to Note.Lab!`);
}

greetUser("Developer");
```

## Tips

- Use `Ctrl/Cmd + B` for **bold** text
- Use `Ctrl/Cmd + I` for *italic* text  
- Use `Ctrl/Cmd + K` to create [links](https://notelab.dev)
- Use `Ctrl/Cmd + ` for `inline code`

Happy note-taking! 🚀',
    1,
    '["welcome", "getting-started", "tutorial"]',
    datetime('now'),
    datetime('now')
),
(
    'demo-note-2',
    'demo-user-id',
    'JavaScript Cheat Sheet',
    '# JavaScript Quick Reference

## Array Methods

```javascript
// Map - transform elements
const doubled = [1, 2, 3].map(x => x * 2); // [2, 4, 6]

// Filter - select elements
const evens = [1, 2, 3, 4].filter(x => x % 2 === 0); // [2, 4]

// Reduce - accumulate values
const sum = [1, 2, 3].reduce((acc, x) => acc + x, 0); // 6
```

## Async/Await

```javascript
async function fetchData() {
    try {
        const response = await fetch("/api/data");
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error:", error);
    }
}
```

## Destructuring

```javascript
// Array destructuring
const [first, second] = [1, 2, 3];

// Object destructuring
const { name, age } = { name: "John", age: 30 };
```',
    0,
    '["javascript", "cheatsheet", "reference"]',
    datetime('now'),
    datetime('now')
);

-- Migration 3: Add additional indexes (future)
-- CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);

-- Migration 4: Add user preferences table (future)
-- CREATE TABLE IF NOT EXISTS user_preferences (
--     user_id TEXT PRIMARY KEY,
--     theme TEXT DEFAULT 'dark',
--     editor_font_size INTEGER DEFAULT 14,
--     auto_save_interval INTEGER DEFAULT 1000,
--     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
-- );
