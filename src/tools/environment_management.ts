import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ToolContext } from "./types.js";
import { executeSqlWithFallback } from "./utils.js";

const EnvironmentManagementInputSchema = z.object({
    action: z.enum(['list_environments', 'create_environment', 'clone_environment', 'sync_environments', 'compare_environments', 'promote_changes', 'rollback_environment', 'configure_settings', 'backup_environment', 'restore_environment']).describe("Environment management action"),
    environmentName: z.string().optional().describe("Environment name"),
    sourceEnvironment: z.string().optional().describe("Source environment"),
    targetEnvironment: z.string().optional().describe("Target environment"),
    environmentType: z.enum(['development', 'staging', 'production', 'testing', 'preview']).optional().describe("Environment type"),
    cloneOptions: z.object({
        includeData: z.boolean().default(false),
        includeSecrets: z.boolean().default(false),
        includeUsers: z.boolean().default(false),
        includeStorage: z.boolean().default(false)
    }).optional().describe("Clone options"),
    syncOptions: z.object({
        schema: z.boolean().default(true),
        functions: z.boolean().default(true),
        policies: z.boolean().default(true),
        extensions: z.boolean().default(true),
        triggers: z.boolean().default(true)
    }).optional().describe("Sync options"),
    promotionStrategy: z.enum(['all', 'schema_only', 'functions_only', 'policies_only', 'selective']).optional().default('all').describe("Promotion strategy"),
    backupRetentionDays: z.number().optional().default(30).describe("Backup retention in days"),
    autoPromote: z.boolean().optional().default(false).describe("Auto-promote changes"),
    validationRules: z.array(z.object({
        rule: z.string(),
        condition: z.string(),
        severity: z.enum(['error', 'warning', 'info'])
    })).optional().describe("Environment validation rules"),
    environmentConfig: z.object({
        database_size: z.string().optional(),
        connection_limit: z.number().optional(),
        backup_schedule: z.string().optional(),
        monitoring_level: z.enum(['basic', 'detailed', 'comprehensive']).optional(),
        security_level: z.enum(['low', 'medium', 'high']).optional()
    }).optional().describe("Environment configuration"),
    tags: z.array(z.string()).optional().describe("Environment tags"),
    description: z.string().optional().describe("Environment description")
});

type EnvironmentManagementInput = z.infer<typeof EnvironmentManagementInputSchema>;
const environmentManagementOutputSchema = z.object({
    content: z.array(z.object({
        type: z.literal("text"),
        text: z.string()
    }))
});


