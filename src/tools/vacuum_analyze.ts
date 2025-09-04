import { Tool } from "@modelcontextprotocol/sdk/dist/types.js";
import { z } from "zod";
import { ToolContext } from "./types.js";
import { executeSqlWithFallback } from "./utils.js";

const VacuumAnalyzeInputSchema = z.object({
    action: z.enum(['vacuum', 'analyze', 'reindex', 'vacuum_analyze', 'auto_vacuum', 'vacuum_full', 'cluster', 'maintenance_plan', 'bloat_check', 'stats_analysis']).describe("Maintenance action to perform"),
    tableName: z.string().optional().describe("Specific table name"),
    schemaName: z.string().optional().default('public').describe("Schema name"),
    indexName: z.string().optional().describe("Specific index name for reindex"),
    verbose: z.boolean().optional().default(false).describe("Verbose output"),
    analyze: z.boolean().optional().default(false).describe("Run ANALYZE with VACUUM"),
    full: z.boolean().optional().default(false).describe("Run VACUUM FULL"),
    freeze: z.boolean().optional().default(false).describe("Run VACUUM FREEZE"),
    parallel: z.number().optional().describe("Parallel workers for maintenance"),
    bufferUsageLimit: z.string().optional().describe("Buffer usage limit (e.g., '256MB')"),
    maintenance_work_mem: z.string().optional().describe("Maintenance work memory"),
    autoMode: z.boolean().optional().default(false).describe("Auto-detect tables needing maintenance"),
    bloatThreshold: z.number().optional().default(20).describe("Bloat percentage threshold"),
    minSize: z.string().optional().default('100MB').describe("Minimum table size for consideration"),
    schedule: z.boolean().optional().default(false).describe("Create maintenance schedule"),
    dryRun: z.boolean().optional().default(false).describe("Show what would be done without executing"),
    excludeTables: z.array(z.string()).optional().describe("Tables to exclude from maintenance"),
    includeTables: z.array(z.string()).optional().describe("Tables to include (if specified, only these)"),
    maxDuration: z.string().optional().default('2 hours').describe("Maximum maintenance duration"),
    maintenanceWindow: z.string().optional().describe("Maintenance window (e.g., '02:00-04:00')"),
    priority: z.enum(['low', 'normal', 'high', 'critical']).optional().default('normal').describe("Maintenance priority")
});

type VacuumAnalyzeInput = z.infer<typeof VacuumAnalyzeInputSchema>;

