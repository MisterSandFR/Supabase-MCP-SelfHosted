// Test script to verify all imports work correctly
import { z } from 'zod';

console.log('Testing all tool imports...');

// Test each import individually to catch errors
const importTests = [
    () => import('./src/tools/list_tables.js'),
    () => import('./src/tools/list_extensions.js'),
    () => import('./src/tools/list_migrations.js'),
    () => import('./src/tools/apply_migration.js'),
    () => import('./src/tools/execute_sql.js'),
    () => import('./src/tools/get_database_connections.js'),
    () => import('./src/tools/get_database_stats.js'),
    () => import('./src/tools/get_project_url.js'),
    () => import('./src/tools/get_anon_key.js'),
    () => import('./src/tools/get_service_key.js'),
    () => import('./src/tools/generate_typescript_types.js'),
    () => import('./src/tools/rebuild_hooks.js'),
    () => import('./src/tools/verify_jwt_secret.js'),
    () => import('./src/tools/list_auth_users.js'),
    () => import('./src/tools/get_auth_user.js'),
    () => import('./src/tools/delete_auth_user.js'),
    () => import('./src/tools/create_auth_user.js'),
    () => import('./src/tools/update_auth_user.js'),
    () => import('./src/tools/list_storage_buckets.js'),
    () => import('./src/tools/list_storage_objects.js'),
    () => import('./src/tools/list_realtime_publications.js'),
    () => import('./src/tools/get_logs.js'),
    () => import('./src/tools/check_health.js'),
    () => import('./src/tools/backup_database.js'),
    () => import('./src/tools/manage_docker.js'),
    () => import('./src/tools/analyze_performance.js'),
    () => import('./src/tools/validate_migration.js'),
    () => import('./src/tools/push_migrations.js'),
    () => import('./src/tools/create_migration.js'),
    () => import('./src/tools/auto_migrate.js'),
    () => import('./src/tools/manage_rls_policies.js'),
    () => import('./src/tools/analyze_rls_coverage.js'),
    () => import('./src/tools/manage_functions.js'),
    () => import('./src/tools/manage_triggers.js'),
    () => import('./src/tools/auto_create_indexes.js'),
    () => import('./src/tools/manage_roles.js'),
    () => import('./src/tools/manage_storage_policies.js'),
    () => import('./src/tools/vacuum_analyze.js'),
    () => import('./src/tools/manage_extensions.js'),
    () => import('./src/tools/sync_schema.js'),
    () => import('./src/tools/manage_secrets.js'),
    () => import('./src/tools/audit_security.js'),
    () => import('./src/tools/generate_crud_api.js'),
    () => import('./src/tools/manage_webhooks.js'),
    () => import('./src/tools/cache_management.js'),
    () => import('./src/tools/realtime_management.js'),
    () => import('./src/tools/environment_management.js'),
    () => import('./src/tools/smart_migration.js'),
    () => import('./src/tools/metrics_dashboard.js'),
];

const toolNames = [
    'list_tables', 'list_extensions', 'list_migrations', 'apply_migration', 'execute_sql',
    'get_database_connections', 'get_database_stats', 'get_project_url', 'get_anon_key', 'get_service_key',
    'generate_typescript_types', 'rebuild_hooks', 'verify_jwt_secret', 'list_auth_users', 'get_auth_user',
    'delete_auth_user', 'create_auth_user', 'update_auth_user', 'list_storage_buckets', 'list_storage_objects',
    'list_realtime_publications', 'get_logs', 'check_health', 'backup_database', 'manage_docker',
    'analyze_performance', 'validate_migration', 'push_migrations', 'create_migration', 'auto_migrate',
    'manage_rls_policies', 'analyze_rls_coverage', 'manage_functions', 'manage_triggers', 'auto_create_indexes',
    'manage_roles', 'manage_storage_policies', 'vacuum_analyze', 'manage_extensions', 'sync_schema',
    'manage_secrets', 'audit_security', 'generate_crud_api', 'manage_webhooks', 'cache_management',
    'realtime_management', 'environment_management', 'smart_migration', 'metrics_dashboard'
];

async function testImports() {
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < importTests.length; i++) {
        try {
            const module = await importTests[i]();
            const expectedToolName = toolNames[i];
            
            // Check if the expected tool export exists
            const toolExportName = expectedToolName.split('_').map((word, idx) => 
                idx === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
            ).join('') + 'Tool';
            
            if (module[toolExportName]) {
                console.log(`✅ ${expectedToolName}: OK (${toolExportName})`);
                successCount++;
            } else {
                console.log(`❌ ${expectedToolName}: Missing export ${toolExportName}`);
                console.log(`   Available exports: ${Object.keys(module).join(', ')}`);
                failCount++;
            }
        } catch (error) {
            console.log(`❌ ${toolNames[i]}: Import failed - ${error.message}`);
            failCount++;
        }
    }
    
    console.log(`\n📊 Summary: ${successCount} successful, ${failCount} failed`);
    console.log(`Total expected: ${importTests.length}`);
}

testImports().catch(console.error);