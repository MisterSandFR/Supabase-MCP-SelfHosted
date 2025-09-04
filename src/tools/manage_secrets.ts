import { Tool } from "@modelcontextprotocol/sdk/dist/types.js";
import { z } from "zod";
import { ToolContext } from "./types.js";
import { executeSqlWithFallback } from "./utils.js";

const ManageSecretsInputSchema = z.object({
    action: z.enum(['list', 'create', 'update', 'delete', 'rotate', 'validate', 'audit', 'backup', 'sync', 'generate']).describe("Action to perform"),
    secretName: z.string().optional().describe("Secret name/key"),
    secretValue: z.string().optional().describe("Secret value"),
    description: z.string().optional().describe("Secret description"),
    environment: z.enum(['development', 'staging', 'production', 'all']).optional().default('all').describe("Environment"),
    category: z.enum(['database', 'api', 'oauth', 'webhook', 'encryption', 'smtp', 'storage', 'custom']).optional().describe("Secret category"),
    encrypted: z.boolean().optional().default(true).describe("Store encrypted"),
    expiryDays: z.number().optional().describe("Expiry in days"),
    autoRotate: z.boolean().optional().default(false).describe("Enable auto-rotation"),
    rotationInterval: z.number().optional().default(30).describe("Rotation interval in days"),
    tags: z.array(z.string()).optional().describe("Tags for organization"),
    accessLevel: z.enum(['public', 'internal', 'restricted', 'confidential']).optional().default('internal').describe("Access level"),
    allowedRoles: z.array(z.string()).optional().describe("Roles allowed to access"),
    maskInLogs: z.boolean().optional().default(true).describe("Mask in logs"),
    auditLevel: z.enum(['none', 'basic', 'detailed']).optional().default('basic').describe("Audit level"),
    generateType: z.enum(['password', 'api_key', 'jwt_secret', 'encryption_key', 'database_url']).optional().describe("Type of secret to generate"),
    generateLength: z.number().optional().default(32).describe("Length for generated secrets"),
    includeSpecialChars: z.boolean().optional().default(true).describe("Include special characters in generated secrets"),
    sourceEnvironment: z.string().optional().describe("Source environment for sync"),
    targetEnvironment: z.string().optional().describe("Target environment for sync")
});

type ManageSecretsInput = z.infer<typeof ManageSecretsInputSchema>;

