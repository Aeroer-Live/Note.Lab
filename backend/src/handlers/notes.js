// Notes CRUD handlers for Cloudflare Workers
import { corsHeaders } from '../utils/cors';

export class NotesHandler {
    static async list(request, env) {
        try {
            const user = request.user;
            const url = new URL(request.url);
            
            // Query parameters
            const limit = parseInt(url.searchParams.get('limit')) || 50;
            const offset = parseInt(url.searchParams.get('offset')) || 0;
            const search = url.searchParams.get('search') || '';
            const starred = url.searchParams.get('starred') === 'true';
            const tags = url.searchParams.get('tags') || '';
            
            let query = `
                SELECT id, title, content, starred, tags, created_at, updated_at
                FROM notes 
                WHERE user_id = ?
            `;
            let params = [user.id];
            
            // Add search filter
            if (search) {
                query += ` AND (title LIKE ? OR content LIKE ?)`;
                params.push(`%${search}%`, `%${search}%`);
            }
            
            // Add starred filter
            if (starred) {
                query += ` AND starred = 1`;
            }
            
            // Add tags filter
            if (tags) {
                const tagList = tags.split(',').map(tag => tag.trim()).filter(Boolean);
                if (tagList.length > 0) {
                    const tagConditions = tagList.map(() => 'tags LIKE ?').join(' OR ');
                    query += ` AND (${tagConditions})`;
                    tagList.forEach(tag => params.push(`%${tag}%`));
                }
            }
            
            // Add ordering and pagination
            query += ` ORDER BY updated_at DESC LIMIT ? OFFSET ?`;
            params.push(limit, offset);
            
            const notes = await env.DB.prepare(query).bind(...params).all();
            
            // Parse tags for each note
            const notesWithParsedTags = notes.results.map(note => ({
                ...note,
                tags: note.tags ? JSON.parse(note.tags) : [],
                starred: Boolean(note.starred)
            }));
            
            return new Response(JSON.stringify({
                notes: notesWithParsedTags,
                pagination: {
                    limit,
                    offset,
                    total: notesWithParsedTags.length
                }
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
            
        } catch (error) {
            console.error('Notes list error:', error);
            
            return new Response(JSON.stringify({
                error: 'Failed to fetch notes'
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }
    }
    
    static async create(request, env) {
        try {
            const user = request.user;
            const { title, content, tags = [], starred = false } = await request.json();
            
            // Validate input
            if (!title || title.trim() === '') {
                return new Response(JSON.stringify({
                    error: 'Title is required'
                }), {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }
            
            const noteId = crypto.randomUUID();
            const now = new Date().toISOString();
            
            // Create note
            await env.DB.prepare(`
                INSERT INTO notes (id, user_id, title, content, starred, tags, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                noteId,
                user.id,
                title.trim(),
                content || '',
                starred ? 1 : 0,
                JSON.stringify(tags),
                now,
                now
            ).run();
            
            // Fetch the created note
            const note = await env.DB.prepare(
                'SELECT * FROM notes WHERE id = ?'
            ).bind(noteId).first();
            
            return new Response(JSON.stringify({
                note: {
                    ...note,
                    tags: JSON.parse(note.tags),
                    starred: Boolean(note.starred)
                }
            }), {
                status: 201,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
            
        } catch (error) {
            console.error('Note creation error:', error);
            
            return new Response(JSON.stringify({
                error: 'Failed to create note'
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }
    }
    
    static async get(request, env) {
        try {
            const user = request.user;
            const noteId = request.params.id;
            
            const note = await env.DB.prepare(
                'SELECT * FROM notes WHERE id = ? AND user_id = ?'
            ).bind(noteId, user.id).first();
            
            if (!note) {
                return new Response(JSON.stringify({
                    error: 'Note not found'
                }), {
                    status: 404,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }
            
            return new Response(JSON.stringify({
                note: {
                    ...note,
                    tags: JSON.parse(note.tags),
                    starred: Boolean(note.starred)
                }
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
            
        } catch (error) {
            console.error('Note fetch error:', error);
            
            return new Response(JSON.stringify({
                error: 'Failed to fetch note'
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }
    }
    
    static async update(request, env) {
        try {
            const user = request.user;
            const noteId = request.params.id;
            const { title, content, tags, starred } = await request.json();
            
            // Check if note exists and belongs to user
            const existingNote = await env.DB.prepare(
                'SELECT id FROM notes WHERE id = ? AND user_id = ?'
            ).bind(noteId, user.id).first();
            
            if (!existingNote) {
                return new Response(JSON.stringify({
                    error: 'Note not found'
                }), {
                    status: 404,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }
            
            // Build update query dynamically
            const updates = [];
            const params = [];
            
            if (title !== undefined) {
                updates.push('title = ?');
                params.push(title.trim());
            }
            
            if (content !== undefined) {
                updates.push('content = ?');
                params.push(content);
            }
            
            if (tags !== undefined) {
                updates.push('tags = ?');
                params.push(JSON.stringify(tags));
            }
            
            if (starred !== undefined) {
                updates.push('starred = ?');
                params.push(starred ? 1 : 0);
            }
            
            if (updates.length === 0) {
                return new Response(JSON.stringify({
                    error: 'No updates provided'
                }), {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }
            
            updates.push('updated_at = ?');
            params.push(new Date().toISOString());
            params.push(noteId);
            
            const query = `UPDATE notes SET ${updates.join(', ')} WHERE id = ?`;
            await env.DB.prepare(query).bind(...params).run();
            
            // Fetch updated note
            const updatedNote = await env.DB.prepare(
                'SELECT * FROM notes WHERE id = ?'
            ).bind(noteId).first();
            
            return new Response(JSON.stringify({
                note: {
                    ...updatedNote,
                    tags: JSON.parse(updatedNote.tags),
                    starred: Boolean(updatedNote.starred)
                }
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
            
        } catch (error) {
            console.error('Note update error:', error);
            
            return new Response(JSON.stringify({
                error: 'Failed to update note'
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }
    }
    
    static async delete(request, env) {
        try {
            const user = request.user;
            const noteId = request.params.id;
            
            // Check if note exists and belongs to user
            const existingNote = await env.DB.prepare(
                'SELECT id FROM notes WHERE id = ? AND user_id = ?'
            ).bind(noteId, user.id).first();
            
            if (!existingNote) {
                return new Response(JSON.stringify({
                    error: 'Note not found'
                }), {
                    status: 404,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }
            
            // Delete note
            await env.DB.prepare(
                'DELETE FROM notes WHERE id = ? AND user_id = ?'
            ).bind(noteId, user.id).run();
            
            return new Response(JSON.stringify({
                success: true,
                message: 'Note deleted successfully'
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
            
        } catch (error) {
            console.error('Note deletion error:', error);
            
            return new Response(JSON.stringify({
                error: 'Failed to delete note'
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }
    }
}
