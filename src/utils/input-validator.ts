import { z } from 'zod';

/**
 * Comprehensive input validation and sanitization utilities
 */

// Common validation schemas
export const UUIDSchema = z.string().uuid('Invalid UUID format');

export const EmailSchema = z.string()
    .email('Invalid email format')
    .max(254, 'Email address too long');

export const URLSchema = z.string()
    .url('Invalid URL format')
    .max(2048, 'URL too long');

export const FilePathSchema = z.string()
    .min(1, 'File path cannot be empty')
    .max(4096, 'File path too long')
    .refine(path => !path.includes('\0'), 'File path contains null bytes')
    .refine(path => !path.includes('..'), 'File path contains directory traversal');

export const DatabaseNameSchema = z.string()
    .min(1)
    .max(63) // PostgreSQL limit
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Invalid database name format');

export const TableNameSchema = z.string()
    .min(1)
    .max(63)
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Invalid table name format');

export const ColumnNameSchema = z.string()
    .min(1)
    .max(63)
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Invalid column name format');

export const JSONSchema = z.string().refine(
    (val) => {
        try {
            JSON.parse(val);
            return true;
        } catch {
            return false;
        }
    },
    { message: 'Invalid JSON format' }
);

/**
 * Sanitizes a string by removing dangerous characters
 */
export function sanitizeString(input: string, options?: {
    allowNewlines?: boolean;
    allowHtml?: boolean;
    maxLength?: number;
}): string {
    let sanitized = input;
    
    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');
    
    // Limit length
    if (options?.maxLength) {
        sanitized = sanitized.substring(0, options.maxLength);
    }
    
    // Remove or escape HTML if not allowed
    if (!options?.allowHtml) {
        sanitized = sanitized
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }
    
    // Remove newlines if not allowed
    if (!options?.allowNewlines) {
        sanitized = sanitized.replace(/[\r\n]/g, ' ');
    }
    
    // Remove control characters (except tab, newline, carriage return)
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    return sanitized.trim();
}

/**
 * Validates and sanitizes an object recursively
 */
export function sanitizeObject(obj: any, maxDepth: number = 10): any {
    if (maxDepth <= 0) {
        throw new Error('Maximum object depth exceeded');
    }
    
    if (obj === null || obj === undefined) {
        return obj;
    }
    
    if (typeof obj === 'string') {
        return sanitizeString(obj);
    }
    
    if (typeof obj === 'number' || typeof obj === 'boolean') {
        return obj;
    }
    
    if (obj instanceof Date) {
        // Validate date is within reasonable range
        const year = obj.getFullYear();
        if (year < 1900 || year > 2100) {
            throw new Error('Date out of reasonable range');
        }
        return obj.toISOString();
    }
    
    if (Array.isArray(obj)) {
        // Limit array size
        if (obj.length > 10000) {
            throw new Error('Array too large');
        }
        return obj.map(item => sanitizeObject(item, maxDepth - 1));
    }
    
    if (typeof obj === 'object') {
        const keys = Object.keys(obj);
        
        // Limit object size
        if (keys.length > 1000) {
            throw new Error('Object has too many properties');
        }
        
        const sanitized: any = {};
        for (const key of keys) {
            // Sanitize key
            const sanitizedKey = sanitizeString(key, { maxLength: 255 });
            
            // Skip prototype pollution vectors
            if (sanitizedKey === '__proto__' || 
                sanitizedKey === 'constructor' || 
                sanitizedKey === 'prototype') {
                continue;
            }
            
            sanitized[sanitizedKey] = sanitizeObject(obj[key], maxDepth - 1);
        }
        return sanitized;
    }
    
    // Unknown type, reject
    throw new Error(`Unsupported data type: ${typeof obj}`);
}

/**
 * Validates file upload metadata
 */
export function validateFileUpload(options: {
    filename: string;
    size: number;
    mimeType: string;
    allowedTypes?: string[];
    maxSize?: number;
}): { valid: boolean; error?: string } {
    const { filename, size, mimeType, allowedTypes, maxSize = 10 * 1024 * 1024 } = options;
    
    // Validate filename
    if (!filename || filename.length === 0) {
        return { valid: false, error: 'Filename is required' };
    }
    
    if (filename.length > 255) {
        return { valid: false, error: 'Filename too long' };
    }
    
    // Check for directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return { valid: false, error: 'Invalid filename' };
    }
    
    // Check for null bytes
    if (filename.includes('\0')) {
        return { valid: false, error: 'Filename contains null bytes' };
    }
    
    // Validate size
    if (size <= 0) {
        return { valid: false, error: 'Invalid file size' };
    }
    
    if (size > maxSize) {
        return { valid: false, error: `File size exceeds maximum of ${maxSize} bytes` };
    }
    
    // Validate MIME type
    if (allowedTypes && allowedTypes.length > 0) {
        if (!allowedTypes.includes(mimeType)) {
            return { valid: false, error: `File type ${mimeType} not allowed` };
        }
    }
    
    // Check for dangerous file extensions
    const dangerousExtensions = ['.exe', '.dll', '.scr', '.bat', '.cmd', '.com', '.pif'];
    const lowerFilename = filename.toLowerCase();
    for (const ext of dangerousExtensions) {
        if (lowerFilename.endsWith(ext)) {
            return { valid: false, error: 'Dangerous file type not allowed' };
        }
    }
    
    return { valid: true };
}

