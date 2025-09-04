import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from 'zod';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { mkdirSync } from 'fs';
import type { SelfhostedSupabaseClient } from '../client/index.js';
// import type { McpToolDefinition } from '@modelcontextprotocol/sdk/types.js'; // Removed incorrect import
import type { ToolContext } from './types.js';
import { runExternalCommand } from './utils.js'; // Need a new helper for running commands

/**
 * Normalizes and validates the output path for cross-platform compatibility
 */
function normalizeOutputPath(inputPath: string): string {
    // Handle Windows drive letters in Unix-style paths (e.g., "/c:/path" -> "C:/path")
    if (process.platform === 'win32' && inputPath.match(/^\/[a-zA-Z]:/)) {
        inputPath = inputPath.substring(1); // Remove leading slash
        inputPath = inputPath.charAt(0).toUpperCase() + inputPath.slice(1); // Uppercase drive letter
    }
    
    // Use Node.js resolve to normalize the path
    return resolve(inputPath);
}

// Input schema
const GenerateTypesInputSchema = z.object({
    included_schemas: z.array(z.string()).optional().default(['public']).describe('Database schemas to include in type generation.'),
    output_filename: z.string().optional().default('database.types.ts').describe('Filename to save the generated types to in the workspace root.'),
    output_path: z.string().describe('Absolute path where to save the file. If provided, output_filename will be ignored.'),
});
type GenerateTypesInput = z.infer<typeof GenerateTypesInputSchema>;

// Output schema
const GenerateTypesOutputSchema = z.object({
    success: z.boolean(),
    message: z.string().describe('Output message from the generation process.'),
    types: z.string().optional().describe('The generated TypeScript types, if successful.'),
    file_path: z.string().optional().describe('The absolute path to the saved types file, if successful.'),
    platform: z.string().describe('Operating system platform (win32, darwin, linux).'),
});

// Static JSON Schema for MCP capabilities
const mcpInputSchema = {
    type: 'object',
    properties: {
        included_schemas: {
            type: 'array',
            items: { type: 'string' },
            default: ['public'],
            description: 'Database schemas to include in type generation.',
        },
        output_filename: {
            type: 'string',
            default: 'database.types.ts',
            description: 'Filename to save the generated types to in the workspace root.',
        },
        output_path: {
            type: 'string',
            description: 'Absolute path where to download the generated TypeScript file. Examples: Windows: "C:\\\\path\\\\to\\\\project\\\\database.types.ts", macOS/Linux: "/path/to/project/database.types.ts". This parameter is required.',
        },
    },
    required: ['output_path'], // output_path is required for file download
};

// The tool definition - No explicit McpToolDefinition type needed
export const generateTypesTool: Tool = {
    name: 'generate_typescript_types',
    description: 'Generates TypeScript types from the database schema using the Supabase CLI (`supabase gen types`) and downloads the file to the specified absolute path. The tool returns the current platform (win32, darwin, linux) to help with path formatting. Requires DATABASE_URL configuration and Supabase CLI installed.',
    inputSchema: GenerateTypesInputSchema,
    mcpInputSchema: mcpInputSchema, // Add static JSON schema
    outputSchema: GenerateTypesOutputSchema,
    execute: async (input: unknown, context: ToolContext) => {
        const client = context.selfhostedClient;
        const dbUrl = client.getDbUrl(); // Need this getter in the client

        if (!dbUrl) {
            return {
                success: false,
                message: 'Error: DATABASE_URL is not configured. Cannot generate types.',
                platform: process.platform,
            };
        }

        // Construct the command
        // Use --local flag for self-hosted?
        const schemas = input.included_schemas.join(','); // Comma-separated for the CLI flag
        // Note: The actual command might vary slightly based on Supabase CLI version and context.
        // Using --db-url is generally safer for self-hosted.
        const command = `supabase gen types typescript --db-url "${dbUrl}" --schema "${schemas}"`;

        console.error(`Running command: ${command}`);

        try {
            const { stdout, stderr, error } = await runExternalCommand(command);

            if (error) {
                console.error(`Error executing supabase gen types: ${stderr || error.message}`);
                return {
                    success: false,
                    message: `Command failed: ${stderr || error.message}`,
                    platform: process.platform,
                };
            }

            if (stderr) {
                console.error(`supabase gen types produced stderr output: ${stderr}`);
                 // Treat stderr as non-fatal for now, maybe just warnings
            }

            // Normalize and save the generated types to the specified absolute path
            let outputPath: string;
            try {
                outputPath = normalizeOutputPath(input.output_path);
                console.error(`Normalized output path: ${outputPath}`);
            } catch (pathError) {
                const pathErrorMessage = pathError instanceof Error ? pathError.message : String(pathError);
                console.error(`Invalid output path: ${pathErrorMessage}`);
                return {
                    success: false,
                    message: `Invalid output path "${input.output_path}": ${pathErrorMessage}`,
                    platform: process.platform,
                };
            }
            
            try {
                // Ensure the directory exists
                const outputDir = dirname(outputPath);
                try {
                    mkdirSync(outputDir, { recursive: true });
                } catch (dirError) {
                    // Ignore error if directory already exists
                    if ((dirError as NodeJS.ErrnoException).code !== 'EEXIST') {
                        throw dirError;
                    }
                }
                
                writeFileSync(outputPath, stdout, 'utf8');
                console.error(`Types saved to: ${outputPath}`);
            } catch (writeError) {
                const writeErrorMessage = writeError instanceof Error ? writeError.message : String(writeError);
                console.error(`Failed to write types file: ${writeErrorMessage}`);
                return {
                    success: false,
                    message: `Type generation succeeded but failed to save file: ${writeErrorMessage}. Platform: ${process.platform}. Attempted path: ${outputPath}`,
                    types: stdout,
                    platform: process.platform,
                };
            }

            console.error('Type generation and file save successful.');
            return {
                success: true,
                message: `Types generated successfully and saved to ${outputPath}.${stderr ? `\nWarnings:\n${stderr}` : ''}`,
                types: stdout,
                file_path: outputPath,
                platform: process.platform,
            };

        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error(`Exception during type generation: ${errorMessage}`);
            return {
                success: false,
                message: `Exception during type generation: ${errorMessage}. Platform: ${process.platform}`,
                platform: process.platform,
            };
        }
    },
}; 