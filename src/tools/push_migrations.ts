import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ToolContext } from "./types.js";
import { executeSqlWithFallback } from "./utils.js";
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
// @ts-ignore - glob import may have issues
const globAsync = glob;

const PushMigrationsInputSchema = z.object({
    migrationsPath: z.string().optional().default('supabase/migrations').describe("Path to migrations directory"),
    dryRun: z.boolean().optional().default(false).describe("Preview migrations without applying"),
    force: z.boolean().optional().default(false).describe("Force apply even if already applied"),
    pattern: z.string().optional().default('*.sql').describe("Migration file pattern")
});

const PushMigrationsOutputSchema = z.object({
    content: z.array(z.object({
        type: z.literal("text"),
        text: z.string()
    }))
});

type PushMigrationsInput = z.infer<typeof PushMigrationsInputSchema>;

interface Migration {
    version: string;
    name: string;
    path: string;
    content: string;
    applied: boolean;
    appliedAt?: string;
}

export const pushMigrationsTool: Tool = {
    name: "push_migrations",
    description: "Automatically push and apply migrations to self-hosted Supabase instance",
    inputSchema: PushMigrationsInputSchema,
    mcpInputSchema: {
        type: "object",
        properties: {
            migrationsPath: {
                type: "string",
                description: "Path to migrations directory (default: supabase/migrations)"
            },
            dryRun: {
                type: "boolean",
                description: "Preview migrations without applying"
            },
            force: {
                type: "boolean",
                description: "Force apply even if already applied"
            },
            pattern: {
                type: "string",
                description: "Migration file pattern (default: *.sql)"
            }
        }
    },
    outputSchema: PushMigrationsOutputSchema,
    execute: async (input: unknown, context: ToolContext) => {
        const validatedInput = PushMigrationsInputSchema.parse(input || {});
        
        // Resolve migrations path
        const migrationsDir = path.isAbsolute(validatedInput.migrationsPath)
            ? validatedInput.migrationsPath
            : path.join(context.workspacePath || process.cwd(), validatedInput.migrationsPath);
        
        // Check if migrations directory exists
        try {
            await fs.access(migrationsDir);
        } catch (error) {
            throw new Error(`Migrations directory not found: ${migrationsDir}`);
        }
        
        // Ensure schema_migrations table exists
        await executeSqlWithFallback(`
            CREATE SCHEMA IF NOT EXISTS supabase_migrations;
            CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
                version TEXT PRIMARY KEY,
                name TEXT,
                executed_at TIMESTAMPTZ DEFAULT NOW(),
                execution_time_ms INTEGER,
                hash TEXT,
                success BOOLEAN DEFAULT true,
                error_message TEXT
            );
        `, context);
        
        // Get list of applied migrations
        const appliedResult = await executeSqlWithFallback(`
            SELECT version, name, executed_at, success, error_message
            FROM supabase_migrations.schema_migrations
            ORDER BY version
        `, context);
        
        const appliedMigrations = new Map(
            appliedResult.data.map((m: any) => [m.version, m])
        );
        
        // Find all migration files
        const pattern = path.join(migrationsDir, validatedInput.pattern);
        const migrationFiles = await glob(pattern, { windowsPathsNoEscape: true });
        
        // Parse and sort migrations
        const migrations: Migration[] = [];
        for (const filePath of migrationFiles) {
            const fileName = path.basename(filePath);
            
            // Extract version from filename (e.g., "20240101120000_create_tables.sql")
            const versionMatch = fileName.match(/^(\d{14})/);
            if (!versionMatch) {
                console.warn(`Skipping file without version prefix: ${fileName}`);
                continue;
            }
            
            const version = versionMatch[1];
            const name = fileName.replace(/^\d{14}_/, '').replace(/\.sql$/, '');
            const content = await fs.readFile(filePath, 'utf-8');
            
            const applied = appliedMigrations.has(version);
            const appliedInfo = appliedMigrations.get(version);
            
            migrations.push({
                version,
                name,
                path: filePath,
                content,
                applied: applied && appliedInfo?.success !== false,
                appliedAt: appliedInfo?.executed_at
            });
        }
        
        // Sort migrations by version
        migrations.sort((a, b) => a.version.localeCompare(b.version));
        
        // Filter pending migrations
        const pendingMigrations = validatedInput.force 
            ? migrations 
            : migrations.filter(m => !m.applied);
        
        if (pendingMigrations.length === 0) {
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        status: 'up_to_date',
                        message: 'All migrations are already applied',
                        appliedCount: migrations.filter(m => m.applied).length,
                        migrations: migrations.map(m => ({
                            version: m.version,
                            name: m.name,
                            applied: m.applied,
                            appliedAt: m.appliedAt
                        }))
                    }, null, 2)
                }]
            };
        }
        
        // Dry run - show what would be applied
        if (validatedInput.dryRun) {
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        status: 'dry_run',
                        message: `Would apply ${pendingMigrations.length} migration(s)`,
                        pending: pendingMigrations.map(m => ({
                            version: m.version,
                            name: m.name,
                            path: m.path,
                            contentPreview: m.content.substring(0, 200)
                        })),
                        applied: migrations.filter(m => m.applied).map(m => ({
                            version: m.version,
                            name: m.name,
                            appliedAt: m.appliedAt
                        }))
                    }, null, 2)
                }]
            };
        }
        
        // Apply migrations
        const results = [];
        let successCount = 0;
        let failureCount = 0;
        
        for (const migration of pendingMigrations) {
            const startTime = Date.now();
            
            try {
                // Begin transaction
                await executeSqlWithFallback("BEGIN", context);
                
                // Apply migration
                const statements = migration.content
                    .split(/;\s*$/m)
                    .filter(s => s.trim().length > 0);
                
                for (const statement of statements) {
                    if (statement.trim()) {
                        await executeSqlWithFallback(statement, context);
                    }
                }
                
                // Calculate hash for tracking
                const crypto = await import('crypto');
                const hash = crypto.createHash('sha256')
                    .update(migration.content)
                    .digest('hex');
                
                // Record successful migration
                await executeSqlWithFallback(`
                    INSERT INTO supabase_migrations.schema_migrations 
                    (version, name, execution_time_ms, hash, success)
                    VALUES ($1, $2, $3, $4, true)
                    ON CONFLICT (version) 
                    DO UPDATE SET 
                        executed_at = NOW(),
                        execution_time_ms = $3,
                        hash = $4,
                        success = true,
                        error_message = NULL
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
                    status: 'success',
                    executionTime: Date.now() - startTime
                });
                
            } catch (error) {
                // Rollback on error
                try {
                    await executeSqlWithFallback("ROLLBACK", context);
                } catch (rollbackError) {
                    console.error('Rollback failed:', rollbackError);
                }
                
                const errorMessage = error instanceof Error ? error.message : String(error);
                
                // Record failed migration
                try {
                    await executeSqlWithFallback(`
                        INSERT INTO supabase_migrations.schema_migrations 
                        (version, name, execution_time_ms, success, error_message)
                        VALUES ($1, $2, $3, false, $4)
                        ON CONFLICT (version) 
                        DO UPDATE SET 
                            executed_at = NOW(),
                            execution_time_ms = $3,
                            success = false,
                            error_message = $4
                    `, context, [
                        migration.version,
                        migration.name,
                        Date.now() - startTime,
                        errorMessage
                    ]);
                } catch (recordError) {
                    console.error('Failed to record migration failure:', recordError);
                }
                
                failureCount++;
                results.push({
                    version: migration.version,
                    name: migration.name,
                    status: 'failed',
                    error: errorMessage,
                    executionTime: Date.now() - startTime
                });
                
                // Stop on first failure unless force is enabled
                if (!validatedInput.force) {
                    break;
                }
            }
        }
        
        // Get final state
        const finalStateResult = await executeSqlWithFallback(`
            SELECT version, name, executed_at, success
            FROM supabase_migrations.schema_migrations
            ORDER BY version DESC
            LIMIT 1
        `, context);
        
        const latestMigration = finalStateResult.data?.[0];
        
        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    status: failureCount > 0 ? 'partial_success' : 'success',
                    message: `Applied ${successCount} migration(s), ${failureCount} failed`,
                    summary: {
                        total: pendingMigrations.length,
                        success: successCount,
                        failed: failureCount
                    },
                    results,
                    currentVersion: latestMigration?.version,
                    recommendation: failureCount > 0 
                        ? 'Review failed migrations and fix issues before retrying'
                        : 'All migrations applied successfully'
                }, null, 2)
            }]
        };
    }
};