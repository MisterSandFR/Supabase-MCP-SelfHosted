import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ToolContext } from "./types.js";
import { executeSqlWithFallback } from "./utils.js";

const GenerateCrudApiInputSchema = z.object({
    action: z.enum(['generate', 'analyze', 'list', 'deploy', 'test', 'document', 'validate', 'optimize', 'batch_generate']).describe("CRUD API action"),
    tableName: z.string().optional().describe("Table name to generate API for"),
    schemaName: z.string().optional().default('public').describe("Schema name"),
    apiType: z.enum(['rest', 'graphql', 'rpc', 'all']).optional().default('rest').describe("API type to generate"),
    authRequired: z.boolean().optional().default(true).describe("Require authentication"),
    operations: z.array(z.enum(['create', 'read', 'update', 'delete', 'list', 'search', 'bulk'])).optional().default(['create', 'read', 'update', 'delete', 'list']).describe("Operations to include"),
    outputFormat: z.enum(['typescript', 'javascript', 'python', 'curl', 'openapi']).optional().default('typescript').describe("Output format"),
    includeValidation: z.boolean().optional().default(true).describe("Include input validation"),
    includeFiltering: z.boolean().optional().default(true).describe("Include filtering capabilities"),
    includePagination: z.boolean().optional().default(true).describe("Include pagination"),
    includeRLS: z.boolean().optional().default(true).describe("Include RLS policies"),
    customEndpoints: z.array(z.object({
        name: z.string(),
        description: z.string(),
        method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
        path: z.string(),
        handler: z.string()
    })).optional().describe("Custom endpoints to add"),
    middleware: z.array(z.enum(['cors', 'helmet', 'ratelimit', 'logging', 'compression'])).optional().default(['cors', 'helmet']).describe("Middleware to include"),
    testGeneration: z.boolean().optional().default(true).describe("Generate test cases"),
    documentationGeneration: z.boolean().optional().default(true).describe("Generate API documentation"),
    performanceOptimization: z.boolean().optional().default(false).describe("Include performance optimizations"),
    batchOperations: z.boolean().optional().default(false).describe("Include batch operations"),
    searchOperations: z.boolean().optional().default(false).describe("Include search operations"),
    relationshipHandling: z.enum(['none', 'basic', 'advanced']).optional().default('basic').describe("Relationship handling level"),
    cacheIntegration: z.boolean().optional().default(false).describe("Include cache integration"),
    webhookIntegration: z.boolean().optional().default(false).describe("Include webhook integration"),
    deploymentTarget: z.enum(['supabase', 'vercel', 'netlify', 'docker', 'standalone']).optional().describe("Deployment target"),
    tables: z.array(z.string()).optional().describe("Multiple tables for batch generation"),
    customConfig: z.record(z.any()).optional().describe("Custom configuration options")
});

type GenerateCrudApiInput = z.infer<typeof GenerateCrudApiInputSchema>;
const generateCrudApiOutputSchema = z.object({
    content: z.array(z.object({
        type: z.literal("text"),
        text: z.string()
    }))
});


