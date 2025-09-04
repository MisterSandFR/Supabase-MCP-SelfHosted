import { Tool } from "@modelcontextprotocol/sdk/dist/types.js";
import { z } from 'zod';

import type { ToolContext } from './types.js';
import { handleSqlResponse } from './utils.js';
import type { SqlSuccessResponse } from '../types/index.js';

// Input schema (no parameters needed)
const ListRealtimePublicationsInputSchema = z.object({});
type ListRealtimePublicationsInput = z.infer<typeof ListRealtimePublicationsInputSchema>;

// Output schema based on pg_publication columns
const PublicationSchema = z.object({
    oid: z.number().int(),
    pubname: z.string(),
    pubowner: z.number().int(), // Owner OID
    puballtables: z.boolean(),
    pubinsert: z.boolean(),
    pubupdate: z.boolean(),
    pubdelete: z.boolean(),
    pubtruncate: z.boolean(),
    pubviaroot: z.boolean(),
    // Potentially add pubownername if needed via join
});
const ListRealtimePublicationsOutputSchema = z.object({
  content: z.array(z.object({
    type: z.literal("text"),
    text: z.string()
  }))
});
type ListRealtimePublicationsOutput = z.infer<typeof ListRealtimePublicationsOutputSchema>;

// Tool definition
export const listRealtimePublicationsTool: Tool = {
    name: 'list_realtime_publications',
    description: 'Lists PostgreSQL publications, often used by Supabase Realtime.',
    inputSchema: ListRealtimePublicationsInputSchema,
    mcpInputSchema: {
        type: 'object',
        properties: {},
        required: [],
    },
    outputSchema: ListRealtimePublicationsOutputSchema,

    execute: async (input: unknown, context: ToolContext) => {
        const validatedInput = ListRealtimePublicationsInputSchema.parse(input || {});
        const client = context.selfhostedClient;
        console.error('Listing Realtime publications...');

        // Direct DB connection likely needed for pg_catalog access
        if (!client.isPgAvailable()) {
            context.log('Direct database connection (DATABASE_URL) is required to list publications.', 'error');
            throw new Error('Direct database connection (DATABASE_URL) is required to list publications.');
        }

        const sql = `
            SELECT
                oid,
                pubname,
                pubowner,
                puballtables,
                pubinsert,
                pubupdate,
                pubdelete,
                pubtruncate,
                pubviaroot
            FROM pg_catalog.pg_publication;
        `;

        console.error('Attempting to list publications using direct DB connection...');
        // Use executeSqlWithPg as it's a simple read query without parameters
        const result = await client.executeSqlWithPg(sql);

        const PublicationArraySchema = z.array(PublicationSchema);
        const validatedPublications = handleSqlResponse(result, PublicationArraySchema);

        console.error(`Found ${validatedPublications.length} publications.`);
        context.log(`Found ${validatedPublications.length} publications.`);
        
        return {
            content: [{
                type: "text",
                text: JSON.stringify(validatedPublications, null, 2)
            }]
        };
        }
}; 