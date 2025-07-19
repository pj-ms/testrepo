/**
 * Utility routines for hashing and verifying passwords.
 *
 * When storing passwords in your database you must never persist the plain text
 * version. Instead we derive a key from the password with PBKDF2 and a random
 * salt. The derived output gets persisted alongside the salt and iteration count.
 * When verifying a login we derive a new key using the stored salt and verify
 * equality in constant time to avoid timing attacks.
 */
const ITERATIONS = 100_000;
const SALT_LEN = 16;
const KEY_LEN = 32; // 256 bits
function buf2hex(buf) {
    return Array.from(buf)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
function hex2buf(hex) {
    if (hex.length % 2)
        throw new Error('Invalid hex string');
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
}
function constantTimeEqual(a, b) {
    if (a.length !== b.length)
        return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}
export async function hashPassword(password) {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, keyMaterial, KEY_LEN * 8);
    return `${buf2hex(salt)}:${buf2hex(new Uint8Array(bits))}:${ITERATIONS}`;
}
export async function verifyPassword(password, stored) {
    const parts = stored.split(':');
    if (parts.length !== 3) {
        throw new Error('Bad hash format');
    }
    const [saltHex, hashHex, iterStr] = parts;
    const salt = hex2buf(saltHex);
    const iterations = Number(iterStr);
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, keyMaterial, (hashHex.length / 2) * 8);
    return constantTimeEqual(buf2hex(new Uint8Array(bits)), hashHex);
}
