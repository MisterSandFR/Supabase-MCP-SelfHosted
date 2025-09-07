import { z } from "zod";
import { ToolContext } from "./types.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { runExternalCommand } from './utils.js';
import { validateSqlQuery } from '../utils/sql-sanitizer.js';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Input schema
const ExecutePsqlInputSchema = z.object({
    sql: z.string().optional().describe('Direct SQL command to execute via psql.'),
    file: z.string().optional().describe('Path to SQL file to execute via psql.'),
    command: z.enum(['execute', 'describe', 'list_tables', 'list_functions', 'list_extensions', 'version']).optional().default('execute').describe('Predefined psql command to execute.'),
    output_format: z.enum(['table', 'csv', 'json', 'html']).optional().default('table').describe('Output format for results.'),
    database_url: z.string().optional().describe('Override database URL (uses context DATABASE_URL by default).'),
    timeout: z.number().optional().default(30).describe('Command timeout in seconds.'),
});
type ExecutePsqlInput = z.infer<typeof ExecutePsqlInputSchema>;

// Output schema
const ExecutePsqlOutputSchema = z.object({
    success: z.boolean(),
    stdout: z.string(),
    stderr: z.string(),
    command: z.string(),
    execution_time_ms: z.number().optional(),
    message: z.string().optional(),
});

// Static JSON Schema for MCP capabilities
const mcpInputSchema = {
    type: 'object',
    properties: {
        sql: { type: 'string', description: 'Direct SQL command to execute via psql.' },
        file: { type: 'string', description: 'Path to SQL file to execute via psql.' },
        command: { 
            type: 'string', 
            enum: ['execute', 'describe', 'list_tables', 'list_functions', 'list_extensions', 'version'],
            default: 'execute',
            description: 'Predefined psql command to execute.' 
        },
        output_format: { 
            type: 'string', 
            enum: ['table', 'csv', 'json', 'html'],
            default: 'table',
            description: 'Output format for results.' 
        },
        database_url: { type: 'string', description: 'Override database URL (uses context DATABASE_URL by default).' },
        timeout: { type: 'number', default: 30, description: 'Command timeout in seconds.' },
    },
    required: [],
};

/**
 * Builds psql command arguments based on input parameters
 */
function buildPsqlCommand(input: ExecutePsqlInput, databaseUrl: string): string[] {
    const args: string[] = [];
    
    // Connection parameters
    args.push(databaseUrl);
    
    // Output format
    switch (input.output_format) {
        case 'csv':
            args.push('--csv');
            break;
        case 'json':
            args.push('--json');
            break;
        case 'html':
            args.push('--html');
            break;
        default:
            // table format is default
            break;
    }
    
    // Non-interactive mode
    args.push('--no-psqlrc');
    args.push('--quiet');
    
    // Command-specific arguments
    switch (input.command) {
        case 'describe':
            args.push('-c', '\\d+');
            break;
        case 'list_tables':
            args.push('-c', '\\dt+');
            break;
        case 'list_functions':
            args.push('-c', '\\df+');
            break;
        case 'list_extensions':
            args.push('-c', '\\dx+');
            break;
        case 'version':
            args.push('-c', 'SELECT version();');
            break;
        case 'execute':
        default:
            if (input.sql) {
                args.push('-c', input.sql);
            } else if (input.file) {
                args.push('-f', input.file);
            } else {
                throw new Error('Either sql or file parameter must be provided for execute command');
            }
            break;
    }
    
    return args;
}

/**
 * Creates a temporary SQL file for complex queries
 */
async function createTempSqlFile(sql: string): Promise<string> {
    const tempFile = join(tmpdir(), `mcp_psql_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.sql`);
    await writeFile(tempFile, sql, 'utf-8');
    return tempFile;
}

// The tool definition
export const executePsqlTool = {
    name: 'execute_psql',
    description: 'Executes PostgreSQL commands directly via psql command-line tool. Provides native psql functionality including schema inspection, advanced formatting, and direct database access. Ideal for complex operations that require psql-specific features.',
    inputSchema: ExecutePsqlInputSchema,
    mcpInputSchema: mcpInputSchema,
    outputSchema: ExecutePsqlOutputSchema,
    execute: async (input: ExecutePsqlInput, context: ToolContext) => {
        const startTime = Date.now();
        let tempFile: string | null = null;

        try {
            // Get database URL
            const databaseUrl = input.database_url || process.env.DATABASE_URL;
            if (!databaseUrl) {
                throw new Error('Database URL is required. Provide database_url parameter or set DATABASE_URL environment variable.');
            }

            // Validate SQL if provided
            if (input.sql) {
                try {
                    validateSqlQuery(input.sql, true); // Allow multiple statements
                } catch (error) {
                    throw new Error(`SQL validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }

            // For complex SQL, create a temporary file
            if (input.sql && (input.sql.length > 1000 || input.sql.includes('\n'))) {
                tempFile = await createTempSqlFile(input.sql);
                input.file = tempFile;
                delete input.sql; // Use file instead
            }

            // Build psql command
            const psqlArgs = buildPsqlCommand(input, databaseUrl);
            const command = `psql ${psqlArgs.map(arg => arg.includes(' ') ? `"${arg}"` : arg).join(' ')}`;

            console.error(`Executing psql command: ${command.substring(0, 200)}...`);

            // Execute the command with timeout
            const timeoutMs = input.timeout * 1000;
            const commandWithTimeout = process.platform === 'win32' 
                ? `timeout /t ${input.timeout} && ${command}`
                : `timeout ${input.timeout}s ${command}`;

            const result = await runExternalCommand(commandWithTimeout);
            const executionTime = Date.now() - startTime;

            // Clean up temporary file
            if (tempFile) {
                try {
                    await unlink(tempFile);
                } catch (error) {
                    console.warn(`Failed to clean up temporary file ${tempFile}:`, error);
                }
            }

            const success = result.error === null;
            const message = success 
                ? `psql command executed successfully in ${executionTime}ms`
                : `psql command failed: ${result.error?.message}`;

            return {
                success,
                stdout: result.stdout,
                stderr: result.stderr,
                command: command,
                execution_time_ms: executionTime,
                message,
            };

        } catch (error: unknown) {
            // Clean up temporary file on error
            if (tempFile) {
                try {
                    await unlink(tempFile);
                } catch (cleanupError) {
                    console.warn(`Failed to clean up temporary file ${tempFile}:`, cleanupError);
                }
            }

            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Failed to execute psql command:', errorMessage);
            const executionTime = Date.now() - startTime;

            return {
                success: false,
                stdout: '',
                stderr: errorMessage,
                command: 'psql',
                execution_time_ms: executionTime,
                message: `psql execution failed: ${errorMessage}`,
            };
        }
    },
};