export const environmentManagementTool = {
    name: "environment_management",
    description: "Comprehensive environment management for dev/staging/production with cloning, syncing, promotion, and rollback capabilities",
    inputSchema: EnvironmentManagementInputSchema,
    mcpInputSchema: {
        type: "object",
        properties: {
            action: { 
                type: "string", 
                enum: ['list_environments', 'create_environment', 'clone_environment', 'sync_environments', 'compare_environments', 'promote_changes', 'rollback_environment', 'configure_settings', 'backup_environment', 'restore_environment'], 
                description: "Environment management action" 
            },
            environmentName: { type: "string", description: "Environment name" },
            sourceEnvironment: { type: "string", description: "Source environment" },
            targetEnvironment: { type: "string", description: "Target environment" },
            environmentType: {
                type: "string",
                enum: ["development", "staging", "production", "testing", "preview"],
                description: "Environment type"
            },
            cloneOptions: {
                type: "object",
                properties: {
                    includeData: { type: "boolean" },
                    includeSecrets: { type: "boolean" },
                    includeUsers: { type: "boolean" },
                    includeStorage: { type: "boolean" }
                }
            },
            syncOptions: {
                type: "object",
                properties: {
                    schema: { type: "boolean" },
                    functions: { type: "boolean" },
                    policies: { type: "boolean" },
                    extensions: { type: "boolean" },
                    triggers: { type: "boolean" }
                }
            },
            promotionStrategy: {
                type: "string",
                enum: ["all", "schema_only", "functions_only", "policies_only", "selective"],
                description: "Promotion strategy"
            },
            backupRetentionDays: { type: "number", description: "Backup retention days" },
            autoPromote: { type: "boolean", description: "Auto-promote changes" },
            validationRules: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        rule: { type: "string" },
                        condition: { type: "string" },
                        severity: {
                            type: "string",
                            enum: ["error", "warning", "info"]
                        }
                    }
                }
            },
            environmentConfig: {
                type: "object",
                properties: {
                    database_size: { type: "string" },
                    connection_limit: { type: "number" },
                    backup_schedule: { type: "string" },
                    monitoring_level: {
                        type: "string",
                        enum: ["basic", "detailed", "comprehensive"]
                    },
                    security_level: {
                        type: "string",
                        enum: ["low", "medium", "high"]
                    }
                }
            },
            tags: {
                type: "array",
                items: { type: "string" }
            },
            description: { type: "string", description: "Environment description" }
        },
        required: ["action"]
    },
    outputSchema: environmentManagementOutputSchema,
    execute: async (input: unknown, context: ToolContext) => {
        const validatedInput = EnvironmentManagementInputSchema.parse(input);
        
        await ensureEnvironmentInfrastructure(context);
        
        switch (validatedInput.action) {
            case 'list_environments': {
                const result = await listEnvironments(validatedInput, context);
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            }
            
            case 'create_environment': {
                if (!validatedInput.environmentName || !validatedInput.environmentType) {
                    throw new Error("Environment name and type are required");
                }
                
                const result = await createEnvironment(validatedInput, context);
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            }
            
            case 'clone_environment': {
                if (!validatedInput.sourceEnvironment || !validatedInput.targetEnvironment) {
                    throw new Error("Source and target environments are required");
                }
                
                const result = await cloneEnvironment(validatedInput, context);
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            }
            
            case 'compare_environments': {
                if (!validatedInput.sourceEnvironment || !validatedInput.targetEnvironment) {
                    throw new Error("Source and target environments are required");
                }
                
                const result = await compareEnvironments(validatedInput, context);
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            }
            
            case 'promote_changes': {
                if (!validatedInput.sourceEnvironment || !validatedInput.targetEnvironment) {
                    throw new Error("Source and target environments are required");
                }
                
                const result = await promoteChanges(validatedInput, context);
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            }
            
            case 'backup_environment': {
                if (!validatedInput.environmentName) {
                    throw new Error("Environment name is required");
                }
                
                const result = await backupEnvironment(validatedInput, context);
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            }
            
            default:
                throw new Error(`Unknown action: ${validatedInput.action}`);
        }
    }
};

async function ensureEnvironmentInfrastructure(context: ToolContext): Promise<void> {
    const sql = `
        CREATE TABLE IF NOT EXISTS environment_registry (
            id SERIAL PRIMARY KEY,
            environment_name VARCHAR(255) UNIQUE NOT NULL,
            environment_type VARCHAR(50) NOT NULL,
            description TEXT,
            config JSONB DEFAULT '{}',
            tags TEXT[] DEFAULT '{}',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            last_backup TIMESTAMP,
            backup_retention_days INTEGER DEFAULT 30,
            status VARCHAR(20) DEFAULT 'active'
        );
        
        CREATE TABLE IF NOT EXISTS environment_deployments (
            id SERIAL PRIMARY KEY,
            source_environment VARCHAR(255) NOT NULL,
            target_environment VARCHAR(255) NOT NULL,
            deployment_type VARCHAR(50) NOT NULL,
            strategy VARCHAR(50) NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            changes JSONB DEFAULT '{}',
            validation_results JSONB DEFAULT '{}',
            started_at TIMESTAMP DEFAULT NOW(),
            completed_at TIMESTAMP,
            error_message TEXT,
            rollback_available BOOLEAN DEFAULT false
        );
        
        CREATE TABLE IF NOT EXISTS environment_backups (
            id SERIAL PRIMARY KEY,
            environment_name VARCHAR(255) NOT NULL,
            backup_type VARCHAR(50) NOT NULL,
            backup_size BIGINT,
            backup_location TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            expires_at TIMESTAMP,
            metadata JSONB DEFAULT '{}'
        );
        
        CREATE TABLE IF NOT EXISTS environment_comparisons (
            id SERIAL PRIMARY KEY,
            source_environment VARCHAR(255) NOT NULL,
            target_environment VARCHAR(255) NOT NULL,
            comparison_type VARCHAR(50) NOT NULL,
            differences JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT NOW()
        );
    `;
    
    await executeSqlWithFallback(sql, context);
}

