import { z } from "zod";
import { ToolContext } from "./types.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { handleSqlResponse, executeSqlWithFallback } from './utils.js';

// Input schema
const InspectSchemaInputSchema = z.object({
    schema_name: z.string().optional().default('public').describe('Schema name to inspect (default: public).'),
    include: z.array(z.enum(['tables', 'views', 'functions', 'procedures', 'triggers', 'indexes', 'constraints', 'extensions', 'policies', 'roles'])).optional().default(['tables', 'views', 'functions']).describe('Components to include in inspection.'),
    table_name: z.string().optional().describe('Specific table name to inspect in detail (optional).'),
    include_data_types: z.boolean().optional().default(true).describe('Include detailed data type information.'),
    include_permissions: z.boolean().optional().default(false).describe('Include permission and security information.'),
    include_statistics: z.boolean().optional().default(false).describe('Include table statistics and size information.'),
    format: z.enum(['detailed', 'summary', 'typescript']).optional().default('detailed').describe('Output format for the inspection results.'),
});
type InspectSchemaInput = z.infer<typeof InspectSchemaInputSchema>;

// Output schema
const InspectSchemaOutputSchema = z.object({
    schema_name: z.string(),
    tables: z.array(z.any()).optional(),
    views: z.array(z.any()).optional(),
    functions: z.array(z.any()).optional(),
    procedures: z.array(z.any()).optional(),
    triggers: z.array(z.any()).optional(),
    indexes: z.array(z.any()).optional(),
    constraints: z.array(z.any()).optional(),
    extensions: z.array(z.any()).optional(),
    policies: z.array(z.any()).optional(),
    roles: z.array(z.any()).optional(),
    summary: z.object({
        total_tables: z.number(),
        total_views: z.number(),
        total_functions: z.number(),
        total_procedures: z.number(),
        schema_size: z.string().optional(),
    }).optional(),
    typescript_types: z.string().optional(),
});

// Static JSON Schema for MCP capabilities
const mcpInputSchema = {
    type: 'object',
    properties: {
        schema_name: { type: 'string', default: 'public', description: 'Schema name to inspect (default: public).' },
        include: { 
            type: 'array', 
            items: { 
                type: 'string', 
                enum: ['tables', 'views', 'functions', 'procedures', 'triggers', 'indexes', 'constraints', 'extensions', 'policies', 'roles'] 
            },
            default: ['tables', 'views', 'functions'],
            description: 'Components to include in inspection.' 
        },
        table_name: { type: 'string', description: 'Specific table name to inspect in detail (optional).' },
        include_data_types: { type: 'boolean', default: true, description: 'Include detailed data type information.' },
        include_permissions: { type: 'boolean', default: false, description: 'Include permission and security information.' },
        include_statistics: { type: 'boolean', default: false, description: 'Include table statistics and size information.' },
        format: { 
            type: 'string', 
            enum: ['detailed', 'summary', 'typescript'],
            default: 'detailed',
            description: 'Output format for the inspection results.' 
        },
    },
    required: [],
};

/**
 * SQL queries for different inspection components
 */
