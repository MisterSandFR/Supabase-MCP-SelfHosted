import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ToolContext } from "./types.js";
import { executeSqlWithFallback } from "./utils.js";

const ManageRolesInputSchema = z.object({
    action: z.enum(['create', 'update', 'delete', 'list', 'grant', 'revoke', 'list_permissions', 'create_with_rls', 'sync_roles']).describe("Action to perform"),
    roleName: z.string().optional().describe("Role name"),
    password: z.string().optional().describe("Role password"),
    permissions: z.array(z.string()).optional().describe("Permissions to grant/revoke"),
    inherit: z.boolean().optional().default(true).describe("Can inherit permissions from other roles"),
    login: z.boolean().optional().default(false).describe("Can login"),
    createdb: z.boolean().optional().default(false).describe("Can create databases"),
    createrole: z.boolean().optional().default(false).describe("Can create roles"),
    superuser: z.boolean().optional().default(false).describe("Superuser privileges"),
    replication: z.boolean().optional().default(false).describe("Replication privileges"),
    bypassrls: z.boolean().optional().default(false).describe("Bypass RLS"),
    connectionLimit: z.number().optional().default(-1).describe("Connection limit (-1 for unlimited)"),
    validUntil: z.string().optional().describe("Role expiration date (YYYY-MM-DD)"),
    grantTo: z.string().optional().describe("Role to grant to"),
    grantee: z.string().optional().describe("Role receiving the grant"),
    objectType: z.enum(['table', 'schema', 'database', 'function', 'sequence']).optional().describe("Object type for permissions"),
    objectName: z.string().optional().describe("Object name for permissions"),
    schemaName: z.string().optional().default('public').describe("Schema name"),
    autoCreateRLS: z.boolean().optional().default(false).describe("Automatically create RLS policies"),
    templateRole: z.string().optional().describe("Template role to copy permissions from"),
    environment: z.enum(['development', 'staging', 'production', 'all']).optional().describe("Environment for role sync")
});

type ManageRolesInput = z.infer<typeof ManageRolesInputSchema>;

const ManageRolesOutputSchema = z.object({
    content: z.array(z.object({
        type: z.literal("text"),
        text: z.string()
    }))
});