export const generateCrudApiTool = {
    name: "generate_crud_api",
    description: "Comprehensive CRUD API generator for Supabase with TypeScript, validation, authentication, testing, and deployment support",
    inputSchema: GenerateCrudApiInputSchema,
    mcpInputSchema: {
        type: "object",
        properties: {
            action: { 
                type: "string", 
                enum: ['generate', 'analyze', 'list', 'deploy', 'test', 'document', 'validate', 'optimize', 'batch_generate'], 
                description: "CRUD API action" 
            },
            tableName: { type: "string", description: "Table name to generate API for" },
            schemaName: { type: "string", description: "Schema name" },
            apiType: {
                type: "string",
                enum: ["rest", "graphql", "rpc", "all"],
                description: "API type"
            },
            authRequired: { type: "boolean", description: "Require authentication" },
            operations: {
                type: "array",
                items: {
                    type: "string",
                    enum: ["create", "read", "update", "delete", "list", "search", "bulk"]
                },
                description: "Operations to include"
            },
            outputFormat: {
                type: "string",
                enum: ["typescript", "javascript", "python", "curl", "openapi"],
                description: "Output format"
            },
            includeValidation: { type: "boolean", description: "Include validation" },
            includeFiltering: { type: "boolean", description: "Include filtering" },
            includePagination: { type: "boolean", description: "Include pagination" },
            includeRLS: { type: "boolean", description: "Include RLS policies" },
            customEndpoints: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        name: { type: "string" },
                        description: { type: "string" },
                        method: {
                            type: "string",
                            enum: ["GET", "POST", "PUT", "DELETE", "PATCH"]
                        },
                        path: { type: "string" },
                        handler: { type: "string" }
                    }
                }
            },
            middleware: {
                type: "array",
                items: {
                    type: "string",
                    enum: ["cors", "helmet", "ratelimit", "logging", "compression"]
                }
            },
            testGeneration: { type: "boolean", description: "Generate tests" },
            documentationGeneration: { type: "boolean", description: "Generate docs" },
            performanceOptimization: { type: "boolean", description: "Performance optimization" },
            batchOperations: { type: "boolean", description: "Batch operations" },
            searchOperations: { type: "boolean", description: "Search operations" },
            relationshipHandling: {
                type: "string",
                enum: ["none", "basic", "advanced"],
                description: "Relationship handling"
            },
            cacheIntegration: { type: "boolean", description: "Cache integration" },
            webhookIntegration: { type: "boolean", description: "Webhook integration" },
            deploymentTarget: {
                type: "string",
                enum: ["supabase", "vercel", "netlify", "docker", "standalone"],
                description: "Deployment target"
            },
            tables: {
                type: "array",
                items: { type: "string" },
                description: "Tables for batch generation"
            },
            customConfig: {
                type: "object",
                description: "Custom configuration"
            }
        },
        required: ["action"]
    },
    outputSchema: generateCrudApiOutputSchema,
    execute: async (input: unknown, context: ToolContext) => {
        const validatedInput = GenerateCrudApiInputSchema.parse(input);
        
        switch (validatedInput.action) {
            case 'analyze': {
                if (!validatedInput.tableName) {
                    throw new Error("Table name is required for analysis");
                }
                
                const tableAnalysis = await analyzeTableForAPI(
                    validatedInput.tableName,
                    validatedInput.schemaName,
                    context
                );
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            table_analysis: tableAnalysis,
                            api_recommendations: generateApiRecommendations(tableAnalysis),
                            complexity_score: calculateComplexityScore(tableAnalysis)
                        }, null, 2)
                    }]
                };
            }
            
            case 'generate': {
                if (!validatedInput.tableName) {
                    throw new Error("Table name is required for generation");
                }
                
                const tableInfo = await getTableInfo(
                    validatedInput.tableName,
                    validatedInput.schemaName,
                    context
                );
                
                const apiCode = await generateAPICode(tableInfo, validatedInput, context);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            generated_api: apiCode,
                            table: `${validatedInput.schemaName}.${validatedInput.tableName}`,
                            operations: validatedInput.operations,
                            output_format: validatedInput.outputFormat,
                            files_generated: Object.keys(apiCode.files).length
                        }, null, 2)
                    }]
                };
            }
            
            case 'batch_generate': {
                if (!validatedInput.tables || validatedInput.tables.length === 0) {
                    throw new Error("Tables list is required for batch generation");
                }
                
                const batchResults = [];
                
                for (const tableName of validatedInput.tables) {
                    try {
                        const tableInfo = await getTableInfo(tableName, validatedInput.schemaName, context);
                        const apiCode = await generateAPICode(tableInfo, {
                            ...validatedInput,
                            tableName
                        }, context);
                        
                        batchResults.push({
                            table: tableName,
                            success: true,
                            files_generated: Object.keys(apiCode.files).length,
                            api_code: apiCode
                        });
                        
                    } catch (error: any) {
                        batchResults.push({
                            table: tableName,
                            success: false,
                            error: error.message
                        });
                    }
                }
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            batch_results: batchResults,
                            total_tables: validatedInput.tables.length,
                            successful: batchResults.filter(r => r.success).length,
                            failed: batchResults.filter(r => !r.success).length
                        }, null, 2)
                    }]
                };
            }
            
            case 'document': {
                if (!validatedInput.tableName) {
                    throw new Error("Table name is required for documentation");
                }
                
                const tableInfo = await getTableInfo(
                    validatedInput.tableName,
                    validatedInput.schemaName,
                    context
                );
                
                const documentation = await generateAPIDocumentation(tableInfo, validatedInput);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            api_documentation: documentation,
                            format: validatedInput.outputFormat === 'openapi' ? 'OpenAPI 3.0' : 'Markdown',
                            table: `${validatedInput.schemaName}.${validatedInput.tableName}`
                        }, null, 2)
                    }]
                };
            }
            
            case 'test': {
                if (!validatedInput.tableName) {
                    throw new Error("Table name is required for test generation");
                }
                
                const tableInfo = await getTableInfo(
                    validatedInput.tableName,
                    validatedInput.schemaName,
                    context
                );
                
                const testCases = await generateTestCases(tableInfo, validatedInput);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            test_cases: testCases,
                            test_framework: validatedInput.outputFormat === 'typescript' ? 'Jest' : 'pytest',
                            coverage_areas: ['authentication', 'validation', 'crud_operations', 'error_handling']
                        }, null, 2)
                    }]
                };
            }
            
            case 'list': {
                const availableTablesSql = `
                    SELECT 
                        t.table_name,
                        t.table_type,
                        COUNT(c.column_name) as column_count,
                        array_agg(
                            c.column_name || ':' || c.data_type
                            ORDER BY c.ordinal_position
                        ) as columns,
                        CASE 
                            WHEN EXISTS(
                                SELECT 1 FROM pg_tables pt 
                                WHERE pt.schemaname = t.table_schema 
                                AND pt.tablename = t.table_name 
                                AND pt.rowsecurity = true
                            ) THEN true 
                            ELSE false 
                        END as has_rls,
                        CASE 
                            WHEN COUNT(tc.constraint_name) > 0 THEN true 
                            ELSE false 
                        END as has_constraints
                    FROM information_schema.tables t
                    LEFT JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
                    LEFT JOIN information_schema.table_constraints tc ON t.table_name = tc.table_name AND t.table_schema = tc.table_schema
                    WHERE t.table_schema = $1
                    AND t.table_type = 'BASE TABLE'
                    GROUP BY t.table_name, t.table_type, t.table_schema
                    ORDER BY t.table_name
                `;
                
                const tablesResult = await executeSqlWithFallback(availableTablesSql, context, [validatedInput.schemaName]);
                
                const tablesWithRecommendations = tablesResult.data.map((table: any) => ({
                    ...table,
                    api_suitability: assessApiSuitability(table),
                    recommended_operations: getRecommendedOperations(table),
                    estimated_complexity: estimateApiComplexity(table)
                }));
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            available_tables: tablesWithRecommendations,
                            schema: validatedInput.schemaName,
                            total_tables: tablesWithRecommendations.length,
                            suitable_for_api: tablesWithRecommendations.filter(t => t.api_suitability === 'high').length
                        }, null, 2)
                    }]
                };
            }
            
            case 'validate': {
                if (!validatedInput.tableName) {
                    throw new Error("Table name is required for validation");
                }
                
                const validationResults = await validateAPIGeneration(
                    validatedInput.tableName,
                    validatedInput.schemaName,
                    context,
                    validatedInput
                );
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            validation_results: validationResults,
                            is_valid: validationResults.errors.length === 0,
                            can_generate_api: validationResults.errors.length === 0 && validationResults.warnings.length < 3
                        }, null, 2)
                    }]
                };
            }
            
            case 'optimize': {
                if (!validatedInput.tableName) {
                    throw new Error("Table name is required for optimization");
                }
                
                const optimizations = await generateOptimizations(
                    validatedInput.tableName,
                    validatedInput.schemaName,
                    context,
                    validatedInput
                );
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            optimizations: optimizations,
                            performance_improvements: optimizations.filter((o: any) => o.category === 'performance').length,
                            security_improvements: optimizations.filter((o: any) => o.category === 'security').length
                        }, null, 2)
                    }]
                };
            }
            
            default:
                throw new Error(`Unknown action: ${validatedInput.action}`);
        }
    }
};