const INSPECTION_QUERIES = {
    tables: `
        SELECT 
            t.table_name,
            t.table_type,
            obj_description(c.oid) as table_comment,
            CASE WHEN t.table_type = 'BASE TABLE' THEN 'table' ELSE 'view' END as object_type
        FROM information_schema.tables t
        LEFT JOIN pg_class c ON c.relname = t.table_name
        LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE t.table_schema = $1
        ORDER BY t.table_name;
    `,
    
    table_columns: `
        SELECT 
            c.table_name,
            c.column_name,
            c.data_type,
            c.character_maximum_length,
            c.numeric_precision,
            c.numeric_scale,
            c.is_nullable,
            c.column_default,
            c.ordinal_position,
            col_description(pgc.oid, c.ordinal_position) as column_comment
        FROM information_schema.columns c
        LEFT JOIN pg_class pgc ON pgc.relname = c.table_name
        LEFT JOIN pg_namespace pgn ON pgn.oid = pgc.relnamespace AND pgn.nspname = c.table_schema
        WHERE c.table_schema = $1
        AND ($2::text IS NULL OR c.table_name = $2)
        ORDER BY c.table_name, c.ordinal_position;
    `,
    
    views: `
        SELECT 
            table_name as view_name,
            view_definition,
            is_updatable,
            is_insertable_into,
            is_trigger_updatable,
            is_trigger_deletable,
            is_trigger_insertable_into
        FROM information_schema.views
        WHERE table_schema = $1
        ORDER BY table_name;
    `,
    
    functions: `
        SELECT 
            p.proname as function_name,
            pg_get_function_result(p.oid) as return_type,
            pg_get_function_arguments(p.oid) as arguments,
            p.prokind as function_type,
            l.lanname as language,
            obj_description(p.oid) as description,
            CASE p.provolatile 
                WHEN 'i' THEN 'IMMUTABLE'
                WHEN 's' THEN 'STABLE'
                WHEN 'v' THEN 'VOLATILE'
            END as volatility,
            p.prosecdef as security_definer
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        JOIN pg_language l ON p.prolang = l.oid
        WHERE n.nspname = $1
        AND p.prokind IN ('f', 'p', 'a', 'w')
        ORDER BY p.proname;
    `,
    
    triggers: `
        SELECT 
            t.trigger_name,
            t.event_manipulation,
            t.event_object_table as table_name,
            t.action_timing,
            t.action_condition,
            t.action_statement,
            t.action_orientation,
            t.action_reference_old_table,
            t.action_reference_new_table
        FROM information_schema.triggers t
        WHERE t.trigger_schema = $1
        ORDER BY t.event_object_table, t.trigger_name;
    `,
    
    indexes: `
        SELECT 
            i.indexname as index_name,
            i.tablename as table_name,
            i.indexdef as index_definition,
            pg_size_pretty(pg_relation_size(c.oid)) as index_size,
            c.reltuples::bigint as estimated_rows,
            CASE WHEN i.indexdef LIKE '%UNIQUE%' THEN true ELSE false END as is_unique,
            CASE WHEN i.indexdef LIKE '%PRIMARY%' THEN true ELSE false END as is_primary
        FROM pg_indexes i
        JOIN pg_class c ON c.relname = i.indexname
        WHERE i.schemaname = $1
        ORDER BY i.tablename, i.indexname;
    `,
    
    constraints: `
        SELECT 
            tc.constraint_name,
            tc.table_name,
            tc.constraint_type,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name,
            rc.match_option,
            rc.update_rule,
            rc.delete_rule
        FROM information_schema.table_constraints tc
        LEFT JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        LEFT JOIN information_schema.constraint_column_usage ccu 
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        LEFT JOIN information_schema.referential_constraints rc 
            ON tc.constraint_name = rc.constraint_name
            AND tc.table_schema = rc.constraint_schema
        WHERE tc.table_schema = $1
        ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;
    `,
    
    extensions: `
        SELECT 
            e.extname as extension_name,
            e.extversion as version,
            n.nspname as schema_name,
            obj_description(e.oid) as description
        FROM pg_extension e
        JOIN pg_namespace n ON e.extnamespace = n.oid
        ORDER BY e.extname;
    `,
    
    policies: `
        SELECT 
            schemaname as schema_name,
            tablename as table_name,
            policyname as policy_name,
            permissive,
            roles,
            cmd as command,
            qual as using_expression,
            with_check as with_check_expression
        FROM pg_policies
        WHERE schemaname = $1
        ORDER BY tablename, policyname;
    `,
    
    roles: `
        SELECT 
            rolname as role_name,
            rolsuper as is_superuser,
            rolinherit as inherit,
            rolcreaterole as can_create_role,
            rolcreatedb as can_create_db,
            rolcanlogin as can_login,
            rolreplication as replication,
            rolconnlimit as connection_limit,
            rolvaliduntil as valid_until
        FROM pg_roles
        WHERE rolname NOT LIKE 'pg_%'
        ORDER BY rolname;
    `,
    
    table_stats: `
        SELECT 
            schemaname,
            tablename as table_name,
            attname as column_name,
            n_distinct,
            most_common_vals,
            most_common_freqs,
            histogram_bounds,
            correlation
        FROM pg_stats
        WHERE schemaname = $1
        AND ($2::text IS NULL OR tablename = $2)
        ORDER BY tablename, attname;
    `,
    
    table_sizes: `
        SELECT 
            t.table_name,
            pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
            pg_size_pretty(pg_relation_size(c.oid)) as table_size,
            pg_size_pretty(pg_total_relation_size(c.oid) - pg_relation_size(c.oid)) as index_size,
            c.reltuples::bigint as estimated_rows
        FROM information_schema.tables t
        JOIN pg_class c ON c.relname = t.table_name
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE t.table_schema = $1 
        AND n.nspname = $1
        AND t.table_type = 'BASE TABLE'
        ORDER BY pg_total_relation_size(c.oid) DESC;
    `
};

