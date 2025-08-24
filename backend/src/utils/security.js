// Enhanced security utilities for Note.Lab
import { corsHeaders } from './cors';

// Password hashing with proper salt
export class PasswordHasher {
    static async hashPassword(password) {
        // Generate a random salt
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const encoder = new TextEncoder();
        
        // Combine password and salt
        const passwordWithSalt = encoder.encode(password);
        const combined = new Uint8Array(salt.length + passwordWithSalt.length);
        combined.set(salt);
        combined.set(passwordWithSalt, salt.length);
        
        // Hash the combined data
        const hash = await crypto.subtle.digest('SHA-256', combined);
        
        // Convert to hex strings
        const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
        const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
        
        // Return salt:hash format
        return `${saltHex}:${hashHex}`;
    }
    
    static async verifyPassword(password, hashedPassword) {
        try {
            const [saltHex, hashHex] = hashedPassword.split(':');
            if (!saltHex || !hashHex) return false;
            
            // Convert hex strings back to Uint8Array
            const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            const encoder = new TextEncoder();
            
            // Combine password and salt
            const passwordWithSalt = encoder.encode(password);
            const combined = new Uint8Array(salt.length + passwordWithSalt.length);
            combined.set(salt);
            combined.set(passwordWithSalt, salt.length);
            
            // Hash the combined data
            const hash = await crypto.subtle.digest('SHA-256', combined);
            const computedHashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
            
            return computedHashHex === hashHex;
        } catch (error) {
            console.error('Password verification error:', error);
            return false;
        }
    }
}

// Rate limiting utility
export class RateLimiter {
    static async checkRateLimit(env, identifier, endpoint, limit = 100, windowMinutes = 15) {
        const now = new Date();
        const windowStart = new Date(now.getTime() - (windowMinutes * 60 * 1000));
        
        // Clean up old records first
        await env.DB.prepare(`
            DELETE FROM rate_limits 
            WHERE window_start < ?
        `).bind(windowStart.toISOString()).run();
        
        // Check current count
        const current = await env.DB.prepare(`
            SELECT request_count 
            FROM rate_limits 
            WHERE identifier = ? AND endpoint = ? AND window_start >= ?
        `).bind(identifier, endpoint, windowStart.toISOString()).first();
        
        if (current && current.request_count >= limit) {
            return {
                allowed: false,
                remaining: 0,
                resetTime: new Date(now.getTime() + (windowMinutes * 60 * 1000))
            };
        }
        
        // Update or insert rate limit record
        if (current) {
            await env.DB.prepare(`
                UPDATE rate_limits 
                SET request_count = request_count + 1 
                WHERE identifier = ? AND endpoint = ? AND window_start >= ?
            `).bind(identifier, endpoint, windowStart.toISOString()).run();
        } else {
            await env.DB.prepare(`
                INSERT INTO rate_limits (id, identifier, endpoint, request_count, window_start, created_at)
                VALUES (?, ?, ?, 1, ?, ?)
            `).bind(
                crypto.randomUUID(),
                identifier,
                endpoint,
                windowStart.toISOString(),
                now.toISOString()
            ).run();
        }
        
        return {
            allowed: true,
            remaining: limit - (current ? current.request_count + 1 : 1),
            resetTime: new Date(now.getTime() + (windowMinutes * 60 * 1000))
        };
    }
}

// Input validation utilities
export class Validator {
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email) && email.length <= 254;
    }
    
    static isValidPassword(password) {
        // At least 8 characters, with at least one letter and one number
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/;
        return passwordRegex.test(password);
    }
    
    static isValidUUID(uuid) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }
    
    static sanitizeString(str, maxLength = 1000) {
        if (typeof str !== 'string') return '';
        return str.trim().substring(0, maxLength);
    }
    
    static sanitizeHTML(html) {
        // Basic HTML sanitization - remove script tags and dangerous attributes
        return html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/data:/gi, '');
    }
}

// Activity logging utility
export class ActivityLogger {
    static async logActivity(env, {
        userId = null,
        action,
        resourceType = null,
        resourceId = null,
        metadata = {},
        ipAddress = null,
        userAgent = null
    }) {
        try {
            await env.DB.prepare(`
                INSERT INTO activity_logs (
                    id, user_id, action, resource_type, resource_id, 
                    metadata, ip_address, user_agent, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                crypto.randomUUID(),
                userId,
                action,
                resourceType,
                resourceId,
                JSON.stringify(metadata),
                ipAddress,
                userAgent,
                new Date().toISOString()
            ).run();
        } catch (error) {
            console.error('Activity logging error:', error);
            // Don't throw - logging should not break the main functionality
        }
    }
}

// Session management utility
export class SessionManager {
    static async createSession(env, userId, deviceInfo = null, ipAddress = null) {
        const sessionId = crypto.randomUUID();
        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)); // 7 days
        
        // Hash the token for storage
        const tokenHash = await this.hashToken(token);
        
        await env.DB.prepare(`
            INSERT INTO user_sessions (
                id, user_id, token_hash, device_info, ip_address, 
                created_at, expires_at, last_used_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            sessionId,
            userId,
            tokenHash,
            deviceInfo ? JSON.stringify(deviceInfo) : null,
            ipAddress,
            new Date().toISOString(),
            expiresAt.toISOString(),
            new Date().toISOString()
        ).run();
        
        return {
            sessionId,
            token,
            expiresAt
        };
    }
    
    static async validateSession(env, token) {
        const tokenHash = await this.hashToken(token);
        
        const session = await env.DB.prepare(`
            SELECT * FROM user_sessions 
            WHERE token_hash = ? AND is_active = 1 AND expires_at > ?
        `).bind(tokenHash, new Date().toISOString()).first();
        
        if (!session) return null;
        
        // Update last used timestamp
        await env.DB.prepare(`
            UPDATE user_sessions 
            SET last_used_at = ? 
            WHERE id = ?
        `).bind(new Date().toISOString(), session.id).run();
        
        return session;
    }
    
    static async invalidateSession(env, sessionId) {
        await env.DB.prepare(`
            UPDATE user_sessions 
            SET is_active = 0 
            WHERE id = ?
        `).bind(sessionId).run();
    }
    
    static async invalidateAllUserSessions(env, userId) {
        await env.DB.prepare(`
            UPDATE user_sessions 
            SET is_active = 0 
            WHERE user_id = ?
        `).bind(userId).run();
    }
    
    static async hashToken(token) {
        const encoder = new TextEncoder();
        const data = encoder.encode(token);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
}

// CSRF protection utility
export class CSRFProtection {
    static generateToken() {
        return crypto.randomUUID();
    }
    
    static validateToken(token, storedToken) {
        return token === storedToken;
    }
}

// Response utilities
export function createErrorResponse(message, status = 400, code = null) {
    return new Response(JSON.stringify({
        error: true,
        message,
        code,
        timestamp: new Date().toISOString()
    }), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
        }
    });
}

export function createSuccessResponse(data, status = 200) {
    return new Response(JSON.stringify({
        success: true,
        data,
        timestamp: new Date().toISOString()
    }), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
        }
    });
}

export function createRateLimitResponse(rateLimit) {
    return new Response(JSON.stringify({
        error: true,
        message: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        resetTime: rateLimit.resetTime.toISOString(),
        timestamp: new Date().toISOString()
    }), {
        status: 429,
        headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.resetTime.toISOString(),
            ...corsHeaders
        }
    });
}
