// Cloudflare Workers Entry Point
import { Router } from 'itty-router';
import { corsHeaders, handleCors } from './utils/cors';
import { AuthHandler } from './handlers/auth';
import { NotesHandler } from './handlers/notes';
import { verifyToken } from './middleware/auth';

// Create router
const router = Router();

// CORS preflight
router.options('*', handleCors);

// Public routes
router.post('/api/auth/register', AuthHandler.register);
router.post('/api/auth/login', AuthHandler.login);
router.post('/api/auth/refresh', AuthHandler.refresh);

// Protected routes (require authentication)
router.get('/api/notes', verifyToken, NotesHandler.list);
router.post('/api/notes', verifyToken, NotesHandler.create);
router.get('/api/notes/:id', verifyToken, NotesHandler.get);
router.put('/api/notes/:id', verifyToken, NotesHandler.update);
router.delete('/api/notes/:id', verifyToken, NotesHandler.delete);

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

// Serve static files for development
router.get('*', async (request, env) => {
    // In production, this would be handled by Cloudflare Pages
    // For development, serve a simple response
    const url = new URL(request.url);
    
    if (url.pathname === '/' || url.pathname === '/index.html') {
        return new Response('Note.Lab - Please serve frontend files separately for development', {
            headers: {
                'Content-Type': 'text/html',
                ...corsHeaders
            }
        });
    }
    
    return new Response('Not Found', { 
        status: 404,
        headers: corsHeaders
    });
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
