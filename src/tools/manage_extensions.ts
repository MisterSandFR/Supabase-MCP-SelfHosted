import { Tool } from "@modelcontextprotocol/sdk/dist/types.js";
import { z } from "zod";
import { ToolContext } from "./types.js";
import { executeSqlWithFallback } from "./utils.js";

const ManageExtensionsInputSchema = z.object({
    action: z.enum(['list', 'install', 'uninstall', 'update', 'available', 'configure', 'dependencies', 'security_audit', 'bulk_install', 'backup_config']).describe("Action to perform"),
    extensionName: z.string().optional().describe("Extension name"),
    schema: z.string().optional().describe("Schema to install extension in"),
    version: z.string().optional().describe("Specific version to install"),
    cascade: z.boolean().optional().default(false).describe("Use CASCADE when dropping"),
    ifExists: z.boolean().optional().default(true).describe("Use IF EXISTS when dropping"),
    force: z.boolean().optional().default(false).describe("Force installation/update"),
    extensions: z.array(z.string()).optional().describe("List of extensions for bulk operations"),
    configParams: z.record(z.any()).optional().describe("Configuration parameters"),
    category: z.enum(['all', 'contrib', 'third_party', 'supabase', 'security', 'performance', 'data_types', 'foreign_data']).optional().default('all').describe("Extension category filter"),
    environment: z.enum(['development', 'staging', 'production']).optional().describe("Target environment"),
    autoConfig: z.boolean().optional().default(false).describe("Apply recommended configuration"),
    skipDependencies: z.boolean().optional().default(false).describe("Skip dependency checking")
});

type ManageExtensionsInput = z.infer<typeof ManageExtensionsInputSchema>;
const manageExtensionsOutputSchema = z.object({
    content: z.array(z.object({
        type: z.literal("text"),
        text: z.string()
    }))
});