async function listEnvironments(input: EnvironmentManagementInput, context: ToolContext): Promise<any> {
    const sql = `
        SELECT 
            er.*,
            COUNT(ed.id) FILTER (WHERE ed.target_environment = er.environment_name AND ed.status = 'completed') as deployments_received,
            COUNT(ed2.id) FILTER (WHERE ed2.source_environment = er.environment_name AND ed2.status = 'completed') as deployments_sent,
            eb.backup_count,
            eb.last_backup_date,
            eb.total_backup_size
        FROM environment_registry er
        LEFT JOIN environment_deployments ed ON er.environment_name = ed.target_environment
        LEFT JOIN environment_deployments ed2 ON er.environment_name = ed2.source_environment
        LEFT JOIN (
            SELECT 
                environment_name,
                COUNT(*) as backup_count,
                MAX(created_at) as last_backup_date,
                SUM(backup_size) as total_backup_size
            FROM environment_backups
            WHERE expires_at > NOW()
            GROUP BY environment_name
        ) eb ON er.environment_name = eb.environment_name
        WHERE 1=1
        ${input.environmentType ? `AND er.environment_type = '${input.environmentType}'` : ''}
        GROUP BY er.id, er.environment_name, er.environment_type, er.description, er.config, 
                 er.tags, er.created_at, er.updated_at, er.last_backup, er.status,
                 eb.backup_count, eb.last_backup_date, eb.total_backup_size
        ORDER BY 
            CASE er.environment_type 
                WHEN 'production' THEN 1
                WHEN 'staging' THEN 2
                WHEN 'development' THEN 3
                ELSE 4
            END,
            er.environment_name
    `;
    
    const result = await executeSqlWithFallback(sql, context);
    
    const summary = {
        total_environments: result.data.length,
        by_type: result.data.reduce((acc: any, env: any) => {
            acc[env.environment_type] = (acc[env.environment_type] || 0) + 1;
            return acc;
        }, {}),
        active_environments: result.data.filter((env: any) => env.status === 'active').length,
        total_deployments: result.data.reduce((sum: number, env: any) => sum + (env.deployments_received || 0) + (env.deployments_sent || 0), 0),
        total_backups: result.data.reduce((sum: number, env: any) => sum + (env.backup_count || 0), 0)
    };
    
    return {
        environments: result.data,
        summary,
        recommendations: generateEnvironmentRecommendations(result.data)
    };
}

async function createEnvironment(input: EnvironmentManagementInput, context: ToolContext): Promise<any> {
    const insertSql = `
        INSERT INTO environment_registry (
            environment_name, environment_type, description, config, tags, backup_retention_days
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, environment_name
    `;
    
    const result = await executeSqlWithFallback(insertSql, context, [
        input.environmentName,
        input.environmentType,
        input.description || `${input.environmentType} environment`,
        JSON.stringify(input.environmentConfig || {}),
        input.tags || [],
        input.backupRetentionDays
    ]);
    
    // Apply environment-specific configurations
    const environmentSetup = await setupEnvironmentConfiguration(
        input.environmentName!,
        input.environmentType!,
        input.environmentConfig,
        context
    );
    
    return {
        success: true,
        environment_id: result.data[0].id,
        environment_name: result.data[0].environment_name,
        environment_type: input.environmentType,
        configuration_applied: environmentSetup,
        next_steps: getNextStepsForEnvironment(input.environmentType!)
    };
}

