// Authentication handlers for Cloudflare Workers
import { corsHeaders } from '../utils/cors';
import { generateToken, hashPassword, verifyPassword } from '../middleware/auth';

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
            
            if (password.length < 6) {
                return new Response(JSON.stringify({
                    error: 'Invalid password',
                    message: 'Password must be at least 6 characters long'
                }), {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
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
            const hashedPassword = await hashPassword(password);
            
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
            
            // Generate JWT token
            const user = {
                id: userId,
                email,
                name: name || email.split('@')[0]
            };
            
            const token = await generateToken(user, env);
            
            return new Response(JSON.stringify({
                success: true,
                user,
                token
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
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
            const isValidPassword = await verifyPassword(password, user.password_hash);
            
            if (!isValidPassword) {
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
            
            // Update last login
            await env.DB.prepare(
                'UPDATE users SET last_login_at = ? WHERE id = ?'
            ).bind(new Date().toISOString(), user.id).run();
            
            // Generate JWT token
            const userResponse = {
                id: user.id,
                email: user.email,
                name: user.name
            };
            
            const token = await generateToken(userResponse, env);
            
            return new Response(JSON.stringify({
                success: true,
                user: userResponse,
                token
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
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
}