async function analyzeTableForAPI(tableName: string, schemaName: string, context: ToolContext): Promise<any> {
    const analysisSql = `
        WITH table_info AS (
            SELECT 
                c.column_name,
                c.data_type,
                c.is_nullable,
                c.column_default,
                c.character_maximum_length,
                c.numeric_precision,
                c.numeric_scale,
                c.ordinal_position
            FROM information_schema.columns c
            WHERE c.table_schema = $1 AND c.table_name = $2
            ORDER BY c.ordinal_position
        ),
        constraints_info AS (
            SELECT 
                tc.constraint_type,
                kcu.column_name,
                tc.constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_schema = $1 AND tc.table_name = $2
        ),
        foreign_keys AS (
            SELECT 
                kcu.column_name as local_column,
                ccu.table_name as foreign_table,
                ccu.column_name as foreign_column
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
            WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'FOREIGN KEY'
        )
        SELECT 
            ti.column_name,
            ti.data_type,
            ti.is_nullable,
            ti.column_default,
            ti.character_maximum_length,
            ti.numeric_precision,
            ti.numeric_scale,
            ti.ordinal_position,
            COALESCE(ci.constraint_type, '') as constraint_type,
            fk.foreign_table,
            fk.foreign_column
        FROM table_info ti
        LEFT JOIN constraints_info ci ON ti.column_name = ci.column_name
        LEFT JOIN foreign_keys fk ON ti.column_name = fk.local_column
        ORDER BY ti.ordinal_position
    `;
    
    const result = await executeSqlWithFallback(analysisSql, context, [schemaName, tableName]);
    
    const analysis = {
        table_name: tableName,
        schema_name: schemaName,
        columns: result.data,
        primary_key: result.data.find((c: any) => c.constraint_type === 'PRIMARY KEY')?.column_name,
        foreign_keys: result.data.filter((c: any) => c.foreign_table),
        nullable_columns: result.data.filter((c: any) => c.is_nullable === 'YES'),
        required_columns: result.data.filter((c: any) => c.is_nullable === 'NO' && !c.column_default),
        data_types: result.data.reduce((acc: any, col: any) => {
            acc[col.data_type] = (acc[col.data_type] || 0) + 1;
            return acc;
        }, {}),
        relationships: {
            has_foreign_keys: result.data.some((c: any) => c.foreign_table),
            foreign_key_count: result.data.filter((c: any) => c.foreign_table).length
        }
    };
    
    return analysis;
}