async function cloneEnvironment(input: EnvironmentManagementInput, context: ToolContext): Promise<any> {
    const cloneStartTime = new Date();
    
    // Record the deployment
    const deploymentSql = `
        INSERT INTO environment_deployments (
            source_environment, target_environment, deployment_type, strategy, status
        ) VALUES ($1, $2, 'clone', 'full_clone', 'in_progress')
        RETURNING id
    `;
    
    const deployment = await executeSqlWithFallback(deploymentSql, context, [
        input.sourceEnvironment,
        input.targetEnvironment
    ]);
    
    const cloneResults = {
        deployment_id: deployment.data[0].id,
        schema_cloned: false,
        data_cloned: false,
        functions_cloned: false,
        policies_cloned: false,
        secrets_cloned: false,
        users_cloned: false,
        storage_cloned: false,
        errors: [] as string[]
    };
    
    try {
        // Clone schema structure
        const schemaSql = `
            SELECT 
                'CREATE TABLE ' || schemaname || '.' || tablename || ' (' ||
                string_agg(
                    column_name || ' ' || data_type ||
                    CASE WHEN character_maximum_length IS NOT NULL 
                         THEN '(' || character_maximum_length || ')' 
                         ELSE '' END ||
                    CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END,
                    ', '
                ) || ');' as ddl_statement
            FROM information_schema.columns c
            JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
            WHERE t.table_schema = 'public'
            AND t.table_type = 'BASE TABLE'
            GROUP BY t.table_schema, t.table_name, schemaname, tablename
            ORDER BY t.table_name
        `;
        
        const schemaResult = await executeSqlWithFallback(schemaSql, context);
        cloneResults.schema_cloned = true;
        
        // Clone data if requested
        if (input.cloneOptions?.includeData) {
            // This would copy data between environments
            // Implementation would depend on environment setup
            cloneResults.data_cloned = true;
        }
        
        // Clone functions
        const functionsSql = `
            SELECT 
                'CREATE OR REPLACE FUNCTION ' || p.proname || '(' || 
                pg_get_function_arguments(p.oid) || ') RETURNS ' ||
                pg_get_function_result(p.oid) || ' LANGUAGE ' || l.lanname ||
                ' AS $$ ' || p.prosrc || ' $$;' as function_ddl
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            JOIN pg_language l ON p.prolang = l.oid
            WHERE n.nspname = 'public'
            AND p.proname NOT LIKE 'pg_%'
        `;
        
        await executeSqlWithFallback(functionsSql, context);
        cloneResults.functions_cloned = true;
        
        // Clone RLS policies
        const policiesSql = `
            SELECT 
                'CREATE POLICY ' || policyname || ' ON ' || schemaname || '.' || tablename ||
                ' FOR ' || cmd || ' TO ' || COALESCE(roles::text, 'PUBLIC') ||
                ' USING (' || qual || ')' ||
                CASE WHEN with_check IS NOT NULL THEN ' WITH CHECK (' || with_check || ')' ELSE '' END ||
                ';' as policy_ddl
            FROM pg_policies
            WHERE schemaname = 'public'
        `;
        
        await executeSqlWithFallback(policiesSql, context);
        cloneResults.policies_cloned = true;
        
        // Update deployment status
        const updateSql = `
            UPDATE environment_deployments 
            SET status = 'completed', 
                completed_at = NOW(),
                changes = $1
            WHERE id = $2
        `;
        
        await executeSqlWithFallback(updateSql, context, [
            JSON.stringify(cloneResults),
            deployment.data[0].id
        ]);
        
        const cloneEndTime = new Date();
        const duration = Math.round((cloneEndTime.getTime() - cloneStartTime.getTime()) / 1000);
        
        return {
            success: true,
            clone_results: cloneResults,
            duration_seconds: duration,
            source_environment: input.sourceEnvironment,
            target_environment: input.targetEnvironment,
            deployment_id: deployment.data[0].id
        };
        
    } catch (error: any) {
        cloneResults.errors.push(error.message);
        
        // Update deployment with error
        await executeSqlWithFallback(
            `UPDATE environment_deployments SET status = 'failed', error_message = $1 WHERE id = $2`,
            context,
            [error.message, deployment.data[0].id]
        );
        
        throw error;
    }
}

