import { z } from "zod";
import { ToolContext } from "./types.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { PoolClient } from 'pg';
import { validateSqlQuery } from '../utils/sql-sanitizer.js';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

// Input schema
const ImportSchemaInputSchema = z.object({
    source: z.string().describe("Path to the SQL file to import, or direct SQL content if source_type is 'content'."),
    source_type: z.enum(['file', 'content']).optional().default('file').describe("Whether source is a file path or direct SQL content."),
    transaction: z.boolean().optional().default(true).describe("Execute within a transaction for rollback safety."),
    continue_on_error: z.boolean().optional().default(false).describe("Continue execution even if some statements fail."),
    enable_extensions: z.array(z.string()).optional().describe("PostgreSQL extensions to enable before executing (e.g., ['pgcrypto', 'uuid-ossp'])."),
});
type ImportSchemaInput = z.infer<typeof ImportSchemaInputSchema>;

// Output schema
const ImportSchemaOutputSchema = z.object({
    success: z.boolean(),
    statements_executed: z.number(),
    statements_failed: z.number(),
    extensions_enabled: z.array(z.string()).optional(),
    errors: z.array(z.string()).optional(),
    message: z.string(),
});

// Static JSON Schema for MCP capabilities
const mcpInputSchema = {
    type: 'object',
    properties: {
        source: { type: 'string', description: "Path to the SQL file to import, or direct SQL content if source_type is 'content'." },
        source_type: { type: 'string', enum: ['file', 'content'], default: 'file', description: "Whether source is a file path or direct SQL content." },
        transaction: { type: 'boolean', default: true, description: 'Execute within a transaction for rollback safety.' },
        continue_on_error: { type: 'boolean', default: false, description: 'Continue execution even if some statements fail.' },
        enable_extensions: { type: 'array', items: { type: 'string' }, description: "PostgreSQL extensions to enable before executing (e.g., ['pgcrypto', 'uuid-ossp'])." },
    },
    required: ['source'],
};

/**
 * Splits SQL content into individual statements, handling multi-line statements and comments
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

// The tool definition
export const importSchemaTool = {
    name: 'import_schema',
    description: 'Imports and executes a complete SQL schema file or content. Supports multi-statement DDL operations, extension management, and transaction safety. Ideal for applying migrations, setting up OAuth2 schemas, or importing complete database structures.',
    inputSchema: ImportSchemaInputSchema,
    mcpInputSchema: mcpInputSchema,
    outputSchema: ImportSchemaOutputSchema,
    execute: async (input: ImportSchemaInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        let sqlContent: string;

        // Ensure direct database connection is available
        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection (DATABASE_URL) is required for schema import but is not configured or available.');
        }

        try {
            // Get SQL content
            if (input.source_type === 'content') {
                sqlContent = input.source;
            } else {
                // Read from file
                const filePath = resolve(input.source);
                sqlContent = await readFile(filePath, 'utf-8');
            }

            // Basic validation
            if (!sqlContent || typeof sqlContent !== 'string') {
                throw new Error('Invalid SQL content: must be a non-empty string');
            }

            if (sqlContent.length > 500000) { // 500KB limit
                throw new Error('SQL content exceeds maximum allowed length (500KB)');
            }

            // Validate SQL content (allow multiple statements)
            validateSqlQuery(sqlContent, true);

            // Split into individual statements
            const statements = splitSqlStatements(sqlContent);
            console.error(`Found ${statements.length} SQL statements to execute`);

            let statementsExecuted = 0;
            let statementsFailed = 0;
            const errors: string[] = [];
            const extensionsEnabled: string[] = [];

            if (input.transaction) {
                // Execute within a transaction
                await client.executeTransactionWithPg(async (pgClient: PoolClient) => {
                    // Enable extensions first if specified
                    if (input.enable_extensions && input.enable_extensions.length > 0) {
                        for (const extension of input.enable_extensions) {
                            try {
                                await pgClient.query(`CREATE EXTENSION IF NOT EXISTS ${extension}`);
                                extensionsEnabled.push(extension);
                                console.error(`Enabled extension: ${extension}`);
                            } catch (error) {
                                const errorMsg = `Failed to enable extension ${extension}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                                errors.push(errorMsg);
                                if (!input.continue_on_error) {
                                    throw new Error(errorMsg);
                                }
                            }
                        }
                    }

                    // Execute statements
                    for (let i = 0; i < statements.length; i++) {
                        const statement = statements[i];
                        try {
                            console.error(`Executing statement ${i + 1}/${statements.length}: ${statement.substring(0, 100)}...`);
                            await pgClient.query(statement);
                            statementsExecuted++;
                        } catch (error) {
                            statementsFailed++;
                            const errorMsg = `Statement ${i + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
                            errors.push(errorMsg);
                            console.error(errorMsg);
                            
                            if (!input.continue_on_error) {
                                throw new Error(errorMsg);
                            }
                        }
                    }
                });
            } else {
                // Execute without transaction
                await client.executeTransactionWithPg(async (pgClient: PoolClient) => {
                    // Enable extensions first if specified
                    if (input.enable_extensions && input.enable_extensions.length > 0) {
                        for (const extension of input.enable_extensions) {
                            try {
                                await pgClient.query(`CREATE EXTENSION IF NOT EXISTS ${extension}`);
                                extensionsEnabled.push(extension);
                                console.error(`Enabled extension: ${extension}`);
                            } catch (error) {
                                const errorMsg = `Failed to enable extension ${extension}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                                errors.push(errorMsg);
                                if (!input.continue_on_error) {
                                    throw new Error(errorMsg);
                                }
                            }
                        }
                    }

                    // Execute statements
                    for (let i = 0; i < statements.length; i++) {
                        const statement = statements[i];
                        try {
                            console.error(`Executing statement ${i + 1}/${statements.length}: ${statement.substring(0, 100)}...`);
                            await pgClient.query(statement);
                            statementsExecuted++;
                        } catch (error) {
                            statementsFailed++;
                            const errorMsg = `Statement ${i + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
                            errors.push(errorMsg);
                            console.error(errorMsg);
                            
                            if (!input.continue_on_error) {
                                throw new Error(errorMsg);
                            }
                        }
                    }
                });
            }

            const success = statementsFailed === 0 || (input.continue_on_error && statementsExecuted > 0);
            const message = success 
                ? `Schema import completed successfully. Executed ${statementsExecuted} statements.`
                : `Schema import failed. Executed ${statementsExecuted} statements, ${statementsFailed} failed.`;

            return {
                success,
                statements_executed: statementsExecuted,
                statements_failed: statementsFailed,
                extensions_enabled: extensionsEnabled.length > 0 ? extensionsEnabled : undefined,
                errors: errors.length > 0 ? errors : undefined,
                message,
            };

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Failed to import schema:', errorMessage);
            
            return {
                success: false,
                statements_executed: 0,
                statements_failed: 1,
                errors: [errorMessage],
                message: `Schema import failed: ${errorMessage}`,
            };
        }
    },
};