async function getTableInfo(tableName: string, schemaName: string, context: ToolContext): Promise<any> {
    const tableInfoSql = `
        SELECT 
            c.column_name,
            c.data_type,
            c.is_nullable,
            c.column_default,
            c.character_maximum_length,
            tc.constraint_type
        FROM information_schema.columns c
        LEFT JOIN information_schema.key_column_usage kcu ON c.column_name = kcu.column_name 
            AND c.table_name = kcu.table_name AND c.table_schema = kcu.table_schema
        LEFT JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
        WHERE c.table_schema = $1 AND c.table_name = $2
        ORDER BY c.ordinal_position
    `;
    
    const result = await executeSqlWithFallback(tableInfoSql, context, [schemaName, tableName]);
    
    return {
        table_name: tableName,
        schema_name: schemaName,
        columns: result.data
    };
}

async function generateAPICode(tableInfo: any, options: GenerateCrudApiInput, context: ToolContext): Promise<any> {
    const apiFiles = {};
    
    // Generate TypeScript interfaces
    if (options.outputFormat === 'typescript') {
        apiFiles['types.ts'] = generateTypeScriptTypes(tableInfo, options);
        apiFiles['api.ts'] = generateTypeScriptAPI(tableInfo, options);
        if (options.includeValidation) {
            apiFiles['validation.ts'] = generateValidationSchema(tableInfo, options);
        }
    }
    
    // Generate JavaScript version
    if (options.outputFormat === 'javascript') {
        apiFiles['api.js'] = generateJavaScriptAPI(tableInfo, options);
    }
    
    // Generate Python version
    if (options.outputFormat === 'python') {
        apiFiles['api.py'] = generatePythonAPI(tableInfo, options);
    }
    
    // Generate cURL examples
    if (options.outputFormat === 'curl') {
        apiFiles['examples.sh'] = generateCurlExamples(tableInfo, options);
    }
    
    // Generate OpenAPI specification
    if (options.outputFormat === 'openapi' || options.documentationGeneration) {
        apiFiles['openapi.yaml'] = generateOpenAPISpec(tableInfo, options);
    }
    
    // Generate tests
    if (options.testGeneration) {
        apiFiles['tests.ts'] = generateTestFile(tableInfo, options);
    }
    
    // Generate deployment files
    if (options.deploymentTarget) {
        const deploymentFiles = generateDeploymentFiles(tableInfo, options);
        Object.assign(apiFiles, deploymentFiles);
    }
    
    return {
        table: tableInfo.table_name,
        files: apiFiles,
        operations: options.operations,
        metadata: {
            auth_required: options.authRequired,
            includes_validation: options.includeValidation,
            includes_pagination: options.includePagination,
            includes_filtering: options.includeFiltering,
            middleware: options.middleware
        }
    };
}

function generateTypeScriptTypes(tableInfo: any, options: GenerateCrudApiInput): string {
    const interfaceName = toPascalCase(tableInfo.table_name);
    
    const properties = tableInfo.columns.map((col: any) => {
        const optional = col.is_nullable === 'YES' || col.column_default ? '?' : '';
        const type = mapPostgresToTypeScript(col.data_type);
        return `  ${col.column_name}${optional}: ${type};`;
    }).join('\n');
    
    return `// Generated TypeScript types for ${tableInfo.table_name}

export interface ${interfaceName} {
${properties}
}

export interface Create${interfaceName}Request {
${tableInfo.columns
    .filter((col: any) => !isAutoGenerated(col))
    .map((col: any) => {
        const optional = col.is_nullable === 'YES' || col.column_default ? '?' : '';
        const type = mapPostgresToTypeScript(col.data_type);
        return `  ${col.column_name}${optional}: ${type};`;
    }).join('\n')}
}

export interface Update${interfaceName}Request {
${tableInfo.columns
    .filter((col: any) => !isAutoGenerated(col) && !isPrimaryKey(col))
    .map((col: any) => {
        const type = mapPostgresToTypeScript(col.data_type);
        return `  ${col.column_name}?: ${type};`;
    }).join('\n')}
}

export interface ${interfaceName}Response {
  data: ${interfaceName}[];
  count?: number;
  error?: string;
}`;
}

