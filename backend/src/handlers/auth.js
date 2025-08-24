// Authentication handlers for Cloudflare Workers
import { corsHeaders } from '../utils/cors';
import { generateToken } from '../middleware/auth';
import { EmailService } from '../utils/email-service';
import { EmailTemplates } from '../utils/email-templates';
import { PasswordHasher, SessionManager, Validator, ActivityLogger, createErrorResponse, createSuccessResponse } from '../utils/security';

export class AuthHandler {
    static async register(request, env) {
        try {
            const { email, password, name } = await request.json();
            
            // Validate input
            if (!email || !password) {
                return new Response(JSON.stringify({
                    error: 'Missing required fields',
                    message: 'Email and password are required'
                }), {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }
            
            if (!Validator.isValidPassword(password)) {
                return createErrorResponse(
                    'Password must be at least 8 characters long and contain at least one letter and one number',
                    400,
                    'INVALID_PASSWORD'
                );
            }
            
            // Check if user already exists
            const existingUser = await env.DB.prepare(
                'SELECT id FROM users WHERE email = ?'
            ).bind(email).first();
            
            if (existingUser) {
                return new Response(JSON.stringify({
                    error: 'User already exists',
                    message: 'An account with this email already exists'
                }), {
                    status: 409,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }
            
            // Hash password
            const hashedPassword = await PasswordHasher.hashPassword(password);
            
            // Create user
            const userId = crypto.randomUUID();
            const now = new Date().toISOString();
            
            await env.DB.prepare(`
                INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `).bind(
                userId,
                email,
                hashedPassword,
                name || email.split('@')[0],
                now,
                now
            ).run();
            
            // Create user object
            const user = {
                id: userId,
                email,
                name: name || email.split('@')[0]
            };
            
            // Create session
            const session = await SessionManager.createSession(env, userId);
            
            // Generate JWT token
            const token = await generateToken(user, env);
            
            // Log activity
            await ActivityLogger.logActivity(env, {
                userId: user.id,
                action: 'user_register',
                metadata: { email }
            });
            
            return createSuccessResponse({
                user,
                token,
                sessionId: session.sessionId,
                expiresAt: session.expiresAt
            });
            
        } catch (error) {
            console.error('Registration error:', error);
            
            return new Response(JSON.stringify({
                error: 'Registration failed',
                message: 'An error occurred during registration'
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }
    }
    
    static async login(request, env) {
        try {
            const { email, password } = await request.json();
            
            // Validate input
            if (!email || !password) {
                return new Response(JSON.stringify({
                    error: 'Missing credentials',
                    message: 'Email and password are required'
                }), {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }
            
            // Find user
            const user = await env.DB.prepare(
                'SELECT * FROM users WHERE email = ?'
            ).bind(email).first();
            
            if (!user) {
                return new Response(JSON.stringify({
                    error: 'Invalid credentials',
                    message: 'Email or password is incorrect'
                }), {
                    status: 401,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }
            
            // Verify password
            const isValidPassword = await PasswordHasher.verifyPassword(password, user.password_hash);
            
            if (!isValidPassword) {
                return createErrorResponse('Email or password is incorrect', 401, 'INVALID_CREDENTIALS');
            }
            
            // Update last login
            await env.DB.prepare(
                'UPDATE users SET last_login_at = ? WHERE id = ?'
            ).bind(new Date().toISOString(), user.id).run();
            
            // Create user response object
            const userResponse = {
                id: user.id,
                email: user.email,
                name: user.name
            };
            
            // Create session
            const session = await SessionManager.createSession(env, user.id);
            
            // Generate JWT token
            const token = await generateToken(userResponse, env);
            
            // Log activity
            await ActivityLogger.logActivity(env, {
                userId: user.id,
                action: 'user_login',
                metadata: { email: user.email }
            });
            
            return createSuccessResponse({
                user: userResponse,
                token,
                sessionId: session.sessionId,
                expiresAt: session.expiresAt
            });
            
        } catch (error) {
            console.error('Login error:', error);
            
            return new Response(JSON.stringify({
                error: 'Login failed',
                message: 'An error occurred during login'
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }
    }
    
    static async refresh(request, env) {
        try {
            const { refresh_token } = await request.json();
            
            if (!refresh_token) {
                return new Response(JSON.stringify({
                    error: 'Missing refresh token'
                }), {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }
            
            // For now, return error as refresh tokens aren't implemented
            return new Response(JSON.stringify({
                error: 'Refresh tokens not implemented yet'
            }), {
                status: 501,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
            
        } catch (error) {
            console.error('Token refresh error:', error);
            
            return new Response(JSON.stringify({
                error: 'Token refresh failed'
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }
    }
    
    static async profile(request, env) {
        try {
            const user = request.user;
            
            // Get full user profile
            const profile = await env.DB.prepare(
                'SELECT id, email, name, created_at, last_login_at FROM users WHERE id = ?'
            ).bind(user.id).first();
            
            if (!profile) {
                return new Response(JSON.stringify({
                    error: 'User not found'
                }), {
                    status: 404,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }
            
            return new Response(JSON.stringify({
                user: profile
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
            
        } catch (error) {
            console.error('Profile fetch error:', error);
            
            return new Response(JSON.stringify({
                error: 'Failed to fetch profile'
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }
    }
    
    static async updateProfile(request, env) {
        try {
            const user = request.user;
            const { name } = await request.json();
            
            if (!name) {
                return new Response(JSON.stringify({
                    error: 'Name is required'
                }), {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }
            
            // Update user profile
            await env.DB.prepare(
                'UPDATE users SET name = ?, updated_at = ? WHERE id = ?'
            ).bind(name, new Date().toISOString(), user.id).run();
            
            return new Response(JSON.stringify({
                success: true,
                message: 'Profile updated successfully'
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
            
        } catch (error) {
            console.error('Profile update error:', error);
            
            return new Response(JSON.stringify({
                error: 'Failed to update profile'
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }
    }
    
    static async forgotPassword(request, env) {
        try {
            const { email } = await request.json();
            
            if (!email) {
                return new Response(JSON.stringify({
                    error: 'Email is required'
                }), {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }
            
            // Check if user exists
            const user = await env.DB.prepare(
                'SELECT id, email, name FROM users WHERE email = ?'
            ).bind(email).first();
            
            if (!user) {
                // Don't reveal if user exists or not for security
                return new Response(JSON.stringify({
                    success: true,
                    message: 'If an account with this email exists, a reset link has been sent.'
                }), {
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }
            
            // Generate reset token
            const resetToken = crypto.randomUUID();
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
            
            // Store reset token in KV
            await env.SESSIONS.put(`reset_${resetToken}`, JSON.stringify({
                userId: user.id,
                email: user.email,
                expiresAt: expiresAt.toISOString()
            }), {
                expirationTtl: 3600 // 1 hour
            });
            
            // Generate reset URL
            const resetUrl = `${request.url.split('/api')[0]}/forgot-password.html?token=${resetToken}&email=${encodeURIComponent(email)}`;
            
            // Send password reset email
            try {
                await EmailService.sendPasswordResetEmail(email, user.name, resetUrl);
            } catch (emailError) {
                console.error('Email sending failed:', emailError);
                // Continue with the response even if email fails
                // In production, you might want to handle this differently
            }
            
            return new Response(JSON.stringify({
                success: true,
                message: 'If an account with this email exists, a reset link has been sent.'
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
            
        } catch (error) {
            console.error('Forgot password error:', error);
            
            return new Response(JSON.stringify({
                error: 'Failed to process password reset request'
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }
    }
    
    static async resetPassword(request, env) {
        try {
            const { token, password } = await request.json();
            
            if (!token || !password) {
                return new Response(JSON.stringify({
                    error: 'Token and password are required'
                }), {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }
            
            if (password.length < 6) {
                return new Response(JSON.stringify({
                    error: 'Password must be at least 6 characters long'
                }), {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }
            
            // Get reset token data from KV
            const resetData = await env.SESSIONS.get(`reset_${token}`, { type: 'json' });
            
            if (!resetData) {
                return new Response(JSON.stringify({
                    error: 'Invalid or expired reset token'
                }), {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }
            
            // Check if token is expired
            if (new Date(resetData.expiresAt) < new Date()) {
                // Clean up expired token
                await env.SESSIONS.delete(`reset_${token}`);
                
                return new Response(JSON.stringify({
                    error: 'Reset token has expired'
                }), {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }
            
            // Hash new password
            const hashedPassword = await hashPassword(password);
            
            // Update user password
            await env.DB.prepare(
                'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?'
            ).bind(hashedPassword, new Date().toISOString(), resetData.userId).run();
            
            // Delete the reset token
            await env.SESSIONS.delete(`reset_${token}`);
            
            // Send password reset success email
            try {
                await EmailService.sendPasswordResetSuccessEmail(resetData.email, resetData.name || resetData.email.split('@')[0]);
            } catch (emailError) {
                console.error('Success email sending failed:', emailError);
                // Continue with the response even if email fails
            }
            
            return new Response(JSON.stringify({
                success: true,
                message: 'Password reset successfully'
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
            
        } catch (error) {
            console.error('Reset password error:', error);
            
            return new Response(JSON.stringify({
                error: 'Failed to reset password'
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