/**
 * Validates and sanitizes pagination parameters
 */
export function validatePagination(options: {
    page?: number;
    limit?: number;
    offset?: number;
    maxLimit?: number;
}): { page: number; limit: number; offset: number } {
    const maxLimit = options.maxLimit || 100;
    
    let page = options.page || 1;
    let limit = options.limit || 10;
    let offset = options.offset;
    
    // Validate page
    if (!Number.isInteger(page) || page < 1) {
        page = 1;
    }
    if (page > 10000) { // Prevent excessive pagination
        page = 10000;
    }
    
    // Validate limit
    if (!Number.isInteger(limit) || limit < 1) {
        limit = 10;
    }
    if (limit > maxLimit) {
        limit = maxLimit;
    }
    
    // Calculate offset if not provided
    if (offset === undefined) {
        offset = (page - 1) * limit;
    } else {
        // Validate offset
        if (!Number.isInteger(offset) || offset < 0) {
            offset = 0;
        }
        if (offset > 1000000) { // Prevent excessive offset
            offset = 1000000;
        }
    }
    
    return { page, limit, offset };
}

/**
 * Validates sort parameters
 */
export function validateSort(options: {
    sortBy?: string;
    sortOrder?: string;
    allowedColumns: string[];
}): { sortBy: string; sortOrder: 'ASC' | 'DESC' } | null {
    const { sortBy, sortOrder, allowedColumns } = options;
    
    if (!sortBy) {
        return null;
    }
    
    // Validate sort column
    if (!allowedColumns.includes(sortBy)) {
        throw new Error(`Invalid sort column: ${sortBy}`);
    }
    
    // Validate sort order
    const order = (sortOrder || 'ASC').toUpperCase();
    if (order !== 'ASC' && order !== 'DESC') {
        throw new Error(`Invalid sort order: ${sortOrder}`);
    }
    
    return { sortBy, sortOrder: order as 'ASC' | 'DESC' };
}

/**
 * Validates search query
 */
export function validateSearchQuery(query: string, options?: {
    minLength?: number;
    maxLength?: number;
    allowWildcards?: boolean;
}): string {
    const minLength = options?.minLength || 1;
    const maxLength = options?.maxLength || 1000;
    const allowWildcards = options?.allowWildcards || false;
    
    // Trim and check length
    let sanitized = query.trim();
    
    if (sanitized.length < minLength) {
        throw new Error(`Search query must be at least ${minLength} characters`);
    }
    
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength);
    }
    
    // Remove dangerous characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, ''); // Control characters
    sanitized = sanitized.replace(/[<>'"]/g, ''); // HTML/SQL dangerous chars
    
    // Handle wildcards
    if (!allowWildcards) {
        sanitized = sanitized.replace(/[%_*?]/g, '');
    }
    
    return sanitized;
}

/**
 * Creates a validation middleware for tool inputs
 */
export function createInputValidator<T>(schema: z.ZodSchema<T>) {
    return (input: unknown): T => {
        try {
            // Parse and validate
            const validated = schema.parse(input);
            
            // Additional sanitization for string fields
            if (typeof validated === 'object' && validated !== null) {
                return sanitizeObject(validated) as T;
            }
            
            return validated;
        } catch (error) {
            if (error instanceof z.ZodError) {
                const errors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
                throw new Error(`Input validation failed: ${errors.join(', ')}`);
            }
            throw error;
        }
    };
}

/**
 * Validates environment variables
 */
export function validateEnvironmentVariable(
    value: string | undefined,
    name: string,
    options?: {
        required?: boolean;
        pattern?: RegExp;
        minLength?: number;
        maxLength?: number;
    }
): string | undefined {
    if (!value) {
        if (options?.required) {
            throw new Error(`Environment variable ${name} is required`);
        }
        return undefined;
    }
    
    if (options?.minLength && value.length < options.minLength) {
        throw new Error(`Environment variable ${name} is too short`);
    }
    
    if (options?.maxLength && value.length > options.maxLength) {
        throw new Error(`Environment variable ${name} is too long`);
    }
    
    if (options?.pattern && !options.pattern.test(value)) {
        throw new Error(`Environment variable ${name} has invalid format`);
    }
    
    return value;
}