function generateTypeScriptAPI(tableInfo: any, options: GenerateCrudApiInput): string {
    const className = toPascalCase(tableInfo.table_name);
    const tableName = tableInfo.table_name;
    
    let apiCode = `// Generated API for ${tableName}
import { createClient } from '@supabase/supabase-js';
import { ${className}, Create${className}Request, Update${className}Request, ${className}Response } from './types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export class ${className}API {
`;

    // Generate CRUD operations
    if (options.operations.includes('create')) {
        apiCode += `
  static async create(data: Create${className}Request): Promise<${className}Response> {
    try {
      const { data: result, error } = await supabase
        .from('${tableName}')
        .insert([data])
        .select();
      
      if (error) throw error;
      
      return { data: result };
    } catch (error: any) {
      return { data: [], error: error.message };
    }
  }
`;
    }

    if (options.operations.includes('read')) {
        const primaryKey = getPrimaryKeyColumn(tableInfo);
        apiCode += `
  static async getById(id: ${mapPostgresToTypeScript(primaryKey?.data_type || 'bigint')}): Promise<${className}Response> {
    try {
      const { data, error } = await supabase
        .from('${tableName}')
        .select('*')
        .eq('${primaryKey?.column_name || 'id'}', id)
        .single();
      
      if (error) throw error;
      
      return { data: [data] };
    } catch (error: any) {
      return { data: [], error: error.message };
    }
  }
`;
    }

    if (options.operations.includes('list')) {
        apiCode += `
  static async list(options?: {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    filters?: Record<string, any>;
  }): Promise<${className}Response> {
    try {
      let query = supabase.from('${tableName}').select('*', { count: 'exact' });
      
      // Apply filters
      if (options?.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }
      
      // Apply ordering
      if (options?.orderBy) {
        query = query.order(options.orderBy, { 
          ascending: options.orderDirection !== 'desc' 
        });
      }
      
      // Apply pagination
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      }
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      return { data: data || [], count: count || 0 };
    } catch (error: any) {
      return { data: [], error: error.message };
    }
  }
`;
    }

    if (options.operations.includes('update')) {
        const primaryKey = getPrimaryKeyColumn(tableInfo);
        apiCode += `
  static async update(id: ${mapPostgresToTypeScript(primaryKey?.data_type || 'bigint')}, data: Update${className}Request): Promise<${className}Response> {
    try {
      const { data: result, error } = await supabase
        .from('${tableName}')
        .update(data)
        .eq('${primaryKey?.column_name || 'id'}', id)
        .select();
      
      if (error) throw error;
      
      return { data: result };
    } catch (error: any) {
      return { data: [], error: error.message };
    }
  }
`;
    }

    if (options.operations.includes('delete')) {
        const primaryKey = getPrimaryKeyColumn(tableInfo);
        apiCode += `
  static async delete(id: ${mapPostgresToTypeScript(primaryKey?.data_type || 'bigint')}): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('${tableName}')
        .delete()
        .eq('${primaryKey?.column_name || 'id'}', id);
      
      if (error) throw error;
      
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
`;
    }

    if (options.operations.includes('search')) {
        apiCode += `
  static async search(query: string, columns?: string[]): Promise<${className}Response> {
    try {
      const searchColumns = columns || ${JSON.stringify(getSearchableColumns(tableInfo))};
      let supabaseQuery = supabase.from('${tableName}').select('*');
      
      // Use text search across specified columns
      const orConditions = searchColumns
        .map(col => \`\${col}.ilike.%\${query}%\`)
        .join(',');
      
      const { data, error } = await supabaseQuery.or(orConditions);
      
      if (error) throw error;
      
      return { data: data || [] };
    } catch (error: any) {
      return { data: [], error: error.message };
    }
  }
`;
    }

    apiCode += `
}`;

    return apiCode;
}

function generateValidationSchema(tableInfo: any, options: GenerateCrudApiInput): string {
    const className = toPascalCase(tableInfo.table_name);
    
    let validationCode = `// Validation schemas for ${tableInfo.table_name}
import { z } from 'zod';

`;

    // Generate Zod schemas for each operation
    const createSchema = tableInfo.columns
        .filter((col: any) => !isAutoGenerated(col))
        .map((col: any) => generateZodField(col))
        .join(',\n  ');

    validationCode += `export const create${className}Schema = z.object({
  ${createSchema}
});

`;

    const updateSchema = tableInfo.columns
        .filter((col: any) => !isAutoGenerated(col) && !isPrimaryKey(col))
        .map((col: any) => generateZodField(col, true))
        .join(',\n  ');

    validationCode += `export const update${className}Schema = z.object({
  ${updateSchema}
});

`;

    return validationCode;
}

async function generateAPIDocumentation(tableInfo: any, options: GenerateCrudApiInput): Promise<any> {
    const className = toPascalCase(tableInfo.table_name);
    const tableName = tableInfo.table_name;
    
    if (options.outputFormat === 'openapi') {
        return generateOpenAPISpec(tableInfo, options);
    }
    
    // Generate Markdown documentation
    const docs = `# ${className} API

## Table Information
- **Table**: \`${tableName}\`
- **Schema**: \`${tableInfo.schema_name}\`
- **Columns**: ${tableInfo.columns.length}

## Columns
${tableInfo.columns.map((col: any) => `
- **${col.column_name}**: ${col.data_type}${col.is_nullable === 'NO' ? ' (required)' : ' (optional)'}`).join('')}

## Available Operations
${options.operations.map((op: string) => `- ${op.toUpperCase()}`).join('\n')}

## API Endpoints

### Create ${className}
\`\`\`
POST /api/${tableName}
Content-Type: application/json

{
  // Request body based on Create${className}Request interface
}
\`\`\`

### Get ${className} by ID
\`\`\`
GET /api/${tableName}/:id
\`\`\`

### List ${className}s
\`\`\`
GET /api/${tableName}?limit=10&offset=0&orderBy=id&orderDirection=asc
\`\`\`

### Update ${className}
\`\`\`
PUT /api/${tableName}/:id
Content-Type: application/json

{
  // Request body based on Update${className}Request interface
}
\`\`\`

### Delete ${className}
\`\`\`
DELETE /api/${tableName}/:id
\`\`\`
`;

    return {
        format: 'markdown',
        content: docs,
        table: tableName,
        operations: options.operations
    };
}

