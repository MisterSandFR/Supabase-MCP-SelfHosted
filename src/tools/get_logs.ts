import { z } from 'zod';
import { ToolContext } from './types.js';

// Input schema for the tool
const GetLogsInputSchema = z.object({
    service: z.enum([
        'postgres', 
        'auth', 
        'rest', 
        'realtime', 
        'storage', 
        'imgproxy', 
        'kong', 
        'meta', 
        'functions', 
        'analytics',
        'vector',
        'supavisor'
    ]).optional().describe('Specific service to get logs from. If not provided, returns all available logs'),
    lines: z.number().min(1).max(10000).default(100).describe('Number of log lines to retrieve (default: 100, max: 10000)'),
    filter: z.string().optional().describe('Text to filter log entries (case-insensitive)'),
    since: z.string().optional().describe('ISO 8601 timestamp to get logs since (e.g., 2024-01-01T00:00:00Z)'),
    level: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).optional().describe('Minimum log level to retrieve')
});

type GetLogsInput = z.infer<typeof GetLogsInputSchema>;

// Output schema
const GetLogsOutputSchema = z.object({
    logs: z.array(z.object({
        timestamp: z.string(),
        service: z.string(),
        level: z.string(),
        message: z.string(),
        metadata: z.record(z.any()).optional()
    })),
    total_count: z.number(),
    filtered_count: z.number(),
    services_available: z.array(z.string())
});

/**
 * Tool for retrieving logs from various Supabase services
 * Works by querying system tables and log files where available
 */
