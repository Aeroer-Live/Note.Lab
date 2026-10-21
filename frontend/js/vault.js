// Client-side encryption for credentials notes (end-to-end: the server stores only ciphertext).
//
// A random AES-256-GCM data key encrypts note content. That key is stored on the server
// only wrapped (encrypted) by a key derived from the user's vault passphrase with PBKDF2,
// so changing the passphrase only re-wraps the data key. The unwrapped key lives in memory
// and is gone when the page is closed or reloaded.
const VAULT_PREFIX = 'nlenc:v1:';
const VAULT_ITERATIONS = 600000;
const VAULT_MIN_PASSPHRASE = 10;

// Chunked: spreading a large note's bytes into one call would exceed the argument limit
function bytesToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
}
const base64ToBytes = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));

class Vault {
    constructor() {
        this.config = undefined; // undefined: not fetched yet; null: no vault created yet
        this.key = null;
        this.pending = null;
        this.unlockListeners = [];
    }

    static isEncrypted(content) {
        return typeof content === 'string' && content.startsWith(VAULT_PREFIX);
    }

    isUnlocked() {
        return this.key !== null;
    }

    onUnlock(listener) {
        this.unlockListeners.push(listener);
    }

    async loadConfig() {
        if (this.config === undefined) {
            const response = await window.api.getVault();
            this.config = response.data.vault;
        }
        return this.config;
    }

    async deriveWrappingKey(passphrase, salt, iterations) {
        const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
            material,
            { name: 'AES-GCM', length: 256 },
            false,
            ['wrapKey', 'unwrapKey']
        );
    }

    async create(passphrase) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const dataKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
        const wrappingKey = await this.deriveWrappingKey(passphrase, salt, VAULT_ITERATIONS);
        const wrapped = await crypto.subtle.wrapKey('raw', dataKey, wrappingKey, { name: 'AES-GCM', iv });

        const config = {
            v: 1,
            kdf: 'PBKDF2-SHA256',
            iterations: VAULT_ITERATIONS,
            salt: bytesToBase64(salt),
            iv: bytesToBase64(iv),
            wrappedKey: bytesToBase64(wrapped)
        };

        const response = await window.api.setVault(config, null);
        this.config = response.data.vault;
        this.key = dataKey;
    }

    // Resolves false for a wrong passphrase (AES-GCM authentication fails)
    async unlock(passphrase) {
        const config = this.config;
        const wrappingKey = await this.deriveWrappingKey(passphrase, base64ToBytes(config.salt), config.iterations);
        try {
            this.key = await crypto.subtle.unwrapKey(
                'raw',
                base64ToBytes(config.wrappedKey),
                wrappingKey,
                { name: 'AES-GCM', iv: base64ToBytes(config.iv) },
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );
            return true;
        } catch {
            return false;
        }
    }

    async encrypt(text) {
        if (!this.key) throw new Error('Vault is locked');
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.key, new TextEncoder().encode(text || ''));
        return `${VAULT_PREFIX}${bytesToBase64(iv)}:${bytesToBase64(data)}`;
    }

    async decrypt(payload) {
        if (!this.key) throw new Error('Vault is locked');
        const [ivText, dataText] = payload.slice(VAULT_PREFIX.length).split(':');
        const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(ivText) }, this.key, base64ToBytes(dataText));
        return new TextDecoder().decode(data);
    }

    // Shows the create or unlock dialog unless already unlocked; resolves true once unlocked.
    // Concurrent callers share one dialog.
    ensureUnlocked() {
        if (this.isUnlocked()) return Promise.resolve(true);
        if (!this.pending) {
            this.pending = this.prompt().finally(() => {
                this.pending = null;
            });
        }
        return this.pending;
    }

    async prompt() {
        try {
            await this.loadConfig();
        } catch (error) {
            window.noteApp.showToast('Could not reach the vault: ' + error.message, 'error');
            return false;
        }

        const unlocked = await new VaultDialog(this).show();
        if (unlocked) {
            for (const listener of this.unlockListeners) {
                try {
                    await listener();
                } catch (error) {
                    console.error('Vault unlock listener failed:', error);
                }
            }
        }
        return unlocked;
    }
}