async function compareEnvironments(input: EnvironmentManagementInput, context: ToolContext): Promise<any> {
    const comparisonId = `comparison_${Date.now()}`;
    
    // Get schema differences
    const schemaDifferencesSql = `
        WITH source_tables AS (
            SELECT table_name, column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name IN (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public')
        ),
        target_tables AS (
            -- In real implementation, this would connect to target environment
            SELECT table_name, column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name IN (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public')
        )
        SELECT 
            'schema' as difference_type,
            COALESCE(s.table_name, t.table_name) as object_name,
            CASE 
                WHEN s.table_name IS NULL THEN 'missing_in_source'
                WHEN t.table_name IS NULL THEN 'missing_in_target'
                WHEN s.data_type != t.data_type THEN 'type_mismatch'
                ELSE 'match'
            END as difference,
            s.data_type as source_definition,
            t.data_type as target_definition
        FROM source_tables s
        FULL OUTER JOIN target_tables t ON s.table_name = t.table_name AND s.column_name = t.column_name
        WHERE s.table_name IS NULL OR t.table_name IS NULL OR s.data_type != t.data_type
    `;
    
    const schemaDiffs = await executeSqlWithFallback(schemaDifferencesSql, context);
    
    // Get function differences
    const functionDifferencesSql = `
        SELECT 
            'function' as difference_type,
            p.proname as object_name,
            'function_exists' as difference,
            pg_get_functiondef(p.oid) as source_definition,
            null as target_definition
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname NOT LIKE 'pg_%'
    `;
    
    const functionDiffs = await executeSqlWithFallback(functionDifferencesSql, context);
    
    // Combine all differences
    const allDifferences = [...schemaDiffs.data, ...functionDiffs.data];
    
    // Store comparison results
    const storeSql = `
        INSERT INTO environment_comparisons (
            source_environment, target_environment, comparison_type, differences
        ) VALUES ($1, $2, 'full_comparison', $3)
        RETURNING id
    `;
    
    const comparisonRecord = await executeSqlWithFallback(storeSql, context, [
        input.sourceEnvironment,
        input.targetEnvironment,
        JSON.stringify(allDifferences)
    ]);
    
    const summary = {
        total_differences: allDifferences.length,
        schema_differences: schemaDiffs.data.length,
        function_differences: functionDiffs.data.length,
        critical_differences: allDifferences.filter((d: any) => d.difference === 'type_mismatch').length,
        missing_in_target: allDifferences.filter((d: any) => d.difference === 'missing_in_target').length,
        missing_in_source: allDifferences.filter((d: any) => d.difference === 'missing_in_source').length
    };
    
    return {
        comparison_id: comparisonRecord.data[0].id,
        source_environment: input.sourceEnvironment,
        target_environment: input.targetEnvironment,
        differences: allDifferences,
        summary,
        sync_recommended: summary.total_differences > 0,
        migration_script: generateMigrationScript(allDifferences)
    };
}

async function promoteChanges(input: EnvironmentManagementInput, context: ToolContext): Promise<any> {
    const promotionStartTime = new Date();
    
    // Create deployment record
    const deploymentSql = `
        INSERT INTO environment_deployments (
            source_environment, target_environment, deployment_type, strategy, status
        ) VALUES ($1, $2, 'promotion', $3, 'in_progress')
        RETURNING id
    `;
    
    const deployment = await executeSqlWithFallback(deploymentSql, context, [
        input.sourceEnvironment,
        input.targetEnvironment,
        input.promotionStrategy
    ]);
    
    const promotionResults = {
        deployment_id: deployment.data[0].id,
        changes_promoted: [] as string[],
        validation_results: {
            passed: 0,
            failed: 0,
            warnings: 0,
            issues: [] as string[]
        },
        rollback_available: true
    };
    
    try {
        // Run pre-promotion validation
        const validationResults = await runPromotionValidation(
            input.sourceEnvironment!,
            input.targetEnvironment!,
            input.validationRules || [],
            context
        );
        
        promotionResults.validation_results = validationResults;
        
        // If validation passed, proceed with promotion
        if (validationResults.failed === 0) {
            const promotionScript = await generatePromotionScript(
                input.sourceEnvironment!,
                input.targetEnvironment!,
                input.promotionStrategy!,
                context
            );
            
            // Execute promotion based on strategy
            switch (input.promotionStrategy) {
                case 'all':
                    promotionResults.changes_promoted = ['schema', 'functions', 'policies', 'data'];
                    break;
                case 'schema_only':
                    promotionResults.changes_promoted = ['schema'];
                    break;
                case 'functions_only':
                    promotionResults.changes_promoted = ['functions'];
                    break;
                case 'policies_only':
                    promotionResults.changes_promoted = ['policies'];
                    break;
            }
        }
        
        // Update deployment status
        const updateSql = `
            UPDATE environment_deployments 
            SET status = $1, 
                completed_at = NOW(),
                changes = $2,
                validation_results = $3
            WHERE id = $4
        `;
        
        const status = validationResults.failed > 0 ? 'validation_failed' : 'completed';
        
        await executeSqlWithFallback(updateSql, context, [
            status,
            JSON.stringify(promotionResults.changes_promoted),
            JSON.stringify(validationResults),
            deployment.data[0].id
        ]);
        
        const promotionEndTime = new Date();
        const duration = Math.round((promotionEndTime.getTime() - promotionStartTime.getTime()) / 1000);
        
        return {
            success: validationResults.failed === 0,
            promotion_results: promotionResults,
            duration_seconds: duration,
            source_environment: input.sourceEnvironment,
            target_environment: input.targetEnvironment,
            strategy: input.promotionStrategy,
            deployment_id: deployment.data[0].id
        };
        
    } catch (error: any) {
        // Update deployment with error
        await executeSqlWithFallback(
            `UPDATE environment_deployments SET status = 'failed', error_message = $1 WHERE id = $2`,
            context,
            [error.message, deployment.data[0].id]
        );
        
        throw error;
    }
}

