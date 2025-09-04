import { Tool } from "@modelcontextprotocol/sdk/dist/types.js";
import { z } from "zod";
import { ToolContext } from "./types.js";
import { executeSqlWithFallback } from "./utils.js";
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

const AutoMigrateInputSchema = z.object({
    migrationsPath: z.string().optional().default('supabase/migrations').describe("Path to migrations directory"),
    autoApply: z.boolean().optional().default(true).describe("Automatically apply pending migrations"),
    createIfMissing: z.boolean().optional().default(true).describe("Create migrations table if missing"),
    stopOnError: z.boolean().optional().default(true).describe("Stop on first error or continue"),
    verbose: z.boolean().optional().default(false).describe("Show detailed output")
});

type AutoMigrateInput = z.infer<typeof AutoMigrateInputSchema>;

interface MigrationStatus {
    version: string;
    name: string;
    status: 'pending' | 'applied' | 'failed' | 'skipped';
    executionTime?: number;
    error?: string;
    appliedAt?: string;
}

const autoMigrateOutputSchema = z.object({
    content: z.array(z.object({
        type: z.literal("text"),
        text: z.string()
    }))
});

export const autoMigrateTool = {
    name: "auto_migrate",
    description: "Automatically detect and apply all pending migrations to your Supabase instance",
    inputSchema: AutoMigrateInputSchema,
    mcpInputSchema: {
        type: "object",
        properties: {
            migrationsPath: {
                type: "string",
                description: "Path to migrations directory (default: supabase/migrations)"
            },
            autoApply: {
                type: "boolean",
                description: "Automatically apply pending migrations (default: true)"
            },
            createIfMissing: {
                type: "boolean",
                description: "Create migrations table if missing (default: true)"
            },
            stopOnError: {
                type: "boolean",
                description: "Stop on first error or continue (default: true)"
            },
            verbose: {
                type: "boolean",
                description: "Show detailed output (default: false)"
            }
        }
    },
    outputSchema: autoMigrateOutputSchema,
    execute: async (input: unknown, context: ToolContext) => {
        const validatedInput = AutoMigrateInputSchema.parse(input || {});
        const results: MigrationStatus[] = [];
        
        // Resolve migrations path
        const migrationsDir = path.isAbsolute(validatedInput.migrationsPath)
            ? validatedInput.migrationsPath
            : path.join(context.workspacePath || process.cwd(), validatedInput.migrationsPath);
        
        // Check if migrations directory exists
        try {
            await fs.access(migrationsDir);
        } catch (error) {
            if (validatedInput.createIfMissing) {
                await fs.mkdir(migrationsDir, { recursive: true });
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            status: 'initialized',
                            message: `Created migrations directory at ${migrationsDir}`,
                            migrationsPath: migrationsDir,
                            totalMigrations: 0,
                            pendingMigrations: 0,
                            appliedMigrations: 0
                        }, null, 2)
                    }]
                };
            } else {
                throw new Error(`Migrations directory not found: ${migrationsDir}`);
            }
        }
        
        // Initialize migrations tracking table
        if (validatedInput.createIfMissing) {
            try {
                await executeSqlWithFallback(`
                    CREATE SCHEMA IF NOT EXISTS supabase_migrations;
                    
                    CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
                        version TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        executed_at TIMESTAMPTZ DEFAULT NOW(),
                        execution_time_ms INTEGER,
                        hash TEXT,
                        success BOOLEAN DEFAULT true,
                        error_message TEXT,
                        applied_by TEXT DEFAULT 'auto_migrate'
                    );
                    
                    -- Add index for faster queries
                    CREATE INDEX IF NOT EXISTS idx_migrations_executed_at 
                    ON supabase_migrations.schema_migrations(executed_at DESC);
                    
                    CREATE INDEX IF NOT EXISTS idx_migrations_success 
                    ON supabase_migrations.schema_migrations(success);
                `, context);
                
                if (validatedInput.verbose) {
                    context.log?.('Migration tracking table initialized', 'info');
                }
            } catch (error) {
                throw new Error(`Failed to initialize migration tracking: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        
        // Get currently applied migrations
        const appliedResult = await executeSqlWithFallback(`
            SELECT version, name, executed_at, success, error_message
            FROM supabase_migrations.schema_migrations
            WHERE success = true
            ORDER BY version
        `, context);
        
        const appliedVersions = new Set(
            appliedResult.data.map((m: any) => m.version)
        );
        
        // Find all migration files
        const pattern = path.join(migrationsDir, '*.sql');
        const migrationFiles = await glob(pattern, { windowsPathsNoEscape: true });
        
        // Filter out .down.sql files
        const upMigrations = migrationFiles.filter(f => !f.endsWith('.down.sql'));
        
        // Parse and sort migrations
        const migrations: Array<{
            version: string;
            name: string;
            path: string;
            content?: string;
        }> = [];
        
        for (const filePath of upMigrations) {
            const fileName = path.basename(filePath);
            
            // Extract version from filename (e.g., "20240101120000_create_tables.sql")
            const versionMatch = fileName.match(/^(\d{14})/);
            if (!versionMatch) {
                if (validatedInput.verbose) {
                    context.log?.(`Skipping file without version prefix: ${fileName}`, 'warn');
                }
                continue;
            }
            
            const version = versionMatch[1];
            const name = fileName.replace(/^\d{14}_/, '').replace(/\.sql$/, '');
            
            migrations.push({
                version,
                name,
                path: filePath
            });
        }
        
        // Sort migrations by version
        migrations.sort((a, b) => a.version.localeCompare(b.version));
        
        // Identify pending migrations
        const pendingMigrations = migrations.filter(m => !appliedVersions.has(m.version));
        
        // Summary before applying
        const summary = {
            totalMigrations: migrations.length,
            appliedMigrations: appliedVersions.size,
            pendingMigrations: pendingMigrations.length,
            migrations: migrations.map(m => ({
                version: m.version,
                name: m.name,
                status: appliedVersions.has(m.version) ? 'applied' : 'pending'
            }))
        };
        
        // If no pending migrations or not auto-applying
        if (pendingMigrations.length === 0) {
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        status: 'up_to_date',
                        message: 'All migrations are already applied',
                        ...summary
                    }, null, 2)
                }]
            };
        }
        
        if (!validatedInput.autoApply) {
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        status: 'pending',
                        message: `Found ${pendingMigrations.length} pending migration(s)`,
                        ...summary,
                        recommendation: 'Run with autoApply: true to apply migrations'
                    }, null, 2)
                }]
            };
        }
        
        // Apply pending migrations
        let successCount = 0;
        let failureCount = 0;
        
        for (const migration of pendingMigrations) {
            const startTime = Date.now();
            
            try {
                // Read migration content
                const content = await fs.readFile(migration.path, 'utf-8');
                migration.content = content;
                
                if (validatedInput.verbose) {
                    context.log?.(`Applying migration ${migration.version}: ${migration.name}`, 'info');
                }
                
                // Begin transaction
                await executeSqlWithFallback("BEGIN", context);
                
                // Split and execute statements
                const statements = content
                    .split(/;\s*$/m)
                    .filter(s => s.trim().length > 0 && !s.trim().startsWith('--'));
                
                for (const statement of statements) {
                    if (statement.trim()) {
                        await executeSqlWithFallback(statement, context);
                    }
                }
                
                // Calculate hash
                const crypto = await import('crypto');
                const hash = crypto.createHash('sha256')
                    .update(content)
                    .digest('hex')
                    .substring(0, 16);
                
                // Record migration
                await executeSqlWithFallback(`
                    INSERT INTO supabase_migrations.schema_migrations 
                    (version, name, execution_time_ms, hash, success)
                    VALUES ($1, $2, $3, $4, true)
                `, context, [
                    migration.version,
                    migration.name,
                    Date.now() - startTime,
                    hash
                ]);
                
                // Commit transaction
                await executeSqlWithFallback("COMMIT", context);
                
                successCount++;
                results.push({
                    version: migration.version,
                    name: migration.name,
                    status: 'applied',
                    executionTime: Date.now() - startTime,
                    appliedAt: new Date().toISOString()
                });
                
                if (validatedInput.verbose) {
                    context.log?.(`Successfully applied migration ${migration.version}`, 'info');
                }
                
            } catch (error) {
                // Rollback on error
                try {
                    await executeSqlWithFallback("ROLLBACK", context);
                } catch (rollbackError) {
                    context.log?.('Failed to rollback transaction', 'error');
                }
                
                const errorMessage = error instanceof Error ? error.message : String(error);
                failureCount++;
                
                results.push({
                    version: migration.version,
                    name: migration.name,
                    status: 'failed',
                    error: errorMessage,
                    executionTime: Date.now() - startTime
                });
                
                // Record failure
                try {
                    await executeSqlWithFallback(`
                        INSERT INTO supabase_migrations.schema_migrations 
                        (version, name, execution_time_ms, success, error_message)
                        VALUES ($1, $2, $3, false, $4)
                        ON CONFLICT (version) DO NOTHING
                    `, context, [
                        migration.version,
                        migration.name,
                        Date.now() - startTime,
                        errorMessage
                    ]);
                } catch (recordError) {
                    context.log?.('Failed to record migration failure', 'error');
                }
                
                if (validatedInput.stopOnError) {
                    return {
                        content: [{
                            type: "text",
                            text: JSON.stringify({
                                status: 'error',
                                message: `Migration failed at version ${migration.version}`,
                                error: errorMessage,
                                summary: {
                                    attempted: successCount + failureCount,
                                    succeeded: successCount,
                                    failed: failureCount,
                                    remaining: pendingMigrations.length - (successCount + failureCount)
                                },
                                results,
                                recommendation: 'Fix the error and retry, or use stopOnError: false to continue'
                            }, null, 2)
                        }]
                    };
                }
            }
        }
        
        // Get final migration state
        const finalStateResult = await executeSqlWithFallback(`
            SELECT version, name, executed_at
            FROM supabase_migrations.schema_migrations
            WHERE success = true
            ORDER BY version DESC
            LIMIT 1
        `, context);
        
        const latestMigration = finalStateResult.data?.[0];
        
        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    status: failureCount > 0 ? 'partial_success' : 'success',
                    message: failureCount > 0 
                        ? `Applied ${successCount} migration(s) with ${failureCount} failure(s)`
                        : `Successfully applied ${successCount} migration(s)`,
                    summary: {
                        attempted: successCount + failureCount,
                        succeeded: successCount,
                        failed: failureCount,
                        totalMigrations: migrations.length,
                        currentVersion: latestMigration?.version
                    },
                    results,
                    currentState: {
                        version: latestMigration?.version,
                        name: latestMigration?.name,
                        appliedAt: latestMigration?.executed_at
                    },
                    recommendation: failureCount > 0 
                        ? 'Review and fix failed migrations before proceeding'
                        : 'All migrations applied successfully'
                }, null, 2)
            }]
        };
    }
};