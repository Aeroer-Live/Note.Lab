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
        const isValid = await jwt.verify(token, getJwtSecret(env));
        
        if (!isValid) {
            return unauthorizedResponse('Invalid token');
        }
        
        // Decode token to get user info
        const { payload } = jwt.decode(token);
        
        // Check if token is expired
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return unauthorizedResponse('Token expired');
        }
        
        // Tokens issued before the user's last password change are no longer valid
        const passwordChangedAt = await env.SESSIONS.get(passwordChangedKey(payload.sub));
        if (passwordChangedAt && (!payload.iat || payload.iat < parseInt(passwordChangedAt, 10))) {
            return unauthorizedResponse('Session expired. Please log in again.');
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

// Fail closed: without a configured secret anyone could forge tokens
function getJwtSecret(env) {
    if (!env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured');
    }
    return env.JWT_SECRET;
}

export function passwordChangedKey(userId) {
    return `pwd_changed_${userId}`;
}

// Records a password change so verifyToken rejects every token issued before it
export async function revokeTokensIssuedBefore(env, userId, timestampSeconds) {
    await env.SESSIONS.put(passwordChangedKey(userId), String(timestampSeconds), {
        expirationTtl: TOKEN_LIFETIME_SECONDS + 24 * 60 * 60 // older tokens have expired by then anyway
    });
}

const TOKEN_LIFETIME_SECONDS = 7 * 24 * 60 * 60;

export async function generateToken(user, env) {
    const secret = getJwtSecret(env);
    const payload = {
        sub: user.id,
        email: user.email,
        name: user.name,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS // 7 days
    };
    
    return await jwt.sign(payload, secret);
}

// Use the correct password hashing from security.js
export const hashPassword = PasswordHasher.hashPassword;
export const verifyPassword = PasswordHasher.verifyPassword;