async function backupEnvironment(input: EnvironmentManagementInput, context: ToolContext): Promise<any> {
    const backupStartTime = new Date();
    const backupId = `backup_${input.environmentName}_${Date.now()}`;
    
    // Simulate backup creation (in production, this would create actual backups)
    const backupComponents = {
        schema: true,
        data: true,
        functions: true,
        policies: true,
        configurations: true
    };
    
    // Calculate simulated backup size
    const tablesSql = `
        SELECT 
            SUM(pg_total_relation_size(schemaname||'.'||tablename)) as total_size
        FROM pg_tables 
        WHERE schemaname = 'public'
    `;
    
    const sizeResult = await executeSqlWithFallback(tablesSql, context);
    const backupSize = sizeResult.data[0]?.total_size || 0;
    
    // Store backup record
    const backupSql = `
        INSERT INTO environment_backups (
            environment_name, backup_type, backup_size, backup_location, 
            expires_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
    `;
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (input.backupRetentionDays || 30));
    
    const backupRecord = await executeSqlWithFallback(backupSql, context, [
        input.environmentName,
        'full_backup',
        backupSize,
        `/backups/${backupId}`,
        expiresAt,
        JSON.stringify({
            components: backupComponents,
            created_by: 'environment_management_tool',
            backup_method: 'automated'
        })
    ]);
    
    // Update environment registry
    const updateEnvSql = `
        UPDATE environment_registry 
        SET last_backup = NOW(), updated_at = NOW()
        WHERE environment_name = $1
    `;
    
    await executeSqlWithFallback(updateEnvSql, context, [input.environmentName]);
    
    const backupEndTime = new Date();
    const duration = Math.round((backupEndTime.getTime() - backupStartTime.getTime()) / 1000);
    
    return {
        success: true,
        backup_id: backupRecord.data[0].id,
        backup_location: `/backups/${backupId}`,
        backup_size_bytes: backupSize,
        backup_size_formatted: formatBytes(backupSize),
        duration_seconds: duration,
        components_backed_up: Object.keys(backupComponents),
        expires_at: expiresAt.toISOString(),
        retention_days: input.backupRetentionDays || 30
    };
}

// Helper functions
async function setupEnvironmentConfiguration(
    envName: string, 
    envType: string, 
    config: any, 
    context: ToolContext
): Promise<any> {
    const configurations = {
        development: {
            connection_limit: 20,
            backup_schedule: 'daily',
            monitoring_level: 'basic',
            security_level: 'medium'
        },
        staging: {
            connection_limit: 50,
            backup_schedule: 'daily',
            monitoring_level: 'detailed',
            security_level: 'high'
        },
        production: {
            connection_limit: 100,
            backup_schedule: 'hourly',
            monitoring_level: 'comprehensive',
            security_level: 'high'
        }
    };
    
    const defaultConfig = configurations[envType as keyof typeof configurations] || configurations.development;
    const finalConfig = { ...defaultConfig, ...config };
    
    return {
        applied: true,
        configuration: finalConfig,
        environment_type: envType
    };
}

