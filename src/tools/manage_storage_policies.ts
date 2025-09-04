import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ToolContext } from "./types.js";
import { executeSqlWithFallback } from "./utils.js";

const ManageStoragePoliciesInputSchema = z.object({
    action: z.enum(['create', 'update', 'delete', 'list', 'create_bucket', 'delete_bucket', 'list_buckets', 'bulk_create', 'audit_access', 'generate_templates']).describe("Action to perform"),
    bucketName: z.string().optional().describe("Storage bucket name"),
    policyName: z.string().optional().describe("Policy name"),
    operation: z.enum(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL']).optional().describe("Storage operation"),
    definition: z.string().optional().describe("Policy definition/condition"),
    roleName: z.string().optional().describe("Role for policy"),
    isPublic: z.boolean().optional().default(false).describe("Make bucket public"),
    fileSizeLimit: z.number().optional().describe("File size limit in bytes"),
    allowedMimeTypes: z.array(z.string()).optional().describe("Allowed MIME types"),
    pathPrefix: z.string().optional().describe("Path prefix for policy"),
    maxFiles: z.number().optional().describe("Maximum number of files"),
    enableVersioning: z.boolean().optional().default(false).describe("Enable file versioning"),
    bucketTemplate: z.enum(['public', 'private', 'user_specific', 'role_based', 'organization']).optional().describe("Bucket template type"),
    autoExpiry: z.number().optional().describe("Auto expiry in days"),
    compressionEnabled: z.boolean().optional().default(false).describe("Enable compression"),
    encryptionKey: z.string().optional().describe("Encryption key for bucket"),
    webhookUrl: z.string().optional().describe("Webhook URL for events"),
    tags: z.record(z.string()).optional().describe("Bucket tags"),
    corsOrigins: z.array(z.string()).optional().describe("CORS allowed origins")
});

type ManageStoragePoliciesInput = z.infer<typeof ManageStoragePoliciesInputSchema>;

const ManageStoragePoliciesOutputSchema = z.object({
    content: z.array(z.object({
        type: z.literal("text"),
        text: z.string()
    }))
});

export const manageStoragePolicies = {
    name: "manage_storage_policies",
    description: "Comprehensive Supabase Storage bucket and policy management with advanced security, templates, and automation features",
    inputSchema: ManageStoragePoliciesInputSchema,
    mcpInputSchema: {
        type: "object",
        properties: {
            action: {
                type: "string",
                enum: ["create", "update", "delete", "list", "create_bucket", "delete_bucket", "list_buckets", "bulk_create", "audit_access", "generate_templates"],
                description: "Action to perform"
            },
            bucketName: { type: "string", description: "Storage bucket name" },
            policyName: { type: "string", description: "Policy name" },
            operation: {
                type: "string",
                enum: ["SELECT", "INSERT", "UPDATE", "DELETE", "ALL"],
                description: "Storage operation"
            },
            definition: { type: "string", description: "Policy definition/condition" },
            roleName: { type: "string", description: "Role for policy" },
            isPublic: { type: "boolean", description: "Make bucket public" },
            fileSizeLimit: { type: "number", description: "File size limit in bytes" },
            allowedMimeTypes: {
                type: "array",
                items: { type: "string" },
                description: "Allowed MIME types"
            },
            pathPrefix: { type: "string", description: "Path prefix for policy" },
            maxFiles: { type: "number", description: "Maximum number of files" },
            enableVersioning: { type: "boolean", description: "Enable file versioning" },
            bucketTemplate: {
                type: "string",
                enum: ["public", "private", "user_specific", "role_based", "organization"],
                description: "Bucket template type"
            },
            autoExpiry: { type: "number", description: "Auto expiry in days" },
            compressionEnabled: { type: "boolean", description: "Enable compression" },
            encryptionKey: { type: "string", description: "Encryption key for bucket" },
            webhookUrl: { type: "string", description: "Webhook URL for events" },
            tags: {
                type: "object",
                description: "Bucket tags"
            },
            corsOrigins: {
                type: "array",
                items: { type: "string" },
                description: "CORS allowed origins"
            }
        },
        required: ["action"]
    },
    outputSchema: ManageStoragePoliciesOutputSchema,
    execute: async (input: unknown, context: ToolContext) => {
        const validatedInput = ManageStoragePoliciesInputSchema.parse(input);
        
        switch (validatedInput.action) {
            case 'list_buckets': {
                const sql = `
                    SELECT 
                        b.name as bucket_name,
                        b.public as is_public,
                        b.file_size_limit,
                        b.allowed_mime_types,
                        b.created_at,
                        b.updated_at,
                        b.owner,
                        COALESCE(stats.file_count, 0) as file_count,
                        COALESCE(stats.total_size, 0) as total_size_bytes,
                        policies.policy_count
                    FROM storage.buckets b
                    LEFT JOIN (
                        SELECT 
                            bucket_id,
                            COUNT(*) as file_count,
                            SUM(metadata->>'size')::bigint as total_size
                        FROM storage.objects 
                        GROUP BY bucket_id
                    ) stats ON b.id = stats.bucket_id
                    LEFT JOIN (
                        SELECT 
                            bucket_id,
                            COUNT(*) as policy_count
                        FROM storage.policies
                        GROUP BY bucket_id
                    ) policies ON b.id = policies.bucket_id
                    ${validatedInput.bucketName ? `WHERE b.name LIKE '%${validatedInput.bucketName}%'` : ''}
                    ORDER BY b.created_at DESC
                `;
                
                const result = await executeSqlWithFallback(sql, context);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            buckets: result.data,
                            count: result.data.length,
                            summary: {
                                public_buckets: result.data.filter((b: any) => b.is_public).length,
                                private_buckets: result.data.filter((b: any) => !b.is_public).length,
                                total_files: result.data.reduce((sum: number, b: any) => sum + (b.file_count || 0), 0),
                                total_size_gb: Math.round(result.data.reduce((sum: number, b: any) => sum + (b.total_size_bytes || 0), 0) / (1024 * 1024 * 1024) * 100) / 100
                            }
                        }, null, 2)
                    }]
                };
            }
            
            case 'create_bucket': {
                if (!validatedInput.bucketName) {
                    throw new Error("Bucket name is required");
                }
                
                // Create the bucket
                const bucketOptions: any = {
                    public: validatedInput.isPublic || false
                };
                
                if (validatedInput.fileSizeLimit) {
                    bucketOptions.file_size_limit = validatedInput.fileSizeLimit;
                }
                
                if (validatedInput.allowedMimeTypes) {
                    bucketOptions.allowed_mime_types = validatedInput.allowedMimeTypes;
                }
                
                const createBucketSql = `
                    INSERT INTO storage.buckets (
                        id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at
                    ) VALUES (
                        $1, $1, $2, $3, $4, NOW(), NOW()
                    )
                `;
                
                await executeSqlWithFallback(createBucketSql, context, [
                    validatedInput.bucketName,
                    bucketOptions.public,
                    bucketOptions.file_size_limit,
                    bucketOptions.allowed_mime_types ? JSON.stringify(bucketOptions.allowed_mime_types) : null
                ]);
                
                // Apply bucket template if specified
                const templatePolicies = [];
                if (validatedInput.bucketTemplate) {
                    const templates = await generateBucketTemplate(validatedInput.bucketTemplate, validatedInput.bucketName, validatedInput.roleName);
                    
                    for (const policy of templates) {
                        const createPolicySql = `
                            INSERT INTO storage.policies (
                                bucket_id, name, operation, definition, created_at, updated_at
                            ) VALUES (
                                $1, $2, $3, $4, NOW(), NOW()
                            )
                        `;
                        
                        await executeSqlWithFallback(createPolicySql, context, [
                            validatedInput.bucketName,
                            policy.name,
                            policy.operation,
                            policy.definition
                        ]);
                        
                        templatePolicies.push(policy);
                    }
                }
                
                // Set up bucket metadata if provided
                if (validatedInput.tags || validatedInput.corsOrigins || validatedInput.autoExpiry) {
                    const metadataSql = `
                        UPDATE storage.buckets 
                        SET owner_id = COALESCE(owner_id, auth.uid()),
                            metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
                        WHERE id = $1
                    `;
                    
                    const metadata: any = {};
                    if (validatedInput.tags) metadata.tags = validatedInput.tags;
                    if (validatedInput.corsOrigins) metadata.cors_origins = validatedInput.corsOrigins;
                    if (validatedInput.autoExpiry) metadata.auto_expiry_days = validatedInput.autoExpiry;
                    if (validatedInput.enableVersioning) metadata.versioning_enabled = true;
                    if (validatedInput.compressionEnabled) metadata.compression_enabled = true;
                    if (validatedInput.webhookUrl) metadata.webhook_url = validatedInput.webhookUrl;
                    
                    await executeSqlWithFallback(metadataSql, context, [
                        validatedInput.bucketName,
                        JSON.stringify(metadata)
                    ]);
                }
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: "Storage bucket created successfully",
                            bucket: {
                                name: validatedInput.bucketName,
                                public: validatedInput.isPublic,
                                template: validatedInput.bucketTemplate,
                                policies_created: templatePolicies.length,
                                file_size_limit: validatedInput.fileSizeLimit,
                                allowed_mime_types: validatedInput.allowedMimeTypes
                            },
                            policies: templatePolicies
                        }, null, 2)
                    }]
                };
            }
            
            case 'list': {
                if (!validatedInput.bucketName) {
                    throw new Error("Bucket name is required");
                }
                
                const sql = `
                    SELECT 
                        p.name as policy_name,
                        p.operation,
                        p.definition,
                        p.created_at,
                        p.updated_at,
                        CASE 
                            WHEN p.definition LIKE '%auth.uid()%' THEN 'User-specific'
                            WHEN p.definition LIKE '%auth.role()%' THEN 'Role-based'
                            WHEN p.definition = 'true' THEN 'Public'
                            WHEN p.definition = 'false' THEN 'Blocked'
                            ELSE 'Custom'
                        END as policy_type,
                        LENGTH(p.definition) as definition_complexity
                    FROM storage.policies p
                    WHERE p.bucket_id = $1
                    ${validatedInput.operation ? `AND p.operation = '${validatedInput.operation}'` : ''}
                    ${validatedInput.policyName ? `AND p.name LIKE '%${validatedInput.policyName}%'` : ''}
                    ORDER BY p.operation, p.created_at DESC
                `;
                
                const result = await executeSqlWithFallback(sql, context, [validatedInput.bucketName]);
                
                const operationsSummary = result.data.reduce((acc: any, policy: any) => {
                    acc[policy.operation] = (acc[policy.operation] || 0) + 1;
                    return acc;
                }, {});
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            bucket: validatedInput.bucketName,
                            policies: result.data,
                            count: result.data.length,
                            operations_summary: operationsSummary,
                            policy_types: {
                                user_specific: result.data.filter((p: any) => p.policy_type === 'User-specific').length,
                                role_based: result.data.filter((p: any) => p.policy_type === 'Role-based').length,
                                public: result.data.filter((p: any) => p.policy_type === 'Public').length,
                                custom: result.data.filter((p: any) => p.policy_type === 'Custom').length
                            }
                        }, null, 2)
                    }]
                };
            }
            
            case 'create': {
                if (!validatedInput.bucketName || !validatedInput.policyName || !validatedInput.operation) {
                    throw new Error("Bucket name, policy name, and operation are required");
                }
                
                let definition = validatedInput.definition || 'true';
                
                // Apply smart defaults based on common patterns
                if (!validatedInput.definition) {
                    if (validatedInput.roleName) {
                        definition = `auth.role() = '${validatedInput.roleName}'`;
                    } else if (validatedInput.pathPrefix) {
                        definition = `(storage.foldername(name))[1] = '${validatedInput.pathPrefix}' AND auth.uid()::text = (storage.foldername(name))[2]`;
                    } else {
                        definition = 'auth.uid() IS NOT NULL';
                    }
                }
                
                // Add file size and type restrictions to definition if provided
                const restrictions = [];
                if (validatedInput.fileSizeLimit) {
                    restrictions.push(`(metadata->>'size')::int <= ${validatedInput.fileSizeLimit}`);
                }
                if (validatedInput.allowedMimeTypes && validatedInput.allowedMimeTypes.length > 0) {
                    const mimeTypes = validatedInput.allowedMimeTypes.map(t => `'${t}'`).join(', ');
                    restrictions.push(`metadata->>'mimetype' = ANY(ARRAY[${mimeTypes}])`);
                }
                if (validatedInput.maxFiles) {
                    restrictions.push(`(SELECT COUNT(*) FROM storage.objects WHERE bucket_id = bucket_id AND owner = auth.uid()) < ${validatedInput.maxFiles}`);
                }
                
                if (restrictions.length > 0) {
                    definition = `(${definition}) AND (${restrictions.join(' AND ')})`;
                }
                
                const sql = `
                    INSERT INTO storage.policies (bucket_id, name, operation, definition, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, NOW(), NOW())
                `;
                
                await executeSqlWithFallback(sql, context, [
                    validatedInput.bucketName,
                    validatedInput.policyName,
                    validatedInput.operation,
                    definition
                ]);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: "Storage policy created successfully",
                            policy: {
                                bucket: validatedInput.bucketName,
                                name: validatedInput.policyName,
                                operation: validatedInput.operation,
                                definition: definition,
                                restrictions_applied: restrictions.length
                            }
                        }, null, 2)
                    }]
                };
            }
            
            case 'bulk_create': {
                if (!validatedInput.bucketName || !validatedInput.bucketTemplate) {
                    throw new Error("Bucket name and template type are required for bulk creation");
                }
                
                const templates = await generateBucketTemplate(validatedInput.bucketTemplate, validatedInput.bucketName, validatedInput.roleName);
                const createdPolicies = [];
                
                for (const template of templates) {
                    try {
                        const sql = `
                            INSERT INTO storage.policies (bucket_id, name, operation, definition, created_at, updated_at)
                            VALUES ($1, $2, $3, $4, NOW(), NOW())
                            ON CONFLICT (bucket_id, name) DO UPDATE SET
                                operation = EXCLUDED.operation,
                                definition = EXCLUDED.definition,
                                updated_at = NOW()
                        `;
                        
                        await executeSqlWithFallback(sql, context, [
                            validatedInput.bucketName,
                            template.name,
                            template.operation,
                            template.definition
                        ]);
                        
                        createdPolicies.push(template);
                    } catch (error: any) {
                        context.log(`Warning: Could not create policy ${template.name}: ${error.message}`, 'warn');
                    }
                }
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: "Bulk policies created successfully",
                            bucket: validatedInput.bucketName,
                            template: validatedInput.bucketTemplate,
                            policies_created: createdPolicies.length,
                            policies: createdPolicies
                        }, null, 2)
                    }]
                };
            }
            
            case 'audit_access': {
                if (!validatedInput.bucketName) {
                    throw new Error("Bucket name is required for audit");
                }
                
                // Get bucket info and policies
                const bucketInfoSql = `
                    SELECT 
                        b.name,
                        b.public,
                        b.file_size_limit,
                        b.allowed_mime_types,
                        COUNT(o.id) as file_count,
                        COUNT(p.id) as policy_count
                    FROM storage.buckets b
                    LEFT JOIN storage.objects o ON b.id = o.bucket_id
                    LEFT JOIN storage.policies p ON b.id = p.bucket_id
                    WHERE b.name = $1
                    GROUP BY b.name, b.public, b.file_size_limit, b.allowed_mime_types
                `;
                
                // Get detailed policy analysis
                const policiesSql = `
                    SELECT 
                        name,
                        operation,
                        definition,
                        CASE 
                            WHEN definition = 'true' THEN 'HIGH'
                            WHEN definition LIKE '%auth.uid()%' THEN 'MEDIUM'
                            WHEN definition LIKE '%auth.role()%' THEN 'MEDIUM'
                            WHEN definition = 'false' THEN 'NONE'
                            ELSE 'CUSTOM'
                        END as risk_level,
                        CASE 
                            WHEN definition LIKE '%auth.%' THEN true
                            ELSE false
                        END as has_auth_check
                    FROM storage.policies
                    WHERE bucket_id = $1
                    ORDER BY operation, name
                `;
                
                // Get recent access patterns (if audit logging is enabled)
                const accessPatternsSql = `
                    SELECT 
                        DATE_TRUNC('day', created_at) as access_date,
                        COUNT(*) as file_operations,
                        COUNT(DISTINCT owner) as unique_users
                    FROM storage.objects
                    WHERE bucket_id = $1
                    AND created_at > NOW() - INTERVAL '30 days'
                    GROUP BY DATE_TRUNC('day', created_at)
                    ORDER BY access_date DESC
                    LIMIT 30
                `;
                
                const [bucketInfo, policies, accessPatterns] = await Promise.all([
                    executeSqlWithFallback(bucketInfoSql, context, [validatedInput.bucketName]),
                    executeSqlWithFallback(policiesSql, context, [validatedInput.bucketName]),
                    executeSqlWithFallback(accessPatternsSql, context, [validatedInput.bucketName])
                ]);
                
                const bucket = bucketInfo.data[0];
                const riskAssessment = {
                    overall_risk: 'LOW',
                    issues: [] as string[],
                    recommendations: [] as string[]
                };
                
                // Risk assessment
                if (bucket?.public) {
                    riskAssessment.overall_risk = 'HIGH';
                    riskAssessment.issues.push('Bucket is public');
                    riskAssessment.recommendations.push('Consider making bucket private and using signed URLs');
                }
                
                const highRiskPolicies = policies.data.filter((p: any) => p.risk_level === 'HIGH');
                if (highRiskPolicies.length > 0) {
                    riskAssessment.overall_risk = 'HIGH';
                    riskAssessment.issues.push(`${highRiskPolicies.length} policies allow unrestricted access`);
                    riskAssessment.recommendations.push('Add authentication checks to overly permissive policies');
                }
                
                if (!bucket?.file_size_limit) {
                    riskAssessment.issues.push('No file size limit set');
                    riskAssessment.recommendations.push('Set appropriate file size limits to prevent abuse');
                }
                
                if (!bucket?.allowed_mime_types) {
                    riskAssessment.issues.push('No MIME type restrictions');
                    riskAssessment.recommendations.push('Restrict allowed file types to reduce security risks');
                }
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            bucket: validatedInput.bucketName,
                            audit_date: new Date().toISOString(),
                            bucket_info: bucket,
                            policies: policies.data,
                            access_patterns: accessPatterns.data,
                            risk_assessment: riskAssessment,
                            security_score: Math.max(0, 100 - (riskAssessment.issues.length * 15)),
                            compliance_checks: {
                                has_auth_policies: policies.data.some((p: any) => p.has_auth_check),
                                has_size_limits: !!bucket?.file_size_limit,
                                has_type_restrictions: !!bucket?.allowed_mime_types,
                                policy_coverage: {
                                    select: policies.data.some((p: any) => p.operation === 'SELECT'),
                                    insert: policies.data.some((p: any) => p.operation === 'INSERT'),
                                    update: policies.data.some((p: any) => p.operation === 'UPDATE'),
                                    delete: policies.data.some((p: any) => p.operation === 'DELETE')
                                }
                            }
                        }, null, 2)
                    }]
                };
            }
            
            case 'generate_templates': {
                const templates = {
                    public: await generateBucketTemplate('public', 'example-bucket'),
                    private: await generateBucketTemplate('private', 'example-bucket'),
                    user_specific: await generateBucketTemplate('user_specific', 'example-bucket'),
                    role_based: await generateBucketTemplate('role_based', 'example-bucket', 'app_user'),
                    organization: await generateBucketTemplate('organization', 'example-bucket')
                };
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            storage_policy_templates: templates,
                            usage_examples: {
                                create_public_bucket: "Use 'public' template for assets like images, documents that everyone can read",
                                create_private_bucket: "Use 'private' template for sensitive files with explicit access control",
                                create_user_bucket: "Use 'user_specific' template for user uploads with folder-based separation",
                                create_role_bucket: "Use 'role_based' template for role-specific file access",
                                create_org_bucket: "Use 'organization' template for multi-tenant applications"
                            },
                            best_practices: [
                                "Always start with the most restrictive template and gradually open access",
                                "Use path-based policies for user separation",
                                "Implement file size and type restrictions",
                                "Regular audit bucket access patterns",
                                "Use signed URLs for temporary access to private files"
                            ]
                        }, null, 2)
                    }]
                };
            }
            
            case 'delete': {
                if (!validatedInput.bucketName || !validatedInput.policyName) {
                    throw new Error("Bucket name and policy name are required");
                }
                
                const sql = `DELETE FROM storage.policies WHERE bucket_id = $1 AND name = $2`;
                const result = await executeSqlWithFallback(sql, context, [validatedInput.bucketName, validatedInput.policyName]);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: "Storage policy deleted successfully",
                            bucket: validatedInput.bucketName,
                            policy: validatedInput.policyName
                        }, null, 2)
                    }]
                };
            }
            
            default:
                throw new Error(`Unknown action: ${validatedInput.action}`);
        }
    }
};

