-- Migration: add note version history
-- Run: wrangler d1 execute note-lab-db --remote --file=backend/schema/migrate-add-versions.sql

-- Note version history (Git-like commits)
CREATE TABLE IF NOT EXISTS note_versions (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    message TEXT, -- commit message; NULL for automatic snapshots
    kind TEXT NOT NULL DEFAULT 'auto', -- 'auto', 'commit', 'restore'
    created_at TEXT NOT NULL,
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_note_versions_note ON note_versions(note_id, created_at DESC);
