-- Migration script: v1 to v2
-- This script upgrades the Note.Lab database from the original schema to the enhanced schema

-- Start transaction
BEGIN TRANSACTION;

-- 1. Add new columns to users table
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN preferences TEXT DEFAULT '{}';
ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN email_verification_token TEXT;

-- 2. Add new columns to notes table
ALTER TABLE notes ADD COLUMN type TEXT DEFAULT 'standard';
ALTER TABLE notes ADD COLUMN metadata TEXT DEFAULT '{}';
ALTER TABLE notes ADD COLUMN deleted_at TEXT;

-- 3. Create new tables
-- Note categories table
CREATE TABLE IF NOT EXISTS note_categories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#238636',
    icon TEXT DEFAULT '📄',
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Note category assignments
CREATE TABLE IF NOT EXISTS note_category_assignments (
    note_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    PRIMARY KEY (note_id, category_id),
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES note_categories(id) ON DELETE CASCADE
);

-- File attachments table
CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    device_info TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_used_at TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- API rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    metadata TEXT DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 4. Create indexes for new tables
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);

CREATE INDEX IF NOT EXISTS idx_notes_type ON notes(type);
CREATE INDEX IF NOT EXISTS idx_notes_deleted_at ON notes(deleted_at);

CREATE INDEX IF NOT EXISTS idx_note_categories_user_id ON note_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_note_categories_sort_order ON note_categories(sort_order);

CREATE INDEX IF NOT EXISTS idx_attachments_note_id ON attachments(note_id);
CREATE INDEX IF NOT EXISTS idx_attachments_user_id ON attachments(user_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_endpoint ON rate_limits(identifier, endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- 5. Create full-text search table
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    title, 
    content, 
    content='notes', 
    content_rowid='rowid',
    tokenize='porter unicode61'
);

-- 6. Create triggers for full-text search
CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(rowid, title, content) VALUES (NEW.rowid, NEW.title, NEW.content);
END;

CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES('delete', OLD.rowid, OLD.title, OLD.content);
END;

CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES('delete', OLD.rowid, OLD.title, OLD.content);
    INSERT INTO notes_fts(rowid, title, content) VALUES (NEW.rowid, NEW.title, NEW.content);
END;

-- 7. Create triggers for updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_note_categories_updated_at 
    AFTER UPDATE ON note_categories
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE note_categories SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- 8. Create cleanup triggers
CREATE TRIGGER IF NOT EXISTS cleanup_expired_sessions
    AFTER INSERT ON user_sessions
BEGIN
    DELETE FROM user_sessions WHERE expires_at < datetime('now');
END;

CREATE TRIGGER IF NOT EXISTS cleanup_expired_reset_tokens
    AFTER INSERT ON password_reset_tokens
BEGIN
    DELETE FROM password_reset_tokens WHERE expires_at < datetime('now');
END;

CREATE TRIGGER IF NOT EXISTS cleanup_old_rate_limits
    AFTER INSERT ON rate_limits
BEGIN
    DELETE FROM rate_limits WHERE window_start < datetime('now', '-1 hour');
END;

CREATE TRIGGER IF NOT EXISTS cleanup_old_activity_logs
    AFTER INSERT ON activity_logs
BEGIN
    DELETE FROM activity_logs WHERE created_at < datetime('now', '-90 days');
END;

-- 9. Populate full-text search with existing notes
INSERT INTO notes_fts(rowid, title, content)
SELECT rowid, title, content FROM notes WHERE deleted_at IS NULL;

-- 10. Create default categories for existing users
INSERT INTO note_categories (id, user_id, name, color, icon, sort_order, created_at, updated_at)
SELECT 
    'default-' || users.id,
    users.id,
    'General',
    '#238636',
    '📄',
    0,
    datetime('now'),
    datetime('now')
FROM users
WHERE NOT EXISTS (
    SELECT 1 FROM note_categories WHERE user_id = users.id AND name = 'General'
);

-- 11. Update existing notes to have proper type if not set
UPDATE notes SET type = 'standard' WHERE type IS NULL;

-- 12. Update existing notes to have proper metadata if not set
UPDATE notes SET metadata = '{}' WHERE metadata IS NULL;

-- 13. Update existing users to have proper preferences if not set
UPDATE users SET preferences = '{}' WHERE preferences IS NULL;

-- 14. Update existing users to be active
UPDATE users SET is_active = 1 WHERE is_active IS NULL;

-- 15. Update existing users to have email_verified = 0 (legacy users)
UPDATE users SET email_verified = 0 WHERE email_verified IS NULL;

-- Commit transaction
COMMIT;

-- Verify migration
SELECT 'Migration completed successfully' as status;

-- Show summary of changes
SELECT 'Users table' as table_name, COUNT(*) as record_count FROM users
UNION ALL
SELECT 'Notes table', COUNT(*) FROM notes
UNION ALL
SELECT 'Categories table', COUNT(*) FROM note_categories
UNION ALL
SELECT 'Full-text search', COUNT(*) FROM notes_fts;
