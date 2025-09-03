import * as crypto from 'node:crypto';
import { z } from 'zod';

/**
 * Secure authentication utilities for handling passwords and tokens
 */

// Password strength requirements
const PasswordSchema = z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

// Email validation schema
const EmailSchema = z.string().email('Invalid email format');

/**
 * Validates password strength
 */
export function validatePassword(password: string): { valid: boolean; errors?: string[] } {
    try {
        PasswordSchema.parse(password);
        return { valid: true };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return {
                valid: false,
                errors: error.errors.map(e => e.message)
            };
        }
        return { valid: false, errors: ['Invalid password'] };
    }
}

/**
 * Validates email format
 */
export function validateEmail(email: string): boolean {
    try {
        EmailSchema.parse(email);
        return true;
    } catch {
        return false;
    }
}

/**
 * Generates a secure random token
 */
export function generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * Hashes a password using PBKDF2 (for environments without bcrypt)
 * Note: In production, bcrypt is preferred and handled by Supabase/PostgreSQL
 */
export function hashPasswordPBKDF2(password: string, salt?: string): { hash: string; salt: string } {
    const actualSalt = salt || crypto.randomBytes(16).toString('hex');
    const iterations = 100000;
    const keyLength = 64;
    const digest = 'sha256';
    
    const hash = crypto.pbkdf2Sync(password, actualSalt, iterations, keyLength, digest).toString('hex');
    
    return {
        hash: `pbkdf2:sha256:${iterations}$${actualSalt}$${hash}`,
        salt: actualSalt
    };
}

/**
 * Verifies a password against a PBKDF2 hash
 */
export function verifyPasswordPBKDF2(password: string, hashedPassword: string): boolean {
    try {
        const parts = hashedPassword.split('$');
        if (parts.length !== 3 || !parts[0].startsWith('pbkdf2:sha256:')) {
            return false;
        }
        
        const iterations = parseInt(parts[0].split(':')[2]);
        const salt = parts[1];
        const hash = parts[2];
        
        const verifyHash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha256').toString('hex');
        
        // Use timing-safe comparison
        return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(verifyHash));
    } catch {
        return false;
    }
}

/**
 * Sanitizes user metadata to remove sensitive information
 */
export function sanitizeUserMetadata(metadata: Record<string, any>): Record<string, any> {
    const sensitiveKeys = [
        'password',
        'encrypted_password',
        'salt',
        'secret',
        'token',
        'api_key',
        'private_key',
        'ssn',
        'credit_card'
    ];
    
    const sanitized = { ...metadata };
    
    for (const key of Object.keys(sanitized)) {
        // Remove sensitive keys
        if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
            delete sanitized[key];
        }
        
        // Recursively sanitize nested objects
        if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
            sanitized[key] = sanitizeUserMetadata(sanitized[key]);
        }
    }
    
    return sanitized;
}

/**
 * Generates a secure session token
 */
export function generateSessionToken(): string {
    return crypto.randomBytes(32).toString('base64url');
}

/**
 * Creates a secure hash of sensitive data for logging/comparison
 * Never log actual sensitive data
 */
export function hashForLogging(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 8) + '...';
}

/**
 * Validates JWT structure (basic validation without verification)
 */
export function isValidJWTStructure(token: string): boolean {
    if (!token || typeof token !== 'string') {
        return false;
    }
    
    const parts = token.split('.');
    if (parts.length !== 3) {
        return false;
    }
    
    try {
        // Check if each part is valid base64url
        parts.forEach(part => {
            const decoded = Buffer.from(part, 'base64url').toString();
            if (!decoded) {
                throw new Error('Invalid base64url');
            }
        });
        
        // Try to parse header and payload as JSON
        const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        
        // Basic JWT header validation
        if (!header.alg || !header.typ) {
            return false;
        }
        
        return true;
    } catch {
        return false;
    }
}

/**
 * Masks sensitive values in objects for safe logging
 */
export function maskSensitiveData(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }
    
    const sensitiveKeys = [
        'password',
        'token',
        'key',
        'secret',
        'authorization',
        'cookie',
        'session'
    ];
    
    const masked = Array.isArray(obj) ? [...obj] : { ...obj };
    
    for (const key in masked) {
        const lowerKey = key.toLowerCase();
        
        if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
            if (typeof masked[key] === 'string' && masked[key].length > 0) {
                masked[key] = masked[key].substring(0, 4) + '****';
            } else {
                masked[key] = '****';
            }
        } else if (typeof masked[key] === 'object' && masked[key] !== null) {
            masked[key] = maskSensitiveData(masked[key]);
        }
    }
    
    return masked;
}

/**
 * Generates a cryptographically secure UUID v4
 */
export function generateSecureUUID(): string {
    const bytes = crypto.randomBytes(16);
    
    // Set version (4) and variant bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    
    const hex = bytes.toString('hex');
    return [
        hex.substring(0, 8),
        hex.substring(8, 12),
        hex.substring(12, 16),
        hex.substring(16, 20),
        hex.substring(20, 32)
    ].join('-');
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
        return false;
    }
    
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Creates a secure HMAC signature
 */
export function createHMAC(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Verifies an HMAC signature
 */
export function verifyHMAC(data: string, signature: string, secret: string): boolean {
    const expectedSignature = createHMAC(data, secret);
    return secureCompare(signature, expectedSignature);
}