async function generateTestCases(tableInfo: any, options: GenerateCrudApiInput): Promise<any> {
    const className = toPascalCase(tableInfo.table_name);
    
    const testContent = `// Generated tests for ${tableInfo.table_name}
import { ${className}API } from './api';
import { create${className}Schema, update${className}Schema } from './validation';

describe('${className}API', () => {
  const mockData = ${generateMockData(tableInfo)};
  
  describe('create', () => {
    it('should create a new ${tableInfo.table_name}', async () => {
      const result = await ${className}API.create(mockData);
      expect(result.data).toBeDefined();
      expect(result.error).toBeUndefined();
    });
    
    it('should validate input data', () => {
      const validationResult = create${className}Schema.safeParse(mockData);
      expect(validationResult.success).toBe(true);
    });
  });
  
  describe('list', () => {
    it('should list ${tableInfo.table_name}s with pagination', async () => {
      const result = await ${className}API.list({ limit: 10, offset: 0 });
      expect(result.data).toBeInstanceOf(Array);
      expect(result.count).toBeDefined();
    });
  });
  
  describe('getById', () => {
    it('should get ${tableInfo.table_name} by id', async () => {
      const result = await ${className}API.getById(1);
      expect(result.data).toBeDefined();
    });
  });
  
  describe('update', () => {
    it('should update ${tableInfo.table_name}', async () => {
      const updateData = { /* partial update data */ };
      const result = await ${className}API.update(1, updateData);
      expect(result.data).toBeDefined();
    });
  });
  
  describe('delete', () => {
    it('should delete ${tableInfo.table_name}', async () => {
      const result = await ${className}API.delete(1);
      expect(result.success).toBe(true);
    });
  });
});`;

    return {
        framework: 'jest',
        content: testContent,
        test_cases: options.operations.length * 2, // Assuming 2 tests per operation
        coverage_areas: ['crud_operations', 'validation', 'error_handling']
    };
}

// Helper functions
function toPascalCase(str: string): string {
    return str.replace(/(?:^|_)(.)/g, (_, char) => char.toUpperCase());
}

function mapPostgresToTypeScript(pgType: string): string {
    const typeMap = {
        'integer': 'number',
        'bigint': 'number',
        'smallint': 'number',
        'decimal': 'number',
        'numeric': 'number',
        'real': 'number',
        'double precision': 'number',
        'serial': 'number',
        'bigserial': 'number',
        'varchar': 'string',
        'char': 'string',
        'text': 'string',
        'uuid': 'string',
        'boolean': 'boolean',
        'timestamp': 'string',
        'timestamptz': 'string',
        'date': 'string',
        'time': 'string',
        'json': 'any',
        'jsonb': 'any',
        'array': 'any[]'
    };
    
    return typeMap[pgType as keyof typeof typeMap] || 'any';
}

function isAutoGenerated(col: any): boolean {
    return col.column_default && (
        col.column_default.includes('nextval') ||
        col.column_default.includes('uuid_generate') ||
        col.column_default.includes('now()')
    );
}

function isPrimaryKey(col: any): boolean {
    return col.constraint_type === 'PRIMARY KEY';
}

function getPrimaryKeyColumn(tableInfo: any): any {
    return tableInfo.columns.find((col: any) => isPrimaryKey(col)) || 
           tableInfo.columns.find((col: any) => col.column_name === 'id');
}

function getSearchableColumns(tableInfo: any): string[] {
    return tableInfo.columns
        .filter((col: any) => ['varchar', 'char', 'text'].includes(col.data_type))
        .map((col: any) => col.column_name);
}

function generateZodField(col: any, optional: boolean = false): string {
    const baseType = mapPostgresToZod(col.data_type);
    const isOptional = optional || col.is_nullable === 'YES' || col.column_default;
    
    let field = `${col.column_name}: ${baseType}`;
    
    if (col.character_maximum_length) {
        field = field.replace('z.string()', `z.string().max(${col.character_maximum_length})`);
    }
    
    if (isOptional) {
        field += '.optional()';
    }
    
    return field;
}

function mapPostgresToZod(pgType: string): string {
    const typeMap = {
        'integer': 'z.number().int()',
        'bigint': 'z.number().int()',
        'smallint': 'z.number().int()',
        'decimal': 'z.number()',
        'numeric': 'z.number()',
        'varchar': 'z.string()',
        'char': 'z.string()',
        'text': 'z.string()',
        'uuid': 'z.string().uuid()',
        'boolean': 'z.boolean()',
        'timestamp': 'z.string().datetime()',
        'date': 'z.string().date()',
        'json': 'z.any()',
        'jsonb': 'z.any()'
    };
    
    return typeMap[pgType as keyof typeof typeMap] || 'z.any()';
}