export const vacuumAnalyzeTool: Tool = {
    name: "vacuum_analyze",
    description: "Comprehensive database maintenance tool for VACUUM, ANALYZE, REINDEX with intelligent automation, bloat detection, and scheduled maintenance",
    inputSchema: {
        type: "object",
        properties: {
            action: {
                type: "string",
                enum: ["vacuum", "analyze", "reindex", "vacuum_analyze", "auto_vacuum", "vacuum_full", "cluster", "maintenance_plan", "bloat_check", "stats_analysis"],
                description: "Maintenance action to perform"
            },
            tableName: { type: "string", description: "Specific table name" },
            schemaName: { type: "string", description: "Schema name" },
            indexName: { type: "string", description: "Specific index name" },
            verbose: { type: "boolean", description: "Verbose output" },
            analyze: { type: "boolean", description: "Run ANALYZE with VACUUM" },
            full: { type: "boolean", description: "Run VACUUM FULL" },
            freeze: { type: "boolean", description: "Run VACUUM FREEZE" },
            parallel: { type: "number", description: "Parallel workers" },
            bufferUsageLimit: { type: "string", description: "Buffer usage limit" },
            maintenance_work_mem: { type: "string", description: "Maintenance work memory" },
            autoMode: { type: "boolean", description: "Auto-detect maintenance needs" },
            bloatThreshold: { type: "number", description: "Bloat threshold percentage" },
            minSize: { type: "string", description: "Minimum table size" },
            schedule: { type: "boolean", description: "Create maintenance schedule" },
            dryRun: { type: "boolean", description: "Dry run mode" },
            excludeTables: {
                type: "array",
                items: { type: "string" },
                description: "Tables to exclude"
            },
            includeTables: {
                type: "array",
                items: { type: "string" },
                description: "Tables to include"
            },
            maxDuration: { type: "string", description: "Maximum duration" },
            maintenanceWindow: { type: "string", description: "Maintenance window" },
            priority: {
                type: "string",
                enum: ["low", "normal", "high", "critical"],
                description: "Maintenance priority"
            }
        },
        required: ["action"]
    },
    execute: async (input: unknown, context: ToolContext) => {
        const validatedInput = VacuumAnalyzeInputSchema.parse(input);
        
        switch (validatedInput.action) {
            case 'bloat_check': {
                const bloatCheckSql = `
                    WITH table_stats AS (
                        SELECT 
                            schemaname,
                            tablename,
                            n_tup_ins,
                            n_tup_upd,
                            n_tup_del,
                            n_live_tup,
                            n_dead_tup,
                            last_vacuum,
                            last_autovacuum,
                            last_analyze,
                            last_autoanalyze
                        FROM pg_stat_user_tables
                        WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
                        ${validatedInput.schemaName ? `AND schemaname = '${validatedInput.schemaName}'` : ''}
                        ${validatedInput.tableName ? `AND tablename LIKE '%${validatedInput.tableName}%'` : ''}
                    ),
                    table_sizes AS (
                        SELECT 
                            schemaname,
                            tablename,
                            pg_total_relation_size(schemaname||'.'||tablename) as total_bytes,
                            pg_relation_size(schemaname||'.'||tablename) as table_bytes,
                            pg_indexes_size(schemaname||'.'||tablename) as index_bytes
                        FROM pg_stat_user_tables
                        WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
                    ),
                    bloat_estimate AS (
                        SELECT 
                            ts.schemaname,
                            ts.tablename,
                            ts.n_live_tup,
                            ts.n_dead_tup,
                            CASE 
                                WHEN ts.n_live_tup + ts.n_dead_tup = 0 THEN 0
                                ELSE ROUND((ts.n_dead_tup * 100.0) / (ts.n_live_tup + ts.n_dead_tup), 2)
                            END AS bloat_percentage,
                            sizes.total_bytes,
                            sizes.table_bytes,
                            sizes.index_bytes,
                            pg_size_pretty(sizes.total_bytes) as total_size,
                            pg_size_pretty(sizes.table_bytes) as table_size,
                            pg_size_pretty(sizes.index_bytes) as index_size,
                            ts.last_vacuum,
                            ts.last_autovacuum,
                            ts.last_analyze,
                            ts.last_autoanalyze,
                            GREATEST(ts.last_vacuum, ts.last_autovacuum) as last_vacuum_any,
                            GREATEST(ts.last_analyze, ts.last_autoanalyze) as last_analyze_any
                        FROM table_stats ts
                        JOIN table_sizes sizes USING (schemaname, tablename)
                    )
                    SELECT 
                        *,
                        CASE 
                            WHEN bloat_percentage >= 50 THEN 'CRITICAL'
                            WHEN bloat_percentage >= 30 THEN 'HIGH'
                            WHEN bloat_percentage >= 15 THEN 'MEDIUM'
                            WHEN bloat_percentage >= 5 THEN 'LOW'
                            ELSE 'MINIMAL'
                        END as bloat_severity,
                        CASE 
                            WHEN last_vacuum_any IS NULL THEN 'NEVER'
                            WHEN last_vacuum_any < NOW() - INTERVAL '7 days' THEN 'OVERDUE'
                            WHEN last_vacuum_any < NOW() - INTERVAL '3 days' THEN 'DUE'
                            ELSE 'RECENT'
                        END as vacuum_status,
                        CASE 
                            WHEN last_analyze_any IS NULL THEN 'NEVER'
                            WHEN last_analyze_any < NOW() - INTERVAL '7 days' THEN 'OVERDUE'
                            WHEN last_analyze_any < NOW() - INTERVAL '3 days' THEN 'DUE'
                            ELSE 'RECENT'
                        END as analyze_status,
                        CASE
                            WHEN bloat_percentage >= ${validatedInput.bloatThreshold} OR last_vacuum_any < NOW() - INTERVAL '7 days' THEN true
                            ELSE false
                        END as needs_maintenance
                    FROM bloat_estimate
                    WHERE total_bytes >= pg_size_bytes('${validatedInput.minSize}')
                    ORDER BY bloat_percentage DESC, total_bytes DESC
                `;
                
                const result = await executeSqlWithFallback(bloatCheckSql, context);
                
                const summary = {
                    total_tables: result.data.length,
                    tables_needing_maintenance: result.data.filter((t: any) => t.needs_maintenance).length,
                    bloat_severity: {
                        critical: result.data.filter((t: any) => t.bloat_severity === 'CRITICAL').length,
                        high: result.data.filter((t: any) => t.bloat_severity === 'HIGH').length,
                        medium: result.data.filter((t: any) => t.bloat_severity === 'MEDIUM').length,
                        low: result.data.filter((t: any) => t.bloat_severity === 'LOW').length
                    },
                    vacuum_status: {
                        never: result.data.filter((t: any) => t.vacuum_status === 'NEVER').length,
                        overdue: result.data.filter((t: any) => t.vacuum_status === 'OVERDUE').length,
                        due: result.data.filter((t: any) => t.vacuum_status === 'DUE').length,
                        recent: result.data.filter((t: any) => t.vacuum_status === 'RECENT').length
                    }
                };
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            bloat_analysis: result.data,
                            summary,
                            recommendations: generateMaintenanceRecommendations(result.data),
                            next_actions: result.data
                                .filter((t: any) => t.needs_maintenance)
                                .slice(0, 5)
                                .map((t: any) => `${t.bloat_severity}: VACUUM ${t.schemaname}.${t.tablename}`)
                        }, null, 2)
                    }]
                };
            }
            
            case 'auto_vacuum': {
                // Get tables that need maintenance
                const needsMaintenanceSql = `
                    WITH maintenance_candidates AS (
                        SELECT 
                            schemaname,
                            tablename,
                            n_live_tup,
                            n_dead_tup,
                            CASE 
                                WHEN n_live_tup + n_dead_tup = 0 THEN 0
                                ELSE (n_dead_tup * 100.0) / (n_live_tup + n_dead_tup)
                            END AS bloat_percentage,
                            pg_total_relation_size(schemaname||'.'||tablename) as total_bytes,
                            last_vacuum,
                            last_autovacuum,
                            last_analyze,
                            last_autoanalyze
                        FROM pg_stat_user_tables
                        WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
                        AND pg_total_relation_size(schemaname||'.'||tablename) >= pg_size_bytes('${validatedInput.minSize}')
                    )
                    SELECT 
                        schemaname,
                        tablename,
                        bloat_percentage,
                        pg_size_pretty(total_bytes) as size,
                        CASE
                            WHEN bloat_percentage >= ${validatedInput.bloatThreshold} THEN 'vacuum'
                            WHEN GREATEST(last_analyze, last_autoanalyze) < NOW() - INTERVAL '7 days' THEN 'analyze'
                            WHEN GREATEST(last_vacuum, last_autovacuum) < NOW() - INTERVAL '7 days' THEN 'vacuum'
                            ELSE 'none'
                        END as recommended_action,
                        CASE
                            WHEN bloat_percentage >= 50 THEN 'critical'
                            WHEN bloat_percentage >= 30 THEN 'high'
                            WHEN bloat_percentage >= 15 THEN 'medium'
                            ELSE 'low'
                        END as priority
                    FROM maintenance_candidates
                    WHERE (
                        bloat_percentage >= ${validatedInput.bloatThreshold}
                        OR GREATEST(last_vacuum, last_autovacuum) < NOW() - INTERVAL '7 days'
                        OR GREATEST(last_analyze, last_autoanalyze) < NOW() - INTERVAL '7 days'
                    )
                    ${validatedInput.includeTables && validatedInput.includeTables.length > 0 
                        ? `AND tablename = ANY(ARRAY[${validatedInput.includeTables.map(t => `'${t}'`).join(', ')}])`
                        : ''}
                    ${validatedInput.excludeTables && validatedInput.excludeTables.length > 0 
                        ? `AND tablename != ALL(ARRAY[${validatedInput.excludeTables.map(t => `'${t}'`).join(', ')}])`
                        : ''}
                    ORDER BY 
                        CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
                        bloat_percentage DESC
                `;
                
                const candidates = await executeSqlWithFallback(needsMaintenanceSql, context);
                const results = [];
                
                if (validatedInput.dryRun) {
                    return {
                        content: [{
                            type: "text",
                            text: JSON.stringify({
                                dry_run: true,
                                message: "Auto maintenance plan (would execute)",
                                candidates: candidates.data,
                                actions_planned: candidates.data.map((c: any) => 
                                    `${c.recommended_action.toUpperCase()} ${c.schemaname}.${c.tablename} (${c.priority} priority, ${c.bloat_percentage}% bloat)`
                                )
                            }, null, 2)
                        }]
                    };
                }
                
                // Execute maintenance for each candidate
                for (const candidate of candidates.data) {
                    const tableName = `${candidate.schemaname}.${candidate.tablename}`;
                    
                    try {
                        const startTime = new Date();
                        let maintenanceCommand = '';
                        
                        if (candidate.recommended_action === 'vacuum') {
                            if (candidate.bloat_percentage > 50 && validatedInput.full) {
                                maintenanceCommand = `VACUUM (FULL, ANALYZE${validatedInput.verbose ? ', VERBOSE' : ''}) ${tableName}`;
                            } else {
                                maintenanceCommand = `VACUUM (ANALYZE${validatedInput.verbose ? ', VERBOSE' : ''}) ${tableName}`;
                            }
                        } else if (candidate.recommended_action === 'analyze') {
                            maintenanceCommand = `ANALYZE${validatedInput.verbose ? ' (VERBOSE)' : ''} ${tableName}`;
                        }
                        
                        await executeSqlWithFallback(maintenanceCommand, context);
                        const endTime = new Date();
                        const duration = endTime.getTime() - startTime.getTime();
                        
                        results.push({
                            table: tableName,
                            action: candidate.recommended_action,
                            priority: candidate.priority,
                            initial_bloat: candidate.bloat_percentage,
                            duration_ms: duration,
                            success: true
                        });
                        
                        context.log(`Completed ${candidate.recommended_action} on ${tableName} (${duration}ms)`);
                        
                    } catch (error: any) {
                        results.push({
                            table: tableName,
                            action: candidate.recommended_action,
                            priority: candidate.priority,
                            success: false,
                            error: error.message
                        });
                        
                        context.log(`Failed ${candidate.recommended_action} on ${tableName}: ${error.message}`, 'error');
                    }
                }
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: "Auto maintenance completed",
                            tables_processed: results.length,
                            successful: results.filter(r => r.success).length,
                            failed: results.filter(r => !r.success).length,
                            total_duration_ms: results.reduce((sum, r) => sum + (r.duration_ms || 0), 0),
                            results: results
                        }, null, 2)
                    }]
                };
            }
            
            case 'vacuum':
            case 'vacuum_analyze':
            case 'vacuum_full': {
                if (!validatedInput.tableName && !validatedInput.autoMode) {
                    throw new Error("Table name is required unless using auto mode");
                }
                
                const tables = validatedInput.tableName 
                    ? [`${validatedInput.schemaName}.${validatedInput.tableName}`]
                    : await getAutoMaintenanceTables(context, validatedInput);
                
                const results = [];
                
                // Set maintenance work memory if specified
                if (validatedInput.maintenance_work_mem) {
                    await executeSqlWithFallback(`SET maintenance_work_mem = '${validatedInput.maintenance_work_mem}'`, context);
                }
                
                for (const table of tables) {
                    try {
                        const startTime = new Date();
                        let command = 'VACUUM';
                        
                        const options = [];
                        if (validatedInput.action === 'vacuum_full' || validatedInput.full) options.push('FULL');
                        if (validatedInput.action === 'vacuum_analyze' || validatedInput.analyze) options.push('ANALYZE');
                        if (validatedInput.freeze) options.push('FREEZE');
                        if (validatedInput.verbose) options.push('VERBOSE');
                        if (validatedInput.parallel) options.push(`PARALLEL ${validatedInput.parallel}`);
                        if (validatedInput.bufferUsageLimit) options.push(`BUFFER_USAGE_LIMIT '${validatedInput.bufferUsageLimit}'`);
                        
                        if (options.length > 0) {
                            command += ` (${options.join(', ')})`;
                        }
                        command += ` ${table}`;
                        
                        if (validatedInput.dryRun) {
                            results.push({
                                table,
                                command,
                                dry_run: true
                            });
                        } else {
                            await executeSqlWithFallback(command, context);
                            const endTime = new Date();
                            const duration = endTime.getTime() - startTime.getTime();
                            
                            results.push({
                                table,
                                command,
                                duration_ms: duration,
                                success: true
                            });
                        }
                        
                    } catch (error: any) {
                        results.push({
                            table,
                            success: false,
                            error: error.message
                        });
                    }
                }
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            action: validatedInput.action,
                            dry_run: validatedInput.dryRun,
                            tables_processed: results.length,
                            results: results
                        }, null, 2)
                    }]
                };
            }
            
            case 'analyze': {
                const tables = validatedInput.tableName 
                    ? [`${validatedInput.schemaName}.${validatedInput.tableName}`]
                    : await getAutoMaintenanceTables(context, validatedInput, 'analyze');
                
                const results = [];
                
                for (const table of tables) {
                    try {
                        const startTime = new Date();
                        let command = `ANALYZE${validatedInput.verbose ? ' (VERBOSE)' : ''} ${table}`;
                        
                        if (validatedInput.dryRun) {
                            results.push({
                                table,
                                command,
                                dry_run: true
                            });
                        } else {
                            await executeSqlWithFallback(command, context);
                            const endTime = new Date();
                            const duration = endTime.getTime() - startTime.getTime();
                            
                            results.push({
                                table,
                                command,
                                duration_ms: duration,
                                success: true
                            });
                        }
                        
                    } catch (error: any) {
                        results.push({
                            table,
                            success: false,
                            error: error.message
                        });
                    }
                }
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            action: 'analyze',
                            dry_run: validatedInput.dryRun,
                            tables_processed: results.length,
                            results: results
                        }, null, 2)
                    }]
                };
            }
            
            case 'reindex': {
                if (!validatedInput.tableName && !validatedInput.indexName) {
                    throw new Error("Either table name or index name is required");
                }
                
                const results = [];
                
                try {
                    const startTime = new Date();
                    let command = '';
                    
                    if (validatedInput.indexName) {
                        command = `REINDEX${validatedInput.verbose ? ' (VERBOSE)' : ''} INDEX ${validatedInput.schemaName}.${validatedInput.indexName}`;
                    } else {
                        command = `REINDEX${validatedInput.verbose ? ' (VERBOSE)' : ''} TABLE ${validatedInput.schemaName}.${validatedInput.tableName}`;
                    }
                    
                    if (validatedInput.dryRun) {
                        return {
                            content: [{
                                type: "text",
                                text: JSON.stringify({
                                    dry_run: true,
                                    command,
                                    target: validatedInput.indexName || validatedInput.tableName
                                }, null, 2)
                            }]
                        };
                    }
                    
                    await executeSqlWithFallback(command, context);
                    const endTime = new Date();
                    const duration = endTime.getTime() - startTime.getTime();
                    
                    return {
                        content: [{
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                action: 'reindex',
                                target: validatedInput.indexName || validatedInput.tableName,
                                duration_ms: duration
                            }, null, 2)
                        }]
                    };
                    
                } catch (error: any) {
                    return {
                        content: [{
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                action: 'reindex',
                                target: validatedInput.indexName || validatedInput.tableName,
                                error: error.message
                            }, null, 2)
                        }]
                    };
                }
            }
            
            case 'maintenance_plan': {
                const planSql = `
                    WITH table_analysis AS (
                        SELECT 
                            schemaname,
                            tablename,
                            n_live_tup,
                            n_dead_tup,
                            CASE 
                                WHEN n_live_tup + n_dead_tup = 0 THEN 0
                                ELSE (n_dead_tup * 100.0) / (n_live_tup + n_dead_tup)
                            END AS bloat_percentage,
                            pg_total_relation_size(schemaname||'.'||tablename) as total_bytes,
                            last_vacuum,
                            last_autovacuum,
                            last_analyze,
                            last_autoanalyze,
                            n_tup_ins + n_tup_upd + n_tup_del as total_activity
                        FROM pg_stat_user_tables
                        WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
                        AND pg_total_relation_size(schemaname||'.'||tablename) >= pg_size_bytes('${validatedInput.minSize}')
                    )
                    SELECT 
                        schemaname,
                        tablename,
                        bloat_percentage,
                        pg_size_pretty(total_bytes) as size,
                        total_bytes,
                        total_activity,
                        CASE
                            WHEN bloat_percentage >= 50 THEN 'vacuum_full'
                            WHEN bloat_percentage >= 20 THEN 'vacuum_analyze'
                            WHEN GREATEST(last_analyze, last_autoanalyze) < NOW() - INTERVAL '7 days' THEN 'analyze'
                            WHEN GREATEST(last_vacuum, last_autovacuum) < NOW() - INTERVAL '7 days' THEN 'vacuum'
                            ELSE 'none'
                        END as recommended_action,
                        CASE
                            WHEN bloat_percentage >= 50 OR total_bytes > 10737418240 THEN 'critical' -- 10GB
                            WHEN bloat_percentage >= 30 OR total_bytes > 5368709120 THEN 'high' -- 5GB
                            WHEN bloat_percentage >= 15 OR total_bytes > 1073741824 THEN 'medium' -- 1GB
                            ELSE 'low'
                        END as priority,
                        CASE
                            WHEN total_bytes > 10737418240 THEN '4 hours' -- 10GB+
                            WHEN total_bytes > 5368709120 THEN '2 hours' -- 5GB+
                            WHEN total_bytes > 1073741824 THEN '1 hour' -- 1GB+
                            ELSE '30 minutes'
                        END as estimated_duration
                    FROM table_analysis
                    WHERE bloat_percentage >= 5 
                        OR GREATEST(last_vacuum, last_autovacuum) < NOW() - INTERVAL '7 days'
                        OR GREATEST(last_analyze, last_autoanalyze) < NOW() - INTERVAL '7 days'
                    ORDER BY 
                        CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
                        total_bytes DESC
                `;
                
                const plan = await executeSqlWithFallback(planSql, context);
                
                // Generate maintenance schedule
                const maintenanceSchedule = generateMaintenanceSchedule(plan.data, validatedInput);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            maintenance_plan: plan.data,
                            schedule: maintenanceSchedule,
                            summary: {
                                total_tables: plan.data.length,
                                by_priority: {
                                    critical: plan.data.filter((t: any) => t.priority === 'critical').length,
                                    high: plan.data.filter((t: any) => t.priority === 'high').length,
                                    medium: plan.data.filter((t: any) => t.priority === 'medium').length,
                                    low: plan.data.filter((t: any) => t.priority === 'low').length
                                },
                                by_action: {
                                    vacuum_full: plan.data.filter((t: any) => t.recommended_action === 'vacuum_full').length,
                                    vacuum_analyze: plan.data.filter((t: any) => t.recommended_action === 'vacuum_analyze').length,
                                    vacuum: plan.data.filter((t: any) => t.recommended_action === 'vacuum').length,
                                    analyze: plan.data.filter((t: any) => t.recommended_action === 'analyze').length
                                },
                                estimated_total_duration: plan.data.reduce((total: number, table: any) => {
                                    const hours = parseFloat(table.estimated_duration.replace(/[^\d.]/g, ''));
                                    return total + hours;
                                }, 0)
                            }
                        }, null, 2)
                    }]
                };
            }
            
            case 'stats_analysis': {
                const statsAnalysisSql = `
                    SELECT 
                        schemaname,
                        tablename,
                        n_live_tup,
                        n_dead_tup,
                        n_tup_ins,
                        n_tup_upd,
                        n_tup_del,
                        n_tup_hot_upd,
                        seq_scan,
                        seq_tup_read,
                        idx_scan,
                        idx_tup_fetch,
                        last_vacuum,
                        last_autovacuum,
                        last_analyze,
                        last_autoanalyze,
                        vacuum_count,
                        autovacuum_count,
                        analyze_count,
                        autoanalyze_count,
                        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
                        pg_total_relation_size(schemaname||'.'||tablename) as total_bytes,
                        CASE 
                            WHEN n_live_tup + n_dead_tup = 0 THEN 0
                            ELSE ROUND((n_dead_tup * 100.0) / (n_live_tup + n_dead_tup), 2)
                        END AS bloat_percentage,
                        CASE
                            WHEN idx_scan = 0 THEN 'Table scans only'
                            WHEN seq_scan > idx_scan THEN 'More table scans'
                            ELSE 'Good index usage'
                        END as scan_pattern
                    FROM pg_stat_user_tables
                    WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
                    ${validatedInput.schemaName ? `AND schemaname = '${validatedInput.schemaName}'` : ''}
                    ${validatedInput.tableName ? `AND tablename LIKE '%${validatedInput.tableName}%'` : ''}
                    ORDER BY total_bytes DESC
                `;
                
                const result = await executeSqlWithFallback(statsAnalysisSql, context);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            table_statistics: result.data,
                            database_health: {
                                total_tables: result.data.length,
                                tables_with_bloat: result.data.filter((t: any) => t.bloat_percentage > 10).length,
                                tables_never_vacuumed: result.data.filter((t: any) => !t.last_vacuum && !t.last_autovacuum).length,
                                tables_never_analyzed: result.data.filter((t: any) => !t.last_analyze && !t.last_autoanalyze).length,
                                tables_scan_only: result.data.filter((t: any) => t.scan_pattern === 'Table scans only').length,
                                average_bloat: result.data.length > 0 
                                    ? Math.round(result.data.reduce((sum: number, t: any) => sum + t.bloat_percentage, 0) / result.data.length * 100) / 100
                                    : 0
                            }
                        }, null, 2)
                    }]
                };
            }
            
            default:
                throw new Error(`Unknown action: ${validatedInput.action}`);
        }
    }
};