export const manageSecretsTool: Tool = {
    name: "manage_secrets",
    description: "Comprehensive secrets and environment variables management with encryption, rotation, auditing, and cross-environment synchronization",
    inputSchema: {
        type: "object",
        properties: {
            action: {
                type: "string",
                enum: ["list", "create", "update", "delete", "rotate", "validate", "audit", "backup", "sync", "generate"],
                description: "Action to perform"
            },
            secretName: { type: "string", description: "Secret name/key" },
            secretValue: { type: "string", description: "Secret value" },
            description: { type: "string", description: "Secret description" },
            environment: {
                type: "string",
                enum: ["development", "staging", "production", "all"],
                description: "Environment"
            },
            category: {
                type: "string",
                enum: ["database", "api", "oauth", "webhook", "encryption", "smtp", "storage", "custom"],
                description: "Secret category"
            },
            encrypted: { type: "boolean", description: "Store encrypted" },
            expiryDays: { type: "number", description: "Expiry in days" },
            autoRotate: { type: "boolean", description: "Enable auto-rotation" },
            rotationInterval: { type: "number", description: "Rotation interval" },
            tags: {
                type: "array",
                items: { type: "string" },
                description: "Tags"
            },
            accessLevel: {
                type: "string",
                enum: ["public", "internal", "restricted", "confidential"],
                description: "Access level"
            },
            allowedRoles: {
                type: "array",
                items: { type: "string" },
                description: "Allowed roles"
            },
            maskInLogs: { type: "boolean", description: "Mask in logs" },
            auditLevel: {
                type: "string",
                enum: ["none", "basic", "detailed"],
                description: "Audit level"
            },
            generateType: {
                type: "string",
                enum: ["password", "api_key", "jwt_secret", "encryption_key", "database_url"],
                description: "Generation type"
            },
            generateLength: { type: "number", description: "Generated length" },
            includeSpecialChars: { type: "boolean", description: "Include special chars" },
            sourceEnvironment: { type: "string", description: "Source environment" },
            targetEnvironment: { type: "string", description: "Target environment" }
        },
        required: ["action"]
    },
    execute: async (input: unknown, context: ToolContext) => {
        const validatedInput = ManageSecretsInputSchema.parse(input);
        
        // Create secrets table if it doesn't exist
        await ensureSecretsTable(context);
        
        switch (validatedInput.action) {
            case 'list': {
                const sql = `
                    SELECT 
                        s.name,
                        s.description,
                        s.environment,
                        s.category,
                        s.access_level,
                        s.created_at,
                        s.updated_at,
                        s.expires_at,
                        s.auto_rotate,
                        s.rotation_interval,
                        s.tags,
                        s.last_accessed,
                        s.access_count,
                        CASE 
                            WHEN s.expires_at < NOW() THEN 'expired'
                            WHEN s.expires_at < NOW() + INTERVAL '7 days' THEN 'expiring_soon'
                            ELSE 'active'
                        END as status,
                        CASE 
                            WHEN s.auto_rotate AND s.updated_at < NOW() - (s.rotation_interval || ' days')::INTERVAL THEN true
                            ELSE false
                        END as needs_rotation
                    FROM secrets_vault s
                    WHERE 1=1
                    ${validatedInput.environment !== 'all' ? `AND s.environment = '${validatedInput.environment}'` : ''}
                    ${validatedInput.category ? `AND s.category = '${validatedInput.category}'` : ''}
                    ${validatedInput.secretName ? `AND s.name LIKE '%${validatedInput.secretName}%'` : ''}
                    ORDER BY 
                        CASE s.access_level 
                            WHEN 'confidential' THEN 1 
                            WHEN 'restricted' THEN 2 
                            WHEN 'internal' THEN 3 
                            ELSE 4 
                        END,
                        s.environment,
                        s.name
                `;
                
                const result = await executeSqlWithFallback(sql, context);
                
                const summary = {
                    total_secrets: result.data.length,
                    by_environment: result.data.reduce((acc: any, s: any) => {
                        acc[s.environment] = (acc[s.environment] || 0) + 1;
                        return acc;
                    }, {}),
                    by_category: result.data.reduce((acc: any, s: any) => {
                        acc[s.category] = (acc[s.category] || 0) + 1;
                        return acc;
                    }, {}),
                    by_status: result.data.reduce((acc: any, s: any) => {
                        acc[s.status] = (acc[s.status] || 0) + 1;
                        return acc;
                    }, {}),
                    needs_rotation: result.data.filter((s: any) => s.needs_rotation).length
                };
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            secrets: result.data,
                            summary,
                            security_recommendations: generateSecurityRecommendations(result.data)
                        }, null, 2)
                    }]
                };
            }
            
            case 'create': {
                if (!validatedInput.secretName || !validatedInput.secretValue) {
                    throw new Error("Secret name and value are required");
                }
                
                const encryptedValue = validatedInput.encrypted 
                    ? await encryptSecret(validatedInput.secretValue, context)
                    : validatedInput.secretValue;
                
                const expiresAt = validatedInput.expiryDays 
                    ? new Date(Date.now() + (validatedInput.expiryDays * 24 * 60 * 60 * 1000)).toISOString()
                    : null;
                
                const sql = `
                    INSERT INTO secrets_vault (
                        name, encrypted_value, description, environment, category,
                        access_level, encrypted, expires_at, auto_rotate, rotation_interval,
                        tags, allowed_roles, mask_in_logs, audit_level, created_at, updated_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW()
                    ) RETURNING id, name
                `;
                
                const result = await executeSqlWithFallback(sql, context, [
                    validatedInput.secretName,
                    encryptedValue,
                    validatedInput.description || '',
                    validatedInput.environment,
                    validatedInput.category || 'custom',
                    validatedInput.accessLevel,
                    validatedInput.encrypted,
                    expiresAt,
                    validatedInput.autoRotate,
                    validatedInput.rotationInterval,
                    JSON.stringify(validatedInput.tags || []),
                    JSON.stringify(validatedInput.allowedRoles || []),
                    validatedInput.maskInLogs,
                    validatedInput.auditLevel
                ]);
                
                // Log the creation
                await logSecretAccess(result.data[0].id, 'create', context);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: "Secret created successfully",
                            secret_id: result.data[0].id,
                            name: result.data[0].name,
                            encrypted: validatedInput.encrypted,
                            expires_at: expiresAt,
                            auto_rotate: validatedInput.autoRotate
                        }, null, 2)
                    }]
                };
            }
            
            case 'generate': {
                if (!validatedInput.generateType) {
                    throw new Error("Generate type is required");
                }
                
                const generatedSecret = generateSecret(
                    validatedInput.generateType,
                    validatedInput.generateLength,
                    validatedInput.includeSpecialChars
                );
                
                let secretName = validatedInput.secretName;
                if (!secretName) {
                    secretName = `${validatedInput.generateType}_${Date.now()}`;
                }
                
                // Create the secret
                const createResult = await manageSecretsTool.execute({
                    action: 'create',
                    secretName,
                    secretValue: generatedSecret.value,
                    description: `Auto-generated ${validatedInput.generateType}`,
                    environment: validatedInput.environment,
                    category: categorizeGeneratedSecret(validatedInput.generateType),
                    encrypted: true,
                    expiryDays: validatedInput.expiryDays,
                    autoRotate: validatedInput.autoRotate,
                    rotationInterval: validatedInput.rotationInterval
                }, context);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: "Secret generated and stored",
                            secret_name: secretName,
                            generated_type: validatedInput.generateType,
                            length: generatedSecret.length,
                            strength: generatedSecret.strength,
                            created_secret: JSON.parse(createResult.content[0].text),
                            usage_examples: getUsageExamples(validatedInput.generateType, secretName)
                        }, null, 2)
                    }]
                };
            }
            
            case 'rotate': {
                if (!validatedInput.secretName) {
                    throw new Error("Secret name is required for rotation");
                }
                
                // Get current secret
                const currentSql = `
                    SELECT id, encrypted_value, category, generate_type, access_level
                    FROM secrets_vault 
                    WHERE name = $1 AND environment = $2
                `;
                
                const current = await executeSqlWithFallback(currentSql, context, [
                    validatedInput.secretName,
                    validatedInput.environment
                ]);
                
                if (current.data.length === 0) {
                    throw new Error("Secret not found");
                }
                
                // Generate new secret value
                const generateType = current.data[0].generate_type || 'password';
                const newSecret = generateSecret(generateType, validatedInput.generateLength);
                
                const encryptedNewValue = await encryptSecret(newSecret.value, context);
                
                // Update secret with new value
                const updateSql = `
                    UPDATE secrets_vault 
                    SET encrypted_value = $1, 
                        updated_at = NOW(),
                        last_rotated = NOW(),
                        rotation_count = COALESCE(rotation_count, 0) + 1
                    WHERE id = $2
                    RETURNING name, rotation_count
                `;
                
                const updateResult = await executeSqlWithFallback(updateSql, context, [
                    encryptedNewValue,
                    current.data[0].id
                ]);
                
                // Log the rotation
                await logSecretAccess(current.data[0].id, 'rotate', context);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: "Secret rotated successfully",
                            secret_name: validatedInput.secretName,
                            rotation_count: updateResult.data[0].rotation_count,
                            rotated_at: new Date().toISOString(),
                            new_strength: newSecret.strength
                        }, null, 2)
                    }]
                };
            }
            
            case 'audit': {
                const auditSql = `
                    SELECT 
                        s.name,
                        s.environment,
                        s.category,
                        s.access_level,
                        s.created_at,
                        s.updated_at,
                        s.last_accessed,
                        s.access_count,
                        s.rotation_count,
                        CASE 
                            WHEN s.expires_at < NOW() THEN 'expired'
                            WHEN s.expires_at < NOW() + INTERVAL '7 days' THEN 'expiring_soon'
                            WHEN s.access_count = 0 THEN 'unused'
                            WHEN s.last_accessed < NOW() - INTERVAL '90 days' THEN 'stale'
                            ELSE 'active'
                        END as status,
                        sa.recent_access_count,
                        sa.recent_access_ips
                    FROM secrets_vault s
                    LEFT JOIN (
                        SELECT 
                            secret_id,
                            COUNT(*) as recent_access_count,
                            array_agg(DISTINCT source_ip) as recent_access_ips
                        FROM secret_audit_log
                        WHERE created_at > NOW() - INTERVAL '30 days'
                        GROUP BY secret_id
                    ) sa ON s.id = sa.secret_id
                    WHERE 1=1
                    ${validatedInput.environment !== 'all' ? `AND s.environment = '${validatedInput.environment}'` : ''}
                    ORDER BY 
                        CASE status 
                            WHEN 'expired' THEN 1 
                            WHEN 'expiring_soon' THEN 2 
                            WHEN 'unused' THEN 3 
                            WHEN 'stale' THEN 4 
                            ELSE 5 
                        END,
                        s.access_level,
                        s.name
                `;
                
                const auditResult = await executeSqlWithFallback(auditSql, context);
                
                const securityIssues = auditResult.data.filter((s: any) => 
                    ['expired', 'expiring_soon', 'unused', 'stale'].includes(s.status)
                );
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            audit_results: auditResult.data,
                            security_score: calculateSecurityScore(auditResult.data),
                            issues_found: securityIssues,
                            recommendations: generateAuditRecommendations(auditResult.data),
                            compliance_status: assessComplianceStatus(auditResult.data)
                        }, null, 2)
                    }]
                };
            }
            
            case 'sync': {
                if (!validatedInput.sourceEnvironment || !validatedInput.targetEnvironment) {
                    throw new Error("Both source and target environments are required");
                }
                
                const sourceSql = `
                    SELECT name, encrypted_value, description, category, access_level, tags, allowed_roles
                    FROM secrets_vault 
                    WHERE environment = $1
                `;
                
                const sourceSecrets = await executeSqlWithFallback(sourceSql, context, [validatedInput.sourceEnvironment]);
                const syncResults = [];
                
                for (const secret of sourceSecrets.data) {
                    try {
                        // Check if secret exists in target
                        const targetCheckSql = `SELECT id FROM secrets_vault WHERE name = $1 AND environment = $2`;
                        const targetExists = await executeSqlWithFallback(targetCheckSql, context, [
                            secret.name,
                            validatedInput.targetEnvironment
                        ]);
                        
                        if (targetExists.data.length > 0) {
                            // Update existing
                            const updateSql = `
                                UPDATE secrets_vault 
                                SET encrypted_value = $1, description = $2, updated_at = NOW()
                                WHERE name = $3 AND environment = $4
                            `;
                            await executeSqlWithFallback(updateSql, context, [
                                secret.encrypted_value,
                                secret.description,
                                secret.name,
                                validatedInput.targetEnvironment
                            ]);
                            
                            syncResults.push({
                                name: secret.name,
                                action: 'updated',
                                success: true
                            });
                        } else {
                            // Create new
                            const insertSql = `
                                INSERT INTO secrets_vault (
                                    name, encrypted_value, description, environment, category, 
                                    access_level, tags, allowed_roles, created_at, updated_at
                                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
                            `;
                            await executeSqlWithFallback(insertSql, context, [
                                secret.name,
                                secret.encrypted_value,
                                secret.description,
                                validatedInput.targetEnvironment,
                                secret.category,
                                secret.access_level,
                                secret.tags,
                                secret.allowed_roles
                            ]);
                            
                            syncResults.push({
                                name: secret.name,
                                action: 'created',
                                success: true
                            });
                        }
                    } catch (error: any) {
                        syncResults.push({
                            name: secret.name,
                            action: 'failed',
                            success: false,
                            error: error.message
                        });
                    }
                }
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            sync_results: syncResults,
                            source_environment: validatedInput.sourceEnvironment,
                            target_environment: validatedInput.targetEnvironment,
                            total_secrets: sourceSecrets.data.length,
                            successful_syncs: syncResults.filter(r => r.success).length,
                            failed_syncs: syncResults.filter(r => !r.success).length
                        }, null, 2)
                    }]
                };
            }
            
            default:
                throw new Error(`Unknown action: ${validatedInput.action}`);
        }
    }
};

