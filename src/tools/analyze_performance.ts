import { Tool } from "@modelcontextprotocol/sdk/dist/types.js";
import { z } from "zod";
import { ToolContext } from "./types.js";
import { executeSqlWithFallback } from "./utils.js";

const AnalyzePerformanceInputSchema = z.object({
  category: z.enum(['queries', 'indexes', 'locks', 'cache', 'connections', 'all']).optional().default('all'),
  duration: z.number().optional().default(5).describe("Duration in minutes to analyze (for active queries)"),
  limit: z.number().optional().default(10).describe("Number of results to return")
});

type AnalyzePerformanceInput = z.infer<typeof AnalyzePerformanceInputSchema>;

export const analyzePerformanceTool: Tool = {
  name: "analyze_performance",
  description: "Analyze database performance including slow queries, missing indexes, and resource usage",
  inputSchema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        enum: ["queries", "indexes", "locks", "cache", "connections", "all"],
        description: "Performance category to analyze"
      },
      duration: {
        type: "number",
        description: "Duration in minutes to analyze (for active queries)"
      },
      limit: {
        type: "number",
        description: "Number of results to return"
      }
    }
  },
  execute: async (input: unknown, context: ToolContext) => {
    const validatedInput = AnalyzePerformanceInputSchema.parse(input || {});
    const results: Record<string, any> = {};
    
    // Analyze slow queries
    if (validatedInput.category === 'queries' || validatedInput.category === 'all') {
      try {
        // Check if pg_stat_statements is available
        const extensionCheck = await executeSqlWithFallback(
          "SELECT * FROM pg_extension WHERE extname = 'pg_stat_statements'",
          context
        );
        
        if (extensionCheck.data && extensionCheck.data.length > 0) {
          const slowQueriesResult = await executeSqlWithFallback(`
            SELECT 
              substring(query, 1, 100) as query_text,
              calls,
              ROUND(total_exec_time::numeric, 2) as total_time_ms,
              ROUND(mean_exec_time::numeric, 2) as avg_time_ms,
              ROUND(max_exec_time::numeric, 2) as max_time_ms,
              ROUND(stddev_exec_time::numeric, 2) as stddev_time_ms,
              rows,
              ROUND(100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0), 2) as cache_hit_ratio
            FROM pg_stat_statements
            WHERE query NOT LIKE '%pg_stat_statements%'
            ORDER BY mean_exec_time DESC
            LIMIT $1
          `, context, [validatedInput.limit]);
          
          results.slowQueries = slowQueriesResult.data;
        } else {
          // Fallback to current activity
          const activeQueriesResult = await executeSqlWithFallback(`
            SELECT 
              pid,
              now() - query_start as duration,
              state,
              substring(query, 1, 100) as query_text,
              wait_event_type,
              wait_event
            FROM pg_stat_activity
            WHERE state != 'idle'
              AND query NOT ILIKE '%pg_stat_activity%'
              AND now() - query_start > interval '${validatedInput.duration} seconds'
            ORDER BY duration DESC
            LIMIT $1
          `, context, [validatedInput.limit]);
          
          results.activeSlowQueries = activeQueriesResult.data;
        }
      } catch (error) {
        results.queriesError = error instanceof Error ? error.message : String(error);
      }
    }
    
    // Analyze missing indexes
    if (validatedInput.category === 'indexes' || validatedInput.category === 'all') {
      try {
        // Find tables with sequential scans
        const seqScanResult = await executeSqlWithFallback(`
          SELECT 
            schemaname,
            tablename,
            seq_scan,
            seq_tup_read,
            idx_scan,
            idx_tup_fetch,
            ROUND(100.0 * seq_scan / NULLIF(seq_scan + idx_scan, 0), 2) as seq_scan_ratio,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size
          FROM pg_stat_user_tables
          WHERE seq_scan > 0 
            AND pg_total_relation_size(schemaname||'.'||tablename) > 1048576
          ORDER BY seq_tup_read DESC
          LIMIT $1
        `, context, [validatedInput.limit]);
        
        results.tablesNeedingIndexes = seqScanResult.data;
        
        // Find unused indexes
        const unusedIndexResult = await executeSqlWithFallback(`
          SELECT 
            schemaname,
            tablename,
            indexname,
            idx_scan,
            pg_size_pretty(pg_relation_size(indexrelid)) as index_size
          FROM pg_stat_user_indexes
          WHERE idx_scan = 0
            AND indexrelname NOT LIKE '%pkey%'
          ORDER BY pg_relation_size(indexrelid) DESC
          LIMIT $1
        `, context, [validatedInput.limit]);
        
        results.unusedIndexes = unusedIndexResult.data;
        
        // Find duplicate indexes
        const duplicateIndexResult = await executeSqlWithFallback(`
          SELECT 
            pg_size_pretty(SUM(pg_relation_size(idx))::bigint) AS size,
            (array_agg(idx))[1] AS idx1,
            (array_agg(idx))[2] AS idx2,
            (array_agg(idx))[3] AS idx3,
            (array_agg(idx))[4] AS idx4
          FROM (
            SELECT 
              indexrelid::regclass AS idx,
              (indrelid::text ||E'\n'||indclass::text ||E'\n'||indkey::text ||E'\n'||
               COALESCE(indexprs::text,'')||E'\n' || COALESCE(indpred::text,'')) AS KEY
            FROM pg_index
          ) sub
          GROUP BY KEY
          HAVING COUNT(*) > 1
          ORDER BY SUM(pg_relation_size(idx)) DESC
          LIMIT $1
        `, context, [validatedInput.limit]);
        
        results.duplicateIndexes = duplicateIndexResult.data;
      } catch (error) {
        results.indexesError = error instanceof Error ? error.message : String(error);
      }
    }
    
    // Analyze locks
    if (validatedInput.category === 'locks' || validatedInput.category === 'all') {
      try {
        const locksResult = await executeSqlWithFallback(`
          SELECT 
            blocked_locks.pid AS blocked_pid,
            blocked_activity.usename AS blocked_user,
            blocking_locks.pid AS blocking_pid,
            blocking_activity.usename AS blocking_user,
            substring(blocked_activity.query, 1, 50) AS blocked_statement,
            substring(blocking_activity.query, 1, 50) AS blocking_statement,
            now() - blocked_activity.query_start AS blocked_duration
          FROM pg_catalog.pg_locks blocked_locks
          JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
          JOIN pg_catalog.pg_locks blocking_locks 
            ON blocking_locks.locktype = blocked_locks.locktype
            AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
            AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
            AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
            AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
            AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
            AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
            AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
            AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
            AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
            AND blocking_locks.pid != blocked_locks.pid
          JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
          WHERE NOT blocked_locks.granted
          LIMIT $1
        `, context, [validatedInput.limit]);
        
        results.blockedQueries = locksResult.data;
        
        // Deadlock count
        const deadlockResult = await executeSqlWithFallback(
          "SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()",
          context
        );
        
        results.deadlocks = deadlockResult.data?.[0]?.deadlocks || 0;
      } catch (error) {
        results.locksError = error instanceof Error ? error.message : String(error);
      }
    }
    
    // Analyze cache performance
    if (validatedInput.category === 'cache' || validatedInput.category === 'all') {
      try {
        const cacheResult = await executeSqlWithFallback(`
          SELECT 
            sum(heap_blks_read) as heap_read,
            sum(heap_blks_hit) as heap_hit,
            ROUND(100.0 * sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) as cache_hit_ratio,
            sum(idx_blks_read) as index_read,
            sum(idx_blks_hit) as index_hit,
            ROUND(100.0 * sum(idx_blks_hit) / NULLIF(sum(idx_blks_hit) + sum(idx_blks_read), 0), 2) as index_hit_ratio
          FROM pg_statio_user_tables
        `, context);
        
        results.cachePerformance = cacheResult.data?.[0];
        
        // Table-specific cache stats
        const tableCacheResult = await executeSqlWithFallback(`
          SELECT 
            schemaname,
            tablename,
            heap_blks_read,
            heap_blks_hit,
            ROUND(100.0 * heap_blks_hit / NULLIF(heap_blks_hit + heap_blks_read, 0), 2) as hit_ratio,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size
          FROM pg_statio_user_tables
          WHERE heap_blks_read + heap_blks_hit > 0
          ORDER BY heap_blks_read DESC
          LIMIT $1
        `, context, [validatedInput.limit]);
        
        results.tableCacheStats = tableCacheResult.data;
      } catch (error) {
        results.cacheError = error instanceof Error ? error.message : String(error);
      }
    }
    
    // Analyze connections
    if (validatedInput.category === 'connections' || validatedInput.category === 'all') {
      try {
        const connectionResult = await executeSqlWithFallback(`
          SELECT 
            count(*) as total_connections,
            count(*) FILTER (WHERE state = 'active') as active,
            count(*) FILTER (WHERE state = 'idle') as idle,
            count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
            count(*) FILTER (WHERE wait_event_type IS NOT NULL) as waiting,
            max(EXTRACT(EPOCH FROM (now() - backend_start))) as oldest_connection_seconds,
            max(EXTRACT(EPOCH FROM (now() - state_change))) FILTER (WHERE state = 'idle in transaction') as oldest_idle_transaction_seconds
          FROM pg_stat_activity
          WHERE datname = current_database()
        `, context);
        
        results.connectionStats = connectionResult.data?.[0];
        
        // Connection details by application
        const appConnectionResult = await executeSqlWithFallback(`
          SELECT 
            application_name,
            count(*) as connections,
            count(*) FILTER (WHERE state = 'active') as active,
            count(*) FILTER (WHERE state = 'idle') as idle,
            count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
          FROM pg_stat_activity
          WHERE datname = current_database()
          GROUP BY application_name
          ORDER BY connections DESC
        `, context);
        
        results.connectionsByApp = appConnectionResult.data;
      } catch (error) {
        results.connectionsError = error instanceof Error ? error.message : String(error);
      }
    }
    
    // Generate recommendations
    const recommendations = [];
    
    if (results.slowQueries?.length > 0) {
      recommendations.push("Consider optimizing slow queries identified above");
    }
    
    if (results.tablesNeedingIndexes?.length > 0) {
      const highSeqScan = results.tablesNeedingIndexes.filter((t: any) => t.seq_scan_ratio > 90);
      if (highSeqScan.length > 0) {
        recommendations.push(`${highSeqScan.length} table(s) have >90% sequential scan ratio - consider adding indexes`);
      }
    }
    
    if (results.unusedIndexes?.length > 0) {
      recommendations.push(`${results.unusedIndexes.length} unused index(es) found - consider removing to save space`);
    }
    
    if (results.blockedQueries?.length > 0) {
      recommendations.push("Active lock contention detected - review blocking queries");
    }
    
    if (results.cachePerformance?.cache_hit_ratio < 90) {
      recommendations.push("Cache hit ratio below 90% - consider increasing shared_buffers");
    }
    
    if (results.connectionStats?.idle_in_transaction > 5) {
      recommendations.push("Multiple idle transactions detected - review application connection handling");
    }
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          timestamp: new Date().toISOString(),
          category: validatedInput.category,
          results,
          recommendations
        }, null, 2)
      }]
    };
  }
};