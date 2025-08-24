// Enhanced Notes CRUD handlers for Cloudflare Workers
import { corsHeaders } from '../utils/cors';
import { Validator, ActivityLogger, createErrorResponse, createSuccessResponse } from '../utils/security';

export class NotesEnhancedHandler {
    static async list(request, env) {
        try {
            const user = request.user;
            const url = new URL(request.url);
            
            // Query parameters
            const limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 100);
            const offset = parseInt(url.searchParams.get('offset')) || 0;
            const search = url.searchParams.get('search') || '';
            const starred = url.searchParams.get('starred') === 'true';
            const tags = url.searchParams.get('tags') || '';
            const type = url.searchParams.get('type') || '';
            const categoryId = url.searchParams.get('category') || '';
            const sortBy = url.searchParams.get('sort') || 'updated_at';
            const sortOrder = url.searchParams.get('order') || 'desc';
            
            // Validate sort parameters
            const allowedSortFields = ['created_at', 'updated_at', 'title', 'starred'];
            const allowedSortOrders = ['asc', 'desc'];
            
            if (!allowedSortFields.includes(sortBy)) {
                return createErrorResponse('Invalid sort field', 400, 'INVALID_SORT_FIELD');
            }
            
            if (!allowedSortOrders.includes(sortOrder)) {
                return createErrorResponse('Invalid sort order', 400, 'INVALID_SORT_ORDER');
            }
            
            let query = `
                SELECT n.id, n.title, n.content, n.type, n.starred, n.tags, n.metadata,
                       n.created_at, n.updated_at,
                       GROUP_CONCAT(nc.name) as category_names
                FROM notes n
                LEFT JOIN note_category_assignments nca ON n.id = nca.note_id
                LEFT JOIN note_categories nc ON nca.category_id = nc.id
                WHERE n.user_id = ? AND n.deleted_at IS NULL
            `;
            let params = [user.id];
            
            // Add search filter
            if (search) {
                // Use full-text search if available, otherwise fallback to LIKE
                query += ` AND (n.title LIKE ? OR n.content LIKE ?)`;
                params.push(`%${search}%`, `%${search}%`);
            }
            
            // Add starred filter
            if (starred) {
                query += ` AND n.starred = 1`;
            }
            
            // Add type filter
            if (type) {
                query += ` AND n.type = ?`;
                params.push(type);
            }
            
            // Add category filter
            if (categoryId) {
                query += ` AND EXISTS (
                    SELECT 1 FROM note_category_assignments nca2 
                    WHERE nca2.note_id = n.id AND nca2.category_id = ?
                )`;
                params.push(categoryId);
            }
            
            // Add tags filter
            if (tags) {
                const tagList = tags.split(',').map(tag => tag.trim()).filter(Boolean);
                if (tagList.length > 0) {
                    const tagConditions = tagList.map(() => 'n.tags LIKE ?').join(' OR ');
                    query += ` AND (${tagConditions})`;
                    tagList.forEach(tag => params.push(`%${tag}%`));
                }
            }
            
            // Group by note ID to handle multiple categories
            query += ` GROUP BY n.id`;
            
            // Add ordering
            query += ` ORDER BY n.${sortBy} ${sortOrder.toUpperCase()}`;
            
            // Add pagination
            query += ` LIMIT ? OFFSET ?`;
            params.push(limit, offset);
            
            const notes = await env.DB.prepare(query).bind(...params).all();
            
            // Get total count for pagination
            let countQuery = `
                SELECT COUNT(DISTINCT n.id) as total
                FROM notes n
                LEFT JOIN note_category_assignments nca ON n.id = nca.note_id
                WHERE n.user_id = ? AND n.deleted_at IS NULL
            `;
            let countParams = [user.id];
            
            if (search) {
                countQuery += ` AND (n.title LIKE ? OR n.content LIKE ?)`;
                countParams.push(`%${search}%`, `%${search}%`);
            }
            
            if (starred) {
                countQuery += ` AND n.starred = 1`;
            }
            
            if (type) {
                countQuery += ` AND n.type = ?`;
                countParams.push(type);
            }
            
            if (categoryId) {
                countQuery += ` AND EXISTS (
                    SELECT 1 FROM note_category_assignments nca2 
                    WHERE nca2.note_id = n.id AND nca2.category_id = ?
                )`;
                countParams.push(categoryId);
            }
            
            const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();
            const total = countResult ? countResult.total : 0;
            
            // Parse notes data
            const notesWithParsedData = notes.results.map(note => ({
                id: note.id,
                title: note.title,
                content: note.content,
                type: note.type,
                starred: Boolean(note.starred),
                tags: note.tags ? JSON.parse(note.tags) : [],
                metadata: note.metadata ? JSON.parse(note.metadata) : {},
                categoryNames: note.category_names ? note.category_names.split(',') : [],
                createdAt: note.created_at,
                updatedAt: note.updated_at,
                preview: NotesEnhancedHandler.generatePreview(note.content)
            }));
            
            // Log activity
            await ActivityLogger.logActivity(env, {
                userId: user.id,
                action: 'notes_list',
                metadata: { search, starred, type, categoryId, limit, offset }
            });
            
            return createSuccessResponse({
                notes: notesWithParsedData,
                pagination: {
                    limit,
                    offset,
                    total,
                    hasMore: offset + limit < total
                }
            });
            
        } catch (error) {
            console.error('Notes list error:', error);
            return createErrorResponse('Failed to fetch notes', 500, 'FETCH_ERROR');
        }
    }
    
    static async search(request, env) {
        try {
            const user = request.user;
            const url = new URL(request.url);
            const query = url.searchParams.get('q') || '';
            const limit = Math.min(parseInt(url.searchParams.get('limit')) || 20, 50);
            
            if (!query.trim()) {
                return createErrorResponse('Search query is required', 400, 'MISSING_QUERY');
            }
            
            // Use full-text search if available, otherwise fallback to LIKE search
            let searchQuery, results;
            
            try {
                // Try full-text search first
                searchQuery = `
                    SELECT n.id, n.title, n.content, n.type, n.starred, n.tags, n.metadata,
                           n.created_at, n.updated_at,
                           rank
                    FROM notes_fts fts
                    JOIN notes n ON fts.rowid = n.rowid
                    WHERE n.user_id = ? AND n.deleted_at IS NULL
                      AND fts MATCH ?
                    ORDER BY rank
                    LIMIT ?
                `;
                results = await env.DB.prepare(searchQuery).bind(user.id, query, limit).all();
            } catch (ftsError) {
                // Fallback to LIKE search if FTS is not available
                searchQuery = `
                    SELECT n.id, n.title, n.content, n.type, n.starred, n.tags, n.metadata,
                           n.created_at, n.updated_at
                    FROM notes n
                    WHERE n.user_id = ? AND n.deleted_at IS NULL
                      AND (n.title LIKE ? OR n.content LIKE ?)
                    ORDER BY n.updated_at DESC
                    LIMIT ?
                `;
                results = await env.DB.prepare(searchQuery).bind(user.id, `%${query}%`, `%${query}%`, limit).all();
            }
            
            // Parse results
            const searchResults = results.results.map(result => ({
                id: result.id,
                title: result.title,
                content: result.content,
                type: result.type,
                starred: Boolean(result.starred),
                tags: result.tags ? JSON.parse(result.tags) : [],
                metadata: result.metadata ? JSON.parse(result.metadata) : {},
                createdAt: result.created_at,
                updatedAt: result.updated_at,
                preview: NotesEnhancedHandler.generatePreview(result.content),
                rank: result.rank || 0
            }));
            
            // Log activity
            await ActivityLogger.logActivity(env, {
                userId: user.id,
                action: 'notes_search',
                metadata: { query, resultCount: searchResults.length }
            });
            
            return createSuccessResponse({
                results: searchResults,
                query,
                total: searchResults.length
            });
            
        } catch (error) {
            console.error('Notes search error:', error);
            return createErrorResponse('Failed to search notes', 500, 'SEARCH_ERROR');
        }
    }
    
    static async create(request, env) {
        try {
            const user = request.user;
            const { title, content, type = 'standard', tags = [], starred = false, metadata = {} } = await request.json();
            
            // Validate input
            if (!title || title.trim() === '') {
                return createErrorResponse('Title is required', 400, 'MISSING_TITLE');
            }
            
            if (!Validator.isValidUUID(user.id)) {
                return createErrorResponse('Invalid user ID', 400, 'INVALID_USER_ID');
            }
            
            // Sanitize input
            const sanitizedTitle = Validator.sanitizeString(title, 200);
            const sanitizedContent = Validator.sanitizeHTML(content || '');
            const sanitizedTags = Array.isArray(tags) ? tags.slice(0, 10).map(tag => Validator.sanitizeString(tag, 50)) : [];
            
            const noteId = crypto.randomUUID();
            const now = new Date().toISOString();
            
            // Create note
            await env.DB.prepare(`
                INSERT INTO notes (id, user_id, title, content, type, starred, tags, metadata, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                noteId,
                user.id,
                sanitizedTitle,
                sanitizedContent,
                type,
                starred ? 1 : 0,
                JSON.stringify(sanitizedTags),
                JSON.stringify(metadata),
                now,
                now
            ).run();
            
            // Fetch the created note
            const note = await env.DB.prepare(`
                SELECT * FROM notes WHERE id = ?
            `).bind(noteId).first();
            
            // Log activity
            await ActivityLogger.logActivity(env, {
                userId: user.id,
                action: 'note_create',
                resourceType: 'note',
                resourceId: noteId,
                metadata: { type, starred, tagCount: sanitizedTags.length }
            });
            
            return createSuccessResponse({
                note: {
                    id: note.id,
                    title: note.title,
                    content: note.content,
                    type: note.type,
                    starred: Boolean(note.starred),
                    tags: JSON.parse(note.tags),
                    metadata: JSON.parse(note.metadata),
                    createdAt: note.created_at,
                    updatedAt: note.updated_at
                }
            }, 201);
            
        } catch (error) {
            console.error('Note creation error:', error);
            return createErrorResponse('Failed to create note', 500, 'CREATION_ERROR');
        }
    }
    
    static async get(request, env) {
        try {
            const user = request.user;
            const noteId = request.params.id;
            
            if (!Validator.isValidUUID(noteId)) {
                return createErrorResponse('Invalid note ID', 400, 'INVALID_NOTE_ID');
            }
            
            const note = await env.DB.prepare(`
                SELECT n.*, GROUP_CONCAT(nc.name) as category_names
                FROM notes n
                LEFT JOIN note_category_assignments nca ON n.id = nca.note_id
                LEFT JOIN note_categories nc ON nca.category_id = nc.id
                WHERE n.id = ? AND n.user_id = ? AND n.deleted_at IS NULL
                GROUP BY n.id
            `).bind(noteId, user.id).first();
            
            if (!note) {
                return createErrorResponse('Note not found', 404, 'NOTE_NOT_FOUND');
            }
            
            // Log activity
            await ActivityLogger.logActivity(env, {
                userId: user.id,
                action: 'note_view',
                resourceType: 'note',
                resourceId: noteId
            });
            
            return createSuccessResponse({
                note: {
                    id: note.id,
                    title: note.title,
                    content: note.content,
                    type: note.type,
                    starred: Boolean(note.starred),
                    tags: JSON.parse(note.tags),
                    metadata: JSON.parse(note.metadata),
                    categoryNames: note.category_names ? note.category_names.split(',') : [],
                    createdAt: note.created_at,
                    updatedAt: note.updated_at
                }
            });
            
        } catch (error) {
            console.error('Note fetch error:', error);
            return createErrorResponse('Failed to fetch note', 500, 'FETCH_ERROR');
        }
    }
    
    static async update(request, env) {
        try {
            const user = request.user;
            const noteId = request.params.id;
            const { title, content, type, tags, starred, metadata } = await request.json();
            
            if (!Validator.isValidUUID(noteId)) {
                return createErrorResponse('Invalid note ID', 400, 'INVALID_NOTE_ID');
            }
            
            // Check if note exists and belongs to user
            const existingNote = await env.DB.prepare(`
                SELECT id FROM notes WHERE id = ? AND user_id = ? AND deleted_at IS NULL
            `).bind(noteId, user.id).first();
            
            if (!existingNote) {
                return createErrorResponse('Note not found', 404, 'NOTE_NOT_FOUND');
            }
            
            // Build update query dynamically
            const updates = [];
            const params = [];
            
            if (title !== undefined) {
                updates.push('title = ?');
                params.push(Validator.sanitizeString(title, 200));
            }
            
            if (content !== undefined) {
                updates.push('content = ?');
                params.push(Validator.sanitizeHTML(content));
            }
            
            if (type !== undefined) {
                updates.push('type = ?');
                params.push(type);
            }
            
            if (tags !== undefined) {
                const sanitizedTags = Array.isArray(tags) ? tags.slice(0, 10).map(tag => Validator.sanitizeString(tag, 50)) : [];
                updates.push('tags = ?');
                params.push(JSON.stringify(sanitizedTags));
            }
            
            if (starred !== undefined) {
                updates.push('starred = ?');
                params.push(starred ? 1 : 0);
            }
            
            if (metadata !== undefined) {
                updates.push('metadata = ?');
                params.push(JSON.stringify(metadata));
            }
            
            if (updates.length === 0) {
                return createErrorResponse('No updates provided', 400, 'NO_UPDATES');
            }
            
            updates.push('updated_at = ?');
            params.push(new Date().toISOString());
            params.push(noteId);
            
            const query = `UPDATE notes SET ${updates.join(', ')} WHERE id = ?`;
            await env.DB.prepare(query).bind(...params).run();
            
            // Fetch updated note
            const updatedNote = await env.DB.prepare(`
                SELECT * FROM notes WHERE id = ?
            `).bind(noteId).first();
            
            // Log activity
            await ActivityLogger.logActivity(env, {
                userId: user.id,
                action: 'note_update',
                resourceType: 'note',
                resourceId: noteId,
                metadata: { updatedFields: updates.length - 1 } // -1 for updated_at
            });
            
            return createSuccessResponse({
                note: {
                    id: updatedNote.id,
                    title: updatedNote.title,
                    content: updatedNote.content,
                    type: updatedNote.type,
                    starred: Boolean(updatedNote.starred),
                    tags: JSON.parse(updatedNote.tags),
                    metadata: JSON.parse(updatedNote.metadata),
                    createdAt: updatedNote.created_at,
                    updatedAt: updatedNote.updated_at
                }
            });
            
        } catch (error) {
            console.error('Note update error:', error);
            return createErrorResponse('Failed to update note', 500, 'UPDATE_ERROR');
        }
    }
    
    static async delete(request, env) {
        try {
            const user = request.user;
            const noteId = request.params.id;
            
            if (!Validator.isValidUUID(noteId)) {
                return createErrorResponse('Invalid note ID', 400, 'INVALID_NOTE_ID');
            }
            
            // Check if note exists and belongs to user
            const existingNote = await env.DB.prepare(`
                SELECT id FROM notes WHERE id = ? AND user_id = ? AND deleted_at IS NULL
            `).bind(noteId, user.id).first();
            
            if (!existingNote) {
                return createErrorResponse('Note not found', 404, 'NOTE_NOT_FOUND');
            }
            
            // Soft delete the note
            await env.DB.prepare(`
                UPDATE notes SET deleted_at = ? WHERE id = ? AND user_id = ?
            `).bind(new Date().toISOString(), noteId, user.id).run();
            
            // Log activity
            await ActivityLogger.logActivity(env, {
                userId: user.id,
                action: 'note_delete',
                resourceType: 'note',
                resourceId: noteId
            });
            
            return createSuccessResponse({
                message: 'Note deleted successfully'
            });
            
        } catch (error) {
            console.error('Note deletion error:', error);
            return createErrorResponse('Failed to delete note', 500, 'DELETE_ERROR');
        }
    }
    
    static async bulkUpdate(request, env) {
        try {
            const user = request.user;
            const { noteIds, updates } = await request.json();
            
            if (!Array.isArray(noteIds) || noteIds.length === 0) {
                return createErrorResponse('Note IDs are required', 400, 'MISSING_NOTE_IDS');
            }
            
            if (!updates || Object.keys(updates).length === 0) {
                return createErrorResponse('Updates are required', 400, 'MISSING_UPDATES');
            }
            
            // Validate all note IDs
            for (const noteId of noteIds) {
                if (!Validator.isValidUUID(noteId)) {
                    return createErrorResponse('Invalid note ID', 400, 'INVALID_NOTE_ID');
                }
            }
            
            // Build update query
            const updateFields = [];
            const params = [];
            
            if (updates.starred !== undefined) {
                updateFields.push('starred = ?');
                params.push(updates.starred ? 1 : 0);
            }
            
            if (updates.tags !== undefined) {
                const sanitizedTags = Array.isArray(updates.tags) ? updates.tags.slice(0, 10).map(tag => Validator.sanitizeString(tag, 50)) : [];
                updateFields.push('tags = ?');
                params.push(JSON.stringify(sanitizedTags));
            }
            
            if (updateFields.length === 0) {
                return createErrorResponse('No valid updates provided', 400, 'NO_VALID_UPDATES');
            }
            
            updateFields.push('updated_at = ?');
            params.push(new Date().toISOString());
            
            // Add note IDs to params
            const placeholders = noteIds.map(() => '?').join(',');
            params.push(...noteIds);
            
            const query = `
                UPDATE notes 
                SET ${updateFields.join(', ')} 
                WHERE id IN (${placeholders}) AND user_id = ? AND deleted_at IS NULL
            `;
            params.push(user.id);
            
            const result = await env.DB.prepare(query).bind(...params).run();
            
            // Log activity
            await ActivityLogger.logActivity(env, {
                userId: user.id,
                action: 'notes_bulk_update',
                metadata: { 
                    noteCount: noteIds.length, 
                    updatedFields: updateFields.length - 1,
                    affectedRows: result.meta.changes 
                }
            });
            
            return createSuccessResponse({
                message: `Updated ${result.meta.changes} notes successfully`,
                affectedCount: result.meta.changes
            });
            
        } catch (error) {
            console.error('Bulk update error:', error);
            return createErrorResponse('Failed to update notes', 500, 'BULK_UPDATE_ERROR');
        }
    }
    
    static async getStats(request, env) {
        try {
            const user = request.user;
            
            // Get note statistics
            const stats = await env.DB.prepare(`
                SELECT 
                    COUNT(*) as total_notes,
                    COUNT(CASE WHEN starred = 1 THEN 1 END) as starred_notes,
                    COUNT(CASE WHEN type = 'plan' THEN 1 END) as plan_notes,
                    COUNT(CASE WHEN type = 'code' THEN 1 END) as code_notes,
                    COUNT(CASE WHEN type = 'credentials' THEN 1 END) as credential_notes,
                    COUNT(CASE WHEN type = 'standard' THEN 1 END) as standard_notes,
                    SUM(LENGTH(content)) as total_characters,
                    MAX(updated_at) as last_updated
                FROM notes 
                WHERE user_id = ? AND deleted_at IS NULL
            `).bind(user.id).first();
            
            // Get tag statistics
            const tagStats = await env.DB.prepare(`
                SELECT tags FROM notes 
                WHERE user_id = ? AND deleted_at IS NULL AND tags != '[]'
            `).bind(user.id).all();
            
            const tagCounts = {};
            tagStats.results.forEach(note => {
                try {
                    const tags = JSON.parse(note.tags);
                    tags.forEach(tag => {
                        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                    });
                } catch (e) {
                    // Skip invalid JSON
                }
            });
            
            // Sort tags by count
            const topTags = Object.entries(tagCounts)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .map(([tag, count]) => ({ tag, count }));
            
            return createSuccessResponse({
                stats: {
                    totalNotes: stats.total_notes,
                    starredNotes: stats.starred_notes,
                    planNotes: stats.plan_notes,
                    codeNotes: stats.code_notes,
                    credentialNotes: stats.credential_notes,
                    standardNotes: stats.standard_notes,
                    totalCharacters: stats.total_characters,
                    lastUpdated: stats.last_updated
                },
                topTags
            });
            
        } catch (error) {
            console.error('Stats error:', error);
            return createErrorResponse('Failed to fetch statistics', 500, 'STATS_ERROR');
        }
    }
    
    // Helper method to generate preview text
    static generatePreview(content, maxLength = 150) {
        if (!content) return '';
        
        // Remove markdown formatting
        const plainText = content
            .replace(/#{1,6}\s+/g, '') // Remove headers
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
            .replace(/\*(.*?)\*/g, '$1') // Remove italic
            .replace(/`(.*?)`/g, '$1') // Remove inline code
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
            .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // Remove images
            .replace(/```[\s\S]*?```/g, '') // Remove code blocks
            .replace(/\n+/g, ' ') // Replace newlines with spaces
            .trim();
        
        return plainText.length > maxLength 
            ? plainText.substring(0, maxLength) + '...'
            : plainText;
    }
}
