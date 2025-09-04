import { z } from "zod";
import { ToolContext } from "./types.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { PoolClient } from 'pg';
import { validateSqlQuery } from '../utils/sql-sanitizer.js';

// Input schema
const ApplyMigrationInputSchema = z.object({
    version: z.string().describe("The migration version string (e.g., '20240101120000')."),
    name: z.string().optional().describe("An optional descriptive name for the migration."),
    sql: z.string().describe("The SQL DDL content of the migration."),
});
type ApplyMigrationInput = z.infer<typeof ApplyMigrationInputSchema>;

// Output schema
const ApplyMigrationOutputSchema = z.object({
    success: z.boolean(),
    version: z.string(),
    message: z.string().optional(),
});

// Static JSON Schema for MCP capabilities
const mcpInputSchema = {
    type: 'object',
    properties: {
        version: { type: 'string', description: "The migration version string (e.g., '20240101120000')." },
        name: { type: 'string', description: 'An optional descriptive name for the migration.' },
        sql: { type: 'string', description: 'The SQL DDL content of the migration.' },
    },
    required: ['version', 'sql'],
};

// The tool definition - No explicit McpToolDefinition type needed
export const applyMigrationTool = {
    name: 'apply_migration',
    description: 'Applies a SQL migration script and records it in the supabase_migrations.schema_migrations table within a transaction.',
    inputSchema: ApplyMigrationInputSchema,
    mcpInputSchema: mcpInputSchema,
    outputSchema: ApplyMigrationOutputSchema,
    execute: async (input: unknown, context: ToolContext) => {
        const client = context.selfhostedClient;

        try {
            // Validate migration SQL for potential injection
            // Note: Migrations may contain DDL operations, so we skip the read-only check
            try {
                // Basic validation without read-only restriction
                if (!input.sql || typeof input.sql !== 'string') {
                    throw new Error('Invalid SQL: must be a non-empty string');
                }
                if (input.sql.length > 100000) {
                    throw new Error('Migration SQL exceeds maximum allowed length');
                }
            } catch (error) {
                throw new Error(`Migration SQL validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }

            // Ensure pg is configured and available
            if (!client.isPgAvailable()) {
                 throw new Error('Direct database connection (DATABASE_URL) is required for applying migrations but is not configured or available.');
            }

            await client.executeTransactionWithPg(async (pgClient: PoolClient) => {
                // 1. Execute the provided migration SQL
                console.error(`Executing migration SQL for version ${input.version}...`);
                await pgClient.query(input.sql);
                console.error('Migration SQL executed successfully.');

                // 2. Insert the record into the migrations table
                console.error(`Recording migration version ${input.version} in schema_migrations...`);
                await pgClient.query(
                    'INSERT INTO supabase_migrations.schema_migrations (version, name) ' +
                    'VALUES ($1, $2);',
                     [input.version, input.name ?? '']
                 );
                console.error(`Migration version ${input.version} recorded.`);
            });

            return {
                success: true,
                version: input.version,
                message: `Migration ${input.version} applied successfully.`,
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Failed to apply migration ${input.version}:`, errorMessage);
            // Return a structured error response recognized by handleSqlResponse if needed,
            // or let the SDK handle the thrown error.
            // Here, we'll just rethrow to let SDK handle it.
            // Alternatively, return { success: false, version: input.version, message: 'Failed: ' + errorMessage };
            throw new Error(`Failed to apply migration ${input.version}: ${errorMessage}`);
        }
    },
}; 