export const getLogsTool = {
    name: 'get_logs',
    description: 'Retrieves logs from various Supabase services (postgres, auth, storage, etc.). Requires direct database access.',
    inputSchema: GetLogsInputSchema,
    outputSchema: GetLogsOutputSchema,
    mcpInputSchema: {
        type: 'object',
        properties: {
            service: {
                type: 'string',
                description: 'Specific service to get logs from',
                enum: ['postgres', 'auth', 'rest', 'realtime', 'storage', 'imgproxy', 'kong', 'meta', 'functions', 'analytics', 'vector', 'supavisor']
            },
            lines: {
                type: 'number',
                description: 'Number of log lines to retrieve (default: 100, max: 10000)',
                default: 100
            },
            filter: {
                type: 'string',
                description: 'Text to filter log entries (case-insensitive)'
            },
            since: {
                type: 'string',
                description: 'ISO 8601 timestamp to get logs since'
            },
            level: {
                type: 'string',
                description: 'Minimum log level to retrieve',
                enum: ['debug', 'info', 'warn', 'error', 'fatal']
            }
        }
    },
    execute: async (input: unknown, context: ToolContext) => {
        const { service, lines = 100, filter, since, level } = GetLogsInputSchema.parse(input);
        const { selfhostedClient } = context;
        
        const logs: any[] = [];
        const services_available: string[] = [];
        
        try {
            // PostgreSQL logs from pg_stat_statements and server logs
            if (!service || service === 'postgres') {
                services_available.push('postgres');
                
                // Get recent queries from pg_stat_statements if available
                const pgLogsQuery = `
                    WITH recent_statements AS (
                        SELECT 
                            now() as log_time,
                            'postgres' as service,
                            CASE 
                                WHEN mean_exec_time > 1000 THEN 'warn'
                                WHEN total_exec_time > 10000 THEN 'info'
                                ELSE 'debug'
                            END as level,
                            query,
                            calls,
                            mean_exec_time,
                            total_exec_time,
                            rows
                        FROM pg_stat_statements
                        WHERE query NOT LIKE '%pg_stat_statements%'
                        ${since ? `AND now() - interval '${(Date.now() - new Date(since).getTime()) / 1000} seconds' <= now()` : ''}
                        ORDER BY mean_exec_time DESC
                        LIMIT ${Math.min(lines, 100)}
                    )
                    SELECT * FROM recent_statements
                    ${filter ? `WHERE query ILIKE '%${filter.replace(/'/g, "''")}%'` : ''}
                `;
                
                try {
                    const pgResult = await selfhostedClient.executeSqlWithFallback(pgLogsQuery, { queryType: 'read' });
                    if (pgResult?.rows) {
                        pgResult.rows.forEach((row: any) => {
                            logs.push({
                                timestamp: new Date(row.log_time).toISOString(),
                                service: 'postgres',
                                level: row.level,
                                message: `Query executed ${row.calls} times, avg: ${row.mean_exec_time.toFixed(2)}ms, total: ${row.total_exec_time.toFixed(2)}ms, rows: ${row.rows}`,
                                metadata: {
                                    query: row.query.substring(0, 200),
                                    calls: row.calls,
                                    mean_exec_time: row.mean_exec_time,
                                    total_exec_time: row.total_exec_time,
                                    rows: row.rows
                                }
                            });
                        });
                    }
                } catch (err) {
                    // pg_stat_statements might not be enabled
                    context.log('pg_stat_statements not available, trying alternative log sources', 'warn');
                }
                
                // Get recent errors from PostgreSQL
                const errorQuery = `
                    SELECT 
                        now() as log_time,
                        'postgres' as service,
                        'error' as level,
                        'Database error: ' || COALESCE(message, 'Unknown error') as message
                    FROM pg_stat_database_conflicts
                    WHERE datname = current_database()
                    LIMIT 10
                `;
                
                try {
                    const errorResult = await selfhostedClient.executeSqlWithFallback(errorQuery, { queryType: 'read' });
                    if (errorResult?.rows && errorResult.rows.length > 0) {
                        errorResult.rows.forEach((row: any) => {
                            logs.push({
                                timestamp: new Date(row.log_time).toISOString(),
                                service: 'postgres',
                                level: 'error',
                                message: row.message
                            });
                        });
                    }
                } catch (err) {
                    // Ignore if this view is not accessible
                }
            }
            
            // Auth logs from auth.audit_log_entries
            if (!service || service === 'auth') {
                services_available.push('auth');
                
                const authLogsQuery = `
                    SELECT 
                        created_at,
                        'auth' as service,
                        CASE 
                            WHEN payload->>'error' IS NOT NULL THEN 'error'
                            WHEN payload->>'action' LIKE '%fail%' THEN 'warn'
                            ELSE 'info'
                        END as level,
                        COALESCE(
                            payload->>'action',
                            'Auth event'
                        ) || ': ' || COALESCE(
                            payload->>'error',
                            payload->>'message',
                            'Success'
                        ) as message,
                        ip_address,
                        payload
                    FROM auth.audit_log_entries
                    ${since ? `WHERE created_at >= '${since}'::timestamptz` : ''}
                    ${filter ? `${since ? 'AND' : 'WHERE'} (payload::text ILIKE '%${filter.replace(/'/g, "''")}%' OR ip_address::text ILIKE '%${filter.replace(/'/g, "''")}%')` : ''}
                    ORDER BY created_at DESC
                    LIMIT ${Math.min(lines, 1000)}
                `;
                
                try {
                    const authResult = await selfhostedClient.executeSqlWithFallback(authLogsQuery, { queryType: 'read' });
                    if (authResult?.rows) {
                        authResult.rows.forEach((row: any) => {
                            const logLevel = row.level;
                            if (!level || isLogLevelHighEnough(logLevel, level)) {
                                logs.push({
                                    timestamp: new Date(row.created_at).toISOString(),
                                    service: 'auth',
                                    level: logLevel,
                                    message: row.message,
                                    metadata: {
                                        ip_address: row.ip_address,
                                        ...(row.payload || {})
                                    }
                                });
                            }
                        });
                    }
                } catch (err) {
                    context.log('Auth audit logs not accessible', 'warn');
                }
            }
            
            // Storage logs from storage.objects metadata
            if (!service || service === 'storage') {
                services_available.push('storage');
                
                const storageLogsQuery = `
                    SELECT 
                        created_at,
                        'storage' as service,
                        'info' as level,
                        'Object ' || CASE 
                            WHEN created_at = updated_at THEN 'created'
                            ELSE 'updated'
                        END || ': ' || name || ' in bucket: ' || bucket_id as message,
                        bucket_id,
                        name,
                        metadata,
                        owner
                    FROM storage.objects
                    ${since ? `WHERE created_at >= '${since}'::timestamptz OR updated_at >= '${since}'::timestamptz` : ''}
                    ${filter ? `${since ? 'AND' : 'WHERE'} (name ILIKE '%${filter.replace(/'/g, "''")}%' OR bucket_id ILIKE '%${filter.replace(/'/g, "''")}%')` : ''}
                    ORDER BY GREATEST(created_at, updated_at) DESC
                    LIMIT ${Math.min(lines, 500)}
                `;
                
                try {
                    const storageResult = await selfhostedClient.executeSqlWithFallback(storageLogsQuery, { queryType: 'read' });
                    if (storageResult?.rows) {
                        storageResult.rows.forEach((row: any) => {
                            if (!level || isLogLevelHighEnough('info', level)) {
                                logs.push({
                                    timestamp: new Date(row.created_at).toISOString(),
                                    service: 'storage',
                                    level: 'info',
                                    message: row.message,
                                    metadata: {
                                        bucket_id: row.bucket_id,
                                        object_name: row.name,
                                        owner: row.owner,
                                        ...(row.metadata || {})
                                    }
                                });
                            }
                        });
                    }
                } catch (err) {
                    context.log('Storage logs not accessible', 'warn');
                }
            }
            
            // Realtime/WebSocket connection logs
            if (!service || service === 'realtime') {
                services_available.push('realtime');
                
                const realtimeQuery = `
                    SELECT 
                        now() as log_time,
                        'realtime' as service,
                        'info' as level,
                        'Publication: ' || pubname || ' (' || 
                        CASE puballtables 
                            WHEN true THEN 'all tables' 
                            ELSE 'specific tables'
                        END || ')' as message
                    FROM pg_publication
                    WHERE pubname LIKE '%realtime%' OR pubname = 'supabase_realtime'
                `;
                
                try {
                    const realtimeResult = await selfhostedClient.executeSqlWithFallback(realtimeQuery, { queryType: 'read' });
                    if (realtimeResult?.rows) {
                        realtimeResult.rows.forEach((row: any) => {
                            if (!level || isLogLevelHighEnough('info', level)) {
                                logs.push({
                                    timestamp: new Date(row.log_time).toISOString(),
                                    service: 'realtime',
                                    level: 'info',
                                    message: row.message
                                });
                            }
                        });
                    }
                } catch (err) {
                    context.log('Realtime logs not accessible', 'warn');
                }
            }
            
            // Sort logs by timestamp (newest first)
            logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            
            // Apply line limit
            const limitedLogs = logs.slice(0, lines);
            
            return {
                logs: limitedLogs,
                total_count: logs.length,
                filtered_count: limitedLogs.length,
                services_available
            };
            
        } catch (error) {
            throw new Error(`Failed to retrieve logs: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
};

// Helper function to check if a log level meets the minimum requirement
function isLogLevelHighEnough(logLevel: string, minLevel: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error', 'fatal'];
    const logIndex = levels.indexOf(logLevel.toLowerCase());
    const minIndex = levels.indexOf(minLevel.toLowerCase());
    return logIndex >= minIndex;
}