function generateMockData(tableInfo: any): string {
    const mockFields = tableInfo.columns
        .filter((col: any) => !isAutoGenerated(col))
        .map((col: any) => {
            const mockValue = generateMockValue(col);
            return `    ${col.column_name}: ${mockValue}`;
        })
        .join(',\n');
    
    return `{\n${mockFields}\n  }`;
}

function generateMockValue(col: any): string {
    switch (col.data_type) {
        case 'varchar':
        case 'char':
        case 'text':
            return `'test ${col.column_name}'`;
        case 'integer':
        case 'bigint':
        case 'smallint':
            return '1';
        case 'boolean':
            return 'true';
        case 'uuid':
            return "'123e4567-e89b-12d3-a456-426614174000'";
        case 'timestamp':
        case 'timestamptz':
            return "'2023-01-01T00:00:00Z'";
        default:
            return 'null';
    }
}

function generateOpenAPISpec(tableInfo: any, options: GenerateCrudApiInput): string {
    // Generate OpenAPI 3.0 specification
    const spec = {
        openapi: '3.0.0',
        info: {
            title: `${toPascalCase(tableInfo.table_name)} API`,
            version: '1.0.0',
            description: `Generated API for ${tableInfo.table_name} table`
        },
        paths: {},
        components: {
            schemas: {}
        }
    };
    
    return JSON.stringify(spec, null, 2);
}

function generateJavaScriptAPI(tableInfo: any, options: GenerateCrudApiInput): string {
    // Convert TypeScript to JavaScript (simplified)
    const tsCode = generateTypeScriptAPI(tableInfo, options);
    return tsCode
        .replace(/: [^=\s,)]+/g, '') // Remove type annotations
        .replace(/interface \w+ \{[^}]+\}/gs, '') // Remove interfaces
        .replace(/export interface[^}]+\}/gs, ''); // Remove interface exports
}

function generatePythonAPI(tableInfo: any, options: GenerateCrudApiInput): string {
    const className = toPascalCase(tableInfo.table_name);
    
    return `# Generated Python API for ${tableInfo.table_name}
from supabase import create_client, Client
from typing import Dict, List, Optional, Any
import os

class ${className}API:
    def __init__(self):
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_ANON_KEY")
        self.supabase: Client = create_client(url, key)
    
    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            result = self.supabase.table('${tableInfo.table_name}').insert(data).execute()
            return {"data": result.data, "error": None}
        except Exception as e:
            return {"data": [], "error": str(e)}
    
    def get_by_id(self, id: int) -> Dict[str, Any]:
        try:
            result = self.supabase.table('${tableInfo.table_name}').select("*").eq('id', id).single().execute()
            return {"data": [result.data], "error": None}
        except Exception as e:
            return {"data": [], "error": str(e)}
    
    def list(self, limit: int = 10, offset: int = 0) -> Dict[str, Any]:
        try:
            result = self.supabase.table('${tableInfo.table_name}').select("*").range(offset, offset + limit - 1).execute()
            return {"data": result.data, "count": len(result.data), "error": None}
        except Exception as e:
            return {"data": [], "error": str(e)}
`;
}

function generateCurlExamples(tableInfo: any, options: GenerateCrudApiInput): string {
    const tableName = tableInfo.table_name;
    
    return `#!/bin/bash
# cURL examples for ${tableName} API

# Create ${tableName}
curl -X POST "http://localhost:3000/api/${tableName}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer \$SUPABASE_ANON_KEY" \\
  -d '{
    "name": "example name",
    "description": "example description"
  }'

# Get ${tableName} by ID
curl -X GET "http://localhost:3000/api/${tableName}/1" \\
  -H "Authorization: Bearer \$SUPABASE_ANON_KEY"

# List ${tableName}s
curl -X GET "http://localhost:3000/api/${tableName}?limit=10&offset=0" \\
  -H "Authorization: Bearer \$SUPABASE_ANON_KEY"

# Update ${tableName}
curl -X PUT "http://localhost:3000/api/${tableName}/1" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer \$SUPABASE_ANON_KEY" \\
  -d '{
    "name": "updated name"
  }'

# Delete ${tableName}
curl -X DELETE "http://localhost:3000/api/${tableName}/1" \\
  -H "Authorization: Bearer \$SUPABASE_ANON_KEY"
`;
}

function generateDeploymentFiles(tableInfo: any, options: GenerateCrudApiInput): any {
    const files: any = {};
    
    if (options.deploymentTarget === 'docker') {
        files['Dockerfile'] = `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]`;
        
        files['docker-compose.yml'] = `version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - SUPABASE_URL=\${SUPABASE_URL}
      - SUPABASE_ANON_KEY=\${SUPABASE_ANON_KEY}`;
    }
    
    if (options.deploymentTarget === 'vercel') {
        files['vercel.json'] = JSON.stringify({
            version: 2,
            builds: [
                {
                    src: "api/**/*.ts",
                    use: "@vercel/node"
                }
            ],
            routes: [
                {
                    src: "/api/(.*)",
                    dest: "/api/$1"
                }
            ]
        }, null, 2);
    }
    
    return files;
}