/**
 * Converts PostgreSQL data types to TypeScript types
 */
function pgTypeToTypeScript(pgType: string, isNullable: boolean = false): string {
    const nullable = isNullable ? ' | null' : '';
    
    switch (pgType.toLowerCase()) {
        case 'integer':
        case 'bigint':
        case 'smallint':
        case 'decimal':
        case 'numeric':
        case 'real':
        case 'double precision':
            return `number${nullable}`;
        case 'boolean':
            return `boolean${nullable}`;
        case 'text':
        case 'varchar':
        case 'character varying':
        case 'char':
        case 'character':
        case 'uuid':
            return `string${nullable}`;
        case 'timestamp':
        case 'timestamp with time zone':
        case 'timestamp without time zone':
        case 'date':
        case 'time':
            return `Date${nullable}`;
        case 'json':
        case 'jsonb':
            return `Record<string, any>${nullable}`;
        case 'bytea':
            return `Buffer${nullable}`;
        default:
            return `any${nullable}`;
    }
}

/**
 * Generates TypeScript interface from table structure
 */
function generateTypeScriptInterface(tableName: string, columns: any[]): string {
    const interfaceName = tableName.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join('');
    
    const properties = columns.map(col => {
        const tsType = pgTypeToTypeScript(col.data_type, col.is_nullable === 'YES');
        const comment = col.column_comment ? `  /** ${col.column_comment} */\n` : '';
        return `${comment}  ${col.column_name}: ${tsType};`;
    }).join('\n');
    
    return `export interface ${interfaceName} {\n${properties}\n}`;
}

