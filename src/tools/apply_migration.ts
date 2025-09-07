import { z } from "zod";
import { ToolContext } from "./types.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { PoolClient } from 'pg';
import { validateSqlQuery } from '../utils/sql-sanitizer.js';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

// Input schema
const ApplyMigrationInputSchema = z.object({
    version: z.string().describe("The migration version string (e.g., '20240101120000')."),
    name: z.string().optional().describe("An optional descriptive name for the migration."),
    sql: z.string().optional().describe("The SQL DDL content of the migration."),
    file: z.string().optional().describe("Path to SQL migration file."),
    enable_extensions: z.array(z.string()).optional().describe("PostgreSQL extensions to enable before migration (e.g., ['pgcrypto', 'uuid-ossp'])."),
    rollback_sql: z.string().optional().describe("SQL for rolling back this migration if needed."),
    validate_before: z.boolean().optional().default(true).describe("Validate migration syntax before applying."),
    dry_run: z.boolean().optional().default(false).describe("Test migration without applying changes."),
});
type ApplyMigrationInput = z.infer<typeof ApplyMigrationInputSchema>;

// Output schema
const ApplyMigrationOutputSchema = z.object({
    success: z.boolean(),
    version: z.string(),
    message: z.string().optional(),
    extensions_enabled: z.array(z.string()).optional(),
    dry_run: z.boolean().optional(),
    validation_result: z.object({
        valid: z.boolean(),
        errors: z.array(z.string()).optional(),
    }).optional(),
    rollback_available: z.boolean().optional(),
});

// Static JSON Schema for MCP capabilities
const mcpInputSchema = {
    type: 'object',
    properties: {
        version: { type: 'string', description: "The migration version string (e.g., '20240101120000')." },
        name: { type: 'string', description: 'An optional descriptive name for the migration.' },
        sql: { type: 'string', description: 'The SQL DDL content of the migration.' },
        file: { type: 'string', description: 'Path to SQL migration file.' },
        enable_extensions: { type: 'array', items: { type: 'string' }, description: "PostgreSQL extensions to enable before migration (e.g., ['pgcrypto', 'uuid-ossp'])." },
        rollback_sql: { type: 'string', description: 'SQL for rolling back this migration if needed.' },
        validate_before: { type: 'boolean', default: true, description: 'Validate migration syntax before applying.' },
        dry_run: { type: 'boolean', default: false, description: 'Test migration without applying changes.' },
    },
    required: ['version'],
};

/**
 * Splits SQL content into individual statements for validation and dry-run
 */
function splitSqlStatements(sql: string): string[] {
    const statements: string[] = [];
    let currentStatement = '';
    let inString = false;
    let stringChar = '';
    let inComment = false;
    let commentType = '';
    
    for (let i = 0; i < sql.length; i++) {
        const char = sql[i];
        const nextChar = sql[i + 1];
        
        // Handle string literals
        if (!inComment && (char === "'" || char === '"')) {
            if (!inString) {
                inString = true;
                stringChar = char;
            } else if (char === stringChar) {
                // Check for escaped quotes
                if (nextChar === char) {
                    currentStatement += char + char;
                    i++; // Skip the next character
                    continue;
                } else {
                    inString = false;
                    stringChar = '';
                }
            }
        }
        
        // Handle comments
        if (!inString && !inComment) {
            if (char === '-' && nextChar === '-') {
                inComment = true;
                commentType = 'line';
                i++; // Skip the next character
                continue;
            } else if (char === '/' && nextChar === '*') {
                inComment = true;
                commentType = 'block';
                i++; // Skip the next character
                continue;
            }
        } else if (inComment) {
            if (commentType === 'line' && char === '\n') {
                inComment = false;
                commentType = '';
            } else if (commentType === 'block' && char === '*' && nextChar === '/') {
                inComment = false;
                commentType = '';
                i++; // Skip the next character
                continue;
            }
            continue; // Skip comment content
        }
        
        // Handle statement separators
        if (!inString && !inComment && char === ';') {
            const statement = currentStatement.trim();
            if (statement) {
                statements.push(statement);
            }
            currentStatement = '';
        } else if (!inComment) {
            currentStatement += char;
        }
    }
    
    // Add the last statement if it exists
    const lastStatement = currentStatement.trim();
    if (lastStatement) {
        statements.push(lastStatement);
    }
    
    return statements.filter(stmt => stmt.length > 0);
}