async function getAutoMaintenanceTables(context: ToolContext, input: VacuumAnalyzeInput, type: 'vacuum' | 'analyze' = 'vacuum'): Promise<string[]> {
    const sql = `
        SELECT DISTINCT schemaname||'.'||tablename as full_table_name
        FROM pg_stat_user_tables
        WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        AND pg_total_relation_size(schemaname||'.'||tablename) >= pg_size_bytes('${input.minSize}')
        ${type === 'vacuum' 
            ? `AND (GREATEST(last_vacuum, last_autovacuum) < NOW() - INTERVAL '7 days' OR (n_dead_tup * 100.0) / NULLIF(n_live_tup + n_dead_tup, 0) >= ${input.bloatThreshold})`
            : `AND GREATEST(last_analyze, last_autoanalyze) < NOW() - INTERVAL '7 days'`}
        ${input.includeTables && input.includeTables.length > 0 
            ? `AND tablename = ANY(ARRAY[${input.includeTables.map(t => `'${t}'`).join(', ')}])`
            : ''}
        ${input.excludeTables && input.excludeTables.length > 0 
            ? `AND tablename != ALL(ARRAY[${input.excludeTables.map(t => `'${t}'`).join(', ')}])`
            : ''}
        ORDER BY full_table_name
    `;
    
    const result = await executeSqlWithFallback(sql, context);
    return result.data.map((row: any) => row.full_table_name);
}

