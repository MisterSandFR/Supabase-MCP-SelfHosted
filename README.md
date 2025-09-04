# Self-Hosted Supabase MCP Server - Complete Autonomy Edition

[![smithery badge](https://smithery.ai/badge/@MisterSandFR/supabase-mcp-selfhosted)](https://smithery.ai/server/@MisterSandFR/supabase-mcp-selfhosted)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Security: Enhanced](https://img.shields.io/badge/Security-Enhanced-green.svg)](https://github.com/MisterSandFR/selfhosted-supabase-mcp/wiki/Security-Guide)
[![Version: 3.0.0](https://img.shields.io/badge/Version-3.0.0-blue.svg)](https://github.com/MisterSandFR/selfhosted-supabase-mcp/releases)
[![Tools: 50+](https://img.shields.io/badge/Tools-50%2B-brightgreen.svg)](https://github.com/MisterSandFR/selfhosted-supabase-mcp#features)
[![Node: 18+](https://img.shields.io/badge/Node-18%2B-brightgreen.svg)](https://nodejs.org)

> 🚀 **Complete Autonomy Edition** - **50+ MCP tools for 100% autonomous Supabase management!** A production-ready fork of the original [selfhosted-supabase-mcp](https://github.com/HenkDz/selfhosted-supabase-mcp) by [@HenkDz](https://github.com/HenkDz) with comprehensive security improvements, complete automation tools, and enterprise-grade features for self-hosted deployments.

## 🌟 Overview

The **most comprehensive** [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol/specification) server for **self-hosted Supabase instances**. Version 3.0 introduces **19 NEW TOOLS** bringing the total to **50+ tools** for complete autonomous control over every aspect of your Supabase infrastructure.

Built upon the solid foundation created by [@HenkDz](https://github.com/HenkDz), this enhanced edition provides:
- 🔐 **Complete Security Management** - RLS, roles, policies, audit trails
- ⚙️ **Full Database Control** - Functions, triggers, indexes, migrations
- 🚀 **DevOps Automation** - Environment sync, smart migrations, auto-deployment
- 📊 **Advanced Monitoring** - Real-time metrics, performance analysis, alerting
- 🔧 **100% Autonomous Operations** - No manual intervention needed!

### Why Choose the Complete Autonomy Edition?

- ✅ **50+ Comprehensive Tools** - Complete control over your Supabase instance
- 🤖 **100% Autonomous** - Manage everything via MCP, no manual SQL needed
- 🛡️ **Enterprise Security** - Advanced RLS, audit trails, security scanning
- ⚡ **Performance Optimized** - Auto-indexing, query optimization, caching
- 🔄 **Smart Migrations** - Breaking change detection, auto-rollback
- 📈 **Real-time Monitoring** - Metrics dashboard, alerting, performance tracking
- 🐳 **Docker Ready** - Full container management for self-hosted setups
- 🚀 **Production Ready** - Battle-tested with enterprise deployments

## 📦 Installation

### Via Smithery (Recommended)

```bash
npx @smithery/cli install @mistersandfr/selfhosted-supabase-mcp
```

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/MisterSandFR/selfhosted-supabase-mcp.git
cd selfhosted-supabase-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Run the server
npm start -- --url YOUR_SUPABASE_URL --anon-key YOUR_ANON_KEY
```

## ⚙️ Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Your self-hosted Supabase URL |
| `SUPABASE_ANON_KEY` | ✅ | Anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ | Service role key for admin operations |
| `DATABASE_URL` | ❌ | Direct PostgreSQL connection for advanced features |
| `SUPABASE_AUTH_JWT_SECRET` | ❌ | JWT secret for auth operations |

### Claude Desktop Configuration

```json
{
  "mcp-servers": {
    "selfhosted-supabase": {
      "command": "npx",
      "args": [
        "@smithery/cli",
        "run",
        "@mistersandfr/selfhosted-supabase-mcp"
      ],
      "env": {
        "SUPABASE_URL": "https://your-instance.supabase.co",
        "SUPABASE_ANON_KEY": "your-anon-key",
        "SUPABASE_SERVICE_ROLE_KEY": "optional-service-key",
        "DATABASE_URL": "optional-postgres-url"
      }
    }
  }
}
```

## 🆕 New in Version 3.0.0 - Complete Autonomy!

### 🎯 19 NEW TOOLS for 100% Autonomous Management

#### 🔐 Security & Access Control (NEW!)
- **manage_rls_policies** - Complete RLS policy management with templates
- **analyze_rls_coverage** - Security analysis and policy suggestions  
- **manage_roles** - Custom roles and permissions management
- **audit_security** - Comprehensive security auditing

#### ⚙️ Database Automation (NEW!)
- **manage_functions** - PostgreSQL function CRUD with auto-generation
- **manage_triggers** - Trigger management including audit trails
- **auto_create_indexes** - Automatic index optimization
- **vacuum_analyze** - Database maintenance automation

#### 🚀 DevOps & CI/CD (NEW!)
- **smart_migration** - Intelligent migrations with breaking change detection
- **sync_schema** - Schema synchronization between environments
- **environment_management** - Dev/staging/prod management

#### 📡 Integration & APIs (NEW!)
- **generate_crud_api** - Auto-generate complete REST APIs
- **manage_webhooks** - Webhook configuration with pg_net
- **realtime_management** - Realtime channels and broadcasts
- **cache_management** - Materialized views and caching

#### 📊 Monitoring & Operations (NEW!)
- **metrics_dashboard** - Real-time metrics and monitoring
- **manage_secrets** - Secrets and environment variables
- **manage_storage_policies** - Storage bucket security

## 🛠️ Complete Tool Reference (50+ Tools)

### 🔐 Security & Access Control
| Tool | Description |
|------|-------------|
| `manage_rls_policies` | Create, update, delete RLS policies with templates (user_owned, tenant_isolation, etc.) |
| `analyze_rls_coverage` | Analyze security coverage, detect unprotected tables, suggest policies |
| `manage_roles` | Create custom database roles with granular permissions |
| `audit_security` | Complete security audit with compliance checking |
| `manage_storage_policies` | Storage bucket policies with security templates |

### ⚙️ Database Management
| Tool | Description |
|------|-------------|
| `manage_functions` | CRUD operations for PostgreSQL functions with auto-generation |
| `manage_triggers` | Create triggers including audit and timestamp triggers |
| `auto_create_indexes` | Analyze queries and automatically create optimal indexes |
| `vacuum_analyze` | Automated VACUUM, ANALYZE, REINDEX operations |
| `manage_extensions` | Install and configure PostgreSQL extensions |
| `execute_sql` | Execute raw SQL with injection protection |
| `list_tables` | List database tables and columns |

### 🚀 Migrations & Deployment
| Tool | Description |
|------|-------------|
| `auto_migrate` | Automatically detect and apply pending migrations |
| `smart_migration` | Intelligent migrations with breaking change detection |
| `sync_schema` | Synchronize schema between environments |
| `environment_management` | Manage dev/staging/production environments |
| `create_migration` | Create new migration files with versioning |
| `validate_migration` | Pre-flight validation before applying |
| `push_migrations` | Push and apply migrations to instance |

### 📡 APIs & Integration
| Tool | Description |
|------|-------------|
| `generate_crud_api` | Auto-generate complete REST APIs with TypeScript |
| `manage_webhooks` | Configure webhooks with pg_net integration |
| `realtime_management` | Manage realtime channels and broadcasts |
| `generate_typescript_types` | Generate TypeScript types from schema |

### 📊 Monitoring & Performance
| Tool | Description |
|------|-------------|
| `metrics_dashboard` | Real-time metrics dashboard with alerting |
| `analyze_performance` | Deep performance analysis and optimization |
| `cache_management` | Manage materialized views and caching |
| `get_database_stats` | Comprehensive database statistics |
| `get_database_connections` | Connection pool monitoring |

### 👥 User & Auth Management
| Tool | Description |
|------|-------------|
| `list_auth_users` | List all authentication users |
| `get_auth_user` | Get specific user details |
| `create_auth_user` | Create new users programmatically |
| `update_auth_user` | Update user information |
| `delete_auth_user` | Remove users from system |

### 💾 Storage & Backup
| Tool | Description |
|------|-------------|
| `backup_database` | Create backups in multiple formats |
| `list_storage_buckets` | List all storage buckets |
| `list_storage_objects` | List objects in buckets |
| `manage_storage_policies` | Configure bucket policies |

### 🐳 Infrastructure & DevOps
| Tool | Description |
|------|-------------|
| `manage_docker` | Docker container management |
| `check_health` | Comprehensive health checks |
| `get_logs` | Retrieve service logs |
| `manage_secrets` | Environment variables management |
| `rebuild_hooks` | Restart pg_net workers |

## 🔒 Security Features

- **SQL Injection Prevention** - Query validation and parameterization
- **Rate Limiting** - 100 req/min with adaptive throttling
- **Authentication Security** - Strong password validation, secure tokens
- **Resource Control** - Memory/CPU limits, query complexity scoring
- **Input Validation** - Comprehensive sanitization and XSS prevention
- **Audit Trails** - Complete activity logging and monitoring

## 🚀 Use Cases

### Complete Database Automation
```javascript
// Automatically optimize your database
await mcp.auto_create_indexes({ autoApply: true })
await mcp.vacuum_analyze({ action: 'full' })

// Smart migration management
await mcp.smart_migration({ detectBreakingChanges: true })
await mcp.auto_migrate({ autoApply: true })
```

### Security Hardening
```javascript
// Analyze and fix security issues
const audit = await mcp.audit_security()
const coverage = await mcp.analyze_rls_coverage()

// Apply security policies
await mcp.manage_rls_policies({
  action: 'create',
  template: 'user_owned',
  tableName: 'posts'
})
```

### API Generation
```javascript
// Generate complete CRUD API
await mcp.generate_crud_api({
  tableName: 'products',
  includeTypes: true,
  authentication: true
})
```

## 📚 Documentation

For detailed documentation, visit our [Wiki](https://github.com/MisterSandFR/selfhosted-supabase-mcp/wiki).

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting PRs.

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [@HenkDz](https://github.com/HenkDz) - Original creator of selfhosted-supabase-mcp
- The MCP and Supabase communities
- All contributors and security researchers

---

**Made with ❤️ by [MisterSandFR](https://github.com/MisterSandFR)** | Based on original work by [@HenkDz](https://github.com/HenkDz)