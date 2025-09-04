import { Tool } from "@modelcontextprotocol/sdk/dist/types.js";
import { z } from "zod";
import { ToolContext } from "./types.js";
import * as fs from 'fs/promises';
import * as path from 'path';

const CreateMigrationInputSchema = z.object({
    name: z.string().describe("Migration name (e.g., 'create_users_table')"),
    content: z.string().describe("SQL content of the migration"),
    migrationsPath: z.string().optional().default('supabase/migrations').describe("Path to migrations directory"),
    timestamp: z.string().optional().describe("Custom timestamp (YYYYMMDDHHMMSS format)")
});

const CreateMigrationOutputSchema = z.object({
    content: z.array(z.object({
        type: z.literal("text"),
        text: z.string()
    }))
});

type CreateMigrationInput = z.infer<typeof CreateMigrationInputSchema>;

export const createMigrationTool: Tool = {
    name: "create_migration",
    description: "Create a new migration file with proper versioning",
    inputSchema: CreateMigrationInputSchema,
    mcpInputSchema: {
        type: "object",
        properties: {
            name: {
                type: "string",
                description: "Migration name (e.g., 'create_users_table')"
            },
            content: {
                type: "string",
                description: "SQL content of the migration"
            },
            migrationsPath: {
                type: "string",
                description: "Path to migrations directory (default: supabase/migrations)"
            },
            timestamp: {
                type: "string",
                description: "Custom timestamp (YYYYMMDDHHMMSS format)"
            }
        },
        required: ["name", "content"]
    },
    outputSchema: CreateMigrationOutputSchema,
    execute: async (input: unknown, context: ToolContext) => {
        const validatedInput = CreateMigrationInputSchema.parse(input);
        
        // Generate timestamp if not provided
        const timestamp = validatedInput.timestamp || new Date()
            .toISOString()
            .replace(/[-:T]/g, '')
            .replace(/\..+/, '')
            .substring(0, 14);
        
        // Validate timestamp format
        if (!/^\d{14}$/.test(timestamp)) {
            throw new Error("Invalid timestamp format. Use YYYYMMDDHHMMSS");
        }
        
        // Clean migration name
        const cleanName = validatedInput.name
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
        
        // Resolve migrations path
        const migrationsDir = path.isAbsolute(validatedInput.migrationsPath)
            ? validatedInput.migrationsPath
            : path.join(context.workspacePath || process.cwd(), validatedInput.migrationsPath);
        
        // Create migrations directory if it doesn't exist
        await fs.mkdir(migrationsDir, { recursive: true });
        
        // Generate filename
        const filename = `${timestamp}_${cleanName}.sql`;
        const filePath = path.join(migrationsDir, filename);
        
        // Check if file already exists
        try {
            await fs.access(filePath);
            throw new Error(`Migration file already exists: ${filename}`);
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
        
        // Add header comment to migration
        const header = `-- Migration: ${cleanName}
-- Created: ${new Date().toISOString()}
-- Version: ${timestamp}

`;
        
        // Add footer with rollback section
        const footer = `

-- ============================================================================
-- Rollback (Optional)
-- ============================================================================
-- To rollback this migration, uncomment and run the following:
/*
-- TODO: Add rollback SQL here
*/
`;
        
        // Prepare final content
        const finalContent = header + validatedInput.content + footer;
        
        // Write migration file
        await fs.writeFile(filePath, finalContent, 'utf-8');
        
        // Also create a corresponding down migration if needed
        const downMigrationPath = filePath.replace('.sql', '.down.sql');
        const downContent = `-- Rollback migration: ${cleanName}
-- Created: ${new Date().toISOString()}
-- Version: ${timestamp}

-- TODO: Add rollback SQL here
-- This file is optional and can be used to rollback the migration
`;
        
        try {
            await fs.writeFile(downMigrationPath, downContent, 'utf-8');
        } catch (error) {
            // Down migration is optional, so we don't throw on failure
            console.warn('Could not create down migration:', error);
        }
        
        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    success: true,
                    migration: {
                        version: timestamp,
                        name: cleanName,
                        filename,
                        path: filePath,
                        downMigrationPath: downMigrationPath
                    },
                    message: `Migration created successfully: ${filename}`,
                    nextSteps: [
                        'Review the migration file',
                        'Test locally if possible',
                        'Use push_migrations tool to apply',
                        'Commit to version control'
                    ]
                }, null, 2)
            }]
        };
    }
};