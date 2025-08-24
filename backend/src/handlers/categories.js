// Categories handler for Cloudflare Workers
import { Validator, ActivityLogger, createErrorResponse, createSuccessResponse } from '../utils/security';

export class CategoriesHandler {
    static async list(request, env) {
        try {
            const user = request.user;
            
            const categories = await env.DB.prepare(`
                SELECT id, name, color, icon, sort_order, created_at, updated_at,
                       (SELECT COUNT(*) FROM note_category_assignments nca WHERE nca.category_id = nc.id) as note_count
                FROM note_categories nc
                WHERE user_id = ?
                ORDER BY sort_order ASC, name ASC
            `).bind(user.id).all();
            
            // Log activity
            await ActivityLogger.logActivity(env, {
                userId: user.id,
                action: 'categories_list'
            });
            
            return createSuccessResponse({
                categories: categories.results.map(cat => ({
                    id: cat.id,
                    name: cat.name,
                    color: cat.color,
                    icon: cat.icon,
                    sortOrder: cat.sort_order,
                    noteCount: cat.note_count,
                    createdAt: cat.created_at,
                    updatedAt: cat.updated_at
                }))
            });
            
        } catch (error) {
            console.error('Categories list error:', error);
            return createErrorResponse('Failed to fetch categories', 500, 'FETCH_ERROR');
        }
    }
    