export const manageRolesTool = {
    name: "manage_roles",
    description: "Comprehensive role and permission management for PostgreSQL/Supabase with RLS integration and environment synchronization",
    inputSchema: ManageRolesInputSchema,
    mcpInputSchema: {
        type: "object",
        properties: {
            action: {
                type: "string",
                enum: ["create", "update", "delete", "list", "grant", "revoke", "list_permissions", "create_with_rls", "sync_roles"],
                description: "Action to perform"
            },
            roleName: { type: "string", description: "Role name" },
            password: { type: "string", description: "Role password" },
            permissions: {
                type: "array",
                items: { type: "string" },
                description: "Permissions array"
            },
            inherit: { type: "boolean", description: "Can inherit permissions" },
            login: { type: "boolean", description: "Can login" },
            createdb: { type: "boolean", description: "Can create databases" },
            createrole: { type: "boolean", description: "Can create roles" },
            superuser: { type: "boolean", description: "Superuser privileges" },
            replication: { type: "boolean", description: "Replication privileges" },
            bypassrls: { type: "boolean", description: "Bypass RLS" },
            connectionLimit: { type: "number", description: "Connection limit" },
            validUntil: { type: "string", description: "Role expiration date" },
            grantTo: { type: "string", description: "Role to grant to" },
            grantee: { type: "string", description: "Role receiving the grant" },
            objectType: {
                type: "string",
                enum: ["table", "schema", "database", "function", "sequence"],
                description: "Object type for permissions"
            },
            objectName: { type: "string", description: "Object name for permissions" },
            schemaName: { type: "string", description: "Schema name" },
            autoCreateRLS: { type: "boolean", description: "Automatically create RLS policies" },
            templateRole: { type: "string", description: "Template role to copy from" },
            environment: {
                type: "string",
                enum: ["development", "staging", "production", "all"],
                description: "Environment for role sync"
            }
        },
        required: ["action"]
    },
    outputSchema: ManageRolesOutputSchema,
    execute: async (input: unknown, context: ToolContext) => {
        const validatedInput = ManageRolesInputSchema.parse(input);
        
        switch (validatedInput.action) {
            case 'list': {
                const sql = `
                    SELECT 
                        r.rolname AS role_name,
                        r.rolsuper AS is_superuser,
                        r.rolinherit AS can_inherit,
                        r.rolcreaterole AS can_create_role,
                        r.rolcreatedb AS can_create_db,
                        r.rolcanlogin AS can_login,
                        r.rolreplication AS can_replicate,
                        r.rolbypassrls AS bypass_rls,
                        r.rolconnlimit AS connection_limit,
                        r.rolvaliduntil AS valid_until,
                        ARRAY(
                            SELECT b.rolname
                            FROM pg_catalog.pg_auth_members m
                            JOIN pg_catalog.pg_roles b ON (m.roleid = b.oid)
                            WHERE m.member = r.oid
                        ) AS member_of,
                        CASE 
                            WHEN r.rolname = 'postgres' THEN 'System Admin'
                            WHEN r.rolname LIKE 'supabase_%' THEN 'Supabase System'
                            WHEN r.rolname LIKE '%_role' THEN 'Application Role'
                            WHEN r.rolcanlogin THEN 'User Role'
                            ELSE 'Group Role'
                        END AS role_type
                    FROM pg_catalog.pg_roles r
                    WHERE r.rolname NOT LIKE 'pg_%'
                    ${validatedInput.roleName ? `AND r.rolname LIKE '%${validatedInput.roleName}%'` : ''}
                    ORDER BY 
                        CASE 
                            WHEN r.rolname = 'postgres' THEN 1
                            WHEN r.rolname LIKE 'supabase_%' THEN 2
                            WHEN r.rolcanlogin THEN 3
                            ELSE 4
                        END,
                        r.rolname
                `;
                
                const result = await executeSqlWithFallback(sql, context);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            roles: result.data,
                            count: result.data.length,
                            summary: {
                                system_roles: result.data.filter((r: any) => r.role_type.includes('System')).length,
                                user_roles: result.data.filter((r: any) => r.role_type === 'User Role').length,
                                application_roles: result.data.filter((r: any) => r.role_type === 'Application Role').length,
                                group_roles: result.data.filter((r: any) => r.role_type === 'Group Role').length
                            }
                        }, null, 2)
                    }]
                };
            }
            
            case 'create': {
                if (!validatedInput.roleName) {
                    throw new Error("Role name is required");
                }
                
                const options = [];
                if (validatedInput.inherit !== undefined) options.push(validatedInput.inherit ? 'INHERIT' : 'NOINHERIT');
                if (validatedInput.login !== undefined) options.push(validatedInput.login ? 'LOGIN' : 'NOLOGIN');
                if (validatedInput.createdb !== undefined) options.push(validatedInput.createdb ? 'CREATEDB' : 'NOCREATEDB');
                if (validatedInput.createrole !== undefined) options.push(validatedInput.createrole ? 'CREATEROLE' : 'NOCREATEROLE');
                if (validatedInput.superuser !== undefined) options.push(validatedInput.superuser ? 'SUPERUSER' : 'NOSUPERUSER');
                if (validatedInput.replication !== undefined) options.push(validatedInput.replication ? 'REPLICATION' : 'NOREPLICATION');
                if (validatedInput.bypassrls !== undefined) options.push(validatedInput.bypassrls ? 'BYPASSRLS' : 'NOBYPASSRLS');
                if (validatedInput.connectionLimit !== undefined && validatedInput.connectionLimit !== -1) {
                    options.push(`CONNECTION LIMIT ${validatedInput.connectionLimit}`);
                }
                if (validatedInput.password) options.push(`PASSWORD '${validatedInput.password}'`);
                if (validatedInput.validUntil) options.push(`VALID UNTIL '${validatedInput.validUntil}'`);
                
                const sql = `CREATE ROLE ${validatedInput.roleName} ${options.join(' ')}`;
                await executeSqlWithFallback(sql, context);
                
                // Copy permissions from template role if provided
                if (validatedInput.templateRole) {
                    const copyPermissionsSql = `
                        -- Copy role memberships
                        DO $$
                        DECLARE
                            rec RECORD;
                        BEGIN
                            FOR rec IN 
                                SELECT r.rolname 
                                FROM pg_roles r 
                                JOIN pg_auth_members m ON r.oid = m.roleid 
                                JOIN pg_roles template ON template.oid = m.member 
                                WHERE template.rolname = '${validatedInput.templateRole}'
                            LOOP
                                EXECUTE format('GRANT %I TO %I', rec.rolname, '${validatedInput.roleName}');
                            END LOOP;
                        END $$;
                    `;
                    await executeSqlWithFallback(copyPermissionsSql, context);
                }
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: "Role created successfully",
                            role: validatedInput.roleName,
                            options: options,
                            template_copied: !!validatedInput.templateRole
                        }, null, 2)
                    }]
                };
            }
            
            case 'create_with_rls': {
                if (!validatedInput.roleName || !validatedInput.schemaName) {
                    throw new Error("Role name and schema name are required");
                }
                
                // Create the role first
                const createRoleResult = await manageRolesTool.execute({
                    ...validatedInput,
                    action: 'create'
                }, context);
                
                // Get all tables in the schema
                const tablesSql = `
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = $1 AND table_type = 'BASE TABLE'
                `;
                const tables = await executeSqlWithFallback(tablesSql, context, [validatedInput.schemaName]);
                
                const rlsPolicies = [];
                
                // Create RLS policies for each table
                for (const table of tables.data) {
                    const tableName = table.table_name;
                    
                    // Enable RLS on table
                    await executeSqlWithFallback(
                        `ALTER TABLE ${validatedInput.schemaName}.${tableName} ENABLE ROW LEVEL SECURITY`,
                        context
                    );
                    
                    // Create basic CRUD policies
                    const policies = [
                        {
                            name: `${validatedInput.roleName}_select_${tableName}`,
                            operation: 'SELECT',
                            condition: `auth.role() = '${validatedInput.roleName}'`
                        },
                        {
                            name: `${validatedInput.roleName}_insert_${tableName}`,
                            operation: 'INSERT',
                            condition: `auth.role() = '${validatedInput.roleName}'`
                        },
                        {
                            name: `${validatedInput.roleName}_update_${tableName}`,
                            operation: 'UPDATE',
                            condition: `auth.role() = '${validatedInput.roleName}'`
                        },
                        {
                            name: `${validatedInput.roleName}_delete_${tableName}`,
                            operation: 'DELETE',
                            condition: `auth.role() = '${validatedInput.roleName}'`
                        }
                    ];
                    
                    for (const policy of policies) {
                        const policySQL = `
                            CREATE POLICY ${policy.name}
                            ON ${validatedInput.schemaName}.${tableName}
                            FOR ${policy.operation}
                            TO ${validatedInput.roleName}
                            USING (${policy.condition})
                        `;
                        
                        try {
                            await executeSqlWithFallback(policySQL, context);
                            rlsPolicies.push({
                                table: tableName,
                                policy: policy.name,
                                operation: policy.operation
                            });
                        } catch (error: any) {
                            context.log(`Warning: Could not create policy ${policy.name}: ${error.message}`, 'warn');
                        }
                    }
                    
                    // Grant table permissions
                    await executeSqlWithFallback(
                        `GRANT SELECT, INSERT, UPDATE, DELETE ON ${validatedInput.schemaName}.${tableName} TO ${validatedInput.roleName}`,
                        context
                    );
                }
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: "Role created with RLS policies",
                            role: validatedInput.roleName,
                            schema: validatedInput.schemaName,
                            tables_processed: tables.data.length,
                            policies_created: rlsPolicies.length,
                            policies: rlsPolicies
                        }, null, 2)
                    }]
                };
            }
            
            case 'grant': {
                if (!validatedInput.roleName || (!validatedInput.permissions && !validatedInput.grantTo)) {
                    throw new Error("Role name and either permissions or grantTo is required");
                }
                
                const results = [];
                
                if (validatedInput.grantTo) {
                    // Grant role membership
                    const sql = `GRANT ${validatedInput.grantTo} TO ${validatedInput.roleName}`;
                    await executeSqlWithFallback(sql, context);
                    results.push({
                        type: 'role_membership',
                        granted: validatedInput.grantTo,
                        to: validatedInput.roleName
                    });
                }
                
                if (validatedInput.permissions && validatedInput.objectName) {
                    // Grant object permissions
                    for (const permission of validatedInput.permissions) {
                        let sql = '';
                        const objectRef = validatedInput.schemaName && validatedInput.objectType !== 'database' 
                            ? `${validatedInput.schemaName}.${validatedInput.objectName}`
                            : validatedInput.objectName;
                        
                        switch (validatedInput.objectType) {
                            case 'table':
                                sql = `GRANT ${permission} ON TABLE ${objectRef} TO ${validatedInput.roleName}`;
                                break;
                            case 'schema':
                                sql = `GRANT ${permission} ON SCHEMA ${validatedInput.objectName} TO ${validatedInput.roleName}`;
                                break;
                            case 'database':
                                sql = `GRANT ${permission} ON DATABASE ${validatedInput.objectName} TO ${validatedInput.roleName}`;
                                break;
                            case 'function':
                                sql = `GRANT ${permission} ON FUNCTION ${objectRef} TO ${validatedInput.roleName}`;
                                break;
                            case 'sequence':
                                sql = `GRANT ${permission} ON SEQUENCE ${objectRef} TO ${validatedInput.roleName}`;
                                break;
                            default:
                                sql = `GRANT ${permission} ON ${validatedInput.objectName} TO ${validatedInput.roleName}`;
                        }
                        
                        await executeSqlWithFallback(sql, context);
                        results.push({
                            type: 'object_permission',
                            permission,
                            object: objectRef,
                            object_type: validatedInput.objectType
                        });
                    }
                }
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: "Permissions granted successfully",
                            role: validatedInput.roleName,
                            grants: results
                        }, null, 2)
                    }]
                };
            }
            
            case 'list_permissions': {
                if (!validatedInput.roleName) {
                    throw new Error("Role name is required");
                }
                
                // Get role memberships
                const membershipsSql = `
                    SELECT 
                        r.rolname AS granted_role,
                        m.admin_option AS with_admin_option
                    FROM pg_catalog.pg_auth_members m
                    JOIN pg_catalog.pg_roles r ON (m.roleid = r.oid)
                    JOIN pg_catalog.pg_roles u ON (m.member = u.oid)
                    WHERE u.rolname = $1
                `;
                
                // Get table permissions
                const tablePermissionsSql = `
                    SELECT 
                        schemaname,
                        tablename,
                        array_agg(privilege_type) AS privileges
                    FROM information_schema.table_privileges
                    WHERE grantee = $1
                    GROUP BY schemaname, tablename
                    ORDER BY schemaname, tablename
                `;
                
                // Get schema permissions
                const schemaPermissionsSql = `
                    SELECT 
                        schema_name,
                        array_agg(privilege_type) AS privileges
                    FROM information_schema.schema_privileges
                    WHERE grantee = $1
                    GROUP BY schema_name
                    ORDER BY schema_name
                `;
                
                const [memberships, tablePermissions, schemaPermissions] = await Promise.all([
                    executeSqlWithFallback(membershipsSql, context, [validatedInput.roleName]),
                    executeSqlWithFallback(tablePermissionsSql, context, [validatedInput.roleName]),
                    executeSqlWithFallback(schemaPermissionsSql, context, [validatedInput.roleName])
                ]);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            role: validatedInput.roleName,
                            role_memberships: memberships.data,
                            table_permissions: tablePermissions.data,
                            schema_permissions: schemaPermissions.data,
                            summary: {
                                member_of_roles: memberships.data.length,
                                tables_with_permissions: tablePermissions.data.length,
                                schemas_with_permissions: schemaPermissions.data.length
                            }
                        }, null, 2)
                    }]
                };
            }
            
            case 'sync_roles': {
                const environment = validatedInput.environment || 'all';
                
                // Get current roles and their definitions
                const rolesSql = `
                    SELECT 
                        rolname,
                        rolsuper,
                        rolinherit,
                        rolcreaterole,
                        rolcreatedb,
                        rolcanlogin,
                        rolreplication,
                        rolbypassrls,
                        rolconnlimit,
                        rolvaliduntil
                    FROM pg_catalog.pg_roles
                    WHERE rolname NOT LIKE 'pg_%'
                    AND rolname != 'postgres'
                    AND rolname NOT LIKE 'supabase_%'
                    ORDER BY rolname
                `;
                
                const roles = await executeSqlWithFallback(rolesSql, context);
                const syncResults = [];
                
                for (const role of roles.data) {
                    // Generate role creation script
                    const options = [];
                    if (role.rolinherit) options.push('INHERIT'); else options.push('NOINHERIT');
                    if (role.rolcanlogin) options.push('LOGIN'); else options.push('NOLOGIN');
                    if (role.rolcreatedb) options.push('CREATEDB'); else options.push('NOCREATEDB');
                    if (role.rolcreaterole) options.push('CREATEROLE'); else options.push('NOCREATEROLE');
                    if (role.rolsuper) options.push('SUPERUSER'); else options.push('NOSUPERUSER');
                    if (role.rolreplication) options.push('REPLICATION'); else options.push('NOREPLICATION');
                    if (role.rolbypassrls) options.push('BYPASSRLS'); else options.push('NOBYPASSRLS');
                    if (role.rolconnlimit !== -1) options.push(`CONNECTION LIMIT ${role.rolconnlimit}`);
                    if (role.rolvaliduntil) options.push(`VALID UNTIL '${role.rolvaliduntil}'`);
                    
                    const createScript = `CREATE ROLE ${role.rolname} ${options.join(' ')};`;
                    
                    // Get role memberships
                    const membershipsSql = `
                        SELECT r.rolname
                        FROM pg_catalog.pg_auth_members m
                        JOIN pg_catalog.pg_roles r ON (m.roleid = r.oid)
                        WHERE m.member = (SELECT oid FROM pg_roles WHERE rolname = $1)
                    `;
                    const memberships = await executeSqlWithFallback(membershipsSql, context, [role.rolname]);
                    
                    const grantScripts = memberships.data.map((m: any) => 
                        `GRANT ${m.rolname} TO ${role.rolname};`
                    );
                    
                    syncResults.push({
                        role_name: role.rolname,
                        create_script: createScript,
                        grant_scripts: grantScripts,
                        environment: environment
                    });
                }
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: "Role synchronization scripts generated",
                            environment: environment,
                            roles_processed: syncResults.length,
                            sync_scripts: syncResults,
                            deployment_notes: [
                                "Review each script before deployment",
                                "Test in development environment first", 
                                "Consider password requirements for login roles",
                                "Verify RLS policies are properly configured",
                                "Check for environment-specific role dependencies"
                            ]
                        }, null, 2)
                    }]
                };
            }
            
            case 'delete': {
                if (!validatedInput.roleName) {
                    throw new Error("Role name is required");
                }
                
                // Check if role has dependencies
                const dependenciesSql = `
                    SELECT 
                        'owns_objects' as type,
                        count(*) as count
                    FROM pg_catalog.pg_class c
                    JOIN pg_catalog.pg_roles r ON c.relowner = r.oid
                    WHERE r.rolname = $1
                    UNION ALL
                    SELECT 
                        'member_of_roles' as type,
                        count(*) as count
                    FROM pg_catalog.pg_auth_members m
                    JOIN pg_catalog.pg_roles r ON m.member = r.oid
                    WHERE r.rolname = $1
                    UNION ALL
                    SELECT 
                        'has_members' as type,
                        count(*) as count
                    FROM pg_catalog.pg_auth_members m
                    JOIN pg_catalog.pg_roles r ON m.roleid = r.oid
                    WHERE r.rolname = $1
                `;
                
                const dependencies = await executeSqlWithFallback(dependenciesSql, context, [validatedInput.roleName]);
                const hasOwnership = dependencies.data.find((d: any) => d.type === 'owns_objects')?.count > 0;
                
                if (hasOwnership) {
                    return {
                        content: [{
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                message: "Cannot delete role - it owns database objects",
                                role: validatedInput.roleName,
                                dependencies: dependencies.data,
                                suggestion: "Transfer ownership of objects or use CASCADE option carefully"
                            }, null, 2)
                        }]
                    };
                }
                
                const sql = `DROP ROLE ${validatedInput.roleName}`;
                await executeSqlWithFallback(sql, context);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: "Role deleted successfully",
                            role: validatedInput.roleName
                        }, null, 2)
                    }]
                };
            }
            
            default:
                throw new Error(`Unknown action: ${validatedInput.action}`);
        }
    }
};