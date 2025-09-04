import { Tool } from "@modelcontextprotocol/sdk/dist/types.js";
import { z } from "zod";
import { ToolContext } from "./types.js";
import { executeSqlWithFallback } from "./utils.js";

const AutoCreateIndexesInputSchema = z.object({
    action: z.enum(['analyze', 'suggest', 'create', 'drop_unused', 'rebuild']).describe("Action to perform"),
    minUsage: z.number().optional().default(100).describe("Minimum query usage for index suggestion"),
    minSize: z.number().optional().default(1000).describe("Minimum table size for indexing"),
    autoApply: z.boolean().optional().default(false).describe("Automatically apply suggestions"),
    includePartial: z.boolean().optional().default(true).describe("Include partial indexes"),
    analyzeOnly: z.boolean().optional().default(false).describe("Only analyze, don't create")
});

type AutoCreateIndexesInput = z.infer<typeof AutoCreateIndexesInputSchema>;

const AutoCreateIndexesOutputSchema = z.object({
    content: z.array(z.object({
        type: z.literal("text"),
        text: z.string()
    }))
});

export const autoCreateIndexesTool = {
    name: "auto_create_indexes",
    description: "Automatically analyze queries and create optimal indexes for performance",
    inputSchema: AutoCreateIndexesInputSchema,
    mcpInputSchema: {
        type: "object",
        properties: {
            action: {
                type: "string",
                enum: ["analyze", "suggest", "create", "drop_unused", "rebuild"],
                description: "Action to perform"
            },
            minUsage: { type: "number", description: "Minimum query usage" },
            minSize: { type: "number", description: "Minimum table size" },
            autoApply: { type: "boolean", description: "Auto apply suggestions" },
            includePartial: { type: "boolean", description: "Include partial indexes" },
            analyzeOnly: { type: "boolean", description: "Only analyze" }
        },
        required: ["action"]
    },
    outputSchema: AutoCreateIndexesOutputSchema,
    execute: async (input: unknown, context: ToolContext) => {
        const validatedInput = AutoCreateIndexesInputSchema.parse(input || {});
        
        switch (validatedInput.action) {
            case 'analyze':
            case 'suggest': {
                // Find missing indexes from pg_stat_user_tables
                const missingIndexesSql = `
                    WITH table_stats AS (
                        SELECT
                            schemaname,
                            tablename,
                            n_tup_ins + n_tup_upd + n_tup_del as write_activity,
                            seq_scan,
                            seq_tup_read,
                            idx_scan,
                            n_live_tup,
                            pg_relation_size(schemaname||'.'||tablename) as table_size
                        FROM pg_stat_user_tables
                        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
                    ),
                    index_usage AS (
                        SELECT
                            schemaname,
                            tablename,
                            indexrelname,
                            idx_scan as index_scans,
                            pg_relation_size(indexrelid) as index_size
                        FROM pg_stat_user_indexes
                    )
                    SELECT 
                        t.schemaname,
                        t.tablename,
                        t.seq_scan,
                        t.seq_tup_read,
                        t.idx_scan,
                        t.n_live_tup,
                        t.table_size,
                        CASE 
                            WHEN t.seq_scan > 0 THEN 
                                ROUND((t.seq_tup_read::numeric / t.seq_scan), 2)
                            ELSE 0
                        END as avg_tuples_per_seq_scan,
                        COUNT(i.indexrelname) as index_count
                    FROM table_stats t
                    LEFT JOIN index_usage i ON t.schemaname = i.schemaname AND t.tablename = i.tablename
                    WHERE t.n_live_tup > ${validatedInput.minSize}
                    AND t.seq_scan > ${validatedInput.minUsage}
                    GROUP BY t.schemaname, t.tablename, t.seq_scan, t.seq_tup_read, 
                             t.idx_scan, t.n_live_tup, t.table_size
                    HAVING COUNT(i.indexrelname) < 5
                    ORDER BY t.seq_scan DESC, t.table_size DESC
                `;
                
                const missingIndexes = await executeSqlWithFallback(missingIndexesSql, context);
                
                // Analyze slow queries from pg_stat_statements if available
                let slowQueries: any = { data: [] };
                try {
                    const slowQueriesSql = `
                        SELECT 
                            query,
                            calls,
                            total_exec_time,
                            mean_exec_time,
                            stddev_exec_time,
                            rows
                        FROM pg_stat_statements
                        WHERE query NOT LIKE '%pg_%'
                        AND mean_exec_time > 10
                        ORDER BY mean_exec_time DESC
                        LIMIT 20
                    `;
                    slowQueries = await executeSqlWithFallback(slowQueriesSql, context);
                } catch (error) {
                    // pg_stat_statements might not be enabled
                }
                
                // Find foreign key columns without indexes
                const fkWithoutIndexesSql = `
                    SELECT DISTINCT
                        tc.table_schema,
                        tc.table_name,
                        kcu.column_name,
                        ccu.table_schema AS foreign_table_schema,
                        ccu.table_name AS foreign_table_name,
                        ccu.column_name AS foreign_column_name
                    FROM information_schema.table_constraints AS tc
                    JOIN information_schema.key_column_usage AS kcu
                        ON tc.constraint_name = kcu.constraint_name
                        AND tc.table_schema = kcu.table_schema
                    JOIN information_schema.constraint_column_usage AS ccu
                        ON ccu.constraint_name = tc.constraint_name
                        AND ccu.table_schema = tc.table_schema
                    WHERE tc.constraint_type = 'FOREIGN KEY'
                    AND NOT EXISTS (
                        SELECT 1
                        FROM pg_indexes
                        WHERE schemaname = tc.table_schema
                        AND tablename = tc.table_name
                        AND indexdef LIKE '%' || kcu.column_name || '%'
                    )
                `;
                
                const fkWithoutIndexes = await executeSqlWithFallback(fkWithoutIndexesSql, context);
                
                // Generate index suggestions
                const suggestions = [];
                
                // Suggest indexes for high seq scan tables
                for (const table of missingIndexes.data) {
                    if (table.seq_scan > validatedInput.minUsage && table.index_count < 3) {
                        // Get columns that could benefit from indexing
                        const columnsSql = `
                            SELECT 
                                a.attname AS column_name,
                                t.typname AS data_type,
                                a.attnum AS column_order
                            FROM pg_attribute a
                            JOIN pg_type t ON a.atttypid = t.oid
                            JOIN pg_class c ON a.attrelid = c.oid
                            JOIN pg_namespace n ON c.relnamespace = n.oid
                            WHERE n.nspname = $1
                            AND c.relname = $2
                            AND a.attnum > 0
                            AND NOT a.attisdropped
                            AND a.attname NOT IN ('created_at', 'updated_at')
                            ORDER BY a.attnum
                            LIMIT 3
                        `;
                        
                        const columns = await executeSqlWithFallback(
                            columnsSql,
                            context,
                            [table.schemaname, table.tablename]
                        );
                        
                        if (columns.data.length > 0) {
                            const primaryColumns = columns.data.slice(0, 2).map((c: any) => c.column_name);
                            suggestions.push({
                                type: 'btree',
                                table: `${table.schemaname}.${table.tablename}`,
                                columns: primaryColumns,
                                name: `idx_${table.tablename}_${primaryColumns.join('_')}`,
                                reason: `High sequential scans (${table.seq_scan}) on large table`,
                                impact: 'HIGH',
                                sql: `CREATE INDEX CONCURRENTLY idx_${table.tablename}_${primaryColumns.join('_')} ON ${table.schemaname}.${table.tablename} (${primaryColumns.join(', ')})`
                            });
                        }
                    }
                }
                
                // Suggest indexes for foreign keys
                for (const fk of fkWithoutIndexes.data) {
                    suggestions.push({
                        type: 'btree',
                        table: `${fk.table_schema}.${fk.table_name}`,
                        columns: [fk.column_name],
                        name: `idx_${fk.table_name}_${fk.column_name}_fk`,
                        reason: `Foreign key without index (references ${fk.foreign_table_name}.${fk.foreign_column_name})`,
                        impact: 'MEDIUM',
                        sql: `CREATE INDEX CONCURRENTLY idx_${fk.table_name}_${fk.column_name}_fk ON ${fk.table_schema}.${fk.table_name} (${fk.column_name})`
                    });
                }
                
                // Apply suggestions if requested
                const applied = [];
                if (validatedInput.autoApply && suggestions.length > 0) {
                    for (const suggestion of suggestions) {
                        try {
                            await executeSqlWithFallback(suggestion.sql, context);
                            applied.push(suggestion.name);
                        } catch (error) {
                            // Index might already exist or creation failed
                        }
                    }
                }
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            analysis: {
                                tablesAnalyzed: missingIndexes.data.length,
                                slowQueries: slowQueries.data.length,
                                foreignKeysWithoutIndexes: fkWithoutIndexes.data.length
                            },
                            suggestions,
                            applied: validatedInput.autoApply ? applied : [],
                            summary: {
                                totalSuggestions: suggestions.length,
                                highImpact: suggestions.filter(s => s.impact === 'HIGH').length,
                                mediumImpact: suggestions.filter(s => s.impact === 'MEDIUM').length,
                                appliedCount: applied.length
                            }
                        }, null, 2)
                    }]
                };
            }
            
            case 'drop_unused': {
                // Find unused indexes
                const unusedIndexesSql = `
                    SELECT
                        schemaname,
                        tablename,
                        indexrelname,
                        idx_scan,
                        pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
                        pg_relation_size(indexrelid) as size_bytes
                    FROM pg_stat_user_indexes
                    WHERE idx_scan = 0
                    AND indexrelname NOT LIKE '%_pkey'
                    AND indexrelname NOT LIKE '%_key'
                    AND pg_relation_size(indexrelid) > 1024 * 1024
                    ORDER BY pg_relation_size(indexrelid) DESC
                `;
                
                const unusedIndexes = await executeSqlWithFallback(unusedIndexesSql, context);
                
                const dropped = [];
                if (validatedInput.autoApply) {
                    for (const index of unusedIndexes.data) {
                        try {
                            const sql = `DROP INDEX CONCURRENTLY IF EXISTS ${index.schemaname}.${index.indexrelname}`;
                            await executeSqlWithFallback(sql, context);
                            dropped.push({
                                index: `${index.schemaname}.${index.indexrelname}`,
                                size: index.index_size
                            });
                        } catch (error) {
                            // Might be a system index or drop failed
                        }
                    }
                }
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            unusedIndexes: unusedIndexes.data,
                            dropped,
                            summary: {
                                totalUnused: unusedIndexes.data.length,
                                totalSize: unusedIndexes.data.reduce((acc: number, idx: any) => acc + idx.size_bytes, 0),
                                droppedCount: dropped.length
                            }
                        }, null, 2)
                    }]
                };
            }
            
            case 'rebuild': {
                // Find bloated indexes
                const bloatedIndexesSql = `
                    WITH index_bloat AS (
                        SELECT
                            schemaname,
                            tablename,
                            indexname,
                            pg_relation_size(schemaname||'.'||indexname) AS index_size,
                            CASE WHEN pg_relation_size(schemaname||'.'||tablename) > 0
                                THEN (pg_relation_size(schemaname||'.'||indexname)::float / 
                                     pg_relation_size(schemaname||'.'||tablename)::float)
                                ELSE 0
                            END AS index_ratio
                        FROM pg_indexes
                        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
                    )
                    SELECT 
                        schemaname,
                        tablename,
                        indexname,
                        pg_size_pretty(index_size) AS size,
                        ROUND(index_ratio * 100, 2) AS index_table_ratio_pct
                    FROM index_bloat
                    WHERE index_size > 10 * 1024 * 1024
                    AND index_ratio > 0.5
                    ORDER BY index_size DESC
                    LIMIT 10
                `;
                
                const bloatedIndexes = await executeSqlWithFallback(bloatedIndexesSql, context);
                
                const rebuilt = [];
                if (validatedInput.autoApply) {
                    for (const index of bloatedIndexes.data) {
                        try {
                            const sql = `REINDEX INDEX CONCURRENTLY ${index.schemaname}.${index.indexname}`;
                            await executeSqlWithFallback(sql, context);
                            rebuilt.push({
                                index: `${index.schemaname}.${index.indexname}`,
                                size: index.size
                            });
                        } catch (error) {
                            // REINDEX CONCURRENTLY might not be available
                            try {
                                const sql = `REINDEX INDEX ${index.schemaname}.${index.indexname}`;
                                await executeSqlWithFallback(sql, context);
                                rebuilt.push({
                                    index: `${index.schemaname}.${index.indexname}`,
                                    size: index.size,
                                    warning: 'Rebuilt with table lock'
                                });
                            } catch (e) {
                                // Index rebuild failed
                            }
                        }
                    }
                }
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            bloatedIndexes: bloatedIndexes.data,
                            rebuilt,
                            summary: {
                                totalBloated: bloatedIndexes.data.length,
                                rebuiltCount: rebuilt.length
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