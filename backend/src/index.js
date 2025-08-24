// Cloudflare Workers Entry Point
import { Router } from 'itty-router';
import { corsHeaders, handleCors } from './utils/cors';
import { AuthHandler } from './handlers/auth';
import { NotesHandler } from './handlers/notes';
import { NotesEnhancedHandler } from './handlers/notes-enhanced';
import { CategoriesHandler } from './handlers/categories';
import { verifyToken } from './middleware/auth';
import { RateLimiter, createRateLimitResponse } from './utils/security';

// Create router
const router = Router();

// CORS preflight
router.options('*', handleCors);

// Public routes
router.post('/api/auth/register', AuthHandler.register);
router.post('/api/auth/login', AuthHandler.login);
router.post('/api/auth/refresh', AuthHandler.refresh);
router.post('/api/auth/forgot-password', AuthHandler.forgotPassword);
router.post('/api/auth/reset-password', AuthHandler.resetPassword);

// Rate limiting middleware
async function rateLimitMiddleware(request, env) {
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const endpoint = new URL(request.url).pathname;
    
    const rateLimit = await RateLimiter.checkRateLimit(env, clientIP, endpoint, 100, 15);
    
    if (!rateLimit.allowed) {
        return createRateLimitResponse(rateLimit);
    }
    
    // Add rate limit headers to response
    request.rateLimit = rateLimit;
    return null;
}

// Protected routes (require authentication)
router.get('/api/notes', rateLimitMiddleware, verifyToken, NotesEnhancedHandler.list);
router.post('/api/notes', rateLimitMiddleware, verifyToken, NotesEnhancedHandler.create);

// Enhanced notes routes (must come before :id routes)
router.get('/api/notes/search', rateLimitMiddleware, verifyToken, NotesEnhancedHandler.search);
router.post('/api/notes/bulk-update', rateLimitMiddleware, verifyToken, NotesEnhancedHandler.bulkUpdate);
router.get('/api/notes/stats', rateLimitMiddleware, verifyToken, NotesEnhancedHandler.getStats);

// Individual note routes
router.get('/api/notes/:id', rateLimitMiddleware, verifyToken, NotesEnhancedHandler.get);
router.put('/api/notes/:id', rateLimitMiddleware, verifyToken, NotesEnhancedHandler.update);
router.delete('/api/notes/:id', rateLimitMiddleware, verifyToken, NotesEnhancedHandler.delete);

// Categories routes
router.get('/api/categories', rateLimitMiddleware, verifyToken, CategoriesHandler.list);
router.post('/api/categories', rateLimitMiddleware, verifyToken, CategoriesHandler.create);
router.put('/api/categories/:id', rateLimitMiddleware, verifyToken, CategoriesHandler.update);
router.delete('/api/categories/:id', rateLimitMiddleware, verifyToken, CategoriesHandler.delete);
router.post('/api/categories/assign', rateLimitMiddleware, verifyToken, CategoriesHandler.assignToNote);
router.get('/api/notes/:noteId/categories', rateLimitMiddleware, verifyToken, CategoriesHandler.getNoteCategories);

// User profile routes
router.get('/api/user/profile', verifyToken, AuthHandler.profile);
router.put('/api/user/profile', verifyToken, AuthHandler.updateProfile);

// Health check
router.get('/api/health', () => {
    return new Response(JSON.stringify({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    }), {
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
        }
    });
});

// Serve static files
router.get('*', async (request, env) => {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Handle root path
    if (path === '/' || path === '/index.html') {
        return env.ASSETS.fetch(request);
    }
    
    // Handle other static files
    if (path.endsWith('.html') || path.endsWith('.css') || path.endsWith('.js') || 
        path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg') || 
        path.endsWith('.gif') || path.endsWith('.svg') || path.endsWith('.ico')) {
        return env.ASSETS.fetch(request);
    }
    
    // API routes should return 404 if not matched
    if (path.startsWith('/api/')) {
        return new Response('API endpoint not found', { 
            status: 404,
            headers: corsHeaders
        });
    }
    
    // For all other routes, try to serve from assets
    return env.ASSETS.fetch(request);
});

// Worker event handler
export default {
    async fetch(request, env, ctx) {
        try {
            return await router.handle(request, env, ctx);
        } catch (error) {
            console.error('Worker error:', error);
            
            return new Response(JSON.stringify({
                error: 'Internal Server Error',
                message: env.ENVIRONMENT === 'development' ? error.message : 'Something went wrong'
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }
    }
};
