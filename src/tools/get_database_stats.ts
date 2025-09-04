import { z } from "zod";
import { ToolContext } from "./types.js";
import type { SelfhostedSupabaseClient } from '../client/index.js';
import { handleSqlResponse, executeSqlWithFallback } from './utils.js';
import { Tool } from "@modelcontextprotocol/sdk/types.js";

// Schema for combined stats output
// Note: Types are often bigint from pg_stat, returned as string by JSON/RPC.
// Casting to numeric/float in SQL or parsing carefully later might be needed for calculations.
const GetDbStatsOutputSchema = z.object({
    database_stats: z.array(z.object({
        datname: z.string().nullable(),
        numbackends: z.number().nullable(),
        xact_commit: z.string().nullable(), // bigint as string
        xact_rollback: z.string().nullable(), // bigint as string
        blks_read: z.string().nullable(), // bigint as string
        blks_hit: z.string().nullable(), // bigint as string
        tup_returned: z.string().nullable(), // bigint as string
        tup_fetched: z.string().nullable(), // bigint as string
        tup_inserted: z.string().nullable(), // bigint as string
        tup_updated: z.string().nullable(), // bigint as string
        tup_deleted: z.string().nullable(), // bigint as string
        conflicts: z.string().nullable(), // bigint as string
        temp_files: z.string().nullable(), // bigint as string
        temp_bytes: z.string().nullable(), // bigint as string
        deadlocks: z.string().nullable(), // bigint as string
        checksum_failures: z.string().nullable(), // bigint as string
        checksum_last_failure: z.string().nullable(), // timestamp as string
        blk_read_time: z.number().nullable(), // double precision
        blk_write_time: z.number().nullable(), // double precision
        stats_reset: z.string().nullable(), // timestamp as string
    })).describe("Statistics per database from pg_stat_database"),
    bgwriter_stats: z.array(z.object({ // Usually a single row
        checkpoints_timed: z.string().nullable(),
        checkpoints_req: z.string().nullable(),
        checkpoint_write_time: z.number().nullable(),
        checkpoint_sync_time: z.number().nullable(),
        buffers_checkpoint: z.string().nullable(),
        buffers_clean: z.string().nullable(),
        maxwritten_clean: z.string().nullable(),
        buffers_backend: z.string().nullable(),
        buffers_backend_fsync: z.string().nullable(),
        buffers_alloc: z.string().nullable(),
        stats_reset: z.string().nullable(),
    })).describe("Statistics from the background writer process from pg_stat_bgwriter"),
});

// Input schema (allow filtering by database later if needed)
const GetDbStatsInputSchema = z.object({});
type GetDbStatsInput = z.infer<typeof GetDbStatsInputSchema>;

// Static JSON Schema for MCP capabilities
const mcpInputSchema = {
    type: 'object',
    properties: {},
    required: [],
};

// The tool definition
export const getDatabaseStatsTool = {
    name: 'get_database_stats',
    description: 'Retrieves statistics about database activity and the background writer from pg_stat_database and pg_stat_bgwriter.',
    inputSchema: GetDbStatsInputSchema,
    mcpInputSchema: mcpInputSchema,
    outputSchema: GetDbStatsOutputSchema,
    execute: async (input: unknown, context: ToolContext) => {
        const client = context.selfhostedClient;

        // Combine queries for efficiency if possible, but RPC might handle separate calls better.
        // Using two separate calls for clarity.

        const getDbStatsSql = `
            SELECT
                datname,
                numbackends,
                xact_commit::text,
                xact_rollback::text,
                blks_read::text,
                blks_hit::text,
                tup_returned::text,
                tup_fetched::text,
                tup_inserted::text,
                tup_updated::text,
                tup_deleted::text,
                conflicts::text,
                temp_files::text,
                temp_bytes::text,
                deadlocks::text,
                checksum_failures::text,
                checksum_last_failure::text,
                blk_read_time,
                blk_write_time,
                stats_reset::text
            FROM pg_stat_database
        `;

        const getBgWriterStatsSql = `
            SELECT
                checkpoints_timed::text,
                checkpoints_req::text,
                checkpoint_write_time,
                checkpoint_sync_time,
                buffers_checkpoint::text,
                buffers_clean::text,
                maxwritten_clean::text,
                buffers_backend::text,
                buffers_backend_fsync::text,
                buffers_alloc::text,
                stats_reset::text
            FROM pg_stat_bgwriter
        `;

        // Execute both queries
        const [dbStatsResult, bgWriterStatsResult] = await Promise.all([
            executeSqlWithFallback(client, getDbStatsSql, true),
            executeSqlWithFallback(client, getBgWriterStatsSql, true),
        ]);

        // Use handleSqlResponse for each part; it throws on error.
        const dbStats = handleSqlResponse(dbStatsResult, GetDbStatsOutputSchema.shape.database_stats);
        const bgWriterStats = handleSqlResponse(bgWriterStatsResult, GetDbStatsOutputSchema.shape.bgwriter_stats);

        // Combine results into the final schema
        return {
            database_stats: dbStats,
            bgwriter_stats: bgWriterStats,
        };
    },
}; 