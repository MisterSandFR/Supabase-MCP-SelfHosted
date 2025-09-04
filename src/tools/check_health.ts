import { Tool } from "@modelcontextprotocol/sdk/dist/types.js";
import { z } from "zod";
import { ToolContext } from "./types.js";
import { executeSqlWithFallback } from "./utils.js";

const CheckHealthInputSchema = z.object({
  includeMetrics: z.boolean().optional().describe("Include detailed performance metrics"),
  checkExternal: z.boolean().optional().describe("Check external services (Storage, Auth endpoints)")
});

const CheckHealthOutputSchema = z.object({
  content: z.array(z.object({
    type: z.literal("text"),
    text: z.string()
  }))
});

type CheckHealthInput = z.infer<typeof CheckHealthInputSchema>;

interface HealthStatus {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  details?: Record<string, any>;
  error?: string;
}

export const checkHealthTool: Tool = {
  name: "check_health",
  description: "Check health status of all Supabase components (PostgreSQL, Auth, Storage, Realtime)",
  inputSchema: CheckHealthInputSchema,
  mcpInputSchema: {
    type: "object",
    properties: {
      includeMetrics: {
        type: "boolean",
        description: "Include detailed performance metrics"
      },
      checkExternal: {
        type: "boolean",
        description: "Check external services (Storage, Auth endpoints)"
      }
    }
  },
  outputSchema: CheckHealthOutputSchema,
  execute: async (input: unknown, context: ToolContext) => {
    const validatedInput = CheckHealthInputSchema.parse(input || {});
    const results: HealthStatus[] = [];
    
    // Check PostgreSQL
    const pgStart = Date.now();
    try {
      const pgResult = await executeSqlWithFallback(
        "SELECT version(), current_database(), pg_size_pretty(pg_database_size(current_database())) as db_size, now() as server_time",
        context
      );
      
      results.push({
        component: 'PostgreSQL',
        status: 'healthy',
        responseTime: Date.now() - pgStart,
        details: pgResult.data?.[0]
      });
    } catch (error) {
      results.push({
        component: 'PostgreSQL',
        status: 'unhealthy',
        responseTime: Date.now() - pgStart,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    // Check connection pool
    try {
      const poolResult = await executeSqlWithFallback(`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active,
          count(*) FILTER (WHERE state = 'idle') as idle,
          count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
          max(EXTRACT(EPOCH FROM (now() - state_change))) as longest_connection_seconds
        FROM pg_stat_activity
        WHERE datname = current_database()
      `, context);
      
      const poolData = poolResult.data?.[0];
      const poolStatus = poolData?.total_connections > 90 ? 'degraded' : 'healthy';
      
      results.push({
        component: 'Connection Pool',
        status: poolStatus,
        details: poolData
      });
    } catch (error) {
      results.push({
        component: 'Connection Pool',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    // Check Replication (if configured)
    try {
      const replicationResult = await executeSqlWithFallback(`
        SELECT 
          client_addr,
          state,
          sync_state,
          EXTRACT(EPOCH FROM (now() - backend_start)) as connection_seconds,
          EXTRACT(EPOCH FROM replay_lag) as replay_lag_seconds
        FROM pg_stat_replication
      `, context);
      
      if (replicationResult.data && replicationResult.data.length > 0) {
        const maxLag = Math.max(...replicationResult.data.map((r: any) => r.replay_lag_seconds || 0));
        const replicationStatus = maxLag > 10 ? 'degraded' : 'healthy';
        
        results.push({
          component: 'Replication',
          status: replicationStatus,
          details: {
            replicas: replicationResult.data.length,
            max_lag_seconds: maxLag,
            replicas_detail: replicationResult.data
          }
        });
      }
    } catch {
      // Replication might not be configured
    }
    
    // Check performance metrics if requested
    if (validatedInput.includeMetrics) {
      try {
        const metricsResult = await executeSqlWithFallback(`
          SELECT 
            (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_queries,
            (SELECT count(*) FROM pg_stat_activity WHERE wait_event_type IS NOT NULL) as waiting_queries,
            (SELECT ROUND(100.0 * SUM(blks_hit) / NULLIF(SUM(blks_hit + blks_read), 0), 2) FROM pg_stat_database) as cache_hit_ratio,
            (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle in transaction' AND EXTRACT(EPOCH FROM (now() - state_change)) > 300) as long_idle_transactions,
            (SELECT count(*) FROM pg_locks WHERE NOT granted) as blocked_queries
        `, context);
        
        const metrics = metricsResult.data?.[0];
        const metricsStatus = 
          metrics?.blocked_queries > 0 || metrics?.long_idle_transactions > 5 ? 'degraded' : 'healthy';
        
        results.push({
          component: 'Performance Metrics',
          status: metricsStatus,
          details: metrics
        });
      } catch (error) {
        results.push({
          component: 'Performance Metrics',
          status: 'unhealthy',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Check external endpoints if requested and available
    if (validatedInput.checkExternal && context.supabase) {
      // Check Auth service
      const authStart = Date.now();
      try {
        const authHealthUrl = `${context.config.url}/auth/v1/health`;
        const authResponse = await fetch(authHealthUrl);
        
        results.push({
          component: 'Auth Service',
          status: authResponse.ok ? 'healthy' : 'degraded',
          responseTime: Date.now() - authStart,
          details: { statusCode: authResponse.status }
        });
      } catch (error) {
        results.push({
          component: 'Auth Service',
          status: 'unhealthy',
          responseTime: Date.now() - authStart,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      // Check Storage service
      const storageStart = Date.now();
      try {
        const storageHealthUrl = `${context.config.url}/storage/v1/version`;
        const storageResponse = await fetch(storageHealthUrl);
        
        results.push({
          component: 'Storage Service',
          status: storageResponse.ok ? 'healthy' : 'degraded',
          responseTime: Date.now() - storageStart,
          details: { statusCode: storageResponse.status }
        });
      } catch (error) {
        results.push({
          component: 'Storage Service',
          status: 'unhealthy',
          responseTime: Date.now() - storageStart,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Calculate overall health
    const unhealthyCount = results.filter(r => r.status === 'unhealthy').length;
    const degradedCount = results.filter(r => r.status === 'degraded').length;
    
    const overallStatus = unhealthyCount > 0 ? 'unhealthy' : 
                          degradedCount > 0 ? 'degraded' : 'healthy';
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          overall_status: overallStatus,
          timestamp: new Date().toISOString(),
          components: results,
          summary: {
            healthy: results.filter(r => r.status === 'healthy').length,
            degraded: degradedCount,
            unhealthy: unhealthyCount
          }
        }, null, 2)
      }]
    };
  }
};