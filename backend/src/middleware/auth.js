// Authentication middleware for Cloudflare Workers
import jwt from '@tsndr/cloudflare-worker-jwt';
import { corsHeaders } from '../utils/cors';
import { PasswordHasher } from '../utils/security';

export async function verifyToken(request, env, ctx) {
    try {
        const authHeader = request.headers.get('Authorization');
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return unauthorizedResponse('Missing or invalid authorization header');
        }
        
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        
        // Verify JWT token
        const secret = env.JWT_SECRET || 'your-secret-key-change-in-production';
        const isValid = await jwt.verify(token, secret);
        
        if (!isValid) {
            return unauthorizedResponse('Invalid token');
        }
        
        // Decode token to get user info
        const { payload } = jwt.decode(token);
        
        // Check if token is expired
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return unauthorizedResponse('Token expired');
        }
        
        // Add user info to request for use in handlers
        request.user = {
            id: payload.sub,
            email: payload.email,
            name: payload.name
        };
        
        // Continue to next handler
        return null;
        
    } catch (error) {
        console.error('Auth middleware error:', error);
        return unauthorizedResponse('Authentication failed');
    }
}

function unauthorizedResponse(message) {
    return new Response(JSON.stringify({
        error: 'Unauthorized',
        message
    }), {
        status: 401,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
        }
    });
}

export async function generateToken(user, env) {
    const secret = env.JWT_SECRET || 'your-secret-key-change-in-production';
    const payload = {
        sub: user.id,
        email: user.email,
        name: user.name,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
    };
    
    return await jwt.sign(payload, secret);
}

// Use the correct password hashing from security.js
export const hashPassword = PasswordHasher.hashPassword;
export const verifyPassword = PasswordHasher.verifyPassword;