function generateMaintenanceRecommendations(tables: any[]): string[] {
    const recommendations = [];
    
    const criticalTables = tables.filter(t => t.bloat_severity === 'CRITICAL');
    const overdueTables = tables.filter(t => t.vacuum_status === 'OVERDUE');
    const neverVacuumed = tables.filter(t => t.vacuum_status === 'NEVER');
    
    if (criticalTables.length > 0) {
        recommendations.push(`Immediate attention: ${criticalTables.length} tables with critical bloat (>50%)`);
    }
    
    if (overdueTables.length > 0) {
        recommendations.push(`Schedule maintenance: ${overdueTables.length} tables overdue for vacuum`);
    }
    
    if (neverVacuumed.length > 0) {
        recommendations.push(`First-time setup: ${neverVacuumed.length} tables never vacuumed`);
    }
    
    if (tables.length > 10) {
        recommendations.push('Consider implementing automated maintenance schedules');
    }
    
    const avgBloat = tables.reduce((sum, t) => sum + (t.bloat_percentage || 0), 0) / tables.length;
    if (avgBloat > 15) {
        recommendations.push('Database health concern: Average bloat is high, review autovacuum settings');
    }
    
    return recommendations;
}

function generateMaintenanceSchedule(tables: any[], input: VacuumAnalyzeInput): any {
    const schedule = {
        immediate: [] as any[],
        tonight: [] as any[],
        weekend: [] as any[],
        maintenance_window: [] as any[]
    };
    
    tables.forEach(table => {
        const estimatedHours = parseFloat(table.estimated_duration.replace(/[^\d.]/g, ''));
        
        if (table.priority === 'critical') {
            schedule.immediate.push({
                table: `${table.schemaname}.${table.tablename}`,
                action: table.recommended_action,
                priority: table.priority,
                estimated_duration: table.estimated_duration,
                reason: `Critical bloat: ${table.bloat_percentage}%`
            });
        } else if (table.priority === 'high' && estimatedHours <= 1) {
            schedule.tonight.push({
                table: `${table.schemaname}.${table.tablename}`,
                action: table.recommended_action,
                priority: table.priority,
                estimated_duration: table.estimated_duration
            });
        } else if (estimatedHours > 2) {
            schedule.weekend.push({
                table: `${table.schemaname}.${table.tablename}`,
                action: table.recommended_action,
                priority: table.priority,
                estimated_duration: table.estimated_duration
            });
        } else {
            schedule.maintenance_window.push({
                table: `${table.schemaname}.${table.tablename}`,
                action: table.recommended_action,
                priority: table.priority,
                estimated_duration: table.estimated_duration
            });
        }
    });
    
    return schedule;
}