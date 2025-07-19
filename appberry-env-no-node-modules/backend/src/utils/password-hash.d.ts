/**
 * Utility routines for hashing and verifying passwords.
 *
 * When storing passwords in your database you must never persist the plain text
 * version. Instead we derive a key from the password with PBKDF2 and a random
 * salt. The derived output gets persisted alongside the salt and iteration count.
 * When verifying a login we derive a new key using the stored salt and verify
 * equality in constant time to avoid timing attacks.
 */
export declare function hashPassword(password: string): Promise<string>;
export declare function verifyPassword(password: string, stored: string): Promise<boolean>;