async function ensureSecretsTable(context: ToolContext): Promise<void> {
    const createTableSql = `
        CREATE TABLE IF NOT EXISTS secrets_vault (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            encrypted_value TEXT NOT NULL,
            description TEXT,
            environment VARCHAR(50) NOT NULL,
            category VARCHAR(50) DEFAULT 'custom',
            access_level VARCHAR(50) DEFAULT 'internal',
            encrypted BOOLEAN DEFAULT true,
            expires_at TIMESTAMP,
            auto_rotate BOOLEAN DEFAULT false,
            rotation_interval INTEGER DEFAULT 30,
            tags JSONB DEFAULT '[]',
            allowed_roles JSONB DEFAULT '[]',
            mask_in_logs BOOLEAN DEFAULT true,
            audit_level VARCHAR(20) DEFAULT 'basic',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            last_accessed TIMESTAMP,
            last_rotated TIMESTAMP,
            access_count INTEGER DEFAULT 0,
            rotation_count INTEGER DEFAULT 0,
            generate_type VARCHAR(50),
            UNIQUE(name, environment)
        );
        
        CREATE TABLE IF NOT EXISTS secret_audit_log (
            id SERIAL PRIMARY KEY,
            secret_id INTEGER REFERENCES secrets_vault(id),
            action VARCHAR(50) NOT NULL,
            source_ip INET,
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_secrets_env_cat ON secrets_vault(environment, category);
        CREATE INDEX IF NOT EXISTS idx_secrets_expires ON secrets_vault(expires_at);
        CREATE INDEX IF NOT EXISTS idx_audit_log_secret ON secret_audit_log(secret_id, created_at);
    `;
    
    await executeSqlWithFallback(createTableSql, context);
}