// The tool definition
export const inspectSchemaTool = {
    name: 'inspect_schema',
    description: 'Provides comprehensive schema inspection with detailed information about tables, views, functions, triggers, constraints, and more. Supports TypeScript type generation and various output formats. Essential for understanding database structure and generating documentation.',
    inputSchema: InspectSchemaInputSchema,
    mcpInputSchema: mcpInputSchema,
    outputSchema: InspectSchemaOutputSchema,
    execute: async (input: InspectSchemaInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const result: any = {
            schema_name: input.schema_name,
        };

        try {
            console.error(`Inspecting schema: ${input.schema_name}`);
            console.error(`Including: ${input.include.join(', ')}`);

            // Tables inspection
            if (input.include.includes('tables')) {
                const tablesQuery = INSPECTION_QUERIES.tables.replace('$1', `'${input.schema_name}'`);
                const tablesResult = await client.executeSqlWithPg(tablesQuery);
                const tables = Array.isArray(tablesResult) ? tablesResult : [];

                // Get column details for each table
                const columnsQuery = INSPECTION_QUERIES.table_columns
                    .replace('$1', `'${input.schema_name}'`)
                    .replace('$2', input.table_name ? `'${input.table_name}'` : 'NULL');
                const columnsResult = await client.executeSqlWithPg(columnsQuery);
                const columns = Array.isArray(columnsResult) ? columnsResult : [];

                // Group columns by table
                const tableColumns = columns.reduce((acc: any, col: any) => {
                    if (!acc[col.table_name]) acc[col.table_name] = [];
                    acc[col.table_name].push(col);
                    return acc;
                }, {});

                // Combine tables with their columns
                result.tables = tables.map((table: any) => ({
                    ...table,
                    columns: tableColumns[table.table_name] || []
                }));

                // Include statistics if requested
                if (input.include_statistics) {
                    const sizesQuery = INSPECTION_QUERIES.table_sizes.replace('$1', `'${input.schema_name}'`);
                    const sizesResult = await client.executeSqlWithPg(sizesQuery);
                    const sizes = Array.isArray(sizesResult) ? sizesResult : [];
                    
                    // Merge size information
                    result.tables = result.tables.map((table: any) => {
                        const sizeInfo = sizes.find((s: any) => s.table_name === table.table_name);
                        return { ...table, ...sizeInfo };
                    });
                }
            }

            // Views inspection
            if (input.include.includes('views')) {
                const viewsQuery = INSPECTION_QUERIES.views.replace('$1', `'${input.schema_name}'`);
                const viewsResult = await client.executeSqlWithPg(viewsQuery);
                result.views = Array.isArray(viewsResult) ? viewsResult : [];
            }

            // Functions inspection
            if (input.include.includes('functions')) {
                const functionsQuery = INSPECTION_QUERIES.functions.replace('$1', `'${input.schema_name}'`);
                const functionsResult = await client.executeSqlWithPg(functionsQuery);
                result.functions = Array.isArray(functionsResult) ? functionsResult : [];
            }

            // Triggers inspection
            if (input.include.includes('triggers')) {
                const triggersQuery = INSPECTION_QUERIES.triggers.replace('$1', `'${input.schema_name}'`);
                const triggersResult = await client.executeSqlWithPg(triggersQuery);
                result.triggers = Array.isArray(triggersResult) ? triggersResult : [];
            }

            // Indexes inspection
            if (input.include.includes('indexes')) {
                const indexesQuery = INSPECTION_QUERIES.indexes.replace('$1', `'${input.schema_name}'`);
                const indexesResult = await client.executeSqlWithPg(indexesQuery);
                result.indexes = Array.isArray(indexesResult) ? indexesResult : [];
            }

            // Constraints inspection
            if (input.include.includes('constraints')) {
                const constraintsQuery = INSPECTION_QUERIES.constraints.replace('$1', `'${input.schema_name}'`);
                const constraintsResult = await client.executeSqlWithPg(constraintsQuery);
                result.constraints = Array.isArray(constraintsResult) ? constraintsResult : [];
            }

            // Extensions inspection
            if (input.include.includes('extensions')) {
                const extensionsResult = await client.executeSqlWithPg(INSPECTION_QUERIES.extensions);
                result.extensions = Array.isArray(extensionsResult) ? extensionsResult : [];
            }

            // Policies inspection
            if (input.include.includes('policies')) {
                const policiesQuery = INSPECTION_QUERIES.policies.replace('$1', `'${input.schema_name}'`);
                const policiesResult = await client.executeSqlWithPg(policiesQuery);
                result.policies = Array.isArray(policiesResult) ? policiesResult : [];
            }

            // Roles inspection
            if (input.include.includes('roles')) {
                const rolesResult = await client.executeSqlWithPg(INSPECTION_QUERIES.roles);
                result.roles = Array.isArray(rolesResult) ? rolesResult : [];
            }

            // Generate summary
            if (input.format === 'summary' || input.format === 'detailed') {
                result.summary = {
                    total_tables: result.tables?.length || 0,
                    total_views: result.views?.length || 0,
                    total_functions: result.functions?.length || 0,
                    total_procedures: result.functions?.filter((f: any) => f.function_type === 'p').length || 0,
                };
            }

            // Generate TypeScript types
            if (input.format === 'typescript' && result.tables) {
                const interfaces = result.tables.map((table: any) => 
                    generateTypeScriptInterface(table.table_name, table.columns)
                ).join('\n\n');
                
                result.typescript_types = `// Generated TypeScript interfaces for schema: ${input.schema_name}\n\n${interfaces}`;
            }

            console.error(`Schema inspection completed. Found ${result.summary?.total_tables || 0} tables, ${result.summary?.total_views || 0} views, ${result.summary?.total_functions || 0} functions.`);

            return result;

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Failed to inspect schema:', errorMessage);
            throw new Error(`Schema inspection failed: ${errorMessage}`);
        }
    },
};
