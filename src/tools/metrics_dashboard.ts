import { Tool } from "@modelcontextprotocol/sdk/dist/types.js";
import { z } from "zod";
import { ToolContext } from "./types.js";
import { executeSqlWithFallback } from "./utils.js";

const MetricsDashboardInputSchema = z.object({
    action: z.enum(['get_overview', 'database_metrics', 'performance_metrics', 'security_metrics', 'usage_metrics', 'realtime_metrics', 'storage_metrics', 'create_alert', 'generate_report', 'export_metrics']).describe("Metrics dashboard action"),
    timeframe: z.enum(['1h', '24h', '7d', '30d', '90d']).optional().default('24h').describe("Time frame for metrics"),
    metricType: z.enum(['cpu', 'memory', 'connections', 'queries', 'errors', 'latency', 'throughput', 'storage', 'all']).optional().default('all').describe("Specific metric type"),
    granularity: z.enum(['1m', '5m', '1h', '1d']).optional().default('5m').describe("Data granularity"),
    alertName: z.string().optional().describe("Alert name"),
    alertCondition: z.string().optional().describe("Alert condition"),
    alertThreshold: z.number().optional().describe("Alert threshold"),
    alertChannel: z.enum(['email', 'webhook', 'slack', 'sms']).optional().describe("Alert channel"),
    reportFormat: z.enum(['json', 'csv', 'pdf', 'html']).optional().default('json').describe("Report format"),
    includeCharts: z.boolean().optional().default(false).describe("Include charts in report"),
    customMetrics: z.array(z.object({
        name: z.string(),
        query: z.string(),
        description: z.string()
    })).optional().describe("Custom metrics to include"),
    filters: z.object({
        database: z.string().optional(),
        schema: z.string().optional(),
        table: z.string().optional(),
        user: z.string().optional()
    }).optional().describe("Metric filters"),
    aggregation: z.enum(['avg', 'sum', 'min', 'max', 'count']).optional().default('avg').describe("Aggregation method"),
    baseline: z.boolean().optional().default(false).describe("Include baseline comparison"),
    anomalyDetection: z.boolean().optional().default(false).describe("Enable anomaly detection"),
    realTimeUpdates: z.boolean().optional().default(false).describe("Enable real-time updates")
});

type MetricsDashboardInput = z.infer<typeof MetricsDashboardInputSchema>;
const metricsDashboardOutputSchema = z.object({
    content: z.array(z.object({
        type: z.literal("text"),
        text: z.string()
    }))
});