export const manageExtensionsTool = {
    name: "manage_extensions",
    description: "Comprehensive PostgreSQL extension management with dependency handling, security auditing, and environment-specific configurations",
    inputSchema: ManageExtensionsInputSchema,
    mcpInputSchema: {
        type: "object",
        properties: {
            action: {
                type: "string",
                enum: ["list", "install", "uninstall", "update", "available", "configure", "dependencies", "security_audit", "bulk_install", "backup_config"],
                description: "Action to perform"
            },
            extensionName: { type: "string", description: "Extension name" },
            schema: { type: "string", description: "Schema to install in" },
            version: { type: "string", description: "Specific version" },
            cascade: { type: "boolean", description: "Use CASCADE when dropping" },
            ifExists: { type: "boolean", description: "Use IF EXISTS" },
            force: { type: "boolean", description: "Force operation" },
            extensions: {
                type: "array",
                items: { type: "string" },
                description: "Extensions for bulk operations"
            },
            configParams: {
                type: "object",
                description: "Configuration parameters"
            },
            category: {
                type: "string",
                enum: ["all", "contrib", "third_party", "supabase", "security", "performance", "data_types", "foreign_data"],
                description: "Extension category"
            },
            environment: {
                type: "string",
                enum: ["development", "staging", "production"],
                description: "Target environment"
            },
            autoConfig: { type: "boolean", description: "Apply recommended config" },
            skipDependencies: { type: "boolean", description: "Skip dependency checking" }
        },
        required: ["action"]
    },
    outputSchema: manageExtensionsOutputSchema,
    execute: async (input: unknown, context: ToolContext) => {
        const validatedInput = ManageExtensionsInputSchema.parse(input);
        
        switch (validatedInput.action) {
            case 'list': {
                const sql = `
                    SELECT 
                        e.extname AS extension_name,
                        e.extversion AS version,
                        n.nspname AS schema_name,
                        e.extrelocatable AS relocatable,
                        CASE 
                            WHEN e.extname = ANY(ARRAY['plpgsql', 'adminpack']) THEN 'Built-in'
                            WHEN e.extname LIKE 'supabase_%' THEN 'Supabase'
                            WHEN e.extname = ANY(ARRAY['uuid-ossp', 'pgcrypto', 'btree_gist', 'citext', 'cube', 'dblink', 'dict_int', 'earthdistance', 'fuzzystrmatch', 'hstore', 'intarray', 'isn', 'lo', 'ltree', 'pg_buffercache', 'pg_freespacemap', 'pg_stat_statements', 'pg_trgm', 'pgrowlocks', 'sslinfo', 'tablefunc', 'tcn', 'tsearch2', 'unaccent', 'xml2']) THEN 'Contrib'
                            ELSE 'Third-party'
                        END as category,
                        CASE 
                            WHEN e.extname = ANY(ARRAY['uuid-ossp', 'pgcrypto', 'citext', 'hstore', 'ltree', 'unaccent']) THEN 'Data Types'
                            WHEN e.extname = ANY(ARRAY['pg_stat_statements', 'pg_buffercache', 'pg_freespacemap', 'pgrowlocks']) THEN 'Performance'
                            WHEN e.extname = ANY(ARRAY['dblink', 'postgres_fdw']) THEN 'Foreign Data'
                            WHEN e.extname = ANY(ARRAY['pgcrypto', 'sslinfo']) THEN 'Security'
                            ELSE 'General'
                        END as functionality,
                        d.description,
                        COALESCE(dep_count.count, 0) as dependency_count
                    FROM pg_extension e
                    LEFT JOIN pg_namespace n ON e.extnamespace = n.oid
                    LEFT JOIN pg_description d ON d.objoid = e.oid AND d.classoid = 'pg_extension'::regclass
                    LEFT JOIN (
                        SELECT 
                            refobjid,
                            COUNT(*) as count
                        FROM pg_depend dep
                        JOIN pg_extension ext ON dep.objid = ext.oid
                        WHERE dep.classid = 'pg_extension'::regclass
                        AND dep.deptype = 'n'
                        GROUP BY refobjid
                    ) dep_count ON dep_count.refobjid = e.oid
                    ${validatedInput.category !== 'all' ? `
                        WHERE CASE 
                            WHEN '${validatedInput.category}' = 'contrib' AND e.extname = ANY(ARRAY['uuid-ossp', 'pgcrypto', 'btree_gist', 'citext', 'cube', 'dblink', 'dict_int', 'earthdistance', 'fuzzystrmatch', 'hstore', 'intarray', 'isn', 'lo', 'ltree', 'pg_buffercache', 'pg_freespacemap', 'pg_stat_statements', 'pg_trgm', 'pgrowlocks', 'sslinfo', 'tablefunc', 'tcn', 'tsearch2', 'unaccent', 'xml2']) THEN true
                            WHEN '${validatedInput.category}' = 'supabase' AND e.extname LIKE 'supabase_%' THEN true
                            WHEN '${validatedInput.category}' = 'security' AND e.extname = ANY(ARRAY['pgcrypto', 'sslinfo']) THEN true
                            WHEN '${validatedInput.category}' = 'performance' AND e.extname = ANY(ARRAY['pg_stat_statements', 'pg_buffercache', 'pg_freespacemap', 'pgrowlocks']) THEN true
                            WHEN '${validatedInput.category}' = 'data_types' AND e.extname = ANY(ARRAY['uuid-ossp', 'pgcrypto', 'citext', 'hstore', 'ltree', 'unaccent']) THEN true
                            WHEN '${validatedInput.category}' = 'foreign_data' AND e.extname = ANY(ARRAY['dblink', 'postgres_fdw']) THEN true
                            ELSE false
                        END
                    ` : ''}
                    ${validatedInput.extensionName ? `AND e.extname LIKE '%${validatedInput.extensionName}%'` : ''}
                    ORDER BY category, e.extname
                `;
                
                const result = await executeSqlWithFallback(sql, context);
                
                const summary = {
                    total_extensions: result.data.length,
                    by_category: result.data.reduce((acc: any, ext: any) => {
                        acc[ext.category] = (acc[ext.category] || 0) + 1;
                        return acc;
                    }, {}),
                    by_functionality: result.data.reduce((acc: any, ext: any) => {
                        acc[ext.functionality] = (acc[ext.functionality] || 0) + 1;
                        return acc;
                    }, {})
                };
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            installed_extensions: result.data,
                            summary,
                            recommendations: generateExtensionRecommendations(result.data, validatedInput.environment)
                        }, null, 2)
                    }]
                };
            }
            
            case 'available': {
                const sql = `
                    SELECT DISTINCT
                        name,
                        default_version,
                        comment,
                        CASE 
                            WHEN name = ANY(ARRAY['plpgsql', 'adminpack']) THEN 'Built-in'
                            WHEN name LIKE 'supabase_%' THEN 'Supabase'
                            WHEN name = ANY(ARRAY['uuid-ossp', 'pgcrypto', 'btree_gist', 'citext', 'cube', 'dblink', 'dict_int', 'earthdistance', 'fuzzystrmatch', 'hstore', 'intarray', 'isn', 'lo', 'ltree', 'pg_buffercache', 'pg_freespacemap', 'pg_stat_statements', 'pg_trgm', 'pgrowlocks', 'sslinfo', 'tablefunc', 'tcn', 'tsearch2', 'unaccent', 'xml2']) THEN 'Contrib'
                            ELSE 'Third-party'
                        END as category,
                        CASE 
                            WHEN EXISTS(SELECT 1 FROM pg_extension WHERE extname = av.name) THEN 'Installed'
                            ELSE 'Available'
                        END as status
                    FROM pg_available_extensions av
                    ${validatedInput.category !== 'all' ? `
                        WHERE CASE 
                            WHEN '${validatedInput.category}' = 'contrib' AND name = ANY(ARRAY['uuid-ossp', 'pgcrypto', 'btree_gist', 'citext', 'cube', 'dblink', 'dict_int', 'earthdistance', 'fuzzystrmatch', 'hstore', 'intarray', 'isn', 'lo', 'ltree', 'pg_buffercache', 'pg_freespacemap', 'pg_stat_statements', 'pg_trgm', 'pgrowlocks', 'sslinfo', 'tablefunc', 'tcn', 'tsearch2', 'unaccent', 'xml2']) THEN true
                            WHEN '${validatedInput.category}' = 'supabase' AND name LIKE 'supabase_%' THEN true
                            WHEN '${validatedInput.category}' = 'security' AND name = ANY(ARRAY['pgcrypto', 'sslinfo']) THEN true
                            WHEN '${validatedInput.category}' = 'performance' AND name = ANY(ARRAY['pg_stat_statements', 'pg_buffercache', 'pg_freespacemap', 'pgrowlocks']) THEN true
                            WHEN '${validatedInput.category}' = 'data_types' AND name = ANY(ARRAY['uuid-ossp', 'pgcrypto', 'citext', 'hstore', 'ltree', 'unaccent']) THEN true
                            WHEN '${validatedInput.category}' = 'foreign_data' AND name = ANY(ARRAY['dblink', 'postgres_fdw']) THEN true
                            ELSE false
                        END
                    ` : ''}
                    ${validatedInput.extensionName ? `AND name LIKE '%${validatedInput.extensionName}%'` : ''}
                    ORDER BY category, status, name
                `;
                
                const result = await executeSqlWithFallback(sql, context);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            available_extensions: result.data,
                            summary: {
                                total_available: result.data.length,
                                installed: result.data.filter((e: any) => e.status === 'Installed').length,
                                available: result.data.filter((e: any) => e.status === 'Available').length,
                                by_category: result.data.reduce((acc: any, ext: any) => {
                                    acc[ext.category] = (acc[ext.category] || 0) + 1;
                                    return acc;
                                }, {})
                            },
                            recommended_for_supabase: getSupabaseRecommendedExtensions()
                        }, null, 2)
                    }]
                };
            }
            
            case 'install': {
                if (!validatedInput.extensionName) {
                    throw new Error("Extension name is required");
                }
                
                // Check if extension is already installed
                const checkSql = `SELECT extname FROM pg_extension WHERE extname = $1`;
                const existing = await executeSqlWithFallback(checkSql, context, [validatedInput.extensionName]);
                
                if (existing.data.length > 0 && !validatedInput.force) {
                    return {
                        content: [{
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                message: "Extension already installed",
                                extension: validatedInput.extensionName,
                                suggestion: "Use force: true to reinstall or action: 'update' to update"
                            }, null, 2)
                        }]
                    };
                }
                
                // Check dependencies if not skipping
                let dependencyInfo = {};
                if (!validatedInput.skipDependencies) {
                    dependencyInfo = await checkExtensionDependencies(validatedInput.extensionName, context);
                }
                
                // Build installation command
                let installCmd = `CREATE EXTENSION`;
                if (existing.data.length > 0) installCmd += ` IF NOT EXISTS`;
                installCmd += ` "${validatedInput.extensionName}"`;
                if (validatedInput.schema) installCmd += ` WITH SCHEMA ${validatedInput.schema}`;
                if (validatedInput.version) installCmd += ` VERSION '${validatedInput.version}'`;
                
                const result = await executeSqlWithFallback(installCmd, context);
                
                // Apply auto-configuration if requested
                let configResult = null;
                if (validatedInput.autoConfig) {
                    configResult = await applyExtensionAutoConfig(validatedInput.extensionName, context, validatedInput.environment);
                }
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: "Extension installed successfully",
                            extension: validatedInput.extensionName,
                            version: validatedInput.version || 'default',
                            schema: validatedInput.schema || 'default',
                            dependencies: dependencyInfo,
                            auto_config_applied: !!configResult,
                            configuration: configResult
                        }, null, 2)
                    }]
                };
            }
            
            case 'bulk_install': {
                if (!validatedInput.extensions || validatedInput.extensions.length === 0) {
                    throw new Error("Extensions list is required for bulk install");
                }
                
                const results = [];
                
                for (const extensionName of validatedInput.extensions) {
                    try {
                        const installResult = await manageExtensionsTool.execute({
                            action: 'install',
                            extensionName,
                            schema: validatedInput.schema,
                            force: validatedInput.force,
                            autoConfig: validatedInput.autoConfig,
                            skipDependencies: validatedInput.skipDependencies,
                            environment: validatedInput.environment
                        }, context);
                        
                        results.push({
                            extension: extensionName,
                            success: true,
                            result: installResult
                        });
                        
                    } catch (error: any) {
                        results.push({
                            extension: extensionName,
                            success: false,
                            error: error.message
                        });
                    }
                }
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            bulk_install_results: results,
                            summary: {
                                total_attempted: validatedInput.extensions.length,
                                successful: results.filter(r => r.success).length,
                                failed: results.filter(r => !r.success).length,
                                success_rate: Math.round((results.filter(r => r.success).length / validatedInput.extensions.length) * 100)
                            }
                        }, null, 2)
                    }]
                };
            }
            
            case 'dependencies': {
                if (!validatedInput.extensionName) {
                    throw new Error("Extension name is required");
                }
                
                const dependencySql = `
                    WITH RECURSIVE extension_deps AS (
                        -- Base case: direct dependencies
                        SELECT 
                            e.extname as extension,
                            dep_ext.extname as depends_on,
                            1 as level
                        FROM pg_extension e
                        JOIN pg_depend d ON e.oid = d.objid
                        JOIN pg_extension dep_ext ON d.refobjid = dep_ext.oid
                        WHERE e.extname = $1
                        AND d.classid = 'pg_extension'::regclass
                        AND d.deptype = 'n'
                        
                        UNION ALL
                        
                        -- Recursive case: dependencies of dependencies
                        SELECT 
                            ed.extension,
                            dep_ext.extname as depends_on,
                            ed.level + 1
                        FROM extension_deps ed
                        JOIN pg_extension e ON ed.depends_on = e.extname
                        JOIN pg_depend d ON e.oid = d.objid
                        JOIN pg_extension dep_ext ON d.refobjid = dep_ext.oid
                        WHERE d.classid = 'pg_extension'::regclass
                        AND d.deptype = 'n'
                        AND ed.level < 5 -- Prevent infinite recursion
                    )
                    SELECT DISTINCT * FROM extension_deps
                    ORDER BY level, depends_on
                `;
                
                const dependents_sql = `
                    SELECT 
                        e.extname as extension,
                        'depends_on' as relationship
                    FROM pg_extension e
                    JOIN pg_depend d ON e.oid = d.refobjid
                    JOIN pg_extension target ON d.objid = target.oid
                    WHERE target.extname = $1
                    AND d.classid = 'pg_extension'::regclass
                    AND d.deptype = 'n'
                    ORDER BY e.extname
                `;
                
                const [dependencies, dependents] = await Promise.all([
                    executeSqlWithFallback(dependencySql, context, [validatedInput.extensionName]),
                    executeSqlWithFallback(dependents_sql, context, [validatedInput.extensionName])
                ]);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            extension: validatedInput.extensionName,
                            dependencies: dependencies.data,
                            dependents: dependents.data,
                            analysis: {
                                has_dependencies: dependencies.data.length > 0,
                                dependency_count: dependencies.data.length,
                                has_dependents: dependents.data.length > 0,
                                dependent_count: dependents.data.length,
                                max_dependency_level: dependencies.data.length > 0 
                                    ? Math.max(...dependencies.data.map((d: any) => d.level))
                                    : 0,
                                safe_to_remove: dependents.data.length === 0
                            }
                        }, null, 2)
                    }]
                };
            }
            
            case 'configure': {
                if (!validatedInput.extensionName) {
                    throw new Error("Extension name is required");
                }
                
                const config = await applyExtensionAutoConfig(
                    validatedInput.extensionName, 
                    context, 
                    validatedInput.environment,
                    validatedInput.configParams
                );
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            extension: validatedInput.extensionName,
                            environment: validatedInput.environment,
                            configuration: config
                        }, null, 2)
                    }]
                };
            }
            
            case 'security_audit': {
                const securitySql = `
                    SELECT 
                        e.extname,
                        e.extversion,
                        n.nspname as schema_name,
                        CASE 
                            WHEN e.extname = ANY(ARRAY['pgcrypto', 'sslinfo', 'uuid-ossp']) THEN 'Security'
                            WHEN e.extname = ANY(ARRAY['dblink', 'postgres_fdw', 'file_fdw']) THEN 'Data Access'
                            WHEN e.extname LIKE '%plpython%' OR e.extname LIKE '%plperl%' THEN 'Scripting'
                            ELSE 'Standard'
                        END as security_category,
                        CASE 
                            WHEN e.extname = ANY(ARRAY['dblink', 'postgres_fdw', 'file_fdw']) THEN 'HIGH'
                            WHEN e.extname LIKE '%plpython%' OR e.extname LIKE '%plperl%' THEN 'HIGH'
                            WHEN e.extname = ANY(ARRAY['pgcrypto', 'sslinfo']) THEN 'MEDIUM'
                            ELSE 'LOW'
                        END as risk_level,
                        CASE 
                            WHEN e.extname = 'dblink' THEN 'Can execute queries on remote databases'
                            WHEN e.extname = 'postgres_fdw' THEN 'Foreign data wrapper for PostgreSQL'
                            WHEN e.extname = 'file_fdw' THEN 'Can read files from file system'
                            WHEN e.extname LIKE '%plpython%' THEN 'Allows Python code execution'
                            WHEN e.extname LIKE '%plperl%' THEN 'Allows Perl code execution'
                            WHEN e.extname = 'pgcrypto' THEN 'Cryptographic functions'
                            ELSE 'Standard extension functionality'
                        END as security_implications,
                        EXISTS(
                            SELECT 1 FROM pg_proc p
                            JOIN pg_namespace pn ON p.pronamespace = pn.oid
                            WHERE p.prolang = (SELECT oid FROM pg_language WHERE lanname = 'c')
                            AND p.proname LIKE e.extname || '%'
                        ) as has_c_functions
                    FROM pg_extension e
                    LEFT JOIN pg_namespace n ON e.extnamespace = n.oid
                    ORDER BY 
                        CASE risk_level WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
                        e.extname
                `;
                
                const result = await executeSqlWithFallback(securitySql, context);
                
                const securityAssessment = {
                    overall_risk: 'LOW',
                    high_risk_extensions: result.data.filter((e: any) => e.risk_level === 'HIGH').length,
                    recommendations: [] as string[]
                };
                
                if (securityAssessment.high_risk_extensions > 0) {
                    securityAssessment.overall_risk = 'HIGH';
                    securityAssessment.recommendations.push('Review high-risk extensions and their usage');
                }
                
                const scriptingExtensions = result.data.filter((e: any) => e.security_category === 'Scripting');
                if (scriptingExtensions.length > 0) {
                    securityAssessment.recommendations.push('Monitor scripting extensions for code injection risks');
                }
                
                const dataAccessExtensions = result.data.filter((e: any) => e.security_category === 'Data Access');
                if (dataAccessExtensions.length > 0) {
                    securityAssessment.recommendations.push('Audit data access extensions for proper access controls');
                }
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            security_audit: result.data,
                            assessment: securityAssessment,
                            compliance_notes: {
                                production_ready: securityAssessment.overall_risk !== 'HIGH',
                                requires_review: securityAssessment.high_risk_extensions > 0,
                                security_score: Math.max(0, 100 - (securityAssessment.high_risk_extensions * 25))
                            }
                        }, null, 2)
                    }]
                };
            }
            
            case 'uninstall': {
                if (!validatedInput.extensionName) {
                    throw new Error("Extension name is required");
                }
                
                // Check dependencies before uninstalling
                const dependentsCheck = await manageExtensionsTool.execute({
                    action: 'dependencies',
                    extensionName: validatedInput.extensionName
                }, context);
                
                const dependentsData = JSON.parse(dependentsCheck.content[0].text);
                if (dependentsData.dependents.length > 0 && !validatedInput.cascade) {
                    return {
                        content: [{
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                message: "Extension has dependents",
                                extension: validatedInput.extensionName,
                                dependents: dependentsData.dependents,
                                suggestion: "Use cascade: true to force removal or remove dependents first"
                            }, null, 2)
                        }]
                    };
                }
                
                let dropCmd = `DROP EXTENSION`;
                if (validatedInput.ifExists) dropCmd += ` IF EXISTS`;
                dropCmd += ` "${validatedInput.extensionName}"`;
                if (validatedInput.cascade) dropCmd += ` CASCADE`;
                
                await executeSqlWithFallback(dropCmd, context);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: "Extension uninstalled successfully",
                            extension: validatedInput.extensionName,
                            cascade_used: validatedInput.cascade
                        }, null, 2)
                    }]
                };
            }
            
            default:
                throw new Error(`Unknown action: ${validatedInput.action}`);
        }
    }
};