// The tool definition - No explicit McpToolDefinition type needed
export const applyMigrationTool = {
    name: 'apply_migration',
    description: 'Applies a SQL migration script with advanced features: file support, extension management, validation, dry-run mode, and rollback preparation. Records migration in supabase_migrations.schema_migrations table within a transaction.',
    inputSchema: ApplyMigrationInputSchema,
    mcpInputSchema: mcpInputSchema,
    outputSchema: ApplyMigrationOutputSchema,
    execute: async (input: ApplyMigrationInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        let migrationSql: string;
        const extensionsEnabled: string[] = [];
        let validationResult: any = null;

        try {
            // Ensure direct database connection is available
            if (!client.isPgAvailable()) {
                throw new Error('Direct database connection (DATABASE_URL) is required for applying migrations but is not configured or available.');
            }

            // Get migration SQL content
            if (input.sql) {
                migrationSql = input.sql;
            } else if (input.file) {
                const filePath = resolve(input.file);
                migrationSql = await readFile(filePath, 'utf-8');
                console.error(`Loaded migration from file: ${input.file}`);
            } else {
                throw new Error('Either sql or file parameter must be provided');
            }

            // Basic validation
            if (!migrationSql || typeof migrationSql !== 'string') {
                throw new Error('Invalid SQL: must be a non-empty string');
            }

            if (migrationSql.length > 500000) { // 500KB limit
                throw new Error('Migration SQL exceeds maximum allowed length (500KB)');
            }

            // Validate migration SQL if requested
            if (input.validate_before) {
                const errors: string[] = [];
                try {
                    validateSqlQuery(migrationSql, true); // Allow multiple statements
                    
                    // Additional validation: split and check each statement
                    const statements = splitSqlStatements(migrationSql);
                    for (let i = 0; i < statements.length; i++) {
                        const statement = statements[i];
                        try {
                            validateSqlQuery(statement, false); // Individual statement validation
                        } catch (error) {
                            errors.push(`Statement ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        }
                    }
                } catch (error) {
                    errors.push(error instanceof Error ? error.message : 'Unknown error');
                }

                validationResult = {
                    valid: errors.length === 0,
                    errors: errors.length > 0 ? errors : undefined,
                };

                if (!validationResult.valid && !input.dry_run) {
                    return {
                        success: false,
                        version: input.version,
                        message: `Migration validation failed: ${errors.join('; ')}`,
                        validation_result: validationResult,
                        dry_run: input.dry_run,
                    };
                }
            }

            // Dry run mode - validate without applying
            if (input.dry_run) {
                console.error(`Dry run mode: Migration ${input.version} validation completed`);
                return {
                    success: true,
                    version: input.version,
                    message: `Dry run completed successfully for migration ${input.version}`,
                    validation_result: validationResult,
                    dry_run: true,
                    rollback_available: !!input.rollback_sql,
                };
            }

            // Check if migration is already applied
            const existingMigration = await client.executeSqlWithPg(
                `SELECT version FROM supabase_migrations.schema_migrations WHERE version = '${input.version}'`
            );

            if (Array.isArray(existingMigration) && existingMigration.length > 0) {
                return {
                    success: false,
                    version: input.version,
                    message: `Migration ${input.version} has already been applied`,
                };
            }

            // Apply migration within transaction
            await client.executeTransactionWithPg(async (pgClient: PoolClient) => {
                // Enable extensions first if specified
                if (input.enable_extensions && input.enable_extensions.length > 0) {
                    for (const extension of input.enable_extensions) {
                        try {
                            console.error(`Enabling extension: ${extension}`);
                            await pgClient.query(`CREATE EXTENSION IF NOT EXISTS ${extension}`);
                            extensionsEnabled.push(extension);
                        } catch (error) {
                            const errorMsg = `Failed to enable extension ${extension}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                            console.error(errorMsg);
                            throw new Error(errorMsg);
                        }
                    }
                }

                // Execute the migration SQL
                console.error(`Executing migration SQL for version ${input.version}...`);
                await pgClient.query(migrationSql);
                console.error('Migration SQL executed successfully.');

                // Record the migration
                console.error(`Recording migration version ${input.version} in schema_migrations...`);
                await pgClient.query(
                    'INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ($1, $2)',
                    [input.version, input.name ?? '']
                );

                // Store rollback SQL if provided
                if (input.rollback_sql) {
                    try {
                        await pgClient.query(
                            'INSERT INTO supabase_migrations.migration_rollbacks (version, rollback_sql, created_at) VALUES ($1, $2, NOW())',
                            [input.version, input.rollback_sql]
                        );
                        console.error(`Rollback SQL stored for migration ${input.version}`);
                    } catch (error) {
                        // Non-critical error - migration still succeeded
                        console.warn(`Failed to store rollback SQL: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }

                console.error(`Migration version ${input.version} recorded successfully.`);
            });

            return {
                success: true,
                version: input.version,
                message: `Migration ${input.version} applied successfully.`,
                extensions_enabled: extensionsEnabled.length > 0 ? extensionsEnabled : undefined,
                validation_result: validationResult,
                rollback_available: !!input.rollback_sql,
                dry_run: false,
            };

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Failed to apply migration ${input.version}:`, errorMessage);
            
            return {
                success: false,
                version: input.version,
                message: `Failed to apply migration ${input.version}: ${errorMessage}`,
                extensions_enabled: extensionsEnabled.length > 0 ? extensionsEnabled : undefined,
                validation_result: validationResult,
                rollback_available: !!input.rollback_sql,
                dry_run: input.dry_run,
            };
        }
    },
}; 