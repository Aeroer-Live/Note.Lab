// Note version history (Git-like commits) for Cloudflare Workers
import { Validator, ActivityLogger, createErrorResponse, createSuccessResponse } from '../utils/security';

// An edit snapshots the previous state when the newest version is older than this
const AUTO_SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000;
// Automatic snapshots kept per note; commits are never pruned
const MAX_AUTO_VERSIONS = 50;

function formatVersion(version, includeContent = false) {
    const formatted = {
        id: version.id,
        noteId: version.note_id,
        title: version.title,
        message: version.message,
        kind: version.kind,
        size: version.size !== undefined ? version.size : (version.content || '').length,
        createdAt: version.created_at
    };
    if (includeContent) {
        formatted.content = version.content;
    }
    return formatted;
}

async function getOwnedNote(env, noteId, userId) {
    return env.DB.prepare(`
        SELECT id, title, content, metadata FROM notes WHERE id = ? AND user_id = ? AND deleted_at IS NULL
    `).bind(noteId, userId).first();
}

async function getLatestVersion(env, noteId) {
    return env.DB.prepare(`
        SELECT * FROM note_versions WHERE note_id = ? ORDER BY created_at DESC LIMIT 1
    `).bind(noteId).first();
}

async function insertVersion(env, note, userId, kind, message) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB.prepare(`
        INSERT INTO note_versions (id, note_id, user_id, title, content, message, kind, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, note.id, userId, note.title, note.content || '', message, kind, now).run();

    if (kind === 'auto') {
        await env.DB.prepare(`
            DELETE FROM note_versions
            WHERE note_id = ? AND kind = 'auto' AND id NOT IN (
                SELECT id FROM note_versions WHERE note_id = ? AND kind = 'auto'
                ORDER BY created_at DESC LIMIT ?
            )
        `).bind(note.id, note.id, MAX_AUTO_VERSIONS).run();
    }

    return { id, note_id: note.id, title: note.title, content: note.content || '', message, kind, created_at: now };
}

function sameState(a, b) {
    return a.title === b.title && (a.content || '') === (b.content || '');
}

// Called by the note update handler before it overwrites a note, so earlier
// states stay recoverable without snapshotting every auto-save
export async function snapshotBeforeUpdate(env, existingNote, userId, incoming) {
    const changed = (incoming.title !== undefined && incoming.title !== existingNote.title) ||
        (incoming.content !== undefined && incoming.content !== (existingNote.content || ''));
    if (!changed) return;

    const latest = await getLatestVersion(env, existingNote.id);
    if (latest && sameState(latest, existingNote)) return;
    if (latest && Date.now() - new Date(latest.created_at).getTime() < AUTO_SNAPSHOT_INTERVAL_MS) return;

    await insertVersion(env, existingNote, userId, 'auto', null);
}

export class VersionsHandler {
    static async list(request, env) {
        try {
            const user = request.user;
            const noteId = request.params.id;

            if (!Validator.isValidUUID(noteId)) {
                return createErrorResponse('Invalid note ID', 400, 'INVALID_NOTE_ID');
            }

            if (!await getOwnedNote(env, noteId, user.id)) {
                return createErrorResponse('Note not found', 404, 'NOTE_NOT_FOUND');
            }

            const versions = await env.DB.prepare(`
                SELECT id, note_id, title, message, kind, LENGTH(content) AS size, created_at
                FROM note_versions WHERE note_id = ?
                ORDER BY created_at DESC LIMIT 200
            `).bind(noteId).all();

            return createSuccessResponse({
                versions: versions.results.map(v => formatVersion(v))
            });

        } catch (error) {
            console.error('Version list error:', error);
            return createErrorResponse('Failed to fetch version history', 500, 'FETCH_ERROR');
        }
    }

    static async get(request, env) {
        try {
            const user = request.user;
            const { id: noteId, versionId } = request.params;

            if (!Validator.isValidUUID(noteId) || !Validator.isValidUUID(versionId)) {
                return createErrorResponse('Invalid ID', 400, 'INVALID_ID');
            }

            if (!await getOwnedNote(env, noteId, user.id)) {
                return createErrorResponse('Note not found', 404, 'NOTE_NOT_FOUND');
            }

            const version = await env.DB.prepare(`
                SELECT * FROM note_versions WHERE id = ? AND note_id = ?
            `).bind(versionId, noteId).first();

            if (!version) {
                return createErrorResponse('Version not found', 404, 'VERSION_NOT_FOUND');
            }

            return createSuccessResponse({ version: formatVersion(version, true) });

        } catch (error) {
            console.error('Version fetch error:', error);
            return createErrorResponse('Failed to fetch version', 500, 'FETCH_ERROR');
        }
    }

    static async commit(request, env) {
        try {
            const user = request.user;
            const noteId = request.params.id;
            const { message } = await request.json();

            if (!Validator.isValidUUID(noteId)) {
                return createErrorResponse('Invalid note ID', 400, 'INVALID_NOTE_ID');
            }

            const note = await getOwnedNote(env, noteId, user.id);
            if (!note) {
                return createErrorResponse('Note not found', 404, 'NOTE_NOT_FOUND');
            }

            const commitMessage = Validator.sanitizeString(message || '', 200) || 'Commit';
            const latest = await getLatestVersion(env, noteId);

            if (latest && sameState(latest, note)) {
                if (latest.kind === 'commit') {
                    return createSuccessResponse({
                        version: formatVersion(latest),
                        nothingToCommit: true
                    });
                }

                // The newest automatic snapshot already holds this state: name it instead of duplicating it
                await env.DB.prepare(`
                    UPDATE note_versions SET kind = 'commit', message = ? WHERE id = ?
                `).bind(commitMessage, latest.id).run();

                return createSuccessResponse({
                    version: formatVersion({ ...latest, kind: 'commit', message: commitMessage })
                }, 201);
            }

            const version = await insertVersion(env, note, user.id, 'commit', commitMessage);

            await ActivityLogger.logActivity(env, {
                userId: user.id,
                action: 'note_commit',
                resourceType: 'note',
                resourceId: noteId,
                metadata: { versionId: version.id }
            });

            return createSuccessResponse({ version: formatVersion(version) }, 201);

        } catch (error) {
            console.error('Version commit error:', error);
            return createErrorResponse('Failed to commit version', 500, 'COMMIT_ERROR');
        }
    }

    static async restore(request, env) {
        try {
            const user = request.user;
            const { id: noteId, versionId } = request.params;

            if (!Validator.isValidUUID(noteId) || !Validator.isValidUUID(versionId)) {
                return createErrorResponse('Invalid ID', 400, 'INVALID_ID');
            }

            const note = await getOwnedNote(env, noteId, user.id);
            if (!note) {
                return createErrorResponse('Note not found', 404, 'NOTE_NOT_FOUND');
            }

            const version = await env.DB.prepare(`
                SELECT * FROM note_versions WHERE id = ? AND note_id = ?
            `).bind(versionId, noteId).first();

            if (!version) {
                return createErrorResponse('Version not found', 404, 'VERSION_NOT_FOUND');
            }

            // An encrypted note must never be restored to plaintext content
            let encrypted = false;
            try { encrypted = JSON.parse(note.metadata || '{}').encrypted === true; } catch { /* not encrypted */ }
            if (encrypted && version.content && !version.content.startsWith('nlenc:v1:')) {
                return createErrorResponse('This version is not encrypted and cannot be restored into an encrypted note', 400, 'ENCRYPTION_REQUIRED');
            }

            // Keep the state being replaced, so a restore can itself be undone
            const latest = await getLatestVersion(env, noteId);
            if (!sameState(version, note) && !(latest && sameState(latest, note))) {
                await insertVersion(env, note, user.id, 'restore', `Before restoring ${versionId.slice(0, 7)}`);
            }

            const now = new Date().toISOString();
            await env.DB.prepare(`
                UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ?
            `).bind(version.title, version.content, now, noteId).run();

            const restored = await env.DB.prepare(`SELECT * FROM notes WHERE id = ?`).bind(noteId).first();

            await ActivityLogger.logActivity(env, {
                userId: user.id,
                action: 'note_restore',
                resourceType: 'note',
                resourceId: noteId,
                metadata: { versionId }
            });

            return createSuccessResponse({
                note: {
                    id: restored.id,
                    title: restored.title,
                    content: restored.content,
                    type: restored.type,
                    starred: Boolean(restored.starred),
                    tags: JSON.parse(restored.tags),
                    metadata: JSON.parse(restored.metadata),
                    createdAt: restored.created_at,
                    updatedAt: restored.updated_at
                }
            });

        } catch (error) {
            console.error('Version restore error:', error);
            return createErrorResponse('Failed to restore version', 500, 'RESTORE_ERROR');
        }
    }
}