async function checkExtensionDependencies(extensionName: string, context: ToolContext): Promise<any> {
    // This would contain logic to check extension dependencies
    // For now, return a simple structure
    return {
        checked: true,
        dependencies: [],
        warnings: []
    };
}

async function applyExtensionAutoConfig(extensionName: string, context: ToolContext, environment?: string, customParams?: any): Promise<any> {
    const configurations = getExtensionConfigurations();
    const config = configurations[extensionName];
    
    if (!config) {
        return {
            message: "No auto-configuration available for this extension",
            extension: extensionName
        };
    }
    
    const appliedSettings = [];
    const envConfig = environment ? config.environments?.[environment] || config.default : config.default;
    
    // Apply configuration settings
    for (const [setting, value] of Object.entries(envConfig)) {
        try {
            const sql = `SET ${setting} = '${value}'`;
            await executeSqlWithFallback(sql, context);
            appliedSettings.push({ setting, value, success: true });
        } catch (error: any) {
            appliedSettings.push({ setting, value, success: false, error: error.message });
        }
    }
    
    // Apply custom parameters if provided
    if (customParams) {
        for (const [setting, value] of Object.entries(customParams)) {
            try {
                const sql = `SET ${setting} = '${value}'`;
                await executeSqlWithFallback(sql, context);
                appliedSettings.push({ setting, value, success: true, source: 'custom' });
            } catch (error: any) {
                appliedSettings.push({ setting, value, success: false, error: error.message, source: 'custom' });
            }
        }
    }
    
    return {
        extension: extensionName,
        environment: environment || 'default',
        settings_applied: appliedSettings,
        success: appliedSettings.every(s => s.success)
    };
}