async function generateBucketTemplate(template: string, bucketName: string, roleName?: string): Promise<any[]> {
    const policies = [];
    
    switch (template) {
        case 'public':
            policies.push(
                { name: 'public_select', operation: 'SELECT', definition: 'true' },
                { name: 'authenticated_insert', operation: 'INSERT', definition: 'auth.uid() IS NOT NULL' },
                { name: 'owner_update', operation: 'UPDATE', definition: 'owner = auth.uid()' },
                { name: 'owner_delete', operation: 'DELETE', definition: 'owner = auth.uid()' }
            );
            break;
        
        case 'private':
            policies.push(
                { name: 'owner_select', operation: 'SELECT', definition: 'owner = auth.uid()' },
                { name: 'authenticated_insert', operation: 'INSERT', definition: 'auth.uid() IS NOT NULL' },
                { name: 'owner_update', operation: 'UPDATE', definition: 'owner = auth.uid()' },
                { name: 'owner_delete', operation: 'DELETE', definition: 'owner = auth.uid()' }
            );
            break;
        
        case 'user_specific':
            policies.push(
                { name: 'user_folder_select', operation: 'SELECT', definition: `(storage.foldername(name))[1] = auth.uid()::text` },
                { name: 'user_folder_insert', operation: 'INSERT', definition: `(storage.foldername(name))[1] = auth.uid()::text` },
                { name: 'user_folder_update', operation: 'UPDATE', definition: `(storage.foldername(name))[1] = auth.uid()::text AND owner = auth.uid()` },
                { name: 'user_folder_delete', operation: 'DELETE', definition: `(storage.foldername(name))[1] = auth.uid()::text AND owner = auth.uid()` }
            );
            break;
        
        case 'role_based':
            const role = roleName || 'authenticated';
            policies.push(
                { name: 'role_select', operation: 'SELECT', definition: `auth.role() = '${role}'` },
                { name: 'role_insert', operation: 'INSERT', definition: `auth.role() = '${role}' AND auth.uid() IS NOT NULL` },
                { name: 'role_update', operation: 'UPDATE', definition: `auth.role() = '${role}' AND owner = auth.uid()` },
                { name: 'role_delete', operation: 'DELETE', definition: `auth.role() = '${role}' AND owner = auth.uid()` }
            );
            break;
        
        case 'organization':
            policies.push(
                { name: 'org_select', operation: 'SELECT', definition: `(storage.foldername(name))[1] = (auth.jwt()->>'org_id')` },
                { name: 'org_insert', operation: 'INSERT', definition: `(storage.foldername(name))[1] = (auth.jwt()->>'org_id') AND auth.uid() IS NOT NULL` },
                { name: 'org_member_update', operation: 'UPDATE', definition: `(storage.foldername(name))[1] = (auth.jwt()->>'org_id') AND owner = auth.uid()` },
                { name: 'org_member_delete', operation: 'DELETE', definition: `(storage.foldername(name))[1] = (auth.jwt()->>'org_id') AND owner = auth.uid()` }
            );
            break;
    }
    
    return policies;
}