    static async create(request, env) {
        try {
            const user = request.user;
            const { name, color = '#238636', icon = '📄', sortOrder = 0 } = await request.json();
            
            // Validate input
            if (!name || name.trim() === '') {
                return createErrorResponse('Category name is required', 400, 'MISSING_NAME');
            }
            
            // Sanitize input
            const sanitizedName = Validator.sanitizeString(name, 100);
            const sanitizedColor = /^#[0-9A-F]{6}$/i.test(color) ? color : '#238636';
            const sanitizedIcon = Validator.sanitizeString(icon, 10);
            
            // Check if category name already exists for this user
            const existingCategory = await env.DB.prepare(`
                SELECT id FROM note_categories WHERE user_id = ? AND name = ?
            `).bind(user.id, sanitizedName).first();
            
            if (existingCategory) {
                return createErrorResponse('Category with this name already exists', 409, 'DUPLICATE_NAME');
            }
            
            const categoryId = crypto.randomUUID();
            const now = new Date().toISOString();
            
            // Create category
            await env.DB.prepare(`
                INSERT INTO note_categories (id, user_id, name, color, icon, sort_order, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                categoryId,
                user.id,
                sanitizedName,
                sanitizedColor,
                sanitizedIcon,
                sortOrder,
                now,
                now
            ).run();
            
            // Fetch the created category
            const category = await env.DB.prepare(`
                SELECT * FROM note_categories WHERE id = ?
            `).bind(categoryId).first();
            
            // Log activity
            await ActivityLogger.logActivity(env, {
                userId: user.id,
                action: 'category_create',
                resourceType: 'category',
                resourceId: categoryId,
                metadata: { name: sanitizedName, color: sanitizedColor }
            });
            
            return createSuccessResponse({
                category: {
                    id: category.id,
                    name: category.name,
                    color: category.color,
                    icon: category.icon,
                    sortOrder: category.sort_order,
                    noteCount: 0,
                    createdAt: category.created_at,
                    updatedAt: category.updated_at
                }
            }, 201);
            
        } catch (error) {
            console.error('Category creation error:', error);
            return createErrorResponse('Failed to create category', 500, 'CREATION_ERROR');
        }
    }
    
    static async update(request, env) {
        try {
            const user = request.user;
            const categoryId = request.params.id;
            const { name, color, icon, sortOrder } = await request.json();
            
            if (!Validator.isValidUUID(categoryId)) {
                return createErrorResponse('Invalid category ID', 400, 'INVALID_CATEGORY_ID');
            }
            
            // Check if category exists and belongs to user
            const existingCategory = await env.DB.prepare(`
                SELECT id FROM note_categories WHERE id = ? AND user_id = ?
            `).bind(categoryId, user.id).first();
            
            if (!existingCategory) {
                return createErrorResponse('Category not found', 404, 'CATEGORY_NOT_FOUND');
            }
            
            // Build update query dynamically
            const updates = [];
            const params = [];
            
            if (name !== undefined) {
                const sanitizedName = Validator.sanitizeString(name, 100);
                
                // Check if new name conflicts with existing category
                const nameConflict = await env.DB.prepare(`
                    SELECT id FROM note_categories WHERE user_id = ? AND name = ? AND id != ?
                `).bind(user.id, sanitizedName, categoryId).first();
                
                if (nameConflict) {
                    return createErrorResponse('Category with this name already exists', 409, 'DUPLICATE_NAME');
                }
                
                updates.push('name = ?');
                params.push(sanitizedName);
            }
            
            if (color !== undefined) {
                const sanitizedColor = /^#[0-9A-F]{6}$/i.test(color) ? color : '#238636';
                updates.push('color = ?');
                params.push(sanitizedColor);
            }
            
            if (icon !== undefined) {
                const sanitizedIcon = Validator.sanitizeString(icon, 10);
                updates.push('icon = ?');
                params.push(sanitizedIcon);
            }
            
            if (sortOrder !== undefined) {
                updates.push('sort_order = ?');
                params.push(parseInt(sortOrder) || 0);
            }
            
            if (updates.length === 0) {
                return createErrorResponse('No updates provided', 400, 'NO_UPDATES');
            }
            
            updates.push('updated_at = ?');
            params.push(new Date().toISOString());
            params.push(categoryId);
            
            const query = `UPDATE note_categories SET ${updates.join(', ')} WHERE id = ?`;
            await env.DB.prepare(query).bind(...params).run();
            
            // Fetch updated category
            const updatedCategory = await env.DB.prepare(`
                SELECT nc.*, 
                       (SELECT COUNT(*) FROM note_category_assignments nca WHERE nca.category_id = nc.id) as note_count
                FROM note_categories nc WHERE id = ?
            `).bind(categoryId).first();
            
            // Log activity
            await ActivityLogger.logActivity(env, {
                userId: user.id,
                action: 'category_update',
                resourceType: 'category',
                resourceId: categoryId,
                metadata: { updatedFields: updates.length - 1 }
            });
            
            return createSuccessResponse({
                category: {
                    id: updatedCategory.id,
                    name: updatedCategory.name,
                    color: updatedCategory.color,
                    icon: updatedCategory.icon,
                    sortOrder: updatedCategory.sort_order,
                    noteCount: updatedCategory.note_count,
                    createdAt: updatedCategory.created_at,
                    updatedAt: updatedCategory.updated_at
                }
            });
            
        } catch (error) {
            console.error('Category update error:', error);
            return createErrorResponse('Failed to update category', 500, 'UPDATE_ERROR');
        }
    }
    
    static async delete(request, env) {
        try {
            const user = request.user;
            const categoryId = request.params.id;
            
            if (!Validator.isValidUUID(categoryId)) {
                return createErrorResponse('Invalid category ID', 400, 'INVALID_CATEGORY_ID');
            }
            
            // Check if category exists and belongs to user
            const existingCategory = await env.DB.prepare(`
                SELECT id FROM note_categories WHERE id = ? AND user_id = ?
            `).bind(categoryId, user.id).first();
            
            if (!existingCategory) {
                return createErrorResponse('Category not found', 404, 'CATEGORY_NOT_FOUND');
            }
            
            // Check if category has assigned notes
            const assignedNotes = await env.DB.prepare(`
                SELECT COUNT(*) as count FROM note_category_assignments WHERE category_id = ?
            `).bind(categoryId).first();
            
            if (assignedNotes.count > 0) {
                return createErrorResponse('Cannot delete category with assigned notes', 400, 'CATEGORY_HAS_NOTES');
            }
            
            // Delete category
            await env.DB.prepare(`
                DELETE FROM note_categories WHERE id = ? AND user_id = ?
            `).bind(categoryId, user.id).run();
            
            // Log activity
            await ActivityLogger.logActivity(env, {
                userId: user.id,
                action: 'category_delete',
                resourceType: 'category',
                resourceId: categoryId
            });
            
            return createSuccessResponse({
                message: 'Category deleted successfully'
            });
            
        } catch (error) {
            console.error('Category deletion error:', error);
            return createErrorResponse('Failed to delete category', 500, 'DELETE_ERROR');
        }
    }
    
    static async assignToNote(request, env) {
        try {
            const user = request.user;
            const { noteId, categoryIds } = await request.json();
            
            if (!Validator.isValidUUID(noteId)) {
                return createErrorResponse('Invalid note ID', 400, 'INVALID_NOTE_ID');
            }
            
            if (!Array.isArray(categoryIds)) {
                return createErrorResponse('Category IDs must be an array', 400, 'INVALID_CATEGORY_IDS');
            }
            
            // Validate all category IDs
            for (const categoryId of categoryIds) {
                if (!Validator.isValidUUID(categoryId)) {
                    return createErrorResponse('Invalid category ID', 400, 'INVALID_CATEGORY_ID');
                }
            }
            
            // Check if note exists and belongs to user
            const note = await env.DB.prepare(`
                SELECT id FROM notes WHERE id = ? AND user_id = ? AND deleted_at IS NULL
            `).bind(noteId, user.id).first();
            
            if (!note) {
                return createErrorResponse('Note not found', 404, 'NOTE_NOT_FOUND');
            }
            
            // Check if all categories exist and belong to user
            if (categoryIds.length > 0) {
                const placeholders = categoryIds.map(() => '?').join(',');
                const categories = await env.DB.prepare(`
                    SELECT id FROM note_categories WHERE id IN (${placeholders}) AND user_id = ?
                `).bind(...categoryIds, user.id).all();
                
                if (categories.results.length !== categoryIds.length) {
                    return createErrorResponse('One or more categories not found', 404, 'CATEGORY_NOT_FOUND');
                }
            }
            
            // Remove existing assignments
            await env.DB.prepare(`
                DELETE FROM note_category_assignments WHERE note_id = ?
            `).bind(noteId).run();
            
            // Add new assignments
            if (categoryIds.length > 0) {
                const assignmentValues = categoryIds.map(() => '(?, ?)').join(',');
                const assignmentParams = [];
                categoryIds.forEach(categoryId => {
                    assignmentParams.push(noteId, categoryId);
                });
                
                await env.DB.prepare(`
                    INSERT INTO note_category_assignments (note_id, category_id) VALUES ${assignmentValues}
                `).bind(...assignmentParams).run();
            }
            
            // Log activity
            await ActivityLogger.logActivity(env, {
                userId: user.id,
                action: 'note_category_assign',
                resourceType: 'note',
                resourceId: noteId,
                metadata: { categoryCount: categoryIds.length }
            });
            
            return createSuccessResponse({
                message: 'Categories assigned successfully'
            });
            
        } catch (error) {
            console.error('Category assignment error:', error);
            return createErrorResponse('Failed to assign categories', 500, 'ASSIGNMENT_ERROR');
        }
    }
    
    static async getNoteCategories(request, env) {
        try {
            const user = request.user;
            const noteId = request.params.noteId;
            
            if (!Validator.isValidUUID(noteId)) {
                return createErrorResponse('Invalid note ID', 400, 'INVALID_NOTE_ID');
            }
            
            // Check if note exists and belongs to user
            const note = await env.DB.prepare(`
                SELECT id FROM notes WHERE id = ? AND user_id = ? AND deleted_at IS NULL
            `).bind(noteId, user.id).first();
            
            if (!note) {
                return createErrorResponse('Note not found', 404, 'NOTE_NOT_FOUND');
            }
            
            // Get categories assigned to the note
            const categories = await env.DB.prepare(`
                SELECT nc.id, nc.name, nc.color, nc.icon, nc.sort_order
                FROM note_categories nc
                JOIN note_category_assignments nca ON nc.id = nca.category_id
                WHERE nca.note_id = ? AND nc.user_id = ?
                ORDER BY nc.sort_order ASC, nc.name ASC
            `).bind(noteId, user.id).all();
            
            return createSuccessResponse({
                categories: categories.results.map(cat => ({
                    id: cat.id,
                    name: cat.name,
                    color: cat.color,
                    icon: cat.icon,
                    sortOrder: cat.sort_order
                }))
            });
            
        } catch (error) {
            console.error('Get note categories error:', error);
            return createErrorResponse('Failed to fetch note categories', 500, 'FETCH_ERROR');
        }
    }
}