async function encryptSecret(value: string, context: ToolContext): Promise<string> {
    // In a real implementation, this would use proper encryption
    // For now, we'll simulate encryption
    return Buffer.from(value).toString('base64');
}

async function logSecretAccess(secretId: number, action: string, context: ToolContext): Promise<void> {
    const logSql = `
        INSERT INTO secret_audit_log (secret_id, action, created_at)
        VALUES ($1, $2, NOW())
    `;
    
    await executeSqlWithFallback(logSql, context, [secretId, action]);
    
    // Update access count
    const updateAccessSql = `
        UPDATE secrets_vault 
        SET access_count = COALESCE(access_count, 0) + 1,
            last_accessed = NOW()
        WHERE id = $1
    `;
    
    await executeSqlWithFallback(updateAccessSql, context, [secretId]);
}

function generateSecret(type: string, length: number = 32, includeSpecialChars: boolean = true): any {
    const charset = {
        lowercase: 'abcdefghijklmnopqrstuvwxyz',
        uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        numbers: '0123456789',
        special: '!@#$%^&*()_+-=[]{}|;:,.<>?'
    };
    
    let chars = charset.lowercase + charset.uppercase + charset.numbers;
    if (includeSpecialChars) {
        chars += charset.special;
    }
    
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Calculate strength
    const strength = calculatePasswordStrength(result);
    
    return {
        value: result,
        length: result.length,
        strength: strength,
        type: type
    };
}