function generateTestFile(tableInfo: any, options: GenerateCrudApiInput): string {
    return generateTestCases(tableInfo, options).then((tests: any) => tests.content);
}

function generateApiRecommendations(analysis: any): string[] {
    const recommendations = [];
    
    if (!analysis.primary_key) {
        recommendations.push('Consider adding a primary key for better API performance');
    }
    
    if (analysis.required_columns.length > 5) {
        recommendations.push('Many required columns detected - consider making some optional');
    }
    
    if (analysis.relationships.foreign_key_count > 0) {
        recommendations.push('Include relationship handling for connected tables');
    }
    
    if (analysis.nullable_columns.length > analysis.columns.length * 0.7) {
        recommendations.push('Many nullable columns - ensure proper validation');
    }
    
    return recommendations;
}

function calculateComplexityScore(analysis: any): number {
    let score = 1; // Base complexity
    
    // Add complexity for number of columns
    score += Math.floor(analysis.columns.length / 5);
    
    // Add complexity for relationships
    score += analysis.relationships.foreign_key_count * 2;
    
    // Add complexity for different data types
    score += Object.keys(analysis.data_types).length;
    
    return Math.min(score, 10); // Cap at 10
}

function assessApiSuitability(table: any): 'low' | 'medium' | 'high' {
    let score = 0;
    
    if (table.has_rls) score += 2;
    if (table.has_constraints) score += 1;
    if (table.column_count >= 3 && table.column_count <= 15) score += 2;
    if (table.column_count > 15) score -= 1;
    
    if (score >= 4) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
}

function getRecommendedOperations(table: any): string[] {
    const operations = ['create', 'read', 'list'];
    
    if (table.has_constraints) {
        operations.push('update', 'delete');
    }
    
    if (table.column_count > 5) {
        operations.push('search');
    }
    
    return operations;
}

function estimateApiComplexity(table: any): 'low' | 'medium' | 'high' {
    let complexity = 0;
    
    complexity += Math.floor(table.column_count / 5);
    if (table.has_rls) complexity += 1;
    if (table.columns.some((c: string) => c.includes('json'))) complexity += 2;
    
    if (complexity >= 4) return 'high';
    if (complexity >= 2) return 'medium';
    return 'low';
}

async function validateAPIGeneration(tableName: string, schemaName: string, context: ToolContext, options: GenerateCrudApiInput): Promise<any> {
    const errors = [];
    const warnings = [];
    
    // Check if table exists
    const tableExistsSql = `
        SELECT COUNT(*) as count
        FROM information_schema.tables 
        WHERE table_schema = $1 AND table_name = $2
    `;
    
    const tableExists = await executeSqlWithFallback(tableExistsSql, context, [schemaName, tableName]);
    
    if (tableExists.data[0].count === 0) {
        errors.push(`Table ${schemaName}.${tableName} does not exist`);
    }
    
    // Check for primary key
    const primaryKeySql = `
        SELECT COUNT(*) as count
        FROM information_schema.table_constraints
        WHERE table_schema = $1 AND table_name = $2 AND constraint_type = 'PRIMARY KEY'
    `;
    
    const hasPrimaryKey = await executeSqlWithFallback(primaryKeySql, context, [schemaName, tableName]);
    
    if (hasPrimaryKey.data[0].count === 0) {
        warnings.push('Table has no primary key - some operations may not work as expected');
    }
    
    return {
        table: `${schemaName}.${tableName}`,
        errors,
        warnings,
        validation_passed: errors.length === 0
    };
}

async function generateOptimizations(tableName: string, schemaName: string, context: ToolContext, options: GenerateCrudApiInput): Promise<any[]> {
    const optimizations = [];
    
    // Check for missing indexes
    const indexSql = `
        SELECT 
            t.attname as column_name,
            pg_catalog.format_type(t.atttypid, t.atttypmod) as data_type
        FROM pg_catalog.pg_attribute t
        JOIN pg_catalog.pg_class c ON t.attrelid = c.oid
        JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = $1 
        AND c.relname = $2
        AND t.attnum > 0
        AND NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_index i
            WHERE i.indrelid = c.oid
            AND t.attnum = ANY(i.indkey)
        )
        AND t.atttypid IN (23, 25, 1043) -- int4, text, varchar
    `;
    
    const missingIndexes = await executeSqlWithFallback(indexSql, context, [schemaName, tableName]);
    
    for (const col of missingIndexes.data) {
        optimizations.push({
            category: 'performance',
            type: 'index',
            description: `Consider adding index on column ${col.column_name} for better query performance`,
            sql: `CREATE INDEX idx_${tableName}_${col.column_name} ON ${schemaName}.${tableName}(${col.column_name});`,
            impact: 'medium'
        });
    }
    
    return optimizations;
}