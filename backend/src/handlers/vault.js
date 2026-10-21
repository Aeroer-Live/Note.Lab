// Vault settings for client-side encryption of credentials notes.
// The server stores only the passphrase salt and the data key wrapped by the
// passphrase-derived key; it never sees the passphrase or the data key.
import { createErrorResponse, createSuccessResponse } from '../utils/security';

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

function isBase64(value, maxLength) {
    return typeof value === 'string' && value.length > 0 && value.length <= maxLength && BASE64.test(value);
}

function validateVault(vault) {
    return vault &&
        vault.v === 1 &&
        vault.kdf === 'PBKDF2-SHA256' &&
        Number.isInteger(vault.iterations) && vault.iterations >= 100000 && vault.iterations <= 10000000 &&
        isBase64(vault.salt, 64) &&
        isBase64(vault.iv, 32) &&
        isBase64(vault.wrappedKey, 128);
}

function parsePreferences(raw) {
    try {
        const parsed = JSON.parse(raw || '{}');
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

export class VaultHandler {
    static async get(request, env) {
        try {
            const row = await env.DB.prepare('SELECT preferences FROM users WHERE id = ?')
                .bind(request.user.id).first();
            if (!row) {
                return createErrorResponse('User not found', 404, 'USER_NOT_FOUND');
            }

            return createSuccessResponse({ vault: parsePreferences(row.preferences).vault || null });

        } catch (error) {
            console.error('Vault fetch error:', error);
            return createErrorResponse('Failed to fetch vault', 500, 'FETCH_ERROR');
        }
    }

    // Creates the vault, or replaces it (passphrase change) when the caller names the
    // current wrapped key. Replacing it any other way would make encrypted notes unreadable.
    static async set(request, env) {
        try {
            const { vault, previousWrappedKey = null } = await request.json();

            if (!validateVault(vault)) {
                return createErrorResponse('Invalid vault settings', 400, 'INVALID_VAULT');
            }

            const row = await env.DB.prepare('SELECT preferences FROM users WHERE id = ?')
                .bind(request.user.id).first();
            if (!row) {
                return createErrorResponse('User not found', 404, 'USER_NOT_FOUND');
            }

            const preferences = parsePreferences(row.preferences);
            const current = preferences.vault ? preferences.vault.wrappedKey : null;
            if (current !== previousWrappedKey) {
                return createErrorResponse('A vault already exists for this account', 409, 'VAULT_EXISTS');
            }

            preferences.vault = {
                v: vault.v,
                kdf: vault.kdf,
                iterations: vault.iterations,
                salt: vault.salt,
                iv: vault.iv,
                wrappedKey: vault.wrappedKey
            };

            // Conditional on the stored key still being the one checked above, so two
            // concurrent requests cannot both win
            const result = await env.DB.prepare(`
                UPDATE users SET preferences = ?
                WHERE id = ? AND json_extract(COALESCE(preferences, '{}'), '$.vault.wrappedKey') IS ?
            `).bind(JSON.stringify(preferences), request.user.id, current).run();

            if (!result.meta || result.meta.changes !== 1) {
                return createErrorResponse('The vault was changed by another request', 409, 'VAULT_EXISTS');
            }

            return createSuccessResponse({ vault: preferences.vault }, previousWrappedKey ? 200 : 201);

        } catch (error) {
            console.error('Vault update error:', error);
            return createErrorResponse('Failed to save vault', 500, 'SAVE_ERROR');
        }
    }
}