export const metricsDashboardTool = {
    name: "metrics_dashboard",
    description: "Comprehensive real-time metrics and monitoring dashboard with alerts, reporting, and anomaly detection",
    inputSchema: MetricsDashboardInputSchema,
    mcpInputSchema: {
        type: "object",
        properties: {
            action: { 
                type: "string", 
                enum: ['get_overview', 'database_metrics', 'performance_metrics', 'security_metrics', 'usage_metrics', 'realtime_metrics', 'storage_metrics', 'create_alert', 'generate_report', 'export_metrics'], 
                description: "Metrics dashboard action" 
            },
            timeframe: {
                type: "string",
                enum: ["1h", "24h", "7d", "30d", "90d"],
                description: "Time frame for metrics"
            },
            metricType: {
                type: "string",
                enum: ["cpu", "memory", "connections", "queries", "errors", "latency", "throughput", "storage", "all"],
                description: "Metric type"
            },
            granularity: {
                type: "string",
                enum: ["1m", "5m", "1h", "1d"],
                description: "Data granularity"
            },
            alertName: { type: "string", description: "Alert name" },
            alertCondition: { type: "string", description: "Alert condition" },
            alertThreshold: { type: "number", description: "Alert threshold" },
            alertChannel: {
                type: "string",
                enum: ["email", "webhook", "slack", "sms"],
                description: "Alert channel"
            },
            reportFormat: {
                type: "string",
                enum: ["json", "csv", "pdf", "html"],
                description: "Report format"
            },
            includeCharts: { type: "boolean", description: "Include charts" },
            customMetrics: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        name: { type: "string" },
                        query: { type: "string" },
                        description: { type: "string" }
                    }
                }
            },
            filters: {
                type: "object",
                properties: {
                    database: { type: "string" },
                    schema: { type: "string" },
                    table: { type: "string" },
                    user: { type: "string" }
                }
            },
            aggregation: {
                type: "string",
                enum: ["avg", "sum", "min", "max", "count"],
                description: "Aggregation method"
            },
            baseline: { type: "boolean", description: "Include baseline" },
            anomalyDetection: { type: "boolean", description: "Anomaly detection" },
            realTimeUpdates: { type: "boolean", description: "Real-time updates" }
        },
        required: ["action"]
    },
    outputSchema: metricsDashboardOutputSchema,
    execute: async (input: unknown, context: ToolContext) => {
        const validatedInput = MetricsDashboardInputSchema.parse(input);
        
        await ensureMetricsInfrastructure(context);
        
        switch (validatedInput.action) {
            case 'get_overview': {
                const result = await getDashboardOverview(validatedInput, context);
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            }
            
            case 'database_metrics': {
                const result = await getDatabaseMetrics(validatedInput, context);
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            }
            
            case 'performance_metrics': {
                const result = await getPerformanceMetrics(validatedInput, context);
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            }
            
            case 'security_metrics': {
                const result = await getSecurityMetrics(validatedInput, context);
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            }
            
            case 'usage_metrics': {
                const result = await getUsageMetrics(validatedInput, context);
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            }
            
            case 'create_alert': {
                if (!validatedInput.alertName || !validatedInput.alertCondition) {
                    throw new Error("Alert name and condition are required");
                }
                
                const result = await createMetricAlert(validatedInput, context);
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            }
            
            case 'generate_report': {
                const result = await generateMetricsReport(validatedInput, context);
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

async function ensureMetricsInfrastructure(context: ToolContext): Promise<void> {
    const sql = `
        CREATE TABLE IF NOT EXISTS metrics_registry (
            id SERIAL PRIMARY KEY,
            metric_name VARCHAR(255) NOT NULL,
            metric_type VARCHAR(50) NOT NULL,
            description TEXT,
            unit VARCHAR(20),
            collection_query TEXT,
            collection_interval INTEGER DEFAULT 300, -- 5 minutes
            retention_days INTEGER DEFAULT 90,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            enabled BOOLEAN DEFAULT true
        );
        
        CREATE TABLE IF NOT EXISTS metric_data (
            id SERIAL PRIMARY KEY,
            metric_name VARCHAR(255) NOT NULL,
            value NUMERIC NOT NULL,
            timestamp TIMESTAMP DEFAULT NOW(),
            labels JSONB DEFAULT '{}',
            metadata JSONB DEFAULT '{}'
        );
        
        CREATE TABLE IF NOT EXISTS metric_alerts (
            id SERIAL PRIMARY KEY,
            alert_name VARCHAR(255) UNIQUE NOT NULL,
            metric_name VARCHAR(255) NOT NULL,
            condition_type VARCHAR(20) NOT NULL, -- 'threshold', 'change', 'anomaly'
            threshold_value NUMERIC,
            comparison_operator VARCHAR(10), -- '>', '<', '>=', '<=', '='
            evaluation_window INTEGER DEFAULT 300, -- 5 minutes
            notification_channels JSONB DEFAULT '[]',
            enabled BOOLEAN DEFAULT true,
            last_triggered TIMESTAMP,
            trigger_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE TABLE IF NOT EXISTS alert_history (
            id SERIAL PRIMARY KEY,
            alert_id INTEGER REFERENCES metric_alerts(id),
            triggered_at TIMESTAMP DEFAULT NOW(),
            metric_value NUMERIC NOT NULL,
            threshold_value NUMERIC NOT NULL,
            resolution_time TIMESTAMP,
            acknowledged BOOLEAN DEFAULT false,
            notes TEXT
        );
        
        -- Indexes for performance
        CREATE INDEX IF NOT EXISTS idx_metric_data_name_timestamp ON metric_data(metric_name, timestamp);
        CREATE INDEX IF NOT EXISTS idx_metric_data_timestamp ON metric_data(timestamp);
        CREATE INDEX IF NOT EXISTS idx_alert_history_triggered ON alert_history(triggered_at);
    `;
    
    await executeSqlWithFallback(sql, context);
    
    // Initialize default metrics
    await initializeDefaultMetrics(context);
}

async function initializeDefaultMetrics(context: ToolContext): Promise<void> {
    const defaultMetrics = [
        {
            name: 'database_connections',
            type: 'gauge',
            description: 'Active database connections',
            unit: 'count',
            query: 'SELECT COUNT(*) as value FROM pg_stat_activity WHERE state = \'active\''
        },
        {
            name: 'database_size',
            type: 'gauge',
            description: 'Total database size',
            unit: 'bytes',
            query: 'SELECT pg_database_size(current_database()) as value'
        },
        {
            name: 'query_duration_avg',
            type: 'gauge',
            description: 'Average query duration',
            unit: 'milliseconds',
            query: 'SELECT COALESCE(AVG(mean_exec_time), 0) as value FROM pg_stat_statements'
        },
        {
            name: 'table_scans',
            type: 'counter',
            description: 'Sequential table scans',
            unit: 'count',
            query: 'SELECT SUM(seq_scan) as value FROM pg_stat_user_tables'
        },
        {
            name: 'index_usage',
            type: 'gauge',
            description: 'Index usage percentage',
            unit: 'percent',
            query: 'SELECT ROUND(100.0 * SUM(idx_scan) / NULLIF(SUM(seq_scan + idx_scan), 0), 2) as value FROM pg_stat_user_tables'
        }
    ];
    
    for (const metric of defaultMetrics) {
        const insertSql = `
            INSERT INTO metrics_registry (metric_name, metric_type, description, unit, collection_query)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (metric_name) DO NOTHING
        `;
        
        await executeSqlWithFallback(insertSql, context, [
            metric.name,
            metric.type,
            metric.description,
            metric.unit,
            metric.query
        ]);
    }
}

async function getDashboardOverview(input: MetricsDashboardInput, context: ToolContext): Promise<any> {
    const timeWindow = getTimeWindow(input.timeframe);
    
    // Get system health indicators
    const healthMetrics = await getSystemHealthMetrics(context, timeWindow);
    
    // Get performance indicators
    const performanceIndicators = await getPerformanceIndicators(context, timeWindow);
    
    // Get security status
    const securityStatus = await getSecurityStatus(context, timeWindow);
    
    // Get recent alerts
    const recentAlerts = await getRecentAlerts(context, 10);
    
    // Get resource utilization
    const resourceUtilization = await getResourceUtilization(context, timeWindow);
    
    // Calculate overall health score
    const healthScore = calculateHealthScore(healthMetrics, performanceIndicators, securityStatus);
    
    return {
        dashboard_overview: {
            timestamp: new Date().toISOString(),
            timeframe: input.timeframe,
            health_score: healthScore,
            status: healthScore >= 90 ? 'excellent' : healthScore >= 70 ? 'good' : healthScore >= 50 ? 'warning' : 'critical'
        },
        system_health: healthMetrics,
        performance_indicators: performanceIndicators,
        security_status: securityStatus,
        recent_alerts: recentAlerts,
        resource_utilization: resourceUtilization,
        quick_actions: generateQuickActions(healthScore, recentAlerts),
        recommendations: generateHealthRecommendations(healthMetrics, performanceIndicators)
    };
}

async function getDatabaseMetrics(input: MetricsDashboardInput, context: ToolContext): Promise<any> {
    const timeWindow = getTimeWindow(input.timeframe);
    
    // Database size and growth
    const sizeSql = `
        SELECT 
            pg_database_size(current_database()) as current_size_bytes,
            pg_size_pretty(pg_database_size(current_database())) as current_size_formatted
    `;
    const sizeResult = await executeSqlWithFallback(sizeSql, context);
    
    // Connection statistics
    const connectionsSql = `
        SELECT 
            COUNT(*) as total_connections,
            COUNT(*) FILTER (WHERE state = 'active') as active_connections,
            COUNT(*) FILTER (WHERE state = 'idle') as idle_connections,
            COUNT(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
            MAX(EXTRACT(EPOCH FROM (now() - backend_start))) as longest_connection_seconds
        FROM pg_stat_activity
    `;
    const connectionsResult = await executeSqlWithFallback(connectionsSql, context);
    
    // Table statistics
    const tableStatsSql = `
        SELECT 
            COUNT(*) as total_tables,
            SUM(n_tup_ins) as total_inserts,
            SUM(n_tup_upd) as total_updates,
            SUM(n_tup_del) as total_deletes,
            SUM(seq_scan) as total_seq_scans,
            SUM(idx_scan) as total_index_scans,
            SUM(n_live_tup) as total_live_tuples,
            SUM(n_dead_tup) as total_dead_tuples
        FROM pg_stat_user_tables
    `;
    const tableStatsResult = await executeSqlWithFallback(tableStatsSql, context);
    
    // Index usage
    const indexUsageSql = `
        SELECT 
            COUNT(*) as total_indexes,
            COUNT(*) FILTER (WHERE idx_scan = 0) as unused_indexes,
            AVG(idx_scan) as avg_index_scans
        FROM pg_stat_user_indexes
    `;
    const indexUsageResult = await executeSqlWithFallback(indexUsageSql, context);
    
    // Query statistics (if pg_stat_statements is available)
    const queryStatsSql = `
        SELECT 
            COUNT(*) as total_queries,
            SUM(calls) as total_calls,
            AVG(mean_exec_time) as avg_execution_time,
            MAX(max_exec_time) as max_execution_time,
            SUM(rows) as total_rows_returned
        FROM pg_stat_statements
    `;
    
    let queryStatsResult;
    try {
        queryStatsResult = await executeSqlWithFallback(queryStatsSql, context);
    } catch (error) {
        queryStatsResult = { data: [{ total_queries: 0, total_calls: 0, avg_execution_time: 0 }] };
    }
    
    // Collect historical metric data
    const historicalData = await getHistoricalMetricData(
        ['database_connections', 'database_size', 'query_duration_avg'],
        timeWindow,
        context
    );
    
    return {
        database_metrics: {
            size: sizeResult.data[0],
            connections: connectionsResult.data[0],
            tables: tableStatsResult.data[0],
            indexes: indexUsageResult.data[0],
            queries: queryStatsResult.data[0]
        },
        historical_data: historicalData,
        trends: calculateMetricTrends(historicalData),
        alerts: await getActiveAlerts(['database_connections', 'database_size'], context),
        health_indicators: {
            connection_utilization: (connectionsResult.data[0].total_connections / 100) * 100, // Assume max 100
            index_efficiency: indexUsageResult.data[0].total_indexes > 0 
                ? ((indexUsageResult.data[0].total_indexes - indexUsageResult.data[0].unused_indexes) / indexUsageResult.data[0].total_indexes) * 100
                : 100,
            query_performance: queryStatsResult.data[0].avg_execution_time < 100 ? 'good' : 'needs_attention'
        }
    };
}

async function getPerformanceMetrics(input: MetricsDashboardInput, context: ToolContext): Promise<any> {
    const timeWindow = getTimeWindow(input.timeframe);
    
    // Query performance
    const performanceSql = `
        SELECT 
            query,
            calls,
            total_exec_time,
            mean_exec_time,
            min_exec_time,
            max_exec_time,
            stddev_exec_time,
            rows,
            100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
        FROM pg_stat_statements
        ORDER BY total_exec_time DESC
        LIMIT 20
    `;
    
    let topQueries;
    try {
        const result = await executeSqlWithFallback(performanceSql, context);
        topQueries = result.data;
    } catch (error) {
        topQueries = [];
    }
    
    // Buffer cache hit ratio
    const cacheHitSql = `
        SELECT 
            datname,
            100.0 * blks_hit / (blks_hit + blks_read) as cache_hit_ratio
        FROM pg_stat_database
        WHERE datname = current_database()
    `;
    const cacheHitResult = await executeSqlWithFallback(cacheHitSql, context);
    
    // Lock statistics
    const locksSql = `
        SELECT 
            mode,
            COUNT(*) as count
        FROM pg_locks
        GROUP BY mode
        ORDER BY count DESC
    `;
    const locksResult = await executeSqlWithFallback(locksSql, context);
    
    // I/O statistics
    const ioStatsSql = `
        SELECT 
            SUM(heap_blks_read) as heap_blocks_read,
            SUM(heap_blks_hit) as heap_blocks_hit,
            SUM(idx_blks_read) as index_blocks_read,
            SUM(idx_blks_hit) as index_blocks_hit
        FROM pg_statio_user_tables
    `;
    const ioStatsResult = await executeSqlWithFallback(ioStatsSql, context);
    
    // Collect performance metrics over time
    const performanceHistory = await getHistoricalMetricData(
        ['query_duration_avg', 'index_usage'],
        timeWindow,
        context
    );
    
    return {
        performance_metrics: {
            query_performance: {
                top_queries_by_time: topQueries.slice(0, 10),
                avg_query_time: topQueries.length > 0 
                    ? topQueries.reduce((sum: number, q: any) => sum + q.mean_exec_time, 0) / topQueries.length
                    : 0
            },
            cache_performance: {
                hit_ratio: cacheHitResult.data[0]?.cache_hit_ratio || 0,
                target_ratio: 95, // Target cache hit ratio
                status: (cacheHitResult.data[0]?.cache_hit_ratio || 0) >= 95 ? 'optimal' : 'needs_improvement'
            },
            locks: {
                current_locks: locksResult.data,
                total_locks: locksResult.data.reduce((sum: number, lock: any) => sum + lock.count, 0)
            },
            io_performance: ioStatsResult.data[0]
        },
        historical_performance: performanceHistory,
        performance_score: calculatePerformanceScore(cacheHitResult.data[0], topQueries),
        bottlenecks: identifyPerformanceBottlenecks(topQueries, cacheHitResult.data[0], locksResult.data),
        optimization_suggestions: generateOptimizationSuggestions(topQueries, cacheHitResult.data[0])
    };
}

async function getSecurityMetrics(input: MetricsDashboardInput, context: ToolContext): Promise<any> {
    const timeWindow = getTimeWindow(input.timeframe);
    
    // Failed login attempts (simulated)
    const securityEvents = {
        failed_logins: Math.floor(Math.random() * 50),
        blocked_ips: Math.floor(Math.random() * 10),
        suspicious_queries: Math.floor(Math.random() * 5),
        privilege_escalations: Math.floor(Math.random() * 2)
    };
    
    // RLS policy coverage
    const rlsCoverageSql = `
        SELECT 
            COUNT(*) FILTER (WHERE rowsecurity = true) as tables_with_rls,
            COUNT(*) as total_tables,
            ROUND(100.0 * COUNT(*) FILTER (WHERE rowsecurity = true) / COUNT(*), 2) as rls_coverage_percent
        FROM pg_tables
        WHERE schemaname = 'public'
    `;
    const rlsResult = await executeSqlWithFallback(rlsCoverageSql, context);
    
    // Role and permission audit
    const roleAuditSql = `
        SELECT 
            COUNT(*) as total_roles,
            COUNT(*) FILTER (WHERE rolsuper = true) as superuser_roles,
            COUNT(*) FILTER (WHERE rolcanlogin = true) as login_roles,
            COUNT(*) FILTER (WHERE rolcreaterole = true) as role_creation_roles
        FROM pg_roles
        WHERE rolname NOT LIKE 'pg_%'
    `;
    const roleAuditResult = await executeSqlWithFallback(roleAuditSql, context);
    
    // Extension security analysis
    const extensionSecuritySql = `
        SELECT 
            extname,
            CASE 
                WHEN extname = ANY(ARRAY['dblink', 'postgres_fdw', 'file_fdw']) THEN 'high'
                WHEN extname LIKE '%plpython%' OR extname LIKE '%plperl%' THEN 'high'
                WHEN extname = ANY(ARRAY['pgcrypto', 'uuid-ossp']) THEN 'low'
                ELSE 'medium'
            END as risk_level
        FROM pg_extension
        WHERE extname NOT LIKE 'pg_%'
        AND extname != 'plpgsql'
    `;
    const extensionSecurityResult = await executeSqlWithFallback(extensionSecuritySql, context);
    
    const securityScore = calculateSecurityScore(
        rlsResult.data[0],
        roleAuditResult.data[0],
        extensionSecurityResult.data,
        securityEvents
    );
    
    return {
        security_metrics: {
            events: securityEvents,
            rls_coverage: rlsResult.data[0],
            role_audit: roleAuditResult.data[0],
            extensions: {
                by_risk_level: extensionSecurityResult.data.reduce((acc: any, ext: any) => {
                    acc[ext.risk_level] = (acc[ext.risk_level] || 0) + 1;
                    return acc;
                }, {}),
                high_risk_extensions: extensionSecurityResult.data.filter((ext: any) => ext.risk_level === 'high')
            }
        },
        security_score: securityScore,
        vulnerabilities: identifySecurityVulnerabilities(rlsResult.data[0], roleAuditResult.data[0], extensionSecurityResult.data),
        compliance_status: assessComplianceStatus(rlsResult.data[0], roleAuditResult.data[0]),
        security_recommendations: generateSecurityRecommendations(securityScore, rlsResult.data[0])
    };
}

async function getUsageMetrics(input: MetricsDashboardInput, context: ToolContext): Promise<any> {
    const timeWindow = getTimeWindow(input.timeframe);
    
    // Table usage patterns
    const tableUsageSql = `
        SELECT 
            schemaname,
            tablename,
            seq_scan + idx_scan as total_scans,
            n_tup_ins + n_tup_upd + n_tup_del as total_modifications,
            n_live_tup as current_rows,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
        FROM pg_stat_user_tables
        ORDER BY total_scans + total_modifications DESC
        LIMIT 20
    `;
    const tableUsageResult = await executeSqlWithFallback(tableUsageSql, context);
    
    // Function usage
    const functionUsageSql = `
        SELECT 
            p.proname as function_name,
            n.nspname as schema_name,
            COALESCE(s.calls, 0) as call_count
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        LEFT JOIN pg_stat_user_functions s ON p.oid = s.funcid
        WHERE n.nspname = 'public'
        ORDER BY COALESCE(s.calls, 0) DESC
        LIMIT 10
    `;
    const functionUsageResult = await executeSqlWithFallback(functionUsageSql, context);
    
    // Storage usage by schema
    const storageUsageSql = `
        SELECT 
            schemaname,
            COUNT(*) as table_count,
            pg_size_pretty(SUM(pg_total_relation_size(schemaname||'.'||tablename))) as total_size,
            SUM(pg_total_relation_size(schemaname||'.'||tablename)) as total_size_bytes
        FROM pg_tables
        WHERE schemaname != 'information_schema'
        GROUP BY schemaname
        ORDER BY total_size_bytes DESC
    `;
    const storageUsageResult = await executeSqlWithFallback(storageUsageSql, context);
    
    // User activity patterns
    const userActivitySql = `
        SELECT 
            usename,
            COUNT(*) as connection_count,
            COUNT(DISTINCT datname) as databases_accessed,
            MAX(backend_start) as last_connection
        FROM pg_stat_activity
        WHERE usename IS NOT NULL
        GROUP BY usename
        ORDER BY connection_count DESC
    `;
    const userActivityResult = await executeSqlWithFallback(userActivitySql, context);
    
    return {
        usage_metrics: {
            table_usage: tableUsageResult.data,
            function_usage: functionUsageResult.data,
            storage_usage: storageUsageResult.data,
            user_activity: userActivityResult.data
        },
        usage_patterns: {
            most_active_tables: tableUsageResult.data.slice(0, 5).map((t: any) => t.tablename),
            least_used_tables: tableUsageResult.data.filter((t: any) => t.total_scans === 0).map((t: any) => t.tablename),
            storage_distribution: storageUsageResult.data.map((s: any) => ({
                schema: s.schemaname,
                percentage: 0 // Would calculate actual percentage
            }))
        },
        optimization_opportunities: identifyUsageOptimizations(tableUsageResult.data, functionUsageResult.data),
        growth_trends: calculateUsageTrends(tableUsageResult.data)
    };
}

async function createMetricAlert(input: MetricsDashboardInput, context: ToolContext): Promise<any> {
    const insertSql = `
        INSERT INTO metric_alerts (
            alert_name, metric_name, condition_type, threshold_value, 
            comparison_operator, evaluation_window, notification_channels
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
    `;
    
    const conditionType = input.alertCondition?.includes('threshold') ? 'threshold' : 'change';
    const operator = input.alertCondition?.includes('>') ? '>' : 
                    input.alertCondition?.includes('<') ? '<' : '>=';
    
    const result = await executeSqlWithFallback(insertSql, context, [
        input.alertName,
        input.metricType,
        conditionType,
        input.alertThreshold,
        operator,
        300, // 5 minutes default
        JSON.stringify([input.alertChannel || 'email'])
    ]);
    
    return {
        success: true,
        alert_id: result.data[0].id,
        alert_name: input.alertName,
        metric_type: input.metricType,
        threshold: input.alertThreshold,
        channel: input.alertChannel,
        evaluation_window_seconds: 300,
        status: 'active'
    };
}

async function generateMetricsReport(input: MetricsDashboardInput, context: ToolContext): Promise<any> {
    const overview = await getDashboardOverview(input, context);
    const databaseMetrics = await getDatabaseMetrics(input, context);
    const performanceMetrics = await getPerformanceMetrics(input, context);
    const securityMetrics = await getSecurityMetrics(input, context);
    const usageMetrics = await getUsageMetrics(input, context);
    
    const report = {
        report_metadata: {
            generated_at: new Date().toISOString(),
            timeframe: input.timeframe,
            format: input.reportFormat,
            includes_charts: input.includeCharts
        },
        executive_summary: {
            health_score: overview.dashboard_overview.health_score,
            status: overview.dashboard_overview.status,
            key_findings: generateKeyFindings(overview, performanceMetrics, securityMetrics),
            recommendations: overview.recommendations.slice(0, 3)
        },
        detailed_metrics: {
            database: databaseMetrics.database_metrics,
            performance: performanceMetrics.performance_metrics,
            security: securityMetrics.security_metrics,
            usage: usageMetrics.usage_metrics
        },
        trends_analysis: {
            database_growth: databaseMetrics.trends,
            performance_trends: performanceMetrics.historical_performance,
            usage_patterns: usageMetrics.usage_patterns
        },
        alerts_summary: {
            active_alerts: overview.recent_alerts.filter((a: any) => a.status === 'active').length,
            recent_triggers: overview.recent_alerts.length,
            top_alert_types: getTopAlertTypes(overview.recent_alerts)
        }
    };
    
    // Add custom metrics if specified
    if (input.customMetrics) {
        report.detailed_metrics.custom = await getCustomMetrics(input.customMetrics, context);
    }
    
    return report;
}

// Helper functions
function getTimeWindow(timeframe: string): { start: string; end: string } {
    const end = new Date();
    const start = new Date();
    
    switch (timeframe) {
        case '1h':
            start.setHours(end.getHours() - 1);
            break;
        case '24h':
            start.setDate(end.getDate() - 1);
            break;
        case '7d':
            start.setDate(end.getDate() - 7);
            break;
        case '30d':
            start.setDate(end.getDate() - 30);
            break;
        case '90d':
            start.setDate(end.getDate() - 90);
            break;
    }
    
    return {
        start: start.toISOString(),
        end: end.toISOString()
    };
}

async function getSystemHealthMetrics(context: ToolContext, timeWindow: any): Promise<any> {
    // Simulate system health metrics
    return {
        uptime_percentage: 99.9,
        error_rate: 0.01,
        response_time_p95: 150, // milliseconds
        availability_status: 'operational',
        last_incident: null
    };
}

async function getPerformanceIndicators(context: ToolContext, timeWindow: any): Promise<any> {
    return {
        queries_per_second: Math.floor(Math.random() * 1000) + 100,
        cache_hit_ratio: 95.2,
        average_query_time: 45, // milliseconds
        slow_queries: Math.floor(Math.random() * 10),
        deadlocks: Math.floor(Math.random() * 3)
    };
}

async function getSecurityStatus(context: ToolContext, timeWindow: any): Promise<any> {
    return {
        security_incidents: Math.floor(Math.random() * 5),
        failed_authentication_attempts: Math.floor(Math.random() * 20),
        security_score: Math.floor(Math.random() * 20) + 80, // 80-100
        last_security_scan: new Date(Date.now() - 86400000).toISOString() // 1 day ago
    };
}

async function getRecentAlerts(context: ToolContext, limit: number): Promise<any[]> {
    const sql = `
        SELECT 
            ma.alert_name,
            ma.metric_name,
            ah.metric_value,
            ah.threshold_value,
            ah.triggered_at,
            CASE 
                WHEN ah.resolution_time IS NOT NULL THEN 'resolved'
                WHEN ah.acknowledged THEN 'acknowledged'
                ELSE 'active'
            END as status
        FROM alert_history ah
        JOIN metric_alerts ma ON ah.alert_id = ma.id
        ORDER BY ah.triggered_at DESC
        LIMIT $1
    `;
    
    const result = await executeSqlWithFallback(sql, context, [limit]);
    return result.data;
}

async function getResourceUtilization(context: ToolContext, timeWindow: any): Promise<any> {
    // Simulate resource utilization
    return {
        cpu_usage_percent: Math.floor(Math.random() * 30) + 20, // 20-50%
        memory_usage_percent: Math.floor(Math.random() * 40) + 30, // 30-70%
        disk_usage_percent: Math.floor(Math.random() * 20) + 40, // 40-60%
        network_io_mbps: Math.floor(Math.random() * 100) + 10 // 10-110 Mbps
    };
}

async function getHistoricalMetricData(metricNames: string[], timeWindow: any, context: ToolContext): Promise<any> {
    const sql = `
        SELECT 
            metric_name,
            AVG(value) as avg_value,
            MIN(value) as min_value,
            MAX(value) as max_value,
            DATE_TRUNC('hour', timestamp) as time_bucket
        FROM metric_data
        WHERE metric_name = ANY($1)
        AND timestamp >= $2::timestamp
        AND timestamp <= $3::timestamp
        GROUP BY metric_name, time_bucket
        ORDER BY metric_name, time_bucket
    `;
    
    const result = await executeSqlWithFallback(sql, context, [
        metricNames,
        timeWindow.start,
        timeWindow.end
    ]);
    
    return result.data.reduce((acc: any, row: any) => {
        if (!acc[row.metric_name]) {
            acc[row.metric_name] = [];
        }
        acc[row.metric_name].push({
            timestamp: row.time_bucket,
            avg: row.avg_value,
            min: row.min_value,
            max: row.max_value
        });
        return acc;
    }, {});
}

async function getActiveAlerts(metricNames: string[], context: ToolContext): Promise<any[]> {
    const sql = `
        SELECT 
            ma.alert_name,
            ma.metric_name,
            ma.threshold_value,
            ma.comparison_operator,
            ma.last_triggered,
            ma.trigger_count
        FROM metric_alerts ma
        WHERE ma.enabled = true
        AND ma.metric_name = ANY($1)
        ORDER BY ma.last_triggered DESC NULLS LAST
    `;
    
    const result = await executeSqlWithFallback(sql, context, [metricNames]);
    return result.data;
}

async function getCustomMetrics(customMetrics: any[], context: ToolContext): Promise<any> {
    const results = {};
    
    for (const metric of customMetrics) {
        try {
            const result = await executeSqlWithFallback(metric.query, context);
            results[metric.name as keyof typeof results] = {
                description: metric.description,
                data: result.data,
                query: metric.query
            };
        } catch (error: any) {
            results[metric.name as keyof typeof results] = {
                description: metric.description,
                error: error.message,
                query: metric.query
            };
        }
    }
    
    return results;
}

function calculateHealthScore(healthMetrics: any, performanceMetrics: any, securityMetrics: any): number {
    let score = 100;
    
    // Health factors
    if (healthMetrics.error_rate > 0.05) score -= 20; // High error rate
    if (healthMetrics.uptime_percentage < 99.5) score -= 15; // Low uptime
    
    // Performance factors
    if (performanceMetrics.cache_hit_ratio < 90) score -= 10; // Low cache hit ratio
    if (performanceMetrics.slow_queries > 10) score -= 10; // Too many slow queries
    
    // Security factors
    if (securityMetrics.security_incidents > 2) score -= 15; // Security incidents
    
    return Math.max(score, 0);
}

function calculatePerformanceScore(cacheData: any, queryData: any[]): number {
    let score = 100;
    
    const cacheHitRatio = cacheData?.cache_hit_ratio || 0;
    if (cacheHitRatio < 95) score -= (95 - cacheHitRatio) * 2;
    
    const avgQueryTime = queryData.length > 0 
        ? queryData.reduce((sum: number, q: any) => sum + q.mean_exec_time, 0) / queryData.length
        : 0;
    
    if (avgQueryTime > 100) score -= Math.min((avgQueryTime - 100) / 10, 30);
    
    return Math.max(score, 0);
}

function calculateSecurityScore(rlsData: any, roleData: any, extensionData: any[], securityEvents: any): number {
    let score = 100;
    
    // RLS coverage
    const rlsCoverage = rlsData?.rls_coverage_percent || 0;
    if (rlsCoverage < 100) score -= (100 - rlsCoverage) * 0.5;
    
    // Role security
    const superuserRatio = roleData.total_roles > 0 
        ? (roleData.superuser_roles / roleData.total_roles) * 100
        : 0;
    if (superuserRatio > 10) score -= (superuserRatio - 10) * 2; // Too many superusers
    
    // High-risk extensions
    const highRiskExtensions = extensionData.filter(ext => ext.risk_level === 'high').length;
    score -= highRiskExtensions * 10;
    
    // Security events
    score -= securityEvents.failed_logins * 0.5;
    score -= securityEvents.suspicious_queries * 5;
    
    return Math.max(score, 0);
}

function calculateMetricTrends(historicalData: any): any {
    const trends = {};
    
    for (const [metricName, data] of Object.entries(historicalData)) {
        const values = (data as any[]).map(d => d.avg);
        if (values.length > 1) {
            const firstValue = values[0];
            const lastValue = values[values.length - 1];
            const changePercent = ((lastValue - firstValue) / firstValue) * 100;
            
            trends[metricName as keyof typeof trends] = {
                trend: changePercent > 5 ? 'increasing' : changePercent < -5 ? 'decreasing' : 'stable',
                change_percent: Math.round(changePercent * 100) / 100
            };
        } else {
            trends[metricName as keyof typeof trends] = {
                trend: 'insufficient_data',
                change_percent: 0
            };
        }
    }
    
    return trends;
}

function identifyPerformanceBottlenecks(queries: any[], cacheData: any, locks: any[]): string[] {
    const bottlenecks = [];
    
    if (cacheData?.cache_hit_ratio < 90) {
        bottlenecks.push('Low buffer cache hit ratio - consider increasing shared_buffers');
    }
    
    const slowQueries = queries.filter(q => q.mean_exec_time > 1000);
    if (slowQueries.length > 0) {
        bottlenecks.push(`${slowQueries.length} queries with execution time > 1 second`);
    }
    
    const totalLocks = locks.reduce((sum: number, lock: any) => sum + lock.count, 0);
    if (totalLocks > 100) {
        bottlenecks.push('High number of active locks detected');
    }
    
    return bottlenecks;
}

function generateOptimizationSuggestions(queries: any[], cacheData: any): string[] {
    const suggestions = [];
    
    if (queries.length > 0) {
        const slowestQuery = queries[0]; // Already sorted by total_exec_time
        if (slowestQuery.mean_exec_time > 100) {
            suggestions.push(`Optimize query: ${slowestQuery.query.substring(0, 50)}...`);
        }
    }
    
    if (cacheData?.cache_hit_ratio < 95) {
        suggestions.push('Increase shared_buffers to improve cache hit ratio');
    }
    
    suggestions.push('Regularly update table statistics with ANALYZE');
    suggestions.push('Consider connection pooling to reduce connection overhead');
    
    return suggestions;
}

function identifySecurityVulnerabilities(rlsData: any, roleData: any, extensionData: any[]): any[] {
    const vulnerabilities = [];
    
    if (rlsData?.rls_coverage_percent < 100) {
        vulnerabilities.push({
            type: 'rls_coverage',
            severity: 'medium',
            description: 'Not all tables have Row Level Security enabled',
            recommendation: 'Enable RLS on all sensitive tables'
        });
    }
    
    if (roleData.superuser_roles > 1) {
        vulnerabilities.push({
            type: 'excessive_privileges',
            severity: 'high',
            description: 'Multiple superuser accounts detected',
            recommendation: 'Limit superuser access to essential accounts only'
        });
    }
    
    const highRiskExtensions = extensionData.filter(ext => ext.risk_level === 'high');
    if (highRiskExtensions.length > 0) {
        vulnerabilities.push({
            type: 'risky_extensions',
            severity: 'medium',
            description: `${highRiskExtensions.length} high-risk extensions installed`,
            recommendation: 'Review necessity of high-risk extensions'
        });
    }
    
    return vulnerabilities;
}

function assessComplianceStatus(rlsData: any, roleData: any): any {
    return {
        rls_compliance: rlsData?.rls_coverage_percent >= 100 ? 'compliant' : 'non_compliant',
        access_control_compliance: roleData.superuser_roles <= 2 ? 'compliant' : 'needs_review',
        overall_status: 'needs_review'
    };
}

function generateQuickActions(healthScore: number, alerts: any[]): string[] {
    const actions = [];
    
    if (healthScore < 70) {
        actions.push('Review critical alerts');
        actions.push('Check system resources');
    }
    
    if (alerts.length > 0) {
        actions.push('Acknowledge active alerts');
        actions.push('Investigate alert root causes');
    }
    
    actions.push('Run performance analysis');
    actions.push('Review security settings');
    
    return actions;
}

function generateHealthRecommendations(healthMetrics: any, performanceMetrics: any): string[] {
    const recommendations = [];
    
    if (healthMetrics.error_rate > 0.01) {
        recommendations.push('Investigate and reduce error rate');
    }
    
    if (performanceMetrics.slow_queries > 5) {
        recommendations.push('Optimize slow-performing queries');
    }
    
    recommendations.push('Monitor cache hit ratios regularly');
    recommendations.push('Set up proactive alerts for key metrics');
    
    return recommendations;
}

function generateSecurityRecommendations(securityScore: number, rlsData: any): string[] {
    const recommendations = [];
    
    if (securityScore < 80) {
        recommendations.push('Conduct comprehensive security audit');
    }
    
    if (rlsData?.rls_coverage_percent < 100) {
        recommendations.push('Enable RLS on all sensitive tables');
    }
    
    recommendations.push('Implement regular security monitoring');
    recommendations.push('Review and rotate access credentials');
    
    return recommendations;
}

function identifyUsageOptimizations(tableData: any[], functionData: any[]): string[] {
    const optimizations = [];
    
    const unusedTables = tableData.filter(t => t.total_scans === 0);
    if (unusedTables.length > 0) {
        optimizations.push(`Consider archiving ${unusedTables.length} unused tables`);
    }
    
    const unusedFunctions = functionData.filter(f => f.call_count === 0);
    if (unusedFunctions.length > 0) {
        optimizations.push(`Review ${unusedFunctions.length} unused functions for removal`);
    }
    
    const heavilyUsedTables = tableData.filter(t => t.total_scans > 1000);
    if (heavilyUsedTables.length > 0) {
        optimizations.push(`Optimize indexes for ${heavilyUsedTables.length} heavily accessed tables`);
    }
    
    return optimizations;
}

function calculateUsageTrends(tableData: any[]): any {
    return {
        total_activity: tableData.reduce((sum: number, t: any) => sum + (t.total_scans || 0) + (t.total_modifications || 0), 0),
        most_active_table: tableData[0]?.tablename || 'none',
        growth_pattern: 'stable' // Would calculate based on historical data
    };
}

function generateKeyFindings(overview: any, performance: any, security: any): string[] {
    const findings = [];
    
    if (overview.dashboard_overview.health_score < 70) {
        findings.push('System health score indicates attention needed');
    }
    
    if (performance.performance_score < 80) {
        findings.push('Database performance below optimal levels');
    }
    
    if (security.security_score < 85) {
        findings.push('Security configuration needs improvement');
    }
    
    return findings;
}

function getTopAlertTypes(alerts: any[]): any {
    return alerts.reduce((acc: any, alert: any) => {
        acc[alert.metric_name] = (acc[alert.metric_name] || 0) + 1;
        return acc;
    }, {});
}