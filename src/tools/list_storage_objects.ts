import { Tool } from "@modelcontextprotocol/sdk/dist/types.js";
import { z } from 'zod';
import type { PoolClient } from 'pg'; // Import PoolClient type

import type { ToolContext } from './types.js';
import { handleSqlResponse } from './utils.js';
import type { SqlSuccessResponse } from '../types/index.js'; // Import the type

// Input schema
const ListStorageObjectsInputSchema = z.object({
    bucket_id: z.string().describe('The ID of the bucket to list objects from.'),
    limit: z.number().int().positive().optional().default(100).describe('Max number of objects to return'),
    offset: z.number().int().nonnegative().optional().default(0).describe('Number of objects to skip'),
    prefix: z.string().optional().describe('Filter objects by a path prefix (e.g., \'public/\')'),
});
type ListStorageObjectsInput = z.infer<typeof ListStorageObjectsInputSchema>;

// Output schema
const StorageObjectSchema = z.object({
    id: z.string().uuid(),
    name: z.string().nullable(), // Name can be null according to schema
    bucket_id: z.string(),
    owner: z.string().uuid().nullable(),
    version: z.string().nullable(),
    // Get mimetype directly from SQL extraction
    mimetype: z.string().nullable(), 
    // size comes from metadata
    size: z.string().pipe(z.coerce.number().int()).nullable(),
    // Keep raw metadata as well
    metadata: z.record(z.any()).nullable(),
    created_at: z.string().nullable(),
    updated_at: z.string().nullable(),
    last_accessed_at: z.string().nullable(),
});
const ListStorageObjectsOutputSchema = z.object({
  content: z.array(z.object({
    type: z.literal("text"),
    text: z.string()
  }))
});
type ListStorageObjectsOutput = z.infer<typeof ListStorageObjectsOutputSchema>;

// Tool definition
export const listStorageObjectsTool: Tool = {
    name: 'list_storage_objects',
    description: 'Lists objects within a specific storage bucket, optionally filtering by prefix.',
    inputSchema: ListStorageObjectsInputSchema,
    mcpInputSchema: {
        type: 'object',
        properties: {
            bucket_id: { type: 'string', description: 'The ID of the bucket to list objects from.' },
            limit: { type: 'number', description: 'Max number of objects to return', default: 100 },
            offset: { type: 'number', description: 'Number of objects to skip', default: 0 },
            prefix: { type: 'string', description: "Filter objects by a path prefix (e.g., 'public/')" },
        },
        required: ['bucket_id'],
    },
    outputSchema: ListStorageObjectsOutputSchema,

    execute: async (input: unknown, context: ToolContext) => {
        const validatedInput = ListStorageObjectsInputSchema.parse(input);
        const client = context.selfhostedClient;
        const { bucket_id, limit, offset, prefix } = validatedInput;

        console.error(`Listing objects for bucket ${bucket_id} (Prefix: ${prefix || 'N/A'})...`);

        if (!client.isPgAvailable()) {
            context.log('Direct database connection (DATABASE_URL) is required to list storage objects.', 'error');
            throw new Error('Direct database connection (DATABASE_URL) is required to list storage objects.');
        }

        // Use a transaction to get access to the pg client for parameterized queries
        const objects = await client.executeTransactionWithPg(async (pgClient: PoolClient) => {
            // Build query with parameters
            let sql = `
                SELECT
                    id,
                    name,
                    bucket_id,
                    owner,
                    version,
                    metadata ->> 'mimetype' AS mimetype,
                    metadata ->> 'size' AS size, -- Extract size from metadata
                    metadata,
                    created_at::text,
                    updated_at::text,
                    last_accessed_at::text
                FROM storage.objects
                WHERE bucket_id = $1
            `;
            const params: (string | number)[] = [bucket_id];
            let paramIndex = 2;

            if (prefix) {
                sql += ` AND name LIKE $${paramIndex++}`;
                params.push(`${prefix}%`);
            }

            sql += ' ORDER BY name ASC NULLS FIRST';
            sql += ` LIMIT $${paramIndex++}`;
            params.push(limit!);
            sql += ` OFFSET $${paramIndex++}`;
            params.push(offset!);
            sql += ';';

            console.error('Executing parameterized SQL to list storage objects within transaction...');
            const result = await pgClient.query(sql, params); // Raw pg result

            // Explicitly pass result.rows, which matches the expected structure
            // of SqlSuccessResponse (unknown[]) for handleSqlResponse.
            const StorageObjectArraySchema = z.array(StorageObjectSchema);
            return handleSqlResponse(result.rows as SqlSuccessResponse, StorageObjectArraySchema);
        });

        console.error(`Found ${objects.length} objects.`);
        context.log(`Found ${objects.length} objects.`);
        
        return {
            content: [{
                type: "text",
                text: JSON.stringify(objects, null, 2)
            }]
        };
    }
}; 