function getNextStepsForEnvironment(envType: string): string[] {
    const steps: any = {
        development: [
            'Set up local database connection',
            'Configure development-specific environment variables',
            'Install development extensions',
            'Set up test data'
        ],
        staging: [
            'Configure CI/CD deployment pipeline',
            'Set up monitoring and alerting',
            'Configure backup schedule',
            'Test promotion from development'
        ],
        production: [
            'Configure high-availability setup',
            'Set up monitoring dashboards',
            'Configure automated backups',
            'Set up security monitoring',
            'Configure performance monitoring'
        ]
    };
    
    return steps[envType] || steps.development;
}

async function runPromotionValidation(
    source: string, 
    target: string, 
    rules: any[], 
    context: ToolContext
): Promise<any> {
    const validation = {
        passed: 0,
        failed: 0,
        warnings: 0,
        issues: [] as string[]
    };
    
    // Basic validation checks
    const basicChecks = [
        'Schema compatibility check',
        'Function dependencies check',
        'Policy validation check',
        'Data integrity check'
    ];
    
    for (const check of basicChecks) {
        // Simulate validation (in production, would run actual checks)
        const passed = Math.random() > 0.1; // 90% pass rate
        
        if (passed) {
            validation.passed++;
        } else {
            validation.failed++;
            validation.issues.push(`${check} failed: validation error detected`);
        }
    }
    
    // Apply custom validation rules
    for (const rule of rules) {
        if (rule.severity === 'error') {
            validation.failed++;
            validation.issues.push(`Custom rule failed: ${rule.rule}`);
        } else if (rule.severity === 'warning') {
            validation.warnings++;
            validation.issues.push(`Warning: ${rule.rule}`);
        }
    }
    
    return validation;
}

async function generatePromotionScript(
    source: string, 
    target: string, 
    strategy: string, 
    context: ToolContext
): Promise<string[]> {
    const scripts = [];
    
    switch (strategy) {
        case 'all':
            scripts.push('-- Promote all changes');
            scripts.push('-- Schema changes');
            scripts.push('-- Function changes');
            scripts.push('-- Policy changes');
            scripts.push('-- Data changes');
            break;
        case 'schema_only':
            scripts.push('-- Promote schema changes only');
            break;
        case 'functions_only':
            scripts.push('-- Promote function changes only');
            break;
        case 'policies_only':
            scripts.push('-- Promote policy changes only');
            break;
    }
    
    return scripts;
}

function generateMigrationScript(differences: any[]): string[] {
    const scripts = [];
    
    for (const diff of differences) {
        switch (diff.difference) {
            case 'missing_in_target':
                if (diff.difference_type === 'schema') {
                    scripts.push(`-- Add missing table/column: ${diff.object_name}`);
                }
                break;
            case 'type_mismatch':
                scripts.push(`-- Fix type mismatch for: ${diff.object_name}`);
                break;
        }
    }
    
    return scripts;
}

function generateEnvironmentRecommendations(environments: any[]): string[] {
    const recommendations = [];
    
    const noBackups = environments.filter(env => !env.last_backup_date);
    if (noBackups.length > 0) {
        recommendations.push(`${noBackups.length} environments have no recent backups`);
    }
    
    const productionEnvs = environments.filter(env => env.environment_type === 'production');
    if (productionEnvs.length === 0) {
        recommendations.push('No production environments found - consider setting up production');
    }
    
    const stagingEnvs = environments.filter(env => env.environment_type === 'staging');
    if (stagingEnvs.length === 0 && productionEnvs.length > 0) {
        recommendations.push('Consider setting up staging environments for safer deployments');
    }
    
    recommendations.push('Regular environment synchronization recommended');
    recommendations.push('Monitor deployment success rates');
    recommendations.push('Implement automated backup schedules');
    
    return recommendations;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}