class VaultDialog {
    constructor(vault) {
        this.vault = vault;
        this.modal = document.getElementById('vaultModal');
        this.passphrase = document.getElementById('vaultPassphrase');
        this.confirm = document.getElementById('vaultPassphraseConfirm');
        this.error = document.getElementById('vaultError');
        this.submit = document.getElementById('vaultSubmit');
    }

    show() {
        const creating = !this.vault.config;
        document.getElementById('vaultTitle').textContent = creating ? 'Set up your vault' : 'Unlock your vault';
        document.getElementById('vaultIntro').textContent = creating
            ? 'Credentials notes are encrypted in your browser with this passphrase before they are saved. Use one you do not use anywhere else, including your Note.Lab password.'
            : 'Enter your vault passphrase to read and edit credentials notes.';
        document.getElementById('vaultWarning').hidden = !creating;
        document.getElementById('vaultConfirmGroup').hidden = !creating;
        this.submit.textContent = creating ? 'Create vault' : 'Unlock';
        this.passphrase.value = '';
        this.confirm.value = '';
        this.passphrase.autocomplete = creating ? 'new-password' : 'current-password';
        this.setError('');

        this.modal.style.display = 'flex';
        this.passphrase.focus();

        return new Promise(resolve => {
            const finish = (result) => {
                this.modal.style.display = 'none';
                this.passphrase.value = '';
                this.confirm.value = '';
                this.submit.removeEventListener('click', onSubmit);
                document.getElementById('vaultCancel').removeEventListener('click', onCancel);
                document.getElementById('vaultClose').removeEventListener('click', onCancel);
                this.modal.removeEventListener('keydown', onKey);
                resolve(result);
            };
            const onCancel = () => finish(false);
            const onKey = (e) => {
                if (e.key === 'Escape') finish(false);
                if (e.key === 'Enter') onSubmit();
            };
            const onSubmit = async () => {
                if (this.submit.disabled) return;
                const ok = creating ? await this.create() : await this.unlock();
                if (ok) finish(true);
            };

            this.submit.addEventListener('click', onSubmit);
            document.getElementById('vaultCancel').addEventListener('click', onCancel);
            document.getElementById('vaultClose').addEventListener('click', onCancel);
            this.modal.addEventListener('keydown', onKey);
        });
    }

    setError(message) {
        this.error.textContent = message;
        this.error.hidden = !message;
    }

    setBusy(busy, label) {
        this.submit.disabled = busy;
        this.passphrase.disabled = busy;
        this.confirm.disabled = busy;
        if (label) this.submit.textContent = label;
    }

    async create() {
        const passphrase = this.passphrase.value;
        if (passphrase.length < VAULT_MIN_PASSPHRASE) {
            this.setError(`Use at least ${VAULT_MIN_PASSPHRASE} characters. A few random words work well.`);
            return false;
        }
        if (passphrase !== this.confirm.value) {
            this.setError('The passphrases do not match.');
            return false;
        }

        this.setBusy(true, 'Creating…');
        try {
            await this.vault.create(passphrase);
            return true;
        } catch (error) {
            // Another tab or device created the vault first: unlock that one instead
            if (/already exists|changed by another/i.test(error.message)) {
                this.vault.config = undefined;
                await this.vault.loadConfig().catch(() => {});
                this.setError('A vault was already set up for this account. Close this and unlock it with its passphrase.');
            } else {
                this.setError('Could not create the vault: ' + error.message);
            }
            return false;
        } finally {
            this.setBusy(false, 'Create vault');
        }
    }

    async unlock() {
        this.setBusy(true, 'Unlocking…');
        try {
            const ok = await this.vault.unlock(this.passphrase.value);
            if (!ok) {
                this.setError('Wrong passphrase.');
                this.passphrase.select();
            }
            return ok;
        } finally {
            this.setBusy(false, 'Unlock');
        }
    }
}

window.vault = new Vault();