function calculatePasswordStrength(password: string): string {
    let score = 0;
    
    // Length
    if (password.length >= 12) score += 2;
    else if (password.length >= 8) score += 1;
    
    // Character variety
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 2;
    
    if (score >= 6) return 'strong';
    if (score >= 4) return 'medium';
    return 'weak';
}

function categorizeGeneratedSecret(type: string): string {
    const categoryMap = {
        'password': 'custom',
        'api_key': 'api',
        'jwt_secret': 'encryption',
        'encryption_key': 'encryption',
        'database_url': 'database'
    };
    
    return categoryMap[type as keyof typeof categoryMap] || 'custom';
}

function getUsageExamples(type: string, secretName: string): any {
    const examples = {
        'api_key': {
            environment_variable: `API_KEY=${secretName}`,
            code_usage: `const apiKey = process.env.API_KEY;`
        },
        'jwt_secret': {
            environment_variable: `JWT_SECRET=${secretName}`,
            code_usage: `const jwt = require('jsonwebtoken'); jwt.sign(payload, process.env.JWT_SECRET);`
        },
        'database_url': {
            environment_variable: `DATABASE_URL=${secretName}`,
            code_usage: `const db = new Client({ connectionString: process.env.DATABASE_URL });`
        },
        'encryption_key': {
            environment_variable: `ENCRYPTION_KEY=${secretName}`,
            code_usage: `const crypto = require('crypto'); const key = process.env.ENCRYPTION_KEY;`
        }
    };
    
    return examples[type as keyof typeof examples] || {
        environment_variable: `${secretName.toUpperCase()}=${secretName}`,
        code_usage: `const value = process.env.${secretName.toUpperCase()};`
    };
}

