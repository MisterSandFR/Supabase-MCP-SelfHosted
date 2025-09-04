import { Tool } from "@modelcontextprotocol/sdk/dist/types.js";
import { z } from "zod";
import { ToolContext } from "./types.js";
import { executeSqlWithFallback } from "./utils.js";

const CacheManagementInputSchema = z.object({
    action: z.enum(['create_materialized_view', 'refresh_view', 'list_views', 'delete_view', 'analyze_cache', 'create_index', 'optimize_queries', 'cache_stats', 'auto_refresh', 'partition_management']).describe("Cache management action"),
    viewName: z.string().optional().describe("Materialized view name"),
    query: z.string().optional().describe("SQL query for materialized view"),
    schemaName: z.string().optional().default('public').describe("Schema name"),
    refreshInterval: z.number().optional().describe("Auto-refresh interval in minutes"),
    withData: z.boolean().optional().default(true).describe("Create view with data"),
    concurrently: z.boolean().optional().default(false).describe("Refresh concurrently"),
    indexColumns: z.array(z.string()).optional().describe("Columns to index"),
    partitionBy: z.string().optional().describe("Partition column"),
    partitionType: z.enum(['range', 'list', 'hash']).optional().describe("Partition type"),
    retentionDays: z.number().optional().describe("Data retention in days"),
    compressionEnabled: z.boolean().optional().default(false).describe("Enable compression"),
    autoAnalyze: z.boolean().optional().default(true).describe("Auto-analyze after refresh"),
    dependencies: z.array(z.string()).optional().describe("Dependent views to refresh"),
    priority: z.enum(['low', 'medium', 'high']).optional().default('medium').describe("Refresh priority"),
    tags: z.array(z.string()).optional().describe("Tags for organization")
});

type CacheManagementInput = z.infer<typeof CacheManagementInputSchema>;

