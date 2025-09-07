import { z } from 'zod';

/**
 * SQL Sanitizer utility to prevent SQL injection attacks
 */

// Common SQL injection patterns to detect and prevent
const SQL_INJECTION_PATTERNS = [
    /(\b(DELETE|DROP|EXEC(UTE)?|INSERT|SELECT|UNION|UPDATE)\b.*\b(FROM|INTO|WHERE)\b)/gi,
    /(--|\#|\/\*|\*\/)/g, // SQL comments
    /(\bOR\b\s*\d+\s*=\s*\d+)/gi, // OR 1=1 patterns
    /(\bAND\b\s*\d+\s*=\s*\d+)/gi, // AND 1=1 patterns
    /(;|\||&&)/g, // Command separators
    /(\bxp_cmdshell\b|\bsp_executesql\b)/gi, // Dangerous stored procedures
];

// Schema for validating table and column names
const IdentifierSchema = z.string()
    .min(1)
    .max(63) // PostgreSQL identifier limit
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Invalid identifier format');

// Schema for validating schema names
const SchemaNameSchema = z.string()
    .min(1)
    .max(63)
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Invalid schema name format');

/**
 * Escapes a string value for safe inclusion in SQL queries
 */
export function escapeString(value: string): string {
    // PostgreSQL string escaping
    return value
        .replace(/\\/g, '\\\\') // Escape backslashes first
        .replace(/'/g, "''") // Escape single quotes
        .replace(/\n/g, '\\n') // Escape newlines
        .replace(/\r/g, '\\r') // Escape carriage returns
        .replace(/\t/g, '\\t'); // Escape tabs
}

/**
 * Escapes and quotes a string literal for SQL
 */
export function quoteLiteral(value: string): string {
    return `'${escapeString(value)}'`;
}

/**
 * Escapes an identifier (table/column name) for SQL
 */
export function escapeIdentifier(identifier: string): string {
    // Validate the identifier format
    try {
        IdentifierSchema.parse(identifier);
    } catch {
        throw new Error(`Invalid identifier: ${identifier}`);
    }
    
    // Quote the identifier to handle reserved words
    return `"${identifier.replace(/"/g, '""')}"`;
}

/**
 * Validates and escapes a fully qualified table name (schema.table)
 */
export function escapeTableName(schemaName: string, tableName: string): string {
    try {
        SchemaNameSchema.parse(schemaName);
        IdentifierSchema.parse(tableName);
    } catch (error) {
        throw new Error(`Invalid table reference: ${schemaName}.${tableName}`);
    }
    
    return `${escapeIdentifier(schemaName)}.${escapeIdentifier(tableName)}`;
}

/**
 * Checks if a SQL query contains potential injection attempts
 */
export function detectSqlInjection(query: string): boolean {
    // Check for suspicious patterns
    for (const pattern of SQL_INJECTION_PATTERNS) {
        if (pattern.test(query)) {
            return true;
        }
    }
    
    // Check for unbalanced quotes
    const singleQuotes = (query.match(/'/g) || []).length;
    const doubleQuotes = (query.match(/"/g) || []).length;
    
    if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) {
        return true; // Unbalanced quotes are suspicious
    }
    
    return false;
}

/**
 * Checks if a SQL query contains potential injection attempts (strict mode)
 * Used for single-statement queries where semicolons are not allowed
 */
export function detectSqlInjectionStrict(query: string): boolean {
    if (detectSqlInjection(query)) {
        return true;
    }
    
    // Check for multiple statements (semicolons not in strings) - strict mode
    const withoutStrings = query.replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '');
    if (withoutStrings.includes(';')) {
        return true; // Multiple statements detected
    }
    
    return false;
}

/**
 * Validates a SQL query for common safety issues
 * @throws Error if the query is potentially unsafe
 */
export function validateSqlQuery(query: string, allowMultipleStatements: boolean = false): void {
    if (!query || typeof query !== 'string') {
        throw new Error('Invalid SQL query: must be a non-empty string');
    }
    
    // Check for excessively long queries that might be attempts to overflow
    if (query.length > 100000) { // Increased for migrations and complex DDL
        throw new Error('SQL query exceeds maximum allowed length');
    }
    
    // Detect potential SQL injection
    if (allowMultipleStatements) {
        if (detectSqlInjection(query)) {
            throw new Error('Potential SQL injection detected in query');
        }
    } else {
        if (detectSqlInjectionStrict(query)) {
            throw new Error('Potential SQL injection detected in query');
        }
    }
}

/**
 * Creates a parameterized query template
 */
export function createParameterizedQuery(
    template: string, 
    params: Record<string, any>
): { query: string; values: any[] } {
    const values: any[] = [];
    let paramIndex = 1;
    
    // Replace named parameters with numbered placeholders
    const query = template.replace(/:(\w+)/g, (match, paramName) => {
        if (!(paramName in params)) {
            throw new Error(`Missing parameter: ${paramName}`);
        }
        values.push(params[paramName]);
        return `$${paramIndex++}`;
    });
    
    return { query, values };
}

/**
 * Sanitizes user input for use in LIKE clauses
 */
export function escapeLikePattern(pattern: string): string {
    return pattern
        .replace(/\\/g, '\\\\') // Escape backslash
        .replace(/%/g, '\\%') // Escape percent
        .replace(/_/g, '\\_'); // Escape underscore
}

/**
 * Creates a safe WHERE clause from user-provided conditions
 */
export function buildWhereClause(
    conditions: Record<string, any>,
    operator: 'AND' | 'OR' = 'AND'
): string {
    const clauses: string[] = [];
    
    for (const [column, value] of Object.entries(conditions)) {
        // Validate column name
        try {
            IdentifierSchema.parse(column);
        } catch {
            throw new Error(`Invalid column name: ${column}`);
        }
        
        const escapedColumn = escapeIdentifier(column);
        
        if (value === null) {
            clauses.push(`${escapedColumn} IS NULL`);
        } else if (value === undefined) {
            continue; // Skip undefined values
        } else if (Array.isArray(value)) {
            // Handle IN clause
            if (value.length === 0) {
                clauses.push('FALSE'); // Empty array means no match
            } else {
                const escapedValues = value.map(v => quoteLiteral(String(v)));
                clauses.push(`${escapedColumn} IN (${escapedValues.join(', ')})`);
            }
        } else if (typeof value === 'object' && value !== null) {
            // Handle range conditions
            if ('min' in value && value.min !== undefined) {
                clauses.push(`${escapedColumn} >= ${quoteLiteral(String(value.min))}`);
            }
            if ('max' in value && value.max !== undefined) {
                clauses.push(`${escapedColumn} <= ${quoteLiteral(String(value.max))}`);
            }
            if ('like' in value && value.like !== undefined) {
                clauses.push(`${escapedColumn} LIKE ${quoteLiteral(escapeLikePattern(value.like))}`);
            }
        } else {
            // Simple equality
            clauses.push(`${escapedColumn} = ${quoteLiteral(String(value))}`);
        }
    }
    
    return clauses.length > 0 ? clauses.join(` ${operator} `) : '1=1';
}

/**
 * Creates a safe ORDER BY clause
 */
export function buildOrderByClause(
    columns: Array<{ column: string; direction?: 'ASC' | 'DESC' }>
): string {
    if (!columns || columns.length === 0) {
        return '';
    }
    
    const clauses = columns.map(({ column, direction = 'ASC' }) => {
        // Validate column name
        try {
            IdentifierSchema.parse(column);
        } catch {
            throw new Error(`Invalid column name for ORDER BY: ${column}`);
        }
        
        // Validate direction
        if (direction !== 'ASC' && direction !== 'DESC') {
            throw new Error(`Invalid sort direction: ${direction}`);
        }
        
        return `${escapeIdentifier(column)} ${direction}`;
    });
    
    return `ORDER BY ${clauses.join(', ')}`;
}

/**
 * Builds a safe LIMIT clause
 */
export function buildLimitClause(limit?: number, offset?: number): string {
    const clauses: string[] = [];
    
    if (limit !== undefined) {
        if (!Number.isInteger(limit) || limit < 0) {
            throw new Error('Invalid LIMIT value: must be a non-negative integer');
        }
        clauses.push(`LIMIT ${limit}`);
    }
    
    if (offset !== undefined) {
        if (!Number.isInteger(offset) || offset < 0) {
            throw new Error('Invalid OFFSET value: must be a non-negative integer');
        }
        clauses.push(`OFFSET ${offset}`);
    }
    
    return clauses.join(' ');
}

/**
 * Sanitizes a complete SQL query by validating and escaping all parts
 */
export function sanitizeSqlQuery(query: string): string {
    // First, validate the query
    validateSqlQuery(query);
    
    // For read-only operations, ensure no data modification keywords
    const readOnlyKeywords = /\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE)\b/gi;
    if (readOnlyKeywords.test(query)) {
        throw new Error('Data modification operations are not allowed in this context');
    }
    
    return query;
}

/**
 * Creates a safe SELECT query
 */
export function buildSelectQuery(options: {
    table: string;
    schema?: string;
    columns?: string[];
    where?: Record<string, any>;
    orderBy?: Array<{ column: string; direction?: 'ASC' | 'DESC' }>;
    limit?: number;
    offset?: number;
}): string {
    const {
        table,
        schema = 'public',
        columns = ['*'],
        where,
        orderBy,
        limit,
        offset
    } = options;
    
    // Validate and escape table name
    const tableName = escapeTableName(schema, table);
    
    // Validate and escape column names
    const columnList = columns.map(col => {
        if (col === '*') return '*';
        try {
            IdentifierSchema.parse(col);
            return escapeIdentifier(col);
        } catch {
            throw new Error(`Invalid column name: ${col}`);
        }
    }).join(', ');
    
    // Build query parts
    const parts = [`SELECT ${columnList} FROM ${tableName}`];
    
    if (where && Object.keys(where).length > 0) {
        parts.push(`WHERE ${buildWhereClause(where)}`);
    }
    
    if (orderBy && orderBy.length > 0) {
        parts.push(buildOrderByClause(orderBy));
    }
    
    const limitClause = buildLimitClause(limit, offset);
    if (limitClause) {
        parts.push(limitClause);
    }
    
    return parts.join(' ');
}