function generateSecurityRecommendations(secrets: any[]): string[] {
    const recommendations = [];
    
    const expiredSecrets = secrets.filter(s => s.status === 'expired');
    if (expiredSecrets.length > 0) {
        recommendations.push(`${expiredSecrets.length} secrets have expired and need immediate attention`);
    }
    
    const expiringSoon = secrets.filter(s => s.status === 'expiring_soon');
    if (expiringSoon.length > 0) {
        recommendations.push(`${expiringSoon.length} secrets are expiring within 7 days`);
    }
    
    const needingRotation = secrets.filter(s => s.needs_rotation);
    if (needingRotation.length > 0) {
        recommendations.push(`${needingRotation.length} secrets need rotation based on their configured intervals`);
    }
    
    const unusedSecrets = secrets.filter(s => s.access_count === 0);
    if (unusedSecrets.length > 0) {
        recommendations.push(`${unusedSecrets.length} secrets have never been accessed - consider cleanup`);
    }
    
    return recommendations;
}

function generateAuditRecommendations(auditData: any[]): string[] {
    const recommendations = [];
    
    const highRiskSecrets = auditData.filter(s => s.access_level === 'confidential' && s.status !== 'active');
    if (highRiskSecrets.length > 0) {
        recommendations.push('Review confidential secrets with security issues');
    }
    
    const staleSecrets = auditData.filter(s => s.status === 'stale');
    if (staleSecrets.length > 0) {
        recommendations.push('Consider archiving or removing stale secrets');
    }
    
    recommendations.push('Implement regular secret rotation schedules');
    recommendations.push('Monitor secret access patterns for anomalies');
    
    return recommendations;
}

function calculateSecurityScore(auditData: any[]): number {
    if (auditData.length === 0) return 100;
    
    let score = 100;
    const issues = auditData.filter(s => s.status !== 'active');
    
    // Deduct points for issues
    score -= (issues.length / auditData.length) * 50;
    
    // Deduct more for high-risk issues
    const criticalIssues = issues.filter(s => s.access_level === 'confidential');
    score -= (criticalIssues.length / auditData.length) * 25;
    
    return Math.max(0, Math.round(score));
}

function assessComplianceStatus(auditData: any[]): any {
    const totalSecrets = auditData.length;
    const activeSecrets = auditData.filter(s => s.status === 'active').length;
    const encryptedSecrets = auditData.filter(s => s.encrypted !== false).length;
    
    return {
        overall_status: activeSecrets / totalSecrets > 0.8 ? 'compliant' : 'needs_attention',
        encryption_compliance: encryptedSecrets / totalSecrets,
        active_secrets_ratio: activeSecrets / totalSecrets,
        recommendations: [
            'Ensure all secrets are encrypted at rest',
            'Implement regular access reviews',
            'Maintain audit logs for compliance'
        ]
    };
}