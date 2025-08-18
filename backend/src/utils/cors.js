// CORS utilities for Cloudflare Workers

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400', // 24 hours
};

export function handleCors() {
    return new Response(null, {
        status: 204,
        headers: corsHeaders
    });
}

export function addCorsHeaders(response) {
    // Add CORS headers to existing response
    Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
    });
    return response;
}