export const cacheManagementTool: Tool = {
    name: "cache_management",
    description: "Comprehensive materialized view and caching management with auto-refresh, partitioning, and performance optimization",
    inputSchema: {
        type: "object",
        properties: {
            action: {
                type: "string",
                enum: ["create_materialized_view", "refresh_view", "list_views", "delete_view", "analyze_cache", "create_index", "optimize_queries", "cache_stats", "auto_refresh", "partition_management"],
                description: "Cache management action"
            },
            viewName: { type: "string", description: "Materialized view name" },
            query: { type: "string", description: "SQL query" },
            schemaName: { type: "string", description: "Schema name" },
            refreshInterval: { type: "number", description: "Auto-refresh interval" },
            withData: { type: "boolean", description: "Create with data" },
            concurrently: { type: "boolean", description: "Refresh concurrently" },
            indexColumns: {
                type: "array",
                items: { type: "string" },
                description: "Columns to index"
            },
            partitionBy: { type: "string", description: "Partition column" },
            partitionType: {
                type: "string",
                enum: ["range", "list", "hash"],
                description: "Partition type"
            },
            retentionDays: { type: "number", description: "Data retention days" },
            compressionEnabled: { type: "boolean", description: "Enable compression" },
            autoAnalyze: { type: "boolean", description: "Auto-analyze after refresh" },
            dependencies: {
                type: "array",
                items: { type: "string" },
                description: "Dependent views"
            },
            priority: {
                type: "string",
                enum: ["low", "medium", "high"],
                description: "Refresh priority"
            },
            tags: {
                type: "array",
                items: { type: "string" },
                description: "Tags"
            }
        },
        required: ["action"]
    },
    execute: async (input: unknown, context: ToolContext) => {
        const validatedInput = CacheManagementInputSchema.parse(input);
        
        await ensureCacheInfrastructure(context);
        
        switch (validatedInput.action) {
            case 'create_materialized_view': {
                if (!validatedInput.viewName || !validatedInput.query) {
                    throw new Error("View name and query are required");
                }
                
                const result = await createMaterializedView(validatedInput, context);
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            }
            
            case 'refresh_view': {
                if (!validatedInput.viewName) {
                    throw new Error("View name is required");
                }
                
                const result = await refreshMaterializedView(validatedInput, context);
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            }
            
            case 'list_views': {
                const result = await listMaterializedViews(validatedInput, context);
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            }
            
            case 'cache_stats': {
                const result = await getCacheStatistics(validatedInput, context);
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            }
            
            case 'analyze_cache': {
                const result = await analyzeCachePerformance(validatedInput, context);
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            }
            
            case 'auto_refresh': {
                const result = await setupAutoRefresh(validatedInput, context);
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

async function ensureCacheInfrastructure(context: ToolContext): Promise<void> {
    const sql = `
        CREATE TABLE IF NOT EXISTS materialized_view_registry (
            id SERIAL PRIMARY KEY,
            view_name VARCHAR(255) NOT NULL,
            schema_name VARCHAR(255) DEFAULT 'public',
            query_definition TEXT NOT NULL,
            refresh_interval INTEGER,
            last_refreshed TIMESTAMP,
            auto_refresh BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            size_bytes BIGINT DEFAULT 0,
            row_count BIGINT DEFAULT 0,
            dependencies TEXT[] DEFAULT '{}',
            tags TEXT[] DEFAULT '{}',
            UNIQUE(schema_name, view_name)
        );
        
        CREATE TABLE IF NOT EXISTS cache_refresh_log (
            id SERIAL PRIMARY KEY,
            view_id INTEGER REFERENCES materialized_view_registry(id),
            refresh_start TIMESTAMP DEFAULT NOW(),
            refresh_end TIMESTAMP,
            duration_seconds INTEGER,
            rows_affected BIGINT,
            success BOOLEAN DEFAULT false,
            error_message TEXT
        );
    `;
    
    await executeSqlWithFallback(sql, context);
}

async function createMaterializedView(input: CacheManagementInput, context: ToolContext): Promise<any> {
    const viewFullName = `${input.schemaName}.${input.viewName}`;
    
    // Create materialized view
    const createSql = `
        CREATE MATERIALIZED VIEW ${viewFullName}
        AS ${input.query}
        ${input.withData ? 'WITH DATA' : 'WITH NO DATA'}
    `;
    
    await executeSqlWithFallback(createSql, context);
    
    // Register in our tracking table
    const registerSql = `
        INSERT INTO materialized_view_registry (
            view_name, schema_name, query_definition, refresh_interval, 
            auto_refresh, dependencies, tags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
    `;
    
    const registration = await executeSqlWithFallback(registerSql, context, [
        input.viewName,
        input.schemaName,
        input.query,
        input.refreshInterval,
        !!input.refreshInterval,
        input.dependencies || [],
        input.tags || []
    ]);
    
    // Create indexes if specified
    if (input.indexColumns && input.indexColumns.length > 0) {
        for (const column of input.indexColumns) {
            const indexName = `idx_${input.viewName}_${column}`;
            const indexSql = `CREATE INDEX ${indexName} ON ${viewFullName} (${column})`;
            await executeSqlWithFallback(indexSql, context);
        }
    }
    
    // Get initial statistics
    const statsSql = `
        SELECT 
            pg_total_relation_size('${viewFullName}') as size_bytes,
            COUNT(*) as row_count
        FROM ${viewFullName}
    `;
    
    const stats = await executeSqlWithFallback(statsSql, context);
    
    // Update registry with stats
    await executeSqlWithFallback(
        `UPDATE materialized_view_registry SET size_bytes = $1, row_count = $2 WHERE id = $3`,
        context,
        [stats.data[0].size_bytes, stats.data[0].row_count, registration.data[0].id]
    );
    
    return {
        success: true,
        view_name: viewFullName,
        registry_id: registration.data[0].id,
        initial_size_bytes: stats.data[0].size_bytes,
        initial_row_count: stats.data[0].row_count,
        indexes_created: input.indexColumns?.length || 0
    };
}

async function refreshMaterializedView(input: CacheManagementInput, context: ToolContext): Promise<any> {
    const viewFullName = `${input.schemaName}.${input.viewName}`;
    const startTime = new Date();
    
    try {
        // Start refresh log
        const logSql = `
            INSERT INTO cache_refresh_log (view_id, refresh_start)
            SELECT id, NOW() FROM materialized_view_registry 
            WHERE schema_name = $1 AND view_name = $2
            RETURNING id
        `;
        
        const logResult = await executeSqlWithFallback(logSql, context, [input.schemaName, input.viewName]);
        const logId = logResult.data[0]?.id;
        
        // Refresh the view
        const refreshSql = `REFRESH MATERIALIZED VIEW ${input.concurrently ? 'CONCURRENTLY' : ''} ${viewFullName}`;
        await executeSqlWithFallback(refreshSql, context);
        
        const endTime = new Date();
        const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
        
        // Get updated statistics
        const statsSql = `
            SELECT 
                pg_total_relation_size('${viewFullName}') as size_bytes,
                COUNT(*) as row_count
            FROM ${viewFullName}
        `;
        
        const stats = await executeSqlWithFallback(statsSql, context);
        
        // Update registry
        const updateRegistrySql = `
            UPDATE materialized_view_registry 
            SET last_refreshed = $1, size_bytes = $2, row_count = $3, updated_at = $1
            WHERE schema_name = $4 AND view_name = $5
        `;
        
        await executeSqlWithFallback(updateRegistrySql, context, [
            endTime,
            stats.data[0].size_bytes,
            stats.data[0].row_count,
            input.schemaName,
            input.viewName
        ]);
        
        // Complete refresh log
        if (logId) {
            const completeLogSql = `
                UPDATE cache_refresh_log 
                SET refresh_end = $1, duration_seconds = $2, rows_affected = $3, success = true
                WHERE id = $4
            `;
            
            await executeSqlWithFallback(completeLogSql, context, [
                endTime, duration, stats.data[0].row_count, logId
            ]);
        }
        
        // Auto-analyze if enabled
        if (input.autoAnalyze !== false) {
            await executeSqlWithFallback(`ANALYZE ${viewFullName}`, context);
        }
        
        return {
            success: true,
            view_name: viewFullName,
            refresh_duration_seconds: duration,
            new_row_count: stats.data[0].row_count,
            new_size_bytes: stats.data[0].size_bytes,
            concurrent: input.concurrently,
            analyzed: input.autoAnalyze !== false
        };
        
    } catch (error: any) {
        // Log the error
        const logErrorSql = `
            UPDATE cache_refresh_log 
            SET refresh_end = NOW(), success = false, error_message = $1
            WHERE view_id = (
                SELECT id FROM materialized_view_registry 
                WHERE schema_name = $2 AND view_name = $3
            )
            AND refresh_end IS NULL
        `;
        
        await executeSqlWithFallback(logErrorSql, context, [error.message, input.schemaName, input.viewName]);
        
        throw error;
    }
}

async function listMaterializedViews(input: CacheManagementInput, context: ToolContext): Promise<any> {
    const sql = `
        SELECT 
            mvr.*,
            pg_size_pretty(mvr.size_bytes) as size_formatted,
            CASE 
                WHEN mvr.auto_refresh AND mvr.refresh_interval IS NOT NULL THEN
                    EXTRACT(EPOCH FROM (NOW() - mvr.last_refreshed)) > (mvr.refresh_interval * 60)
                ELSE false
            END as needs_refresh,
            crl.avg_refresh_time,
            crl.last_refresh_success,
            crl.total_refreshes
        FROM materialized_view_registry mvr
        LEFT JOIN (
            SELECT 
                view_id,
                AVG(duration_seconds) as avg_refresh_time,
                MAX(success) as last_refresh_success,
                COUNT(*) as total_refreshes
            FROM cache_refresh_log
            GROUP BY view_id
        ) crl ON mvr.id = crl.view_id
        WHERE 1=1
        ${input.schemaName !== 'public' ? `AND mvr.schema_name = '${input.schemaName}'` : ''}
        ${input.viewName ? `AND mvr.view_name LIKE '%${input.viewName}%'` : ''}
        ORDER BY mvr.size_bytes DESC
    `;
    
    const result = await executeSqlWithFallback(sql, context);
    
    const summary = {
        total_views: result.data.length,
        auto_refresh_enabled: result.data.filter((v: any) => v.auto_refresh).length,
        needs_refresh: result.data.filter((v: any) => v.needs_refresh).length,
        total_size_bytes: result.data.reduce((sum: number, v: any) => sum + (v.size_bytes || 0), 0),
        total_rows: result.data.reduce((sum: number, v: any) => sum + (v.row_count || 0), 0)
    };
    
    return {
        materialized_views: result.data,
        summary
    };
}

async function getCacheStatistics(input: CacheManagementInput, context: ToolContext): Promise<any> {
    const statsSql = `
        WITH view_stats AS (
            SELECT 
                mvr.view_name,
                mvr.schema_name,
                mvr.size_bytes,
                mvr.row_count,
                mvr.last_refreshed,
                mvr.auto_refresh,
                EXTRACT(EPOCH FROM (NOW() - mvr.last_refreshed)) / 3600 as hours_since_refresh
            FROM materialized_view_registry mvr
        ),
        refresh_stats AS (
            SELECT 
                crl.view_id,
                COUNT(*) as total_refreshes,
                AVG(crl.duration_seconds) as avg_duration,
                MIN(crl.duration_seconds) as min_duration,
                MAX(crl.duration_seconds) as max_duration,
                COUNT(*) FILTER (WHERE crl.success = true) as successful_refreshes,
                COUNT(*) FILTER (WHERE crl.success = false) as failed_refreshes
            FROM cache_refresh_log crl
            WHERE crl.refresh_start > NOW() - INTERVAL '30 days'
            GROUP BY crl.view_id
        )
        SELECT 
            vs.*,
            rs.total_refreshes,
            rs.avg_duration,
            rs.successful_refreshes,
            rs.failed_refreshes,
            ROUND((rs.successful_refreshes::numeric / NULLIF(rs.total_refreshes, 0)) * 100, 2) as success_rate
        FROM view_stats vs
        LEFT JOIN materialized_view_registry mvr ON vs.view_name = mvr.view_name AND vs.schema_name = mvr.schema_name
        LEFT JOIN refresh_stats rs ON mvr.id = rs.view_id
        ORDER BY vs.size_bytes DESC
    `;
    
    const result = await executeSqlWithFallback(statsSql, context);
    
    const globalStats = {
        total_materialized_views: result.data.length,
        total_cache_size_gb: Math.round(result.data.reduce((sum: number, v: any) => sum + (v.size_bytes || 0), 0) / (1024 * 1024 * 1024) * 100) / 100,
        average_refresh_time: result.data.length > 0 
            ? Math.round(result.data.reduce((sum: number, v: any) => sum + (v.avg_duration || 0), 0) / result.data.length)
            : 0,
        stale_views: result.data.filter((v: any) => v.hours_since_refresh > 24).length,
        auto_refresh_coverage: result.data.filter((v: any) => v.auto_refresh).length,
        overall_success_rate: result.data.length > 0
            ? Math.round(result.data.reduce((sum: number, v: any) => sum + (v.success_rate || 0), 0) / result.data.length)
            : 0
    };
    
    return {
        view_statistics: result.data,
        global_statistics: globalStats,
        recommendations: generateCacheRecommendations(result.data)
    };
}

async function analyzeCachePerformance(input: CacheManagementInput, context: ToolContext): Promise<any> {
    const analysisSql = `
        WITH cache_performance AS (
            SELECT 
                mvr.view_name,
                mvr.schema_name,
                mvr.size_bytes,
                mvr.row_count,
                mvr.refresh_interval,
                crl.avg_duration,
                crl.success_rate,
                CASE 
                    WHEN mvr.size_bytes > 1073741824 THEN 'large' -- > 1GB
                    WHEN mvr.size_bytes > 104857600 THEN 'medium' -- > 100MB
                    ELSE 'small'
                END as size_category,
                CASE 
                    WHEN crl.avg_duration > 300 THEN 'slow' -- > 5 minutes
                    WHEN crl.avg_duration > 60 THEN 'moderate' -- > 1 minute
                    ELSE 'fast'
                END as refresh_speed,
                CASE 
                    WHEN crl.success_rate >= 95 THEN 'excellent'
                    WHEN crl.success_rate >= 80 THEN 'good'
                    WHEN crl.success_rate >= 60 THEN 'fair'
                    ELSE 'poor'
                END as reliability
            FROM materialized_view_registry mvr
            LEFT JOIN (
                SELECT 
                    view_id,
                    AVG(duration_seconds) as avg_duration,
                    (COUNT(*) FILTER (WHERE success = true)::numeric / COUNT(*)) * 100 as success_rate
                FROM cache_refresh_log
                WHERE refresh_start > NOW() - INTERVAL '30 days'
                GROUP BY view_id
            ) crl ON mvr.id = crl.view_id
        )
        SELECT 
            *,
            CASE 
                WHEN size_category = 'large' AND refresh_speed = 'slow' THEN 'needs_optimization'
                WHEN reliability = 'poor' THEN 'needs_attention'
                WHEN refresh_speed = 'fast' AND reliability = 'excellent' THEN 'optimal'
                ELSE 'acceptable'
            END as performance_status
        FROM cache_performance
        ORDER BY 
            CASE performance_status 
                WHEN 'needs_optimization' THEN 1
                WHEN 'needs_attention' THEN 2
                WHEN 'acceptable' THEN 3
                ELSE 4
            END,
            size_bytes DESC
    `;
    
    const result = await executeSqlWithFallback(analysisSql, context);
    
    const performanceInsights = {
        views_needing_optimization: result.data.filter((v: any) => v.performance_status === 'needs_optimization').length,
        views_needing_attention: result.data.filter((v: any) => v.performance_status === 'needs_attention').length,
        optimal_views: result.data.filter((v: any) => v.performance_status === 'optimal').length,
        size_distribution: {
            large: result.data.filter((v: any) => v.size_category === 'large').length,
            medium: result.data.filter((v: any) => v.size_category === 'medium').length,
            small: result.data.filter((v: any) => v.size_category === 'small').length
        },
        refresh_speed_distribution: {
            slow: result.data.filter((v: any) => v.refresh_speed === 'slow').length,
            moderate: result.data.filter((v: any) => v.refresh_speed === 'moderate').length,
            fast: result.data.filter((v: any) => v.refresh_speed === 'fast').length
        }
    };
    
    return {
        performance_analysis: result.data,
        insights: performanceInsights,
        optimization_recommendations: generateOptimizationRecommendations(result.data)
    };
}

async function setupAutoRefresh(input: CacheManagementInput, context: ToolContext): Promise<any> {
    // Create a simple auto-refresh function (in production, you'd use pg_cron or similar)
    const autoRefreshFunction = `
        CREATE OR REPLACE FUNCTION auto_refresh_materialized_views()
        RETURNS void AS $$
        DECLARE
            view_record RECORD;
            refresh_sql TEXT;
        BEGIN
            FOR view_record IN 
                SELECT schema_name, view_name, refresh_interval
                FROM materialized_view_registry
                WHERE auto_refresh = true
                AND refresh_interval IS NOT NULL
                AND (last_refreshed IS NULL OR last_refreshed < NOW() - (refresh_interval || ' minutes')::INTERVAL)
            LOOP
                refresh_sql := 'REFRESH MATERIALIZED VIEW ' || view_record.schema_name || '.' || view_record.view_name;
                
                BEGIN
                    EXECUTE refresh_sql;
                    
                    UPDATE materialized_view_registry
                    SET last_refreshed = NOW(), updated_at = NOW()
                    WHERE schema_name = view_record.schema_name 
                    AND view_name = view_record.view_name;
                    
                EXCEPTION WHEN OTHERS THEN
                    -- Log error but continue with other views
                    INSERT INTO cache_refresh_log (
                        view_id, refresh_start, refresh_end, success, error_message
                    )
                    SELECT id, NOW(), NOW(), false, SQLERRM
                    FROM materialized_view_registry
                    WHERE schema_name = view_record.schema_name 
                    AND view_name = view_record.view_name;
                END;
            END LOOP;
        END;
        $$ LANGUAGE plpgsql;
    `;
    
    await executeSqlWithFallback(autoRefreshFunction, context);
    
    return {
        success: true,
        message: "Auto-refresh function created",
        function_name: "auto_refresh_materialized_views",
        usage: "Call SELECT auto_refresh_materialized_views(); to refresh all due views",
        recommendation: "Schedule this function to run periodically using pg_cron or external scheduler"
    };
}

function generateCacheRecommendations(viewStats: any[]): string[] {
    const recommendations = [];
    
    const staleViews = viewStats.filter(v => v.hours_since_refresh > 24);
    if (staleViews.length > 0) {
        recommendations.push(`${staleViews.length} views haven't been refreshed in over 24 hours`);
    }
    
    const slowViews = viewStats.filter(v => (v.avg_duration || 0) > 300);
    if (slowViews.length > 0) {
        recommendations.push(`${slowViews.length} views take over 5 minutes to refresh - consider optimization`);
    }
    
    const failingViews = viewStats.filter(v => (v.success_rate || 0) < 80);
    if (failingViews.length > 0) {
        recommendations.push(`${failingViews.length} views have low success rates - investigate refresh failures`);
    }
    
    const noAutoRefresh = viewStats.filter(v => !v.auto_refresh);
    if (noAutoRefresh.length > 0) {
        recommendations.push(`Consider enabling auto-refresh for ${noAutoRefresh.length} views`);
    }
    
    return recommendations;
}

function generateOptimizationRecommendations(performanceData: any[]): string[] {
    const recommendations = [];
    
    const needsOptimization = performanceData.filter(v => v.performance_status === 'needs_optimization');
    for (const view of needsOptimization) {
        recommendations.push(`${view.schema_name}.${view.view_name}: Consider partitioning or query optimization (${view.size_category} size, ${view.refresh_speed} refresh)`);
    }
    
    const needsAttention = performanceData.filter(v => v.performance_status === 'needs_attention');
    for (const view of needsAttention) {
        recommendations.push(`${view.schema_name}.${view.view_name}: Investigate refresh failures (${view.reliability} reliability)`);
    }
    
    const largeViews = performanceData.filter(v => v.size_category === 'large');
    if (largeViews.length > 0) {
        recommendations.push('Consider implementing incremental refresh for large materialized views');
    }
    
    recommendations.push('Monitor cache hit rates and query performance regularly');
    recommendations.push('Consider using concurrent refresh for high-availability views');
    
    return recommendations;
}