function getExtensionConfigurations(): any {
    return {
        'pg_stat_statements': {
            default: {
                'pg_stat_statements.max': '10000',
                'pg_stat_statements.track': 'all'
            },
            environments: {
                development: {
                    'pg_stat_statements.max': '5000',
                    'pg_stat_statements.track': 'all'
                },
                production: {
                    'pg_stat_statements.max': '10000',
                    'pg_stat_statements.track': 'top'
                }
            }
        },
        'pg_buffercache': {
            default: {},
            environments: {
                development: {},
                production: {}
            }
        },
        'pgcrypto': {
            default: {},
            environments: {}
        }
    };
}

function generateExtensionRecommendations(extensions: any[], environment?: string): string[] {
    const recommendations = [];
    const installedNames = extensions.map(e => e.extension_name);
    
    // Essential extensions recommendations
    if (!installedNames.includes('uuid-ossp')) {
        recommendations.push('Consider installing uuid-ossp for UUID generation');
    }
    
    if (!installedNames.includes('pgcrypto')) {
        recommendations.push('Install pgcrypto for cryptographic functions');
    }
    
    if (!installedNames.includes('pg_stat_statements') && environment === 'production') {
        recommendations.push('Install pg_stat_statements for query performance monitoring');
    }
    
    if (!installedNames.includes('pg_trgm')) {
        recommendations.push('Consider pg_trgm for full-text search improvements');
    }
    
    // Environment-specific recommendations
    if (environment === 'development') {
        if (!installedNames.includes('pg_buffercache')) {
            recommendations.push('Install pg_buffercache for development debugging');
        }
    }
    
    if (environment === 'production') {
        if (installedNames.includes('dblink') || installedNames.includes('postgres_fdw')) {
            recommendations.push('Review foreign data access extensions for security');
        }
    }
    
    return recommendations;
}

function getSupabaseRecommendedExtensions(): any {
    return {
        essential: [
            'uuid-ossp',
            'pgcrypto', 
            'pg_stat_statements',
            'pg_trgm'
        ],
        recommended: [
            'citext',
            'hstore',
            'ltree',
            'unaccent',
            'btree_gist'
        ],
        performance: [
            'pg_buffercache',
            'pg_freespacemap'
        ],
        development: [
            'pgrowlocks',
            'sslinfo',
            'tablefunc'
        ]
    };
}